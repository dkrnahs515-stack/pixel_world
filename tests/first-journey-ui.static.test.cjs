const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const main = fs.readFileSync(path.join(root, "src/main-20260910-sanctuary.js"), "utf8");
const game = fs.readFileSync(path.join(root, "src/game-20260910-sanctuary.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles-20260910-sanctuary.css"), "utf8");

test("first journey and beginner guide expose accessible UI surfaces", () => {
  for (const id of [
    "firstJourneyOverlay",
    "firstJourneyText",
    "firstJourneyContinue",
    "firstJourneySkip",
    "helpButton",
    "beginnerGuideOverlay",
    "beginnerGuideClose",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /aria-modal=["']true["']/);
  assert.match(html, /초심자 가이드/);
  assert.match(html, /E[^<]*Lv\.5|Lv\.5[^<]*E/);
  assert.match(html, /R[^<]*Lv\.10|Lv\.10[^<]*R/);
});

test("main wires the cinematic controller only after successful game entry", () => {
  assert.match(main, /FirstJourneyController/);
  assert.match(main, /firstJourneyOverlay/);
  assert.match(main, /shouldPlayFirstJourneyIntro\(\)/);
  assert.match(main, /firstJourneyController\.start\(\)/);
  assert.match(main, /finishFirstJourneyIntro/);
});

test("game owns intro persistence, input lock, arrival glitch and guide priority", () => {
  assert.match(game, /FIRST_JOURNEY_ARRIVAL_GLITCH_MS\s*=\s*1100/);
  assert.match(game, /shouldPlayFirstJourneyIntro\(\)/);
  assert.match(game, /finishFirstJourneyIntro\(/);
  assert.match(game, /markIntroSeen\(/);
  assert.match(game, /인트로 확인 상태를 저장하지 못했습니다/);
  assert.match(game, /arrivalGlitch/);
  assert.match(game, /openBeginnerGuide\(\)/);
  assert.match(game, /closeBeginnerGuide\(\)/);
  assert.match(game, /isBeginnerGuideOpen\(\)/);
  assert.match(game, /isFirstJourneyActive\(\)/);
  assert.match(game, /isInteractionOpen\(\)[\s\S]*isBeginnerGuideOpen/);
});

test("arrival glitch is styled and reduced motion is respected", () => {
  assert.match(css, /first-journey/);
  assert.match(css, /arrival-glitch/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
