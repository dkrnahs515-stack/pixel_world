import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260902-publish.js";
import { completeRegion } from "../src/chapter-progress-20260829-coast.js";
import { createInitialProgress } from "../src/quest-state-20260829-coast.js";

function fixture({ saveOk = true, claimResults = [true], now = 2000 } = {}) {
  const claimed = [];
  const expired = [];
  const notices = [];
  const game = Object.create(PixelRPG.prototype);
  game.progress = { ...createInitialProgress(), gold: 10 };
  game.mapId = "coast";
  game.network = {
    uid: "me",
    coopBoss: {
      claimReward: (encounterId, claim) => {
        claimed.push({ encounterId, claim });
        return Promise.resolve({ ok: claimResults.shift() ?? claimResults.at(-1) ?? true });
      },
      expireRewardClaim: encounterId => { expired.push(encounterId); return Promise.resolve(); },
    },
  };
  game.persistProgress = () => saveOk;
  game.applyProgressionStats = () => {};
  game.updateProgressHud = () => {};
  game.updateHud = () => {};
  game.updateBiome = () => {};
  game.updateChapterUi = () => {};
  game.notify = text => notices.push(text);
  game.coopBossNow = () => now;
  game.processedBossRewardIds = new Set();
  const claim = {
    encounterId: "e", bossId: "coast-core-shark", uid: "me",
    exp: 150, gold: 100, eligible: true, claimedAt: null, expiresAt: 86401000,
  };
  return { game, claim, claimed, expired, notices };
}

test("유효한 기여 보상은 로컬 영수증 저장 뒤 원격 claim을 완료한다", async () => {
  const value = fixture();
  await value.game.receiveBossRewardClaims({ e: { me: value.claim } });
  await value.game.receiveBossRewardClaims({ e: { me: value.claim } });
  assert.equal(value.game.progress.gold, 110);
  assert.equal(value.claimed.length, 1);
  assert.match(value.notices[0], /EXP \+150 · Gold \+100/);
});

test("브라우저 저장 실패는 진행을 되돌리고 원격 claim을 남겨 재시도한다", async () => {
  const value = fixture({ saveOk: false });
  await value.game.receiveBossRewardClaims({ e: { me: value.claim } });
  assert.equal(value.game.progress.gold, 10);
  assert.equal(value.claimed.length, 0);
});

test("로컬 영수증 저장 뒤 원격 claim 실패는 재시도하되 보상을 중복 지급하지 않는다", async () => {
  const value = fixture({ claimResults: [false, true] });
  let saves = 0;
  value.game.persistProgress = () => { saves += 1; return true; };
  await value.game.receiveBossRewardClaims({ e: { me: value.claim } });
  assert.equal(value.game.progress.gold, 110);
  assert.deepEqual(value.game.progress.claimedBossRewardIds, ["e:me"]);
  assert.equal(saves, 1);
  await value.game.receiveBossRewardClaims({ e: { me: value.claim } });
  assert.equal(value.game.progress.gold, 110);
  assert.equal(saves, 1);
  assert.equal(value.claimed.length, 2);
});

test("24시간이 지난 미수령 보상은 지급하지 않고 만료 처리한다", async () => {
  const value = fixture({ now: 86401001 });
  await value.game.receiveBossRewardClaims({ e: { me: value.claim } });
  assert.equal(value.game.progress.gold, 10);
  assert.deepEqual(value.expired, ["e"]);
});

test("온라인 숲 기여 보상도 보상 영수증과 해안 개방을 한 번에 저장한다", async () => {
  const value = fixture();
  value.claim.encounterId = "forest-online-1";
  value.claim.bossId = "forest-core-troll";
  value.claim.exp = 300;
  value.claim.gold = 200;
  value.game.mapId = "forest";
  let saved = null;
  let saves = 0;
  value.game.persistProgress = () => {
    saves += 1;
    saved = structuredClone(value.game.progress);
    return true;
  };

  await value.game.receiveBossRewardClaims({ forest: { me: value.claim } });

  assert.equal(saves, 1);
  assert.deepEqual(saved.claimedBossRewardIds, ["forest-online-1:me"]);
  assert.equal(saved.worldProgress.completedRegionIds.includes("forest"), true);
  assert.equal(saved.worldProgress.unlockedMapIds.includes("coast-beach"), true);
});
