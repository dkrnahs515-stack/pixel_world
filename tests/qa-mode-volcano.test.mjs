import test from "node:test";
import assert from "node:assert/strict";
import { prepareWeaponQaProgress } from "../src/qa-mode-20260903-volcano-20260905-upgrade.js";
import { createInitialProgress } from "../src/quest-state-20260903-volcano-20260905-upgrade.js";
import { WEAPON_ORDER_BY_CLASS as ORDINARY_WEAPON_IDS } from "../src/weapon-data-20260905-upgrade.js";
import { VOLCANO_HIDDEN_WEAPON_IDS } from "../src/weapon-data-20260903-volcano-20260905-upgrade.js";

const EQUIPPED_ORDINARY_WEAPON_IDS = Object.freeze({
  warrior: "katana",
  archer: "hunter-bow",
  mage: "apprentice-staff",
});

for (const classId of ["warrior", "archer", "mage"]) {
  test(`QA Prepare preserves the earned ${classId} hidden weapon and equipped ID`, () => {
    const source = createInitialProgress();
    const hiddenWeaponId = VOLCANO_HIDDEN_WEAPON_IDS[classId];
    source.equipmentByClass[classId] = {
      ownedWeaponIds: [ORDINARY_WEAPON_IDS[classId][0], hiddenWeaponId],
      equippedWeaponId: hiddenWeaponId,
    };
    source.worldProgress.chapters.volcano.hiddenWeaponRewardClaimed = true;

    const prepared = prepareWeaponQaProgress(source, classId);

    assert.deepEqual(prepared.equipmentByClass[classId], {
      ownedWeaponIds: [...ORDINARY_WEAPON_IDS[classId], hiddenWeaponId],
      equippedWeaponId: hiddenWeaponId,
    });
    assert.equal(prepared.worldProgress.chapters.volcano.hiddenWeaponRewardClaimed, true);
  });
}

test("QA Prepare never grants unearned hidden weapons or changes an ordinary equipped ID", () => {
  for (const classId of ["warrior", "archer", "mage"]) {
    const source = createInitialProgress();
    const equippedWeaponId = EQUIPPED_ORDINARY_WEAPON_IDS[classId];
    source.equipmentByClass[classId] = {
      ownedWeaponIds: [ORDINARY_WEAPON_IDS[classId][0], equippedWeaponId],
      equippedWeaponId,
    };

    const prepared = prepareWeaponQaProgress(source, classId);

    assert.deepEqual(prepared.equipmentByClass[classId], {
      ownedWeaponIds: ORDINARY_WEAPON_IDS[classId],
      equippedWeaponId,
    });
    assert.equal(
      prepared.equipmentByClass[classId].ownedWeaponIds.includes(
        VOLCANO_HIDDEN_WEAPON_IDS[classId],
      ),
      false,
    );
    assert.equal(prepared.worldProgress.chapters.volcano.hiddenWeaponRewardClaimed, false);
  }
});
