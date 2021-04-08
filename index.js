const express = require("express");
const app = express();
const http = require("http").createServer(app);
const cors = require("cors");
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const port = process.env.PORT || 8000;
app.use(cors());

const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const sessionMiddleware = session({
  secret: "changeit",
  resave: false,
  saveUninitialized: false,
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

const DUMMY_USER = {
  id: 1,
  username: "john",
};

passport.use(
  new LocalStrategy((username, password, done) => {
    if (username === "john" && password === "doe") {
      console.log("authentication OK");
      return done(null, DUMMY_USER);
    } else {
      console.log("wrong credentials");
      return done(null, false);
    }
  })
);

app.get("/", (req, res) => {
  const isAuthenticated = !!req.user;
  if (isAuthenticated) {
    console.log(`user is authenticated, session is ${req.session.id}`);
  } else {
    console.log("unknown user");
  }
  res.sendFile(isAuthenticated ? "index.html" : "login.html", {
    root: __dirname,
  });
});

app.post("/login", passport.authenticate("local"), (req, res) => {
  console.log(req.body.username);
  res.send(req.body);
});

passport.serializeUser((user, cb) => {
  console.log(`serializeUser ${user.id}`);
  cb(null, user.id);
});

const wrap = (middleware) => (socket, next) =>
  middleware(socket.request, {}, next);

io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

io.use((socket, next) => {
  if (socket.request.user) {
    next();
  } else {
    next(new Error("unauthorized"));
  }
});

io.on("connect", (socket) => {
  socket.on("whoami", (cb) => {
    cb(socket.request.user ? socket.request.user.username : "");
  });
  socket.emit("new user", `new connection ${socket.id}`);
  console.log("new user");
  socket.on("newChatMessage", (msg) => {
    io.emit("newChatMessage", msg);
  });

  const session = socket.request.session;
  console.log(`saving sid ${socket.id} in session ${session.id}`);
  session.socketId = socket.id;
  session.save();
});

http.listen(port, () => {
  console.log(`application is running at: http://localhost:${port}`);
});
