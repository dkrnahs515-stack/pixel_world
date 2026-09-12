import test from "node:test";
import assert from "node:assert/strict";
import { createChorusNetwork } from "../src/sanctuary-chorus-network-20260911-sanctuary.js";
import {
  applyChorusAction,
  createChorusEncounter,
  normalizeChorusEncounter,
  validateChorusAction,
} from "../src/sanctuary-chorus-state-20260911-sanctuary.js";
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
      if (ref.path.endsWith("/processedSequences")) {
        callback({ val: () => structuredClone(values.get(ref.path) ?? null) });
      }
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
        if (ref.path === BASE_PATH) {
          const absolutePath = `${BASE_PATH}/${path}`;
          if (entry === null) values.delete(absolutePath);
          else values.set(absolutePath, structuredClone(entry));
        }
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

function applyNetworkAction(state, action) {
  const validated = validateChorusAction(action, {
    encounter: state,
    authenticatedUid: action.uid,
    now: action.createdAt,
    lumenAssistEligible: true,
  });
  assert.equal(validated.ok, true, validated.reason);
  return applyChorusAction(state, validated, action.createdAt).encounter;
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

test("an empty state snapshot is safe before any encounter exists", async () => {
  const received = [];
  const fake = firebaseModulesFake();
  const network = createChorusNetwork(networkOptions(fake, "a", 10_000, {
    onStateChanged: value => received.push(value),
  }));

  await network.setMap("sanctuary-return-record");
  assert.doesNotThrow(() => fake.emit(`${BASE_PATH}/state`, null));
  assert.equal(network.latestState, null);
  assert.deepEqual(received, [null]);
  await network.stop();
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
    `${BASE_PATH}/completionInbox/a`,
    `${BASE_PATH}/processedSequences`,
    `${BASE_PATH}/state`,
  ]);
  assert.equal(await network.setMap("sanctuary-memory-archive"), false);
  assert.deepEqual([...fake.listeners.keys()], []);
  assert.deepEqual(received.slice(-3), [["state", null], ["actions", {}], ["claims", {}]]);
});

test("only the active authority publishes state and removes applied actions", async () => {
  const state = activeEncounter("a", 9_000);
  const wireState = {
    ...state,
    processedSequenceByUid: { b: 7 },
    processedActionUid: "b",
    processedActionSequence: 7,
  };
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: wireState });
  const a = createChorusNetwork(networkOptions(fake, "a"));
  await a.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, wireState);
  const action = {
    id: "b:2:8:anchor-stabilize", encounterId: "e1", authorityEpoch: 2, phase: "anchors",
    uid: "b", sequence: 8, type: "anchor-stabilize", fragmentId: "forest", anchorId: "forest",
    createdAt: 10_000,
  };
  fake.emit(`${BASE_PATH}/actions`, { b: { 8: action } });
  const published = await a.publishState(applyNetworkAction(state, action), { processedAction: action });
  assert.equal(published.ok, true);
  assert.equal(fake.updates.at(-1).path, BASE_PATH);
  assert.equal(fake.updates.at(-1).value["state/hp"], 90);
  assert.equal(fake.updates.at(-1).value["state/stabilizedAnchorIds/forest"], true);
  assert.equal(fake.updates.at(-1).value["state/combatRevision"], 1);
  assert.equal(fake.updates.at(-1).value["state/processedActionId"], action.id);
  assert.deepEqual(fake.updates.at(-1).value["state/processedActionReceipt"], {
    id: action.id,
    uid: "b",
    sequence: 8,
    type: "anchor-stabilize",
    fragmentId: "forest",
    anchorId: "forest",
  });
  assert.equal(fake.updates.at(-1).value["processedSequences/b"], 8);
  assert.equal(published.encounter.processedActionId, action.id);
  assert.equal(published.encounter.processedActionUid, "b");
  assert.equal(published.encounter.processedActionSequence, 8);
  assert.deepEqual(published.encounter.processedActionReceipt, {
    id: action.id,
    uid: "b",
    sequence: 8,
    type: "anchor-stabilize",
    fragmentId: "forest",
    anchorId: "forest",
  });
  assert.equal(fake.transactions.some(value => value.path === `${BASE_PATH}/state`), false);
  assert.equal((await a.acknowledgeAction("b", 7)).ok, true);
  assert.equal(fake.removes.includes(`${BASE_PATH}/actions/b/8`), true);

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
    contributors: {
      a: { firstContributedAt: 9_100, lastContributedAt: 10_000, actionTypes: ["anchor-stabilize"] },
      b: { firstContributedAt: 9_200, lastContributedAt: 10_000, actionTypes: ["bond-cut"] },
    },
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
  const claimUpdates = fake.updates.filter(value => value.path === BASE_PATH
    && Object.keys(value.value).some(path => path.startsWith("completionClaims/")));
  assert.equal(claimUpdates.length, 2);
  for (const claimUid of ["a", "b"]) {
    assert.deepEqual(claimUpdates.find(value => value.value[`completionClaims/e1/${claimUid}`])?.value, {
      [`completionClaims/e1/${claimUid}`]: claims[claimUid],
      [`completionInbox/${claimUid}`]: claims[claimUid],
    });
  }
  assert.equal(fake.transactions.some(value => value.path.includes("completionClaims/")), false);
  assert.deepEqual(fake.values.get(`${BASE_PATH}/completionInbox/a`), claims.a);
  assert.deepEqual(fake.values.get(`${BASE_PATH}/completionInbox/b`), claims.b);
  const nonContributor = await a.writeCompletionClaims("e1", {
    late: { encounterId: "e1", uid: "late", eligible: true, createdAt: 10_000 },
  });
  assert.equal(nonContributor.ok, false);
  assert.equal(fake.values.has(`${BASE_PATH}/completionInbox/late`), false);

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

test("a retained own completion inbox survives reform and delivers after reconnect", async () => {
  const received = [];
  const oldClaim = { encounterId: "e1", uid: "a", eligible: true, createdAt: 2_000 };
  const terminal = {
    ...activeEncounter("a", 1_000),
    status: "separated",
    phase: "separated",
    hp: 0,
    stabilizedAnchorIds: [...ANCHOR_IDS],
    resolvedTestimonyIds: CHORUS_TESTIMONIES.map(value => value.id),
    severedBondIds: [...BOND_IDS],
    separatedAt: 2_000,
    reformAt: 32_000,
  };
  const reformed = {
    ...activeEncounter("late", 32_000),
    encounterId: "sanctuary-chorus-32000-r3",
    authorityEpoch: 3,
  };
  const fake = firebaseModulesFake({
    [`${BASE_PATH}/state`]: reformed,
    [`${BASE_PATH}/completionInbox/a`]: oldClaim,
  });
  const network = createChorusNetwork(networkOptions(fake, "a", 32_001, {
    onCompletionClaimsChanged: claims => received.push(claims),
  }));

  await network.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, terminal);
  fake.emit(`${BASE_PATH}/state`, reformed);
  fake.emit(`${BASE_PATH}/completionInbox/a`, oldClaim);

  assert.equal(fake.listeners.has(`${BASE_PATH}/completionInbox/a`), true);
  assert.equal([...fake.listeners.keys()].some(path => path.includes("completionClaims/")), false);
  assert.deepEqual(received.at(-1), { a: oldClaim });
  await network.stop();
});

test("a late non-contributor starts a fresh encounter after reformAt without inheriting the old claim", async () => {
  const terminal = {
    ...activeEncounter("veteran", 1_000),
    stabilizedAnchorIds: [...ANCHOR_IDS],
    resolvedTestimonyIds: CHORUS_TESTIMONIES.map(value => value.id),
    severedBondIds: [...BOND_IDS],
    status: "separated",
    phase: "separated",
    hp: 0,
    separatedAt: 2_000,
    reformAt: 32_000,
    leaseUntil: 8_000,
    combatRevision: 13,
    contributors: { veteran: { firstContributedAt: 1_100, lastContributedAt: 2_000, actionTypes: ["bond-cut"] } },
  };
  const oldClaim = { encounterId: "e1", uid: "veteran", eligible: true, createdAt: 2_000 };
  const fake = firebaseModulesFake({
    [`${BASE_PATH}/state`]: { ...terminal, processedSequenceByUid: { veteran: 8 } },
    [`${BASE_PATH}/processedSequences`]: { veteran: 8 },
    [`${BASE_PATH}/completionClaims/e1/veteran`]: oldClaim,
    [`${BASE_PATH}/actions/veteran/8`]: { encounterId: "e1", uid: "veteran", sequence: 8 },
  });
  const late = createChorusNetwork(networkOptions(fake, "late", 32_000));
  await late.setMap("sanctuary-return-record");
  const next = await late.ensureEncounter();

  assert.notEqual(next.encounterId, "e1");
  assert.equal(next.authorityUid, "late");
  assert.equal(next.status, "active");
  assert.deepEqual(next.contributors, {});
  assert.equal(fake.values.get(`${BASE_PATH}/completionClaims/e1/veteran`).uid, "veteran");
  assert.equal(fake.values.has(`${BASE_PATH}/completionClaims/e1/late`), false);
  assert.equal(fake.removes.includes(`${BASE_PATH}/state`), false);
  assert.equal(fake.transactions.filter(value => value.path === `${BASE_PATH}/state`).length, 1);
  assert.deepEqual(late.processedSequenceByUid, { veteran: 8 });
});

test("a continuously connected terminal authority stops renewal and reforms at the canonical deadline", async () => {
  let clock = 10_000;
  const jobs = [];
  const timers = {
    set(callback, delay) {
      const job = { callback, delay, cancelled: false };
      jobs.push(job);
      return job;
    },
    clear(job) {
      if (job) job.cancelled = true;
    },
  };
  const terminal = normalizeChorusEncounter({
    ...activeEncounter("veteran", clock),
    stabilizedAnchorIds: [...ANCHOR_IDS],
    resolvedTestimonyIds: CHORUS_TESTIMONIES.map(value => value.id),
    severedBondIds: [...BOND_IDS],
    status: "separated",
    phase: "separated",
    hp: 0,
    separatedAt: clock,
    reformAt: clock + 30_000,
    leaseUntil: clock + 5_000,
    combatRevision: 13,
    contributors: { veteran: { firstContributedAt: 1_100, lastContributedAt: clock, actionTypes: ["bond-cut"] } },
  });
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: terminal });
  const received = [];
  const network = createChorusNetwork({
    ...networkOptions(fake, "veteran", clock, { onStateChanged: state => received.push(state) }),
    now: () => clock,
    timers,
  });
  await network.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, terminal);

  const liveJob = jobs.find(job => !job.cancelled);
  assert.equal(liveJob.delay, 30_000);
  assert.equal(jobs.some(job => !job.cancelled && job.delay < 30_000), false);
  clock = terminal.reformAt;
  await liveJob.callback();

  const fresh = network.latestState;
  assert.equal(fresh.encounterId, `sanctuary-chorus-${terminal.reformAt}-r3`);
  assert.equal(fresh.status, "active");
  assert.deepEqual(fresh.contributors, {});
  assert.equal(received.at(-1).encounterId, fresh.encounterId);
  assert.equal(fake.transactions.filter(value => value.path === `${BASE_PATH}/state`).length, 1);
  await network.stop();
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
      let state = normalizeChorusEncounter({
        ...activeEncounter("a", 9_000),
        ...(field === "resolvedTestimonyIds" || field === "severedBondIds"
          ? { stabilizedAnchorIds: [...ANCHOR_IDS] }
          : {}),
        ...(field === "severedBondIds" ? { resolvedTestimonyIds: [...TESTIMONY_IDS] } : {}),
      });
      const completed = [];
      for (const [index, id] of order.entries()) {
        completed.push(id);
        const createdAt = 10_000 + index;
        state = normalizeChorusEncounter(field === "severedBondIds" ? {
          ...state, activeRecordId: id, vulnerableUntil: createdAt + 3_000, updatedAt: createdAt,
        } : state);
        const type = field === "stabilizedAnchorIds" ? "anchor-stabilize"
          : field === "resolvedTestimonyIds" ? "testimony-resolve" : "bond-cut";
        const action = {
          id: `player:${state.authorityEpoch}:${index + 1}:${type}`,
          encounterId: state.encounterId,
          authorityEpoch: state.authorityEpoch,
          phase: state.phase,
          uid: "player",
          sequence: index + 1,
          type,
          createdAt,
          ...(field === "stabilizedAnchorIds" ? { fragmentId: id, anchorId: id } : {}),
          ...(field === "resolvedTestimonyIds" ? {
            testimonyId: id,
            verdict: CHORUS_TESTIMONIES.find(value => value.id === id).verdict,
          } : {}),
          ...(field === "severedBondIds" ? { bondId: id } : {}),
        };
        fake.emit(`${BASE_PATH}/state`, {
          ...state,
          [field]: membership(state[field]),
        });
        fake.emit(`${BASE_PATH}/actions`, { player: { [action.sequence]: action } });
        const result = await network.publishState(applyNetworkAction(state, action), { processedAction: action });
        assert.equal(result.ok, true, `${field}: ${order.join(" -> ")}`);
        assert.equal(fake.updates.at(-1).value[`state/${field}/${id}`], true);
        assert.equal(Object.hasOwn(fake.updates.at(-1).value, `state/${field}`), false);
        state = result.encounter;
      }
      await network.stop();
    }
  }
});

test("raw receipt history filters ancient replays and publishes only additive history leaves", async () => {
  const ancientId = "player:2:1:fragment-strike";
  const freshId = "player:2:999:anchor-stabilize";
  const freshAction = {
    id: freshId, encounterId: "e1", authorityEpoch: 2, phase: "anchors", uid: "player",
    sequence: 999, type: "anchor-stabilize", fragmentId: "forest", anchorId: "forest", createdAt: 10_000,
  };
  const receivedActions = [];
  const state = {
    ...activeEncounter("a", 9_000),
    processedActionIds: membership([
      ancientId,
      ...Array.from({ length: 300 }, (_, index) => `receipt-${String(index).padStart(3, "0")}`),
    ]),
    processedSequenceByUid: { player: 1 },
    processedActionUid: "player",
    processedActionSequence: 1,
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
      999: freshAction,
    },
  });
  assert.deepEqual(receivedActions, []);
  fake.emit(`${BASE_PATH}/state`, state);

  assert.equal(network.latestState.processedActionIds.length, 256);
  assert.deepEqual(receivedActions.at(-1), { player: { 999: freshAction } });

  const result = await network.publishState(applyNetworkAction(network.latestState, freshAction), {
    processedAction: freshAction,
  });

  assert.equal(result.ok, true);
  assert.equal(fake.updates.at(-1).value["state/processedSequenceByUid/player"], 999);
  assert.equal(fake.updates.at(-1).value["processedSequences/player"], 999);
  assert.equal(fake.updates.at(-1).value["state/processedActionUid"], "player");
  assert.equal(fake.updates.at(-1).value["state/processedActionSequence"], 999);
  assert.equal(fake.updates.at(-1).value["state/contributors/player/actionTypes/anchor-stabilize"], true);
  assert.equal(fake.updates.at(-1).value["state/contributors/player/lastContributedAt"], 10_000);
  assert.equal(Object.keys(fake.updates.at(-1).value).some(key => key.startsWith("state/processedActionIds")), false);
  assert.equal(Object.hasOwn(fake.updates.at(-1).value, "state/contributors/player"), false);
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

test("sequence watermarks bound replay history and filter lower late actions", async () => {
  const receivedActions = [];
  const state = {
    ...activeEncounter("a", 9_000),
    processedSequenceByUid: { player: 700 },
    processedActionUid: "player",
    processedActionSequence: 700,
  };
  const freshAction = {
    id: "player-session:2:900:fragment-strike",
    encounterId: "e1",
    authorityEpoch: 2,
    phase: "anchors",
    uid: "player",
    sequence: 900,
    type: "fragment-strike",
    fragmentId: "forest",
    createdAt: 10_000,
  };
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
  const network = createChorusNetwork(networkOptions(fake, "a", 10_000, {
    onActionsChanged: value => receivedActions.push(value),
  }));
  await network.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/actions`, {
    player: {
      12: { ...freshAction, id: "late-lower-action", sequence: 12 },
      900: freshAction,
    },
  });
  assert.deepEqual(receivedActions, []);
  fake.emit(`${BASE_PATH}/state`, state);

  assert.deepEqual(receivedActions.at(-1), { player: { 900: freshAction } });
  assert.deepEqual(network.processedSequenceByUid, { player: 700 });
  assert.equal(Array.isArray(network.latestState.processedActionIds), true);

  const published = await network.publishState({
    ...network.latestState,
    processedActionIds: [freshAction.id],
    contributors: {
      player: {
        firstContributedAt: 10_000,
        lastContributedAt: 10_000,
        actionTypes: ["fragment-strike"],
      },
    },
    combatRevision: 1,
    updatedAt: 10_000,
  }, { processedAction: freshAction });

  assert.equal(published.ok, true);
  assert.deepEqual(fake.updates.at(-1), {
    path: BASE_PATH,
    value: {
      "state/contributors/player/firstContributedAt": 10_000,
      "state/contributors/player/lastContributedAt": 10_000,
      "state/contributors/player/actionTypes/fragment-strike": true,
      "state/combatRevision": 1,
      "state/updatedAt": 10_000,
      "state/processedSequenceByUid/player": 900,
      "state/processedActionId": "player-session:2:900:fragment-strike",
      "state/processedActionUid": "player",
      "state/processedActionSequence": 900,
      "state/processedActionReceipt": {
        id: freshAction.id,
        uid: "player",
        sequence: 900,
        type: "fragment-strike",
        fragmentId: "forest",
      },
      "processedSequences/player": 900,
    },
  });
  assert.deepEqual(published.processedSequenceByUid, { player: 900 });
  assert.equal(Object.hasOwn(fake.updates.at(-1).value, "processedActionIds"), false);

  fake.emit(`${BASE_PATH}/actions`, {
    player: {
      899: { ...freshAction, id: "late-after-confirmation", sequence: 899 },
      901: { ...freshAction, id: "newer-action", sequence: 901 },
    },
  });
  assert.deepEqual(receivedActions.at(-1), {
    player: { 901: { ...freshAction, id: "newer-action", sequence: 901 } },
  });
  assert.equal((await network.acknowledgeAction("player", 899)).ok, true);
  assert.equal((await network.acknowledgeAction("player", 901)).ok, false);
});

test("a new processed id requires matching pending action metadata", async () => {
  const state = activeEncounter("a", 9_000);
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
  const network = createChorusNetwork(networkOptions(fake, "a", 10_000));
  await network.setMap("sanctuary-return-record");
  fake.emit(`${BASE_PATH}/state`, state);
  const incoming = {
    ...state,
    processedActionIds: ["player-session:2:50:fragment-strike"],
    contributors: {
      player: {
        firstContributedAt: 10_000,
        lastContributedAt: 10_000,
        actionTypes: ["fragment-strike"],
      },
    },
    combatRevision: 1,
    updatedAt: 10_000,
  };

  const missing = await network.publishState(incoming);
  const mismatched = await network.publishState(incoming, {
    processedAction: {
      id: incoming.processedActionIds[0],
      encounterId: "wrong-encounter",
      authorityEpoch: 2,
      uid: "player",
      sequence: 50,
    },
  });

  assert.deepEqual(missing, { ok: false, reason: "processed_action_required" });
  assert.deepEqual(mismatched, { ok: false, reason: "processed_action_mismatch" });
  assert.equal(fake.updates.length, 0);
});

test("authority automatically removes confirmed actions when listeners converge", async () => {
  const confirmed = { id: "player-session:2:7:fragment-strike", sequence: 7 };
  const pending = { id: "player-session:2:8:fragment-strike", sequence: 8 };
  const state = {
    ...activeEncounter("a", 9_000),
    processedSequenceByUid: { player: 7 },
    processedActionUid: "player",
    processedActionSequence: 7,
  };
  for (const order of ["actions-first", "state-first"]) {
    const received = [];
    const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
    const network = createChorusNetwork(networkOptions(fake, "a", 10_000, {
      onActionsChanged: actions => received.push(actions),
    }));
    await network.setMap("sanctuary-return-record");
    const actions = {
      player: { 2: { ...confirmed, sequence: 2 }, 7: confirmed, 8: pending },
    };
    if (order === "actions-first") {
      fake.emit(`${BASE_PATH}/actions`, actions);
      fake.emit(`${BASE_PATH}/state`, state);
    } else {
      fake.emit(`${BASE_PATH}/state`, state);
      fake.emit(`${BASE_PATH}/actions`, actions);
    }
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(received.at(-1), { player: { 8: pending } }, order);
    assert.deepEqual(fake.removes, [
      `${BASE_PATH}/actions/player/2`,
      `${BASE_PATH}/actions/player/7`,
    ], order);
    await network.stop();
  }
});

test("viewer filters confirmed actions without attempting authority cleanup", async () => {
  const state = {
    ...activeEncounter("a", 9_000),
    processedSequenceByUid: { player: 7 },
    processedActionUid: "player",
    processedActionSequence: 7,
  };
  const received = [];
  const fake = firebaseModulesFake({ [`${BASE_PATH}/state`]: state });
  const viewer = createChorusNetwork(networkOptions(fake, "viewer", 10_000, {
    onActionsChanged: actions => received.push(actions),
  }));
  await viewer.setMap("sanctuary-return-record");

  fake.emit(`${BASE_PATH}/state`, state);
  fake.emit(`${BASE_PATH}/actions`, { player: { 7: { id: "confirmed", sequence: 7 } } });
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(received.at(-1), {});
  assert.deepEqual(fake.removes, []);
});
