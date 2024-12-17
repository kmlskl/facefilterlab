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

const getLocalIPAddress = async () => {
  return new Promise((resolve, reject) => {
    const pc = new RTCPeerConnection({ iceServers: [] }); // Create a new peer connection
    pc.createDataChannel(""); // Create a dummy data channel

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer)) // Set local description
      .catch(reject);

    pc.onicecandidate = (event) => {
      if (!event || !event.candidate) return; // No candidate, skip
      const candidate = event.candidate.candidate; // Get the ICE candidate
      const ipMatch = candidate.match(/(\d{1,3}(\.\d{1,3}){3})/); // Match IPv4 address
      if (ipMatch) {
        resolve(ipMatch[1]); // Resolve with the IP address
        pc.close(); // Close the peer connection
      }
    };

    pc.onicecandidateerror = (error) => reject(error); // Handle errors
  });
};

const initApp = async (canvasId) => {
  try {
    const localIP = await getLocalIPAddress();
    initSocket(localIP);

    await initCanvasStream(canvasId);
  } catch (error) {
    console.error("Error initializing the app:", error);
  }
};

// Initialize Socket.io connection
const initSocket = (localIP) => {
  const serverUrl = `https://${localIP}:2000`;
  socket = io.connect(serverUrl);
  socket.on("connect", () => {
    console.log(`Connected. My ID: ${socket.id}`);
  });

  socket.on("client-disconnect", (client) => {
    if (peer && peer.data.id === client.id) {
      peer.destroy();
    }
  });

  socket.on("signal", async (myId, signal, peerId) => {
    if (peer) {
      peer.signal(signal);
    } else if (signal.type === "offer") {
      createPeer(false, peerId);
      peer.signal(signal);
    }
  });
};

const createPeer = (initiator, peerId) => {
  peer = new SimplePeer({
    initiator,
    stream: myStream,
    // config: servers,
    objectMode: true,
  });

  peer.data = {
    id: peerId,
  };

  peer.on("signal", (data) => {
    console.log("Sending signal data...");
    socket.emit("signal", peerId, data);
  });

  peer.on("data", (data) => {
    console.log("Data received: " + data);

    try {
      data = JSON.parse(data);
      if (data.type === "drawingData") {
        console.log(data);
      }
      if (data.type === "message") {
        console.log(data);
      }
      if (data.type === "clearCanvas") {
        console.log(data);
      }
      if (data.type === "color") {
        console.log(data);
      }
    } catch (e) {
      console.log(e);
    }
  });

  peer.on("close", () => {
    console.log("Peer connection closed.");
    peer.destroy();
    peer = null;
  });

  peer.on("error", (error) => {
    console.error("Peer connection error:", error);
  });
};

async function initCanvasStream(canvasId) {
  try {
    const canvas = document.querySelector(`.canvas_stream`);
    if (!canvas) {
      throw new Error(`Canvas with ID ${canvasId} not found.`);
    }

    myStream = await canvas.captureStream(30);
    console.log("Canvas stream initialized.");
  } catch (error) {
    console.error("Error initializing canvas stream:", error);
    alert("Canvas access is required for this app.");
  }
}

// const startSessionButton = document.querySelector(".start_session");
// startSessionButton.addEventListener("click", () => {
//   initApp("canvas_stream");
// });

initApp("canvas_stream");

// const testVideo = document.querySelector(".local_video");
// testVideo.srcObject = myStream;
// testVideo.play();
