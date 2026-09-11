import test from "node:test";
import assert from "node:assert/strict";
import { createChorusNetwork } from "../src/sanctuary-chorus-network-20260911-sanctuary.js";
import { createChorusEncounter } from "../src/sanctuary-chorus-state-20260911-sanctuary.js";
import {
  ANCHOR_IDS,
  BOND_IDS,
  CHORUS_TESTIMONIES,
  TESTIMONY_IDS,
} from "../src/sanctuary-chorus-data-20260911-sanctuary.js";

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
    async get(ref) {
      const value = structuredClone(values.get(ref.path) ?? null);
      return { val: () => value };
    },
    async set(ref, value) {
      sets.push({ path: ref.path, value: structuredClone(value) });
      values.set(ref.path, structuredClone(value));
    },
    async update(ref, value) {
      updates.push({ path: ref.path, value: structuredClone(value) });
      const current = structuredClone(values.get(ref.path) || {});
      for (const [path, entry] of Object.entries(structuredClone(value))) {
        const parts = path.split("/");
        let parent = current;
        for (const part of parts.slice(0, -1)) parent = parent[part] ||= {};
        const key = parts.at(-1);
        if (entry === null) delete parent[key];
        else parent[key] = entry;
      }
      values.set(ref.path, current);
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

function membership(values) {
  return Object.fromEntries(values.map(value => [value, true]));
}

function permutations(values) {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) => permutations(values.toSpliced(index, 1))
    .map(rest => [value, ...rest]));
}

test("chorus network uses only the dedicated sanctuary path", async () => {
  const fake = firebaseModulesFake();
  const a = createChorusNetwork(networkOptions(fake, "a"));
  await a.setMap("sanctuary-return-record");
  await a.sendAction({ id: "a:2:1:anchor-stabilize", type: "anchor-stabilize", sequence: 1, encounterId: "e1" });

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
  assert.deepEqual(fake.updates.at(-1), {
    path: `${BASE_PATH}/state`,
    value: {
      authorityUid: "b",
      authorityEpoch: 3,
      leaseUntil: 15_000,
      updatedAt: 10_000,
    },
  });
  assert.equal(fake.transactions.some(value => value.path === `${BASE_PATH}/state`), false);
  assert.equal(fake.removes.length, 0);
  await b.stop();
});

test("leaving the return-record map unsubscribes state actions and the user's claims", async () => {
  const received = [];
  const state = activeEncounter("a", 9_000);
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
  const network = createChorusNetwork(networkOptions(fake, "a", 10_000, {
    onStateChanged: value => received.push(["state", value]),
    onActionsChanged: value => received.push(["actions", value]),
    onCompletionClaimsChanged: value => received.push(["claims", value]),
  }));

  assert.equal(await network.setMap("sanctuary-return-record"), true);
  fake.emit(`${BASE_PATH}/state`, state);
  assert.deepEqual([...fake.listeners.keys()].sort(), [
    `${BASE_PATH}/actions`,
    `${BASE_PATH}/completionClaims/e1/a`,
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

  assert.equal((await a.publishState({
    ...state,
    stabilizedAnchorIds: ["forest"],
    combatRevision: 1,
    updatedAt: 10_000,
  })).ok, true);
  assert.deepEqual(fake.updates.at(-1), {
    path: `${BASE_PATH}/state`,
    value: {
      hp: 90,
      "stabilizedAnchorIds/forest": true,
      combatRevision: 1,
      updatedAt: 10_000,
    },
  });
  assert.equal(fake.transactions.some(value => value.path === `${BASE_PATH}/state`), false);
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
    `${BASE_PATH}/completionClaims/e1/a`,
    `${BASE_PATH}/completionClaims/e1/b`,
  ]);

  const bFake = firebaseModulesFake({
    [`${BASE_PATH}/state`]: separated,
    [`${BASE_PATH}/completionClaims/e1/b`]: claims.b,
  });
  const b = createChorusNetwork(networkOptions(bFake, "b"));
  await b.setMap("sanctuary-return-record");
  const acknowledged = await b.acknowledgeCompletionClaim("e1");
  assert.equal(acknowledged.ok, true);
  assert.deepEqual(bFake.transactions.at(-1).next, { ...claims.b, acknowledgedAt: 12_345 });
  assert.equal(bFake.transactions.at(-1).path, `${BASE_PATH}/completionClaims/e1/b`);
});

test("invalid encounter keys never become completion claim paths", async () => {
  const state = activeEncounter("a", 9_000);
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
  const network = createChorusNetwork(networkOptions(fake, "a"));
  await network.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, state);

  const result = await network.acknowledgeCompletionClaim("bad/id");

  assert.deepEqual(result, { ok: false, reason: "invalid_claim" });
  assert.equal(fake.transactions.length, 0);
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

test("renewal and combat publishes are serialized while newer combat state preserves the current lease", async () => {
  let clock = 10_000;
  const state = {
    ...activeEncounter("a", 9_000),
    stabilizedAnchorIds: ["forest", "coast", "volcano"],
    resolvedTestimonyIds: CHORUS_TESTIMONIES.map(value => value.id),
    combatRevision: 4,
    currentPatternId: "coast-tide",
    patternStartedAt: 9_000,
    patternEndsAt: 9_900,
  };
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
  const network = createChorusNetwork({ ...networkOptions(fake, "a"), now: () => clock });
  await network.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, state);

  const renewed = await network.renewAuthority(2);
  assert.equal(renewed.encounter.leaseUntil, 15_000);

  const stale = await network.publishState({
    ...state,
    combatRevision: 3,
    currentPatternId: "forest-roots",
    patternStartedAt: 8_000,
    patternEndsAt: 8_900,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "stale_state");

  clock = 10_100;
  const published = await network.publishState({
    ...state,
    combatRevision: 5,
    currentPatternId: "volcano-rift",
    patternStartedAt: 10_100,
    patternEndsAt: 11_000,
    leaseUntil: 14_000,
  });
  assert.equal(published.ok, true);
  assert.equal(published.encounter.combatRevision, 5);
  assert.equal(published.encounter.currentPatternId, "volcano-rift");
  assert.equal(published.encounter.leaseUntil, 15_000);
});

test("state mutations never overlap even when Firebase transactions settle later", async () => {
  const state = activeEncounter("a", 9_000);
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
  const originalUpdate = fake.dbModule.update;
  const releases = [];
  let inFlight = 0;
  let maxInFlight = 0;
  fake.dbModule.update = async (ref, value) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(resolve => releases.push(resolve));
    try {
      return await originalUpdate(ref, value);
    } finally {
      inFlight -= 1;
    }
  };
  const network = createChorusNetwork(networkOptions(fake, "a"));
  await network.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, state);

  const renewing = network.renewAuthority(2);
  const publishing = network.publishState({ ...state, combatRevision: 1 });
  for (let turn = 0; turn < 4; turn += 1) await Promise.resolve();
  assert.equal(maxInFlight, 1);
  assert.equal(releases.length, 1);
  releases.shift()();
  while (releases.length === 0) await Promise.resolve();
  releases.shift()();
  await Promise.all([renewing, publishing]);
  assert.equal(maxInFlight, 1);
});

test("encounter creation uses an atomic child patch instead of a parent state transaction", async () => {
  const fake = firebaseModulesFake();
  const network = createChorusNetwork(networkOptions(fake, "host"));
  await network.setMap("sanctuary-return-record");

  const encounter = await network.ensureEncounter();

  assert.equal(encounter.authorityUid, "host");
  assert.equal(fake.updates.at(-1).path, `${BASE_PATH}/state`);
  assert.equal(fake.updates.at(-1).value.encounterId, encounter.encounterId);
  assert.equal(fake.transactions.some(value => value.path === `${BASE_PATH}/state`), false);
});

test("encounter creation omits empty membership containers from the Firebase wire", async () => {
  const fake = firebaseModulesFake();
  const network = createChorusNetwork(networkOptions(fake, "host"));
  await network.setMap("sanctuary-return-record");

  await network.ensureEncounter();

  const wire = fake.updates.at(-1).value;
  for (const field of [
    "stabilizedAnchorIds", "resolvedTestimonyIds", "severedBondIds", "processedActionIds", "contributors",
  ]) {
    assert.equal(Object.hasOwn(wire, field), false, `${field} must be absent while empty`);
  }
});

test("Firebase wire uses order-independent add-only membership leaves for every objective family", async () => {
  const families = [
    ["stabilizedAnchorIds", ANCHOR_IDS],
    ["resolvedTestimonyIds", TESTIMONY_IDS],
    ["severedBondIds", BOND_IDS],
  ];
  for (const [field, ids] of families) {
    for (const order of permutations(ids)) {
      const fake = firebaseModulesFake();
      const network = createChorusNetwork(networkOptions(fake, "a"));
      await network.setMap("sanctuary-return-record");
      let state = {
        ...activeEncounter("a", 9_000),
        ...(field === "resolvedTestimonyIds" || field === "severedBondIds"
          ? { stabilizedAnchorIds: [...ANCHOR_IDS] }
          : {}),
        ...(field === "severedBondIds" ? { resolvedTestimonyIds: [...TESTIMONY_IDS] } : {}),
      };
      const completed = [];
      for (const id of order) {
        completed.push(id);
        const canonical = ids.filter(value => completed.includes(value));
        const next = {
          ...state,
          [field]: canonical,
          combatRevision: state.combatRevision + 1,
          updatedAt: 10_000,
        };
        fake.emit(`${BASE_PATH}/state`, {
          ...state,
          [field]: membership(state[field]),
        });
        const result = await network.publishState(next);
        assert.equal(result.ok, true, `${field}: ${order.join(" -> ")}`);
        assert.equal(fake.updates.at(-1).value[`${field}/${id}`], true);
        assert.equal(Object.hasOwn(fake.updates.at(-1).value, field), false);
        state = result.encounter;
      }
      await network.stop();
    }
  }
});

test("raw receipt history filters ancient replays and publishes only additive history leaves", async () => {
  const ancientId = "player:2:1:fragment-strike";
  const freshId = "player:2:999:anchor-stabilize";
  const receivedActions = [];
  const state = {
    ...activeEncounter("a", 9_000),
    processedActionIds: membership([
      ancientId,
      ...Array.from({ length: 300 }, (_, index) => `receipt-${String(index).padStart(3, "0")}`),
    ]),
    contributors: {
      player: {
        firstContributedAt: 9_000,
        lastContributedAt: 9_100,
        actionTypes: membership(["fragment-strike"]),
      },
    },
  };
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
  const network = createChorusNetwork(networkOptions(fake, "a", 10_000, {
    onActionsChanged: value => receivedActions.push(value),
  }));
  await network.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/actions`, {
    player: {
      1: { id: ancientId },
      999: { id: freshId },
    },
  });
  assert.deepEqual(receivedActions, []);
  fake.emit(`${BASE_PATH}/state`, state);

  assert.equal(network.latestState.processedActionIds.length, 256);
  assert.deepEqual(receivedActions.at(-1), { player: { 999: { id: freshId } } });

  const result = await network.publishState({
    ...network.latestState,
    stabilizedAnchorIds: ["forest"],
    processedActionIds: [...network.latestState.processedActionIds, freshId],
    contributors: {
      player: {
        firstContributedAt: 9_000,
        lastContributedAt: 10_000,
        actionTypes: ["fragment-strike", "anchor-stabilize"],
      },
    },
    combatRevision: network.latestState.combatRevision + 1,
    updatedAt: 10_000,
  });

  assert.equal(result.ok, true);
  assert.equal(fake.updates.at(-1).value[`processedActionIds/${freshId}`], true);
  assert.equal(fake.updates.at(-1).value["contributors/player/actionTypes/anchor-stabilize"], true);
  assert.equal(fake.updates.at(-1).value["contributors/player/lastContributedAt"], 10_000);
  assert.equal(Object.hasOwn(fake.updates.at(-1).value, "processedActionIds"), false);
  assert.equal(Object.hasOwn(fake.updates.at(-1).value, "contributors/player"), false);
});

test("invalid action IDs are rejected before allocating a sequence", async () => {
  const fake = firebaseModulesFake();
  const network = createChorusNetwork(networkOptions(fake, "player"));
  await network.setMap("sanctuary-return-record");

  for (const id of [" has-space", "bad/id", "bad.id", "bad#id", "bad\u0001id"]) {
    const result = await network.sendAction({ id, type: "fragment-strike", encounterId: "e1", sequence: 1 });
    assert.deepEqual(result, { ok: false, reason: "invalid_action" });
  }
  assert.equal(fake.transactions.length, 0);
  assert.equal(fake.sets.length, 0);
});

test("reconnected clients allocate a new monotonic Firebase action sequence for the same uid", async () => {
  const fake = firebaseModulesFake();
  const first = createChorusNetwork(networkOptions(fake, "same-user"));
  await first.setMap("sanctuary-return-record");
  const firstResult = await first.sendAction({
    id: "session-a:1",
    type: "fragment-strike",
    sequence: 1,
    encounterId: "e1",
  });
  await first.stop();

  const reconnected = createChorusNetwork(networkOptions(fake, "same-user"));
  await reconnected.setMap("sanctuary-return-record");
  const secondResult = await reconnected.sendAction({
    id: "session-b:1",
    type: "fragment-strike",
    sequence: 1,
    encounterId: "e1",
  });

  assert.equal(firstResult.action.sequence, 1);
  assert.equal(secondResult.action.sequence, 2);
  assert.deepEqual(fake.sets.slice(-2).map(value => value.path), [
    `${BASE_PATH}/actions/same-user/1`,
    `${BASE_PATH}/actions/same-user/2`,
  ]);
});

test("an expired owner cannot publish combat state or remove an action before takeover", async () => {
  let clock = 13_999;
  const state = activeEncounter("a", 9_000);
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
  const network = createChorusNetwork({ ...networkOptions(fake, "a"), now: () => clock });
  await network.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, state);
  clock = state.leaseUntil;
  const transactionCount = fake.transactions.length;

  const published = await network.publishState({
    ...state,
    combatRevision: state.combatRevision + 1,
    processedActionIds: ["expired-owner-action"],
  });
  const acknowledged = await network.acknowledgeAction("b", 7, state.authorityEpoch);

  assert.equal(published.ok, false);
  assert.equal(acknowledged.ok, false);
  assert.equal(fake.transactions.length, transactionCount);
  assert.deepEqual(fake.removes, []);
});
