const test = require("node:test");
const { readFileSync } = require("node:fs");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { get, ref, remove, set } = require("firebase/database");

const projectId = "demo-pixel-world-rules";
const statePath = "rooms/public/bosses/coast/state";

function encounter({ authorityUid = "host", authorityEpoch = 1, leaseUntil = Date.now() + 6_000 } = {}) {
  const now = Date.now();
  return {
    encounterId: "coast-emulator-1",
    bossId: "coast-core-shark",
    mapId: "coast",
    status: "alive",
    x: 2160,
    y: 2400,
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

function player({ classId = "archer", equippedWeaponId = "training-bow", mapId = "coast" } = {}) {
  return {
    x: 2100,
    y: 2400,
    hp: 100,
    joinedAt: Date.now(),
    dir: "right",
    moving: false,
    name: "RuleTester",
    color: "#38bdf8",
    mapId,
    classId,
    equippedWeaponId,
  };
}

test("Realtime Database 규칙은 보스 읽기·관리자·공격·피해 권한을 실제로 강제한다", async () => {
  const environment = await initializeTestEnvironment({
    projectId,
    database: { rules: readFileSync("database.rules.json", "utf8") },
  });
  try {
    const hostDb = environment.authenticatedContext("host").database();
    const fighterDb = environment.authenticatedContext("fighter").database();
    const strangerDb = environment.authenticatedContext("stranger").database();
    const unauthenticatedDb = environment.unauthenticatedContext().database();

    await assertFails(get(ref(unauthenticatedDb, "rooms/public/bosses/coast")));
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
      ...fighterPlayer, classId: "archer", equippedWeaponId: "starter-sword",
    }));

    await assertSucceeds(set(ref(hostDb, statePath), encounter()));
    await assertSucceeds(get(ref(fighterDb, "rooms/public/bosses/coast")));
    await assertFails(set(ref(strangerDb, statePath), { ...encounter(), hp: 100 }));

    const createdAt = Date.now();
    const attack = {
      attackId: "fighter:coast-emulator-1:1",
      sequence: 1,
      uid: "fighter",
      encounterId: "coast-emulator-1",
      bossId: "coast-core-shark",
      mapId: "coast",
      classId: "archer",
      weaponId: "training-bow",
      attackKind: "basic",
      playerX: 2100,
      playerY: 2400,
      direction: "right",
      createdAt,
    };
    await assertSucceeds(set(ref(fighterDb, "rooms/public/bosses/coast/attacks/fighter/1"), attack));
    await assertFails(set(ref(fighterDb, "rooms/public/bosses/coast/attacks/fighter/2"), {
      ...attack, attackId: "fighter:coast-emulator-1:2", sequence: 2, createdAt: createdAt - 6_000,
    }));
    await assertFails(set(ref(fighterDb, "rooms/public/bosses/coast/attacks/fighter/3"), {
      ...attack, attackId: "fighter:coast-emulator-1:3", sequence: 3, damage: 999,
    }));
    await assertFails(set(ref(fighterDb, "rooms/public/bosses/coast/attacks/fighter/4"), {
      ...attack, attackId: "fighter:coast-emulator-1:4", sequence: 4, mapId: "forest",
    }));
    await assertFails(set(ref(fighterDb, "rooms/public/bosses/coast/attacks/fighter/5"), {
      ...attack, attackId: "fighter:coast-emulator-1:5", sequence: 5, weaponId: "starter-sword",
    }));

    const damagePath = "rooms/public/bosses/coast/playerDamage/fighter/coast-emulator-1:1:1";
    const damage = {
      eventId: "coast-emulator-1:1:1",
      encounterId: "coast-emulator-1",
      bossId: "coast-core-shark",
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
    const claimPath = "rooms/public/bosses/coast/rewardClaims/coast-emulator-1/fighter";
    const claim = {
      encounterId: "coast-emulator-1",
      bossId: "coast-core-shark",
      uid: "fighter",
      exp: 150,
      gold: 100,
      eligible: true,
      expiresAt: defeatedAt + 86_400_000,
    };
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
