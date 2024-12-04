const fs = require("fs");
const express = require("express");
const https = require("https");
const { Server } = require("socket.io");

// HTTPS server options
const options = {
  key: fs.readFileSync("certs/key.pem"),
  cert: fs.readFileSync("certs/cert.pem"),
};

// Express app and HTTPS server
const app = express();
const server = https.createServer(options, app);
const io = new Server(server);

// Port configuration
const port = process.env.PORT || 2000;

// Serve static files from "public"
app.use(express.static("public"));

// Track connected clients
const clients = {};

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  clients[socket.id] = socket; // Add client to clients list

  // Determine role and inform the client
  const clientIds = Object.keys(clients);
  if (clientIds.length === 1) {
    // First client becomes initiator
    socket.emit("role", "initiator");
  } else {
    // Subsequent clients become joiners
    const existingPeerId = clientIds.find((id) => id !== socket.id);
    socket.emit("role", "joiner", existingPeerId);
  }

  // Handle signaling messages
  socket.on("signal", (peerId, signal) => {
    console.log(`Relaying signal from ${socket.id} to ${peerId}`);
    if (clients[peerId]) {
      clients[peerId].emit("signal", signal, socket.id);
    }
  });

  // Handle client disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    delete clients[socket.id]; // Remove client from the list
  });
});

// Start HTTPS server
server.listen(port, () => {
  console.log(`App listening on https://localhost:${port}`);
});
