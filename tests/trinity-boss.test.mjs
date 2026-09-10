import test from "node:test";
import assert from "node:assert/strict";
import { getEnemyDefinition } from "../src/enemy-definitions-20260910-sanctuary.js";
import { updateEnemyBehavior } from "../src/enemy-behaviors-20260910-sanctuary.js";
import { createEnemyInstance } from "../src/enemies-20260910-sanctuary.js";
import {
  applyTrinityDamage,
  advanceTrinityEncounter,
  createTrinityEncounter,
  trinityEncounterCount,
  trinityPhaseForHp,
} from "../src/trinity-boss-20260910-sanctuary.js";

const sanctuaryKinds = ["defect-pixel", "core-sentinel", "rewrite-echo"];

test("sanctuary has three dedicated enemy kinds", () => {
  for (const kind of sanctuaryKinds) {
    const definition = getEnemyDefinition(kind);
    assert.ok(definition);
    assert.ok(definition.hp > 0);
    assert.ok(definition.damage > 0);
    assert.equal(typeof definition.behavior, "string");
    assert.ok(createEnemyInstance(kind, { x: 500, y: 500 }, `enemy-${kind}`));
  }
});

test("sanctuary behaviors emit explicit telegraphs before damaging actions", () => {
  const context = {
    random: () => 0.25,
    isBlocked: () => false,
    moveEnemy(enemy, dx, dy) { enemy.x += dx; enemy.y += dy; return true; },
  };
  const player = { uid: "local", x: 600, y: 500, radius: 14 };
  for (const kind of sanctuaryKinds) {
    const enemy = createEnemyInstance(kind, { x: 500, y: 500 }, `enemy-${kind}`);
    const first = updateEnemyBehavior(enemy, player, 0.05, context);
    assert.equal(first.handled, true);
    assert.equal(first.events.some(event => /warning|telegraph/.test(event.type)), true);
    const later = updateEnemyBehavior(enemy, player, 1.5, context);
    const damaging = later.events.filter(event => event.type === "damage-player" || event.type === "enemy-projectile");
    assert.ok(damaging.length >= 1);
  }
});

test("TRINITY uses 800 HP and approved phase thresholds", () => {
  const boss = createTrinityEncounter({ now: 0 });
  assert.equal(boss.maxHp, 800);
  assert.equal(boss.hp, 800);
  assert.equal(trinityPhaseForHp(800, 800), "life");
  assert.equal(trinityPhaseForHp(560, 800), "memory");
  assert.equal(trinityPhaseForHp(559, 800), "memory");
  assert.equal(trinityPhaseForHp(320, 800), "energy");
  assert.equal(trinityPhaseForHp(319, 800), "energy");
  assert.equal(trinityPhaseForHp(160, 800), "mixed");
  assert.equal(trinityPhaseForHp(159, 800), "mixed");
});

test("TRINITY phase families always telegraph before damage", () => {
  const samples = [
    [800, "life"],
    [500, "memory"],
    [250, "energy"],
    [100, "mixed"],
  ];
  for (const [hp, expectedPhase] of samples) {
    const state = { ...createTrinityEncounter({ now: 0 }), hp };
    const first = advanceTrinityEncounter(state, 0.05, {
      now: 0,
      rng: () => 0.25,
      player: { uid: "local", x: 1080, y: 900, radius: 14 },
      arena: { width: 2160, height: 1800 },
    });
    assert.equal(first.state.phase, expectedPhase);
    assert.equal(first.events.some(event => event.type === "trinity-telegraph"), true);
    const second = advanceTrinityEncounter(first.state, 1.5, {
      now: 1500,
      rng: () => 0.25,
      player: { uid: "local", x: 1080, y: 900, radius: 14 },
      arena: { width: 2160, height: 1800 },
    });
    assert.equal(second.events.some(event => event.type === "damage-player" || event.type === "trinity-projectile" || event.type === "trinity-eruption"), true);
  }
});

test("TRINITY defeat emits once and clamps HP at zero", () => {
  const boss = { ...createTrinityEncounter({ now: 0 }), hp: 10 };
  const first = applyTrinityDamage(boss, 25);
  assert.equal(first.state.hp, 0);
  assert.equal(first.events.filter(event => event.type === "trinity-defeated").length, 1);
  const second = applyTrinityDamage(first.state, 25);
  assert.equal(second.state.hp, 0);
  assert.equal(second.events.filter(event => event.type === "trinity-defeated").length, 0);
});

test("BOSSKILLBOSS never changes TRINITY count", () => {
  assert.equal(trinityEncounterCount({ bossCount: 1 }), 1);
  assert.equal(trinityEncounterCount({ bossCount: 3 }), 1);
});
