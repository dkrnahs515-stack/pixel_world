const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

let getPostReconnectDiagnostics;
let getReconnectWindowDiagnostics;
let isExpectedReconnectLongPollAbort;
try {
  ({
    getPostReconnectDiagnostics,
    getReconnectWindowDiagnostics,
    isExpectedReconnectLongPollAbort,
  } = require("../scripts/sanctuary-network-diagnostics.cjs"));
} catch {
  getPostReconnectDiagnostics = undefined;
  getReconnectWindowDiagnostics = undefined;
  isExpectedReconnectLongPollAbort = undefined;
}

const smoke = readFileSync(path.join(__dirname, "sanctuary-network-browser-smoke.cjs"), "utf8");
const diagnosticsSource = readFileSync(
  path.join(__dirname, "../scripts/sanctuary-network-diagnostics.cjs"),
  "utf8",
);
const exactLongPoll = "http://127.0.0.1:9000/.lp?start=t&ser=1&cb=2&v=5&ns=pixel-world-8cb9b-default-rtdb";

test("only an exact local RTDB reconnect long-poll cancellation is classified as expected", () => {
  assert.equal(typeof isExpectedReconnectLongPollAbort, "function");
  assert.equal(isExpectedReconnectLongPollAbort(exactLongPoll, "net::ERR_ABORTED"), true);
  assert.equal(isExpectedReconnectLongPollAbort(exactLongPoll, "net::ERR_INTERNET_DISCONNECTED"), false);
  assert.equal(isExpectedReconnectLongPollAbort(exactLongPoll.replace("/.lp", "/.ws"), "net::ERR_ABORTED"), false);
  assert.equal(isExpectedReconnectLongPollAbort(exactLongPoll.replace(
    "pixel-world-8cb9b-default-rtdb",
    "wrong-namespace",
  ), "net::ERR_ABORTED"), false);
  assert.equal(isExpectedReconnectLongPollAbort(exactLongPoll.replace(
    "http://127.0.0.1:9000",
    "https://pixel-world-8cb9b-default-rtdb.firebaseio.com",
  ), "net::ERR_ABORTED"), false);
});

test("the same exact long-poll abort after reconnect recovery stays in the rejected suffix", () => {
  assert.equal(typeof getReconnectWindowDiagnostics, "function");
  assert.equal(typeof getPostReconnectDiagnostics, "function");
  const consoleEntry = {
    text: "Failed to load resource: net::ERR_ABORTED",
    location: { url: exactLongPoll },
  };
  const requestEntry = { url: exactLongPoll, errorText: "net::ERR_ABORTED" };
  const diagnostics = {
    pageErrors: [],
    consoleErrors: [consoleEntry.text, consoleEntry.text],
    consoleErrorDetails: [consoleEntry, structuredClone(consoleEntry)],
    requestFailures: [requestEntry, structuredClone(requestEntry)],
  };
  const window = {
    pageStart: 0,
    pageEnd: 0,
    consoleStart: 0,
    consoleEnd: 1,
    requestStart: 0,
    requestEnd: 1,
  };

  assert.deepEqual(getReconnectWindowDiagnostics(diagnostics, window), {
    pageErrors: [],
    consoleErrors: [consoleEntry.text],
    consoleErrorDetails: [consoleEntry],
    requestFailures: [requestEntry],
  });
  const after = getPostReconnectDiagnostics(diagnostics, window);
  assert.deepEqual(after, {
    pageErrors: [],
    consoleErrors: [consoleEntry.text],
    consoleErrorDetails: [consoleEntry],
    requestFailures: [requestEntry],
  });
  assert.equal(isExpectedReconnectLongPollAbort(
    after.requestFailures[0].url,
    after.requestFailures[0].errorText,
  ), true, "the suffix entry is exact but must still be rejected because it is late");
  assert.throws(
    () => assert.deepEqual(after.requestFailures, []),
    "an exact reconnect cancellation outside the bounded window must fail the suffix assertion",
  );
});

test("network smoke observes canonical automatic reform before reconnecting the offline player", () => {
  assert.match(smoke, /const oldEncounterId = firebaseState\.encounterId/);
  assert.match(smoke, /assert\.equal\(firebaseState\.reformAt, firebaseState\.separatedAt \+ 30_000\)/);
  assert.match(smoke, /waitForFirebaseReform\(reader, oldEncounterId, firebaseState\.reformAt\)/);
  assert.match(smoke, /assert\.notEqual\(reformedState\.encounterId, oldEncounterId\)/);
  assert.match(smoke, /assert\.deepEqual\(Object\.keys\(reformedState\.contributors \|\| \{\}\), \[\]\)/);
  assert.match(smoke, /completionClaims\/\$\{oldEncounterId\}/);
  assert.match(smoke, /completionInbox\/\$\{uidA\}/);
  assert.match(smoke, /completionInbox\/\$\{uidB\}/);
  assert.ok(smoke.indexOf("waitForFirebaseReform(reader, oldEncounterId, firebaseState.reformAt)")
    < smoke.indexOf("await contextA.setOffline(false)"));
});

test("network smoke bounds reconnect churn and rejects every diagnostic after claim recovery", () => {
  assert.match(smoke, /getReconnectWindowDiagnostics\(diagnostics, window\)/);
  assert.match(diagnosticsSource, /slice\(window\.consoleStart, window\.consoleEnd\)/);
  assert.match(diagnosticsSource, /slice\(window\.requestStart, window\.requestEnd\)/);
  assert.doesNotMatch(diagnosticsSource, /slice\(window\.consoleStart\)/);
  assert.doesNotMatch(diagnosticsSource, /slice\(window\.requestStart\)/);
  assert.match(smoke, /const postReconnectDiagnostics = getPostReconnectDiagnostics/);
  assert.match(smoke, /assert\.deepEqual\(postReconnectDiagnostics\.pageErrors, \[\]/);
  assert.match(smoke, /assert\.deepEqual\(postReconnectDiagnostics\.consoleErrors, \[\]/);
  assert.match(smoke, /assert\.deepEqual\(postReconnectDiagnostics\.requestFailures, \[\]/);
  assert.ok(smoke.indexOf("reconnectDiagnosticWindowA.consoleEnd = diagnosticsA.consoleErrors.length")
    < smoke.indexOf('console.log("[sanctuary-network] isolated endings")'));
});
