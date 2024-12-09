import {
  ImageSegmenter,
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// webcam & canvas handling
const video = document.querySelector("#webcam");
const canvasElement = document.querySelector(".canvas1");
const canvasCtx = canvasElement.getContext("2d");
const demosSection = document.querySelector("#demos");
let enableWebcamButton;
let webcamRunning = false;

// additional canvases
const canvas2 = document.querySelector(".canvas2");
const canvas3 = document.querySelector(".canvas3");
const canvas4 = document.querySelector(".canvas4");

const canvas2Ctx = canvas2.getContext("2d");
const canvas3Ctx = canvas3.getContext("2d");
const canvas4Ctx = canvas4.getContext("2d");

// mediapipe
let imageSegmenter;
let faceLandmarker;
let runningMode = "VIDEO";
let labels;

// drawing
let isDrawing = false;
let drawnPoints = [];
let faceDrawings = [];
let currentFaceLandmarks;

// global variables for webcam
let videoWidth = 0;
let videoHeight = 0;
let squareSize = 0;
let xOffset = 0;
let yOffset = 0;

// setup mediapipe
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

// drawing events
canvasElement.addEventListener("mousedown", (e) => {
  isDrawing = true;
  drawnPoints = [];
});

canvasElement.addEventListener("mousemove", (e) => {
  if (!isDrawing) return;
  const rect = canvasElement.getBoundingClientRect();
  drawnPoints.push({
    x: (e.clientX - rect.left) / rect.width, // normalize x
    y: (e.clientY - rect.top) / rect.height, // normalize y
  });
});

canvasElement.addEventListener("mouseup", () => {
  isDrawing = false;
  if (drawnPoints.length && currentFaceLandmarks) {
    const pinnedDrawing = mapToFace(drawnPoints, currentFaceLandmarks);
    faceDrawings.push(pinnedDrawing);
  }
  drawnPoints = [];
});

// draw freehand on canvas (normalized)
function drawOnCanvas(points, ctx, color = "red") {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < points.length - 1; i++) {
    ctx.moveTo(
      points[i].x * canvasElement.width,
      points[i].y * canvasElement.height,
    );
    ctx.lineTo(
      points[i + 1].x * canvasElement.width,
      points[i + 1].y * canvasElement.height,
    );
  }
  ctx.stroke();
}

// map drawings to face landmarks (coordinates 0-1)
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
      // store offset relative to landmark
      pinnedDrawings.push({
        landmarkIndex: nearestLandmarkIndex,
        offsetX: point.x - lm.x,
        offsetY: point.y - lm.y,
      });
    }
  });

  return pinnedDrawings;
}

// render pinned drawings on face
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

// check webcam access
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// webcam Prediction
let lastWebcamTime = -1;
async function predictWebcam() {
  if (video.currentTime === lastWebcamTime) {
    if (webcamRunning) window.requestAnimationFrame(predictWebcam);
    return;
  }
  lastWebcamTime = video.currentTime;

  videoWidth = video.videoWidth;
  videoHeight = video.videoHeight;
  squareSize = Math.min(videoWidth, videoHeight);
  xOffset = (videoWidth - squareSize) / 2;
  yOffset = (videoHeight - squareSize) / 2;

  canvasElement.width = squareSize;
  canvasElement.height = squareSize;

  canvas2.width = squareSize;
  canvas2.height = squareSize;
  canvas3.width = squareSize;
  canvas3.height = squareSize;
  canvas4.width = squareSize;
  canvas4.height = squareSize;

  // draw the cropped and mirrored video frame
  canvasCtx.save();
  // flip horizontally
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

  // running the segmentation
  if (imageSegmenter) {
    imageSegmenter.segmentForVideo(video, startTimeMs, callbackForVideo);
  }

  // detect face and landmarks
  if (faceLandmarker) {
    const results = await faceLandmarker.detectForVideo(video, startTimeMs);
    if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
      // convert landmarks to cropped canvas coordinates
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
}

// draw the segmentation results
function callbackForVideo(result) {
  const mask = result.categoryMask.getAsUint8Array();

  // get the current canvas pixels
  const imageData = canvasCtx.getImageData(0, 0, squareSize, squareSize);
  const { data } = imageData;

  // apply mask only to the cropped region as square crop
  // mask is sized for full video: mask[y*videoWidth + x]
  for (let yy = 0; yy < squareSize; yy++) {
    for (let xx = 0; xx < squareSize; xx++) {
      const maskX = xOffset + (squareSize - 1 - xx); // mirror it back
      const maskY = yOffset + yy;
      const maskIndex = maskY * videoWidth + maskX;
      const val = mask[maskIndex];
      const pixelIndex = (yy * squareSize + xx) * 4;

      if (val !== 1 && val !== 3 && val !== 5) {
        // background: make transparent
        data[pixelIndex] = 0;
        data[pixelIndex + 1] = 0;
        data[pixelIndex + 2] = 0;
        data[pixelIndex + 3] = 0;
      }
    }
  }

  canvasCtx.putImageData(imageData, 0, 0);

  // blur mask edges so it's neat
  canvasCtx.save();
  canvasCtx.filter = "blur(5px)";
  canvasCtx.globalCompositeOperation = "destination-in";
  canvasCtx.drawImage(canvasElement, 0, 0);
  canvasCtx.restore();

  // render pinned drawings after the mask
  if (currentFaceLandmarks) {
    renderPinnedDrawings(faceDrawings, currentFaceLandmarks, canvasCtx);
  }

  // if currently drawing, show the line
  if (isDrawing && drawnPoints.length > 0) {
    drawOnCanvas(drawnPoints, canvasCtx, "blue");
  }

  canvas2Ctx.clearRect(0, 0, canvas2.width, canvas2.height);
  canvas2Ctx.drawImage(canvasElement, 0, 0);

  canvas3Ctx.clearRect(0, 0, canvas3.width, canvas3.height);
  canvas3Ctx.drawImage(canvasElement, 0, 0);

  canvas4Ctx.clearRect(0, 0, canvas4.width, canvas4.height);
  canvas4Ctx.drawImage(canvasElement, 0, 0);
}

async function enableCam() {
  if (!imageSegmenter) return;

  if (webcamRunning) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ENABLE SEGMENTATION";
    video.srcObject.getTracks().forEach((track) => track.stop());
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "DISABLE SEGMENTATION";
    const constraints = { video: true };
    video.srcObject = await navigator.mediaDevices.getUserMedia(constraints);
    video.addEventListener("loadedmetadata", () => {
      // sizing handled dynamically in predictWebcam function!!!
    });
    video.addEventListener("loadeddata", predictWebcam);
  }
}

if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn(
    "webcam access is not supported by your browser, please contact team cactus",
  );
}

createImageSegmenter();
createFaceLandmarker();
