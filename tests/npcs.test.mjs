import test from "node:test";
import assert from "node:assert/strict";
import { getNpcsForWorld } from "../src/npc-data-20260829-coast.js";
import { drawNpc, findNearbyNpc } from "../src/npcs.js";
import { isWorldPositionBlocked } from "../src/world-20260829-coast.js";
import {
  createInitialWorldProgress,
  rescueSera,
} from "../src/chapter-progress-20260829-coast.js";

test("아렌·미아·브란은 역할이 분리되어 중앙 마을에만 배치된다", () => {
  const village = getNpcsForWorld("village");
  assert.deepEqual(village.map(npc => [npc.id, npc.role]), [
    ["aren", "quest"],
    ["mia", "shop"],
    ["brann", "blacksmith"],
  ]);
  const mia = village.find(npc => npc.id === "mia");
  assert.deepEqual(
    { x: mia.x, y: mia.y, interactionRadius: mia.interactionRadius },
    { x: 2300, y: 1000, interactionRadius: 80 },
  );
  assert.equal(isWorldPositionBlocked("village", mia.x, mia.y, 14), false);
  const brann = village.find(npc => npc.id === "brann");
  assert.deepEqual(
    { name: brann.name, x: brann.x, y: brann.y, interactionRadius: brann.interactionRadius },
    { name: "대장장이 브란", x: 2460, y: 1000, interactionRadius: 80 },
  );
  assert.deepEqual(brann.appearance, {
    hairColor: "#6b442b",
    eyeColor: "#4ea5d9",
    apronColor: "#8a5a3b",
  });
  assert.equal(isWorldPositionBlocked("village", brann.x, brann.y, 32), false);
  assert.deepEqual(getNpcsForWorld("forest"), []);
});

test("상호작용 범위 안의 가장 가까운 NPC만 찾는다", () => {
  const [aren] = getNpcsForWorld("village");
  assert.equal(findNearbyNpc([aren], { x: aren.x + 30, y: aren.y }).id, "aren");
  assert.equal(findNearbyNpc([aren], { x: aren.x + 100, y: aren.y }), null);
});

test("두 NPC 상호작용 범위가 겹치면 더 가까운 NPC를 선택한다", () => {
  const npcs = [
    { id: "aren", x: 0, y: 0, interactionRadius: 100 },
    { id: "mia", x: 40, y: 0, interactionRadius: 100 },
  ];
  assert.equal(findNearbyNpc(npcs, { x: 35, y: 0 }).id, "mia");
});

test("마리는 지정된 해안 지도에 actorId로 배치되고 에코는 물리 NPC가 아니다", () => {
  const beach = getNpcsForWorld("coast-beach");
  const station = getNpcsForWorld("coast-flooded-station");

  assert.deepEqual(
    beach.map(npc => ({ actorId: npc.actorId, x: npc.x, y: npc.y, role: npc.role })),
    [{ actorId: "mari", x: 850, y: 620, role: "guide" }],
  );
  assert.deepEqual(
    station.map(npc => ({ actorId: npc.actorId, x: npc.x, y: npc.y, role: npc.role })),
    [{ actorId: "mari", x: 620, y: 1160, role: "guide" }],
  );
  assert.equal(getNpcsForWorld("coast-wreck-bay").some(npc => npc.actorId === "echo"), false);
  assert.equal(getNpcsForWorld("coast-tide-core-cave").some(npc => npc.actorId === "echo"), false);
});

test("세라는 구조 완료 뒤에만 조수 코어 동굴의 상호작용 NPC가 된다", () => {
  const initial = createInitialWorldProgress();
  const bossDefeated = {
    ...initial,
    chapters: {
      ...initial.chapters,
      coast: { ...initial.chapters.coast, coopBossDefeated: true },
    },
  };
  const rescued = rescueSera(bossDefeated);

  assert.deepEqual(getNpcsForWorld("coast-tide-core-cave", initial), []);
  const [sera] = getNpcsForWorld("coast-tide-core-cave", rescued.progress);
  assert.deepEqual(
    { actorId: sera.actorId, name: sera.name, role: sera.role, x: sera.x, y: sera.y, interactionRadius: sera.interactionRadius },
    { actorId: "sera", name: "세라", role: "rescued", x: 1580, y: 720, interactionRadius: 80 },
  );
  assert.equal(findNearbyNpc([sera], { x: 1620, y: 720 }), sera);
});

test("NPC 렌더러는 카메라 기준 좌표에 이름을 그린다", () => {
  const calls = { rects: [], labels: [] };
  const context = {
    save() {},
    restore() {},
    fillRect(x, y, width, height) { calls.rects.push({ x, y, width, height }); },
    fillText(text, x, y) { calls.labels.push({ text, x, y }); },
  };
  const npc = { id: "aren", name: "현자 아렌", x: 1440, y: 520, coatColor: "#6f5bd3" };

  drawNpc(context, npc, 400, 100);

  assert.ok(calls.rects.some(rect => rect.x === 1027 && rect.y === 408));
  assert.deepEqual(calls.labels.at(-1), { text: "현자 아렌", x: 1040, y: 382 });
});

test("브란 렌더러는 갈색 머리·파란 눈·가죽 앞치마를 구분해 그린다", () => {
  const calls = [];
  let fillStyle = "";
  const context = {
    save() {},
    restore() {},
    fillRect(x, y, width, height) { calls.push({ fillStyle, x, y, width, height }); },
    fillText() {},
    set fillStyle(value) { fillStyle = value; },
    get fillStyle() { return fillStyle; },
  };
  const brann = getNpcsForWorld("village").find(npc => npc.id === "brann");
  drawNpc(context, brann);
  assert.ok(calls.some(call => call.fillStyle === "#6b442b" && call.width >= 18));
  assert.equal(calls.filter(call => call.fillStyle === "#4ea5d9" && call.width === 2).length, 2);
  assert.ok(calls.some(call => call.fillStyle === "#8a5a3b" && call.width >= 20));
});
