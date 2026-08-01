/**
 * js/api.js
 *
 * Communication between the GitHub scanner
 * and the Cloudflare Worker.
 */

const DIC_SCANNER_API_BASE_URL =
  "https://dic-scanner-api.jolly-meadow-2d7f.workers.dev";

const DIC_SCANNER_API_URL =
  DIC_SCANNER_API_BASE_URL + "/api";

const DIC_SCANNER_HEALTH_URL =
  DIC_SCANNER_API_BASE_URL + "/health";


function API_getScannerSessionFromUrl() {
  const parameters =
    new URLSearchParams(
      window.location.search
    );

  return String(
    parameters.get("session") || ""
  ).trim();
}


function API_normalizeMode(mode) {
  return String(
    mode || "checkin"
  )
    .trim()
    .toLowerCase() === "checkout"
      ? "checkout"
      : "checkin";
}


async function API_request(payload) {
  let response;

  try {
    response =
      await fetch(
        DIC_SCANNER_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          cache:
            "no-store",

          body:
            JSON.stringify(
              payload || {}
            )
        }
      );

  } catch (error) {
    throw new Error(
      "Unable to connect to the scanner service. Check your internet connection and try again."
    );
  }

  let result;

  try {
    result =
      await response.json();

  } catch (error) {
    throw new Error(
      "The scanner service returned an invalid response."
    );
  }

  if (!response.ok) {
    throw new Error(
      result &&
      result.message
        ? result.message
        : "The scanner service could not complete the request."
    );
  }

  return result;
}


async function API_loadSession(
  scannerSession
) {
  const normalizedSession =
    String(
      scannerSession || ""
    ).trim();

  if (!normalizedSession) {
    throw new Error(
      "The scanner session is missing."
    );
  }

  return API_request({
    action:
      "session",

    scannerSession:
      normalizedSession
  });
}


async function API_processScan(
  scannerSession,
  rawQrValue,
  mode
) {
  const normalizedSession =
    String(
      scannerSession || ""
    ).trim();

  const normalizedValue =
    String(
      rawQrValue || ""
    ).trim();

  if (!normalizedSession) {
    throw new Error(
      "The scanner session is missing."
    );
  }

  if (!normalizedValue) {
    throw new Error(
      "The QR value is empty."
    );
  }

  return API_request({
    action:
      "scan",

    scannerSession:
      normalizedSession,

    rawQrValue:
      normalizedValue,

    mode:
      API_normalizeMode(
        mode
      )
  });
}


async function API_healthCheck() {
  let response;

  try {
    response =
      await fetch(
        DIC_SCANNER_HEALTH_URL,
        {
          method:
            "GET",

          cache:
            "no-store"
        }
      );

  } catch (error) {
    throw new Error(
      "The scanner service is offline."
    );
  }

  if (!response.ok) {
    throw new Error(
      "The scanner service is offline."
    );
  }

  let result;

  try {
    result =
      await response.json();

  } catch (error) {
    throw new Error(
      "The scanner health service returned an invalid response."
    );
  }

  if (
    !result ||
    result.success !== true
  ) {
    throw new Error(
      result &&
      result.message
        ? result.message
        : "The scanner service is unavailable."
    );
  }

  return result;
}
