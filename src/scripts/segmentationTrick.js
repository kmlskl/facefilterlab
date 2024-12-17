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
// let enableWebcamButton;
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
// let referenceFrame = null;
let currentFaceLandmarks;

const colors = ["blue", "red", "green", "yellow", "purple", "orange"];
let currentDrawingColor = colors[0];

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
    runningMode,
    numFaces: 1,
  });
  demosSection.classList.remove("invisible");
};

// helper functions
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

// drawing events

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
  }
  drawnPoints = [];
});

// draw freehand on canvas (normalized)
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

// // map drawings to face landmarks (coordinates 0-1)
// function mapToFace(drawnPoints, landmarks) {
//   const pinnedDrawings = [];
//   drawnPoints.forEach((point) => {
//     let minDist = Infinity;
//     let nearestLandmarkIndex = null;

//     landmarks.forEach((landmark, index) => {
//       const dx = point.x - landmark.x;
//       const dy = point.y - landmark.y;
//       const dist = Math.sqrt(dx * dx + dy * dy);
//       if (dist < minDist) {
//         minDist = dist;
//         nearestLandmarkIndex = index;
//       }
//     });

//     if (nearestLandmarkIndex !== null) {
//       const lm = landmarks[nearestLandmarkIndex];
//       // store offset relative to landmark
//       pinnedDrawings.push({
//         landmarkIndex: nearestLandmarkIndex,
//         offsetX: point.x - lm.x,
//         offsetY: point.y - lm.y,
//       });
//     }
//   });

//   return pinnedDrawings;
// }

// render pinned drawings on face
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
    // const angleDiff = currentAngle - drawing.refAngle;

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

// check webcam access
const hasGetUserMedia = () => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

// webcam prediction
let lastWebcamTime = -1;

const predictWebcam = async () => {
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

// draw the segmentation results: video on canvas
const callbackForVideo = (result) => {
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

  // if currently drawing, we need to render and show the line
  if (isDrawing && drawnPoints.length > 0 && currentFaceLandmarks) {
    // compute current reference frame for in-progress drawing
    const leftIrisCenter = computeIrisCenter(currentFaceLandmarks, 468); // left iris landmarks
    const rightIrisCenter = computeIrisCenter(currentFaceLandmarks, 473); // right iris landmarks
    const midpoint = {
      x: (leftIrisCenter.x + rightIrisCenter.x) / 2,
      y: (leftIrisCenter.y + rightIrisCenter.y) / 2,
    };
    const { angle: currentAngle, distance: currentDistance } =
      computeAngleAndScale(leftIrisCenter, rightIrisCenter);

    // transform the in-progress drawnPoints into canonical space
    const canonicalInProgress = drawnPoints.map((p) => {
      // translate so that midpoint is the origin
      let tx = p.x - midpoint.x;
      let ty = p.y - midpoint.y;

      // rotate to align with the reference frame's x-axis
      const cosA = Math.cos(-currentAngle);
      const sinA = Math.sin(-currentAngle);
      const rx = tx * cosA - ty * sinA;
      const ry = tx * sinA + ty * cosA;

      // scale based on the reference distance
      const sx = rx / currentDistance;
      const sy = ry / currentDistance;

      return { x: sx, y: sy };
    });

    // render the in-progress drawing
    // temporarily store it in a variable
    const transformedInProgress = canonicalInProgress.map((cp) => {
      // scale to reference distance
      let sx = cp.x * currentDistance;
      let sy = cp.y * currentDistance;

      // rotate acc to the face angle
      const rx = sx * Math.cos(currentAngle) - sy * Math.sin(currentAngle);
      const ry = sx * Math.sin(currentAngle) + sy * Math.cos(currentAngle);

      // translate to the face midpoint
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

  canvas2Ctx.clearRect(0, 0, canvas2.width, canvas2.height);
  canvas2Ctx.drawImage(canvasElement, 0, 0);

  canvas3Ctx.clearRect(0, 0, canvas3.width, canvas3.height);
  canvas3Ctx.drawImage(canvasElement, 0, 0);

  canvas4Ctx.clearRect(0, 0, canvas4.width, canvas4.height);
  canvas4Ctx.drawImage(canvasElement, 0, 0);

  canvasStreamCtx.clearRect(0, 0, canvasStream.width, canvasStream.height);
  canvasStreamCtx.drawImage(canvasElement, 0, 0);
};

// enable webcam automatically
const enableCam = async () => {
  try {
    if (!imageSegmenter || !faceLandmarker) {
      throw new Error(
        "Tasks not initialized. Ensure ImageSegmenter and FaceLandmarker are ready.",
      );
    }

    // start webcam
    console.log("Requesting webcam access...");
    const constraints = { video: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    video.srcObject = stream;
    webcamRunning = true;

    video.addEventListener("loadedmetadata", () => {
      console.log("Webcam feed ready.");
      predictWebcam(); // start the prediction loop woop woop
    });

    video.addEventListener("loadeddata", () => {
      console.log("Webcam feed started.");
    });
  } catch (error) {
    console.error("Error enabling webcam:", error);
  }
};

if (hasGetUserMedia()) {
  try {
    console.log(
      "Initializing image segmentation and face landmark detection...",
    );

    // first we need to initialize the mediapipe tasks
    await createImageSegmenter();
    await createFaceLandmarker();

    console.log(
      "Image Segmenter and Face Landmarker initialized successfully.",
    );

    // after mediapipe, we enable the webcam
    await enableCam();
  } catch (error) {
    console.error("Error during initialization:", error);
  }
} else {
  console.warn("Webcam access issue. Please contact support.");
}
