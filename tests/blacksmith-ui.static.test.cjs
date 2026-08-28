const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main-20260828-classes.js"), "utf8");
const game = readFileSync(path.join(__dirname, "../src/game-20260828-classes.js"), "utf8");
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
  assert.match(html, /id="blacksmithEquippedWeaponText"/);
  assert.match(html, /장착 무기를 판매하면 해당 직업의 기본 무기로 교체/);
});

test("구매·판매 카드는 현재 직업 데이터로 생성할 빈 컨테이너만 제공한다", () => {
  assert.match(html, /id="blacksmithBuyItems"[^>]*class="blacksmith-items"/);
  assert.match(html, /id="blacksmithSellItems"[^>]*class="blacksmith-items"/);
  assert.equal((html.match(/data-buy-weapon="[^"]+"/g) || []).length, 0);
  assert.equal((html.match(/data-sell-weapon="[^"]+"/g) || []).length, 0);
  assert.match(game, /renderBlacksmithEquipment/);
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
    "blacksmithBuyItems",
    "blacksmithSellItems",
    "weaponSaleConfirmOverlay",
    "weaponSaleConfirmText",
    "weaponSaleCancelButton",
    "weaponSaleConfirmButton",
  ]) {
    assert.match(main, new RegExp(`${id}:\\s*document\\.querySelector\\("#${id}"\\)`));
  }
  assert.doesNotMatch(main, /document\.querySelectorAll\("\[data-(?:buy|sell)-weapon/);
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
