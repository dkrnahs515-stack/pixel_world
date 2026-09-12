const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { get, onValue, ref, remove, runTransaction, serverTimestamp, set, update } = require("firebase/database");

const projectId = "demo-pixel-world-rules";
const bossMapId = "volcano-core-caldera";
const bossPath = `rooms/public/bosses/${bossMapId}`;
const statePath = `${bossPath}/state`;
const chorusPath = "rooms/public/chorus/sanctuary-return-record";
const chorusStatePath = `${chorusPath}/state`;
const anchorIds = ["forest", "coast", "volcano"];
const testimonyIds = [
  "core-self-division-original",
  "lumen-caused-core-division",
  "lumen-touched-seal-to-delay-eruption",
  "return-delay-was-lumen-alone",
  "first-archivist-deletion-protected-everyone",
  "resonance-time-was-incident-time",
];
const bondIds = ["roan", "sera", "garen", "lumen"];

function chat({ mapId = "sanctuary-return-record", createdAt = Date.now() } = {}) {
  return { text: "기록을 확인합니다.", name: "RuleTester", mapId, createdAt };
}

function chorusEncounter({
  authorityUid = "host",
  authorityEpoch = 1,
  leaseUntil = Date.now() + 4_000,
  ...overrides
} = {}) {
  const timestamp = Date.now();
  return {
    encounterId: "chorus-emulator-1",
    bossId: "unnamed-chorus",
    mapId: "sanctuary-return-record",
    status: "active",
    phase: "anchors",
    hp: 100,
    maxHp: 100,
    stabilizedAnchorIds: [],
    resolvedTestimonyIds: [],
    severedBondIds: [],
    activeRecordId: null,
    currentPatternId: null,
    patternStartedAt: 0,
    patternEndsAt: 0,
    vulnerableUntil: 0,
    lumenAssistUsed: false,
    combatRevision: 0,
    processedActionIds: [],
    contributors: {},
    authorityUid,
    authorityEpoch,
    leaseUntil,
    spawnedAt: timestamp,
    updatedAt: timestamp,
    separatedAt: null,
    reformAt: null,
    ...overrides,
  };
}

function membership(values) {
  return Object.fromEntries(values.map(value => [value, true]));
}

function permutations(values) {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) => permutations(values.toSpliced(index, 1))
    .map(rest => [value, ...rest]));
}

async function waitFor(predicate, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for emulator listener state");
}

function wireChorusEncounter(value) {
  const wire = structuredClone(value);
  for (const field of [
    "stabilizedAnchorIds", "resolvedTestimonyIds", "severedBondIds",
  ]) {
    const values = Array.isArray(wire[field]) ? wire[field] : Object.keys(wire[field] || {});
    if (values.length === 0) delete wire[field];
    else wire[field] = membership(values);
  }
  delete wire.processedActionIds;
  const contributors = {};
  for (const [uid, contributor] of Object.entries(wire.contributors || {})) {
    contributors[uid] = {
      ...contributor,
      actionTypes: membership(Array.isArray(contributor.actionTypes)
        ? contributor.actionTypes
        : Object.keys(contributor.actionTypes || {})),
    };
  }
  if (Object.keys(contributors).length === 0) delete wire.contributors;
  else wire.contributors = contributors;
  return wire;
}

function chorusAction(uid, sequence, overrides = {}) {
  return {
    id: `${uid}:1:${sequence}:fragment-strike`,
    encounterId: "chorus-emulator-1",
    authorityEpoch: 1,
    phase: "anchors",
    uid,
    sequence,
    type: "fragment-strike",
    fragmentId: "forest",
    createdAt: Date.now(),
    ...overrides,
  };
}

function chorusActionReceipt(action) {
  const receipt = {
    id: action.id,
    uid: action.uid,
    sequence: action.sequence,
    type: action.type,
  };
  for (const field of ["fragmentId", "anchorId", "testimonyId", "verdict", "recordId", "bondId"]) {
    if (action[field] != null) receipt[field] = action[field];
  }
  return receipt;
}

function separatedChorusState(overrides = {}) {
  const timestamp = Date.now();
  return chorusEncounter({
    leaseUntil: timestamp + 6_000,
    status: "separated",
    phase: "separated",
    hp: 0,
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
    combatRevision: 13,
    contributors: {
      player: {
        firstContributedAt: timestamp - 1_000,
        lastContributedAt: timestamp,
        actionTypes: ["fragment-strike", "bond-cut"],
      },
    },
    separatedAt: timestamp,
    reformAt: timestamp + 30_000,
    ...overrides,
  });
}

function oneAnchorChorusState(overrides = {}) {
  const timestamp = Date.now();
  return chorusEncounter({
    leaseUntil: timestamp + 6_000,
    stabilizedAnchorIds: ["forest"],
    hp: 90,
    combatRevision: 1,
    processedActionIds: ["player:1:1:anchor-stabilize"],
    processedSequenceByUid: { player: 1 },
    processedActionId: "player:1:1:anchor-stabilize",
    processedActionUid: "player",
    processedActionSequence: 1,
    contributors: {
      player: {
        firstContributedAt: timestamp - 1_000,
        lastContributedAt: timestamp,
        actionTypes: ["anchor-stabilize"],
      },
    },
    updatedAt: timestamp,
    ...overrides,
  });
}

function onslaughtChorusState(overrides = {}) {
  const timestamp = Date.now();
  return chorusEncounter({
    leaseUntil: timestamp + 30_000,
    stabilizedAnchorIds: ["forest", "coast", "volcano"],
    resolvedTestimonyIds: [
      "core-self-division-original",
      "lumen-caused-core-division",
      "lumen-touched-seal-to-delay-eruption",
      "return-delay-was-lumen-alone",
      "first-archivist-deletion-protected-everyone",
      "resonance-time-was-incident-time",
    ],
    severedBondIds: ["roan", "sera", "garen"],
    phase: "onslaught",
    hp: 10,
    combatRevision: 12,
    processedActionIds: ["player:1:12:bond-cut"],
    processedSequenceByUid: { player: 12 },
    processedActionId: "player:1:12:bond-cut",
    processedActionUid: "player",
    processedActionSequence: 12,
    contributors: {
      player: {
        firstContributedAt: timestamp - 1_000,
        lastContributedAt: timestamp,
        actionTypes: ["bond-cut"],
      },
    },
    updatedAt: timestamp,
    ...overrides,
  });
}

async function seedChorus(environment, state, { sequence = null, playerMapId = "sanctuary-return-record" } = {}) {
  await environment.withSecurityRulesDisabled(async context => {
    const database = context.database();
    await set(ref(database, "rooms/public"), {
      players: {
        player: player({ mapId: playerMapId }),
      },
      chorus: {
        "sanctuary-return-record": {
          state: wireChorusEncounter(state),
          ...(sequence == null ? {} : { actionSequences: { player: sequence } }),
        },
      },
    });
  });
}

async function publishBoundChorusAction({
  playerDb,
  hostDb,
  sequence,
  revision,
  phase,
  type,
  fields,
  stateChanges,
  firstContribution = false,
  newActionType = false,
  createdAt = Date.now(),
}) {
  await assertSucceeds(runTransaction(
    ref(playerDb, `${chorusPath}/actionSequences/player`),
    current => (current || 0) + 1,
  ));
  const action = chorusAction("player", sequence, {
    id: `player:1:${sequence}:${type}`,
    phase,
    type,
    createdAt,
    ...fields,
  });
  await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/${sequence}`), action));
  await assertSucceeds(update(ref(hostDb, chorusPath), {
    ...Object.fromEntries(Object.entries(stateChanges).map(([path, value]) => [`state/${path}`, value])),
    "state/combatRevision": revision,
    "state/updatedAt": action.createdAt,
    ...(firstContribution ? {
      "state/contributors/player/firstContributedAt": action.createdAt,
    } : {}),
    "state/contributors/player/lastContributedAt": action.createdAt,
    ...(newActionType ? { [`state/contributors/player/actionTypes/${type}`]: true } : {}),
    "state/processedSequenceByUid/player": sequence,
    "state/processedActionId": action.id,
    "state/processedActionUid": "player",
    "state/processedActionSequence": sequence,
    "state/processedActionReceipt": chorusActionReceipt(action),
    "processedSequences/player": sequence,
  }));
  await assertSucceeds(remove(ref(hostDb, `${chorusPath}/actions/player/${sequence}`)));
  return action;
}

async function assertSucceedsAt(label, promise) {
  try {
    await assertSucceeds(promise);
  } catch (error) {
    error.message = `${label}: ${error.message}`;
    throw error;
  }
}

function encounter({ authorityUid = "host", authorityEpoch = 1, leaseUntil = Date.now() + 6_000 } = {}) {
  const now = Date.now();
  return {
    encounterId: "volcano-emulator-1",
    bossId: "volcano-core-imp",
    mapId: bossMapId,
    status: "alive",
    x: 1600,
    y: 1280,
    dir: "down",
    moving: false,
    hp: 120,
    maxHp: 120,
    phase: 1,
    authorityUid,
    authorityEpoch,
    leaseUntil,
    partySize: 2,
    spawnedAt: now,
    updatedAt: now,
  };
}

function player({ classId = "archer", equippedWeaponId = "training-bow", mapId = bossMapId, x = 1540, y = 1280, joinedAt = Date.now() } = {}) {
  return {
    x,
    y,
    hp: 100,
    joinedAt,
    dir: "right",
    moving: false,
    name: "RuleTester",
    color: "#38bdf8",
    mapId,
    classId,
    equippedWeaponId,
  };
}

function attackRequest(sequence, overrides = {}) {
  return {
    attackId: `fighter:volcano-emulator-1:${sequence}`,
    sequence,
    uid: "fighter",
    encounterId: "volcano-emulator-1",
    bossId: "volcano-core-imp",
    mapId: bossMapId,
    classId: "archer",
    weaponId: "training-bow",
    attackKind: "basic",
    playerX: 1540,
    playerY: 1280,
    direction: "right",
    createdAt: Date.now(),
    ...overrides,
  };
}

test("Realtime Database 규칙은 보스 읽기·관리자·공격·피해 권한을 실제로 강제한다", async () => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    await environment.clearDatabase();
    const hostDb = environment.authenticatedContext("host").database();
    const fighterDb = environment.authenticatedContext("fighter").database();
    const strangerDb = environment.authenticatedContext("stranger").database();
    const unauthenticatedDb = environment.unauthenticatedContext().database();

    await assertFails(get(ref(unauthenticatedDb, bossPath)));
    await assertFails(set(ref(unauthenticatedDb, "rooms/public/players/guest"), player()));

    await assertSucceeds(set(ref(fighterDb, "rooms/public/slots/0"), "fighter"));
    await assertFails(set(ref(strangerDb, "rooms/public/slots/0"), "stranger"));
    await assertFails(set(ref(fighterDb, "rooms/public/slots/10"), "fighter"));
    await assertSucceeds(remove(ref(fighterDb, "rooms/public/slots/0")));

    const fighterPlayer = player();
    await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), fighterPlayer));
    await assertFails(set(ref(fighterDb, "rooms/public/players/stranger"), player()));
    await assertFails(set(ref(fighterDb, "rooms/public/players/fighter"), {
      ...fighterPlayer, joinedAt: fighterPlayer.joinedAt - 1,
    }));
    await assertFails(set(ref(fighterDb, "rooms/public/players/fighter"), {
      ...fighterPlayer, mapId: "unknown",
    }));
    await assertFails(set(ref(fighterDb, "rooms/public/players/fighter"), {
      ...fighterPlayer, mapId: "coast",
    }));
    for (const mapId of [
      "village", "forest",
      "coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave",
      "volcano", "volcano-magma-route", "volcano-observatory", bossMapId,
      "sanctuary",
    ]) {
      await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), { ...fighterPlayer, mapId }));
    }
    await assertFails(set(ref(fighterDb, "rooms/public/players/fighter"), { ...fighterPlayer, x: 2160.1 }));
    await assertFails(set(ref(fighterDb, "rooms/public/players/fighter"), { ...fighterPlayer, y: 1800.1 }));
    await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), fighterPlayer));
    await assertFails(set(ref(fighterDb, "rooms/public/players/fighter"), {
      ...fighterPlayer, classId: "archer", equippedWeaponId: "starter-sword",
    }));
    await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), {
      ...fighterPlayer, classId: "archer", equippedWeaponId: "ember-tracker-bow",
    }));
    await assertFails(set(ref(fighterDb, "rooms/public/players/fighter"), {
      ...fighterPlayer, classId: "archer", equippedWeaponId: "volcanic-heartblade",
    }));
    const { classId: _classId, equippedWeaponId: _equippedWeaponId, ...legacyFighter } = fighterPlayer;
    await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), {
      ...legacyFighter, equippedWeaponId: "reinforced-masterwork-katana",
    }));
    await assertFails(set(ref(fighterDb, "rooms/public/players/fighter"), {
      ...legacyFighter, equippedWeaponId: "volcanic-heartblade",
    }));
    await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), fighterPlayer));

    await assertSucceeds(set(ref(hostDb, statePath), encounter()));
    await assertFails(set(ref(hostDb, "rooms/public/bosses/volcano/state"), {
      ...encounter(), mapId: "volcano",
    }));
    await assertSucceeds(get(ref(fighterDb, bossPath)));
    await assertFails(set(ref(strangerDb, statePath), { ...encounter(), hp: 100 }));

    await assertSucceeds(set(ref(fighterDb, `${bossPath}/attacks/fighter/1`), attackRequest(1)));
    await assertFails(set(ref(fighterDb, `${bossPath}/attacks/fighter/2`), attackRequest(2, {
      createdAt: Date.now() - 6_000,
    })));
    await assertFails(set(ref(fighterDb, `${bossPath}/attacks/fighter/3`), attackRequest(3, {
      damage: 999,
    })));
    await assertFails(set(ref(fighterDb, `${bossPath}/attacks/fighter/4`), attackRequest(4, {
      mapId: "forest",
    })));
    await assertFails(set(ref(fighterDb, `${bossPath}/attacks/fighter/5`), attackRequest(5, {
      weaponId: "starter-sword",
    })));
    await assertFails(set(ref(fighterDb, `${bossPath}/attacks/fighter/7`), attackRequest(8)));

    await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), {
      ...fighterPlayer, mapId: "coast-flooded-station",
    }));
    await assertFails(set(ref(fighterDb, `${bossPath}/attacks/fighter/6`), attackRequest(6)));
    await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), fighterPlayer));

    await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), {
      ...fighterPlayer, equippedWeaponId: "ember-tracker-bow",
    }));
    await assertSucceeds(set(ref(fighterDb, `${bossPath}/attacks/fighter/9`), attackRequest(9, {
      weaponId: "ember-tracker-bow",
    })));
    await assertFails(set(ref(fighterDb, `${bossPath}/attacks/fighter/10`), attackRequest(10, {
      classId: "archer", weaponId: "volcanic-heartblade",
    })));
    await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), fighterPlayer));

    const skillResource = { castId: "paid-e", mpBefore: 20, mpAfter: 0, originX: fighterPlayer.x, originY: fighterPlayer.y, direction: "right", createdAt: Date.now() };
    const paidPlayer = { ...fighterPlayer, level: 10, mp: 0, skinId: "slime", skillResources: { "skill-e": skillResource } };
    await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), paidPlayer));
    await assertSucceeds(set(ref(fighterDb, `${bossPath}/attacks/fighter/11`), attackRequest(11, { attackKind: "skill-e", castId: "paid-e", hitIndex: 0 })));
    await assertFails(set(ref(fighterDb, "rooms/public/players/fighter"), { ...paidPlayer, skinId: "unknown" }));
    for (const invalid of [{ ...skillResource, mpAfter: 20 }, { ...skillResource, mpBefore: -1 }, { ...skillResource, originX: 9999 }, { ...skillResource, direction: "diagonal" }]) {
      await assertFails(set(ref(fighterDb, "rooms/public/players/fighter"), { ...paidPlayer, skillResources: { "skill-e": invalid } }));
    }
    await assertSucceeds(set(ref(fighterDb, "rooms/public/players/fighter"), fighterPlayer));

    const damagePath = `${bossPath}/playerDamage/fighter/volcano-emulator-1:1:1`;
    const damage = {
      eventId: "volcano-emulator-1:1:1",
      encounterId: "volcano-emulator-1",
      bossId: "volcano-core-imp",
      targetUid: "fighter",
      authorityEpoch: 1,
      damage: 12,
      createdAt: Date.now(),
    };
    await assertSucceeds(set(ref(hostDb, damagePath), damage));
    await assertFails(remove(ref(strangerDb, damagePath)));
    await assertSucceeds(remove(ref(fighterDb, damagePath)));

    const defeatedAt = Date.now();
    const defeatedState = {
      ...encounter(),
      status: "defeated",
      hp: 0,
      defeatedAt,
      respawnAt: defeatedAt + 180_000,
      contributors: {
        fighter: { firstHitAt: defeatedAt - 1_000, lastHitAt: defeatedAt },
      },
    };
    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), statePath), defeatedState);
    });
    const claimPath = `${bossPath}/rewardClaims/volcano-emulator-1/fighter`;
    const claim = {
      encounterId: "volcano-emulator-1",
      bossId: "volcano-core-imp",
      uid: "fighter",
      exp: 220,
      gold: 150,
      eligible: true,
      expiresAt: defeatedAt + 86_400_000,
    };
    await assertFails(set(ref(hostDb, `${bossPath}/rewardClaims/old-encounter/fighter`), {
      ...claim,
      encounterId: "old-encounter",
    }));
    await assertFails(set(ref(strangerDb, claimPath), claim));
    await assertSucceeds(set(ref(hostDb, claimPath), claim));
    await assertFails(set(ref(strangerDb, claimPath), { ...claim, claimedAt: Date.now() }));
    await assertSucceeds(set(ref(fighterDb, claimPath), { ...claim, claimedAt: Date.now() }));

    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), statePath), encounter({ leaseUntil: Date.now() - 100 }));
    });
    await assertFails(set(ref(strangerDb, statePath), encounter({
      authorityUid: "stranger", authorityEpoch: 1,
    })));
    await assertSucceeds(set(ref(strangerDb, statePath), encounter({
      authorityUid: "stranger", authorityEpoch: 2,
    })));
  } finally {
    await environment.cleanup();
  }
});

test("Realtime Database 규칙은 sanctuary chorus 공유 경계와 canonical claim 경로를 강제한다", async () => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    await environment.clearDatabase();
    const hostDb = environment.authenticatedContext("host").database();
    const playerDb = environment.authenticatedContext("player").database();
    const otherDb = environment.authenticatedContext("other").database();
    const guestDb = environment.unauthenticatedContext().database();

    const sanctuaryPlayer = player({ mapId: "sanctuary" });
    for (const mapId of [
      "sanctuary",
      "sanctuary-memory-archive",
      "sanctuary-return-record",
      "sanctuary-three-futures",
    ]) {
      await assertSucceeds(set(ref(playerDb, "rooms/public/players/player"), { ...sanctuaryPlayer, mapId }));
      await assertSucceeds(set(ref(playerDb, `rooms/public/chat/player/${mapId}`), chat({ mapId })));
    }
    await assertFails(set(ref(playerDb, "rooms/public/players/player"), player({ mapId: "sanctuary-secret" })));
    await assertFails(set(ref(playerDb, "rooms/public/chat/player/secret"), chat({ mapId: "sanctuary-secret" })));
    await assertSucceeds(set(ref(playerDb, "rooms/public/players/player"), {
      ...sanctuaryPlayer, mapId: "sanctuary-return-record",
    }));

    await assertFails(update(ref(guestDb, chorusStatePath), wireChorusEncounter(chorusEncounter())));
    const initial = chorusEncounter();
    await assertSucceedsAt("initial-state", update(ref(hostDb, chorusStatePath), wireChorusEncounter(initial)));
    await assertSucceeds(get(ref(playerDb, chorusPath)));
    await assertFails(set(ref(otherDb, chorusStatePath), { ...initial, updatedAt: Date.now() }));
    await assertFails(update(ref(hostDb, chorusStatePath), {
      hp: 0,
      status: "separated",
      phase: "separated",
      combatRevision: 1,
      updatedAt: Date.now(),
    }));
    await assertFails(update(ref(hostDb, chorusStatePath), {
      stabilizedAnchorIds: ["forest", "coast", "volcano"],
      phase: "testimonies",
      hp: 70,
      combatRevision: 1,
      updatedAt: Date.now(),
    }));
    await assertFails(update(ref(hostDb, chorusStatePath), {
      damage: 999,
      combatRevision: 1,
      updatedAt: Date.now(),
    }));
    const oneAnchor = {
      ...initial,
      stabilizedAnchorIds: ["forest"],
      hp: 90,
      combatRevision: 1,
      processedActionIds: ["player:1:1:anchor-stabilize"],
      contributors: {
        player: {
          firstContributedAt: Date.now(),
          lastContributedAt: Date.now(),
          actionTypes: ["anchor-stabilize"],
        },
      },
      updatedAt: Date.now(),
    };
    await assertFails(update(ref(hostDb, chorusStatePath), {
      "stabilizedAnchorIds/forest": true,
      hp: oneAnchor.hp,
      combatRevision: oneAnchor.combatRevision,
      "contributors/player/firstContributedAt": oneAnchor.contributors.player.firstContributedAt,
      "contributors/player/lastContributedAt": oneAnchor.contributors.player.lastContributedAt,
      "contributors/player/actionTypes/anchor-stabilize": true,
      updatedAt: oneAnchor.updatedAt,
    }));
    await assertFails(update(ref(hostDb, chorusStatePath), {
      combatRevision: 1,
      "contributors/player/firstContributedAt": Date.now(),
      "contributors/player/lastContributedAt": Date.now(),
      "contributors/player/actionTypes/anchor-stabilize": true,
      updatedAt: Date.now(),
    }));

    const expiredState = chorusEncounter({ leaseUntil: Date.now() - 100 });
    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), expiredState);
    });
    const validTakeover = {
      ...expiredState,
      authorityUid: "other",
      authorityEpoch: 2,
      leaseUntil: Date.now() + 4_000,
      updatedAt: Date.now(),
    };
    const invalidTakeover = {
      ...validTakeover,
      stabilizedAnchorIds: ["forest", "coast", "volcano"],
      phase: "testimonies",
      hp: 70,
      combatRevision: 1,
    };
    await assertFails(update(ref(otherDb, chorusStatePath), {
      authorityUid: invalidTakeover.authorityUid,
      authorityEpoch: invalidTakeover.authorityEpoch,
      leaseUntil: invalidTakeover.leaseUntil,
      updatedAt: invalidTakeover.updatedAt,
      stabilizedAnchorIds: invalidTakeover.stabilizedAnchorIds,
      hp: invalidTakeover.hp,
      phase: invalidTakeover.phase,
      combatRevision: invalidTakeover.combatRevision,
    }));
    await assertFails(update(ref(otherDb, chorusStatePath), {
      authorityUid: validTakeover.authorityUid,
      authorityEpoch: 1,
      leaseUntil: validTakeover.leaseUntil,
      updatedAt: validTakeover.updatedAt,
    }));
    await assertFails(update(ref(hostDb, chorusStatePath), {
      leaseUntil: Date.now() + 4_000,
      updatedAt: Date.now(),
    }));
    await assertSucceedsAt("valid-takeover", update(ref(otherDb, chorusStatePath), {
      authorityUid: validTakeover.authorityUid,
      authorityEpoch: validTakeover.authorityEpoch,
      leaseUntil: validTakeover.leaseUntil,
      updatedAt: validTakeover.updatedAt,
    }));

    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), chorusEncounter({ leaseUntil: Date.now() + 6_000 }));
      await set(ref(context.database(), "rooms/public/players/player"), player({ mapId: "sanctuary-return-record" }));
    });
    await assertSucceeds(runTransaction(ref(playerDb, `${chorusPath}/actionSequences/player`), current => (current || 0) + 1));
    await assertFails(set(ref(otherDb, `${chorusPath}/actionSequences/player`), 2));
    await assertFails(set(ref(playerDb, `${chorusPath}/actionSequences/player`), 0));
    await assertFails(set(ref(playerDb, `${chorusPath}/actionSequences/player`), 3));

    await assertSucceedsAt("initial-fragment-action", set(ref(playerDb, `${chorusPath}/actions/player/1`), chorusAction("player", 1)));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/other/1`), chorusAction("other", 1)));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/2`), chorusAction("player", 2)));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/1`), chorusAction("player", 1, { id: "overwrite" })));
    await assertSucceeds(runTransaction(ref(playerDb, `${chorusPath}/actionSequences/player`), current => current + 1));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/2`), chorusAction("player", 2, { damage: 999 })));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/2`), chorusAction("player", 2, { hp: 0 })));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/2`), chorusAction("player", 2, { status: "separated" })));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/2`), chorusAction("player", 2, { type: "damage" })));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/2`), chorusAction("player", 2, { fragmentId: "secret" })));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/2`), chorusAction("player", 2, { createdAt: Date.now() - 5_100 })));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/2`), chorusAction("player", 2, { createdAt: Date.now() + 5_100 })));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/2`), chorusAction("player", 2, {
      type: "testimony-resolve",
      fragmentId: null,
      phase: "testimonies",
      testimonyId: "core-self-division-original",
      verdict: "fact",
    })));
    const queuedAnchor = chorusAction("player", 2, {
      id: "player:1:2:anchor-stabilize", type: "anchor-stabilize", anchorId: "forest",
    });
    await assertSucceedsAt("queued-anchor", set(ref(playerDb, `${chorusPath}/actions/player/2`), queuedAnchor));
    await assertFails(remove(ref(hostDb, `${chorusPath}/actions/player/2`)));
    await assertFails(update(ref(hostDb, chorusPath), {
      "state/stabilizedAnchorIds/coast": true,
      "state/hp": 90,
      "state/combatRevision": 1,
      "state/contributors/player/firstContributedAt": queuedAnchor.createdAt,
      "state/contributors/player/lastContributedAt": queuedAnchor.createdAt,
      "state/contributors/player/actionTypes/anchor-stabilize": true,
      "state/processedSequenceByUid/player": 2,
      "state/processedActionId": queuedAnchor.id,
      "state/processedActionUid": "player",
      "state/processedActionSequence": 2,
      "state/updatedAt": queuedAnchor.createdAt,
      "processedSequences/player": 2,
    }));
    await assertSucceedsAt("canonical-anchor-publish", update(ref(hostDb, chorusPath), {
      "state/stabilizedAnchorIds/forest": true,
      "state/hp": 90,
      "state/combatRevision": 1,
      "state/contributors/player/firstContributedAt": queuedAnchor.createdAt,
      "state/contributors/player/lastContributedAt": queuedAnchor.createdAt,
      "state/contributors/player/actionTypes/anchor-stabilize": true,
      "state/processedSequenceByUid/player": 2,
      "state/processedActionId": queuedAnchor.id,
      "state/processedActionUid": "player",
      "state/processedActionSequence": 2,
      "state/processedActionReceipt": chorusActionReceipt(queuedAnchor),
      "state/updatedAt": queuedAnchor.createdAt,
      "processedSequences/player": 2,
    }));
    await assertSucceeds(remove(ref(hostDb, `${chorusPath}/actions/player/2`)));
    const retainedReceipt = (await get(ref(hostDb, `${chorusStatePath}/processedActionReceipt`))).val();
    assert.deepEqual(retainedReceipt, chorusActionReceipt(queuedAnchor));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/2`), {
      ...queuedAnchor,
      id: "player:1:2:anchor-reinserted",
      createdAt: Date.now(),
    }));
    await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/2`), {
      ...queuedAnchor,
      anchorId: "coast",
      createdAt: Date.now(),
    }));

    await assertSucceeds(runTransaction(ref(playerDb, `${chorusPath}/actionSequences/player`), current => current + 1));
    await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/3`), chorusAction("player", 3, {
      type: "lumen-assist", fragmentId: null, anchorId: "coast",
    })));
    await assertFails(remove(ref(hostDb, `${chorusPath}/actions/player/3`)));
    await environment.withSecurityRulesDisabled(async context => {
      await remove(ref(context.database(), `${chorusPath}/actions/player/3`));
    });

    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), chorusEncounter({
        leaseUntil: Date.now() + 6_000,
        stabilizedAnchorIds: ["forest", "coast", "volcano"],
        phase: "testimonies",
        hp: 70,
        combatRevision: 3,
      }));
    });
    await assertSucceeds(runTransaction(ref(playerDb, `${chorusPath}/actionSequences/player`), current => current + 1));
    await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/4`), chorusAction("player", 4, {
      type: "testimony-resolve",
      fragmentId: null,
      phase: "testimonies",
      testimonyId: "core-self-division-original",
      verdict: "fact",
    })));
    await assertFails(remove(ref(hostDb, `${chorusPath}/actions/player/4`)));
    await environment.withSecurityRulesDisabled(async context => {
      await remove(ref(context.database(), `${chorusPath}/actions/player/4`));
    });

    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), chorusEncounter({
        leaseUntil: Date.now() + 6_000,
        stabilizedAnchorIds: ["forest", "coast", "volcano"],
        resolvedTestimonyIds: [
          "core-self-division-original",
          "lumen-caused-core-division",
          "lumen-touched-seal-to-delay-eruption",
          "return-delay-was-lumen-alone",
          "first-archivist-deletion-protected-everyone",
          "resonance-time-was-incident-time",
        ],
        phase: "onslaught",
        hp: 40,
        combatRevision: 9,
      }));
    });
    await assertSucceeds(runTransaction(ref(playerDb, `${chorusPath}/actionSequences/player`), current => current + 1));
    const queuedRecord = chorusAction("player", 5, {
      type: "record-activate", fragmentId: null, phase: "onslaught", recordId: "roan",
    });
    await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/5`), queuedRecord));
    await assertFails(remove(ref(hostDb, `${chorusPath}/actions/player/5`)));
    await environment.withSecurityRulesDisabled(async context => {
      await remove(ref(context.database(), `${chorusPath}/actions/player/5`));
    });

    await environment.withSecurityRulesDisabled(async context => {
      const timestamp = Date.now();
      await set(ref(context.database(), chorusStatePath), chorusEncounter({
        leaseUntil: timestamp + 30_000,
        stabilizedAnchorIds: ["forest", "coast", "volcano"],
        resolvedTestimonyIds: [
          "core-self-division-original",
          "lumen-caused-core-division",
          "lumen-touched-seal-to-delay-eruption",
          "return-delay-was-lumen-alone",
          "first-archivist-deletion-protected-everyone",
          "resonance-time-was-incident-time",
        ],
        phase: "onslaught",
        hp: 40,
        activeRecordId: "roan",
        vulnerableUntil: timestamp + 3_000,
        combatRevision: 10,
      }));
    });
    await assertSucceeds(runTransaction(ref(playerDb, `${chorusPath}/actionSequences/player`), current => current + 1));
    await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/6`), chorusAction("player", 6, {
      type: "bond-cut", fragmentId: null, phase: "onslaught", bondId: "roan",
    })));
    await assertFails(remove(ref(hostDb, `${chorusPath}/actions/player/6`)));
    await environment.withSecurityRulesDisabled(async context => {
      await remove(ref(context.database(), `${chorusPath}/actions/player/6`));
    });
    await assertFails(set(ref(otherDb, `${chorusPath}/actions/player/1`), null));
    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), chorusEncounter({ leaseUntil: Date.now() - 100 }));
    });
    await assertFails(remove(ref(hostDb, `${chorusPath}/actions/player/1`)));
    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), chorusEncounter({
        authorityEpoch: 2, leaseUntil: Date.now() + 30_000,
      }));
    });
    await assertSucceeds(remove(ref(hostDb, `${chorusPath}/actions/player/1`)));

    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), separatedChorusState({ leaseUntil: Date.now() - 100 }));
    });
    const claim = {
      encounterId: "chorus-emulator-1",
      uid: "player",
      eligible: true,
      createdAt: Date.now(),
    };
    const claimPath = `${chorusPath}/completionClaims/chorus-emulator-1/player`;
    await assertFails(set(ref(hostDb, claimPath), claim));
    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), separatedChorusState());
    });
    await assertFails(set(ref(hostDb, `${chorusPath}/completionClaims/player`), claim));
    await assertFails(set(ref(otherDb, claimPath), claim));
    await assertFails(set(ref(hostDb, `${chorusPath}/completionClaims/chorus-emulator-1/other`), {
      ...claim, uid: "other",
    }));
    await assertFails(set(ref(hostDb, claimPath), { ...claim, acknowledgedAt: Date.now() }));
    const inboxPath = `${chorusPath}/completionInbox/player`;
    await assertSucceeds(update(ref(hostDb, chorusPath), {
      "completionClaims/chorus-emulator-1/player": claim,
      "completionInbox/player": claim,
    }));
    await assertFails(set(ref(otherDb, `${chorusPath}/completionInbox/other`), {
      ...claim, uid: "other",
    }));
    await assertFails(set(ref(playerDb, inboxPath), {
      ...claim, encounterId: "fabricated-encounter", createdAt: Date.now() + 1,
    }));
    await assertFails(set(ref(otherDb, claimPath), { ...claim, acknowledgedAt: Date.now() }));
    await assertFails(set(ref(playerDb, claimPath), {
      ...claim, eligible: false, acknowledgedAt: Date.now(),
    }));
    await assertFails(set(ref(playerDb, claimPath), {
      ...claim, status: "separated", acknowledgedAt: Date.now(),
    }));
    const acknowledgedAt = Date.now();
    const acknowledgedClaim = { ...claim, acknowledgedAt };
    await assertSucceeds(set(ref(playerDb, claimPath), acknowledgedClaim));
    await assertFails(set(ref(playerDb, claimPath), { ...acknowledgedClaim, acknowledgedAt: acknowledgedAt + 1 }));
    await assertFails(set(ref(playerDb, claimPath), { ...acknowledgedClaim, createdAt: claim.createdAt + 1 }));
    await assertFails(set(ref(playerDb, claimPath), { ...acknowledgedClaim, encounterId: "other-encounter" }));
    await assertFails(set(ref(playerDb, claimPath), { ...acknowledgedClaim, uid: "other" }));
    await assertFails(set(ref(hostDb, claimPath), claim));
    await assertFails(remove(ref(playerDb, claimPath)));

    for (const privatePath of ["contamination/player", "carriedFragment/player", "chapters/player", "endingChoice/player"]) {
      await assertFails(set(ref(playerDb, `${chorusPath}/${privatePath}`), privatePath));
    }
    await assertFails(set(ref(playerDb, "rooms/public/chorus/sanctuary-secret/state"), chorusEncounter()));
  } finally {
    await environment.cleanup();
  }
});

test("offline contributor의 immutable evidence로 authority가 historical claim과 inbox를 전달한다", async () => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    const timestamp = Date.now();
    const authorityDb = environment.authenticatedContext("authority-b").database();
    const contributorDb = environment.authenticatedContext("contributor-a").database();
    const attackerDb = environment.authenticatedContext("attacker").database();
    const state = separatedChorusState({
      authorityUid: "authority-b",
      leaseUntil: timestamp + 6_000,
      contributors: {
        "contributor-a": {
          firstContributedAt: timestamp - 1_000,
          lastContributedAt: timestamp - 100,
          actionTypes: ["anchor-stabilize"],
        },
      },
      separatedAt: timestamp - 100,
      reformAt: timestamp + 29_900,
      updatedAt: timestamp - 100,
    });
    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), "rooms/public"), {
        players: {
          "contributor-a": player({ mapId: "sanctuary-return-record" }),
        },
        chorus: {
          "sanctuary-return-record": {
            state: wireChorusEncounter(state),
          },
        },
      });
    });
    await assertSucceeds(remove(ref(contributorDb, "rooms/public/players/contributor-a")));
    assert.equal((await get(ref(authorityDb, "rooms/public/players/contributor-a"))).exists(), false);

    const claim = {
      encounterId: state.encounterId,
      uid: "contributor-a",
      eligible: true,
      createdAt: timestamp,
    };
    await assertSucceeds(update(ref(authorityDb, chorusPath), {
      [`completionClaims/${state.encounterId}/contributor-a`]: claim,
      "completionInbox/contributor-a": claim,
    }));
    assert.deepEqual(
      (await get(ref(contributorDb, `${chorusPath}/completionInbox/contributor-a`))).val(),
      claim,
    );

    const nonContributorClaim = {
      encounterId: state.encounterId,
      uid: "noncontributor",
      eligible: true,
      createdAt: timestamp + 1,
    };
    await assertFails(update(ref(authorityDb, chorusPath), {
      [`completionClaims/${state.encounterId}/noncontributor`]: nonContributorClaim,
      "completionInbox/noncontributor": nonContributorClaim,
    }));
    await assertFails(update(ref(attackerDb, chorusPath), {
      [`completionClaims/${state.encounterId}/contributor-a`]: claim,
      "completionInbox/contributor-a": claim,
    }));
    await assertFails(update(ref(authorityDb, chorusPath), {
      [`completionClaims/${state.encounterId}/contributor-a`]: {
        ...claim,
        uid: "attacker",
      },
      "completionInbox/contributor-a": claim,
    }));
  } finally {
    await environment.cleanup();
  }
});

test("Round 1 pressure는 structured state와 parent fan-out 우회를 거부한다", async t => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    await environment.clearDatabase();
    const hostDb = environment.authenticatedContext("host").database();
    const playerDb = environment.authenticatedContext("player").database();
    const otherDb = environment.authenticatedContext("other").database();

    await t.test("nonempty structured state의 same-revision lease renewal은 허용한다", async () => {
      const current = oneAnchorChorusState();
      await seedChorus(environment, current);
      await assertSucceeds(update(ref(hostDb, chorusStatePath), {
        leaseUntil: current.leaseUntil + 1_000,
      }));
    });

    await t.test("nonempty structured state의 immutable takeover는 허용한다", async () => {
      const current = oneAnchorChorusState({ leaseUntil: Date.now() - 100 });
      await seedChorus(environment, current);
      await assertSucceeds(update(ref(otherDb, chorusStatePath), {
        authorityUid: "other",
        authorityEpoch: 2,
        leaseUntil: Date.now() + 4_000,
        updatedAt: Date.now(),
      }));
    });

    await t.test("same-revision의 nonempty structured replacement를 거부한다", async () => {
      const current = onslaughtChorusState();
      await seedChorus(environment, current);
      await assertFails(update(ref(hostDb, chorusStatePath), {
        stabilizedAnchorIds: membership(["coast", "forest", "volcano"]),
        resolvedTestimonyIds: membership([...current.resolvedTestimonyIds].reverse()),
        severedBondIds: membership(["sera", "roan", "garen"]),
        processedActionIds: membership(["player:1:1:fragment-strike"]),
        "contributors/player": {
          ...current.contributors.player,
          actionTypes: membership(["record-activate"]),
        },
      }));
    });

    await t.test("expired takeover의 nonempty structured replacement를 거부한다", async () => {
      const current = onslaughtChorusState({ leaseUntil: Date.now() - 100 });
      await seedChorus(environment, current);
      await assertFails(update(ref(otherDb, chorusStatePath), {
        authorityUid: "other",
        authorityEpoch: 2,
        leaseUntil: Date.now() + 4_000,
        updatedAt: Date.now(),
        stabilizedAnchorIds: membership(["coast", "forest", "volcano"]),
        resolvedTestimonyIds: membership([...current.resolvedTestimonyIds].reverse()),
        severedBondIds: membership(["sera", "roan", "garen"]),
        processedActionIds: membership(["player:1:1:fragment-strike"]),
        "contributors/player": {
          ...current.contributors.player,
            actionTypes: membership(["record-activate"]),
        },
      }));
    });

    await t.test("direct chorus parent set으로 structured state를 교체하지 못한다", async () => {
      const current = oneAnchorChorusState();
      await seedChorus(environment, current);
      await assertFails(set(ref(hostDb, chorusPath), {
        state: {
          ...current,
          stabilizedAnchorIds: ["coast"],
          processedActionIds: ["player:1:1:fragment-strike"],
          contributors: {
            player: {
              ...current.contributors.player,
              actionTypes: ["fragment-strike"],
            },
          },
        },
      }));
    });

    await t.test("final player map을 벗어나는 action fan-out을 거부하되 정상 leave/chat은 허용한다", async () => {
      const current = chorusEncounter({ leaseUntil: Date.now() + 30_000 });
      await seedChorus(environment, current, { sequence: 2 });
      await assertSucceeds(update(ref(playerDb, "rooms/public"), {
        "players/player/mapId": "sanctuary",
        "chat/player/round1-leave": chat({ mapId: "sanctuary" }),
      }));
      await assertSucceeds(update(ref(playerDb, "rooms/public/players/player"), {
        mapId: "sanctuary-return-record",
      }));
      await assertFails(update(ref(playerDb, "rooms/public"), {
        "players/player/mapId": "sanctuary",
        [`chorus/sanctuary-return-record/actions/player/2`]: chorusAction("player", 2),
      }));
    });

    await t.test("claim 생성과 contributor/status fan-out 변조를 함께 허용하지 않는다", async () => {
      const current = separatedChorusState();
      await seedChorus(environment, current);
      await assertFails(update(ref(hostDb, "rooms/public"), {
        "chorus/sanctuary-return-record/state/status": "reforming",
        "chorus/sanctuary-return-record/state/combatRevision": current.combatRevision + 1,
        "chorus/sanctuary-return-record/state/updatedAt": Date.now(),
        "chorus/sanctuary-return-record/state/contributors/player": null,
        "chorus/sanctuary-return-record/completionClaims/chorus-emulator-1/player": {
          encounterId: "chorus-emulator-1",
          uid: "player",
          eligible: true,
          createdAt: Date.now(),
        },
      }));
    });
  } finally {
    await environment.cleanup();
  }
});

test("Round 1 pressure는 encounter/action ID 문법을 runtime-compatible하게 강제한다", async t => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    await environment.clearDatabase();
    const hostDb = environment.authenticatedContext("host").database();
    const playerDb = environment.authenticatedContext("player").database();

    await t.test("state encounterId의 Firebase 비호환 문자와 제어문자를 거부한다", async () => {
      const accepted = [];
      for (const encounterId of ["bad/id", "bad.id", "bad#id", "bad$id", "bad[id", "bad]id", "bad\u0001id"] ) {
        try {
          await assertFails(update(ref(hostDb, chorusStatePath), chorusEncounter({ encounterId })));
        } catch {
          accepted.push(JSON.stringify(encounterId));
          await environment.withSecurityRulesDisabled(async context => {
            await remove(ref(context.database(), chorusStatePath));
          });
        }
      }
      assert.deepEqual(accepted, []);
    });

    await t.test("action ID의 공백·제어문자·Firebase 비호환 문자를 거부한다", async () => {
      await seedChorus(environment, chorusEncounter({ leaseUntil: Date.now() + 30_000 }), { sequence: 1 });
      const accepted = [];
      for (const id of [
        " player:1:1:fragment-strike",
        "player:1:1:fragment-strike ",
        "player/1/1/fragment-strike",
        "player.1.1.fragment-strike",
        "player#1#1#fragment-strike",
        "player$1$1$fragment-strike",
        "player[1]:1:fragment-strike",
        "player:1:\u0001:fragment-strike",
      ]) {
        try {
          await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/1`), chorusAction("player", 1, { id })));
        } catch {
          accepted.push(JSON.stringify(id));
          await environment.withSecurityRulesDisabled(async context => {
            await remove(ref(context.database(), `${chorusPath}/actions/player/1`));
          });
        }
      }
      assert.deepEqual(accepted, []);
    });
  } finally {
    await environment.cleanup();
  }
});

test("Round 1 pressure는 state lifecycle과 required field 경계를 강제한다", async t => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    await environment.clearDatabase();
    const hostDb = environment.authenticatedContext("host").database();

    await t.test("onslaught에서 reforming으로 건너뛰지 못한다", async () => {
      const current = onslaughtChorusState();
      await seedChorus(environment, current);
      await assertFails(update(ref(hostDb, chorusStatePath), {
        status: "reforming",
        phase: "separated",
        hp: 0,
        severedBondIds: ["roan", "sera", "garen", "lumen"],
        combatRevision: current.combatRevision + 1,
        separatedAt: Date.now(),
        updatedAt: Date.now(),
      }));
    });

    await t.test("separated terminal은 reforming revision이나 rollback을 허용하지 않는다", async () => {
      const separated = separatedChorusState();
      await seedChorus(environment, separated);
      const reforming = {
        status: "reforming",
        combatRevision: separated.combatRevision + 1,
        updatedAt: Date.now(),
      };
      await assertFails(update(ref(hostDb, chorusStatePath), reforming));
      await assertFails(update(ref(hostDb, chorusStatePath), {
        status: "separated",
        combatRevision: separated.combatRevision + 1,
        updatedAt: Date.now(),
      }));
    });

    await t.test("stale revision과 required child 삭제를 거부한다", async () => {
      const current = oneAnchorChorusState();
      await seedChorus(environment, current);
      await assertFails(update(ref(hostDb, chorusStatePath), {
        combatRevision: current.combatRevision - 1,
      }));
      await assertFails(remove(ref(hostDb, `${chorusStatePath}/encounterId`)));
      await assertFails(remove(ref(hostDb, `${chorusStatePath}/authorityEpoch`)));
      await assertFails(remove(ref(hostDb, `${chorusStatePath}/processedSequenceByUid`)));
      await assertFails(remove(ref(hostDb, `${chorusStatePath}/contributors`)));
      await assertFails(update(ref(hostDb, chorusStatePath), {
        processedSequenceByUid: null,
        combatRevision: current.combatRevision + 1,
        updatedAt: Date.now(),
      }));
      await assertFails(update(ref(hostDb, chorusStatePath), {
        "contributors/player": null,
        combatRevision: current.combatRevision + 1,
        updatedAt: Date.now(),
      }));
    });
  } finally {
    await environment.cleanup();
  }
});

test("Round 1 pressure는 action payload와 objective ID 전체 경계를 강제한다", async () => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    await environment.clearDatabase();
    const playerDb = environment.authenticatedContext("player").database();
    const expectActionDenied = async (state, overrides, options = {}) => {
      await seedChorus(environment, state, { sequence: 1, ...options });
      await assertFails(set(ref(playerDb, `${chorusPath}/actions/player/1`), chorusAction("player", 1, overrides)));
    };

    const anchors = chorusEncounter({ leaseUntil: Date.now() + 30_000 });
    await expectActionDenied(anchors, {}, { playerMapId: "sanctuary" });
    await expectActionDenied(anchors, { uid: "other" });
    await expectActionDenied(anchors, { encounterId: "other-encounter" });
    await expectActionDenied(anchors, { authorityEpoch: 2 });
    await expectActionDenied(anchors, { fragmentId: "void" });
    await expectActionDenied(anchors, { type: "anchor-stabilize", anchorId: "void" });
    await expectActionDenied(anchors, { type: "lumen-assist", fragmentId: null, anchorId: "void" });

    const testimonies = chorusEncounter({
      leaseUntil: Date.now() + 30_000,
      stabilizedAnchorIds: ["forest", "coast", "volcano"],
      phase: "testimonies",
      hp: 70,
      combatRevision: 3,
    });
    await expectActionDenied(testimonies, {
      type: "testimony-resolve", fragmentId: null, phase: "testimonies",
      testimonyId: "void", verdict: "fact",
    });
    await expectActionDenied(testimonies, {
      type: "testimony-resolve", fragmentId: null, phase: "testimonies",
      testimonyId: "core-self-division-original", verdict: "invented",
    });

    const onslaught = onslaughtChorusState();
    await expectActionDenied(onslaught, {
      type: "record-activate", fragmentId: null, phase: "onslaught", recordId: "void",
    });
    await expectActionDenied(onslaught, {
      type: "bond-cut", fragmentId: null, phase: "onslaught", bondId: "void",
    });
  } finally {
    await environment.cleanup();
  }
});

test("Round 2 pressure는 objective membership을 순서와 무관하게 누적한다", async t => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    const hostDb = environment.authenticatedContext("host").database();
    const playerDb = environment.authenticatedContext("player").database();

    await t.test("forest/coast/volcano의 모든 첫·후속 순열을 허용한다", async () => {
      for (const order of permutations(anchorIds)) {
        await environment.clearDatabase();
        const initial = wireChorusEncounter(chorusEncounter({ leaseUntil: Date.now() + 6_000 }));
        await seedChorus(environment, initial);
        for (let index = 0; index < order.length; index += 1) {
          const complete = index === order.length - 1;
          await publishBoundChorusAction({
            playerDb,
            hostDb,
            sequence: index + 1,
            revision: index + 1,
            phase: "anchors",
            type: "anchor-stabilize",
            fields: { fragmentId: order[index], anchorId: order[index] },
            stateChanges: {
              [`stabilizedAnchorIds/${order[index]}`]: true,
              hp: 100 - (index + 1) * 10,
              ...(complete ? { phase: "testimonies" } : {}),
            },
            firstContribution: index === 0,
            newActionType: index === 0,
          });
        }
      }
    });

    await t.test("모든 testimony ID를 첫 번째와 두 번째 어느 순서로도 추가할 수 있다", async () => {
      for (const first of testimonyIds) {
        for (const second of testimonyIds.filter(id => id !== first)) {
          await environment.clearDatabase();
          await seedChorus(environment, wireChorusEncounter(chorusEncounter({
            leaseUntil: Date.now() + 6_000,
            stabilizedAnchorIds: anchorIds,
            phase: "testimonies",
            hp: 70,
            combatRevision: 3,
          })));
          await publishBoundChorusAction({
            playerDb,
            hostDb,
            sequence: 1,
            revision: 4,
            phase: "testimonies",
            type: "testimony-resolve",
            fields: {
              fragmentId: null,
              testimonyId: first,
              verdict: ({
                "core-self-division-original": "fact",
                "lumen-caused-core-division": "unsupported",
                "lumen-touched-seal-to-delay-eruption": "fact",
                "return-delay-was-lumen-alone": "unsupported",
                "first-archivist-deletion-protected-everyone": "partial",
                "resonance-time-was-incident-time": "unsupported",
              })[first],
            },
            stateChanges: { [`resolvedTestimonyIds/${first}`]: true, hp: 65 },
            firstContribution: true,
            newActionType: true,
          });
          await publishBoundChorusAction({
            playerDb,
            hostDb,
            sequence: 2,
            revision: 5,
            phase: "testimonies",
            type: "testimony-resolve",
            fields: {
              fragmentId: null,
              testimonyId: second,
              verdict: ({
                "core-self-division-original": "fact",
                "lumen-caused-core-division": "unsupported",
                "lumen-touched-seal-to-delay-eruption": "fact",
                "return-delay-was-lumen-alone": "unsupported",
                "first-archivist-deletion-protected-everyone": "partial",
                "resonance-time-was-incident-time": "unsupported",
              })[second],
            },
            stateChanges: { [`resolvedTestimonyIds/${second}`]: true, hp: 60 },
          });
        }
      }
    });

    await t.test("bond membership leaf도 record activation 순서대로 기존 membership을 보존하며 누적한다", async () => {
      const current = wireChorusEncounter(chorusEncounter({
        leaseUntil: Date.now() + 6_000,
        stabilizedAnchorIds: anchorIds,
        resolvedTestimonyIds: testimonyIds,
        phase: "onslaught",
        hp: 40,
        combatRevision: 9,
      }));
      await seedChorus(environment, current);
      const roanActivatedAt = Date.now();
      await publishBoundChorusAction({
        playerDb,
        hostDb,
        sequence: 1,
        revision: 10,
        phase: "onslaught",
        type: "record-activate",
        fields: { fragmentId: null, recordId: "roan" },
        stateChanges: {
          activeRecordId: "roan",
          vulnerableUntil: roanActivatedAt + 3_000,
        },
        firstContribution: true,
        newActionType: true,
        createdAt: roanActivatedAt,
      });
      await publishBoundChorusAction({
        playerDb,
        hostDb,
        sequence: 2,
        revision: 11,
        phase: "onslaught",
        type: "bond-cut",
        fields: { fragmentId: null, bondId: "roan" },
        stateChanges: {
          "severedBondIds/roan": true,
          activeRecordId: null,
          vulnerableUntil: 0,
          hp: 30,
        },
        newActionType: true,
      });
      const seraActivatedAt = Date.now();
      await publishBoundChorusAction({
        playerDb,
        hostDb,
        sequence: 3,
        revision: 12,
        phase: "onslaught",
        type: "record-activate",
        fields: { fragmentId: null, recordId: "sera" },
        stateChanges: {
          activeRecordId: "sera",
          vulnerableUntil: seraActivatedAt + 3_000,
        },
        createdAt: seraActivatedAt,
      });
      await publishBoundChorusAction({
        playerDb,
        hostDb,
        sequence: 4,
        revision: 13,
        phase: "onslaught",
        type: "bond-cut",
        fields: { fragmentId: null, bondId: "sera" },
        stateChanges: {
          "severedBondIds/sera": true,
          activeRecordId: null,
          vulnerableUntil: 0,
          hp: 20,
        },
      });
    });

    await t.test("기존 bond 단계 순서는 membership map에서도 건너뛸 수 없다", async () => {
      const current = wireChorusEncounter(chorusEncounter({
        leaseUntil: Date.now() + 6_000,
        stabilizedAnchorIds: anchorIds,
        resolvedTestimonyIds: testimonyIds,
        phase: "onslaught",
        hp: 40,
        combatRevision: 9,
      }));
      await seedChorus(environment, current);
      await assertFails(update(ref(hostDb, chorusStatePath), {
        "severedBondIds/sera": true,
        hp: 30,
        combatRevision: 10,
        updatedAt: Date.now(),
      }));
    });
  } finally {
    await environment.cleanup();
  }
});

test("Round 2 pressure는 receipt와 contributor history를 add-only로 보존한다", async t => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    const hostDb = environment.authenticatedContext("host").database();

    await t.test("legacy processed array의 replacement 취약성을 재현해 거부한다", async () => {
      const current = oneAnchorChorusState({
        processedActionIds: ["old-action", "kept-action"],
      });
      await seedChorus(environment, current);
      await assertFails(update(ref(hostDb, chorusStatePath), {
        processedActionIds: ["replacement-action"],
        combatRevision: current.combatRevision + 1,
        updatedAt: Date.now(),
      }));
    });

    await t.test("processed sequence watermark의 감소와 UID replacement를 거부한다", async () => {
      const current = wireChorusEncounter(oneAnchorChorusState({
        processedSequenceByUid: { player: 10 },
        processedActionUid: "player",
        processedActionSequence: 10,
      }));
      await seedChorus(environment, current);
      await assertFails(update(ref(hostDb, chorusStatePath), {
        "processedSequenceByUid/player": 9,
        processedActionSequence: 9,
        combatRevision: 2,
        updatedAt: Date.now(),
      }));
      await assertFails(update(ref(hostDb, chorusStatePath), {
        processedSequenceByUid: { other: 11 },
        processedActionUid: "other",
        processedActionSequence: 11,
        combatRevision: 2,
        updatedAt: Date.now(),
      }));
    });

    await t.test("legacy contributor actionTypes replacement 취약성을 재현해 거부한다", async () => {
      const current = oneAnchorChorusState();
      await seedChorus(environment, current);
      await assertFails(update(ref(hostDb, chorusStatePath), {
        "contributors/player": {
          ...current.contributors.player,
          actionTypes: ["fragment-strike"],
        },
        combatRevision: current.combatRevision + 1,
        updatedAt: Date.now(),
      }));
    });

    await t.test("actionTypes membership의 shrink와 replacement를 거부한다", async () => {
      const current = wireChorusEncounter(oneAnchorChorusState({
        contributors: {
          player: {
            firstContributedAt: Date.now() - 1_000,
            lastContributedAt: Date.now(),
            actionTypes: ["fragment-strike", "anchor-stabilize"],
          },
        },
      }));
      await seedChorus(environment, current);
      for (const replacement of [membership(["fragment-strike"]), membership(["bond-cut"])]) {
        await assertFails(update(ref(hostDb, chorusStatePath), {
          "contributors/player/actionTypes": replacement,
          combatRevision: 2,
          updatedAt: Date.now(),
        }));
      }
    });

    await t.test("objective membership removal과 replacement를 거부한다", async () => {
      const current = wireChorusEncounter(chorusEncounter({
        leaseUntil: Date.now() + 30_000,
        stabilizedAnchorIds: ["forest", "coast"],
        hp: 80,
        combatRevision: 2,
      }));
      await seedChorus(environment, current);
      await assertFails(update(ref(hostDb, chorusStatePath), {
        stabilizedAnchorIds: membership(["forest", "volcano"]),
        combatRevision: 3,
        updatedAt: Date.now(),
      }));
      await assertFails(update(ref(hostDb, chorusStatePath), {
        "stabilizedAnchorIds/coast": null,
        combatRevision: 3,
        updatedAt: Date.now(),
      }));
    });

    await t.test("정상 revision은 새 receipt와 action type만 누적한다", async () => {
      const timestamp = Date.now();
      const current = wireChorusEncounter(oneAnchorChorusState({
        leaseUntil: timestamp + 6_000,
        updatedAt: timestamp - 500,
        contributors: {
          player: {
            firstContributedAt: timestamp - 1_000,
            lastContributedAt: timestamp - 500,
            actionTypes: ["anchor-stabilize"],
          },
        },
      }));
      await seedChorus(environment, current, { sequence: 2 });
      await assertSucceeds(set(ref(environment.authenticatedContext("player").database(), `${chorusPath}/actions/player/2`),
        chorusAction("player", 2, { createdAt: timestamp })));
      await assertSucceeds(update(ref(hostDb, chorusPath), {
        "state/processedSequenceByUid/player": 2,
        "state/processedActionId": "player:1:2:fragment-strike",
        "state/processedActionUid": "player",
        "state/processedActionSequence": 2,
        "state/processedActionReceipt": chorusActionReceipt(chorusAction("player", 2, { createdAt: timestamp })),
        "state/contributors/player/lastContributedAt": timestamp,
        "state/contributors/player/actionTypes/fragment-strike": true,
        "state/combatRevision": 2,
        "state/updatedAt": timestamp,
        "processedSequences/player": 2,
      }));
      const stored = (await get(ref(hostDb, chorusStatePath))).val();
      assert.equal(stored.processedSequenceByUid.player, 2);
      assert.equal(Object.hasOwn(stored, "processedActionIds"), false);
      assert.equal(stored.contributors.player.actionTypes["anchor-stabilize"], true);
      assert.equal(stored.contributors.player.actionTypes["fragment-strike"], true);
    });
  } finally {
    await environment.cleanup();
  }
});

test("Round 2 pressure는 empty membership과 malformed childful collection을 구분한다", async t => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    const hostDb = environment.authenticatedContext("host").database();

    await t.test("empty fixed collection 대신 scalar를 쓰는 initial state를 거부한다", async () => {
      await assertFails(update(ref(hostDb, chorusStatePath), {
        ...wireChorusEncounter(chorusEncounter()),
        stabilizedAnchorIds: false,
      }));
    });

    await t.test("sparse legacy processed object를 거부한다", async () => {
      const current = wireChorusEncounter(oneAnchorChorusState());
      await seedChorus(environment, current);
      await assertFails(update(ref(hostDb, chorusStatePath), {
        processedActionIds: { 255: "sparse-action" },
        combatRevision: 2,
        updatedAt: Date.now(),
      }));
    });

    await t.test("duplicate-looking fixed array object를 거부한다", async () => {
      await assertFails(update(ref(hostDb, chorusStatePath), {
        ...wireChorusEncounter(chorusEncounter()),
        stabilizedAnchorIds: { 0: "forest", 1: "forest" },
      }));
    });

    await t.test("scalar actionTypes를 가진 contributor를 거부한다", async () => {
      const current = wireChorusEncounter(chorusEncounter({ leaseUntil: Date.now() + 6_000 }));
      await seedChorus(environment, current);
      await assertFails(update(ref(hostDb, chorusStatePath), {
        "contributors/player/firstContributedAt": Date.now(),
        "contributors/player/lastContributedAt": Date.now(),
        "contributors/player/actionTypes": true,
        combatRevision: 1,
        updatedAt: Date.now(),
      }));
    });
  } finally {
    await environment.cleanup();
  }
});

test("Round 2 pressure는 expired lease takeover의 동시 contender를 CAS로 한 명만 허용한다", async () => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    const expired = wireChorusEncounter(oneAnchorChorusState({ leaseUntil: Date.now() - 100 }));
    await seedChorus(environment, expired);
    const contenderA = environment.authenticatedContext("contender-a").database();
    const contenderB = environment.authenticatedContext("contender-b").database();
    const takeover = uid => update(ref(uid === "contender-a" ? contenderA : contenderB, chorusStatePath), {
      authorityUid: uid,
      authorityEpoch: expired.authorityEpoch + 1,
      leaseUntil: Date.now() + 4_000,
      updatedAt: Date.now(),
    });

    const results = await Promise.allSettled([takeover("contender-a"), takeover("contender-b")]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected").length, 1);
    const stored = (await get(ref(contenderA, chorusStatePath))).val();
    assert.equal(["contender-a", "contender-b"].includes(stored.authorityUid), true);
    assert.equal(stored.authorityEpoch, expired.authorityEpoch + 1);
  } finally {
    await environment.cleanup();
  }
});

test("Round 3 pressure는 replay receipt를 per-UID sequence watermark로 제한한다", async t => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    const hostDb = environment.authenticatedContext("host").database();
    const playerDb = environment.authenticatedContext("player").database();

    await t.test("authority가 한 revision에 임의 receipt key를 대량 추가하지 못한다", async () => {
      const state = chorusEncounter({ leaseUntil: Date.now() + 6_000 });
      await seedChorus(environment, state);
      const receiptFlood = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [
        `processedActionIds/forged-receipt-${index}`,
        true,
      ]));
      await assertFails(update(ref(hostDb, chorusStatePath), {
        ...receiptFlood,
        combatRevision: 1,
        updatedAt: Date.now(),
      }));
    });

    await t.test("gap을 가진 high sequence pending action과 state를 하나의 watermark publish로 확정한다", async () => {
      const state = chorusEncounter({ leaseUntil: Date.now() + 6_000 });
      await seedChorus(environment, state);
      await environment.withSecurityRulesDisabled(async context => {
        await set(ref(context.database(), `${chorusPath}/actionSequences/player`), 10_000);
      });
      const timestamp = Date.now();
      const action = chorusAction("player", 10_000, { createdAt: timestamp });
      await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/10000`), action));
      await assertFails(remove(ref(hostDb, `${chorusPath}/actions/player/10000`)));

      await assertSucceeds(update(ref(hostDb, chorusPath), {
        "state/processedSequenceByUid/player": 10_000,
        "state/processedActionId": action.id,
        "state/processedActionUid": "player",
        "state/processedActionSequence": 10_000,
        "state/processedActionReceipt": chorusActionReceipt(action),
        "state/contributors/player/firstContributedAt": timestamp,
        "state/contributors/player/lastContributedAt": timestamp,
        "state/contributors/player/actionTypes/fragment-strike": true,
        "state/combatRevision": 1,
        "state/updatedAt": timestamp,
        "processedSequences/player": 10_000,
      }));
      await assertSucceeds(remove(ref(hostDb, `${chorusPath}/actions/player/10000`)));
      const stored = (await get(ref(hostDb, chorusStatePath))).val();
      assert.deepEqual(stored.processedSequenceByUid, { player: 10_000 });
      assert.equal(stored.processedActionUid, "player");
      assert.equal(stored.processedActionSequence, 10_000);
      assert.equal(Object.hasOwn(stored, "processedActionIds"), false);
    });

    await t.test("watermark는 exact pending action의 uid sequence encounter epoch phase에 결속된다", async () => {
      const timestamp = Date.now();
      const state = chorusEncounter({ leaseUntil: timestamp + 6_000 });
      const mismatches = [
        { uid: "other" },
        { sequence: 76 },
        { encounterId: "other-encounter" },
        { authorityEpoch: 2 },
        { phase: "testimonies" },
      ];
      for (const overrides of mismatches) {
        await seedChorus(environment, state);
        await environment.withSecurityRulesDisabled(async context => {
          await set(ref(context.database(), `${chorusPath}/actions/player/77`),
            chorusAction("player", 77, { ...overrides, createdAt: timestamp }));
        });
        await assertFails(update(ref(hostDb, chorusStatePath), {
          "processedSequenceByUid/player": 77,
          processedActionUid: "player",
          processedActionSequence: 77,
          combatRevision: 1,
          updatedAt: timestamp,
        }));
      }
      await seedChorus(environment, state);
      await assertFails(update(ref(hostDb, chorusStatePath), {
        "processedSequenceByUid/player": 77,
        processedActionUid: "player",
        processedActionSequence: 77,
        combatRevision: 1,
        updatedAt: timestamp,
      }));
    });

    await t.test("한 combat revision에는 서로 다른 UID watermark를 둘 이상 전진시키지 못한다", async () => {
      const timestamp = Date.now();
      const state = chorusEncounter({ leaseUntil: timestamp + 6_000 });
      await seedChorus(environment, state);
      await environment.withSecurityRulesDisabled(async context => {
        const database = context.database();
        await set(ref(database, `${chorusPath}/actions/player/5`), chorusAction("player", 5, { createdAt: timestamp }));
        await set(ref(database, `${chorusPath}/actions/other/8`), chorusAction("other", 8, { createdAt: timestamp }));
      });
      await assertFails(update(ref(hostDb, chorusStatePath), {
        "processedSequenceByUid/player": 5,
        "processedSequenceByUid/other": 8,
        processedActionUid: "player",
        processedActionSequence: 5,
        combatRevision: 1,
        updatedAt: timestamp,
      }));
    });

    await t.test("실제 emulator snapshot에서 confirmed watermark 이하 late action을 network가 숨긴다", async () => {
      const timestamp = Date.now();
      const state = chorusEncounter({
        authorityUid: "host",
        leaseUntil: timestamp + 6_000,
        processedSequenceByUid: { player: 500 },
        processedActionUid: "player",
        processedActionSequence: 500,
      });
      await seedChorus(environment, state);
      await environment.withSecurityRulesDisabled(async context => {
        const database = context.database();
        await set(ref(database, `${chorusPath}/actions/player/12`), chorusAction("player", 12, { createdAt: timestamp }));
        await set(ref(database, `${chorusPath}/actions/player/501`), chorusAction("player", 501, { createdAt: timestamp }));
      });
      const { createChorusNetwork } = await import("../src/sanctuary-chorus-network-20260911-sanctuary.js");
      const received = [];
      const network = createChorusNetwork({
        dbModule: { get, onValue, ref, remove, runTransaction, serverTimestamp, set, update },
        db: hostDb,
        roomId: "public",
        uid: "host",
        callbacks: { onActionsChanged: actions => received.push(actions) },
        now: () => timestamp,
        timers: { set: () => 1, clear: () => {} },
      });
      await network.setMap("sanctuary-return-record");
      await waitFor(() => received.some(actions => actions?.player?.[501]));
      const delivered = received.find(actions => actions?.player?.[501]);
      assert.equal(Object.hasOwn(delivered.player, "12"), false);
      assert.equal(delivered.player[501].sequence, 501);
      assert.deepEqual(network.processedSequenceByUid, { player: 500 });
      assert.equal(Array.isArray(network.latestState.processedActionIds), true);
      await network.stop();
    });

    await t.test("expired lease의 동시 contender 중 하나만 watermark를 보존해 takeover한다", async () => {
      const expired = wireChorusEncounter(oneAnchorChorusState({
        leaseUntil: Date.now() - 100,
        processedSequenceByUid: { player: 10_000 },
        processedActionUid: "player",
        processedActionSequence: 10_000,
      }));
      await seedChorus(environment, expired);
      const contenderA = environment.authenticatedContext("round3-contender-a").database();
      const contenderB = environment.authenticatedContext("round3-contender-b").database();
      const takeover = (database, uid) => update(ref(database, chorusStatePath), {
        authorityUid: uid,
        authorityEpoch: expired.authorityEpoch + 1,
        leaseUntil: Date.now() + 4_000,
        updatedAt: Date.now(),
      });
      const results = await Promise.allSettled([
        takeover(contenderA, "round3-contender-a"),
        takeover(contenderB, "round3-contender-b"),
      ]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(results.filter(result => result.status === "rejected").length, 1);
      const stored = (await get(ref(contenderA, chorusStatePath))).val();
      assert.equal(stored.processedSequenceByUid.player, 10_000);
      assert.equal(stored.processedActionUid, "player");
      assert.equal(stored.processedActionSequence, 10_000);
    });
  } finally {
    await environment.cleanup();
  }
});

test("chorus action receipt는 exact action payload가 만든 state delta에 결속된다", async () => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    const timestamp = Date.now();
    const hostDb = environment.authenticatedContext("host").database();
    const playerDb = environment.authenticatedContext("player").database();
    const current = oneAnchorChorusState({
      leaseUntil: timestamp + 6_000,
      updatedAt: timestamp - 100,
      contributors: {
        player: {
          firstContributedAt: timestamp - 1_000,
          lastContributedAt: timestamp - 100,
          actionTypes: ["anchor-stabilize"],
        },
      },
    });
    await seedChorus(environment, current, { sequence: 2 });
    const replayedTarget = chorusAction("player", 2, {
      id: "player:1:2:anchor-stabilize",
      type: "anchor-stabilize",
      anchorId: "forest",
      createdAt: timestamp,
    });
    await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/2`), replayedTarget));

    await assertFails(update(ref(hostDb, chorusPath), {
      "state/stabilizedAnchorIds/coast": true,
      "state/hp": 80,
      "state/combatRevision": 2,
      "state/contributors/player/lastContributedAt": timestamp,
      "state/processedSequenceByUid/player": 2,
      "state/processedActionId": replayedTarget.id,
      "state/processedActionUid": "player",
      "state/processedActionSequence": 2,
      "state/processedActionReceipt": chorusActionReceipt(replayedTarget),
      "state/updatedAt": timestamp,
      "processedSequences/player": 2,
    }));

    await assertFails(update(ref(hostDb, chorusPath), {
      "state/combatRevision": 2,
      "state/contributors/player/lastContributedAt": timestamp,
      "state/processedSequenceByUid/player": 2,
      "state/processedActionId": replayedTarget.id,
      "state/processedActionUid": "player",
      "state/processedActionSequence": 2,
      "state/processedActionReceipt": chorusActionReceipt(replayedTarget),
      "state/updatedAt": timestamp,
      "processedSequences/player": 2,
    }));

    const empty = chorusEncounter({ leaseUntil: timestamp + 6_000, updatedAt: timestamp - 100 });
    await seedChorus(environment, empty);
    await assertFails(update(ref(hostDb, chorusStatePath), {
      combatRevision: 1,
      updatedAt: timestamp,
    }));

    await seedChorus(environment, empty, { sequence: 2 });
    const coastAction = chorusAction("player", 2, {
      id: "player:1:2:anchor-stabilize",
      type: "anchor-stabilize",
      anchorId: "coast",
      createdAt: timestamp,
    });
    await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/2`), coastAction));
    await assertFails(update(ref(hostDb, chorusPath), {
      "state/stabilizedAnchorIds/coast": true,
      "state/hp": 90,
      "state/combatRevision": 1,
      "state/contributors/player/firstContributedAt": timestamp,
      "state/contributors/player/lastContributedAt": timestamp,
      "state/contributors/player/actionTypes/anchor-stabilize": true,
      "state/processedSequenceByUid/player": 2,
      "state/processedActionId": "player:1:2:mismatched-id",
      "state/processedActionUid": "player",
      "state/processedActionSequence": 2,
      "state/updatedAt": timestamp,
      "processedSequences/player": 2,
    }));

    const onslaught = chorusEncounter({
      leaseUntil: timestamp + 6_000,
      stabilizedAnchorIds: anchorIds,
      resolvedTestimonyIds: testimonyIds,
      phase: "onslaught",
      hp: 40,
      combatRevision: 9,
      updatedAt: timestamp - 100,
    });
    await seedChorus(environment, onslaught, { sequence: 5 });
    const roanAction = chorusAction("player", 5, {
      id: "player:1:5:record-activate",
      phase: "onslaught",
      type: "record-activate",
      fragmentId: null,
      recordId: "roan",
      createdAt: timestamp,
    });
    await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/5`), roanAction));
    await assertFails(update(ref(hostDb, chorusPath), {
      "state/activeRecordId": "sera",
      "state/vulnerableUntil": timestamp + 3_000,
      "state/combatRevision": 10,
      "state/contributors/player/firstContributedAt": timestamp,
      "state/contributors/player/lastContributedAt": timestamp,
      "state/contributors/player/actionTypes/record-activate": true,
      "state/processedSequenceByUid/player": 5,
      "state/processedActionId": roanAction.id,
      "state/processedActionUid": "player",
      "state/processedActionSequence": 5,
      "state/updatedAt": timestamp,
      "processedSequences/player": 5,
    }));
  } finally {
    await environment.cleanup();
  }
});

test("Round 4 receipt는 완료된 objective나 누락된 reducer side effect를 처리할 수 없다", async t => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    const hostDb = environment.authenticatedContext("host").database();
    const playerDb = environment.authenticatedContext("player").database();
    const attemptNoOp = async ({ current, action, timestamp }) => {
      await seedChorus(environment, current, { sequence: action.sequence });
      await assertSucceeds(set(
        ref(playerDb, `${chorusPath}/actions/player/${action.sequence}`),
        action,
      ));
      await assertFails(update(ref(hostDb, chorusPath), {
        "state/combatRevision": current.combatRevision + 1,
        "state/contributors/player/lastContributedAt": timestamp,
        "state/processedSequenceByUid/player": action.sequence,
        "state/processedActionId": action.id,
        "state/processedActionUid": "player",
        "state/processedActionSequence": action.sequence,
        "state/processedActionReceipt": chorusActionReceipt(action),
        "state/updatedAt": timestamp,
        "processedSequences/player": action.sequence,
      }));
    };
    const fixture = (timestamp, actionType, overrides) => chorusEncounter({
      leaseUntil: timestamp + 6_000,
      combatRevision: 1,
      processedSequenceByUid: { player: 19 },
      contributors: {
        player: {
          firstContributedAt: timestamp - 1_000,
          lastContributedAt: timestamp - 100,
          actionTypes: [actionType],
        },
      },
      updatedAt: timestamp - 100,
      ...overrides,
    });

    await t.test("이미 처리한 testimony는 exact receipt만으로 재처리되지 않는다", async () => {
      const timestamp = Date.now();
      const action = chorusAction("player", 20, {
        id: "player:1:20:testimony-resolve",
        phase: "testimonies",
        type: "testimony-resolve",
        fragmentId: null,
        testimonyId: "core-self-division-original",
        verdict: "fact",
        createdAt: timestamp,
      });
      await attemptNoOp({
        timestamp,
        action,
        current: fixture(timestamp, action.type, {
          stabilizedAnchorIds: anchorIds,
          resolvedTestimonyIds: ["core-self-division-original"],
          phase: "testimonies",
          hp: 65,
        }),
      });
    });

    await t.test("이미 절단한 record target은 activation side effect 없이 receipt를 전진시키지 않는다", async () => {
      const timestamp = Date.now();
      const action = chorusAction("player", 20, {
        id: "player:1:20:record-activate",
        phase: "onslaught",
        type: "record-activate",
        fragmentId: null,
        recordId: "roan",
        createdAt: timestamp,
      });
      await attemptNoOp({
        timestamp,
        action,
        current: fixture(timestamp, action.type, {
          stabilizedAnchorIds: anchorIds,
          resolvedTestimonyIds: testimonyIds,
          severedBondIds: ["roan"],
          phase: "onslaught",
          hp: 30,
        }),
      });
    });

    await t.test("이미 절단한 bond는 exact receipt만으로 재처리되지 않는다", async () => {
      const timestamp = Date.now();
      const action = chorusAction("player", 20, {
        id: "player:1:20:bond-cut",
        phase: "onslaught",
        type: "bond-cut",
        fragmentId: null,
        bondId: "roan",
        createdAt: timestamp,
      });
      await attemptNoOp({
        timestamp,
        action,
        current: fixture(timestamp, action.type, {
          stabilizedAnchorIds: anchorIds,
          resolvedTestimonyIds: testimonyIds,
          severedBondIds: ["roan"],
          activeRecordId: "sera",
          vulnerableUntil: timestamp + 3_000,
          phase: "onslaught",
          hp: 30,
        }),
      });
    });

    await t.test("사용한 Lumen assist와 완료 anchor는 receipt만으로 재처리되지 않는다", async () => {
      const timestamp = Date.now();
      const action = chorusAction("player", 20, {
        id: "player:1:20:lumen-assist",
        type: "lumen-assist",
        fragmentId: null,
        anchorId: "forest",
        createdAt: timestamp,
      });
      await attemptNoOp({
        timestamp,
        action,
        current: fixture(timestamp, action.type, {
          stabilizedAnchorIds: ["forest"],
          lumenAssistUsed: true,
          hp: 90,
        }),
      });
    });

    await t.test("fresh Lumen assist는 anchor와 assist flag를 함께 바꿀 때만 처리된다", async () => {
      const timestamp = Date.now();
      await seedChorus(environment, chorusEncounter({
        leaseUntil: timestamp + 6_000,
        updatedAt: timestamp - 100,
      }));
      await publishBoundChorusAction({
        playerDb,
        hostDb,
        sequence: 1,
        revision: 1,
        phase: "anchors",
        type: "lumen-assist",
        fields: { fragmentId: null, anchorId: "forest" },
        stateChanges: {
          "stabilizedAnchorIds/forest": true,
          lumenAssistUsed: true,
          hp: 90,
        },
        firstContribution: true,
        newActionType: true,
        createdAt: timestamp,
      });
    });
  } finally {
    await environment.cleanup();
  }
});

test("separated state는 action-bound canonical reformAt만 기록한다", async () => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    const hostDb = environment.authenticatedContext("host").database();
    const playerDb = environment.authenticatedContext("player").database();
    const attempt = async reformAt => {
      const timestamp = Date.now();
      const current = onslaughtChorusState({
        leaseUntil: timestamp + 6_000,
        activeRecordId: "lumen",
        vulnerableUntil: timestamp + 3_000,
        updatedAt: timestamp - 100,
      });
      await seedChorus(environment, current, { sequence: 13 });
      const action = chorusAction("player", 13, {
        id: "player:1:13:bond-cut",
        phase: "onslaught",
        type: "bond-cut",
        fragmentId: null,
        bondId: "lumen",
        createdAt: timestamp,
      });
      await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/13`), action));
      return update(ref(hostDb, chorusPath), {
        "state/severedBondIds/lumen": true,
        "state/activeRecordId": null,
        "state/vulnerableUntil": 0,
        "state/status": "separated",
        "state/phase": "separated",
        "state/hp": 0,
        "state/separatedAt": timestamp,
        "state/reformAt": reformAt == null ? null : timestamp + reformAt,
        "state/combatRevision": 13,
        "state/contributors/player/lastContributedAt": timestamp,
        "state/processedSequenceByUid/player": 13,
        "state/processedActionId": action.id,
        "state/processedActionUid": "player",
        "state/processedActionSequence": 13,
        "state/processedActionReceipt": chorusActionReceipt(action),
        "state/updatedAt": timestamp,
        "processedSequences/player": 13,
      });
    };

    await assertFails(attempt(null));
    await assertFails(attempt(29_999));
    await assertFails(attempt(30_001));
    await assertSucceeds(attempt(30_000));
  } finally {
    await environment.cleanup();
  }
});

test("만료된 separated encounter는 watermark와 기존 claim을 보존한 fresh encounter로만 교체된다", async () => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    await environment.clearDatabase();
    const lateDb = environment.authenticatedContext("other").database();
    const beforeSeparatedAt = Date.now();
    const beforeExpiry = beforeSeparatedAt + 30_000;
    const terminalBeforeExpiry = wireChorusEncounter(separatedChorusState({
      authorityUid: "host",
      leaseUntil: beforeSeparatedAt + 5_000,
      separatedAt: beforeSeparatedAt,
      reformAt: beforeExpiry,
      processedSequenceByUid: { player: 1 },
      processedActionUid: "player",
      processedActionSequence: 1,
    }));
    const oldClaim = {
      encounterId: terminalBeforeExpiry.encounterId,
      uid: "player",
      eligible: true,
      createdAt: terminalBeforeExpiry.separatedAt,
    };
    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), "rooms/public"), {
        players: { other: player({ mapId: "sanctuary-return-record" }) },
        chorus: {
          "sanctuary-return-record": {
            state: terminalBeforeExpiry,
            processedSequences: { player: 1 },
            actions: { player: { 1: chorusAction("player", 1) } },
            completionClaims: {
              [terminalBeforeExpiry.encounterId]: { player: oldClaim },
            },
            completionInbox: { player: oldClaim },
          },
        },
      });
    });
    const deniedFresh = wireChorusEncounter(chorusEncounter({
      encounterId: `sanctuary-chorus-${beforeExpiry}-r2`,
      authorityUid: "other",
      authorityEpoch: 2,
      leaseUntil: Date.now() + 6_000,
      spawnedAt: Date.now(),
      updatedAt: Date.now(),
      processedSequenceByUid: { player: 1 },
    }));
    await assertFails(set(ref(lateDb, chorusStatePath), deniedFresh));

    const expiredSeparatedAt = Date.now() - 30_100;
    const reformAt = expiredSeparatedAt + 30_000;
    const expired = wireChorusEncounter(separatedChorusState({
      authorityUid: "host",
      leaseUntil: expiredSeparatedAt + 5_000,
      separatedAt: expiredSeparatedAt,
      reformAt,
      processedSequenceByUid: { player: 1 },
      processedActionUid: "player",
      processedActionSequence: 1,
    }));
    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), expired);
    });
    const timestamp = Date.now();
    const fresh = wireChorusEncounter(chorusEncounter({
      encounterId: `sanctuary-chorus-${reformAt}-r2`,
      authorityUid: "other",
      authorityEpoch: 2,
      leaseUntil: timestamp + 6_000,
      spawnedAt: timestamp,
      updatedAt: timestamp,
    }));
    await assertFails(set(ref(lateDb, chorusStatePath), {
      ...fresh,
      encounterId: `sanctuary-chorus-${reformAt}-arbitrary-r2`,
    }));
    await assertSucceeds(set(ref(lateDb, chorusStatePath), fresh));
    assert.equal((await get(ref(lateDb, `${chorusPath}/completionClaims/${expired.encounterId}/player`))).val().uid, "player");
    assert.deepEqual((await get(ref(lateDb, `${chorusPath}/completionInbox/player`))).val(), oldClaim);
    assert.equal((await get(ref(lateDb, `${chorusPath}/completionClaims/${fresh.encounterId}/other`))).exists(), false);
    await assertSucceeds(remove(ref(lateDb, `${chorusPath}/actions/player/1`)));
  } finally {
    await environment.cleanup();
  }
});

test("Round 4 pressure는 confirmed action을 현재 authority가 정리한다", async t => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    const timestamp = Date.now();
    const hostDb = environment.authenticatedContext("host").database();
    const playerDb = environment.authenticatedContext("player").database();
    const nextHostDb = environment.authenticatedContext("next-host").database();
    const viewerDb = environment.authenticatedContext("viewer").database();

    await t.test("takeover authority만 confirmed old-epoch action을 삭제한다", async () => {
      const expired = oneAnchorChorusState({
        leaseUntil: timestamp - 100,
        processedSequenceByUid: { player: 40 },
        processedActionUid: "player",
        processedActionSequence: 40,
      });
      await seedChorus(environment, expired);
      await environment.withSecurityRulesDisabled(async context => {
        const database = context.database();
        await set(ref(database, `${chorusPath}/processedSequences/player`), 40);
        await set(ref(database, `${chorusPath}/actions/player/40`), chorusAction("player", 40, {
          authorityEpoch: 1,
          createdAt: timestamp,
        }));
        await set(ref(database, `${chorusPath}/actions/player/41`), chorusAction("player", 41, {
          authorityEpoch: 1,
          createdAt: timestamp,
        }));
      });
      await assertFails(remove(ref(hostDb, `${chorusPath}/actions/player/40`)));
      await assertSucceeds(update(ref(nextHostDb, chorusStatePath), {
        authorityUid: "next-host",
        authorityEpoch: 2,
        leaseUntil: Date.now() + 6_000,
        updatedAt: Date.now(),
      }));
      await environment.withSecurityRulesDisabled(async context => {
        await set(ref(context.database(), `${chorusPath}/actions/player/42`), chorusAction("player", 42, {
          authorityEpoch: 2,
          createdAt: timestamp,
        }));
      });

      await assertFails(remove(ref(hostDb, `${chorusPath}/actions/player/40`)));
      await assertFails(remove(ref(viewerDb, `${chorusPath}/actions/player/40`)));
      await assertFails(remove(ref(nextHostDb, `${chorusPath}/actions/player/41`)));
      await assertFails(remove(ref(nextHostDb, `${chorusPath}/actions/player/42`)));
      await assertSucceeds(remove(ref(nextHostDb, `${chorusPath}/actions/player/40`)));
    });

    await t.test("publish 뒤 crash로 남은 action은 takeover listener가 자동 정리한다", async () => {
      const state = chorusEncounter({ authorityUid: "host", authorityEpoch: 1, leaseUntil: Date.now() + 6_000 });
      const publishAt = Date.now();
      await seedChorus(environment, state, { sequence: 10 });
      const action = chorusAction("player", 10, { createdAt: publishAt });
      await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/10`), action));
      await assertSucceeds(update(ref(hostDb, chorusPath), {
        "state/processedSequenceByUid/player": 10,
        "state/processedActionId": action.id,
        "state/processedActionUid": "player",
        "state/processedActionSequence": 10,
        "state/processedActionReceipt": chorusActionReceipt(action),
        "state/contributors/player/firstContributedAt": publishAt,
        "state/contributors/player/lastContributedAt": publishAt,
        "state/contributors/player/actionTypes/fragment-strike": true,
        "state/combatRevision": 1,
        "state/updatedAt": publishAt,
        "processedSequences/player": 10,
      }));
      assert.equal((await get(ref(hostDb, `${chorusPath}/actions/player/10`))).exists(), true);
      await environment.withSecurityRulesDisabled(async context => {
        await update(ref(context.database(), chorusStatePath), { leaseUntil: Date.now() - 100 });
      });

      const { createChorusNetwork } = await import("../src/sanctuary-chorus-network-20260911-sanctuary.js");
      let actionsObserved = false;
      const network = createChorusNetwork({
        dbModule: { get, onValue, ref, remove, runTransaction, serverTimestamp, set, update },
        db: nextHostDb,
        roomId: "public",
        uid: "next-host",
        callbacks: { onActionsChanged: () => { actionsObserved = true; } },
        now: () => Date.now(),
        timers: { set: () => 1, clear: () => {} },
      });
      await network.setMap("sanctuary-return-record");
      await waitFor(() => network.latestState?.authorityUid === "host" && actionsObserved);
      const takeover = await network.tryAcquireAuthority();
      assert.equal(takeover.ok, true);
      let actionExists = true;
      const unsubscribe = onValue(ref(nextHostDb, `${chorusPath}/actions/player/10`), snapshot => {
        actionExists = snapshot.exists();
      });
      await waitFor(() => actionExists === false);
      unsubscribe();
      assert.equal((await get(ref(nextHostDb, `${chorusPath}/actions/player/10`))).exists(), false);
      await network.stop();
    });
  } finally {
    await environment.cleanup();
  }
});
