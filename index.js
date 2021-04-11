const express = require("express");
const app = express();
const http = require("http").createServer(app);
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./schema/User");

const port = process.env.PORT || 8000;
app.use(cors());

const uri = process.env.ATLAS_URI;
mongoose.connect(uri, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true,
});
const connection = mongoose.connection;
connection.once("open", () => {
  console.log("###### Connected to MongoDB #####");
});
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const sessionMiddleware = session({
  secret: "cats are very cool",
  resave: false,
  saveUninitialized: false,
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

let foundUser;

passport.use(
  new LocalStrategy((username, password, done) => {
    User.find()
      .then((users) => {
        [foundUser] = users.filter((user) => user.username === username);
        return foundUser;
      })
      .then((foundUser) => {
        if (!foundUser) {
          console.log("user not found");
          return done(null, false);
        }
        if (
          username === foundUser.username &&
          password === foundUser.password
        ) {
          console.log("authentication OK");
          return done(null, foundUser);
        } else {
          console.log("wrong credentials");
          return done(null, false);
        }
      });
  })
);

app.get("/", (req, res) => {
  const isAuthenticated = !!req.user;
  if (isAuthenticated) {
    console.log(`user is authenticated, session is ${req.session.id}`);
  } else {
    console.log("unknown user");
  }
  res.send(req.user);
});

app.post("/login", passport.authenticate("local"), (req, res) => {
  res.send(req.body);
  const isAuthenticated = !!req.user;
  if (isAuthenticated) {
    console.log(`user is authenticated, session is ${req.session.id}`);
  } else {
    console.log("unknown user");
  }
});

app.post("/register", (req, res) => {
  const { username, password } = req.body;
  const newUser = new User({
    username,
    password,
  });
  newUser
    .save()
    .then(() => res.json("success"))
    .catch((err) => res.status(400).json("Error " + err));
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
  if (socket.request) {
    next();
  } else {
    next(new Error("unauthorized"));
  }
});

io.on("connect", (socket) => {
  const session = socket.request.session;
  console.log(`saving sid ${socket.id} in session ${session.id}`);
  const { roomId } = socket.handshake.query;
  console.log(roomId);
  socket.join(roomId);
  socket.emit("new user", `new connection ${socket.id}`);
  console.log("new user");
  socket.on("newChatMessage", (msg) => {
    io.in(roomId).emit("newChatMessage", msg);
  });
  session.socketId = socket.id;
  session.save();
  socket.on("disconnect", () => {
    socket.leave(roomId);
  });
});

http.listen(port, () => {
  console.log(`application is running at: http://localhost:${port}`);
});
