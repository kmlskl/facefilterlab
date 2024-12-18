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
let animationLoadedAfterDrawing = false;
let animationLoadedThumbsUpWorm = false;
let animationLoadedExplosionFinal = false;

let isFaceInFrame = false;
let isDrawingStarted = false;
let isTouching = false;

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
    show: ["tools", "navbar--button__next", "suggestion"],
    hide: ["instructions"],
  },
];

let undoLastDrawButton = document.querySelector(".undo__button");

undoLastDrawButton.addEventListener("click", () => {
  peer.send(
    JSON.stringify({
      type: "undoLastDraw",
    }),
  );
});

let inactivityTime = 0;
let experienceActive = false;
let inactivityTimerId = null;

// document.onclick = () => { inactivityTime = 0; };
document.addEventListener("touchstart", () => {
  if (experienceActive) {
    inactivityTime = 0;
    inactivityChecker();
  }
});

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

    let toolballPos = document.querySelector(".toolball");
    toolballPos.classList.remove(
      "brushYellow",
      "brushOrange",
      "brushRed",
      "brushGreen",
      "brushPurple",
      "brushPink",
      "pencilSmall",
      "pencilBig",
      "eraser",
    );
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
  // For other steps, simply increment and render
  currentInstructionStep++;
  renderInstructionStep();
  performStepActions(currentInstructionStep);
};

const performStepActions = (step) => {
  switch (step) {
    case 1:
      lottie.loadAnimation({
        container: document.querySelector(".lottieSuper"),
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: "./assets/ThumbsUp.json",
      });
      setTimeout(() => {
        nextInstructionStep();
      }, 3000);
      break;
    case 2:
      isDrawingStarted = true;
      console.log("Drawing started");
      lottie.loadAnimation({
        container: document.querySelector(".lottieFingerPoint"),
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: "./assets/FingerPoint.json",
      });
      lottie.loadAnimation({
        container: document.querySelector(".lottiePinkSnake"),
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: "./assets/PinkSnake.json",
      });
      break;
    case 3:
      document.querySelector(".lottieFingerPoint").classList.add("none");
      document.querySelector(".lottiePinkSnake").classList.add("none");
      for (let i = 2; i < 6; i++) {
        lottie.loadAnimation({
          container: document.querySelector(`.lottieSuper${i}`),
          renderer: "svg",
          loop: false,
          autoplay: true,
          path: "./assets/ThumbsUp.json",
        });
      }
      setTimeout(() => {
        nextInstructionStep();
      }, 3000);
      break;
    case 4:
      const suggestion = document.querySelector(".suggestion");
      document.querySelector(".navbar--button__undo").classList.remove("none");
      let suggestionTime = 0;
      const timerSuggestion = setInterval(() => {
        suggestionTime++;
        if (suggestionTime === 3) {
          suggestion.classList.add("vanish");
          clearInterval(timerSuggestion);
        }
        // console.log(suggestionTime);
      }, 1000);

      let timeThumbsUp = 0;
      const timerThumbsUp = setInterval(() => {
        timeThumbsUp++;
        if (timeThumbsUp === 6) {
          if (!animationLoadedThumbsUpWorm && currentInstructionStep === 4) {
            lottie.loadAnimation({
              container: document.querySelector(".lottieThumbWorm"),
              renderer: "svg",
              loop: false,
              autoplay: true,
              path: "./assets/ThumbsUpWorm.json",
            });
            animationLoadedThumbsUpWorm = true;
          }
          clearInterval(timerThumbsUp);
        }
      }, 1000);
    // ... handle other steps
    default:
      break;
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

// document
//   .querySelector(".navbar--button__undo")
//   .addEventListener("click", (event) => {
//     // prevInstructionStep();
//   });

const startExperience = () => {
  document.querySelector(".start").classList.add("none");
  document.querySelector(".experience").classList.remove("none");
  document.querySelector(".navbar").classList.remove("none");

  experienceActive = true;
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
// more than 2 people in camera function
const twoPeopleCamera = () => {
  document.querySelector(".twoPeople__wrapper").classList.add("visible");
  document.querySelector(".lower__opacity2").style.backgroundColor =
    "rgba(0, 0, 0, 0.3)";
  document.querySelector(".wormCameraRight").classList.add("wormRightMove");
};
// no one in camera function
const noPeopleCamera = () => {
  document.querySelector(".noPeople__wrapper").classList.add("visible");
  document.querySelector(".lower__opacity3").style.backgroundColor =
    "rgba(0, 0, 0, 0.3)";
  document.querySelector(".wormSlideLeft").classList.add("wormslideLeftMove");
  document.querySelector(".wormSlideRight").classList.add("wormslideRightMove");
};

const noPeopleCameraSolved = () => {
  document.querySelector(".noPeople__wrapper").classList.remove("visible");
  document.querySelector(".lower__opacity3").style.backgroundColor =
    "rgba(0, 0, 0, 0)";
  document
    .querySelector(".wormSlideLeft")
    .classList.remove("wormslideLeftMove");
  document
    .querySelector(".wormSlideRight")
    .classList.remove("wormslideRightMove");
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

const inactivityPopup = (inactivityTimer) => {
  document.querySelector(".navbar").classList.add("opacityBar");
  document.querySelector(".inactivity__wrapper").classList.add("visible");
  document.querySelector(".lower__opacity").style.backgroundColor =
    "rgba(0, 0, 0, 0.3)";
  document.querySelector(".lower__opacity").style.pointerEvents = "all";
  document.querySelector(".inactive__worm").classList.add("wormIn");
  document.querySelector(".inactive__mark").classList.add("markIn");
  // clearInterval(inactivityTimer);
};

const inactivityChecker = () => {
  // Clear any existing inactivity timer
  if (inactivityTimerId !== null) {
    clearInterval(inactivityTimerId);
  }

  // Reset inactivity time
  inactivityTime = 0;

  // Start a new inactivity timer
  inactivityTimerId = setInterval(() => {
    inactivityTime++;
    console.log("Inactivity Time:", inactivityTime);
    console.log(`Inactivity Time: ${inactivityTime}s`);

    if (inactivityTime === 90) {
      inactivityPopup(); // Show popup at 10 seconds
    }

    if (inactivityTime >= 120) {
      // Clear the inactivity timer before restarting
      clearInterval(inactivityTimerId);
      inactivityTimerId = null;

      // Restart the experience
      restartExperience();
    }
  }, 1000);
};

document
  .querySelector(".inactivity__button--ja")
  .addEventListener("click", () => {
    document.querySelector(".inactivity__wrapper").classList.remove("visible");
    document.querySelector(".lower__opacity").style.pointerEvents = "none";
    document.querySelector(".lower__opacity").style.backgroundColor =
      "rgba(0, 0, 0, 0)";
    document.querySelector(".inactive__worm").classList.remove("wormIn");
    document.querySelector(".inactive__mark").classList.remove("markIn");
    document.querySelector(".navbar").classList.remove("opacityBar");
    inactivityChecker();
  });
document
  .querySelector(".inactivity__button--nee")
  .addEventListener("click", () => {
    restartExperience();
  });

document.querySelector(".start--button").addEventListener("click", () => {
  startExperience();
  inactivityChecker();
});

// Go to options page
document
  .querySelector(".navbar--button__next")
  .addEventListener("click", () => {
    // document.querySelector(".application").classList.add("none");
    document
      .querySelector(".navbar--button__empty-right")
      .classList.remove("none");
    document.querySelector(".option").classList.remove("none");
    document.querySelector(".tools").classList.add("none");
    document.querySelector(".navbar--button__undo").classList.add("none");
    document.querySelector(".navbar--button__next").classList.add("none");
    document.querySelector(".title__question1").classList.remove("none");
    document.querySelector(".nav__title").classList.add("none");
    document.querySelector(".suggestion").classList.add("none");
    document.querySelector(".lottieAfterDrawing").classList.remove("none");
    if (!animationLoadedAfterDrawing) {
      lottie.loadAnimation({
        container: document.querySelector(".lottieAfterDrawing"),
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: "./assets/WormsDrawingComplete.json",
      });
      animationLoadedAfterDrawing = true;
    }
    document
      .querySelector(".navbar--button__back-drawing")
      .classList.remove("none");
    document
      .querySelector(".navbar--button__empty-right")
      .classList.remove("none");
  });

// back to drawing page from options
document
  .querySelector(".navbar--button__back-drawing")
  .addEventListener("click", () => {
    document.querySelector(".option").classList.add("none");
    document
      .querySelector(".navbar--button__empty-right")
      .classList.add("none");

    document.querySelector(".tools").classList.remove("none");
    // document.querySelector(".navbar--button__undo").classList.remove("none");
    document.querySelector(".navbar--button__next").classList.remove("none");
    document.querySelector(".title__question1").classList.add("none");
    document.querySelector(".nav__title").classList.remove("none");
    document.querySelector(".suggestion").classList.remove("none");
    document.querySelector(".lottieAfterDrawing").classList.add("none");
    document
      .querySelector(".navbar--button__back-drawing")
      .classList.add("none");
    document
      .querySelector(".navbar--button__empty-right")
      .classList.add("none");
  });

// Go to delete page
document
  .querySelector(".option--text__delete")
  .addEventListener("click", () => {
    document.querySelector(".option").classList.add("none");
    document.querySelector(".delete__page").classList.remove("none");
    document.querySelector(".face_canvas").classList.add("none");
    document.querySelector(".title__question1").classList.add("none");
    document.querySelector(".title__question2").classList.add("none");
    document.querySelector(".title__question4").classList.add("none");
    document.querySelector(".title__question3").classList.remove("none");
    document.querySelector(".lottieAfterDrawing").classList.add("none");
    document
      .querySelector(".navbar--button__empty-right")
      .classList.remove("none");

    // document.querySelector(".saveWorm").classList.add('saveWormUp');

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
    element.addEventListener("click", () => {
      document.querySelector(".option").classList.remove("none");
      document.querySelector(".delete__page").classList.add("none");
      document.querySelector(".face_canvas").classList.remove("none");
      document.querySelector(".title__question1").classList.remove("none");
      document.querySelector(".title__question2").classList.add("none");
      document.querySelector(".title__question3").classList.add("none");
      document.querySelector(".title__question4").classList.add("none");
      document.querySelector(".lottieAfterDrawing").classList.remove("none");
      document
        .querySelector(".navbar--button__empty-right")
        .classList.remove("none");

      // document.querySelector(".saveWorm").classList.remove('saveWormUp');

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
document.querySelector(".option--text__save").addEventListener("click", () => {
  // document.querySelector(".saveWorm").classList.add('wormMoveUp');
  document.querySelector(".option").classList.add("none");
  document.querySelector(".save__page").classList.remove("none");
  document.querySelector(".face_canvas").classList.add("none");
  document.querySelector(".title__question1").classList.add("none");
  document.querySelector(".title__question2").classList.remove("none");
  document.querySelector(".title__question3").classList.add("none");
  document.querySelector(".lottieAfterDrawing").classList.add("none");
  document
    .querySelector(".navbar--button__empty-right")
    .classList.remove("none");

  document
    .querySelector(".navbar--button__back-options")
    .classList.remove("none");
  document.querySelector(".navbar--button__back-drawing").classList.add("none");
  document.querySelector(".nav__title").classList.add("hidden");
});

// Save page to options
document
  .querySelectorAll(".navbar--button__back-options, .save--text__back")
  .forEach(function (element) {
    element.addEventListener("click", function () {
      document.querySelector(".option").classList.remove("none");
      document.querySelector(".save__page").classList.add("none");
      document.querySelector(".face_canvas").classList.remove("none");
      document.querySelector(".title__question1").classList.remove("none");
      document.querySelector(".title__question2").classList.add("none");
      document.querySelector(".title__question3").classList.add("none");
      document.querySelector(".lottieAfterDrawing").classList.remove("none");
      document
        .querySelector(".navbar--button__empty-right")
        .classList.remove("none");

      // document.querySelector(".saveWorm").classList.remove('saveWormUp');

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
    // document.querySelector(".navbar--button__undo").classList.remove("none");
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

      document
        .querySelector(".navbar--button__empty-right")
        .classList.add("none");
      document.querySelector(".title__question1").classList.add("none");
      document.querySelector(".title__question2").classList.add("none");
      document.querySelector(".title__question3").classList.add("none");
      document.querySelector(".title__question4").classList.remove("none");

      if (!animationLoadedExplosionFinal) {
        lottie.loadAnimation({
          container: document.querySelector(".lottieExplosionFinal"),
          renderer: "svg",
          loop: false,
          autoplay: true,
          path: "./assets/BigExplosion.json",
        });
        animationLoadedExplosionFinal = true;
      }

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
document.querySelector(".final--text").addEventListener("click", () => {
  // Optionally, notify peer to return to start
  restartExperience();
});

//save image function
document.querySelector(".save--text__save").addEventListener("click", () => {
  if (peer && peer.connected) {
    peer.send(
      JSON.stringify({
        type: "saveImage",
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

const restartExperience = () => {
  if (peer && peer.connected) {
    peer.send(
      JSON.stringify({
        type: "restartExperience",
      }),
    );
  }
  window.location.reload();
};
// const restartExperience = () => {

//   // ---------------------------
//   // 1. Clear Inactivity Timer
//   // ---------------------------
//   if (inactivityTimerId !== null) {
//     clearInterval(inactivityTimerId);
//     inactivityTimerId = null;
//   }

//   // ---------------------------
//   // 2. Reset Instruction Steps
//   // ---------------------------
//   currentInstructionStep = 0;
//   renderInstructionStep();

//   // ---------------------------
//   // 3. Reset UI Elements to Initial State
//   // ---------------------------
//   // Define all elements to show and hide
//   const elementsToShow = [".start"];
//   const elementsToHide = [
//     ".experience",
//     ".instructions",
//     ".navbar",
//     ".canvas_container",
//     ".option",
//     ".delete__page",
//     ".save__page",
//     ".final__page",
//     ".inactivity__wrapper",
//     ".twoPeople__wrapper",
//     ".noPeople__wrapper",
//     ".lottieAfterDrawing",
//     ".navbar--button__back-drawing",
//     ".navbar--button__empty-right",
//   ];

//   // Show elements
//   elementsToShow.forEach((selector) => {
//     const el = document.querySelector(selector);
//     if (el) el.classList.remove("none", "visible", "hidden");
//   });

//   // Hide elements
//   elementsToHide.forEach((selector) => {
//     const el = document.querySelector(selector);
//     if (el) el.classList.add("none");
//   });

//   // ---------------------------
//   // 4. Reset Specific UI Components
//   // ---------------------------

//   // Reset Inactivity Popup Elements
//   const navbar = document.querySelector(".navbar");
//   if (navbar) navbar.classList.remove("opacityBar");

//   const inactivityWrapper = document.querySelector(".inactivity__wrapper");
//   if (inactivityWrapper) inactivityWrapper.classList.remove("visible");

//   const lowerOpacity = document.querySelector(".lower__opacity");
//   if (lowerOpacity) {
//     lowerOpacity.style.pointerEvents = "none";
//     lowerOpacity.style.backgroundColor = "rgba(0, 0, 0, 0)";
//   }

//   const inactiveWorm = document.querySelector(".inactive__worm");
//   if (inactiveWorm) inactiveWorm.classList.remove("wormIn");

//   const inactiveMark = document.querySelector(".inactive__mark");
//   if (inactiveMark) inactiveMark.classList.remove("markIn");

//   // Reset Two People Camera Elements
//   const twoPeopleWrapper = document.querySelector(".twoPeople__wrapper");
//   if (twoPeopleWrapper) twoPeopleWrapper.classList.remove("visible");

//   const lowerOpacity2 = document.querySelector(".lower__opacity2");
//   if (lowerOpacity2) lowerOpacity2.style.backgroundColor = "";

//   const wormCameraRight = document.querySelector(".wormCameraRight");
//   if (wormCameraRight) wormCameraRight.classList.remove("wormRightMove");

//   // Reset No People Camera Elements
//   const noPeopleWrapper = document.querySelector(".noPeople__wrapper");
//   if (noPeopleWrapper) noPeopleWrapper.classList.remove("visible");

//   const lowerOpacity3 = document.querySelector(".lower__opacity3");
//   if (lowerOpacity3) {
//     lowerOpacity3.style.backgroundColor = "rgba(0, 0, 0, 0)";
//   }

//   const wormSlideLeft = document.querySelector(".wormSlideLeft");
//   if (wormSlideLeft) wormSlideLeft.classList.remove("wormslideLeftMove");

//   const wormSlideRight = document.querySelector(".wormSlideRight");
//   if (wormSlideRight) wormSlideRight.classList.remove("wormslideRightMove");

//   // Reset Suggestion Elements
//   const suggestion = document.querySelector(".suggestion");
//   if (suggestion) suggestion.classList.remove("vanish");

//   // Reset Titles
//   const titleQuestion1 = document.querySelector(".title__question1");
//   if (titleQuestion1) titleQuestion1.classList.add("none");

//   const titleQuestion2 = document.querySelector(".title__question2");
//   if (titleQuestion2) titleQuestion2.classList.add("none");

//   const titleQuestion3 = document.querySelector(".title__question3");
//   if (titleQuestion3) titleQuestion3.classList.add("none");

//   const titleQuestion4 = document.querySelector(".title__question4");
//   if (titleQuestion4) titleQuestion4.classList.add("none");

//   const navTitle = document.querySelector(".nav__title");
//   if (navTitle) navTitle.classList.remove("hidden");

//   // Reset Navbar Buttons
//   const navbarButtonUndo = document.querySelector(".navbar--button__undo");
//   if (navbarButtonUndo) navbarButtonUndo.classList.add("none");

//   const navbarButtonNext = document.querySelector(".navbar--button__next");
//   if (navbarButtonNext) navbarButtonNext.classList.add("none");

//   const navbarButtonBackOptions = document.querySelector(
//     ".navbar--button__back-options",
//   );
//   if (navbarButtonBackOptions) navbarButtonBackOptions.classList.add("none");

//   const navbarButtonBackDrawing = document.querySelector(
//     ".navbar--button__back-drawing",
//   );
//   if (navbarButtonBackDrawing) navbarButtonBackDrawing.classList.add("none");

//   const navbarButtonEmptyRight = document.querySelector(
//     ".navbar--button__empty-right",
//   );
//   if (navbarButtonEmptyRight) navbarButtonEmptyRight.classList.add("none");

//   // Reset Final Page Elements
//   const finalPage = document.querySelector(".final__page");
//   if (finalPage) finalPage.classList.add("none");

//   const lottieExplosionFinal = document.querySelector(".lottieExplosionFinal");
//   if (lottieExplosionFinal) {
//     lottieExplosionFinal.classList.remove("none");
//     // Optionally destroy or reset animations
//     // lottie.destroy(); // This resets all Lottie animations
//   }

//   // Reset Lottie After Drawing
//   const lottieAfterDrawing = document.querySelector(".lottieAfterDrawing");
//   if (lottieAfterDrawing) lottieAfterDrawing.classList.add("none");

//   // Reset Application Page
//   const application = document.querySelector(".application");
//   if (application) application.classList.add("none");

//   // Reset Navbar Visibility
//   const navbarElement = document.querySelector(".navbar");
//   if (navbarElement) navbarElement.classList.add("none");

//   // Reset Canvas Container
//   const canvasContainer = document.querySelector(".canvas_container");
//   if (canvasContainer) canvasContainer.classList.add("none");

//   // Reset Option Pages
//   const option = document.querySelector(".option");
//   if (option) option.classList.add("none");

//   const deletePage = document.querySelector(".delete__page");
//   if (deletePage) deletePage.classList.add("none");

//   const savePage = document.querySelector(".save__page");
//   if (savePage) savePage.classList.add("none");

//   const finalText = document.querySelector(".final--text");
//   if (finalText) finalText.classList.remove("none");

//   // Reset any other specific elements as needed
//   // Example: Reset all elements with "wormIn", "markIn", etc.
//   document.querySelectorAll(".wormIn, .markIn, .opacityBar").forEach((el) => {
//     el.classList.remove("wormIn", "markIn", "opacityBar");
//   });

//   // ---------------------------
//   // 5. Reset Tool Selection
//   // ---------------------------
//   selectedTool = "pencilBig";
//   toolButtons.forEach((btn) => btn.classList.remove("selected"));
//   const defaultToolButton = document.querySelector(
//     `[data-tool="${selectedTool}"]`,
//   );
//   if (defaultToolButton) defaultToolButton.classList.add("selected");

//   const toolballPos = document.querySelector(".toolball");
//   if (toolballPos) {
//     toolballPos.className = "toolball " + selectedTool;
//   }

//   // ---------------------------
//   // 6. Reset Animations
//   // ---------------------------
//   // Destroy all existing Lottie animations
//   lottie.destroy();

//   // Reload the initial idle animation
//   lottie.loadAnimation({
//     container: document.querySelector(".lottie"),
//     renderer: "svg",
//     loop: true,
//     autoplay: true,
//     path: "./assets/idle3.json",
//   });

//   // Reset animation flags
//   animationLoadedAfterDrawing = false;
//   animationLoadedThumbsUpWorm = false;
//   animationLoadedExplosionFinal = false;

//   // ---------------------------
//   // 7. Clear Canvas
//   // ---------------------------
//   if (faceCanvasContext) {
//     faceCanvasContext.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
//   }

//   // ---------------------------
//   // 8. Reset State Variables
//   // ---------------------------
//   isFaceInFrame = false;
//   isDrawingStarted = false;
//   isTouching = false;
//   inactivityTime = 0;
//   experienceActive = false;

//   // ---------------------------
//   // 9. Reset Inactivity Checker
//   // ---------------------------
//   // Do not restart the inactivity checker here; it should start when the experience starts
//   // Ensure that no timers are running

//   // ---------------------------
//   // 10. Reset Remote Video
//   // ---------------------------
//   if (remoteVideo) {
//     remoteVideo.pause();
//     remoteVideo.srcObject = null;
//   }

//   // ---------------------------
//   // 11. Reset WebRTC and Socket.io Connections
//   // ---------------------------
//   if (peer) {
//     peer.destroy();
//     peer = null;
//   }

//   if (socket) {
//     socket.disconnect();
//     socket = null;
//   }

//   // Reinitialize Socket.io connection
//   initSocket();

//   // ---------------------------
//   // 12. Log Restart Completion
//   // ---------------------------
//   console.log("Experience has been restarted to the initial state.");

//   // Notify peer about the restart if connected
//   if (peer && peer.connected) {
//     peer.send(
//       JSON.stringify({
//         type: "restartExperience",
//       }),
//     );
//   }

//   // ---------------------------
//   // 13. Restore Event Listeners (If Needed)
//   // ---------------------------
//   // If any event listeners were removed or need to be reattached, do so here.
//   // For example, reattach any specific event listeners that were not persistent.
// };

// Lottie animation setup
lottie.loadAnimation({
  container: document.querySelector(".lottie"),
  renderer: "svg",
  loop: true,
  autoplay: true,
  path: "./assets/idle3.json",
});

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

  if (currentInstructionStep === 2) {
    nextInstructionStep();
    setTimeout(() => {
      if (currentInstructionStep === 2) {
        nextInstructionStep();
      }
    }, 2000);
  }
});

// Function to send touch data via WebRTC
function sendTouchData(data) {
  if (isDrawingStarted) {
    if (peer && peer.connected) {
      peer.send(JSON.stringify(data));
      console.log("Sending touch data:", data);
    }
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
    objectMode: true,
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
    try {
      handlePeerData(data);
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
const handlePeerData = (data) => {
  try {
    const parsedData = JSON.parse(data);
    console.log("Received data:", parsedData);
    switch (parsedData.type) {
      case "faceFound":
        isFaceInFrame = true;
        noPeopleCameraSolved();
        if (currentInstructionStep === 0) {
          setTimeout(() => {
            if (isFaceInFrame) {
              nextInstructionStep();
            }
          }, 4000);
        }
        break;
      case "faceLost":
        isFaceInFrame = false;

        if (currentInstructionStep === 4) {
          noPeopleCamera();
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
