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

module.exports = {
  FIREBASE_DATABASE_NAMESPACE,
  isExpectedReconnectLongPollAbort,
};
