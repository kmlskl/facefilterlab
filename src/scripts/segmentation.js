import {
  ImageSegmenter,
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
let runningMode = "IMAGE";
let labels;

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

// const createFaceLandmarker = async () => {
//   const visionFileset = await FilesetResolver.forVisionTasks("/wasm");
//   faceLandmarker = await FaceLandmarker.createFromOptions(visionFileset, {
//     baseOptions: {
//       modelAssetPath: "/models/face_landmarker.task",
//       delegate: "GPU",
//     },
//     outputFaceBlendshapes: true,
//     runningMode,
//     numFaces: 2,
//   });
//   demosSection.classList.remove("invisible");
// };

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

  // Save the current canvas state
  canvasCtx.save();

  // Mirror the canvas horizontally
  canvasCtx.translate(canvasElement.width, 0);
  canvasCtx.scale(-1, 1);

  // Draw the video feed onto the canvas
  canvasCtx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);

  // Restore the canvas state for further drawing operations
  canvasCtx.restore();

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

  // Draw the video feed onto the canvas first
  canvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

  // Get the image data from the canvas (the video frame)
  const imageData = canvasCtx.getImageData(
    0,
    0,
    video.videoWidth,
    video.videoHeight
  );
  const { data } = imageData;

  // Use the mask to cut out the desired areas
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 1 && mask[i] !== 3 && mask[i] !== 5) {
      data[i * 4] = 0; // Red
      data[i * 4 + 1] = 0; // Green
      data[i * 4 + 2] = 0; // Blue
      data[i * 4 + 3] = 0; // Alpha (fully transparent)
    }
  }

  // Put the modified image data back onto the canvas
  canvasCtx.putImageData(imageData, 0, 0);

  canvasCtx.save();
  canvasCtx.filter = "blur(5px)"; // Adjust blur radius as needed
  canvasCtx.globalCompositeOperation = "destination-in";
  canvasCtx.drawImage(canvasElement, 0, 0);
  canvasCtx.restore();

  // Continue the webcam prediction loop if it's running
  if (webcamRunning) window.requestAnimationFrame(predictWebcam);
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
