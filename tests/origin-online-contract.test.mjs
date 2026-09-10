import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  acquireOriginAuthority,
  renewOriginAuthority,
} from "../src/origin-boss-state-20260910-sanctuary.js";
import { advanceOriginAuthorityState } from "../src/origin-boss-controller-20260910-sanctuary.js";
import { serializePlayerState } from "../src/network-state-20260910-sanctuary.js";
import {
  fixedOriginContext,
  rewriteOriginEncounter,
} from "./helpers/sanctuary-fixtures.mjs";

test("origin authority handoff preserves hp phase anchors and rewrite progress", () => {
  const current = rewriteOriginEncounter({
    hp: 240,
    leaseUntil: 9_000,
    authorityUid: "player-a",
    authorityEpoch: 4,
    anchors: {
      "origin-anchor-life": { active: true, hp: 22, maxHp: 40, x: 520, y: 620 },
    },
    rewriteCycle: { phase: "warning", elapsed: 0.3, sequence: 7 },
  });
  const acquired = acquireOriginAuthority(current, { uid: "player-b", now: 10_000 });
  assert.equal(acquired.ok, true);
  assert.equal(acquired.encounter.authorityUid, "player-b");
  assert.equal(acquired.encounter.authorityEpoch, 5);
  assert.equal(acquired.encounter.hp, 240);
  assert.equal(acquired.encounter.originPhase, "rewrite");
  assert.equal(acquired.encounter.anchors["origin-anchor-life"].hp, 22);
  assert.deepEqual(acquired.encounter.rewriteCycle, { phase: "warning", elapsed: 0.3, sequence: 7 });

  const renewed = renewOriginAuthority(acquired.encounter, {
    uid: "player-b",
    authorityEpoch: 5,
    now: 11_000,
  });
  assert.equal(renewed.ok, true);
  assert.equal(renewed.encounter.authorityEpoch, 5);
  assert.equal(renewed.encounter.leaseUntil, 17_000);
});

test("rewrite phase creates exactly three anchors and warns before impact", () => {
  const result = advanceOriginAuthorityState(
    rewriteOriginEncounter({ anchors: {}, rewriteCycle: { phase: "idle", elapsed: 0, sequence: 0 } }),
    0.1,
    fixedOriginContext(),
  );
  assert.deepEqual(Object.keys(result.encounter.anchors).sort(), [
    "origin-anchor-energy",
    "origin-anchor-life",
    "origin-anchor-memory",
  ]);
  assert.equal(result.events.some(event => event.type === "rewrite-warning"), true);
  assert.equal(result.events.some(event => event.type === "rewrite-impact"), false);
});

test("new sanctuary maps serialize as online presence", () => {
  for (const mapId of [
    "sanctuary-resonance-hall",
    "sanctuary-origin-archive",
    "sanctuary-zero-boundary",
    "sanctuary-core-heart",
  ]) {
    const state = serializePlayerState({
      x: 1080,
      y: 900,
      level: 10,
      mp: 100,
      hp: 100,
      dir: "down",
      moving: false,
      color: "#ffffff",
      name: "성역",
      classId: "warrior",
      equippedWeaponId: "starter-sword",
      skillResources: {},
    }, mapId);
    assert.equal(state.mapId, mapId);
  }
});

test("Firebase rules whitelist four new sanctuary maps and ORIGIN final state", async () => {
  const rules = JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8"));
  const room = rules.rules.rooms.$roomId;
  const playerRule = room.players.$uid[".validate"];
  const chatMapRule = room.chat.$uid.$messageId.mapId[".validate"];
  for (const mapId of [
    "sanctuary-resonance-hall",
    "sanctuary-origin-archive",
    "sanctuary-zero-boundary",
    "sanctuary-core-heart",
  ]) {
    assert.match(playerRule, new RegExp(mapId));
    assert.match(chatMapRule, new RegExp(mapId));
  }
  const boss = room.bosses.$mapId;
  assert.match(boss[".read"], /sanctuary-core-heart/);
  assert.match(boss.state[".validate"], /origin-zero/);
  assert.match(boss.state[".validate"], /originPhase/);
  assert.ok(boss.state.anchors?.$anchorId);
  assert.match(boss.state.anchors.$anchorId[".validate"], /origin-anchor-life/);
  assert.match(boss.attacks.$uid.$sequence[".validate"], /origin-zero/);
});
