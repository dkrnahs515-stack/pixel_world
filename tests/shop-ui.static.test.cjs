const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main-20260827-2.js"), "utf8");
const css = readFileSync(path.join(__dirname, "../styles.css"), "utf8");

test("상점 모달은 두 물약의 가격·효과·구매 버튼을 제공한다", () => {
  assert.match(html, /id="shopOverlay"[^>]*hidden/);
  assert.match(html, /role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="shopTitle"/);
  assert.match(html, /id="shopTitle">연금술사 미아의 상점/);
  assert.match(html, /id="buyHpPotionButton"[^>]*>10 G 구매/);
  assert.match(html, /작은 체력 물약/);
  assert.match(html, /HP 30 회복/);
  assert.match(html, /id="buyMpPotionButton"[^>]*>15 G 구매/);
  assert.match(html, /작은 마력 물약/);
  assert.match(html, /MP 25 회복/);
});

test("아이템 슬롯 1과 2는 물약 이름·효과·수량을 표시한다", () => {
  assert.match(html, /id="hpPotionSlot"[^>]*data-code="Digit1"/);
  assert.match(html, /id="hpPotionCount"[^>]*>×0/);
  assert.match(html, /id="mpPotionSlot"[^>]*data-code="Digit2"/);
  assert.match(html, /id="mpPotionCount"[^>]*>×0/);
});

test("상점과 물약 DOM 요소가 게임에 연결된다", () => {
  for (const id of [
    "shopOverlay",
    "shopGoldText",
    "shopCloseButton",
    "buyHpPotionButton",
    "buyMpPotionButton",
    "shopHpPotionCount",
    "shopMpPotionCount",
    "hpPotionSlot",
    "mpPotionSlot",
    "hpPotionCount",
    "mpPotionCount",
    "npcPromptText",
  ]) {
    assert.match(main, new RegExp(`${id}:\\s*document\\.querySelector\\("#${id}"\\)`));
  }
});

test("상점 오버레이는 플레이 영역보다 앞에 표시되고 모바일에서 상품을 세로 배치한다", () => {
  assert.match(css, /\.shop-overlay \{[^}]*z-index:\s*36/);
  assert.match(css, /\.shop-item \{[^}]*grid-template-columns:\s*minmax\(0,1fr\) auto/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.shop-item \{[^}]*grid-template-columns:\s*1fr/);
});
