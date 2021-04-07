const app = require("express")();
const http = require("http").createServer(app);
const cors = require("cors");
app.use(cors());
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const port = process.env.PORT || 8000;

app.get("/", (req, res) => {
  res.send("hello");
});

io.on("connection", (socket) => {
  socket.emit("new user", "welcome new user");
  console.log("new user");
  socket.on("newChatMessage", (msg) => {
    io.emit("newChatMessage", msg);
  });
});

http.listen(port, () => {
  console.log(`listening on port ${port}`);
});
