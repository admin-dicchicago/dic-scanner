/**
 * js/ui.js
 *
 * User-interface helpers for the
 * DIC Volunteer Check-In Kiosk.
 */

const UI_HISTORY_KEY =
  "dicScannerRecentHistory";

const UI_MAX_HISTORY_ITEMS = 20;


/* ============================================================
 * GENERAL ELEMENT HELPERS
 * ============================================================ */

function UI_element(id) {
  return document.getElementById(id);
}


function UI_text(id, value) {
  const element = UI_element(id);

  if (!element) {
    return;
  }

  element.textContent =
    value === null ||
    typeof value === "undefined"
      ? ""
      : String(value);
}


function UI_show(id) {
  const element = UI_element(id);

  if (element) {
    element.classList.remove("hidden");
  }
}


function UI_hide(id) {
  const element = UI_element(id);

  if (element) {
    element.classList.add("hidden");
  }
}


/* ============================================================
 * APPLICATION STATES
 * ============================================================ */

function UI_showLoading(message) {
  UI_show("loadingState");
  UI_hide("scannerApp");
  UI_hide("sessionError");

  if (message) {
    const loadingText =
      UI_element("loadingState")
        ?.querySelector("p");

    if (loadingText) {
      loadingText.textContent = message;
    }
  }

  UI_setConnectionStatus(
    "Connecting...",
    "neutral"
  );
}


function UI_showScanner() {
  UI_hide("loadingState");
  UI_hide("sessionError");
  UI_show("scannerApp");
}


function UI_showSessionError(message) {
  UI_hide("loadingState");
  UI_hide("scannerApp");
  UI_show("sessionError");

  UI_text(
    "sessionErrorMessage",
    message ||
      "Open the scanner again from the Coordinator Portal."
  );

  UI_setConnectionStatus(
    "Unavailable",
    "error"
  );
}


/* ============================================================
 * CONNECTION STATUS
 * ============================================================ */

function UI_setConnectionStatus(
  message,
  type
) {
  const element =
    UI_element("connectionStatus");

  if (!element) {
    return;
  }

  element.textContent =
    message || "";

  element.className =
    "connection-status " +
    "connection-status-" +
    (type || "neutral");
}


/* ============================================================
 * EVENT INFORMATION
 * ============================================================ */

function UI_renderEvent(
  sessionData
) {
  const event =
    sessionData &&
    sessionData.event
      ? sessionData.event
      : {};

  const metrics =
    sessionData &&
    sessionData.metrics
      ? sessionData.metrics
      : {};

  UI_text(
    "eventTitle",
    event.eventLabel ||
      "Volunteer Event"
  );

  UI_text(
    "eventMeta",
    [
      UI_formatDate(
        event.eventDate
      ),
      event.role,
      event.timeBlock,
      event.area,
      event.lead
        ? "Lead: " + event.lead
        : ""
    ]
      .filter(Boolean)
      .join(" • ")
  );

  UI_text(
    "checkedInCount",
    Number(metrics.arrived || 0)
  );
}


function UI_updateCheckedInCount(
  value
) {
  UI_text(
    "checkedInCount",
    Number(value || 0)
  );
}


/* ============================================================
 * CAMERA STATUS
 * ============================================================ */

function UI_setCameraStatus(
  message,
  type
) {
  const element =
    UI_element("cameraStatus");

  if (!element) {
    return;
  }

  element.textContent =
    message || "";

  element.className =
    "status-pill " +
    "status-pill-" +
    (type || "neutral");
}


function UI_setCameraButtons(
  running
) {
  const startButton =
    UI_element(
      "startCameraButton"
    );

  const stopButton =
    UI_element(
      "stopCameraButton"
    );

  if (startButton) {
    startButton.disabled =
      Boolean(running);
  }

  if (stopButton) {
    stopButton.disabled =
      !running;
  }
}


function UI_setCameraPlaceholder(
  visible
) {
  const placeholder =
    UI_element(
      "cameraPlaceholder"
    );

  if (!placeholder) {
    return;
  }

  placeholder.classList.toggle(
    "hidden",
    !visible
  );
}


/* ============================================================
 * SCAN RESULT
 * ============================================================ */

function UI_renderResult(
  type,
  title,
  message,
  meta
) {
  const resultCard =
    UI_element("scanResult");

  if (!resultCard) {
    return;
  }

  const normalizedType =
    [
      "success",
      "warning",
      "error",
      "neutral"
    ].includes(type)
      ? type
      : "neutral";

  resultCard.className =
    "result-card result-" +
    normalizedType;

  UI_text(
    "resultIcon",
    normalizedType === "success"
      ? "✓"
      : normalizedType === "warning"
        ? "!"
        : normalizedType === "error"
          ? "×"
          : "QR"
  );

  UI_text(
    "resultEyebrow",
    normalizedType === "success"
      ? "Attendance recorded"
      : normalizedType === "warning"
        ? "Already processed"
        : normalizedType === "error"
          ? "Unable to check in"
          : "Scanner"
  );

  UI_text(
    "resultTitle",
    title || "Scan result"
  );

  UI_text(
    "resultMessage",
    message || ""
  );

  const metaContainer =
    UI_element("resultMeta");

  if (!metaContainer) {
    return;
  }

  metaContainer.innerHTML = "";

  (meta || [])
    .filter(Boolean)
    .forEach(function(value) {
      const item =
        document.createElement(
          "span"
        );

      item.textContent =
        String(value);

      metaContainer.appendChild(
        item
      );
    });
}


function UI_renderProcessingResult() {
  UI_renderResult(
    "neutral",
    "Processing scan",
    "Please wait while the volunteer assignment is verified.",
    []
  );
}


/* ============================================================
 * RECENT SCAN HISTORY
 * ============================================================ */

function UI_loadHistory() {
  try {
    const saved =
      localStorage.getItem(
        UI_HISTORY_KEY
      );

    const parsed =
      saved
        ? JSON.parse(saved)
        : [];

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {
    return [];
  }
}


function UI_saveHistory(history) {
  try {
    localStorage.setItem(
      UI_HISTORY_KEY,
      JSON.stringify(
        history || []
      )
    );
  } catch (error) {
    console.warn(
      "Unable to save scan history:",
      error
    );
  }
}


function UI_addHistoryItem(
  item
) {
  const history =
    UI_loadHistory();

  history.unshift({
    id:
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2),

    type:
      item.type || "neutral",

    title:
      item.title ||
      "Scan result",

    message:
      item.message || "",

    meta:
      Array.isArray(item.meta)
        ? item.meta
        : [],

    timestamp:
      item.timestamp ||
      new Date().toISOString()
  });

  const trimmed =
    history.slice(
      0,
      UI_MAX_HISTORY_ITEMS
    );

  UI_saveHistory(trimmed);
  UI_renderHistory(trimmed);
}


function UI_clearHistory() {
  localStorage.removeItem(
    UI_HISTORY_KEY
  );

  UI_renderHistory([]);
}


function UI_renderHistory(
  suppliedHistory
) {
  const container =
    UI_element("scanHistory");

  const emptyState =
    UI_element(
      "scanHistoryEmpty"
    );

  if (!container) {
    return;
  }

  const history =
    Array.isArray(
      suppliedHistory
    )
      ? suppliedHistory
      : UI_loadHistory();

  container.innerHTML = "";

  if (!history.length) {
    if (emptyState) {
      emptyState.classList.remove(
        "hidden"
      );
    }

    return;
  }

  if (emptyState) {
    emptyState.classList.add(
      "hidden"
    );
  }

  history.forEach(
    function(item) {
      container.appendChild(
        UI_createHistoryRow(item)
      );
    }
  );
}


function UI_createHistoryRow(
  item
) {
  const row =
    document.createElement(
      "article"
    );

  const type =
    [
      "success",
      "warning",
      "error",
      "neutral"
    ].includes(item.type)
      ? item.type
      : "neutral";

  row.className =
    "history-row history-row-" +
    type;

  const icon =
    document.createElement(
      "div"
    );

  icon.className =
    "history-icon";

  icon.textContent =
    type === "success"
      ? "✓"
      : type === "warning"
        ? "!"
        : type === "error"
          ? "×"
          : "QR";

  const body =
    document.createElement(
      "div"
    );

  body.className =
    "history-body";

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    item.title ||
    "Scan result";

  const message =
    document.createElement(
      "p"
    );

  message.textContent =
    item.message || "";

  const meta =
    document.createElement(
      "div"
    );

  meta.className =
    "history-meta";

  (item.meta || [])
    .filter(Boolean)
    .forEach(function(value) {
      const span =
        document.createElement(
          "span"
        );

      span.textContent =
        String(value);

      meta.appendChild(span);
    });

  body.appendChild(title);

  if (item.message) {
    body.appendChild(message);
  }

  if (meta.children.length) {
    body.appendChild(meta);
  }

  const time =
    document.createElement(
      "time"
    );

  time.className =
    "history-time";

  time.dateTime =
    item.timestamp || "";

  time.textContent =
    UI_formatTime(
      item.timestamp
    );

  row.appendChild(icon);
  row.appendChild(body);
  row.appendChild(time);

  return row;
}


/* ============================================================
 * FEEDBACK
 * ============================================================ */

function UI_successFeedback() {
  if (
    navigator.vibrate
  ) {
    navigator.vibrate(120);
  }

  UI_playTone(
    880,
    0.12
  );
}


function UI_warningFeedback() {
  if (
    navigator.vibrate
  ) {
    navigator.vibrate([
      80,
      70,
      80
    ]);
  }

  UI_playTone(
    540,
    0.15
  );
}


function UI_errorFeedback() {
  if (
    navigator.vibrate
  ) {
    navigator.vibrate([
      160,
      80,
      160
    ]);
  }

  UI_playTone(
    220,
    0.22
  );
}


function UI_playTone(
  frequency,
  duration
) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const context =
      new AudioContextClass();

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.type =
      "sine";

    oscillator.frequency.value =
      Number(frequency || 440);

    gain.gain.setValueAtTime(
      0.08,
      context.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime +
        Number(duration || 0.15)
    );

    oscillator.connect(gain);
    gain.connect(
      context.destination
    );

    oscillator.start();

    oscillator.stop(
      context.currentTime +
        Number(duration || 0.15)
    );

  } catch (error) {
    // Sound feedback is optional.
  }
}


/* ============================================================
 * FORMATTING
 * ============================================================ */

function UI_formatDate(value) {
  if (!value) {
    return "";
  }

  const match =
    String(value).match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  const date =
    match
      ? new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3])
        )
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleDateString(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );
}


function UI_formatTime(value) {
  const date =
    value
      ? new Date(value)
      : new Date();

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    }
  );
}
