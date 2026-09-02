import test from "node:test";
import assert from "node:assert/strict";
import { createInitialProgress } from "../src/quest-state-20260829-coast.js";
import { WEAPON_ORDER_BY_CLASS } from "../src/weapon-data.js";

async function qaModule() {
  try {
    return await import("../src/qa-mode.js");
  } catch {
    return {};
  }
}

test("QA 모드는 URL의 qa 값이 정확히 1일 때만 활성화된다", async () => {
  const { isQaMode } = await qaModule();

  assert.equal(typeof isQaMode, "function");
  assert.equal(isQaMode("?qa=1"), true);
  assert.equal(isQaMode("?mode=play&qa=1"), true);
  assert.equal(isQaMode(""), false);
  assert.equal(isQaMode("?qa=0"), false);
  assert.equal(isQaMode("?qa=true"), false);
});

test("QA 신규 몬스터 목록은 종류마다 고유 지역을 지정한다", async () => {
  const { getQaMonster } = await qaModule();

  assert.equal(typeof getQaMonster, "function");
  assert.deepEqual(getQaMonster("fang-shark"), {
    kind: "fang-shark",
    name: "송곳니 상어",
    mapId: "coast",
  });
  assert.deepEqual(getQaMonster("flame-imp"), {
    kind: "flame-imp",
    name: "불꽃 도깨비",
    mapId: "volcano",
  });
  assert.deepEqual(getQaMonster("moss-troll"), {
    kind: "moss-troll",
    name: "이끼 트롤",
    mapId: "forest",
  });
  assert.equal(getQaMonster("magma-slime-small"), null);
  assert.equal(getQaMonster("unknown"), null);
});

test("QA 소환 위치는 정면 장애물을 피하고 포탈 밖의 첫 안전 후보를 선택한다", async () => {
  const { findQaSpawnPosition } = await qaModule();
  const checked = [];

  assert.equal(typeof findQaSpawnPosition, "function");
  const position = findQaSpawnPosition({
    player: { x: 100, y: 100, dir: "right" },
    radius: 20,
    portals: [{ x: 220, y: 70, w: 80, h: 80 }],
    isBlocked(x, y) {
      checked.push([x, y]);
      return x === 240 && y === 100;
    },
  });

  assert.deepEqual(checked.slice(0, 2), [[240, 100], [100, 240]]);
  assert.deepEqual(position, { x: 100, y: 240 });
});

test("QA 소환 후보가 모두 막히면 위치를 만들지 않는다", async () => {
  const { findQaSpawnPosition } = await qaModule();

  assert.equal(typeof findQaSpawnPosition, "function");
  assert.equal(findQaSpawnPosition({
    player: { x: 100, y: 100, dir: "up" },
    radius: 20,
    portals: [],
    isBlocked: () => true,
  }), null);
});

test("QA 보스 접근 위치는 보스 아래에서 장애물과 포탈을 피한 첫 공격 가능 후보를 고른다", async () => {
  const { findQaBossApproachPosition } = await qaModule();
  const checked = [];

  assert.equal(typeof findQaBossApproachPosition, "function");
  const position = findQaBossApproachPosition({
    boss: { x: 100, y: 100 },
    radius: 14,
    portals: [{ x: 98, y: 162, w: 4, h: 4 }],
    isBlocked(x, y, radius) {
      checked.push([x, y, radius]);
      return false;
    },
  });

  assert.deepEqual(checked.slice(0, 2), [[100, 164, 14], [52, 164, 14]]);
  assert.deepEqual(position, { x: 52, y: 164 });
});

test("QA 보스 접근 후보가 모두 막히면 위치를 만들지 않는다", async () => {
  const { findQaBossApproachPosition } = await qaModule();

  assert.equal(typeof findQaBossApproachPosition, "function");
  assert.equal(findQaBossApproachPosition({
    boss: { x: 100, y: 100 },
    radius: 14,
    portals: [],
    isBlocked: () => true,
  }), null);
});

test("장비 QA 준비는 현재 직업 7종만 채우고 공통 진행과 다른 직업 장비를 보존한다", async () => {
  const { prepareWeaponQaProgress } = await qaModule();
  const original = createInitialProgress();
  const source = {
    ...original,
    gold: 120,
    inventory: { hpPotion: 2, mpPotion: 3 },
    equipmentByClass: {
      ...original.equipmentByClass,
      warrior: {
        ownedWeaponIds: ["starter-sword", "katana"],
        equippedWeaponId: "katana",
      },
    },
    completedQuests: ["oldQuest"],
    quests: {
      ...original.quests,
      sideQuest: { status: "active", progress: 2 },
    },
  };
  const before = structuredClone(source);

  assert.equal(typeof prepareWeaponQaProgress, "function");
  const prepared = prepareWeaponQaProgress(source, "archer");
  assert.equal(prepared.level, 30);
  assert.equal(prepared.exp, 0);
  assert.equal(prepared.nextLevelExp, 3000);
  assert.equal(prepared.gold, 5000);
  assert.deepEqual(prepared.inventory, source.inventory);
  assert.deepEqual(prepared.equipmentByClass.archer, {
    ownedWeaponIds: WEAPON_ORDER_BY_CLASS.archer,
    equippedWeaponId: "training-bow",
  });
  assert.deepEqual(prepared.equipmentByClass.warrior, source.equipmentByClass.warrior);
  assert.deepEqual(prepared.equipmentByClass.mage, source.equipmentByClass.mage);
  assert.deepEqual(prepared.completedQuests, source.completedQuests);
  assert.deepEqual(prepared.quests, source.quests);
  assert.notEqual(prepared.inventory, source.inventory);
  assert.notEqual(prepared.equipmentByClass, source.equipmentByClass);
  for (const classId of ["warrior", "archer", "mage"]) {
    assert.notEqual(prepared.equipmentByClass[classId], source.equipmentByClass[classId]);
    assert.notEqual(
      prepared.equipmentByClass[classId].ownedWeaponIds,
      source.equipmentByClass[classId].ownedWeaponIds,
    );
  }
  assert.deepEqual(source, before);

  assert.equal(prepareWeaponQaProgress({ ...source, gold: 7000 }, "mage").gold, 7000);
});
