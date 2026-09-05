import test from "node:test";
import assert from "node:assert/strict";
import {
  VOLCANO_COOLANT_ANCHORS,
  VOLCANO_DEVICES,
  VOLCANO_STORY_ACTORS,
  VOLCANO_STORY_CLUES,
  VOLCANO_STORY_INTERACTIONS,
  getVolcanoStoryContent,
} from "../src/volcano-story-data-20260903-volcano.js";
import { WORLD_DEFINITIONS } from "../src/world-data-20260903-volcano.js";
import { pointInRect } from "../src/collision.js";

const PLAYER_RADIUS = 14;

test("활화산 스토리 데이터는 Task 1 전이 ID를 네 맵에 연결한다", () => {
  assert.deepEqual(VOLCANO_DEVICES.map(value => value.id), [
    "ash-gate-pressure-seal",
    "magma-valve-west",
    "magma-valve-central",
    "magma-valve-east",
    "observatory-stabilizer",
  ]);
  assert.deepEqual(VOLCANO_STORY_CLUES.map(value => value.id), [
    "garen-scorched-insignia",
    "garen-escort-record",
    "captain-transport-order",
    "captain-core-contact-record",
  ]);
  assert.deepEqual(VOLCANO_COOLANT_ANCHORS.map(value => value.id), [
    "ash-gate-coolant-anchor",
    "magma-route-coolant-anchor",
    "observatory-coolant-anchor",
  ]);
  assert.equal(VOLCANO_STORY_INTERACTIONS.every(value => value.chapterId === "volcano"), true);
  assert.equal(Object.isFrozen(VOLCANO_STORY_INTERACTIONS), true);
});

test("관측소 기록은 대장이 폭발을 막으려 직접 코어에 손댄 진실을 전한다", () => {
  const order = VOLCANO_STORY_CLUES.find(value => value.id === "captain-transport-order");
  const contact = VOLCANO_STORY_CLUES.find(value => value.id === "captain-core-contact-record");
  assert.match(order.pages.join(" "), /대장.*가렌.*코어 조각.*운반/);
  assert.match(contact.pages.join(" "), /선발대장 자신.*폭발.*코어.*직접/);
  assert.doesNotMatch(contact.pages.join(" "), /배신/);
});

test("맵별 스토리 조회는 다른 맵 대상을 섞지 않고 미등록 맵을 거부한다", () => {
  const observatory = getVolcanoStoryContent("volcano-observatory");
  assert.deepEqual(observatory.devices.map(value => value.id), ["observatory-stabilizer"]);
  assert.deepEqual(observatory.clues.map(value => value.id), [
    "captain-transport-order",
    "captain-core-contact-record",
  ]);
  assert.deepEqual(observatory.coolantAnchors.map(value => value.id), ["observatory-coolant-anchor"]);
  assert.ok(observatory.interactions.some(value => value.id === "volcano-route-console"));
  assert.equal(getVolcanoStoryContent("village"), null);
});

test("가렌과 선발대장 배우 데이터는 활화산 사건의 역할을 고정한다", () => {
  assert.deepEqual(VOLCANO_STORY_ACTORS.map(value => value.id), ["garen", "vanguard-captain"]);
  assert.equal(VOLCANO_STORY_ACTORS.every(Object.isFrozen), true);
  assert.match(VOLCANO_STORY_ACTORS.find(value => value.id === "garen").pages.join(" "), /냉각 쐐기/);
});

test("모든 활화산 상호작용은 장애물 밖의 상호작용 반경에서 접근할 수 있다", () => {
  for (const target of VOLCANO_STORY_INTERACTIONS) {
    const world = WORLD_DEFINITIONS[target.mapId];
    let reachable = false;
    for (let y = Math.ceil(target.y - target.interactionRadius); y <= target.y + target.interactionRadius && !reachable; y += 2) {
      for (let x = Math.ceil(target.x - target.interactionRadius); x <= target.x + target.interactionRadius; x += 2) {
        if (Math.hypot(target.x - x, target.y - y) > target.interactionRadius) continue;
        const blocked = x - PLAYER_RADIUS < 0
          || y - PLAYER_RADIUS < 0
          || x + PLAYER_RADIUS > world.width
          || y + PLAYER_RADIUS > world.height
          || world.obstacles.some(rect => pointInRect(x, y, rect, PLAYER_RADIUS));
        if (!blocked) {
          reachable = true;
          break;
        }
      }
    }
    assert.equal(reachable, true, target.id);
  }
});
