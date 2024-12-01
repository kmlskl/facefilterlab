const videoElement = document.querySelector("#video");
const startCameraButton = document.querySelector("#start-camera");

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    videoElement.srcObject = stream;

    alert(
      "Camera started successfully! You can now see yourself on the screen."
    );
  } catch (error) {
    alert(
      "We couldn't access your camera. Please check your permissions and try again."
    );
    console.error("Camera error:", error);
  }
}

startCameraButton.addEventListener("click", startCamera);
