/**
 * js/scanner.js
 *
 * Main application controller for the
 * DIC Volunteer Check-In Kiosk.
 */

let SCANNER_sessionToken = "";
let SCANNER_sessionData = null;
let SCANNER_processing = false;
let SCANNER_mode = "checkin";


/* ============================================================
 * APPLICATION STARTUP
 * ============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  SCANNER_start
);


async function SCANNER_start() {
  UI_showLoading(
    "Verifying the coordinator session and event."
  );

  UI_renderHistory();

  SCANNER_bindControls();
  SCANNER_setMode("checkin");

  try {
    await API_healthCheck();

    UI_setConnectionStatus(
      "Service online",
      "online"
    );

  } catch (error) {
    UI_showSessionError(
      error &&
      error.message
        ? error.message
        : "The scanner service is unavailable."
    );

    return;
  }

  SCANNER_sessionToken =
    API_getScannerSessionFromUrl();

  if (!SCANNER_sessionToken) {
    UI_showSessionError(
      "This scanner link is missing its temporary session. Open the scanner from the Coordinator Portal."
    );

    return;
  }

  try {
    const result =
      await API_loadSession(
        SCANNER_sessionToken
      );

    if (
      !result ||
      !result.success
    ) {
      UI_showSessionError(
        result &&
        result.message
          ? result.message
          : "The scanner session could not be verified."
      );

      return;
    }

    SCANNER_sessionData =
      result;

    UI_renderEvent(
      result
    );

    UI_showScanner();

    UI_setConnectionStatus(
      "Connected",
      "online"
    );

    SCANNER_setMode(
      "checkin"
    );

  } catch (error) {
    UI_showSessionError(
      error &&
      error.message
        ? error.message
        : "Unable to load the scanner session."
    );
  }
}


/* ============================================================
 * CONTROL BINDINGS
 * ============================================================ */

function SCANNER_bindControls() {
  const startButton =
    document.getElementById(
      "startCameraButton"
    );

  const stopButton =
    document.getElementById(
      "stopCameraButton"
    );

  const manualButton =
    document.getElementById(
      "processManualButton"
    );

  const clearHistoryButton =
    document.getElementById(
      "clearHistoryButton"
    );

  const checkInModeButton =
    document.getElementById(
      "checkInModeButton"
    );

  const checkOutModeButton =
    document.getElementById(
      "checkOutModeButton"
    );

  if (startButton) {
    startButton.addEventListener(
      "click",
      SCANNER_startCamera
    );
  }

  if (stopButton) {
    stopButton.addEventListener(
      "click",
      function() {
        QR_stopCamera();
      }
    );
  }

  if (manualButton) {
    manualButton.addEventListener(
      "click",
      SCANNER_processManualValue
    );
  }

  if (clearHistoryButton) {
    clearHistoryButton.addEventListener(
      "click",
      UI_clearHistory
    );
  }

  if (checkInModeButton) {
    checkInModeButton.addEventListener(
      "click",
      function() {
        SCANNER_setMode(
          "checkin"
        );
      }
    );
  }

  if (checkOutModeButton) {
    checkOutModeButton.addEventListener(
      "click",
      function() {
        SCANNER_setMode(
          "checkout"
        );
      }
    );
  }
}


/* ============================================================
 * SCANNER MODE
 * ============================================================ */

function SCANNER_setMode(mode) {
  const normalizedMode =
    String(mode || "")
      .trim()
      .toLowerCase() === "checkout"
        ? "checkout"
        : "checkin";

  SCANNER_mode =
    normalizedMode;

  const checkInButton =
    document.getElementById(
      "checkInModeButton"
    );

  const checkOutButton =
    document.getElementById(
      "checkOutModeButton"
    );

  if (checkInButton) {
    checkInButton.classList.toggle(
      "active",
      normalizedMode === "checkin"
    );

    checkInButton.setAttribute(
      "aria-pressed",
      normalizedMode === "checkin"
        ? "true"
        : "false"
    );
  }

  if (checkOutButton) {
    checkOutButton.classList.toggle(
      "active",
      normalizedMode === "checkout"
    );

    checkOutButton.setAttribute(
      "aria-pressed",
      normalizedMode === "checkout"
        ? "true"
        : "false"
    );
  }

  document.body.classList.toggle(
    "scanner-mode-checkout",
    normalizedMode === "checkout"
  );

  UI_text(
    "scannerModeHelp",
    normalizedMode === "checkout"
      ? "Scan a checked-in volunteer QR code to record departure and actual hours."
      : "Scan a volunteer QR code to record arrival."
  );

  UI_renderResult(
    "neutral",
    normalizedMode === "checkout"
      ? "Ready for check-out"
      : "Waiting for a scan",
    normalizedMode === "checkout"
      ? "Start the camera or paste a QR value to check out a volunteer."
      : "Start the camera or paste a QR value to check in a volunteer.",
    []
  );
}


/* ============================================================
 * CAMERA
 * ============================================================ */

async function SCANNER_startCamera() {
  try {
    await QR_startCamera();

  } catch (error) {
    const message =
      error &&
      error.message
        ? error.message
        : "The camera could not be started.";

    UI_renderResult(
      "error",
      "Camera unavailable",
      message,
      []
    );

    UI_errorFeedback();
  }
}


/* ============================================================
 * MANUAL FALLBACK
 * ============================================================ */

async function SCANNER_processManualValue() {
  const input =
    document.getElementById(
      "manualQrValue"
    );

  const value =
    String(
      input
        ? input.value
        : ""
    ).trim();

  if (!value) {
    UI_renderResult(
      "error",
      "QR value required",
      SCANNER_mode === "checkout"
        ? "Paste a volunteer QR value or check-in URL to check out the volunteer."
        : "Paste a volunteer QR value or check-in URL to check in the volunteer.",
      []
    );

    UI_errorFeedback();

    return;
  }

  try {
    await QR_processManualValue(
      value
    );

    if (input) {
      input.value = "";
    }

  } catch (error) {
    UI_renderResult(
      "error",
      "Unable to process value",
      error &&
      error.message
        ? error.message
        : "The QR value could not be processed.",
      []
    );

    UI_errorFeedback();
  }
}


/* ============================================================
 * PROCESS QR
 * ============================================================ */

async function SCANNER_processQrValue(
  rawQrValue
) {
  if (SCANNER_processing) {
    return;
  }

  if (!SCANNER_sessionToken) {
    UI_showSessionError(
      "The scanner session is no longer available."
    );

    return;
  }

  const value =
    String(
      rawQrValue || ""
    ).trim();

  if (!value) {
    return;
  }

  SCANNER_processing = true;

  UI_renderResult(
    "neutral",
    SCANNER_mode === "checkout"
      ? "Processing check-out"
      : "Processing check-in",
    "Please wait while the volunteer assignment is verified.",
    []
  );

  try {
    const result =
      await API_processScan(
        SCANNER_sessionToken,
        value,
        SCANNER_mode
      );

    if (
      !result ||
      !result.success
    ) {
      SCANNER_handleFailedScan(
        result
      );

      return;
    }

    SCANNER_handleSuccessfulScan(
      result
    );

  } catch (error) {
    const message =
      error &&
      error.message
        ? error.message
        : "The scan could not be processed.";

    UI_renderResult(
      "error",
      "Scan failed",
      message,
      []
    );

    UI_addHistoryItem({
      type:
        "error",

      title:
        "Scan failed",

      message:
        message,

      meta: [
        SCANNER_mode === "checkout"
          ? "Check Out"
          : "Check In"
      ]
    });

    UI_errorFeedback();

  } finally {
    SCANNER_processing = false;
  }
}


/* ============================================================
 * SUCCESSFUL SCAN
 * ============================================================ */

function SCANNER_handleSuccessfulScan(
  result
) {
  const assignment =
    result.assignment || {};

  const title =
    assignment.fullName ||
    assignment.email ||
    "Volunteer";

  const isDuplicate =
    Boolean(
      result.duplicate
    );

  const isCheckout =
    SCANNER_mode === "checkout";

  const actualHours =
    Number(
      result.actualHours ||
      assignment.actualHours ||
      0
    );

  const meta = [
    isCheckout
      ? "Check Out"
      : "Check In",

    assignment.eventLabel,

    assignment.role,

    assignment.timeBlock,

    assignment.volunteerId
      ? "ID: " +
        assignment.volunteerId
      : "",

    isCheckout &&
    actualHours > 0
      ? "Hours: " +
        actualHours.toFixed(2)
      : ""
  ].filter(Boolean);

  const successMessage =
    result.message ||
    (
      isDuplicate
        ? (
            isCheckout
              ? "This volunteer is already checked out."
              : "This volunteer is already checked in."
          )
        : (
            isCheckout
              ? "Volunteer checked out successfully."
              : "Volunteer checked in successfully."
          )
    );

  UI_renderResult(
    isDuplicate
      ? "warning"
      : "success",

    title,

    successMessage,

    meta
  );

  UI_addHistoryItem({
    type:
      isDuplicate
        ? "warning"
        : "success",

    title:
      title,

    message:
      successMessage,

    meta:
      meta,

    timestamp:
      isCheckout
        ? (
            assignment.checkOutTimestamp ||
            new Date().toISOString()
          )
        : (
            assignment.checkInTimestamp ||
            new Date().toISOString()
          )
  });

  if (
    result.metrics &&
    typeof result.metrics.arrived !==
      "undefined"
  ) {
    UI_updateCheckedInCount(
      result.metrics.arrived
    );
  }

  if (isDuplicate) {
    UI_warningFeedback();
  } else {
    UI_successFeedback();
  }
}


/* ============================================================
 * FAILED SCAN
 * ============================================================ */

function SCANNER_handleFailedScan(
  result
) {
  const message =
    result &&
    result.message
      ? result.message
      : "The QR code could not be processed.";

  const code =
    result &&
    result.details &&
    result.details.code
      ? result.details.code
      : "";

  if (
    code ===
      "SCANNER_SESSION_EXPIRED" ||
    code ===
      "AUTH_REQUIRED"
  ) {
    QR_stopCamera();

    UI_showSessionError(
      message
    );

    return;
  }

  const assignment =
    result &&
    result.assignment
      ? result.assignment
      : (
          result &&
          result.details &&
          result.details.assignment
            ? result.details.assignment
            : {}
        );

  const meta = [
    SCANNER_mode === "checkout"
      ? "Check Out"
      : "Check In",

    assignment.eventLabel,

    assignment.role,

    assignment.timeBlock,

    assignment.volunteerId
      ? "ID: " +
        assignment.volunteerId
      : ""
  ].filter(Boolean);

  UI_renderResult(
    "error",
    assignment.fullName ||
      "Scan rejected",
    message,
    meta
  );

  UI_addHistoryItem({
    type:
      "error",

    title:
      assignment.fullName ||
      "Scan rejected",

    message:
      message,

    meta:
      meta
  });

  UI_errorFeedback();
}
