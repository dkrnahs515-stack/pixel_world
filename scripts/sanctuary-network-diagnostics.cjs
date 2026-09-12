const FIREBASE_DATABASE_NAMESPACE = "pixel-world-8cb9b-default-rtdb";

function isExpectedReconnectLongPollAbort(url, errorText) {
  if (errorText !== "net::ERR_ABORTED") return false;
  try {
    const endpoint = new URL(url);
    return endpoint.protocol === "http:"
      && endpoint.hostname === "127.0.0.1"
      && endpoint.port === "9000"
      && endpoint.pathname === "/.lp"
      && endpoint.searchParams.get("ns") === FIREBASE_DATABASE_NAMESPACE;
  } catch {
    return false;
  }
}

function getReconnectWindowDiagnostics(diagnostics, window) {
  return {
    pageErrors: diagnostics.pageErrors.slice(window.pageStart, window.pageEnd),
    consoleErrors: diagnostics.consoleErrors.slice(window.consoleStart, window.consoleEnd),
    consoleErrorDetails: diagnostics.consoleErrorDetails.slice(window.consoleStart, window.consoleEnd),
    requestFailures: diagnostics.requestFailures.slice(window.requestStart, window.requestEnd),
  };
}

function getPostReconnectDiagnostics(diagnostics, window) {
  return {
    pageErrors: diagnostics.pageErrors.slice(window.pageEnd),
    consoleErrors: diagnostics.consoleErrors.slice(window.consoleEnd),
    consoleErrorDetails: diagnostics.consoleErrorDetails.slice(window.consoleEnd),
    requestFailures: diagnostics.requestFailures.slice(window.requestEnd),
  };
}

module.exports = {
  FIREBASE_DATABASE_NAMESPACE,
  getPostReconnectDiagnostics,
  getReconnectWindowDiagnostics,
  isExpectedReconnectLongPollAbort,
};
