import lottie from "lottie-web"; // Import Lottie for animations

// ---------------------------
// WebRTC Setup
// ---------------------------

let socket; // Socket.io connection
let peer; // WebRTC peer
let myStream; // Local media stream
let remoteStream; // Stream received from the peer
const remoteVideo = document.querySelector(".remote_video");
const faceCanvas = document.querySelector(".face_canvas");
const faceCanvasContext = faceCanvas.getContext("2d");

const servers = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

// ---------------------------
// UI Management
// ---------------------------

let currentInstructionStep = 0;

const instructionSteps = [
  {
    name: "instruction1",
    show: ["instructions", "instruction1"],
    hide: ["instruction2", "instruction3", "instruction4", "tools"],
  },
  {
    name: "instruction2",
    show: ["instructions", "instruction2"],
    hide: ["instruction1", "instruction3", "instruction4", "tools"],
  },
  {
    name: "instruction3",
    show: ["instructions", "instruction3"],
    hide: ["instruction1", "instruction2", "instruction4", "tools"],
  },
  {
    name: "instruction4",
    show: ["instructions", "instruction4"],
    hide: ["instruction1", "instruction2", "instruction3", "tools"],
  },
  {
    name: "tools",
    show: ["tools", "navbar--button__undo", "navbar--button__next","suggestion"],
    hide: ["instructions"],
  },
];

let selectedTool = "pencilBig";

const toolButtons = document.querySelectorAll(".tool");
toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    toolButtons.forEach((btn) => {
      btn.classList.remove("selected");
    });
    button.classList.add("selected");

    selectedTool = button.dataset.tool;
    console.log("Selected tool:", selectedTool);
    
    let toolballPos = document.querySelector(".toolball")
    toolballPos.classList.remove("brushYellow", "brushOrange", "brushRed", "brushGreen", "brushPurple", "brushPink" ,"pencilSmall", "pencilBig", "eraser");
    toolballPos.classList.add(selectedTool);
    

    // Optionally, send selected tool via WebRTC
    if (peer && peer.connected) {
      peer.send(
        JSON.stringify({
          type: "toolChange",
          tool: selectedTool,
        }),
      );
    }
  });
});

const renderInstructionStep = () => {
  instructionSteps.forEach((step, index) => {
    if (index === currentInstructionStep) {
      step.show.forEach((selector) => {
        const element = document.querySelector(`.${selector}`);
        if (element) {
          element.classList.remove("none");
        }
      });
      step.hide.forEach((selector) => {
        const element = document.querySelector(`.${selector}`);
        if (element) {
          element.classList.add("none");
        }
      });
    }
  });
};

const nextInstructionStep = () => {
  if (currentInstructionStep < instructionSteps.length - 1) {
    currentInstructionStep++;
    renderInstructionStep();

    // Optionally, notify peer about instruction step change
    if (peer && peer.connected) {
      peer.send(
        JSON.stringify({
          type: "instructionStep",
          step: currentInstructionStep,
        }),
      );
    }
  }
};

const prevInstructionStep = () => {
  if (currentInstructionStep > 0) {
    currentInstructionStep--;
    renderInstructionStep();

    // Optionally, notify peer about instruction step change
    if (peer && peer.connected) {
      peer.send(
        JSON.stringify({
          type: "instructionStep",
          step: currentInstructionStep,
        }),
      );
    }
  }
};

document
  .querySelector(".instruction_check")
  .addEventListener("click", (event) => {
    nextInstructionStep();
  });

document
  .querySelector(".navbar--button__undo")
  .addEventListener("click", (event) => {
    prevInstructionStep();
  });

const startExperience = () => {
  document.querySelector(".start").classList.add("none");
  document.querySelector(".experience").classList.remove("none");
  document.querySelector(".navbar").classList.remove("none");

  // Optionally, notify peer that experience has started
  if (peer && peer.connected) {
    peer.send(
      JSON.stringify({
        type: "experienceStarted",
      }),
    );
  }

  remoteVideo.play();
};

const backToStart = () => {
  document.querySelector(".start").classList.remove("none");
  document.querySelector(".instructions").classList.add("none");
  document.querySelector(".navbar").classList.add("none");
  document.querySelector(".canvas_container").classList.add("none");

  // Optionally, notify peer to return to start
  if (peer && peer.connected) {
    peer.send(
      JSON.stringify({
        type: "backToStart",
      }),
    );
  }
};

document.querySelector(".start--button").addEventListener("click", function () {
  startExperience();
});

// Go to options page
document
  .querySelector(".navbar--button__next")
  .addEventListener("click", function () {
    // document.querySelector(".application").classList.add("none");
    document.querySelector(".option").classList.remove("none");
    document.querySelector(".tools").classList.add("none");
    document.querySelector(".navbar--button__undo").classList.add("none");
    document.querySelector(".navbar--button__next").classList.add("none");
    document
      .querySelector(".navbar--button__back-drawing")
      .classList.remove("none");
    document
      .querySelector(".navbar--button__empty-right")
      .classList.remove("none");
  });

// Go to delete page
document
  .querySelector(".option--text__delete")
  .addEventListener("click", function () {
    document.querySelector(".option").classList.add("none");
    document.querySelector(".delete__page").classList.remove("none");
    document
      .querySelector(".navbar--button__back-options")
      .classList.remove("none");
    document
      .querySelector(".navbar--button__back-drawing")
      .classList.add("none");
    document.querySelector(".nav__title").classList.add("hidden");
  });

// Delete page to options
document
  .querySelectorAll(".navbar--button__back-options, .delete--text__back")
  .forEach(function (element) {
    element.addEventListener("click", function () {
      document.querySelector(".option").classList.remove("none");
      document.querySelector(".delete__page").classList.add("none");
      document
        .querySelector(".navbar--button__back-options")
        .classList.add("none");
      document.querySelector(".nav__title").classList.remove("hidden");
      document
        .querySelector(".navbar--button__back-drawing")
        .classList.remove("none");
    });
  });

// Go to save page
document
  .querySelector(".option--text__save")
  .addEventListener("click", function () {
    document.querySelector(".option").classList.add("none");
    document.querySelector(".save__page").classList.remove("none");
    document
      .querySelector(".navbar--button__back-options")
      .classList.remove("none");
    document
      .querySelector(".navbar--button__back-drawing")
      .classList.add("none");
    document.querySelector(".nav__title").classList.add("hidden");
  });

// Save page to options
document
  .querySelectorAll(".navbar--button__back-options, .save--text__back")
  .forEach(function (element) {
    element.addEventListener("click", function () {
      document.querySelector(".option").classList.remove("none");
      document.querySelector(".save__page").classList.add("none");
      document
        .querySelector(".navbar--button__back-options")
        .classList.add("none");
      document.querySelector(".nav__title").classList.remove("hidden");
      document
        .querySelector(".navbar--button__back-drawing")
        .classList.remove("none");
    });
  });

// Options page to application
document
  .querySelector(".navbar--button__back-drawing")
  .addEventListener("click", function () {
    document.querySelector(".save__page").classList.add("none");
    document
      .querySelector(".navbar--button__empty-right")
      .classList.add("none");
    document
      .querySelector(".navbar--button__back-options")
      .classList.add("none");

    document.querySelector(".option").classList.add("none");
    document.querySelector(".application").classList.remove("none");
    document.querySelector(".navbar--button__undo").classList.remove("none");
    document.querySelector(".navbar--button__next").classList.remove("none");
    document
      .querySelector(".navbar--button__back-drawing")
      .classList.add("none");

    // Optionally, notify peer to return to application
    if (peer && peer.connected) {
      peer.send(
        JSON.stringify({
          type: "returnToApplication",
        }),
      );
    }
  });

// Go to final page
document
  .querySelectorAll(".delete--text__delete, .save--text__save")
  .forEach(function (element) {
    element.addEventListener("click", function () {
      document.querySelector(".delete__page").classList.add("none");
      document.querySelector(".save__page").classList.add("none");
      document
        .querySelector(".navbar--button__back-options")
        .classList.add("none");
      document.querySelector(".final__page").classList.remove("none");

      // Optionally, notify peer to go to final page
      if (peer && peer.connected) {
        peer.send(
          JSON.stringify({
            type: "finalPage",
          }),
        );
      }
    });
  });

// Final page to start
document.querySelector(".final--text").addEventListener("click", function () {
  document.querySelector(".final__page").classList.add("none");
  document.querySelector(".start").classList.remove("none");
  document.querySelector(".navbar").classList.add("none");
  document.querySelector(".nav__title").classList.add("none");

  // Optionally, notify peer to return to start
  if (peer && peer.connected) {
    peer.send(
      JSON.stringify({
        type: "returnToStart",
      }),
    );
  }
});

// Tool logic for selection
document.querySelectorAll(".deselected, .selected").forEach(function (element) {
  element.addEventListener("click", function () {
    document.querySelectorAll(".selected").forEach(function (selectedElement) {
      selectedElement.classList.remove("selected");
    });
    element.classList.add("selected");
  });
});

// Lottie animation setup
lottie.loadAnimation({
  container: document.querySelector(".lottie"),
  renderer: "svg",
  loop: true,
  autoplay: true,
  path: "./assets/idle3.json",
});

let isTouching = false;

function getNormalizedCoordinates(touch) {
  const rect = faceCanvas.getBoundingClientRect();
  const x = (touch.clientX - rect.left) / rect.width;
  const y = (touch.clientY - rect.top) / rect.height;
  return { x, y };
}

// Updated Touch Handlers with Normalization
faceCanvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  isTouching = true;
  const touch = e.touches[0];
  const { x, y } = getNormalizedCoordinates(touch);

  sendTouchData({ type: "touchstart", x, y });
});

faceCanvas.addEventListener("touchmove", (e) => {
  // e.preventDefault();
  if (!isTouching) return;
  const touch = e.touches[0];
  const { x, y } = getNormalizedCoordinates(touch);

  sendTouchData({ type: "touchmove", x, y });
});

// Handle touch end
faceCanvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  isTouching = false;

  // Send touch end event
  sendTouchData({ type: "touchend" });
});

// Function to send touch data via WebRTC
function sendTouchData(data) {
  if (peer && peer.connected) {
    peer.send(JSON.stringify(data));
    console.log("Sending touch data:", data);
  }
}

// Function to start drawing video frames onto the canvas
function startDrawing() {
  if (!remoteVideo || !faceCanvasContext) {
    console.error("Remote video or canvas context not found!");
    return;
  }

  // Ensure the video is playing
  remoteVideo.play();

  remoteVideo.addEventListener("loadedmetadata", () => {
    // Adjust canvas size if needed
    faceCanvas.width = remoteVideo.videoWidth;
    faceCanvas.height = remoteVideo.videoHeight;
  });

  // Function to draw each frame
  function drawFrame() {
    // Draw the current frame from the video onto the canvas
    faceCanvasContext.drawImage(
      remoteVideo,
      0,
      0,
      faceCanvas.width,
      faceCanvas.height,
    );

    // Continue the loop
    requestAnimationFrame(drawFrame);
  }

  // Start the drawing loop
  requestAnimationFrame(drawFrame);
}

// ---------------------------
// WebRTC Helper Functions
// ---------------------------

// const getLocalIPAddress = async () => {
//   return new Promise((resolve, reject) => {
//     const pc = new RTCPeerConnection({ iceServers: [] }); // Create a new peer connection
//     pc.createDataChannel(""); // Create a dummy data channel

//     pc.createOffer()
//       .then((offer) => pc.setLocalDescription(offer)) // Set local description
//       .catch(reject);

//     pc.onicecandidate = (event) => {
//       if (!event || !event.candidate) return; // No candidate, skip
//       const candidate = event.candidate.candidate; // Get the ICE candidate
//       const ipMatch = candidate.match(/(\d{1,3}(\.\d{1,3}){3})/); // Match IPv4 address
//       if (ipMatch) {
//         resolve(ipMatch[1]); // Resolve with the IP address
//         pc.close(); // Close the peer connection
//       }
//     };

//     pc.onicecandidateerror = (error) => reject(error); // Handle errors
//   });
// };

// async function initCamera(videoElement) {
//   try {
//     myStream = await navigator.mediaDevices.getUserMedia({
//       video: true,
//       audio: false,
//     });

//     // Display local camera feed
//     const videoElement = document.querySelector(videoElement);
//     if (videoElement) {
//       videoElement.srcObject = myStream;
//       videoElement.play();
//       console.log("Camera initialized.");
//     } else {
//       console.error(`Video element with ID ${videoElementId} not found.`);
//     }
//   } catch (error) {
//     console.error("Error accessing camera:", error);
//     alert("Camera access is required for this app.");
//   }
// }

// Initialize Canvas Stream for WebRTC (if needed)
// async function initCanvasStream(canvasId) {
//   try {
//     const canvas = document.querySelector(`.${canvasId}`); // Assuming canvas ID is a class
//     if (!canvas) {
//       throw new Error(`Canvas with class ${canvasId} not found.`);
//     }

//     // Capture the canvas stream
//     myStream = canvas.captureStream(30);
//     console.log("Canvas stream initialized.");

//     // Optionally, display the canvas content locally in a <video> element
//     const videoElement = document.getElementById("webcam");
//     if (videoElement) {
//       videoElement.srcObject = myStream;
//       videoElement.play();
//     }
//   } catch (error) {
//     console.error("Error initializing canvas stream:", error);
//     alert("Canvas access is required for this app.");
//   }
// }

// Initialize Socket.io connection

const initSocket = () => {
  const serverUrl = `https://${LOCAL_IP}:2000`;

  socket = io.connect(serverUrl, { transports: ["websocket", "polling"] });

  let clientId = localStorage.getItem("clientId");
  if (!clientId) {
    clientId = crypto.randomUUID(); // Generate a unique ID
    localStorage.setItem("clientId", clientId);
  }

  socket.on("connect", () => {
    socket.emit("declare-role", clientId, "joiner");
    console.log("declaring role as joiner");
  });

  socket.on("initiatorId", (initiatorId) => {
    console.log("Received initiator ID:", initiatorId);
    if (initiatorId && !peer) {
      createPeer(false, initiatorId);
    }
  });

  socket.on("signal", async (myId, signal, peerId) => {
    console.log(`Received signal from ${peerId}`);
    console.log(signal);
    if (peer) {
      peer.signal(signal);
    } else if (signal.type === "offer") {
      createPeer(false, peerId);
      peer.signal(signal);
    } else if (!peer) {
      console.error("No peer connection found.");
      return;
    }
  });

  socket.on("client-disconnect", (client) => {
    console.log(`Client disconnected: ${client.id}`);
    if (peer && peer.data.id === client.id) {
      peer.destroy();
    }
  });

  socket.on("refresh", () => {
    console.log("Initiator disconnected. Refreshing...");
    window.location.reload();
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
};

// Create a WebRTC peer
function createPeer(initiator, peerId) {
  peer = new SimplePeer({
    initiator,
    // stream: myStream,
    config: servers,
  });

  peer.data = {
    id: peerId,
  };

  peer.on("signal", (data) => {
    console.log("Sending signal data...", peerId, data);
    socket.emit("signal", peerId, data);
  });

  peer.on("icecandidate", (event) => {
    console.log("ICE Candidate:", event.candidate);
  });

  peer.on("stream", (stream) => {
    console.log("Receiving remote stream...");
    remoteStream = stream;

    const remoteVideo = document.querySelector(".remote_video");

    if (remoteVideo) {
      // Assign the received stream to the video element
      remoteVideo.srcObject = stream;
      // remoteVideo.play(); // Ensure playback starts
      startDrawing();
    } else {
      console.error("Remote video element not found!");
    }
  });

  peer.on("data", (data) => {
    console.log("Data received: ", data);
    try {
      const parsedData = JSON.parse(data);
      handlePeerData(parsedData);
    } catch (e) {
      console.error("Error parsing received data:", e);
    }
  });

  peer.on("connect", () => {
    console.log("Peer connection established.");

    // Send a test message
    const data = { type: "message", content: `Hello, peer.` };

    console.log("Sending message:", data);
    peer.send(JSON.stringify(data));
  });

  peer.on("close", () => {
    console.log("Peer connection closed.");
    peer.destroy();
    peer = null;
  });

  peer.on("error", (error) => {
    console.error("Peer connection error:", error);
  });
}

// ---------------------------
// Initialization Functions
// ---------------------------

async function initApp() {
  try {
    // const localIP = await getLocalIPAddress();
    initSocket();
  } catch (error) {
    console.error("Error initializing the app:", error);
  }
}

// Start the application
initApp();

// ---------------------------
// Optional: UI Controls for WebRTC
// ---------------------------

// Example: Clear Canvas Button
const clearCanvasButton = document.querySelector(".clear-canvas");
if (clearCanvasButton) {
  clearCanvasButton.addEventListener("click", () => {
    // Implement canvas clearing logic here

    // Optionally, notify the peer to clear their canvas
    if (peer && peer.connected) {
      peer.send(
        JSON.stringify({
          type: "clearCanvas",
        }),
      );
    }
  });
}

// Handle incoming control commands from peer
// These could be integrated within the `peer.on("data", ...)` handler above
// For example:
// socket.on("toolChange", (tool) => {
//   selectedTool = tool;
//   console.log("Tool changed to:", selectedTool);
//   // Update UI accordingly
// });

// socket.on("instructionStep", (step) => {
//   currentInstructionStep = step;
//   renderInstructionStep();
// });

// socket.on("experienceStarted", () => {
//   console.log("Experience started by peer.");
//   // Implement any additional logic if needed
// });

// socket.on("backToStart", () => {
//   backToStart();
// });

// socket.on("finalPage", () => {
//   document.querySelector(".final__page").classList.remove("none");
// });

// socket.on("returnToApplication", () => {
//   document.querySelector(".application").classList.remove("none");
//   document.querySelector(".save__page").classList.add("none");
//   document.querySelector(".navbar--button__empty-right").classList.add("none");
//   document.querySelector(".navbar--button__back-options").classList.add("none");
//   document.querySelector(".navbar--button__undo").classList.remove("none");
//   document.querySelector(".navbar--button__next").classList.remove("none");
//   document.querySelector(".navbar--button__back-drawing").classList.add("none");
// });

// socket.on("returnToStart", () => {
//   document.querySelector(".final__page").classList.add("none");
//   document.querySelector(".start").classList.remove("none");
//   document.querySelector(".navbar").classList.add("none");
//   document.querySelector(".nav__title").classList.add("none");
// });
