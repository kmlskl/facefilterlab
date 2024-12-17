import {
  ImageSegmenter,
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// ---------------------------
// Segmentation and Drawing Setup
// ---------------------------

// Webcam & canvas handling
const video = document.querySelector("#webcam");
const canvasElement = document.querySelector(".canvas1");
const canvasCtx = canvasElement.getContext("2d");
const demosSection = document.querySelector("#demos");

// Additional canvases
const canvas2 = document.querySelector(".canvas2");
const canvas3 = document.querySelector(".canvas3");
const canvas4 = document.querySelector(".canvas4");
// const canvasStream = document.querySelector(".canvas_stream");

const canvas2Ctx = canvas2.getContext("2d");
const canvas3Ctx = canvas3.getContext("2d");
const canvas4Ctx = canvas4.getContext("2d");
// const canvasStreamCtx = canvasStream.getContext("2d");

// Mediapipe
let imageSegmenter;
let faceLandmarker;
let runningMode = "VIDEO";
let labels;

// Drawing
let isDrawing = false;
let drawnPoints = [];
let faceDrawings = [];
let currentFaceLandmarks;

const tools = {
  brushYellow: { color: "#fece00", strokeWidth: 7 },
  brushOrange: { color: "#ff7664", strokeWidth: 7 },
  brushPink: { color: "#ff8ce9", strokeWidth: 7 },
  brushPurple: { color: "#9067f3", strokeWidth: 7 },
  brushRed: { color: "#e74c3c", strokeWidth: 7 },
  brushGreen: { color: "#ace90a", strokeWidth: 7 },
  pencilBig: { color: "#000000", strokeWidth: 5 },
  pencilSmall: { color: "#000000", strokeWidth: 2 },
  eraser: { color: "#ffffff00", strokeWidth: 10 },
};
let currentTool = tools.pencilBig;
let currentDrawingColor = currentTool.color;
let currentStrokeWidth = currentTool.strokeWidth;

// Global variables for webcam
let videoWidth = 0;
let videoHeight = 0;
let squareSize = 0;
let xOffset = 0;
let yOffset = 0;

// ---------------------------
// WebRTC Setup
// ---------------------------

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

// ---------------------------
// Initialization Functions
// ---------------------------

// Setup Mediapipe
const createImageSegmenter = async () => {
  const visionFileset = await FilesetResolver.forVisionTasks("/wasm");
  imageSegmenter = await ImageSegmenter.createFromOptions(visionFileset, {
    baseOptions: {
      modelAssetPath: "/models/selfie_multiclass_256x256.tflite",
      delegate: "GPU",
    },
    runningMode,
    outputCategoryMask: true,
  });
  labels = imageSegmenter.getLabels();
  demosSection.classList.remove("invisible");
};

const createFaceLandmarker = async () => {
  const visionFileset = await FilesetResolver.forVisionTasks("/wasm");
  faceLandmarker = await FaceLandmarker.createFromOptions(visionFileset, {
    baseOptions: {
      modelAssetPath: "/models/face_landmarker.task",
      delegate: "GPU",
    },
    outputFaceBlendshapes: true,
    runningMode,
    numFaces: 1,
  });
  demosSection.classList.remove("invisible");
};

// Helper functions for segmentation and drawing
const computeIrisCenter = (landmarks, startIndex) => {
  let cx = 0,
    cy = 0;
  for (let i = 0; i < 4; i++) {
    // Assuming 4 landmarks per iris
    cx += landmarks[startIndex + i].x;
    cy += landmarks[startIndex + i].y;
  }
  return { x: cx / 4, y: cy / 4 };
};

const computeAngleAndScale = (leftIrisCenter, rightIrisCenter) => {
  const deltaX = rightIrisCenter.x - leftIrisCenter.x;
  const deltaY = rightIrisCenter.y - leftIrisCenter.y;
  const angle = Math.atan2(deltaY, deltaX); // Rotation angle in radians
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY); // Scale factor
  return { angle, distance };
};

// Drawing events
canvasElement.addEventListener("mousedown", (e) => {
  isDrawing = true;
  drawnPoints = [];
});

canvasElement.addEventListener("mousemove", (e) => {
  if (!isDrawing || !currentFaceLandmarks) return;

  const rect = canvasElement.getBoundingClientRect();
  const normalizedX = (e.clientX - rect.left) / rect.width;
  const normalizedY = (e.clientY - rect.top) / rect.height;

  drawnPoints.push({ x: normalizedX, y: normalizedY });
});

canvasElement.addEventListener("mouseup", () => {
  isDrawing = false;
  if (drawnPoints.length && currentFaceLandmarks) {
    // Capture the reference frame at the moment of drawing
    const leftIrisCenter = computeIrisCenter(currentFaceLandmarks, 468); // Left iris landmarks
    const rightIrisCenter = computeIrisCenter(currentFaceLandmarks, 473); // Right iris landmarks
    const midpoint = {
      x: (leftIrisCenter.x + rightIrisCenter.x) / 2,
      y: (leftIrisCenter.y + rightIrisCenter.y) / 2,
    };
    const { angle, distance } = computeAngleAndScale(
      leftIrisCenter,
      rightIrisCenter,
    );

    // Store the drawing in canonical coordinates relative to the reference frame
    const canonicalPoints = drawnPoints.map((p) => {
      // Translate so that midpoint is the origin
      let tx = p.x - midpoint.x;
      let ty = p.y - midpoint.y;

      // Rotate to align with the reference frame's x-axis
      const cosA = Math.cos(-angle);
      const sinA = Math.sin(-angle);
      const rx = tx * cosA - ty * sinA;
      const ry = tx * sinA + ty * cosA;

      // Scale based on the reference distance
      const sx = rx / distance;
      const sy = ry / distance;

      return { x: sx, y: sy };
    });

    // Store the drawing with its reference frame
    faceDrawings.push({
      canonicalPoints, // Points in canonical space
      refMidpoint: midpoint, // Reference midpoint
      refAngle: angle, // Reference angle
      refDistance: distance, // Reference scale
      color: currentDrawingColor,
    });

    // Send drawing data via WebRTC
    if (peer && peer.connected) {
      peer.send(
        JSON.stringify({
          type: "drawingData",
          data: faceDrawings[faceDrawings.length - 1],
        }),
      );
    }
  }
  drawnPoints = [];
});

// Draw freehand on canvas (normalized)
const drawOnCanvas = (points, ctx, color) => {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
};

// Render pinned drawings on face
const renderPinnedDrawings = (allPinnedDrawings, landmarks, ctx) => {
  if (allPinnedDrawings.length === 0) return;

  // Compute current reference frame
  const leftIrisCenter = computeIrisCenter(landmarks, 468); // Left iris landmarks
  const rightIrisCenter = computeIrisCenter(landmarks, 473); // Right iris landmarks
  const midpoint = {
    x: (leftIrisCenter.x + rightIrisCenter.x) / 2,
    y: (leftIrisCenter.y + rightIrisCenter.y) / 2,
  };
  const { angle: currentAngle, distance: currentDistance } =
    computeAngleAndScale(leftIrisCenter, rightIrisCenter);

  ctx.strokeStyle = "blue";
  ctx.lineWidth = 5;

  allPinnedDrawings.forEach((drawing) => {
    // Calculate scale and rotation differences
    const scaleRatio = currentDistance / drawing.refDistance;

    const cosA = Math.cos(currentAngle);
    const sinA = Math.sin(currentAngle);

    // Transform canonical points back to world coordinates
    const transformedPoints = drawing.canonicalPoints.map((cp) => {
      // Scale
      let sx = cp.x * drawing.refDistance * scaleRatio;
      let sy = cp.y * drawing.refDistance * scaleRatio;

      // Rotate
      const rx = sx * cosA - sy * sinA;
      const ry = sx * sinA + sy * cosA;

      // Translate
      const worldX = rx + midpoint.x;
      const worldY = ry + midpoint.y;

      return {
        x: worldX * canvasElement.width,
        y: worldY * canvasElement.height,
      };
    });

    // Draw the transformed drawing
    if (transformedPoints.length < 2) return;

    drawOnCanvas(transformedPoints, ctx, drawing.color);
  });
};

// ---------------------------
// WebRTC Helper Functions
// ---------------------------

// Get local IP address (optional, depends on your server setup)
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

// Initialize Socket.io connection
const initSocket = (localIP) => {
  const serverUrl = `https://${localIP}:2000`;

  console.log("Connecting to server:", serverUrl);
  socket = io.connect(serverUrl);

  let clientId = localStorage.getItem("clientId");
  if (!clientId) {
    clientId = crypto.randomUUID(); // Generate a unique ID
    localStorage.setItem("clientId", clientId);
  }

  socket.on("connect", () => {
    console.log(`Connected to server. My ID: ${socket.id}`);
    // Always declare this client as initiator
    socket.emit("declare-role", clientId, "initiator");
    socket.emit("request-role-update");
  });

  socket.on("joinerId", (joinerId) => {
    console.log("Received initiator ID:", joinerId);
    if (joinerId && !peer) {
      createPeer(joinerId);
    }
  });

  socket.on("client-disconnect", (client) => {
    if (peer && peer.data.id === client.id) {
      peer.destroy();
      peer = null;
      console.log(`Peer ${client.id} disconnected.`);
    }
  });

  socket.on("role-update", ({ initiatorId, joinerId }) => {
    console.log(
      `Role Update: Initiator - ${initiatorId}, Joiner - ${joinerId}`,
    );

    // If this client is the initiator and a joiner has connected, create a peer
    if (socket.id === initiatorId && joinerId && !peer) {
      createPeer(joinerId);
    }

    // If the initiator has changed and this client is no longer the initiator
    if (socket.id !== initiatorId && peer) {
      peer.destroy();
      peer = null;
      console.log("This client is no longer the initiator.");
    }
  });

  socket.on("signal", (peerId, signal, fromId) => {
    console.log(`Received signal from ${fromId} to ${peerId}`);
    if (peer && fromId === peer.data.id) {
      peer.signal(signal);
    }
  });

  socket.on("error", (error) => {
    console.error("Socket.io error:", error);
  });

  // Listen for clients list to handle initial connections
  socket.on("clients", ({ clients, initiatorId, joinerId }) => {
    console.log("Clients List Updated:", clients);
    // If this client is the initiator and a joiner exists, create a peer
    if (socket.id === initiatorId && joinerId && !peer) {
      createPeer(joinerId);
    }
  });

  // Listen for own ID confirmation
  socket.on("myId", (clientId) => {
    console.log(`My ID is ${clientId}`);
  });
};

// Create a WebRTC peer
const createPeer = (peerId) => {
  peer = new SimplePeer({
    initiator: true,
    stream: myStream,
    config: servers,
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
    console.log("Data received: ", data);
    try {
      handlePeerData(data);
    } catch (e) {
      console.error("Error parsing received data:", e);
    }
  });

  peer.on("stream", (stream) => {
    // Handle remote stream if needed
    // remoteStream = stream;
    // Example: Attach to a video element
    // const remoteVideo = document.querySelector(".remote_video");
    // if (remoteVideo) {
    //   remoteVideo.srcObject = remoteStream;
    //   remoteVideo.play();
    // }
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

// Initialize Canvas Stream for WebRTC
async function initCanvasStream(canvasId) {
  try {
    const canvas = document.querySelector(`.${canvasId}`);
    if (!canvas) {
      throw new Error(`Canvas with class ${canvasId} not found.`);
    }

    myStream = await canvas.captureStream(30);

    console.log("Canvas stream initialized.");

    // Optionally, display the local stream
    const localVideo = document.querySelector(".local_video");
    if (localVideo) {
      localVideo.srcObject = myStream;
      localVideo.play();
    }
  } catch (error) {
    console.error("Error initializing canvas stream:", error);
    alert("Canvas access is required for this app.");
  }
}

// ---------------------------
// Segmentation Prediction Loop
// ---------------------------

let lastWebcamTime = -1;

// Check webcam access
const hasGetUserMedia = () => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

const initializeCanvases = () => {
  videoWidth = video.videoWidth;
  videoHeight = video.videoHeight;
  squareSize = Math.min(videoWidth, videoHeight);
  xOffset = (videoWidth - squareSize) / 2;
  yOffset = (videoHeight - squareSize) / 2;

  // Set canvas sizes once
  canvasElement.width = squareSize;
  canvasElement.height = squareSize;

  canvas2.width = squareSize;
  canvas2.height = squareSize;
  canvas3.width = squareSize;
  canvas3.height = squareSize;
  canvas4.width = squareSize;
  canvas4.height = squareSize;

  //   console.log("Canvas sizes initialized to:", squareSize, squareSize);
};

// Webcam prediction
const predictWebcam = async () => {
  if (video.currentTime === lastWebcamTime && video.currentTime - 0 < 100) {
    if (webcamRunning) window.requestAnimationFrame(predictWebcam);
    return;
  }
  lastWebcamTime = video.currentTime;

  //   videoWidth = video.videoWidth;
  //   videoHeight = video.videoHeight;
  //   squareSize = Math.min(videoWidth, videoHeight);
  //   xOffset = (videoWidth - squareSize) / 2;
  //   yOffset = (videoHeight - squareSize) / 2;

  //   canvasElement.width = squareSize;
  //   canvasElement.height = squareSize;

  //   canvas2.width = squareSize;
  //   canvas2.height = squareSize;
  //   canvas3.width = squareSize;
  //   canvas3.height = squareSize;
  //   canvas4.width = squareSize;
  //   canvas4.height = squareSize;

  //   canvasStream.width = squareSize;
  //   canvasStream.height = squareSize;

  // Draw the cropped and mirrored video frame
  canvasCtx.save();
  // Flip horizontally
  canvasCtx.translate(squareSize, 0);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(
    video,
    xOffset,
    yOffset,
    squareSize,
    squareSize,
    0,
    0,
    squareSize,
    squareSize,
  );
  canvasCtx.restore();

  const startTimeMs = performance.now();

  // Running the segmentation
  if (imageSegmenter) {
    imageSegmenter.segmentForVideo(video, startTimeMs, callbackForVideo);
  }

  // Detecting face and landmarks
  if (faceLandmarker) {
    const results = await faceLandmarker.detectForVideo(video, startTimeMs);
    if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
      // Convert landmarks to cropped canvas coordinates
      currentFaceLandmarks = results.faceLandmarks[0].map((lm) => {
        // lm.x, lm.y are normalized to full video (0...1)
        const pixelX = lm.x * videoWidth;
        const pixelY = lm.y * videoHeight;

        // Convert to [0,1] range relative to our cropped square
        let normX = (pixelX - xOffset) / squareSize;
        let normY = (pixelY - yOffset) / squareSize;

        // Mirror horizontally by flipping the X coordinate
        normX = 1 - normX;

        return {
          x: normX,
          y: normY,
        };
      });
    } else {
      currentFaceLandmarks = null;
    }
  }

  if (webcamRunning) window.requestAnimationFrame(predictWebcam);
};

// Callback for image segmentation
const callbackForVideo = (result) => {
  const mask = result.categoryMask.getAsUint8Array();

  // Get the current canvas pixels
  const imageData = canvasCtx.getImageData(0, 0, squareSize, squareSize);
  const { data } = imageData;

  // Apply mask only to the cropped region as square crop
  // Mask is sized for full video: mask[y*videoWidth + x]
  for (let yy = 0; yy < squareSize; yy++) {
    for (let xx = 0; xx < squareSize; xx++) {
      const maskX = xOffset + (squareSize - 1 - xx); // Mirror it back
      const maskY = yOffset + yy;
      const maskIndex = maskY * videoWidth + maskX;
      const val = mask[maskIndex];
      const pixelIndex = (yy * squareSize + xx) * 4;

      if (val !== 1 && val !== 3 && val !== 5) {
        // Background: make transparent
        data[pixelIndex] = 0;
        data[pixelIndex + 1] = 0;
        data[pixelIndex + 2] = 0;
        data[pixelIndex + 3] = 0;
      }
    }
  }

  canvasCtx.putImageData(imageData, 0, 0);

  // Blur mask edges so it's neat
  canvasCtx.save();
  canvasCtx.filter = "blur(5px)";
  canvasCtx.globalCompositeOperation = "destination-in";
  canvasCtx.drawImage(canvasElement, 0, 0);
  canvasCtx.restore();

  // Render pinned drawings after the mask
  if (currentFaceLandmarks) {
    renderPinnedDrawings(faceDrawings, currentFaceLandmarks, canvasCtx);
  }

  // If currently drawing, we need to render and show the line
  if (isDrawing && drawnPoints.length > 0 && currentFaceLandmarks) {
    // Compute current reference frame for in-progress drawing
    const leftIrisCenter = computeIrisCenter(currentFaceLandmarks, 468); // Left iris landmarks
    const rightIrisCenter = computeIrisCenter(currentFaceLandmarks, 473); // Right iris landmarks
    const midpoint = {
      x: (leftIrisCenter.x + rightIrisCenter.x) / 2,
      y: (leftIrisCenter.y + rightIrisCenter.y) / 2,
    };
    const { angle: currentAngle, distance: currentDistance } =
      computeAngleAndScale(leftIrisCenter, rightIrisCenter);

    // Transform the in-progress drawnPoints into canonical space
    const canonicalInProgress = drawnPoints.map((p) => {
      // Translate so that midpoint is the origin
      let tx = p.x - midpoint.x;
      let ty = p.y - midpoint.y;

      // Rotate to align with the reference frame's x-axis
      const cosA = Math.cos(-currentAngle);
      const sinA = Math.sin(-currentAngle);
      const rx = tx * cosA - ty * sinA;
      const ry = tx * sinA + ty * cosA;

      // Scale based on the reference distance
      const sx = rx / currentDistance;
      const sy = ry / currentDistance;

      return { x: sx, y: sy };
    });

    // Transform canonical points back to world coordinates
    const transformedInProgress = canonicalInProgress.map((cp) => {
      // Scale to reference distance
      let sx = cp.x * currentDistance;
      let sy = cp.y * currentDistance;

      // Rotate according to the face angle
      const rx = sx * Math.cos(currentAngle) - sy * Math.sin(currentAngle);
      const ry = sx * Math.sin(currentAngle) + sy * Math.cos(currentAngle);

      // Translate to the face midpoint
      const worldX = rx + midpoint.x;
      const worldY = ry + midpoint.y;

      return {
        x: worldX * canvasElement.width,
        y: worldY * canvasElement.height,
      };
    });

    // Draw the in-progress line
    drawOnCanvas(transformedInProgress, canvasCtx, currentDrawingColor);
  }

  // Update additional canvases if needed
  canvas2Ctx.clearRect(0, 0, canvas2.width, canvas2.height);
  canvas2Ctx.drawImage(canvasElement, 0, 0);

  canvas3Ctx.clearRect(0, 0, canvas3.width, canvas3.height);
  canvas3Ctx.drawImage(canvasElement, 0, 0);

  canvas4Ctx.clearRect(0, 0, canvas4.width, canvas4.height);
  canvas4Ctx.drawImage(canvasElement, 0, 0);

  // Update the stream canvas for WebRTC
  //   canvasStreamCtx.clearRect(0, 0, canvasStream.width, canvasStream.height);
  //   canvasStreamCtx.drawImage(canvasElement, 0, 0);
};

// Enable webcam and start prediction loop
let webcamRunning = false;
const enableCam = async () => {
  try {
    if (!imageSegmenter || !faceLandmarker) {
      throw new Error(
        "Tasks not initialized. Ensure ImageSegmenter and FaceLandmarker are ready.",
      );
    }

    // Start webcam
    console.log("Requesting webcam access...");
    const constraints = { video: { width: 640, height: 480 } };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    video.srcObject = stream;
    webcamRunning = true;

    video.addEventListener("loadedmetadata", () => {
      console.log("Webcam feed ready.");
      initializeCanvases();
      predictWebcam(); // Start the prediction loop
    });

    video.addEventListener("loadeddata", () => {
      console.log("Webcam feed started.");
    });
  } catch (error) {
    console.error("Error enabling webcam:", error);
  }
};

// ---------------------------
// Combined Initialization
// ---------------------------

const initApp = async () => {
  try {
    if (!hasGetUserMedia()) {
      throw new Error("Webcam access not supported by your browser.");
    }

    console.log(
      "Initializing image segmentation and face landmark detection...",
    );

    // Initialize Mediapipe tasks
    await createImageSegmenter();
    await createFaceLandmarker();

    console.log(
      "Image Segmenter and Face Landmarker initialized successfully.",
    );

    // Initialize WebRTC components
    const localIP = await getLocalIPAddress();
    initSocket(localIP);

    await initCanvasStream("canvas1");

    // Enable webcam after all initializations
    await enableCam();
  } catch (error) {
    console.error("Error during initialization:", error);
  }
};

// Start the application
initApp();

// ---------------------------
// Optional: UI Controls
// ---------------------------

// Example: Color picker or buttons to change drawing color
const colorButtons = document.querySelectorAll(".color-button");
colorButtons.forEach((button, index) => {
  button.style.backgroundColor = colors[index];
  button.addEventListener("click", () => {
    currentDrawingColor = colors[index];
    // Optionally, send color change via WebRTC
    if (peer && peer.connected) {
      peer.send(
        JSON.stringify({
          type: "colorChange",
          color: currentDrawingColor,
        }),
      );
    }
  });
});

// Optional: Clear Canvas Button
const clearCanvasButton = document.querySelector(".clear-canvas");
if (clearCanvasButton) {
  clearCanvasButton.addEventListener("click", () => {
    faceDrawings = [];
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
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

const handlePeerData = (data) => {
  try {
    const parsedData = JSON.parse(data);
    switch (parsedData.type) {
      case "drawingData":
        faceDrawings.push(parsedData.data);
        break;
      case "toolChange":
        const selectedTool = tools[parsedData.tool];
        if (selectedTool) {
          currentTool = selectedTool;
          currentDrawingColor = selectedTool.color;
          currentStrokeWidth = selectedTool.strokeWidth;
          console.log("Tool changed to:", currentTool);
        } else {
          console.warn("Received unknown tool:", parsedData.tool);
        }
        break;
      case "touchstart":
        handleTouchStart(parsedData.x, parsedData.y);
        break;
      case "touchmove":
        handleTouchMove(parsedData.x, parsedData.y);
        break;
      case "touchend":
        handleTouchEnd();
        break;
      default:
        console.warn("Unknown data type received:", parsedData.type);
    }
  } catch (e) {
    console.error("Error parsing received data:", e);
  }
};

// Handle incoming drawing data from peers
// socket.on("drawingData", (drawing) => {
//   faceDrawings.push(drawing);
// });

// socket.on("colorChange", (color) => {
//   currentDrawingColor = color;
// });

// socket.on("clearCanvas", () => {
//   faceDrawings = [];
//   canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
// });
