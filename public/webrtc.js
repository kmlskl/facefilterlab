let socket; // Socket.io connection
let peer; // WebRTC peer
let myStream; // Local media stream
let remoteStream; // Stream received from the peer

const servers = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

// Initialize the app
async function initApp(videoElementId) {
  try {
    // Step 1: Initialize socket connection
    initSocket();

    // Step 2: Initialize local camera
    await initCamera(videoElementId);
  } catch (error) {
    console.error("Error initializing the app:", error);
  }
}

// Initialize Socket.io connection
function initSocket() {
  socket = io.connect("/");

  socket.on("connect", () => {
    console.log(`Connected to signaling server. My ID: ${socket.id}`);

    // Inform server we're ready, and check if we're the first or joining
    socket.emit("ready", socket.id);

    // Handle server response to determine role
    socket.on("role", (role, existingPeerId) => {
      console.log(`Role assigned: ${role}`);
      if (role === "initiator") {
        createPeer(true, null); // Create peer as initiator
      } else if (role === "joiner" && existingPeerId) {
        createPeer(false, existingPeerId); // Join existing connection
      }
    });
  });

  socket.on("signal", (peerId, signal) => {
    if (peer) {
      peer.signal(signal);
    } else if (signal.type === "offer") {
      console.log("Received offer, creating peer as a receiver...");
      createPeer(false, peerId);
      peer.signal(signal);
    }
  });

  socket.on("disconnect", () => {
    console.warn("Disconnected from signaling server.");
  });
}

// Initialize camera
async function initCamera(videoElementId) {
  try {
    myStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    // Display local camera feed
    const videoElement = document.getElementById(videoElementId);
    videoElement.srcObject = myStream;
    console.log("Camera initialized.");
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("Camera access is required for this app.");
  }
}

// Create a WebRTC peer
function createPeer(initiator, peerId) {
  peer = new SimplePeer({
    initiator,
    stream: myStream,
    config: servers,
  });

  peer.on("signal", (data) => {
    console.log("Sending signal data...");
    socket.emit("signal", peerId, data);
  });

  peer.on("stream", (stream) => {
    console.log("Receiving remote stream...");
    remoteStream = stream;

    // Display the remote stream
    const remoteVideo = document.getElementById("remote-video");
    remoteVideo.srcObject = remoteStream;
  });

  peer.on("close", () => {
    console.log("Peer connection closed.");
  });

  peer.on("error", (error) => {
    console.error("Peer connection error:", error);
  });
}

const startSessionButton = document.getElementById("start_session");
startSessionButton.addEventListener("click", () => {
  initApp(true, "hologram", "local-video");
});
