const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const css = readFileSync(path.join(__dirname, "../styles.css"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main-20260829-coast.js"), "utf8");

test("입장 화면은 접근 가능한 세 직업 단일 선택 카드와 오류 연결을 제공한다", () => {
  assert.match(html, /id="classSelection"[^>]*role="radiogroup"[^>]*aria-labelledby="classSelectionLabel"/);
  assert.equal((html.match(/class="[^"]*class-card[^"]*"[^>]*role="radio"/g) || []).length, 3);
  for (const classId of ["warrior", "archer", "mage"]) {
    assert.match(html, new RegExp(`data-class-id="${classId}"[^>]*aria-checked="false"[^>]*tabindex="`));
    assert.match(html, new RegExp(`data-class-preview="${classId}"`));
  }
  for (const text of ["검사", "궁수", "마법사", "전방 검격", "회전 베기", "화살", "관통 화살", "마법탄", "폭발 마법탄"]) {
    assert.match(html, new RegExp(text));
  }
  assert.match(html, /id="classError"[^>]*role="alert"/);
  assert.match(html, /id="enterButton"[^>]*disabled/);
});

test("입장 모듈은 저장된 유효 선호만 복구하고 키보드 선택 후 직업과 함께 입장한다", () => {
  assert.match(main, /readStoredClassId\(/);
  assert.match(main, /storeClassId\(/);
  assert.match(main, /validateEntrySelection\(/);
  assert.match(main, /data-class-id/);
  assert.match(main, /ArrowLeft|ArrowRight/);
  assert.match(main, /Space/);
  assert.match(main, /game\.enter\(selection\.nickname,\s*selection\.classId,\s*selection\.playMode\)/);
});

test("직업 카드는 데스크톱 3열·좁은 화면 1열과 스크롤·감소 모션을 제공한다", () => {
  assert.match(css, /\.modal-card\.entry-card\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.class-card-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*?\.class-card-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.class-card\s*\{[^}]*transition:\s*none/);
  assert.match(css, /\.class-card\.selected\s*\{[^}]*border/);
});
