import test from "node:test";
import assert from "node:assert/strict";
import { filterPlayersForMap, serializePlayerState } from "../src/network-state-20260903-volcano-20260905-upgrade.js";
import { WORLD_IDS, getWorldDefinition } from "../src/world-data-20260903-volcano-20260905-upgrade.js";

test("serialized player state keeps existing fields and adds the active region", () => {
  assert.deepEqual(
    serializePlayerState(
      { x: 10.04, y: 20.06, hp: 73, dir: "left", moving: true, color: "#fff", name: "별" },
      "forest",
    ),
    {
      x: 10,
      y: 20.1,
      hp: 73,
      level: 1, mp: 0, skillResources: {}, skinId: "default",
      dir: "left",
      moving: true,
      color: "#fff",
      name: "별",
      mapId: "forest",
      classId: "warrior",
      equippedWeaponId: "starter-sword",
    },
  );
});

test("온라인 생존 판정을 위해 현재 HP를 직렬화하고 레거시는 100으로 복구한다", () => {
  const serialized = serializePlayerState({
    x: 10, y: 20, hp: 0, dir: "down", moving: false, color: "#fff", name: "쓰러짐",
  }, "coast-beach");
  assert.equal(serialized.hp, 0);

  const players = filterPlayersForMap({
    down: { ...serialized, hp: 0 },
    legacy: { ...serialized, hp: undefined },
  }, "own", "coast-beach");
  assert.equal(players.get("down").hp, 0);
  assert.equal(players.get("legacy").hp, 100);
});

test("only valid remote players in the active region are visible", () => {
  const raw = {
    own: { x: 1, y: 1, mapId: "forest", dir: "down", moving: false, color: "#fff", name: "나" },
    same: { x: 100, y: 200, mapId: "forest", dir: "up", moving: true, color: "#0f0", name: "숲" },
    other: { x: 100, y: 200, mapId: "coast", dir: "left", moving: false, color: "#00f", name: "바다" },
    invalid: { x: 5000, y: 200, mapId: "forest", dir: "right", moving: false, color: "#f00", name: "범위 밖" },
  };
  const players = filterPlayersForMap(raw, "own", "forest");
  assert.deepEqual([...players.keys()], ["same"]);
  assert.equal(players.get("same").name, "숲");
  assert.equal(players.get("same").classId, "warrior");
  assert.equal(players.get("same").equippedWeaponId, "starter-sword");
});

test("legacy snapshots without a physical map are rejected", () => {
  const players = filterPlayersForMap(
    { legacy: { x: 100, y: 100, dir: "down", moving: false, color: "#fff", name: "이전" } },
    "own",
    "village",
  );
  assert.equal(players.has("legacy"), false);
});

test("unknown active physical map values show no remote players", () => {
  const players = filterPlayersForMap(
    { villagePlayer: { x: 100, y: 100, mapId: "village", name: "마을" } },
    "own",
    "unknown",
  );
  assert.equal(players.size, 0);
});

test("presence filtering uses each exact coast map and its 2160×1800 bounds", () => {
  const coastMapIds = [
    "coast-beach",
    "coast-wreck-bay",
    "coast-flooded-station",
    "coast-tide-core-cave",
  ];
  for (const mapId of coastMapIds) {
    const players = filterPlayersForMap({
      boundary: { x: 2160, y: 1800, mapId, name: "경계" },
      xOutside: { x: 2160.1, y: 900, mapId, name: "가로 밖" },
      yOutside: { x: 1080, y: 1800.1, mapId, name: "세로 밖" },
      legacy: { x: 1080, y: 900, mapId: "coast", name: "레거시" },
      unknown: { x: 1080, y: 900, mapId: "unknown", name: "미등록" },
    }, "own", mapId);
    assert.deepEqual([...players.keys()], ["boundary"], mapId);
    assert.equal(players.get("boundary").mapId, mapId);
    assert.equal(serializePlayerState({
      x: 1080, y: 900, dir: "down", moving: false, color: "#fff", name: "해안",
    }, mapId).mapId, mapId);
  }
});

test("presence accepts all four volcano maps and sanctuary at exact 2160×1800 bounds", () => {
  const mapIds = [
    "volcano",
    "volcano-magma-route",
    "volcano-observatory",
    "volcano-core-caldera",
    "sanctuary",
  ];
  for (const mapId of mapIds) {
    const players = filterPlayersForMap({
      boundary: { x: 2160, y: 1800, mapId, name: "경계" },
      xOutside: { x: 2160.1, y: 900, mapId, name: "가로 밖" },
      yOutside: { x: 1080, y: 1800.1, mapId, name: "세로 밖" },
    }, "own", mapId);
    assert.deepEqual([...players.keys()], ["boundary"], mapId);
    assert.equal(serializePlayerState({
      x: 1080, y: 900, dir: "down", moving: false, color: "#fff", name: "화산",
    }, mapId)?.mapId, mapId);
  }
});

test("hidden presence weapons require an explicit matching class", () => {
  const base = {
    x: 10, y: 20, dir: "down", moving: false, color: "#fff", name: "원격", mapId: "village",
  };
  const players = filterPlayersForMap({
    legacySword: { ...base, equippedWeaponId: "reinforced-masterwork-katana" },
    legacyHidden: { ...base, equippedWeaponId: "volcanic-heartblade" },
    warriorHidden: { ...base, classId: "warrior", equippedWeaponId: "volcanic-heartblade" },
    wrongHidden: { ...base, classId: "archer", equippedWeaponId: "volcanic-heartblade" },
  }, "own", "village");
  assert.equal(players.get("legacySword").equippedWeaponId, "reinforced-masterwork-katana");
  assert.equal(players.get("legacyHidden").equippedWeaponId, "starter-sword");
  assert.equal(players.get("warriorHidden").equippedWeaponId, "volcanic-heartblade");
  assert.equal(players.get("wrongHidden").equippedWeaponId, "training-bow");
});

test("outbound presence rejects legacy, unknown, and missing physical map IDs", () => {
  const player = { x: 10, y: 20, dir: "down", moving: false, color: "#fff", name: "검증" };
  for (const mapId of ["coast", "unknown", undefined, null, ""]) {
    assert.equal(serializePlayerState(player, mapId), null, String(mapId));
  }
});

test("outbound presence accepts exact boundaries and rejects coordinates outside each physical map", () => {
  for (const mapId of WORLD_IDS) {
    const world = getWorldDefinition(mapId);
    const player = { x: world.width, y: world.height, dir: "down", moving: false, color: "#fff", name: "경계" };
    assert.equal(serializePlayerState(player, mapId)?.mapId, mapId, `${mapId} boundary`);
    assert.equal(serializePlayerState({ ...player, x: -0.1 }, mapId), null, `${mapId} negative x`);
    assert.equal(serializePlayerState({ ...player, y: -0.1 }, mapId), null, `${mapId} negative y`);
    assert.equal(serializePlayerState({ ...player, x: world.width + 0.1 }, mapId), null, `${mapId} x overflow`);
    assert.equal(serializePlayerState({ ...player, y: world.height + 0.1 }, mapId), null, `${mapId} y overflow`);
  }
  assert.equal(serializePlayerState({ y: 20 }, "village"), null);
  assert.equal(serializePlayerState({ x: 10 }, "village"), null);
});

test("장착 무기 ID는 직렬화되고 잘못되거나 누락된 원격 ID는 시작 검으로 복구된다", () => {
  const serialized = serializePlayerState({
    x: 10,
    y: 20,
    dir: "left",
    moving: false,
    color: "#fff",
    name: "별",
    equippedWeaponId: "elite-katana",
  }, "village");
  assert.equal(serialized.equippedWeaponId, "elite-katana");

  const players = filterPlayersForMap({
    valid: { ...serialized, equippedWeaponId: "masterwork-katana" },
    invalid: { ...serialized, equippedWeaponId: "unknown" },
    legacy: { ...serialized, equippedWeaponId: undefined },
  }, "own", "village");
  assert.equal(players.get("valid").equippedWeaponId, "masterwork-katana");
  assert.equal(players.get("invalid").equippedWeaponId, "starter-sword");
  assert.equal(players.get("legacy").equippedWeaponId, "starter-sword");
  assert.equal(serializePlayerState({ ...serialized, equippedWeaponId: "unknown" }, "village").equippedWeaponId, "starter-sword");
});

test("직업과 해당 직업 장착 무기를 함께 직렬화한다", () => {
  const serialized = serializePlayerState({
    x: 10,
    y: 20,
    dir: "right",
    moving: false,
    color: "#fff",
    name: "궁수",
    classId: "archer",
    equippedWeaponId: "hunter-bow",
  }, "village");
  assert.deepEqual({
    classId: serialized.classId,
    equippedWeaponId: serialized.equippedWeaponId,
  }, {
    classId: "archer",
    equippedWeaponId: "hunter-bow",
  });
});

test("원격 레거시는 검사로, 잘못된 직업·무기 조합은 직업 기본 무기로 정규화한다", () => {
  const base = {
    x: 10,
    y: 20,
    dir: "down",
    moving: false,
    color: "#fff",
    name: "원격",
    mapId: "village",
  };
  const players = filterPlayersForMap({
    legacy: { ...base, equippedWeaponId: "katana" },
    invalidClass: { ...base, classId: "rogue", equippedWeaponId: "hunter-bow" },
    wrongArcherWeapon: { ...base, classId: "archer", equippedWeaponId: "training-staff" },
    mage: { ...base, classId: "mage", equippedWeaponId: "archmage-staff" },
  }, "self", "village");
  assert.deepEqual({
    classId: players.get("legacy").classId,
    weaponId: players.get("legacy").equippedWeaponId,
  }, { classId: "warrior", weaponId: "katana" });
  assert.deepEqual({
    classId: players.get("invalidClass").classId,
    weaponId: players.get("invalidClass").equippedWeaponId,
  }, { classId: "warrior", weaponId: "starter-sword" });
  assert.equal(players.get("wrongArcherWeapon").equippedWeaponId, "training-bow");
  assert.equal(players.get("mage").equippedWeaponId, "archmage-staff");
});
