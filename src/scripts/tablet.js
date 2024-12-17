import lottie from "lottie-web";

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
    show: ["tools"],
    hide: ["instructions"],
  },
];

let selectedTool = "pencilBig";

const toolButtons = document.querySelectorAll(".tool");
toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    toolButtons.forEach((button) => {
      button.classList.remove("selected");
    });
    button.classList.add("selected");
    selectedTool = button.dataset.tool;
    console.log("Selected tool:", selectedTool);
  });
});

const renderInstructionStep = () => {
  instructionSteps.forEach((step, index) => {
    if (index === currentInstructionStep) {
      step.show.forEach((selector) => {
        document.querySelector(`.${selector}`).classList.remove("none");
      });
      step.hide.forEach((selector) => {
        document.querySelector(`.${selector}`).classList.add("none");
      });
    }
  });
};

const nextInstructionStep = () => {
  if (currentInstructionStep < instructionSteps.length - 1) {
    currentInstructionStep++;
    renderInstructionStep();
  }
};

const prevInstructionStep = () => {
  if (currentInstructionStep > 0) {
    currentInstructionStep--;
    renderInstructionStep();
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
};

const backToStart = () => {
  document.querySelector(".start").classList.remove("none");
  document.querySelector(".instructions").classList.add("none");
  document.querySelector(".navbar").classList.add("none");
  document.querySelector(".canvas_container").classList.add("none");
};

document.querySelector(".start--button").addEventListener("click", function () {
  startExperience();
});

//go to option page//
document
  .querySelector(".navbar--button__next")
  .addEventListener("click", function () {
    document.querySelector(".application").classList.add("none");
    document.querySelector(".option").classList.remove("none");
    document.querySelector(".navbar--button__undo").classList.add("none");
    document.querySelector(".navbar--button__next").classList.add("none");
    document
      .querySelector(".navbar--button__back-drawing")
      .classList.remove("none");
    document
      .querySelector(".navbar--button__empty-right")
      .classList.remove("none");
  });

//go to delete page//
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

//delete page to options//
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

//go to save page//
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

//save page to options//
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

//option page to application//
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
  });

//to final page//
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
    });
  });

//final page to start//
document.querySelector(".final--text").addEventListener("click", function () {
  document.querySelector(".final__page").classList.add("none");
  document.querySelector(".start").classList.remove("none");
  document.querySelector(".navbar").classList.add("none");
  document.querySelector(".nav__title").classList.add("none");
});

//tool logic//
document.querySelectorAll(".deselected, .selected").forEach(function (element) {
  element.addEventListener("click", function () {
    document.querySelectorAll(".selected").forEach(function (selectedElement) {
      selectedElement.classList.remove("selected");
    });
    element.classList.add("selected");
  });
});

//lottie animation//
lottie.loadAnimation({
  container: document.querySelector(".lottie"),
  renderer: "svg",
  loop: true,
  autoplay: true,
  path: "./assets/idle3.json",
});
