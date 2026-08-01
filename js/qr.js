/**
 * js/qr.js
 *
 * Camera and QR decoding engine for the
 * DIC Volunteer Check-In Kiosk.
 */

let QR_stream = null;
let QR_animationFrame = null;
let QR_running = false;
let QR_processing = false;

let QR_lastValue = "";
let QR_lastDetectedAt = 0;

const QR_REPEAT_BLOCK_MS = 5000;


/* ============================================================
 * CAMERA SUPPORT
 * ============================================================ */

function QR_isSupported() {
  return Boolean(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof window.jsQR === "function"
  );
}


/* ============================================================
 * START CAMERA
 * ============================================================ */

async function QR_startCamera() {
  if (QR_running) {
    return {
      success: true,
      alreadyRunning: true
    };
  }

  if (!QR_isSupported()) {
    throw new Error(
      "Camera scanning is not supported in this browser."
    );
  }

  const video =
    document.getElementById(
      "cameraVideo"
    );

  if (!video) {
    throw new Error(
      "Camera video element was not found."
    );
  }

  UI_setCameraStatus(
    "Starting camera...",
    "processing"
  );

  UI_setCameraButtons(true);

  try {
    QR_stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment"
          },

          width: {
            ideal: 1280
          },

          height: {
            ideal: 720
          }
        },

        audio: false
      });

    video.srcObject =
      QR_stream;

    await video.play();

    QR_running = true;
    QR_processing = false;

    UI_setCameraPlaceholder(false);

    UI_setCameraStatus(
      "Scanning",
      "active"
    );

    UI_setCameraButtons(true);

    QR_scanLoop();

    return {
      success: true
    };

  } catch (error) {
    QR_stopCamera();

    const message =
      QR_cameraErrorMessage(error);

    UI_setCameraStatus(
      "Camera unavailable",
      "error"
    );

    throw new Error(message);
  }
}


/* ============================================================
 * STOP CAMERA
 * ============================================================ */

function QR_stopCamera() {
  QR_running = false;
  QR_processing = false;

  if (QR_animationFrame) {
    cancelAnimationFrame(
      QR_animationFrame
    );

    QR_animationFrame = null;
  }

  if (QR_stream) {
    QR_stream
      .getTracks()
      .forEach(function(track) {
        track.stop();
      });

    QR_stream = null;
  }

  const video =
    document.getElementById(
      "cameraVideo"
    );

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  UI_setCameraPlaceholder(true);

  UI_setCameraStatus(
    "Camera stopped",
    "neutral"
  );

  UI_setCameraButtons(false);
}


/* ============================================================
 * SCAN LOOP
 * ============================================================ */

function QR_scanLoop() {
  if (!QR_running) {
    return;
  }

  const video =
    document.getElementById(
      "cameraVideo"
    );

  const canvas =
    document.getElementById(
      "cameraCanvas"
    );

  if (
    !video ||
    !canvas
  ) {
    QR_animationFrame =
      requestAnimationFrame(
        QR_scanLoop
      );

    return;
  }

  if (
    video.readyState >=
      HTMLMediaElement.HAVE_ENOUGH_DATA &&
    !QR_processing
  ) {
    QR_decodeVideoFrame(
      video,
      canvas
    );
  }

  QR_animationFrame =
    requestAnimationFrame(
      QR_scanLoop
    );
}


/* ============================================================
 * DECODE ONE VIDEO FRAME
 * ============================================================ */

function QR_decodeVideoFrame(
  video,
  canvas
) {
  const width =
    Number(
      video.videoWidth || 0
    );

  const height =
    Number(
      video.videoHeight || 0
    );

  if (
    !width ||
    !height
  ) {
    return;
  }

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );

  if (!context) {
    return;
  }

  context.drawImage(
    video,
    0,
    0,
    width,
    height
  );

  const imageData =
    context.getImageData(
      0,
      0,
      width,
      height
    );

  const code =
    window.jsQR(
      imageData.data,
      width,
      height,
      {
        inversionAttempts:
          "attemptBoth"
      }
    );

  if (
    !code ||
    !code.data
  ) {
    return;
  }

  const rawValue =
    String(
      code.data || ""
    ).trim();

  if (!rawValue) {
    return;
  }

  QR_handleDetectedValue(
    rawValue
  );
}


/* ============================================================
 * PROCESS DETECTED QR VALUE
 * ============================================================ */

function QR_handleDetectedValue(
  rawValue
) {
  const now =
    Date.now();

  const repeatedTooSoon =
    rawValue === QR_lastValue &&
    now - QR_lastDetectedAt <
      QR_REPEAT_BLOCK_MS;

  if (repeatedTooSoon) {
    return;
  }

  QR_lastValue =
    rawValue;

  QR_lastDetectedAt =
    now;

  QR_processing = true;

  UI_setCameraStatus(
    "Processing...",
    "processing"
  );

  if (
    typeof SCANNER_processQrValue ===
      "function"
  ) {
    Promise.resolve(
      SCANNER_processQrValue(
        rawValue
      )
    )
      .catch(function(error) {
        console.error(
          "Unable to process QR value:",
          error
        );
      })
      .finally(function() {
        QR_processing = false;

        if (QR_running) {
          UI_setCameraStatus(
            "Scanning",
            "active"
          );
        }
      });

    return;
  }

  QR_processing = false;

  console.error(
    "SCANNER_processQrValue() is not available."
  );
}


/* ============================================================
 * MANUAL VALUE
 * ============================================================ */

function QR_processManualValue(
  rawValue
) {
  const value =
    String(
      rawValue || ""
    ).trim();

  if (!value) {
    throw new Error(
      "Paste a QR value or check-in URL first."
    );
  }

  if (
    typeof SCANNER_processQrValue !==
      "function"
  ) {
    throw new Error(
      "The scanner controller is not available."
    );
  }

  return SCANNER_processQrValue(
    value
  );
}


/* ============================================================
 * CAMERA ERROR MESSAGES
 * ============================================================ */

function QR_cameraErrorMessage(
  error
) {
  const name =
    error &&
    error.name
      ? String(error.name)
      : "";

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError"
  ) {
    return (
      "Camera access was denied. " +
      "Allow camera access for this site and try again."
    );
  }

  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError"
  ) {
    return (
      "No camera was found on this device."
    );
  }

  if (
    name === "NotReadableError" ||
    name === "TrackStartError"
  ) {
    return (
      "The camera is being used by another application. " +
      "Close the other application and try again."
    );
  }

  if (
    name === "OverconstrainedError" ||
    name === "ConstraintNotSatisfiedError"
  ) {
    return (
      "The selected camera does not support the requested settings."
    );
  }

  if (
    name === "SecurityError"
  ) {
    return (
      "Camera access is blocked by the browser security settings."
    );
  }

  return (
    error &&
    error.message
      ? error.message
      : "The camera could not be started."
  );
}


/* ============================================================
 * PAGE CLEANUP
 * ============================================================ */

window.addEventListener(
  "beforeunload",
  function() {
    QR_stopCamera();
  }
);

document.addEventListener(
  "visibilitychange",
  function() {
    if (
      document.hidden &&
      QR_running
    ) {
      QR_stopCamera();
    }
  }
);
