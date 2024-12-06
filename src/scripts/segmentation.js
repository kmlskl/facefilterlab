import {
  ImageSegmenter,
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");
const demosSection = document.getElementById("demos");
let enableWebcamButton;
let webcamRunning = false;
let imageSegmenter;
let faceLandmarker;
let runningMode = "VIDEO";
let labels;

let isDrawing = false;
let drawnPoints = [];
let faceDrawings = [];
let currentFaceLandmarks;

const legendColors = [
  [255, 197, 0, 255], // Vivid Yellow
  [128, 62, 117, 255], // Strong Purple
  [255, 104, 0, 255], // Vivid Orange
  [166, 189, 215, 255], // Very Light Blue
  [193, 0, 32, 255], // Vivid Red
  [206, 162, 98, 255], // Grayish Yellow
  [129, 112, 102, 255], // Medium Gray
  [0, 125, 52, 255], // Vivid Green
  [246, 118, 142, 255], // Strong Purplish Pink
  [0, 83, 138, 255], // Strong Blue
  [255, 112, 92, 255], // Strong Yellowish Pink
  [83, 55, 112, 255], // Strong Violet
  [255, 142, 0, 255], // Vivid Orange Yellow
  [179, 40, 81, 255], // Strong Purplish Red
  [244, 200, 0, 255], // Vivid Greenish Yellow
  [127, 24, 13, 255], // Strong Reddish Brown
  [147, 170, 0, 255], // Vivid Yellowish Green
  [89, 51, 21, 255], // Deep Yellowish Brown
  [241, 58, 19, 255], // Vivid Reddish Orange
  [35, 44, 22, 255], // Dark Olive Green
  [0, 161, 194, 255], // Vivid Blue
];

// Initialize Image Segmenter
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

/// face landmarker drawing
canvasElement.addEventListener("mousedown", (e) => {
  isDrawing = true;
  drawnPoints = [];
});

canvasElement.addEventListener("mousemove", (e) => {
  if (!isDrawing) return;
  const rect = canvasElement.getBoundingClientRect();
  drawnPoints.push({
    x: (e.clientX - rect.left) / rect.width, // Normalize x
    y: (e.clientY - rect.top) / rect.height, // Normalize y
  });
});

canvasElement.addEventListener("mouseup", () => {
  isDrawing = false;
  if (drawnPoints.length && currentFaceLandmarks) {
    // Convert drawnPoints to pinned points
    const pinnedDrawing = mapToFace(drawnPoints, currentFaceLandmarks);
    faceDrawings.push(pinnedDrawing);
  }
  drawnPoints = [];
});

//// face landmarker drawing end

// Helper to Draw Freehand on Canvas
function drawOnCanvas(points, ctx, color = "red") {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < points.length - 1; i++) {
    ctx.moveTo(
      points[i].x * canvasElement.width,
      points[i].y * canvasElement.height
    );
    ctx.lineTo(
      points[i + 1].x * canvasElement.width,
      points[i + 1].y * canvasElement.height
    );
  }
  ctx.stroke();
}
// Map Drawing Points to Face
function mapToFace(drawnPoints, landmarks) {
  const pinnedDrawings = [];
  drawnPoints.forEach((point) => {
    let minDist = Infinity;
    let nearestLandmarkIndex = null;

    landmarks.forEach((landmark, index) => {
      const dx = point.x - landmark.x;
      const dy = point.y - landmark.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearestLandmarkIndex = index;
      }
    });

    if (nearestLandmarkIndex !== null) {
      const lm = landmarks[nearestLandmarkIndex];
      pinnedDrawings.push({
        landmarkIndex: nearestLandmarkIndex,
        offsetX: point.x - lm.x,
        offsetY: point.y - lm.y,
      });
    }
  });

  return pinnedDrawings;
}

// Render Pinned Drawings
function renderPinnedDrawings(allPinnedDrawings, landmarks, ctx) {
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 2;

  allPinnedDrawings.forEach((pinnedDrawing) => {
    ctx.beginPath();

    pinnedDrawing.forEach((p, i) => {
      const lm = landmarks[p.landmarkIndex];
      const x = (lm.x + p.offsetX) * canvasElement.width;
      const y = (lm.y + p.offsetY) * canvasElement.height;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  });
}

// Helper: Check Webcam Access
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Webcam Prediction
let lastWebcamTime = -1;
async function predictWebcam() {
  if (video.currentTime === lastWebcamTime) {
    if (webcamRunning) window.requestAnimationFrame(predictWebcam);
    return;
  }
  lastWebcamTime = video.currentTime;

  // Draw mirrored video frame
  canvasCtx.save();
  canvasCtx.translate(canvasElement.width, 0);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.restore();

  const startTimeMs = performance.now();

  // Run segmentation
  if (imageSegmenter) {
    // After segmentation finishes, callbackForVideo will run.
    imageSegmenter.segmentForVideo(video, startTimeMs, callbackForVideo);
  }

  // Detect the face and landmarks, store them for later use
  if (faceLandmarker) {
    const results = await faceLandmarker.detectForVideo(video, startTimeMs);
    if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
      currentFaceLandmarks = results.faceLandmarks[0];
    }
  }

  // We do NOT render pinned drawings here directly anymore
  // Instead, we'll rely on callbackForVideo to do that after the mask is applied.

  if (webcamRunning) window.requestAnimationFrame(predictWebcam);
}

// Draw Segmentation Results
function callbackForVideo(result) {
  const mask = result.categoryMask.getAsUint8Array();

  // Draw the video feed again (normal orientation)
  canvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

  // Apply the mask
  const imageData = canvasCtx.getImageData(
    0,
    0,
    video.videoWidth,
    video.videoHeight
  );
  const { data } = imageData;

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 1 && mask[i] !== 3 && mask[i] !== 5) {
      data[i * 4] = 0;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 0;
    }
  }

  canvasCtx.putImageData(imageData, 0, 0);

  // Apply blur and mask composition
  canvasCtx.save();
  canvasCtx.filter = "blur(5px)";
  canvasCtx.globalCompositeOperation = "destination-in";
  canvasCtx.drawImage(canvasElement, 0, 0);
  canvasCtx.restore();

  // Now that the mask is done, and we know the landmarks are set,
  // we can safely render the pinned drawings on top.
  if (currentFaceLandmarks) {
    renderPinnedDrawings(faceDrawings, currentFaceLandmarks, canvasCtx);
  }

  if (isDrawing && drawnPoints.length > 0) {
    drawOnCanvas(drawnPoints, canvasCtx, "blue");
  }
}

async function enableCam() {
  if (!imageSegmenter) return;

  if (webcamRunning) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ENABLE SEGMENTATION";
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "DISABLE SEGMENTATION";
  }

  const constraints = { video: true };
  video.srcObject = await navigator.mediaDevices.getUserMedia(constraints);

  // Adjust canvas size when video is ready
  video.addEventListener("loadedmetadata", () => {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
  });

  video.addEventListener("loadeddata", predictWebcam);
}

if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

createImageSegmenter();
createFaceLandmarker();
