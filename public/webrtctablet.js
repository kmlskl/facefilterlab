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

async function initApp() {
  try {
    initSocket();
  } catch (error) {
    console.error("Error initializing the app:", error);
  }
}

// // Initialize Socket.io connection
// function initSocket() {
//   socket = io.connect("https://192.168.0.138:2000");

//   socket.on("connect", () => {
//     console.log(`Connected to signaling server. My ID: ${socket.id}`);

//     // Inform server we're ready, and check if we're the first or joining
//     socket.emit("ready", socket.id);

//     // Handle server response to determine role
//     socket.on("role", (role, existingPeerId) => {
//       console.log(`Role assigned: ${role}`);
//       if (role === "initiator") {
//         createPeer(true, null); // Create peer as initiator
//       } else if (role === "joiner" && existingPeerId) {
//         createPeer(false, existingPeerId); // Join existing connection
//       }
//     });
//   });

//   socket.on("signal", (peerId, signal) => {
//     if (peer) {
//       peer.signal(signal);
//     } else if (signal.type === "offer") {
//       console.log("Received offer, creating peer as a receiver...");
//       createPeer(false, peerId);
//       peer.signal(signal);
//     }
//   });

//   socket.on("disconnect", () => {
//     console.warn("Disconnected from signaling server.");
//   });
// }

const initSocket = () => {
  //   const localIPAddress = window.location.hostname;
  socket = io.connect(`https://172.30.12.166:2000`);

  socket.on("connect", () => {
    socket.on("initiatorId", (initiatorId) => {
      if (initiatorId) {
        createPeer(true, initiatorId);
      }
    });
  });

  socket.on("client-disconnect", (client) => {
    if (peer && peer.data.id === client.id) {
      peer.destroy();
    }
  });

  //   socket.on("role", (role, existingPeerId) => {
  //     console.log(`Assigned role: ${role}`);
  //     if (role === "initiator") {
  //       console.log("Creating peer as initiator...");
  //       createPeer(true, null); // Initiator doesn't need target socket ID initially
  //     } else if (role === "joiner" && existingPeerId) {
  //       console.log(`Creating peer as joiner targeting ${existingPeerId}...`);
  //       createPeer(false, existingPeerId);
  //     }
  //   });

  socket.on("signal", async (myId, signal, peerId) => {
    console.log(`Received signal from ${peerId}`);
    console.log(signal);
    if (peer) {
      peer.signal(signal);
    } else if (signal.type === "offer") {
      createPeer(false, peerId);
      peer.signal(signal);
    }
  });

  socket.on("client-disconnect", (client) => {
    console.log(`Client disconnected: ${client.id}`);
    if (peer && peer.data.id === client.id) {
      peer.destroy();
    }
  });
};

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

async function initCanvasStream(canvasId) {
  try {
    const canvas = document.querySelector(`.${canvasId}`); // Assuming canvas ID is a class
    if (!canvas) {
      throw new Error(`Canvas with ID ${canvasId} not found.`);
    }

    // Capture the canvas stream
    myStream = canvas.captureStream();
    console.log("Canvas stream initialized.");

    // // Optionally, display the canvas content locally in a <video> element
    // const videoElement = document.getElementById("webcam");
    // videoElement.srcObject = myStream;
  } catch (error) {
    console.error("Error initializing canvas stream:", error);
    alert("Canvas access is required for this app.");
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

    if (remoteVideo) {
      // Assign the received stream to the video element
      remoteVideo.srcObject = stream;
      remoteVideo.play(); // Ensure playback starts
    } else {
      console.error("Remote video element not found!");
    }
  });

  peer.on("data", (data) => {
    console.log("data: " + data);
  });

  peer.on("connect", () => {
    console.log("Peer connection established.");

    // Send a test message
    const data = { type: "message", content: "Hello, peer!" };
    console.log("Sending message:", data);
    peer.send(JSON.stringify(data));
  });

  peer.on("close", () => {
    console.log("Peer connection closed.");
  });

  peer.on("error", (error) => {
    console.error("Peer connection error:", error);
  });
}

const startSessionButton = document.querySelector(".start_session");
startSessionButton.addEventListener("click", () => {
  initApp("canvas_stream");
});
