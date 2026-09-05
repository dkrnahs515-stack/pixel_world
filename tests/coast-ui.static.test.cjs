const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = file => readFileSync(path.join(root, file), "utf8");

test("해안 챕터 추적기와 기록 버튼은 기존 퀘스트 추적기에 추가된다", () => {
  const html = read("index.html");

  assert.match(html, /id="chapterObjective"/);
  assert.match(html, /id="communicationLogButton"[^>]*aria-label="통신 기록 열기"/);
});

test("HUD의 통신 기록 버튼은 부모의 pointer 차단을 명시적으로 해제한다", () => {
  const css = read("styles-20260903-volcano.css");
  const buttonRule = css.match(/\.communication-log-button\s*\{([^}]*)\}/)?.[1] || "";

  assert.match(css, /\.hud\s*\{[^}]*pointer-events:\s*none/);
  assert.match(buttonRule, /pointer-events:\s*auto/);
});

test("통신 기록 모달은 접근 가능한 대화상자와 시간순 목록을 제공한다", () => {
  const html = read("index.html");
  const main = read("src/main-20260903-volcano.js");
  const log = read("src/communication-log-20260829-coast.js");

  assert.match(html, /id="communicationLogOverlay"[^>]*hidden/);
  assert.match(html, /role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="communicationLogTitle"/);
  assert.match(html, /id="communicationLogList"[^>]*aria-label="시간순 통신 기록"/);
  assert.match(html, /id="communicationLogCloseButton"[^>]*aria-label="통신 기록 닫기"/);
  assert.match(log, /timelineOrder/);
  assert.match(log, /sort\(\(left, right\) => left\.timelineOrder - right\.timelineOrder\)/);
  assert.match(main, /game\.openCommunicationLog\(\)/);
  assert.match(main, /game\.closeCommunicationLog\(\)/);
});

test("대화는 세 선택을 담는 행동 컨테이너와 명확한 레이블을 제공한다", () => {
  const html = read("index.html");
  const css = read("styles-20260903-volcano.css");
  const main = read("src/main-20260903-volcano.js");

  assert.match(html, /id="dialogueActions"[^>]*aria-label="대화 선택"/);
  assert.match(html, /id="dialogueActionButton"/);
  assert.match(css, /\.dialogue-actions\s*\{/);
  assert.match(main, /dialogueActionContainer:\s*document\.querySelector\("#dialogueActions"\)/);
});

test("모바일에서 대화 선택과 기록 목록은 한 열로 표시된다", () => {
  const css = read("styles-20260903-volcano.css");

  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*?\.dialogue-actions\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*?\.communication-log-list\s*\{[^}]*grid-template-columns:\s*1fr/);
});
