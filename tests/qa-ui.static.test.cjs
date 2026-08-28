const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main-20260828-coop.js"), "utf8");
const css = readFileSync(path.join(__dirname, "../styles.css"), "utf8");
const readme = readFileSync(path.join(__dirname, "../README.md"), "utf8");

test("QA 도구는 기본 문서에서 숨겨진 버튼과 모달로 제공된다", () => {
  assert.match(html, /id="qaButton"[^>]*hidden/);
  assert.match(html, /id="qaOverlay"[^>]*hidden/);
  assert.match(html, /aria-labelledby="qaTitle"/);
  assert.match(html, /data-qa-world="village"/);
  assert.match(html, /data-qa-world="coast"/);
  assert.match(html, /data-qa-world="volcano"/);
  assert.match(html, /data-qa-world="forest"/);
  assert.equal((html.match(/data-qa-monster=/g) || []).length, 7);
  assert.equal((html.match(/data-qa-weapons="prepare"/g) || []).length, 1);
  assert.equal((html.match(/data-qa-blacksmith="travel"/g) || []).length, 1);
  assert.match(html, /id="qaOverlay"[^>]*hidden[\s\S]*?data-qa-weapons="prepare"/);
  assert.match(html, /현재 직업 7종 무기 준비/);
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
});

test("main은 qa=1 판정 결과만으로 QA 도구를 활성화한다", () => {
  assert.match(main, /const qaEnabled\s*=\s*isQaMode\(location\.search\)/);
  assert.match(main, /qaEnabled,/);
  assert.match(main, /qaButton\.hidden\s*=\s*!qaEnabled/);
  assert.match(main, /qaOpen:\s*game\.isQaOpen\(\)/);
  assert.match(main, /close-qa[\s\S]*game\.closeQaPanel\(\)/);
  assert.match(main, /qaWeaponButton:\s*document\.querySelector\("\[data-qa-weapons='prepare'\]"\)/);
  assert.match(main, /qaBlacksmithButton:\s*document\.querySelector\("\[data-qa-blacksmith='travel'\]"\)/);
});

test("QA 모달은 인벤토리보다 앞에 표시되고 모바일에서 한 열로 접힌다", () => {
  assert.match(css, /\.qa-overlay \{[^}]*z-index:\s*38/);
  assert.match(css, /\.qa-monster-grid \{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.qa-weapon-actions \{[^}]*display:\s*grid[^}]*gap:\s*8px/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.qa-monster-grid \{[^}]*grid-template-columns:\s*1fr/);
});
