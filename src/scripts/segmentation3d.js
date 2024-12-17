import {
  ImageSegmenter,
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { z } from "astro:content";

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
const canvasStream = document.querySelector(".canvas_stream");

const canvas2Ctx = canvas2.getContext("2d");
const canvas3Ctx = canvas3.getContext("2d");
const canvas4Ctx = canvas4.getContext("2d");
const canvasStreamCtx = canvasStream.getContext("2d");

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

let currentReferenceLandmarkIndex = null;

let currentFacialTransformationMatrix = null;

// landmark for axis calculation
// const landmarkA = currentFaceLandmarks[leftEyeCornerIndex];
// const landmarkB = currentFaceLandmarks[rightEyeCornerIndex];

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
    outputFacialTransformationMatrixes: true,
    runningMode,
    numFaces: 1,
  });
  demosSection.classList.remove("invisible");
};

function multiplyMatrixVector(m, x, y, z, w = 1) {
  // m is assumed to be column-major
  const X = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
  const Y = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
  const Z = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
  const W = m[3] * x + m[7] * y + m[11] * z + m[15] * w;

  // Avoid division by zero if W is extremely small
  const epsilon = 1e-10;
  const denom = Math.abs(W) < epsilon ? 1.0 : W;

  return [X / denom, Y / denom, Z / denom];
}

function toRowMajor(src) {
  // Convert from column-major (MediaPipe) to row-major
  return [
    src[0],
    src[4],
    src[8],
    src[12],
    src[1],
    src[5],
    src[9],
    src[13],
    src[2],
    src[6],
    src[10],
    src[14],
    src[3],
    src[7],
    src[11],
    src[15],
  ];
}

function toColumnMajor(src) {
  // Convert from row-major back to column-major
  return [
    src[0],
    src[4],
    src[8],
    src[12],
    src[1],
    src[5],
    src[9],
    src[13],
    src[2],
    src[6],
    src[10],
    src[14],
    src[3],
    src[7],
    src[11],
    src[15],
  ];
}

function invertMatrix(m) {
  // m is a 4x4 matrix in row-major order:
  // m = [
  //   m0,  m1,  m2,  m3,
  //   m4,  m5,  m6,  m7,
  //   m8,  m9,  m10, m11,
  //   m12, m13, m14, m15
  // ]

  const inv = new Float32Array(16);

  const a00 = m[0],
    a01 = m[1],
    a02 = m[2],
    a03 = m[3];
  const a10 = m[4],
    a11 = m[5],
    a12 = m[6],
    a13 = m[7];
  const a20 = m[8],
    a21 = m[9],
    a22 = m[10],
    a23 = m[11];
  const a30 = m[12],
    a31 = m[13],
    a32 = m[14],
    a33 = m[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  // Calculate the determinant
  let det =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) {
    console.warn("Matrix not invertible");
    return null;
  }
  det = 1.0 / det;

  inv[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  inv[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * det;
  inv[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  inv[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * det;
  inv[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * det;
  inv[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  inv[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * det;
  inv[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  inv[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  inv[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * det;
  inv[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  inv[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * det;
  inv[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * det;
  inv[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  inv[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * det;
  inv[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

  return inv;
}

// drawing events
canvasElement.addEventListener("mousedown", (e) => {
  isDrawing = true;
  drawnPoints = [];

  if (currentFaceLandmarks) {
    const rect = canvasElement.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / rect.width;
    const startY = (e.clientY - rect.top) / rect.height;

    // Find the single nearest landmark at the start point
    let minDist = Infinity;
    let nearestLandmarkIndex = null;
    currentFaceLandmarks.forEach((lm, index) => {
      const dx = startX - lm.x;
      const dy = startY - lm.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearestLandmarkIndex = index;
      }
    });

    currentReferenceLandmarkIndex = nearestLandmarkIndex;
  } else {
    currentReferenceLandmarkIndex = null;
  }
});

canvasElement.addEventListener("mousemove", (e) => {
  if (!isDrawing || currentReferenceLandmarkIndex === null) return;

  const rect = canvasElement.getBoundingClientRect();
  const normalizedX = (e.clientX - rect.left) / rect.width;
  const normalizedY = (e.clientY - rect.top) / rect.height;

  // Get the reference landmark
  const refLm = currentFaceLandmarks[currentReferenceLandmarkIndex];

  // Store pure 2D offsets
  drawnPoints.push({
    offsetX: normalizedX - refLm.x,
    offsetY: normalizedY - refLm.y,
    // No Z offset during drawing
  });
});

canvasElement.addEventListener("mouseup", () => {
  isDrawing = false;
  if (
    drawnPoints.length &&
    currentReferenceLandmarkIndex !== null &&
    currentFacialTransformationMatrix
  ) {
    const refLm = currentFaceLandmarks[currentReferenceLandmarkIndex];

    // Convert the facialTransformationMatrix to row-major and invert it
    const rowMajoredMatrix = toRowMajor(currentFacialTransformationMatrix);
    const invRowMajor = invertMatrix(rowMajoredMatrix);
    if (!invRowMajor) {
      console.warn("Matrix not invertible at mouseup");
      drawnPoints = [];
      currentReferenceLandmarkIndex = null;
      return;
    }
    const invMatrix = toColumnMajor(invRowMajor);

    // Transform drawn points from camera/detected face space into canonical face space
    const faceSpacePoints = drawnPoints.map((p) => {
      // Current drawn point in camera space:
      const cameraX = refLm.x / 1000 + p.offsetX;
      const cameraY = refLm.y / 1000 + p.offsetY;
      const cameraZ = 0.05; // Approximate depth from the reference landmark

      // Use inverse matrix to go from camera space to face (canonical) space
      const [faceX, faceY, faceZ] = multiplyMatrixVector(
        invMatrix,
        cameraX,
        cameraY,
        cameraZ,
      );
      return { faceX, faceY, faceZ };
    });

    // Store the drawing in face space
    faceDrawings.push({
      referenceLandmarkIndex: currentReferenceLandmarkIndex,
      faceSpacePoints,
    });

    drawnPoints = [];
    currentReferenceLandmarkIndex = null;
  }
  drawnPoints = [];
  currentReferenceLandmarkIndex = null;
});

// draw freehand on canvas (normalized)
function drawOnCanvas(points, ctx, color = "blue") {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
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
  if (!currentFacialTransformationMatrix) {
    return;
  }

  ctx.strokeStyle = "blue";
  ctx.lineWidth = 5;

  allPinnedDrawings.forEach((drawing) => {
    // Project from face (canonical) space to camera space using the forward matrix
    const projectedPoints = drawing.faceSpacePoints.map((fp) => {
      const [camX, camY, camZ] = multiplyMatrixVector(
        currentFacialTransformationMatrix,
        fp.faceX,
        fp.faceY,
        fp.faceZ,
      );

      const finalX = camX * canvasElement.width;
      const finalY = camY * canvasElement.height;
      return { x: finalX, y: finalY };
    });

    if (projectedPoints.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(projectedPoints[0].x, projectedPoints[0].y);
    for (let i = 1; i < projectedPoints.length; i++) {
      ctx.lineTo(projectedPoints[i].x, projectedPoints[i].y);
    }
    ctx.stroke();
  });
}

// check webcam access
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// webcam prediction
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

  canvasStream.width = squareSize;
  canvasStream.height = squareSize;

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

  // detecting face and landmarks
  if (faceLandmarker) {
    // console.log("facelandmarker", FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS);
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
        let normZ = lm.z;

        return {
          x: normX,
          y: normY,
          z: normZ,
        };
      });

      if (
        results.facialTransformationMatrixes &&
        results.facialTransformationMatrixes.length > 0
      ) {
        currentFacialTransformationMatrix =
          results.facialTransformationMatrixes[0].data;
      } else {
        currentFacialTransformationMatrix = null;
      }
    } else {
      currentFaceLandmarks = null;
      currentFacialTransformationMatrix = null;
    }
  }

  //detecting face 3d matrix transformations
  //   if (faceLandmarker) {
  //     const results = await faceLandmarker.detectForVideo(video, startTimeMs);
  //     if (
  //       results &&
  //       results.facialTransformationMatrixes &&
  //       results.facialTransformationMatrixes.length > 0
  //     ) {
  //       // convert landmarks to cropped canvas coordinates
  //       currentFacialTransformationMatrixes =
  //         results.facialTransformationMatrixes[0].map((lm) => {
  //           // lm.x, lm.y are normalized to full video (0...1)
  //           const pixelX = lm.x * videoWidth;
  //           const pixelY = lm.y * videoHeight;

  //           // Convert to [0,1] range relative to our cropped square
  //           let normX = (pixelX - xOffset) / squareSize;
  //           let normY = (pixelY - yOffset) / squareSize;

  //           // Mirror horizontally by flipping the X coordinate
  //           normX = 1 - normX;

  //           return {
  //             x: normX,
  //             y: normY,
  //           };
  //         });
  //     } else {
  //       currentFacialTransformationMatrixes = null;
  //     }
  //   }

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
  if (
    isDrawing &&
    drawnPoints.length > 0 &&
    currentReferenceLandmarkIndex !== null &&
    currentFaceLandmarks
  ) {
    const refLm = currentFaceLandmarks[currentReferenceLandmarkIndex];
    const tempPoints = drawnPoints.map((p) => ({
      x: refLm.x + p.offsetX,
      y: refLm.y + p.offsetY,
    }));
    drawOnCanvas(tempPoints, canvasCtx, "blue");
  }

  canvas2Ctx.clearRect(0, 0, canvas2.width, canvas2.height);
  canvas2Ctx.drawImage(canvasElement, 0, 0);

  canvas3Ctx.clearRect(0, 0, canvas3.width, canvas3.height);
  canvas3Ctx.drawImage(canvasElement, 0, 0);

  canvas4Ctx.clearRect(0, 0, canvas4.width, canvas4.height);
  canvas4Ctx.drawImage(canvasElement, 0, 0);

  canvasStreamCtx.clearRect(0, 0, canvasStream.width, canvasStream.height);
  canvasStreamCtx.drawImage(canvasElement, 0, 0);
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
  enableCam();
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn(
    "webcam access is not supported by your browser, please contact team cactus",
  );
}

createImageSegmenter();
createFaceLandmarker();
