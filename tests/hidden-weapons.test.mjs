import test from "node:test";
import assert from "node:assert/strict";
import {
  buyWeapon,
  createInitialEquipmentByClass,
  grantVolcanoHiddenWeapons,
  sellWeapon,
} from "../src/equipment-state-20260903-volcano-20260905-upgrade.js";
import { equipmentUiModel } from "../src/equipment-ui-20260903-volcano-20260905-upgrade.js";
import {
  VOLCANO_HIDDEN_WEAPON_IDS,
  WEAPONS,
} from "../src/weapon-data-20260903-volcano-20260905-upgrade.js";
import { drawWeapon } from "../src/weapon-rendering-20260903-volcano-20260905-upgrade.js";
import { attackDefinition } from "../src/combat-20260903-volcano-20260905-upgrade.js";
import { createProjectile } from "../src/projectile-combat-20260903-volcano-20260905-upgrade.js";
import {
  chooseVolcanoRoute,
  normalizeWorldProgress,
  recordChapterBossDefeat,
} from "../src/chapter-progress-20260903-volcano-20260905-upgrade.js";
import { createInitialProgress } from "../src/quest-state-20260903-volcano-20260905-upgrade.js";
import { loadProgress, saveProgress } from "../src/progress-storage-20260903-volcano-20260905-upgrade.js";

const HIDDEN_IDS = {
  warrior: "volcanic-heartblade",
  archer: "ember-tracker-bow",
  mage: "leyflame-core-staff",
};

function rescueBossDefeatedWorld() {
  let worldProgress = normalizeWorldProgress({
    chapters: {
      coast: { coreFragmentObtained: true },
      volcano: {
        repairedDeviceIds: [
          "ash-gate-pressure-seal",
          "magma-valve-west",
          "magma-valve-central",
          "magma-valve-east",
          "observatory-stabilizer",
        ],
        collectedClueIds: [
          "garen-scorched-insignia",
          "garen-escort-record",
          "captain-transport-order",
          "captain-core-contact-record",
        ],
        coolantAnchorIds: [
          "ash-gate-coolant-anchor",
          "magma-route-coolant-anchor",
          "observatory-coolant-anchor",
        ],
      },
    },
    unlockedMapIds: ["volcano-observatory"],
  });
  worldProgress = chooseVolcanoRoute(worldProgress, "rescue").progress;
  return recordChapterBossDefeat(worldProgress, "volcano").progress;
}

function accountProgress(worldProgress = rescueBossDefeatedWorld()) {
  return {
    level: 30,
    gold: 5000,
    equipmentByClass: createInitialEquipmentByClass(),
    worldProgress,
  };
}

test("히든 무기 세 종은 정확한 tier 8 보상 전용 수치를 가진다", () => {
  assert.deepEqual(VOLCANO_HIDDEN_WEAPON_IDS, HIDDEN_IDS);
  assert.deepEqual(Object.values(HIDDEN_IDS).map(id => {
    const weapon = WEAPONS[id];
    return [
      weapon.id,
      weapon.name,
      weapon.classId,
      weapon.tier,
      weapon.requiredLevel,
      weapon.price,
      weapon.sellPrice,
      weapon.rewardOnly,
      weapon.damage,
      weapon.range,
      weapon.projectileSpeed ?? null,
      weapon.explosionRadius ?? null,
      weapon.strongCooldown,
    ];
  }), [
    ["volcanic-heartblade", "불굴의 화심검", "warrior", 8, 30, null, null, true, 11.0, 80, null, null, 3],
    ["ember-tracker-bow", "불굴의 잿불궁", "archer", 8, 30, null, null, true, 10.6, 500, 750, null, 3.2],
    ["leyflame-core-staff", "불굴의 용맥지팡이", "mage", 8, 30, null, null, true, 11.4, 405, 575, 156, 3.4],
  ]);
});

test("구조 성공은 세 직업 히든 무기를 한 번에 지급하고 자동 장착하지 않는다", () => {
  const source = accountProgress();
  const granted = grantVolcanoHiddenWeapons(source);
  assert.equal(granted.ok, true);
  assert.equal(granted.progress.worldProgress.chapters.volcano.captainOutcome, "rescued");
  assert.equal(granted.progress.worldProgress.chapters.volcano.hiddenWeaponRewardClaimed, true);
  for (const [classId, weaponId] of Object.entries(HIDDEN_IDS)) {
    assert.equal(granted.progress.equipmentByClass[classId].ownedWeaponIds.at(-1), weaponId);
    assert.equal(
      granted.progress.equipmentByClass[classId].equippedWeaponId,
      source.equipmentByClass[classId].equippedWeaponId,
    );
  }
  assert.deepEqual(source.equipmentByClass, createInitialEquipmentByClass());
});

test("구조 보상은 v7 저장 왕복 뒤에도 세 직업 장비에 남는다", () => {
  const source = createInitialProgress();
  source.worldProgress = rescueBossDefeatedWorld();
  const granted = grantVolcanoHiddenWeapons(source).progress;
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  assert.equal(saveProgress(storage, "화산 구조대", granted).ok, true);
  const loaded = loadProgress(storage, "화산 구조대");
  for (const [classId, weaponId] of Object.entries(HIDDEN_IDS)) {
    assert.equal(loaded.equipmentByClass[classId].ownedWeaponIds.includes(weaponId), true, classId);
  }
  assert.equal(loaded.worldProgress.chapters.volcano.hiddenWeaponRewardClaimed, true);
});

test("이미 세 히든 무기를 받은 계정에는 보상을 다시 발생시키지 않는다", () => {
  const first = grantVolcanoHiddenWeapons(accountProgress());
  const repeated = grantVolcanoHiddenWeapons(first.progress);
  assert.equal(repeated.ok, false);
  assert.equal(repeated.reason, "already_claimed");
  assert.equal(repeated.progress, first.progress);
  for (const [classId, weaponId] of Object.entries(HIDDEN_IDS)) {
    assert.equal(
      repeated.progress.equipmentByClass[classId].ownedWeaponIds.filter(id => id === weaponId).length,
      1,
    );
  }
});

test("일반 루트나 보스 미처치 상태에는 히든 무기를 지급하지 않는다", () => {
  const beforeBoss = accountProgress(rescueBossDefeatedWorld());
  beforeBoss.worldProgress.chapters.volcano.coopBossDefeated = false;
  beforeBoss.worldProgress.chapters.volcano.captainOutcome = null;
  beforeBoss.worldProgress.chapters.volcano.hiddenWeaponRewardClaimed = false;
  const unavailable = grantVolcanoHiddenWeapons(beforeBoss);
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.reason, "unavailable");
  assert.equal(unavailable.progress, beforeBoss);

  const generalWorld = structuredClone(rescueBossDefeatedWorld());
  generalWorld.chapters.volcano.routeDecision = "proceed";
  const general = grantVolcanoHiddenWeapons(accountProgress(generalWorld));
  assert.equal(general.ok, false);
  assert.equal(general.reason, "reward_only_rescue");
});

test("히든 무기 직접 구매와 판매는 보유 여부보다 reward_only를 우선 반환한다", () => {
  const source = accountProgress();
  assert.equal(buyWeapon(source, "warrior", HIDDEN_IDS.warrior).reason, "reward_only");
  assert.equal(sellWeapon(source, "warrior", HIDDEN_IDS.warrior).reason, "reward_only");
  const granted = grantVolcanoHiddenWeapons(source).progress;
  assert.equal(sellWeapon(granted, "warrior", HIDDEN_IDS.warrior).reason, "reward_only");
});

test("히든 무기는 대장간에서 숨고 보유한 현재 직업 인벤토리에만 나타난다", () => {
  const granted = grantVolcanoHiddenWeapons(accountProgress()).progress;
  for (const [classId, weaponId] of Object.entries(HIDDEN_IDS)) {
    const model = equipmentUiModel({
      classId,
      level: granted.level,
      gold: granted.gold,
      equipment: granted.equipmentByClass[classId],
    });
    assert.equal(model.buyItems.some(item => item.weapon.rewardOnly), false);
    assert.equal(model.sellItems.some(item => item.weapon.rewardOnly), false);
    assert.equal(model.inventoryItems.some(item => item.weapon.id === weaponId), true);
    assert.equal(model.inventoryItems.some(item => item.weapon.classId !== classId), false);
  }
});

test("히든 무기 전투 정의는 정확한 기본 수치와 Q 재사용시간을 사용한다", () => {
  const warrior = attackDefinition("strong", "warrior", HIDDEN_IDS.warrior);
  assert.deepEqual({ damage: warrior.damage, range: warrior.range, cooldown: warrior.cooldown }, {
    damage: 22.0, range: 108, cooldown: 3,
  });
  const archer = attackDefinition("basic", "archer", HIDDEN_IDS.archer);
  assert.deepEqual({ damage: archer.damage, range: archer.range, speed: archer.speed }, {
    damage: 10.6, range: 500, speed: 750,
  });
  const mage = attackDefinition("strong", "mage", HIDDEN_IDS.mage);
  assert.deepEqual({
    damage: mage.damage,
    range: mage.range,
    speed: mage.speed,
    explosionRadius: mage.explosionRadius,
    cooldown: mage.cooldown,
  }, {
    damage: 27.36,
    range: 506.25,
    speed: 575,
    explosionRadius: 156,
    cooldown: 3.4,
  });
});

test("히든 활과 지팡이 투사체는 보상 무기 ID와 전투 수치를 유지한다", () => {
  const arrow = createProjectile({
    id: "hidden-arrow",
    kind: "arrow",
    classId: "archer",
    weaponId: HIDDEN_IDS.archer,
    x: 100,
    y: 100,
    direction: "right",
  });
  assert.deepEqual({
    weaponId: arrow.weaponId,
    damage: arrow.damage,
    speed: arrow.speed,
    maxRange: arrow.maxRange,
  }, {
    weaponId: HIDDEN_IDS.archer,
    damage: 10.6,
    speed: 750,
    maxRange: 500,
  });
  const bolt = createProjectile({
    id: "hidden-bolt",
    kind: "explosive-bolt",
    classId: "mage",
    weaponId: HIDDEN_IDS.mage,
    x: 100,
    y: 100,
    direction: "right",
  });
  assert.equal(bolt.weaponId, HIDDEN_IDS.mage);
  assert.equal(bolt.explosionRadius, 156);
  assert.equal(bolt.speed, 575);
});

function recordingContext() {
  const fills = [];
  let fillStyle = "";
  return {
    fills,
    save() {},
    restore() {},
    rotate() {},
    fillRect(x, y, width, height) { fills.push({ fillStyle, x, y, width, height }); },
    set fillStyle(value) { fillStyle = value; },
    get fillStyle() { return fillStyle; },
  };
}

test("세 히든 무기는 각 직업 외형으로 렌더링된다", () => {
  for (const [classId, weaponId] of Object.entries(HIDDEN_IDS)) {
    const context = recordingContext();
    drawWeapon(context, { classId, direction: "right", weaponId });
    const visual = WEAPONS[weaponId].visual;
    const signature = visual.bladeColor ?? visual.woodColor ?? visual.coreColor;
    assert.equal(context.fills.some(fill => fill.fillStyle === signature), true, weaponId);
  }
});
