const express = require("express");
const app = express();
const http = require("http").createServer(app);
const cors = require("cors");

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

const DUMMY_USERS = [
  {
    id: 1,
    username: "john",
    password: "doe",
  },
  {
    id: 2,
    username: "test",
    password: "test",
  },
];

let foundUser;

passport.use(
  new LocalStrategy((username, password, done) => {
    [foundUser] = DUMMY_USERS.filter((user) => user.username === username);
    console.log(foundUser);
    if (username === foundUser.username && password === foundUser.password) {
      console.log("authentication OK");
      return done(null, foundUser);
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

passport.deserializeUser((id, cb) => {
  console.log(`deserializeUser ${id}`);
  cb(null, foundUser);
});

const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const wrap = (middleware) => (socket, next) =>
  middleware(socket.request, {}, next);

io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

io.use((socket, next) => {
  console.log(socket.request);
  if (socket.request.user) {
    next();
  } else {
    next(new Error("unauthorized"));
  }
});

io.on("connect", (socket) => {
  socket.emit("new user", `new connection ${socket.id}`);
  console.log("new user");
  socket.on("whoami", (cb) => {
    cb(socket.request.user ? socket.request.user.username : "");
  });
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
