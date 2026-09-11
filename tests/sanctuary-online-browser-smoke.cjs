const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE_URL = process.env.PIXEL_WORLD_URL || "http://127.0.0.1:4173";
const ORIGIN_RECORD_IDS = [
  "origin-record-single-authority",
  "origin-record-sealed-recovery",
  "origin-record-mutual-validation",
];

async function openModulePage(context) {
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  return page;
}

async function createSharedRewriteEncounter(page) {
  return page.evaluate(async () => {
    const bossData = await import("/src/coop-boss-data-20260910-sanctuary.js");
    const originState = await import("/src/origin-boss-state-20260910-sanctuary.js");
    const originController = await import("/src/origin-boss-controller-20260910-sanctuary.js");
    const definition = bossData.getCoopBossForMap("sanctuary-core-heart");
    let encounter = originState.createOriginEncounter(definition, {
      encounterId: "browser-origin-shared",
      partySize: 2,
      now: 1_000,
      authorityUid: "player-a",
      authorityEpoch: 1,
    });
    encounter = originState.applyOriginAttack(encounter, {
      ok: true,
      damage: 10,
      uid: "player-a",
    }, 1_100).encounter;
    encounter = {
      ...encounter,
      hp: Math.max(1, Math.floor(encounter.maxHp * 0.2)),
      leaseUntil: 7_000,
    };
    return originController.advanceOriginAuthorityState(encounter, 0.1, {
      now: 1_200,
      players: [
        { uid: "player-a", x: 1_000, y: 800, alive: true },
        { uid: "player-b", x: 1_160, y: 800, alive: true },
      ],
    }).encounter;
  });
}

async function transferAndDefeat(page, sharedEncounter) {
  return page.evaluate(async encounter => {
    const originState = await import("/src/origin-boss-state-20260910-sanctuary.js");
    const acquired = originState.acquireOriginAuthority(encounter, {
      uid: "player-b",
      now: 8_001,
    });
    if (!acquired.ok) return { acquired, encounter };
    let next = acquired.encounter;
    const preserved = {
      hp: next.hp,
      maxHp: next.maxHp,
      originPhase: next.originPhase,
      anchors: structuredClone(next.anchors),
      rewriteCycle: structuredClone(next.rewriteCycle),
      contributors: structuredClone(next.contributors),
    };
    for (const anchorId of originState.ORIGIN_ANCHOR_IDS) {
      next = originState.applyOriginAnchorDamage(next, anchorId, 100).encounter;
    }
    const finished = originState.applyOriginAttack(next, {
      ok: true,
      damage: next.hp + 100,
      uid: "player-b",
    }, 8_100);
    return { acquired, preserved, result: finished };
  }, sharedEncounter);
}

async function savePersonalEnding(page, { nickname, encounterId, choice }) {
  return page.evaluate(async ({ nickname, encounterId, choice, originRecordIds }) => {
    const { createInitialProgress } = await import("/src/quest-state-20260910-sanctuary.js");
    const { recordOriginDefeat } = await import("/src/chapter-progress-20260910-sanctuary.js");
    const { originReadyProgress } = await import("/tests/helpers/sanctuary-fixtures.mjs");
    const { chooseSanctuaryEnding, grantSanctuaryEndingReward } = await import("/src/sanctuary-ending-state-20260910-sanctuary.js");
    const { saveProgress, loadProgress, progressStorageKey } = await import("/src/progress-storage-20260910-sanctuary.js");
    const { rewardCodeEffects } = await import("/src/reward-codes-20260905-upgrade.js");

    let progress = createInitialProgress();
    progress = {
      ...progress,
      introSeen: true,
      redeemedCodeIds: ["TEACHER", "BOSSKILLBOSS"],
      worldProgress: originReadyProgress({ originRecordIds }),
    };
    progress = {
      ...progress,
      worldProgress: recordOriginDefeat(progress.worldProgress, encounterId).progress,
    };
    const onlineEffects = rewardCodeEffects(progress, "online");
    const chosen = chooseSanctuaryEnding(progress, choice);
    const rewarded = grantSanctuaryEndingReward(chosen.progress);
    const saved = saveProgress(localStorage, nickname, rewarded.progress);
    const loaded = loadProgress(localStorage, nickname);
    return {
      saved: saved.ok,
      key: progressStorageKey(nickname),
      endingChoice: loaded.worldProgress.chapters.sanctuary.endingChoice,
      originDefeated: loaded.worldProgress.chapters.sanctuary.originDefeated,
      receipt: loaded.worldProgress.chapters.sanctuary.originDefeatReceiptId,
      title: loaded.endingTitle,
      gold: loaded.gold,
      onlineEffects,
    };
  }, { nickname, encounterId, choice, originRecordIds: ORIGIN_RECORD_IDS });
}

(async () => {
  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const context = await browser.newContext();
    const pageA = await openModulePage(context);
    const pageB = await openModulePage(context);

    const shared = await createSharedRewriteEncounter(pageA);
    assert.equal(shared.authorityUid, "player-a");
    assert.equal(shared.originPhase, "rewrite");
    assert.equal(Object.keys(shared.anchors).length, 3);
    assert.equal(shared.contributors["player-a"]?.firstHitAt, 1_100);

    const handoff = await transferAndDefeat(pageB, shared);
    assert.equal(handoff.acquired.ok, true);
    assert.equal(handoff.acquired.encounter.authorityUid, "player-b");
    assert.equal(handoff.acquired.encounter.authorityEpoch, shared.authorityEpoch + 1);
    assert.equal(handoff.preserved.hp, shared.hp);
    assert.equal(handoff.preserved.maxHp, shared.maxHp);
    assert.equal(handoff.preserved.originPhase, shared.originPhase);
    assert.deepEqual(handoff.preserved.anchors, shared.anchors);
    assert.deepEqual(handoff.preserved.rewriteCycle, shared.rewriteCycle);
    assert.equal(handoff.result.defeated, true);
    assert.equal(handoff.result.encounter.status, "defeated");
    assert.ok(handoff.result.encounter.contributors["player-a"]);
    assert.ok(handoff.result.encounter.contributors["player-b"]);

    const restore = await savePersonalEnding(pageA, {
      nickname: "온라인복원",
      encounterId: handoff.result.encounter.encounterId,
      choice: "restore",
    });
    const resonate = await savePersonalEnding(pageB, {
      nickname: "온라인공명",
      encounterId: handoff.result.encounter.encounterId,
      choice: "resonate",
    });

    assert.equal(restore.saved, true);
    assert.equal(resonate.saved, true);
    assert.equal(restore.originDefeated, true);
    assert.equal(resonate.originDefeated, true);
    assert.equal(restore.receipt, handoff.result.encounter.encounterId);
    assert.equal(resonate.receipt, handoff.result.encounter.encounterId);
    assert.equal(restore.endingChoice, "restore");
    assert.equal(resonate.endingChoice, "resonate");
    assert.equal(restore.title, "세계의 복원자");
    assert.equal(resonate.title, "세계의 공명자");
    assert.equal(restore.gold, 1000);
    assert.equal(resonate.gold, 1000);

    // The same browser origin stores both nicknames independently; one ending cannot overwrite the other.
    const stored = await pageA.evaluate(async ({ restoreKey, resonateKey }) => {
      const restoreValue = JSON.parse(localStorage.getItem(restoreKey));
      const resonateValue = JSON.parse(localStorage.getItem(resonateKey));
      return {
        restoreChoice: restoreValue.worldProgress.chapters.sanctuary.endingChoice,
        resonateChoice: resonateValue.worldProgress.chapters.sanctuary.endingChoice,
        restoreTitle: restoreValue.endingTitle,
        resonateTitle: resonateValue.endingTitle,
      };
    }, { restoreKey: restore.key, resonateKey: resonate.key });
    assert.deepEqual(stored, {
      restoreChoice: "restore",
      resonateChoice: "resonate",
      restoreTitle: "세계의 복원자",
      resonateTitle: "세계의 공명자",
    });

    // Solo-only reward privileges are disabled in online mode and therefore cannot alter shared ORIGIN.
    for (const result of [restore, resonate]) {
      assert.equal(result.onlineEffects.immortal, false);
      assert.equal(result.onlineEffects.pencilWeapon, false);
      assert.equal(result.onlineEffects.bossCount, 1);
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
