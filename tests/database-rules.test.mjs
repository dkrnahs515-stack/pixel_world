import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { WEAPON_ORDER } from "../src/weapon-data.js";

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
  const validate = Function("newData", `return (${expression});`);
  const player = {
    x: 100,
    y: 100,
    dir: "down",
    moving: false,
    name: "아렌",
    color: "#ffffff",
    mapId: "village",
  };
  assert.equal(validate(snapshot(player)), true);
  for (const equippedWeaponId of WEAPON_ORDER) {
    assert.equal(validate(snapshot({ ...player, equippedWeaponId })), true, equippedWeaponId);
  }
  assert.equal(validate(snapshot({ ...player, equippedWeaponId: "unknown" })), false);
  assert.equal(validate(snapshot({ ...player, equippedWeaponId: 7 })), false);
});
