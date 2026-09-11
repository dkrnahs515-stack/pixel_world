const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { get, ref, remove, runTransaction, set, update } = require("firebase/database");

const projectId = "demo-pixel-world-rules";
const bossMapId = "volcano-core-caldera";
const bossPath = `rooms/public/bosses/${bossMapId}`;
const statePath = `${bossPath}/state`;
const chorusPath = "rooms/public/chorus/sanctuary-return-record";
const chorusStatePath = `${chorusPath}/state`;

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
          state,
          ...(sequence == null ? {} : { actionSequences: { player: sequence } }),
        },
      },
    });
  });
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

    await assertFails(update(ref(guestDb, chorusStatePath), chorusEncounter()));
    const initial = chorusEncounter();
    await assertSucceeds(update(ref(hostDb, chorusStatePath), initial));
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
    await assertSucceeds(update(ref(hostDb, chorusStatePath), {
      stabilizedAnchorIds: oneAnchor.stabilizedAnchorIds,
      hp: oneAnchor.hp,
      combatRevision: oneAnchor.combatRevision,
      processedActionIds: oneAnchor.processedActionIds,
      "contributors/player": oneAnchor.contributors.player,
      updatedAt: oneAnchor.updatedAt,
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
    await assertSucceeds(update(ref(otherDb, chorusStatePath), {
      authorityUid: validTakeover.authorityUid,
      authorityEpoch: validTakeover.authorityEpoch,
      leaseUntil: validTakeover.leaseUntil,
      updatedAt: validTakeover.updatedAt,
    }));

    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), chorusEncounter({ leaseUntil: Date.now() + 30_000 }));
      await set(ref(context.database(), "rooms/public/players/player"), player({ mapId: "sanctuary-return-record" }));
    });
    await assertSucceeds(runTransaction(ref(playerDb, `${chorusPath}/actionSequences/player`), current => (current || 0) + 1));
    await assertFails(set(ref(otherDb, `${chorusPath}/actionSequences/player`), 2));
    await assertFails(set(ref(playerDb, `${chorusPath}/actionSequences/player`), 0));
    await assertFails(set(ref(playerDb, `${chorusPath}/actionSequences/player`), 3));

    await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/1`), chorusAction("player", 1)));
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
    await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/2`), chorusAction("player", 2, {
      type: "anchor-stabilize", anchorId: "forest",
    })));
    await assertSucceeds(remove(ref(hostDb, `${chorusPath}/actions/player/2`)));

    await assertSucceeds(runTransaction(ref(playerDb, `${chorusPath}/actionSequences/player`), current => current + 1));
    await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/3`), chorusAction("player", 3, {
      type: "lumen-assist", fragmentId: null, anchorId: "coast",
    })));
    await assertSucceeds(remove(ref(hostDb, `${chorusPath}/actions/player/3`)));

    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), chorusEncounter({
        leaseUntil: Date.now() + 30_000,
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
    await assertSucceeds(remove(ref(hostDb, `${chorusPath}/actions/player/4`)));

    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), chorusEncounter({
        leaseUntil: Date.now() + 30_000,
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
    await assertSucceeds(set(ref(playerDb, `${chorusPath}/actions/player/5`), chorusAction("player", 5, {
      type: "record-activate", fragmentId: null, phase: "onslaught", recordId: "roan",
    })));
    await assertSucceeds(remove(ref(hostDb, `${chorusPath}/actions/player/5`)));

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
    await assertSucceeds(remove(ref(hostDb, `${chorusPath}/actions/player/6`)));
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
    await assertFails(remove(ref(hostDb, `${chorusPath}/actions/player/1`)));
    await environment.withSecurityRulesDisabled(async context => {
      await set(ref(context.database(), chorusStatePath), chorusEncounter({ leaseUntil: Date.now() + 30_000 }));
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
    await assertSucceeds(set(ref(hostDb, claimPath), claim));
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
        stabilizedAnchorIds: ["coast", "forest", "volcano"],
        resolvedTestimonyIds: [...current.resolvedTestimonyIds].reverse(),
        severedBondIds: ["sera", "roan", "garen"],
        processedActionIds: ["player:1:1:fragment-strike"],
        "contributors/player": {
          ...current.contributors.player,
          actionTypes: ["record-activate"],
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
        stabilizedAnchorIds: ["coast", "forest", "volcano"],
        resolvedTestimonyIds: [...current.resolvedTestimonyIds].reverse(),
        severedBondIds: ["sera", "roan", "garen"],
        processedActionIds: ["player:1:1:fragment-strike"],
        "contributors/player": {
          ...current.contributors.player,
            actionTypes: ["record-activate"],
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

    await t.test("separated에서 reforming만 허용하고 rollback은 거부한다", async () => {
      const separated = separatedChorusState();
      await seedChorus(environment, separated);
      const reforming = {
        status: "reforming",
        combatRevision: separated.combatRevision + 1,
        updatedAt: Date.now(),
      };
      await assertSucceeds(update(ref(hostDb, chorusStatePath), reforming));
      await assertFails(update(ref(hostDb, chorusStatePath), {
        status: "separated",
        combatRevision: reforming.combatRevision + 1,
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
      await assertFails(remove(ref(hostDb, `${chorusStatePath}/processedActionIds`)));
      await assertFails(remove(ref(hostDb, `${chorusStatePath}/contributors`)));
      await assertFails(update(ref(hostDb, chorusStatePath), {
        processedActionIds: null,
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
