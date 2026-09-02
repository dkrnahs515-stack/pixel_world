import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function load() {
  return JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8"));
}

function snapshot(value) {
  return {
    exists() { return value !== null && value !== undefined; },
    hasChildren(keys = []) { return keys.every(key => value && typeof value === "object" && Object.hasOwn(value, key)); },
    hasChild(key) { return Boolean(value && typeof value === "object" && Object.hasOwn(value, key)); },
    child(path) {
      return snapshot(String(path).split("/").filter(Boolean).reduce((current, key) => current?.[key], value));
    },
    isNumber() { return typeof value === "number" && Number.isFinite(value); },
    isString() { return typeof value === "string"; },
    val() { return value; },
  };
}

test("협동 보스는 인증 사용자와 세 물리 전투장만 읽는다", async () => {
  const bosses = (await load()).rules.rooms.$roomId.bosses;
  assert.ok(bosses?.$mapId);
  assert.match(bosses.$mapId[".read"], /auth != null/);
  assert.match(bosses.$mapId[".read"], /coast-tide-core-cave/);
  assert.match(bosses.$mapId[".read"], /volcano/);
  assert.match(bosses.$mapId[".read"], /forest/);
  assert.doesNotMatch(bosses.$mapId[".read"], /village/);
  assert.doesNotMatch(bosses.$mapId[".read"], /=== 'coast'/);
});

test("플레이어와 채팅 규칙은 일곱 물리 맵만 허용하고 맵별 경계를 적용한다", async () => {
  const room = (await load()).rules.rooms.$roomId;
  const playerRule = room.players.$uid[".validate"];
  const chatMap = room.chat.$uid.$messageId.mapId[".validate"];
  const validatePlayer = Function("newData", "data", "now", `return (${playerRule});`);
  const validateChatMap = Function("newData", `return (${chatMap});`);
  const base = {
    x: 100, y: 100, dir: "down", moving: false,
    name: "물리맵", color: "#38bdf8",
  };
  const physicalMaps = [
    ["village", 2880, 1800],
    ["forest", 4320, 3600],
    ["volcano", 4320, 3600],
    ["coast-beach", 2160, 1800],
    ["coast-wreck-bay", 2160, 1800],
    ["coast-flooded-station", 2160, 1800],
    ["coast-tide-core-cave", 2160, 1800],
  ];
  for (const [mapId, width, height] of physicalMaps) {
    const evaluate = value => validatePlayer(snapshot(value), snapshot({}), Date.now());
    assert.equal(evaluate({ ...base, x: width, y: height, mapId }), true, `${mapId} boundary`);
    assert.equal(evaluate({ ...base, x: width + 0.1, y: height, mapId }), false, `${mapId} x`);
    assert.equal(evaluate({ ...base, x: width, y: height + 0.1, mapId }), false, `${mapId} y`);
    assert.equal(validateChatMap(snapshot(mapId)), true, `chat ${mapId}`);
  }
  for (const mapId of ["coast", "unknown", ""]) {
    assert.equal(validatePlayer(snapshot({ ...base, mapId }), snapshot({}), Date.now()), false, `player ${mapId}`);
    assert.equal(validateChatMap(snapshot(mapId)), false, `chat ${mapId}`);
  }
});

test("보스 공격 규칙은 저장된 플레이어의 물리 맵이 전투장과 같아야 한다", async () => {
  const attack = (await load()).rules.rooms.$roomId.bosses.$mapId.attacks.$uid.$sequence;
  assert.match(attack[".write"], /players\/.*mapId/);
  assert.match(attack[".write"], /val\(\) === \$mapId/);
});

test("state 쓰기는 현재 관리자 또는 만료 lease의 epoch+1 인수만 허용한다", async () => {
  const state = (await load()).rules.rooms.$roomId.bosses.$mapId.state;
  assert.match(state[".write"], /authorityUid/);
  assert.match(state[".write"], /leaseUntil.*<= now/);
  assert.match(state[".write"], /authorityEpoch.*\+ 1/);
  assert.match(state[".validate"], /partySize/);
  assert.match(state[".validate"], /<= 10/);
  assert.match(state[".validate"], /hp/);
  assert.match(state[".validate"], /now \+ 10000/);
});

test("공격 요청은 자기 경로·허용 장비·시간만 쓰고 damage를 받지 않는다", async () => {
  const attack = (await load()).rules.rooms.$roomId.bosses.$mapId.attacks.$uid.$sequence;
  assert.match(attack[".write"], /auth\.uid === \$uid/);
  assert.match(attack[".write"], /state\/authorityUid/);
  assert.match(attack[".validate"], /!newData\.hasChild\('damage'\)/);
  for (const value of ["warrior", "archer", "mage", "starter-sword", "training-bow", "training-staff", "basic", "strong"]) {
    assert.match(attack[".validate"], new RegExp(value));
  }
  assert.match(attack[".validate"], /now \+ 5000/);
  assert.match(attack[".validate"], /now - 5000/);
});

test("공격 규칙은 canonical 경로 sequence와 숫자 payload sequence를 정확히 묶는다", async () => {
  const rule = (await load()).rules.rooms.$roomId.bosses.$mapId.attacks.$uid.$sequence[".validate"];
  const validate = Function("newData", "auth", "now", "$mapId", "$uid", "$sequence", `return (${rule});`);
  const now = 10_000;
  const attack = {
    attackId: "fighter:e:7",
    sequence: 7,
    uid: "fighter",
    encounterId: "e",
    bossId: "coast-core-shark",
    mapId: "coast-tide-core-cave",
    classId: "archer",
    weaponId: "training-bow",
    attackKind: "basic",
    playerX: 1540,
    playerY: 1280,
    direction: "right",
    createdAt: now,
  };
  const evaluate = sequenceKey => validate(
    snapshot(attack),
    { uid: "fighter" },
    now,
    "coast-tide-core-cave",
    "fighter",
    sequenceKey,
  );

  assert.equal(evaluate("7"), true);
  assert.equal(evaluate("8"), false);
  assert.equal(evaluate("07"), false);
});

test("플레이어 피해와 보상은 관리자 생성·대상 사용자 소비를 분리한다", async () => {
  const map = (await load()).rules.rooms.$roomId.bosses.$mapId;
  const damage = map.playerDamage.$targetUid.$eventId;
  assert.match(damage[".write"], /state\/authorityUid/);
  assert.match(damage[".write"], /auth\.uid === \$targetUid/);
  assert.match(damage[".write"], /authorityUid.*auth\.uid.*!newData\.exists/);
  assert.match(damage[".validate"], /<= 50/);
  const claim = map.rewardClaims.$encounterId.$uid;
  assert.match(claim[".write"], /state\/authorityUid/);
  assert.match(claim[".write"], /auth\.uid === \$uid/);
  assert.match(claim[".write"], /claimedAt/);
  assert.match(claim[".validate"], /expiresAt/);
});

test("보상 규칙은 현재 defeated encounter만 허용해 이전 encounter replay를 거부한다", async () => {
  const claimRules = (await load()).rules.rooms.$roomId.bosses.$mapId.rewardClaims.$encounterId.$uid;
  const allowWrite = Function(
    "auth", "data", "newData", "root", "now", "$roomId", "$mapId", "$encounterId", "$uid",
    `return (${claimRules[".write"]});`,
  );
  const validate = Function(
    "data", "newData", "root", "$roomId", "$mapId", "$encounterId", "$uid",
    `return (${claimRules[".validate"]});`,
  );
  const defeatedAt = 2_000;
  const rootValue = status => ({ rooms: { public: { bosses: { "coast-tide-core-cave": { state: {
    encounterId: "current-e",
    status,
    defeatedAt,
    authorityUid: "host",
    contributors: { fighter: { firstHitAt: 1_000, lastHitAt: 2_000 } },
  } } } } } });
  const claim = encounterId => ({
    encounterId,
    bossId: "coast-core-shark",
    uid: "fighter",
    exp: 150,
    gold: 100,
    eligible: true,
    expiresAt: defeatedAt + 86_400_000,
  });
  const evaluate = (encounterId, status = "defeated") => {
    const data = snapshot(null);
    const newData = snapshot(claim(encounterId));
    const root = snapshot(rootValue(status));
    return allowWrite(
      { uid: "host" }, data, newData, root, defeatedAt, "public",
      "coast-tide-core-cave", encounterId, "fighter",
    ) && validate(
      data, newData, root, "public", "coast-tide-core-cave", encounterId, "fighter",
    );
  };

  assert.equal(evaluate("current-e"), true);
  assert.equal(evaluate("old-e"), false);
  assert.equal(evaluate("current-e", "alive"), false);
});

test("온라인 플레이어 HP는 선택 사항으로 허용하되 유효 범위만 저장한다", async () => {
  const player = (await load()).rules.rooms.$roomId.players.$uid;
  assert.match(player[".validate"], /hasChild\('hp'\)/);
  assert.match(player[".validate"], /child\('hp'\)\.val\(\) >= 0/);
  assert.match(player[".validate"], /hasChild\('joinedAt'\)/);
  assert.match(player[".validate"], /child\('joinedAt'\)\.val\(\) <= now \+ 5000/);
  assert.match(player[".validate"], /data\.child\('joinedAt'\)\.val\(\) === newData\.child\('joinedAt'\)\.val\(\)/);
  assert.match(player[".validate"], /now - 5000/);
});

test("Firebase 운영 문서는 App Check를 관찰 후 강제하도록 안내한다", async () => {
  const setup = await readFile(new URL("../FIREBASE_SETUP.md", import.meta.url), "utf8");
  assert.match(setup, /App Check/);
  assert.match(setup, /reCAPTCHA Enterprise/);
  assert.match(setup, /metric|메트릭/i);
  assert.match(setup, /enforcement|강제 적용/i);
  assert.match(setup, /debug token|디버그 토큰/i);
});

test("Firebase 운영 문서는 2Hz boss state, 정확한 일곱 mapId, 경계와 거부 조건을 설명한다", async () => {
  const setup = await readFile(new URL("../FIREBASE_SETUP.md", import.meta.url), "utf8");
  assert.match(setup, /2Hz|초당 2회/i);
  for (const mapId of [
    "village",
    "forest",
    "volcano",
    "coast-beach",
    "coast-wreck-bay",
    "coast-flooded-station",
    "coast-tide-core-cave",
  ]) {
    assert.match(setup, new RegExp(`\\b${mapId}\\b`));
  }
  assert.match(setup, /village[^\n]*2,?880[^\n]*1,?800/i);
  assert.match(setup, /forest[^\n]*4,?320[^\n]*3,?600/i);
  assert.match(setup, /volcano[^\n]*4,?320[^\n]*3,?600/i);
  assert.match(setup, /coast-[^\n]*2,?160[^\n]*1,?800/i);
  assert.match(setup, /sequence[^\n]*(거부|reject)/i);
  assert.match(setup, /(defeated|처치)[^\n]*encounter[^\n]*(거부|reject)/i);
});
