import test from "node:test";
import assert from "node:assert/strict";
import * as shop from "../src/shop-state.js";

function progress(gold, inventory = shop.createInitialInventory()) {
  return { gold, inventory };
}

test("체력 물약과 마력 물약을 정해진 가격에 구매한다", () => {
  const hpSource = progress(25);
  const hpResult = shop.buyShopItem?.(hpSource, "hpPotion");
  assert.equal(hpResult?.ok, true);
  assert.equal(hpResult?.progress.gold, 15);
  assert.deepEqual(hpResult?.progress.inventory, { hpPotion: 1, mpPotion: 0 });
  assert.deepEqual(hpSource, progress(25));

  const mpResult = shop.buyShopItem?.(progress(20), "mpPotion");
  assert.equal(mpResult?.ok, true);
  assert.equal(mpResult?.progress.gold, 5);
  assert.deepEqual(mpResult?.progress.inventory, { hpPotion: 0, mpPotion: 1 });
});

test("Gold 부족과 최대 보유 상태에서는 구매 상태를 변경하지 않는다", () => {
  const poor = progress(9);
  const poorResult = shop.buyShopItem?.(poor, "hpPotion");
  assert.equal(poorResult?.ok, false);
  assert.equal(poorResult?.reason, "insufficient_gold");
  assert.equal(poorResult?.progress, poor);

  const full = progress(999, { hpPotion: 99, mpPotion: 0 });
  const fullResult = shop.buyShopItem?.(full, "hpPotion");
  assert.equal(fullResult?.ok, false);
  assert.equal(fullResult?.reason, "inventory_full");
  assert.equal(fullResult?.progress, full);
});

test("등록되지 않은 상품은 구매하거나 사용할 수 없다", () => {
  const source = progress(999);
  const buyResult = shop.buyShopItem?.(source, "elixir");
  assert.equal(buyResult?.reason, "not_found");
  assert.equal(buyResult?.progress, source);

  const useResult = shop.usePotion?.(source, {
    itemId: "elixir",
    current: 10,
    max: 100,
  });
  assert.equal(useResult?.reason, "not_found");
  assert.equal(useResult?.progress, source);
});

test("물약은 최대치까지만 회복하고 한 개를 소비한다", () => {
  const hpSource = progress(0, { hpPotion: 2, mpPotion: 1 });
  const hpResult = shop.usePotion?.(hpSource, {
    itemId: "hpPotion",
    current: 85,
    max: 100,
  });
  assert.equal(hpResult?.ok, true);
  assert.equal(hpResult?.value, 100);
  assert.equal(hpResult?.recovered, 15);
  assert.deepEqual(hpResult?.progress.inventory, { hpPotion: 1, mpPotion: 1 });
  assert.deepEqual(hpSource.inventory, { hpPotion: 2, mpPotion: 1 });

  const mpResult = shop.usePotion?.(hpSource, {
    itemId: "mpPotion",
    current: 50,
    max: 100,
  });
  assert.equal(mpResult?.value, 75);
  assert.equal(mpResult?.recovered, 25);
  assert.deepEqual(mpResult?.progress.inventory, { hpPotion: 2, mpPotion: 0 });
});

test("물약이 없거나 자원이 가득 차면 소비하지 않는다", () => {
  const empty = progress(0);
  const emptyResult = shop.usePotion?.(empty, {
    itemId: "hpPotion",
    current: 50,
    max: 100,
  });
  assert.equal(emptyResult?.reason, "out_of_stock");
  assert.equal(emptyResult?.progress, empty);

  const fullHp = progress(0, { hpPotion: 1, mpPotion: 0 });
  const fullResult = shop.usePotion?.(fullHp, {
    itemId: "hpPotion",
    current: 100,
    max: 100,
  });
  assert.equal(fullResult?.reason, "already_full");
  assert.equal(fullResult?.progress, fullHp);
  assert.equal(fullResult?.value, 100);
});
