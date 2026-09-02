const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main-20260902-lease.js"), "utf8");
const game = readFileSync(path.join(__dirname, "../src/game-20260902-lease.js"), "utf8");
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
  assert.match(html, /id="inventoryPotionTitle">물약/);
  assert.match(html, /id="inventoryEquipmentTitle">장비/);
});

test("장비 영역은 현재 직업 보유 장비를 생성할 단일 컨테이너만 제공한다", () => {
  assert.match(html, /id="inventoryWeaponItems"[^>]*class="inventory-equipment-items"/);
  assert.equal((html.match(/data-inventory-weapon="[^"]+"/g) || []).length, 0);
  assert.equal((html.match(/data-equip-weapon="[^"]+"/g) || []).length, 0);
  assert.match(game, /renderInventoryEquipment/);
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
    "inventoryWeaponItems",
  ]) {
    assert.match(main, new RegExp(`${id}:\\s*document\\.querySelector\\("#${id}"\\)`));
  }
  assert.doesNotMatch(main, /document\.querySelectorAll\("\[data-(?:inventory|equip)-weapon/);
});

test("인벤토리는 플레이 영역 위에 표시되고 모바일에서는 한 열로 배치된다", () => {
  assert.match(css, /\.inventory-overlay \{[^}]*z-index:\s*37/);
  assert.match(css, /\.inventory-items \{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.inventory-equipment-items \{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.inventory-items \{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.inventory-equipment-items \{[^}]*grid-template-columns:\s*1fr/);
});
