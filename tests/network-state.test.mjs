import test from "node:test";
import assert from "node:assert/strict";
import { filterPlayersForMap, serializePlayerState } from "../src/network-state.js";

test("serialized player state keeps existing fields and adds the active region", () => {
  assert.deepEqual(
    serializePlayerState(
      { x: 10.04, y: 20.06, dir: "left", moving: true, color: "#fff", name: "별" },
      "forest",
    ),
    {
      x: 10,
      y: 20.1,
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

test("legacy snapshots without a region remain visible in the village", () => {
  const players = filterPlayersForMap(
    { legacy: { x: 100, y: 100, dir: "down", moving: false, color: "#fff", name: "이전" } },
    "own",
    "village",
  );
  assert.equal(players.has("legacy"), true);
  assert.equal(players.get("legacy").mapId, "village");
});

test("unknown active region values safely fall back to the village", () => {
  const players = filterPlayersForMap(
    { villagePlayer: { x: 100, y: 100, mapId: "village", name: "마을" } },
    "own",
    "unknown",
  );
  assert.equal(players.has("villagePlayer"), true);
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
