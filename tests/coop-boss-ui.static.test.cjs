const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const css = readFileSync(path.join(__dirname, "../styles.css"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main-20260828-coop.js"), "utf8");

test("협동 보스 HUD는 이름·체력·참여자·상태를 가진다", () => {
  assert.match(html, /id="coopBossHud"[^>]*hidden/);
  for (const id of ["coopBossName", "coopBossHpBar", "coopBossHpText", "coopBossParticipants", "coopBossStatus"]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(main, new RegExp(`${id}:\\s*document\\.querySelector\\("#${id}"\\)`));
  }
});

test("협동 보스 HUD는 데스크톱 상단 중앙·좁은 화면 패널 아래에 놓인다", () => {
  assert.match(css, /\.coop-boss-hud\s*\{[^}]*position:\s*absolute[^}]*max-width:\s*520px/);
  assert.match(css, /\.bar\.boss i\s*\{[^}]*background/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.coop-boss-hud\s*\{/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.bar\.boss i\s*\{[^}]*transition:\s*none/);
});
