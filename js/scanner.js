/**
 * js/scanner.js
 *
 * Main application controller for the
 * DIC Volunteer Check-In Kiosk.
 */

let SCANNER_sessionToken = "";
let SCANNER_sessionData = null;
let SCANNER_processing = false;


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

    UI_renderResult(
      "neutral",
      "Waiting for a scan",
      "Start the camera or paste a QR value to check in a volunteer.",
      []
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
      "Paste a volunteer QR value or check-in URL first.",
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

  UI_renderProcessingResult();

  try {
    const result =
      await API_processScan(
        SCANNER_sessionToken,
        value
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

      meta:
        []
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

  const meta = [
    assignment.eventLabel,
    assignment.role,
    assignment.timeBlock,
    assignment.volunteerId
      ? "ID: " +
        assignment.volunteerId
      : ""
  ].filter(Boolean);

  const isDuplicate =
    Boolean(
      result.duplicate
    );

  UI_renderResult(
    isDuplicate
      ? "warning"
      : "success",

    title,

    result.message ||
      (
        isDuplicate
          ? "This volunteer is already checked in."
          : "Volunteer checked in successfully."
      ),

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
      result.message ||
      (
        isDuplicate
          ? "Already checked in."
          : "Attendance recorded."
      ),

    meta:
      meta,

    timestamp:
      assignment.checkInTimestamp ||
      new Date().toISOString()
  });

  if (isDuplicate) {
    UI_warningFeedback();

  } else {
    UI_successFeedback();

    const currentCount =
      Number(
        document
          .getElementById(
            "checkedInCount"
          )
          ?.textContent ||
        0
      );

    UI_updateCheckedInCount(
      currentCount + 1
    );
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
