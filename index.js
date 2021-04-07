const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.emit("new user", "welcome new user");
  console.log("new user");
  socket.on("newChatMessage", (msg) => {
    io.emit("newChatMessage", msg);
  });
});

http.listen(8000, () => {
  console.log("listening on port 8000");
});
