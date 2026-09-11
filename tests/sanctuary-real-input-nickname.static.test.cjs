const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createQaNickname,
  runQaJourney,
} = require("./helpers/sanctuary-real-input-nickname.cjs");

test("QA nickname allocation stays unique for repeated same-millisecond journeys", () => {
  const timestamp = 1_700_000_000_000;
  const names = [
    createQaNickname("real-warrior", timestamp),
    createQaNickname("real-warrior", timestamp),
    createQaNickname("real-archer", timestamp),
    createQaNickname("real-mage", timestamp),
    createQaNickname("online-a", timestamp),
    createQaNickname("online-b", timestamp),
  ];

  assert.equal(new Set(names).size, names.length, "repeated same-millisecond QA journeys need distinct checkpoint keys");
  for (const name of names) {
    assert.ok(name.length >= 1 && name.length <= 12, `${name} must be valid for the entry form`);
    assert.match(name, /^[A-Za-z0-9 ]+$/, `${name} must use entry-valid characters`);
  }
});

test("QA journey checkpoints, enters, and travels exactly once with one allocated nickname", async () => {
  const calls = [];
  const allocatedName = await runQaJourney({
    page: { id: "browser-page" },
    journey: "real-warrior",
    timestamp: 1_700_000_000_000,
    classId: "warrior",
    full: true,
    mapId: "sanctuary-resonance-hall",
    prepareCheckpoint: async (page, name, classId, full) => calls.push({ step: "checkpoint", page, name, classId, full }),
    enter: async (page, name, classId) => calls.push({ step: "entry", page, name, classId }),
    qaTravel: async (page, mapId) => calls.push({ step: "travel", page, mapId }),
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(call => call.step), ["checkpoint", "entry", "travel"]);
  assert.equal(calls[0].name, allocatedName, "checkpoint storage must use the allocated entry name");
  assert.equal(calls[1].name, allocatedName, "UI entry must use the allocated checkpoint name");
  assert.equal(calls[0].page, calls[1].page);
  assert.equal(calls[0].classId, calls[1].classId);
  assert.equal(calls[0].full, true);
  assert.equal(calls[2].page, calls[0].page);
  assert.equal(calls[2].mapId, "sanctuary-resonance-hall");
});

test("actual checkpoint boundary performs setup only before entry and QA travel", async () => {
  const { prepareSanctuaryCheckpoint } = require("./helpers/sanctuary-real-input-session.cjs");
  const calls = [];
  const page = {
    goto: async (...args) => calls.push({ step: "goto", args }),
    locator: selector => ({ waitFor: async (...args) => calls.push({ step: "entry-ready", selector, args }) }),
    evaluate: async (callback, checkpoint) => calls.push({ step: "save", callback, checkpoint }),
  };

  await prepareSanctuaryCheckpoint({
    page,
    baseUrl: "http://127.0.0.1:4173",
    online: true,
    name: "RWmtvbd970",
    classId: "warrior",
    full: false,
    expose: async receivedPage => calls.push({ step: "expose", receivedPage }),
  });

  assert.deepEqual(calls.map(call => call.step), ["expose", "goto", "entry-ready", "save"]);
  assert.equal(calls[0].receivedPage, page);
  assert.equal(calls[1].args[0], "http://127.0.0.1:4173/?qa=1&onlineFixture=1");
  assert.deepEqual(calls[1].args[1], { waitUntil: "domcontentloaded" });
  assert.equal(calls[2].selector, "#nicknameInput");
  assert.deepEqual(calls[2].args, [{ state: "visible" }]);
  assert.equal(typeof calls[3].callback, "function");
  assert.deepEqual(calls[3].checkpoint, {
    name: "RWmtvbd970", classId: "warrior", full: false,
  });
});
