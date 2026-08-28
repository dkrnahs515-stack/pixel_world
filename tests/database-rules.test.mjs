import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { WEAPON_ORDER, WEAPON_ORDER_BY_CLASS } from "../src/weapon-data.js";

function snapshot(value) {
  return {
    hasChildren(keys = []) {
      return keys.every(key => Object.hasOwn(value, key));
    },
    hasChild(key) {
      return Object.hasOwn(value, key);
    },
    child(key) {
      return snapshot(value?.[key]);
    },
    isNumber() {
      return typeof value === "number" && Number.isFinite(value);
    },
    isString() {
      return typeof value === "string";
    },
    val() {
      return value;
    },
  };
}

test("채팅 규칙은 기존 플레이어 검증을 보존하고 작성자와 메시지 구조를 제한한다", async () => {
  const rules = JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8"));
  const room = rules.rules.rooms.$roomId;
  assert.deepEqual(room.players[".indexOn"], ["mapId"]);
  assert.match(room.players.$uid[".validate"], /mapId/);
  assert.equal(room.chat[".read"], "auth != null");
  assert.match(room.chat.$uid[".write"], /auth\.uid === \$uid/);
  assert.equal(room.chat.$uid[".validate"], "newData.hasChildren()");
  assert.doesNotMatch(room.chat.$uid[".validate"], /numChildren/);
  const message = room.chat.$uid.$messageId;
  assert.match(message[".validate"], /hasChildren/);
  assert.match(message.text[".validate"], /length <= 1024/);
  assert.match(message.mapId[".validate"], /village/);
  assert.equal(message.$other[".validate"], false);
});

test("플레이어 규칙은 레거시 무기 누락과 알려진 ID만 허용한다", async () => {
  const rules = JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8"));
  const expression = rules.rules.rooms.$roomId.players.$uid[".validate"];
  const validate = Function("newData", "data", "now", `return (${expression});`);
  const evaluate = value => validate(snapshot(value), snapshot({}), Date.now());
  const player = {
    x: 100,
    y: 100,
    dir: "down",
    moving: false,
    name: "아렌",
    color: "#ffffff",
    mapId: "village",
  };
  assert.equal(evaluate(player), true);
  for (const equippedWeaponId of WEAPON_ORDER) {
    assert.equal(evaluate({ ...player, equippedWeaponId }), true, equippedWeaponId);
  }
  assert.equal(evaluate({ ...player, equippedWeaponId: "unknown" }), false);
  assert.equal(evaluate({ ...player, equippedWeaponId: 7 }), false);
});

test("플레이어 규칙은 직업별 일곱 무기 조합만 허용한다", async () => {
  const rules = JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8"));
  const expression = rules.rules.rooms.$roomId.players.$uid[".validate"];
  const validate = Function("newData", "data", "now", `return (${expression});`);
  const evaluate = value => validate(snapshot(value), snapshot({}), Date.now());
  const player = {
    x: 100,
    y: 100,
    dir: "down",
    moving: false,
    name: "직업",
    color: "#ffffff",
    mapId: "village",
  };
  for (const [classId, weaponIds] of Object.entries(WEAPON_ORDER_BY_CLASS)) {
    for (const equippedWeaponId of weaponIds) {
      assert.equal(evaluate({ ...player, classId, equippedWeaponId }), true, `${classId}:${equippedWeaponId}`);
    }
  }
  assert.equal(evaluate({ ...player, classId: "warrior", equippedWeaponId: "hunter-bow" }), false);
  assert.equal(evaluate({ ...player, classId: "archer", equippedWeaponId: "training-staff" }), false);
  assert.equal(evaluate({ ...player, classId: "mage", equippedWeaponId: "starter-sword" }), false);
  assert.equal(evaluate({ ...player, classId: "rogue", equippedWeaponId: "starter-sword" }), false);
  assert.equal(evaluate({ ...player, equippedWeaponId: "hunter-bow" }), false);
  assert.equal(evaluate({ ...player, classId: "archer" }), false);
});

test("공개방 슬롯은 0~9에서 자기 UID만 생성·삭제할 수 있다", async () => {
  const rules = JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8"));
  const slots = rules.rules.rooms.$roomId.slots;
  assert.equal(slots[".read"], "auth != null");
  assert.match(slots.$slot[".write"], /\^\[0-9\]\$/);
  assert.match(slots.$slot[".write"], /auth\.uid/);
  assert.match(slots.$slot[".validate"], /newData\.val\(\) === auth\.uid/);
});

test("Realtime Database 규칙에 지역별 협동 보스 경로가 존재한다", async () => {
  const rules = JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8"));
  assert.ok(rules.rules.rooms.$roomId.bosses.$mapId.state);
  assert.ok(rules.rules.rooms.$roomId.bosses.$mapId.attacks);
  assert.ok(rules.rules.rooms.$roomId.bosses.$mapId.playerDamage);
  assert.ok(rules.rules.rooms.$roomId.bosses.$mapId.rewardClaims);
});
