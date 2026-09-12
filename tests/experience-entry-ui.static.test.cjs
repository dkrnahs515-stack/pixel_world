const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = readFileSync(path.join(root, "index.html"), "utf8");
const cssPath = path.join(root, "styles-20260911-story.css");
const mainPath = path.join(root, "src", "main-20260911-story.js");

test("root page offers separate RPG and Chapter 1 story entries", () => {
  assert.match(html, /<div id="experienceOverlay" class="screen-overlay">/);
  assert.match(html, /id="rpgExperienceButton"[^>]*type="button"/);
  assert.match(html, /<a id="storyExperienceLink"[^>]*href="\.\/story\/"/);
  assert.match(html, /<div id="entryOverlay" class="screen-overlay" hidden>/);
  assert.match(html, /<form id="nicknameForm"[\s\S]*?<button id="returnToExperienceButton"[^>]*type="button"/);
});

test("root page loads the physical story-release CSS and entry module", () => {
  assert.match(html, /href="\.\/styles-20260911-story\.css"/);
  assert.match(html, /src="\.\/src\/main-20260911-story\.js"/);
  assert.ok(existsSync(cssPath));
  assert.ok(existsSync(mainPath));
});

test("experience selector CSS supports responsive keyboard-friendly choices", () => {
  const css = readFileSync(cssPath, "utf8");
  assert.match(css, /\.experience-choice-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.experience-choice:focus-visible\s*\{[^}]*box-shadow/);
  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*?\.experience-choice-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.experience-choice\s*\{[^}]*transition:\s*none/);
});

test("RPG registration and HUD remain present on the root page", () => {
  for (const id of ["nicknameInput", "classSelection", "playModeSelection", "rewardCodeInput", "enterButton", "hud", "playerName", "hpBar"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});
