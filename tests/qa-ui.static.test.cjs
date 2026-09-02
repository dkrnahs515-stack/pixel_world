const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main-20260829-coast.js"), "utf8");
const css = readFileSync(path.join(__dirname, "../styles.css"), "utf8");
const readme = readFileSync(path.join(__dirname, "../README.md"), "utf8");
const coastSmoke = readFileSync(path.join(__dirname, "coast-browser-smoke.cjs"), "utf8");

test("QA 도구는 기본 문서에서 숨겨진 버튼과 모달로 제공된다", () => {
  assert.match(html, /id="qaButton"[^>]*hidden/);
  assert.match(html, /id="qaOverlay"[^>]*hidden/);
  assert.match(html, /aria-labelledby="qaTitle"/);
  assert.match(html, /data-qa-world="village"/);
  for (const mapId of [
    "coast-beach",
    "coast-wreck-bay",
    "coast-flooded-station",
    "coast-tide-core-cave",
  ]) {
    assert.match(html, new RegExp(`data-qa-world="${mapId}"`));
  }
  assert.doesNotMatch(html, /data-qa-world="coast"/);
  assert.match(html, /data-qa-world="volcano"/);
  assert.match(html, /data-qa-world="forest"/);
  assert.equal((html.match(/data-qa-monster=/g) || []).length, 7);
  assert.equal((html.match(/data-qa-weapons="prepare"/g) || []).length, 1);
  assert.equal((html.match(/data-qa-blacksmith="travel"/g) || []).length, 1);
  assert.equal((html.match(/data-qa-boss="approach"/g) || []).length, 1);
  assert.match(html, /id="qaOverlay"[^>]*hidden[\s\S]*?data-qa-weapons="prepare"/);
  assert.match(html, /현재 직업 7종 무기 준비/);
  assert.match(html, /현재 지역 보스 앞으로 이동/);
});

test("README는 세 직업 전투·저장·21종 장비·온라인 동기화 범위를 설명한다", () => {
  assert.match(readme, /검사[·\s]+궁수[·\s]+마법사/);
  assert.match(readme, /재접속[\s\S]*직업.*변경/);
  assert.match(readme, /레벨[·\s]+Gold[·\s]+퀘스트[\s\S]*유지/);
  assert.match(readme, /직업별[\s\S]*보유[\s\S]*장착/);
  assert.match(readme, /Ctrl[\s\S]*Q[\s\S]*MP/);
  assert.match(readme, /검 7종[\s\S]*활 7종[\s\S]*지팡이 7종/);
  assert.match(readme, /현재 직업[\s\S]*무기만 표시/);
  assert.match(readme, /직업[·\s]+장착 무기[\s\S]*동기화/);
  assert.match(readme, /원격 공격[\s\S]*피해.*동기화하지/);
  for (const mapName of ["푸른 해변", "난파선 만", "침수된 통신소", "조수 코어 동굴"]) {
    assert.match(readme, new RegExp(mapName));
  }
  assert.match(readme, /통신 기록[\s\S]*F[\s\S]*세라[·\s]+에코[·\s]+마리/);
  assert.match(readme, /솔로[\s\S]*로컬 보스[\s\S]*온라인[\s\S]*협동 보스/);
  assert.match(readme, /연결[\s\S]*끊[\s\S]*최대 체력[\s\S]*로컬 보스/);
  assert.match(readme, /pixel-world\.progress\.v6/);
  assert.match(readme, /v1[~–-]+v5[\s\S]*이전/);
});

test("main은 qa=1 판정 결과만으로 QA 도구를 활성화한다", () => {
  assert.match(main, /const qaEnabled\s*=\s*isQaMode\(location\.search\)/);
  assert.match(main, /qaEnabled,/);
  assert.match(main, /qaButton\.hidden\s*=\s*!qaEnabled/);
  assert.match(main, /qaOpen:\s*game\.isQaOpen\(\)/);
  assert.match(main, /close-qa[\s\S]*game\.closeQaPanel\(\)/);
  assert.match(main, /qaWeaponButton:\s*document\.querySelector\("\[data-qa-weapons='prepare'\]"\)/);
  assert.match(main, /qaBlacksmithButton:\s*document\.querySelector\("\[data-qa-blacksmith='travel'\]"\)/);
  assert.match(main, /qaBossButton:\s*document\.querySelector\("\[data-qa-boss='approach'\]"\)/);
});

test("해안 브라우저 smoke는 두 지역 보스 모두 QA 접근 버튼으로 이동한 뒤 실제 키보드 공격을 반복한다", () => {
  assert.match(coastSmoke, /async function qaApproachBoss\(page\)[\s\S]*?data-qa-boss="approach"/);
  assert.equal((coastSmoke.match(/await qaApproachBoss\(page\)/g) || []).length, 2);
  assert.doesNotMatch(coastSmoke, /move\(page, "ArrowUp", 6900\)/);
  assert.doesNotMatch(coastSmoke, /move\(page, "ArrowDown", 1900\)[\s\S]*?move\(page, "ArrowRight", 4300\)[\s\S]*?fightUntilSaved/);
  assert.match(coastSmoke, /page\.keyboard\.press\("Control"\)/);
  assert.match(coastSmoke, /worldProgress[\s\S]*completedRegionIds[\s\S]*chapters[\s\S]*coopBossDefeated/);
});

test("해안 보스 완료 뒤 세라 상호작용 전에는 위로만 이동하고 수평 이동하지 않는다", () => {
  const route = coastSmoke.match(
    /"coast local boss",\s*\);([\s\S]*?)await completeStoryInteraction\(page, "story-complete"\)/,
  )?.[1] || "";

  assert.match(route, /await move\(page, "ArrowUp", 2400\)/);
  assert.doesNotMatch(route, /await move\(page, "Arrow(?:Left|Right)"/);
});

test("방 정원 초과 fallback은 숨겨진 상태 요소의 솔로 텍스트를 DOM에서 기다린다", () => {
  const fallback = coastSmoke.match(
    /async function assertOnlineRoomFullFallback\(browser, errors\) \{([\s\S]*?)\n\}/,
  )?.[1] || "";

  assert.match(fallback, /page\.waitForFunction\([\s\S]*?#chatStatus[\s\S]*?textContent[\s\S]*?솔로/);
  assert.doesNotMatch(fallback, /locator\("#chatStatus"\)[\s\S]*?\.waitFor\(/);
  assert.match(fallback, /locator\("#chatPanel"\)\.isHidden\(\)/);
});

test("QA 모달은 인벤토리보다 앞에 표시되고 모바일에서 한 열로 접힌다", () => {
  assert.match(css, /\.qa-overlay \{[^}]*z-index:\s*38/);
  assert.match(css, /\.qa-monster-grid \{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.qa-weapon-actions \{[^}]*display:\s*grid[^}]*gap:\s*8px/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.qa-monster-grid \{[^}]*grid-template-columns:\s*1fr/);
});
