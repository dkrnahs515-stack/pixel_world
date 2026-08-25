const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main.js"), "utf8");
const css = readFileSync(path.join(__dirname, "../styles.css"), "utf8");

test("인벤토리는 두 물약의 보유량·최대량·설명·사용 버튼을 제공한다", () => {
  assert.match(html, /id="inventoryButton"/);
  assert.match(html, /id="inventoryOverlay"[^>]*hidden/);
  assert.match(html, /aria-labelledby="inventoryTitle"/);
  assert.match(html, /id="inventoryTitle">인벤토리/);
  assert.match(html, /id="inventoryHpPotionCount"[^>]*>0 \/ 99/);
  assert.match(html, /HP를 30 회복/);
  assert.match(html, /id="inventoryHpUseButton"[^>]*>사용/);
  assert.match(html, /id="inventoryMpPotionCount"[^>]*>0 \/ 99/);
  assert.match(html, /MP를 25 회복/);
  assert.match(html, /id="inventoryMpUseButton"[^>]*>사용/);
});

test("인벤토리 DOM 요소는 게임에 연결된다", () => {
  for (const id of [
    "inventoryButton",
    "inventoryOverlay",
    "inventoryCloseButton",
    "inventoryDoneButton",
    "inventoryHpPotionCount",
    "inventoryMpPotionCount",
    "inventoryHpUseButton",
    "inventoryMpUseButton",
  ]) {
    assert.match(main, new RegExp(`${id}:\\s*document\\.querySelector\\("#${id}"\\)`));
  }
});

test("인벤토리는 플레이 영역 위에 표시되고 모바일에서는 한 열로 배치된다", () => {
  assert.match(css, /\.inventory-overlay \{[^}]*z-index:\s*37/);
  assert.match(css, /\.inventory-items \{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.inventory-items \{[^}]*grid-template-columns:\s*1fr/);
});
