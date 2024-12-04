import { ImageSegmenter, FilesetResolver } from "@mediapipe/tasks-vision";
// const visionFileset = await FilesetResolver.forVisionTasks("/wasm/");

// DOM Elements
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");
const demosSection = document.getElementById("demos");
let enableWebcamButton;
let webcamRunning = false;
let imageSegmenter;
let runningMode = "IMAGE";
let labels;

// Colors for segmented regions
const legendColors = [
  [255, 197, 0, 255],
  [128, 62, 117, 255] /* Add remaining colors... */,
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
  canvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

  if (!imageSegmenter) return;

  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await imageSegmenter.setOptions({ runningMode });
  }

  const startTimeMs = performance.now();
  imageSegmenter.segmentForVideo(video, startTimeMs, callbackForVideo);
}

// Draw Segmentation Results
function callbackForVideo(result) {
  const mask = result.categoryMask.getAsUint8Array();
  const imageData = canvasCtx.getImageData(
    0,
    0,
    video.videoWidth,
    video.videoHeight
  );
  const { data } = imageData;

  for (let i = 0; i < mask.length; i++) {
    const color = legendColors[mask[i] % legendColors.length];
    data[i * 4] = color[0];
    data[i * 4 + 1] = color[1];
    data[i * 4 + 2] = color[2];
    data[i * 4 + 3] = color[3];
  }

  canvasCtx.putImageData(imageData, 0, 0);

  if (webcamRunning) window.requestAnimationFrame(predictWebcam);
}

// Enable Webcam
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
  video.addEventListener("loadeddata", predictWebcam);
}

// Set Up Event Listeners
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

createImageSegmenter();
