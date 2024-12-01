const fs = require("fs");
const options = {
  key: fs.readFileSync("certs/key.pem"),
  cert: fs.readFileSync("certs/cert.pem"),
};
const express = require("express");
const app = express();
const https = require("https");
const server = https.createServer(options, app);
const { Server } = require("socket.io");
const io = new Server(server);
const port = process.env.PORT || 2000;

app.use(express.static("public"));

const clients = {};

io.on("connection", (socket) => {
  clients[socket.id] = { id: socket.id };
  console.log("Socket connected", socket.id);

  socket.on("signal", (peerId, signal) => {
    console.log(`Received signal from ${socket.id} to ${peerId}`);
    io.to(peerId).emit("signal", peerId, signal, socket.id);
  });

  socket.on("disconnect", () => {
    clearInterval(clients[socket.id].gameTimer);
    clearInterval(clients[socket.id].progressTimer);
    delete clients[socket.id];
    console.log("Disconnected from server");
  });

  io.emit("clients", clients);

  const clientId = clients[socket.id];
  io.emit("myId", clientId);
});

server.listen(port, () => {
  console.log(`App listening on port ${port}!`);
});
