export const SHOP_ITEMS = Object.freeze({
  hpPotion: Object.freeze({
    id: "hpPotion",
    name: "작은 체력 물약",
    price: 10,
    resource: "hp",
    restore: 30,
    maxQuantity: 99,
  }),
  mpPotion: Object.freeze({
    id: "mpPotion",
    name: "작은 마력 물약",
    price: 15,
    resource: "mp",
    restore: 25,
    maxQuantity: 99,
  }),
});

export function createInitialInventory() {
  return { hpPotion: 0, mpPotion: 0 };
}

export function buyShopItem(progress, itemId) {
  const item = SHOP_ITEMS[itemId];
  if (!item) return { ok: false, reason: "not_found", item: null, progress };
  if (progress.inventory[itemId] >= item.maxQuantity) {
    return { ok: false, reason: "inventory_full", item, progress };
  }
  if (progress.gold < item.price) {
    return { ok: false, reason: "insufficient_gold", item, progress };
  }
  return {
    ok: true,
    reason: null,
    item,
    progress: {
      ...progress,
      gold: progress.gold - item.price,
      inventory: {
        ...progress.inventory,
        [itemId]: progress.inventory[itemId] + 1,
      },
    },
  };
}

export function usePotion(progress, { itemId, current, max }) {
  const item = SHOP_ITEMS[itemId];
  if (!item) {
    return {
      ok: false,
      reason: "not_found",
      item: null,
      progress,
      value: current,
      recovered: 0,
    };
  }
  if (progress.inventory[itemId] <= 0) {
    return {
      ok: false,
      reason: "out_of_stock",
      item,
      progress,
      value: current,
      recovered: 0,
    };
  }
  if (current >= max) {
    return {
      ok: false,
      reason: "already_full",
      item,
      progress,
      value: current,
      recovered: 0,
    };
  }
  const value = Math.min(current + item.restore, max);
  return {
    ok: true,
    reason: null,
    item,
    progress: {
      ...progress,
      inventory: {
        ...progress.inventory,
        [itemId]: progress.inventory[itemId] - 1,
      },
    },
    value,
    recovered: value - current,
  };
}
