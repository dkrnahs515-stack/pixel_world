const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const css = readFileSync(path.join(__dirname, "../styles-20260903-volcano-20260905-upgrade.css"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main-20260903-volcano-20260905-upgrade.js"), "utf8");

test("입장 화면은 솔로와 온라인 단일 선택 카드를 제공한다", () => {
  assert.match(html, /id="playModeSelection"[^>]*role="radiogroup"/);
  assert.match(html, /data-play-mode="solo"[^>]*aria-checked="false"/);
  assert.match(html, /data-play-mode="online"[^>]*aria-checked="false"/);
  assert.match(html, /id="playModeError"[^>]*role="alert"/);
});

test("온라인 전용 UI는 독립적으로 숨길 수 있다", () => {
  assert.match(html, /id="onlinePresence"/);
  assert.match(html, /id="coopBossHud"[^>]*hidden/);
  assert.match(main, /chatPanel:\s*document\.querySelector\("#chatPanel"\)/);
  assert.match(main, /onlinePresence:\s*document\.querySelector\("#onlinePresence"\)/);
  assert.match(main, /coopBossHud:\s*document\.querySelector\("#coopBossHud"\)/);
});

test("모드 선택은 저장·키보드 이동·세 인자 입장에 연결된다", () => {
  assert.match(main, /readStoredPlayMode\(/);
  assert.match(main, /storePlayMode\(/);
  assert.match(main, /data-play-mode/);
  assert.match(main, /ArrowLeft|ArrowRight/);
  assert.match(main, /game\.enter\(selection\.nickname,\s*selection\.classId,\s*selection\.playMode\)/);
});

test("모드 카드는 데스크톱 2열·모바일 1열·감소 모션을 제공한다", () => {
  assert.match(css, /\.play-mode-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.play-mode-card\[aria-checked="true"\]\s*\{[^}]*border/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.play-mode-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.play-mode-card\s*\{[^}]*transition:\s*none/);
});
