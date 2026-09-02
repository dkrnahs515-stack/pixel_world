import test from "node:test";
import assert from "node:assert/strict";
import {
  COAST_DEVICES,
  COAST_OBJECTIVES,
  COAST_RECORDS,
  COAST_STORY_ACTORS,
  COAST_STORY_INTERACTIONS,
  COAST_TIDE_CORE_REVEAL,
  getCoastStoryContent,
} from "../src/coast-story-data-20260829-coast.js";
import { isWorldPositionBlocked } from "../src/world-20260829-coast.js";

const PLAYER_RADIUS = 14;

const DEVICE_IDS = [
  "coast-beach-transceiver",
  "wreck-relay-west",
  "wreck-relay-deck",
  "wreck-relay-east",
  "flooded-station-main-transceiver",
];

const RECORD_IDS = [
  "sera-distress-current",
  "wreck-record-sera",
  "wreck-record-roan",
  "wreck-record-garen",
  "wreck-record-vanguard-captain",
  "flooded-station-deleted-record",
];

test("coast story data defines the five fixed repair targets and every required record", () => {
  assert.deepEqual(COAST_DEVICES.map(device => device.id), DEVICE_IDS);
  assert.deepEqual(COAST_RECORDS.map(record => record.id), RECORD_IDS);
  assert.equal(COAST_RECORDS.every(record => record.required === true), true);
  assert.equal(COAST_RECORDS.find(record => record.id === "sera-distress-current").signalKind, "current");
  assert.equal(COAST_RECORDS.filter(record => record.id !== "sera-distress-current").every(record => record.signalKind === "past"), true);
});

test("required records provide a stable chronological timeline, including four distinct Wreck Bay moments", () => {
  assert.deepEqual(
    COAST_RECORDS.map(record => [record.id, record.timelineOrder]),
    [
      ["sera-distress-current", 60],
      ["wreck-record-sera", 10],
      ["wreck-record-roan", 20],
      ["wreck-record-garen", 30],
      ["wreck-record-vanguard-captain", 40],
      ["flooded-station-deleted-record", 50],
    ],
  );
  const wreckOrders = COAST_RECORDS
    .filter(record => record.mapId === "coast-wreck-bay")
    .map(record => record.timelineOrder);
  assert.deepEqual(wreckOrders, [10, 20, 30, 40]);
});

test("the Tide Core reveal says Echo formed from flooded records and the core fragment consciousness", () => {
  assert.deepEqual(COAST_TIDE_CORE_REVEAL, {
    id: "tide-core-echo-reveal",
    mapId: "coast-tide-core-cave",
    actorId: "echo",
    pages: ["에코: 나는 침수된 통신 기록과 코어 조각의 의식이 결합해 생겼어."],
  });
  assert.deepEqual(getCoastStoryContent("coast-tide-core-cave").reveal, COAST_TIDE_CORE_REVEAL);
});

test("coast actors and map objectives are frozen, scoped, and ready for investigation guidance", () => {
  assert.deepEqual(COAST_STORY_ACTORS.map(actor => actor.id), ["mari", "sera", "echo"]);
  assert.equal(COAST_STORY_ACTORS.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(COAST_DEVICES), true);
  assert.equal(Object.isFrozen(COAST_RECORDS), true);
  assert.deepEqual(COAST_OBJECTIVES.map(objective => objective.mapId), [
    "coast-beach",
    "coast-wreck-bay",
    "coast-flooded-station",
    "coast-tide-core-cave",
  ]);
  assert.equal(COAST_OBJECTIVES.every(objective => objective.investigationZone.radius >= 180 && objective.investigationZone.radius <= 260), true);
  assert.equal(COAST_DEVICES.every(device => device.pages.length > 0 && device.pages.every(page => page.length <= 48)), true);
});

test("map content excludes content from other coast maps and safely rejects unknown maps", () => {
  const beach = getCoastStoryContent("coast-beach");
  assert.deepEqual(beach.devices.map(device => device.id), ["coast-beach-transceiver"]);
  assert.deepEqual(beach.records.map(record => record.id), ["sera-distress-current"]);
  assert.deepEqual(beach.actors.map(actor => actor.id), ["mari", "echo"]);
  assert.equal(beach.objective.mapId, "coast-beach");
  assert.equal(getCoastStoryContent("village"), null);
});

test("map-scoped actors expose only frozen placements for the requested map", () => {
  for (const mapId of COAST_OBJECTIVES.map(objective => objective.mapId)) {
    const actors = getCoastStoryContent(mapId).actors;
    assert.equal(actors.every(actor => actor.placements.every(placement => placement.mapId === mapId)), true);
    assert.equal(actors.every(Object.isFrozen), true);
    assert.equal(actors.every(actor => Object.isFrozen(actor.placements)), true);
  }

  const beachMari = getCoastStoryContent("coast-beach").actors.find(actor => actor.id === "mari");
  assert.deepEqual(beachMari.placements, [{ mapId: "coast-beach", x: 850, y: 620 }]);
  assert.notStrictEqual(beachMari, COAST_STORY_ACTORS.find(actor => actor.id === "mari"));
});

test("every mandatory story interaction has a collision-safe player point within its interaction radius", () => {
  for (const interaction of COAST_STORY_INTERACTIONS) {
    let reachablePoint = null;
    for (let y = Math.ceil(interaction.y - interaction.interactionRadius); y <= interaction.y + interaction.interactionRadius; y += 1) {
      for (let x = Math.ceil(interaction.x - interaction.interactionRadius); x <= interaction.x + interaction.interactionRadius; x += 1) {
        if (Math.hypot(interaction.x - x, interaction.y - y) > interaction.interactionRadius) continue;
        if (!isWorldPositionBlocked(interaction.mapId, x, y, PLAYER_RADIUS)) {
          reachablePoint = { x, y };
          break;
        }
      }
      if (reachablePoint) break;
    }
    assert.ok(reachablePoint, `${interaction.id} must have a collision-safe point inside its interaction radius`);
  }
});
