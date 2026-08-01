/**
 * js/api.js
 *
 * Communication between the GitHub scanner
 * and the Cloudflare Worker.
 */

const DIC_SCANNER_API_URL =
  "https://dic-scanner-api.jolly-meadow-2d7f.workers.dev/api";


function API_getScannerSessionFromUrl() {
  const parameters =
    new URLSearchParams(
      window.location.search
    );

  return String(
    parameters.get("session") || ""
  ).trim();
}


async function API_request(
  payload
) {
  const response =
    await fetch(
      DIC_SCANNER_API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

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
  return API_request({
    action:
      "session",

    scannerSession:
      scannerSession
  });
}


async function API_processScan(
  scannerSession,
  rawQrValue
) {
  return API_request({
    action:
      "scan",

    scannerSession:
      scannerSession,

    rawQrValue:
      rawQrValue
  });
}


async function API_healthCheck() {
  const response =
    await fetch(
      "https://dic-scanner-api.jolly-meadow-2d7f.workers.dev/health",
      {
        method: "GET",
        cache: "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      "The scanner service is offline."
    );
  }

  return response.json();
}
