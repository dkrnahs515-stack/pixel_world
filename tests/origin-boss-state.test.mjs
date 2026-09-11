import test from "node:test";
import assert from "node:assert/strict";
import { validateBossAttack as legacyValidateBossAttack } from "../src/coop-boss-state-20260903-volcano-20260905-upgrade.js";
import { validatePlayerBossAttack } from "../src/boss-attack-validation-20260910-sanctuary.js";
import { getCoopBossForMap } from "../src/coop-boss-data-20260910-sanctuary.js";
import {
  ORIGIN_ANCHOR_IDS,
  applyOriginAttack,
  createOriginEncounter,
  normalizeOriginEncounter,
  originPhaseForHp,
} from "../src/origin-boss-state-20260910-sanctuary.js";
import {
  regionalBossValidation,
  rewriteOriginEncounter,
  validWarriorBossAttack,
} from "./helpers/sanctuary-fixtures.mjs";

test("regional attack validation is unchanged by extraction", () => {
  const request = validWarriorBossAttack();
  const validation = regionalBossValidation();
  assert.deepEqual(
    validatePlayerBossAttack(request, validation),
    legacyValidateBossAttack(request, validation),
  );
});

test("ORIGIN is shared final boss and never triple eligible", () => {
  const origin = getCoopBossForMap("sanctuary-core-heart");
  assert.ok(origin);
  assert.equal(origin.id, "origin-zero");
  assert.equal(origin.baseHp, 1200);
  assert.equal(origin.bossClass, "final");
  assert.equal(origin.tripleEligible, false);
  for (const mapId of ["forest", "coast-tide-core-cave", "volcano-core-caldera"]) {
    assert.equal(getCoopBossForMap(mapId).bossClass, "regional");
    assert.equal(getCoopBossForMap(mapId).tripleEligible, true);
  }
});

test("ORIGIN uses four exact quarter-health phases", () => {
  assert.equal(originPhaseForHp(1200, 1200), "life");
  assert.equal(originPhaseForHp(900, 1200), "memory");
  assert.equal(originPhaseForHp(899, 1200), "memory");
  assert.equal(originPhaseForHp(600, 1200), "energy");
  assert.equal(originPhaseForHp(599, 1200), "energy");
  assert.equal(originPhaseForHp(300, 1200), "rewrite");
  assert.equal(originPhaseForHp(299, 1200), "rewrite");
});

test("ORIGIN encounter uses 1200 solo HP and exact anchor ids", () => {
  const definition = getCoopBossForMap("sanctuary-core-heart");
  const encounter = createOriginEncounter(definition, {
    encounterId: "origin-1",
    partySize: 1,
    now: 1000,
    authorityUid: "player-a",
  });
  assert.equal(encounter.hp, 1200);
  assert.equal(encounter.maxHp, 1200);
  assert.equal(encounter.originPhase, "life");
  assert.deepEqual(encounter.anchors, {});
  assert.deepEqual(ORIGIN_ANCHOR_IDS, [
    "origin-anchor-life",
    "origin-anchor-memory",
    "origin-anchor-energy",
  ]);
  assert.ok(normalizeOriginEncounter(encounter));
});

test("unknown anchors are discarded while known anchor fields are clamped", () => {
  const normalized = normalizeOriginEncounter(rewriteOriginEncounter({
    anchors: {
      "origin-anchor-life": { active: true, hp: 40, maxHp: 40, x: 500, y: 600 },
      "origin-anchor-unknown": { active: true, hp: 999, maxHp: 999, x: 1, y: 1 },
    },
  }));
  assert.deepEqual(Object.keys(normalized.anchors), ["origin-anchor-life"]);
  assert.equal(normalized.anchors["origin-anchor-life"].hp, 40);
});

test("active rewrite anchors block finishing damage at one HP", () => {
  const encounter = rewriteOriginEncounter({
    hp: 20,
    anchors: {
      "origin-anchor-life": { active: true, hp: 10, maxHp: 40, x: 500, y: 600 },
    },
  });
  const result = applyOriginAttack(encounter, { ok: true, uid: "player-a", damage: 50 }, 12000);
  assert.equal(result.applied, true);
  assert.equal(result.blockedByAnchors, true);
  assert.equal(result.defeated, false);
  assert.equal(result.encounter.hp, 1);
});

test("ORIGIN reaches zero exactly once after all anchors are inactive", () => {
  const encounter = rewriteOriginEncounter({
    hp: 20,
    anchors: {
      "origin-anchor-life": { active: false, hp: 0, maxHp: 40, x: 500, y: 600 },
      "origin-anchor-memory": { active: false, hp: 0, maxHp: 40, x: 1080, y: 500 },
      "origin-anchor-energy": { active: false, hp: 0, maxHp: 40, x: 1660, y: 600 },
    },
  });
  const first = applyOriginAttack(encounter, { ok: true, uid: "player-a", damage: 50 }, 12000);
  assert.equal(first.defeated, true);
  assert.equal(first.encounter.hp, 0);
  assert.equal(first.encounter.status, "defeated");
  const second = applyOriginAttack(first.encounter, { ok: true, uid: "player-a", damage: 50 }, 13000);
  assert.equal(second.applied, false);
  assert.equal(second.defeated, false);
});
