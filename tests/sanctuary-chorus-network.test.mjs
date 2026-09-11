import test from "node:test";
import assert from "node:assert/strict";
import { createChorusNetwork } from "../src/sanctuary-chorus-network-20260911-sanctuary.js";
import { createChorusEncounter } from "../src/sanctuary-chorus-state-20260911-sanctuary.js";

const BASE_PATH = "rooms/public/chorus/sanctuary-return-record";

function firebaseModulesFake(initial = {}) {
  const values = new Map(Object.entries(initial));
  const listeners = new Map();
  const sets = [];
  const updates = [];
  const removes = [];
  const transactions = [];
  const dbModule = {
    ref: (_db, path) => ({ path }),
    onValue(ref, callback) {
      listeners.set(ref.path, callback);
      return () => listeners.delete(ref.path);
    },
    async set(ref, value) {
      sets.push({ path: ref.path, value: structuredClone(value) });
      values.set(ref.path, structuredClone(value));
    },
    async update(ref, value) {
      updates.push({ path: ref.path, value: structuredClone(value) });
      const current = values.get(ref.path) || {};
      values.set(ref.path, { ...current, ...structuredClone(value) });
    },
    async remove(ref) {
      removes.push(ref.path);
      values.delete(ref.path);
    },
    async runTransaction(ref, update) {
      const current = structuredClone(values.get(ref.path) ?? null);
      const next = update(current);
      transactions.push({ path: ref.path, current, next: structuredClone(next) });
      if (next === undefined) {
        return { committed: false, snapshot: { val: () => current } };
      }
      values.set(ref.path, structuredClone(next));
      return { committed: true, snapshot: { val: () => structuredClone(next) } };
    },
    serverTimestamp: () => 12_345,
  };
  return {
    dbModule,
    values,
    listeners,
    sets,
    updates,
    removes,
    transactions,
    emit(path, value) {
      listeners.get(path)?.({ val: () => structuredClone(value) });
    },
  };
}

function networkOptions(fake, uid, now = 10_000, callbacks = {}) {
  return {
    dbModule: fake.dbModule,
    db: {},
    roomId: "public",
    uid,
    callbacks,
    now: () => now,
    timers: {
      set: () => 1,
      clear: () => {},
    },
  };
}

function activeEncounter(authorityUid = "a", now = 1_000) {
  return createChorusEncounter({ encounterId: "e1", authorityUid, authorityEpoch: 2, now });
}

test("chorus network uses only the dedicated sanctuary path", async () => {
  const fake = firebaseModulesFake();
  const a = createChorusNetwork(networkOptions(fake, "a"));
  await a.setMap("sanctuary-return-record");
  await a.sendAction({ type: "anchor-stabilize", sequence: 1, encounterId: "e1" });

  assert.equal(fake.sets[0].path, `${BASE_PATH}/actions/a/1`);
  assert.equal([...fake.listeners.keys()].every(path => path.startsWith(BASE_PATH)), true);
  assert.equal(
    [...fake.listeners.keys(), ...fake.sets.map(value => value.path)].some(path => path.includes("/bosses/")),
    false,
  );
  await a.stop();
});

test("expired authority transfers without replaying acknowledged actions", async () => {
  const expired = {
    ...activeEncounter("a", 1_000),
    stabilizedAnchorIds: ["forest"],
    hp: 90,
    processedActionIds: ["a:2:1:anchor-stabilize"],
    leaseUntil: 9_999,
  };
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: expired });
  const b = createChorusNetwork(networkOptions(fake, "b", 10_000));
  await b.setMap("sanctuary-return-record");
  const result = await b.tryAcquireAuthority();

  assert.equal(result.ok, true);
  assert.equal(result.encounter.authorityUid, "b");
  assert.equal(result.encounter.authorityEpoch, 3);
  assert.deepEqual(result.encounter.stabilizedAnchorIds, ["forest"]);
  assert.deepEqual(result.encounter.processedActionIds, ["a:2:1:anchor-stabilize"]);
  assert.equal(fake.removes.length, 0);
  await b.stop();
});

test("leaving the return-record map unsubscribes state actions and the user's claims", async () => {
  const received = [];
  const fake = firebaseModulesFake();
  const network = createChorusNetwork(networkOptions(fake, "a", 10_000, {
    onStateChanged: value => received.push(["state", value]),
    onActionsChanged: value => received.push(["actions", value]),
    onCompletionClaimsChanged: value => received.push(["claims", value]),
  }));

  assert.equal(await network.setMap("sanctuary-return-record"), true);
  assert.deepEqual([...fake.listeners.keys()].sort(), [
    `${BASE_PATH}/actions`,
    `${BASE_PATH}/completionClaims/a`,
    `${BASE_PATH}/state`,
  ]);
  assert.equal(await network.setMap("sanctuary-memory-archive"), false);
  assert.deepEqual([...fake.listeners.keys()], []);
  assert.deepEqual(received.slice(-3), [["state", null], ["actions", {}], ["claims", {}]]);
});

test("only the active authority publishes state and removes applied actions", async () => {
  const state = activeEncounter("a", 9_000);
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
  const a = createChorusNetwork(networkOptions(fake, "a"));
  await a.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, state);

  assert.equal((await a.publishState({ ...state, hp: 90 })).ok, true);
  assert.equal(fake.transactions.at(-1).path, `${BASE_PATH}/state`);
  assert.equal((await a.acknowledgeAction("b", 7)).ok, true);
  assert.equal(fake.removes.at(-1), `${BASE_PATH}/actions/b/7`);

  const b = createChorusNetwork(networkOptions(fake, "b"));
  await b.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, state);
  assert.equal((await b.publishState({ ...state, hp: 90 })).reason, "not_authority");
  assert.equal((await b.acknowledgeAction("a", 1)).reason, "not_authority");
});

test("authority creates immutable contributor claims and each user acknowledges only their own", async () => {
  const separated = {
    ...activeEncounter("a", 9_000),
    stabilizedAnchorIds: ["forest", "coast", "volcano"],
    resolvedTestimonyIds: [
      "core-self-division-original",
      "lumen-caused-core-division",
      "lumen-touched-seal-to-delay-eruption",
      "return-delay-was-lumen-alone",
      "first-archivist-deletion-protected-everyone",
      "resonance-time-was-incident-time",
    ],
    severedBondIds: ["roan", "sera", "garen", "lumen"],
    status: "separated",
    phase: "separated",
    hp: 0,
  };
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: separated });
  const a = createChorusNetwork(networkOptions(fake, "a"));
  await a.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, separated);
  const claims = {
    a: { encounterId: "e1", uid: "a", eligible: true, createdAt: 10_000 },
    b: { encounterId: "e1", uid: "b", eligible: true, createdAt: 10_000 },
  };

  assert.equal((await a.writeCompletionClaims("e1", claims)).ok, true);
  assert.deepEqual(fake.transactions.slice(-2).map(value => value.path), [
    `${BASE_PATH}/completionClaims/a`,
    `${BASE_PATH}/completionClaims/b`,
  ]);

  const bFake = firebaseModulesFake({
    [`${BASE_PATH}/state`]: separated,
    [`${BASE_PATH}/completionClaims/b`]: claims.b,
  });
  const b = createChorusNetwork(networkOptions(bFake, "b"));
  await b.setMap("sanctuary-return-record");
  const acknowledged = await b.acknowledgeCompletionClaim("e1");
  assert.equal(acknowledged.ok, true);
  assert.deepEqual(bFake.transactions.at(-1).next, { ...claims.b, acknowledgedAt: 12_345 });
  assert.equal(bFake.transactions.at(-1).path, `${BASE_PATH}/completionClaims/b`);
});

test("a solo-completed snapshot is never uploaded as a shared encounter", async () => {
  const state = activeEncounter("a", 9_000);
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
  const b = createChorusNetwork(networkOptions(fake, "b"));
  await b.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, state);
  const localSeparated = {
    ...state,
    authorityUid: "b",
    status: "separated",
    phase: "separated",
    hp: 0,
  };

  const result = await b.publishState(localSeparated);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_authority");
  assert.equal(fake.values.get(`${BASE_PATH}/state`).status, "active");
});
