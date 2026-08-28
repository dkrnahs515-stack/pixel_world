import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function load() {
  return JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8"));
}

test("협동 보스는 인증 사용자와 세 전투 지역만 읽는다", async () => {
  const bosses = (await load()).rules.rooms.$roomId.bosses;
  assert.ok(bosses?.$mapId);
  assert.match(bosses.$mapId[".read"], /auth != null/);
  assert.match(bosses.$mapId[".read"], /coast/);
  assert.match(bosses.$mapId[".read"], /volcano/);
  assert.match(bosses.$mapId[".read"], /forest/);
  assert.doesNotMatch(bosses.$mapId[".read"], /village/);
});

test("state 쓰기는 현재 관리자 또는 만료 lease의 epoch+1 인수만 허용한다", async () => {
  const state = (await load()).rules.rooms.$roomId.bosses.$mapId.state;
  assert.match(state[".write"], /authorityUid/);
  assert.match(state[".write"], /leaseUntil.*<= now/);
  assert.match(state[".write"], /authorityEpoch.*\+ 1/);
  assert.match(state[".validate"], /partySize/);
  assert.match(state[".validate"], /<= 10/);
  assert.match(state[".validate"], /hp/);
  assert.match(state[".validate"], /now \+ 10000/);
});

test("공격 요청은 자기 경로·허용 장비·시간만 쓰고 damage를 받지 않는다", async () => {
  const attack = (await load()).rules.rooms.$roomId.bosses.$mapId.attacks.$uid.$sequence;
  assert.match(attack[".write"], /auth\.uid === \$uid/);
  assert.match(attack[".write"], /state\/authorityUid/);
  assert.match(attack[".validate"], /!newData\.hasChild\('damage'\)/);
  for (const value of ["warrior", "archer", "mage", "starter-sword", "training-bow", "training-staff", "basic", "strong"]) {
    assert.match(attack[".validate"], new RegExp(value));
  }
  assert.match(attack[".validate"], /now \+ 5000/);
  assert.match(attack[".validate"], /now - 5000/);
});

test("플레이어 피해와 보상은 관리자 생성·대상 사용자 소비를 분리한다", async () => {
  const map = (await load()).rules.rooms.$roomId.bosses.$mapId;
  const damage = map.playerDamage.$targetUid.$eventId;
  assert.match(damage[".write"], /state\/authorityUid/);
  assert.match(damage[".write"], /auth\.uid === \$targetUid/);
  assert.match(damage[".write"], /authorityUid.*auth\.uid.*!newData\.exists/);
  assert.match(damage[".validate"], /<= 50/);
  const claim = map.rewardClaims.$encounterId.$uid;
  assert.match(claim[".write"], /state\/authorityUid/);
  assert.match(claim[".write"], /auth\.uid === \$uid/);
  assert.match(claim[".write"], /claimedAt/);
  assert.match(claim[".validate"], /expiresAt/);
});

test("온라인 플레이어 HP는 선택 사항으로 허용하되 유효 범위만 저장한다", async () => {
  const player = (await load()).rules.rooms.$roomId.players.$uid;
  assert.match(player[".validate"], /hasChild\('hp'\)/);
  assert.match(player[".validate"], /child\('hp'\)\.val\(\) >= 0/);
  assert.match(player[".validate"], /hasChild\('joinedAt'\)/);
  assert.match(player[".validate"], /child\('joinedAt'\)\.val\(\) <= now \+ 5000/);
  assert.match(player[".validate"], /data\.child\('joinedAt'\)\.val\(\) === newData\.child\('joinedAt'\)\.val\(\)/);
  assert.match(player[".validate"], /now - 5000/);
});

test("Firebase 운영 문서는 App Check를 관찰 후 강제하도록 안내한다", async () => {
  const setup = await readFile(new URL("../FIREBASE_SETUP.md", import.meta.url), "utf8");
  assert.match(setup, /App Check/);
  assert.match(setup, /reCAPTCHA Enterprise/);
  assert.match(setup, /metric|메트릭/i);
  assert.match(setup, /enforcement|강제 적용/i);
  assert.match(setup, /debug token|디버그 토큰/i);
});
