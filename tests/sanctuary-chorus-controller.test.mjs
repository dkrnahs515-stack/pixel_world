import test from "node:test";
import assert from "node:assert/strict";
import { ANCHOR_IDS, BOND_IDS, CHORUS_TESTIMONIES } from "../src/sanctuary-chorus-data-20260911-sanctuary.js";
import {
  applyChorusAction,
  createChorusEncounter,
  validateChorusAction,
} from "../src/sanctuary-chorus-state-20260911-sanctuary.js";
import { createSanctuaryChorusController } from "../src/sanctuary-chorus-controller-20260911-sanctuary.js";

function sharedAction(encounter, uid, type, createdAt, fields = {}) {
  return {
    id: `${type}:${uid}:${createdAt}:${Object.values(fields).join(":")}`,
    encounterId: encounter.encounterId,
    authorityEpoch: encounter.authorityEpoch,
    phase: encounter.phase,
    uid,
    type,
    createdAt,
    ...fields,
  };
}

function advance(encounter, type, fields, createdAt = encounter.updatedAt + 10) {
  const request = sharedAction(encounter, "local-player", type, createdAt, fields);
  const validation = validateChorusAction(request, {
    encounter,
    authenticatedUid: "local-player",
    now: createdAt,
  });
  assert.equal(validation.ok, true, validation.reason);
  return applyChorusAction(encounter, validation, createdAt).encounter;
}

function encounterAt(phase) {
  let encounter = createChorusEncounter({
    encounterId: "chorus-test",
    authorityUid: "local-player",
    now: 1000,
  });
  if (phase === "anchors") return encounter;
  for (const anchorId of ANCHOR_IDS) {
    encounter = advance(encounter, "anchor-stabilize", { fragmentId: anchorId, anchorId });
  }
  if (phase === "testimonies") return encounter;
  for (const testimony of CHORUS_TESTIMONIES) {
    encounter = advance(encounter, "testimony-resolve", {
      testimonyId: testimony.id,
      verdict: testimony.verdict,
    });
  }
  return encounter;
}

function controllerFor(phase = "anchors", options = {}) {
  const controller = createSanctuaryChorusController({
    uid: "local-player",
    mode: "solo",
    seedSnapshot: options.seedSnapshot || encounterAt(phase),
    now: options.now || (() => 1500),
  });
  controller.setMap("sanctuary-return-record", { correctionLinked: true });
  return controller;
}

test("the encounter exists only in the corrected return-record room", () => {
  const controller = createSanctuaryChorusController({ uid: "a", now: () => 1000 });
  controller.setMap("sanctuary-return-record", { correctionLinked: false });
  assert.equal(controller.snapshot, null);

  controller.setMap("sanctuary-memory-archive", { correctionLinked: true });
  assert.equal(controller.snapshot, null);

  controller.setMap("sanctuary-return-record", { correctionLinked: true });
  assert.equal(controller.snapshot.phase, "anchors");
  assert.equal(controller.snapshot.hp, 100);
});

test("basic Q E and R create fragments but never direct cohesion damage", async () => {
  const controller = controllerFor();
  for (const [attackKind, fragmentId] of [
    ["basic", "forest"],
    ["strong", "coast"],
    ["skill-e", "volcano"],
    ["skill-r", "forest"],
  ]) {
    const before = controller.snapshot.hp;
    const result = await controller.requestAttack({
      targetId: "unnamed-chorus",
      attackKind,
      fragmentId,
      hitId: `${attackKind}-hit`,
    });
    assert.equal(result.ok, true);
    assert.equal(controller.snapshot.hp, before);
    assert.equal(ANCHOR_IDS.includes(controller.personalSnapshot.carriedFragmentId), true);
    controller.dropCarriedFragment();
  }
});

test("F interaction places a carried fragment while a wrong anchor affects only personal contamination", async () => {
  const controller = controllerFor();
  await controller.requestAttack({ targetId: "unnamed-chorus", attackKind: "basic", fragmentId: "forest" });
  const prompt = controller.nearbyInteraction({ x: 700, y: 1120 });
  assert.equal(prompt.type, "anchor");
  assert.match(prompt.prompt, /숲/);
  const placed = await controller.interact({ x: 700, y: 1120 });
  assert.equal(placed.ok, true);
  assert.deepEqual(controller.snapshot.stabilizedAnchorIds, ["forest"]);
  assert.equal(controller.snapshot.hp, 90);
  assert.equal(controller.personalSnapshot.carriedFragmentId, null);

  await controller.requestAttack({ targetId: "unnamed-chorus", attackKind: "strong", fragmentId: "forest" });
  const beforeShared = structuredClone(controller.snapshot);
  const misplaced = await controller.interact({ x: 1080, y: 1120 });
  assert.equal(misplaced.ok, false);
  assert.equal(misplaced.reason, "wrong_anchor");
  assert.deepEqual(controller.snapshot, beforeShared);
  assert.equal(controller.personalSnapshot.contamination, 10);
});

test("contamination overload returns a fragment and applies a three-second local lock and slow", async () => {
  const controller = controllerFor("anchors", { now: () => 5000 });
  controller.personalSnapshot.contamination = 90;
  await controller.requestAttack({ targetId: "unnamed-chorus", attackKind: "basic", fragmentId: "forest" });
  const result = await controller.interact({ x: 1080, y: 1120 }, 5000);
  assert.equal(result.reason, "wrong_anchor");
  assert.equal(controller.personalSnapshot.contamination, 50);
  assert.equal(controller.personalSnapshot.carriedFragmentId, null);
  assert.equal(controller.canAttack(7999), false);
  assert.equal(controller.movementMultiplier(7999) < 1, true);
  assert.equal(controller.canAttack(8000), true);
  assert.equal(controller.movementMultiplier(8000), 1);
});

test("testimony verdict stations resolve facts and keep wrong answers personal", async () => {
  const controller = controllerFor("testimonies", { now: () => 2000 });
  const current = CHORUS_TESTIMONIES[0];
  const before = controller.snapshot.hp;
  const wrong = await controller.interact({ x: 1340, y: 1120 }, 2000);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.reason, "wrong_testimony");
  assert.equal(controller.snapshot.hp, before);
  assert.equal(controller.personalSnapshot.contamination, 10);

  const correct = await controller.interact({ x: 700, y: 1120 }, 2001);
  assert.equal(correct.ok, true);
  assert.deepEqual(controller.snapshot.resolvedTestimonyIds, [current.id]);
  assert.equal(controller.snapshot.hp, before - 5);
});

test("a remote player's wrong action never changes this browser's personal contamination", () => {
  const controller = controllerFor("anchors", { now: () => 2000 });
  const request = sharedAction(controller.snapshot, "remote-player", "anchor-stabilize", 2000, {
    fragmentId: "forest",
    anchorId: "coast",
  });

  controller.receiveActions([request]);

  assert.equal(controller.personalSnapshot.contamination, 0);
  assert.equal(controller.snapshot.hp, 100);
});

test("leaving a telegraph before impact avoids damage", () => {
  const seed = {
    ...encounterAt("onslaught"),
    currentPatternId: "forest-roots",
    patternStartedAt: 1000,
    patternEndsAt: 2000,
  };
  const controller = controllerFor("onslaught", { seedSnapshot: seed, now: () => 1900 });
  controller.update(1 / 60, { player: { uid: "local-player", x: 1080, y: 900 } }, 1900);
  const outside = controller.update(1 / 60, {
    player: { uid: "local-player", x: 300, y: 300 },
  }, 2000);
  assert.equal(outside.events.some(value => value.type === "damage-player"), false);
});

test("an onslaught impact checks the current position and dedupes the pattern event", () => {
  const seed = {
    ...encounterAt("onslaught"),
    currentPatternId: "coast-tide",
    patternStartedAt: 1000,
    patternEndsAt: 2000,
  };
  const controller = controllerFor("onslaught", { seedSnapshot: seed, now: () => 2000 });
  const inside = { player: { uid: "local-player", x: 1080, y: 900 } };
  const first = controller.update(1 / 60, inside, 2000);
  const replay = controller.update(1 / 60, inside, 2000);
  assert.equal(first.events.filter(value => value.type === "damage-player").length, 1);
  assert.equal(replay.events.filter(value => value.type === "damage-player").length, 0);
  assert.equal(controller.renderModel().telegraph.id, "coast-tide-cross");
});

test("a restored attack pattern continues the forest coast volcano cycle", () => {
  const seed = {
    ...encounterAt("onslaught"),
    currentPatternId: "coast-tide",
    patternStartedAt: 1000,
    patternEndsAt: 2000,
  };
  const controller = controllerFor("onslaught", { seedSnapshot: seed, now: () => 2351 });

  controller.update(1 / 60, { player: { uid: "local-player", x: 300, y: 300 } }, 2351);

  assert.equal(controller.renderModel().telegraph.id, "volcano-crack-burst");
});

test("a stale telegraph never deals delayed damage after its impact window", () => {
  const seed = {
    ...encounterAt("onslaught"),
    currentPatternId: "forest-roots",
    patternStartedAt: 1000,
    patternEndsAt: 2000,
  };
  const controller = controllerFor("onslaught", { seedSnapshot: seed, now: () => 3000 });

  const tick = controller.update(1 / 60, {
    player: { uid: "local-player", x: 1080, y: 900 },
  }, 3000);

  assert.equal(tick.events.some(event => event.type === "damage-player"), false);
});

test("only a record-activated black bond is targetable and attacks separate without defeat events", async () => {
  const controller = controllerFor("onslaught", { now: () => 3000 });
  controller.update(1 / 60, { player: { uid: "local-player", x: 300, y: 300 } }, 3000);
  const record = controller.nearbyInteraction({ x: 700, y: 620 });
  assert.equal(record.recordId, "roan");
  assert.equal((await controller.interact({ x: 700, y: 620 }, 3000)).ok, true);
  assert.deepEqual(controller.targetableBosses().map(target => target.id), ["chorus-bond-roan"]);

  const result = await controller.requestAttack({
    targetId: "chorus-bond-roan",
    attackKind: "skill-r",
    hitId: "cut-roan",
  }, 3100);
  assert.equal(result.ok, true);
  assert.equal(controller.snapshot.hp, 30);

  let lastResult = result;
  for (let index = 1; index < BOND_IDS.length; index += 1) {
    const bondId = BOND_IDS[index];
    const at = 3200 + index * 100;
    assert.equal((await controller.interact({ x: [1080, 1460, 1080][index - 1], y: [560, 620, 1320][index - 1] }, at)).ok, true);
    lastResult = await controller.requestAttack({ targetId: `chorus-bond-${bondId}`, attackKind: "basic" }, at + 1);
  }
  assert.equal(controller.snapshot.status, "separated");
  assert.equal(controller.snapshot.hp, 0);
  assert.ok(lastResult.events.every(event => !["death", "boss-defeated", "explosion", "corpse"].includes(event.type)));
  assert.equal(controller.renderModel().message,
    "기억 분리 완료\n무명의 합창의 결속이 풀렸습니다.\n기억들은 아직 어느 곳에도 귀속되지 않았습니다.\n이제 남겨진 기억의 운명을 결정해야 합니다.");
  assert.deepEqual(controller.renderModel().separatedFragments.map(fragment => fragment.id), ANCHOR_IDS);
  assert.equal(controller.renderModel().telegraph, null);
});
