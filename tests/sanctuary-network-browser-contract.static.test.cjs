const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

let isExpectedReconnectLongPollAbort;
try {
  ({ isExpectedReconnectLongPollAbort } = require("../scripts/sanctuary-network-diagnostics.cjs"));
} catch {
  isExpectedReconnectLongPollAbort = undefined;
}

const smoke = readFileSync(path.join(__dirname, "sanctuary-network-browser-smoke.cjs"), "utf8");
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
