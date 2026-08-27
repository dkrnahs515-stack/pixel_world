const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main-20260827-2.js"), "utf8");
const css = readFileSync(path.join(__dirname, "../styles.css"), "utf8");

function resolveDesktopWidth(classNames) {
  const desktopCss = css.split("@media")[0];
  const elementClasses = new Set(classNames);
  let winner = null;

  for (const match of desktopCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const width = match[2].match(/(?:^|;)\s*width:\s*([^;]+)/)?.[1].trim();
    if (!width) continue;

    for (const selector of match[1].split(",").map(value => value.trim())) {
      const selectorClasses = [...selector.matchAll(/\.([\w-]+)/g)].map(value => value[1]);
      if (selectorClasses.length === 0 || selectorClasses.some(value => !elementClasses.has(value))) continue;
      const specificity = selectorClasses.length;
      if (!winner || specificity >= winner.specificity) winner = { specificity, width };
    }
  }

  return winner?.width;
}

test("대장간은 구매·판매 탭과 별도 판매 확인창을 접근 가능한 대화상자로 제공한다", () => {
  assert.match(html, /id="blacksmithOverlay"[^>]*hidden/);
  assert.match(html, /aria-labelledby="blacksmithTitle"/);
  assert.match(html, /id="blacksmithTitle">대장장이 브란의 대장간/);
  assert.match(html, /id="blacksmithBuyTab"[^>]*role="tab"[^>]*aria-selected="true"/);
  assert.match(html, /id="blacksmithSellTab"[^>]*role="tab"[^>]*aria-selected="false"/);
  assert.match(html, /id="blacksmithBuyPanel"[^>]*role="tabpanel"/);
  assert.match(html, /id="blacksmithSellPanel"[^>]*role="tabpanel"[^>]*hidden/);
  assert.match(html, /id="weaponSaleConfirmOverlay"[^>]*hidden/);
  assert.match(html, /aria-labelledby="weaponSaleConfirmTitle"/);
  assert.match(html, /id="weaponSaleCancelButton"/);
  assert.match(html, /id="weaponSaleConfirmButton"/);
  assert.match(html, /id="blacksmithEquippedWeaponText"[^>]*>시작 검/);
  assert.match(html, /어떤 무기를 판매해도 시작 검으로 교체/);
});

test("여섯 무기 구매 카드는 승인된 레벨·가격·피해·사거리·강공격 쿨다운을 표시한다", () => {
  const buyButtons = html.match(/data-buy-weapon="[^"]+"/g) || [];
  const buyCards = html.match(/data-buy-weapon-card="[^"]+"/g) || [];
  assert.equal(buyButtons.length, 6);
  assert.equal(buyCards.length, 6);
  assert.equal((html.match(/data-weapon-preview="[^"]+"/g) || []).length, 6);
  for (const values of [
    ["카타나", "Lv.5", "80 G", "피해 1", "사거리 76px", "강공격 4.0초"],
    ["강화 카타나", "Lv.10", "180 G", "피해 1.3", "사거리 76px", "강공격 3.8초"],
    ["상급 카타나", "Lv.15", "350 G", "피해 1.5", "사거리 76px", "강공격 3.5초"],
    ["정예 카타나", "Lv.20", "600 G", "피해 2", "사거리 77px", "강공격 3.3초"],
    ["명검", "Lv.25", "900 G", "피해 2.2", "사거리 77px", "강공격 3.3초"],
    ["강화 명검", "Lv.30", "1300 G", "피해 2.5", "사거리 78px", "강공격 3.1초"],
  ]) {
    for (const value of values) assert.match(html, new RegExp(value.replace(".", "\\.")));
  }
});

test("판매 목록은 여섯 무기의 50% 가격과 상태 훅을 제공한다", () => {
  assert.equal((html.match(/data-sell-weapon="[^"]+"/g) || []).length, 6);
  assert.equal((html.match(/data-sell-weapon-card="[^"]+"/g) || []).length, 6);
  for (const price of ["40 G", "90 G", "175 G", "300 G", "450 G", "650 G"]) {
    assert.match(html, new RegExp(price));
  }
  assert.equal((html.match(/data-buy-weapon-status=/g) || []).length, 6);
  assert.equal((html.match(/data-sell-weapon-status=/g) || []).length, 6);
});

test("대장간 DOM과 무기 버튼 배열은 게임 진입점에 연결된다", () => {
  for (const id of [
    "blacksmithOverlay",
    "blacksmithGoldText",
    "blacksmithEquippedWeaponText",
    "blacksmithCloseButton",
    "blacksmithBuyTab",
    "blacksmithSellTab",
    "blacksmithBuyPanel",
    "blacksmithSellPanel",
    "weaponSaleConfirmOverlay",
    "weaponSaleConfirmText",
    "weaponSaleCancelButton",
    "weaponSaleConfirmButton",
  ]) {
    assert.match(main, new RegExp(`${id}:\\s*document\\.querySelector\\("#${id}"\\)`));
  }
  for (const selector of [
    "[data-buy-weapon]",
    "[data-sell-weapon]",
    "[data-buy-weapon-card]",
    "[data-sell-weapon-card]",
    "[data-buy-weapon-status]",
    "[data-sell-weapon-status]",
    "[data-weapon-preview]",
  ]) {
    assert.ok(main.includes(`document.querySelectorAll("${selector}")`), selector);
  }
});

test("대장간은 QA 아래·HUD 위, 판매 확인은 최상단이며 모바일 카드는 한 열이다", () => {
  assert.match(css, /\.blacksmith-overlay \{[^}]*z-index:\s*37/);
  assert.match(css, /\.weapon-sale-confirm-overlay \{[^}]*z-index:\s*39/);
  assert.match(css, /\.blacksmith-items \{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.blacksmith-items \{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.weapon-preview \{[^}]*image-rendering:\s*pixelated/);
});

test("대장간은 800px 폭을 유지하고 760px 이하에서 양쪽 거래 목록을 한 열로 접는다", () => {
  assert.equal(resolveDesktopWidth(["modal-card", "blacksmith-card"]), "min(100%,800px)");
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.blacksmith-items \{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.blacksmith-item,\s*\.blacksmith-item\.buy-weapon \{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.blacksmith-item > button \{[^}]*width:\s*100%/);
});
