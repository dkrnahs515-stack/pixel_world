import { normalizeClassId } from "./class-data-20260905-upgrade.js";
import { normalizeClassEquipment } from "./equipment-state-20260903-volcano-20260905-upgrade.js";
import { getWeaponsForClass } from "./weapon-data-20260903-volcano-20260905-upgrade.js";
import { drawWeaponPreview } from "./weapon-rendering-20260903-volcano-20260905-upgrade.js";

function weaponStatsLabel(weapon) {
  const common = `피해 ${weapon.damage} · 사거리 ${weapon.range}px`;
  if (weapon.weaponType === "bow") {
    return `${common} · 투사체 ${weapon.projectileSpeed}px/s · 관통 ${weapon.strongCooldown.toFixed(1)}초`;
  }
  if (weapon.weaponType === "staff") {
    return `${common} · 투사체 ${weapon.projectileSpeed}px/s · 폭발 ${weapon.explosionRadius}px · 폭발탄 ${weapon.strongCooldown.toFixed(1)}초`;
  }
  return `${common} · 회전 베기 ${weapon.strongCooldown.toFixed(1)}초`;
}

function buyItem(weapon, level, gold, owned) {
  const isOwned = owned.has(weapon.id);
  const locked = level < weapon.requiredLevel;
  const poor = gold < weapon.price;
  const status = isOwned ? "보유 중" : locked ? `Lv.${weapon.requiredLevel} 필요` : poor ? "Gold 부족" : "구매 가능";
  return {
    weapon,
    owned: isOwned,
    locked,
    poor,
    disabled: isOwned || locked || poor,
    status,
    buttonLabel: status === "구매 가능" ? `${weapon.price} G 구매` : status,
    statsLabel: weaponStatsLabel(weapon),
  };
}

export function equipmentUiModel({ classId, level, gold, equipment }) {
  const normalizedClassId = normalizeClassId(classId);
  const normalizedEquipment = normalizeClassEquipment(normalizedClassId, equipment);
  const weapons = getWeaponsForClass(normalizedClassId);
  const owned = new Set(normalizedEquipment.ownedWeaponIds);
  const tradeWeapons = weapons.filter(weapon => !weapon.rewardOnly && weapon.price !== null);
  return {
    classId: normalizedClassId,
    equippedWeaponId: normalizedEquipment.equippedWeaponId,
    buyItems: tradeWeapons.map(weapon => buyItem(weapon, level, gold, owned)),
    sellItems: tradeWeapons.filter(weapon => owned.has(weapon.id)).map(weapon => ({
      weapon,
      equipped: normalizedEquipment.equippedWeaponId === weapon.id,
      status: normalizedEquipment.equippedWeaponId === weapon.id ? "장착 중" : "보유 중",
      buttonLabel: `${weapon.sellPrice} G 판매`,
      statsLabel: weaponStatsLabel(weapon),
    })),
    inventoryItems: weapons.filter(weapon => owned.has(weapon.id)).map(weapon => {
      const equipped = normalizedEquipment.equippedWeaponId === weapon.id;
      return {
        weapon,
        equipped,
        disabled: equipped,
        buttonLabel: equipped ? "장착 중" : "장착",
        statsLabel: weaponStatsLabel(weapon),
      };
    }),
  };
}

function element(documentRef, tagName, { className, text, dataset } = {}) {
  const node = documentRef.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(dataset || {})) node.dataset[key] = value;
  return node;
}

const masterworkClass = weapon => weapon.tier >= 6 ? " masterwork" : "";

function renderBuyItem(documentRef, item) {
  const card = element(documentRef, "article", {
    className: `blacksmith-item buy-weapon${masterworkClass(item.weapon)}`,
    dataset: { buyWeaponCard: item.weapon.id },
  });
  card.classList.toggle("locked", item.locked);
  card.classList.toggle("owned", item.owned);
  const preview = element(documentRef, "canvas", {
    className: "weapon-preview",
    dataset: { weaponPreview: item.weapon.id },
  });
  preview.width = 54;
  preview.height = 32;
  preview.setAttribute("aria-label", `${item.weapon.name} 외형 미리보기`);
  const copy = element(documentRef, "div");
  copy.append(
    element(documentRef, "strong", { text: item.weapon.name }),
    element(documentRef, "small", { text: `Lv.${item.weapon.requiredLevel} · ${item.weapon.price} G` }),
    element(documentRef, "p", { text: item.statsLabel }),
    element(documentRef, "b", { text: item.status, dataset: { buyWeaponStatus: item.weapon.id } }),
  );
  const button = element(documentRef, "button", { text: item.buttonLabel, dataset: { buyWeapon: item.weapon.id } });
  button.type = "button";
  button.disabled = item.disabled;
  card.append(preview, copy, button);
  drawWeaponPreview(preview, item.weapon.id);
  return card;
}

function renderSellItem(documentRef, item) {
  const card = element(documentRef, "article", {
    className: `blacksmith-item${masterworkClass(item.weapon)}`,
    dataset: { sellWeaponCard: item.weapon.id },
  });
  const copy = element(documentRef, "div");
  copy.append(
    element(documentRef, "strong", { text: item.weapon.name }),
    element(documentRef, "small", { text: `판매가 ${item.weapon.sellPrice} G` }),
    element(documentRef, "b", { text: item.status, dataset: { sellWeaponStatus: item.weapon.id } }),
  );
  const button = element(documentRef, "button", { text: item.buttonLabel, dataset: { sellWeapon: item.weapon.id } });
  button.type = "button";
  card.append(copy, button);
  return card;
}

function renderInventoryItem(documentRef, item) {
  const card = element(documentRef, "article", {
    className: `inventory-equipment-item${masterworkClass(item.weapon)}`,
    dataset: { inventoryWeapon: item.weapon.id },
  });
  const copy = element(documentRef, "div");
  copy.append(
    element(documentRef, "strong", { text: item.weapon.name }),
    element(documentRef, "small", { text: `Lv.${item.weapon.requiredLevel} · ${item.statsLabel}` }),
  );
  const button = element(documentRef, "button", { text: item.buttonLabel, dataset: { equipWeapon: item.weapon.id } });
  button.type = "button";
  button.disabled = item.disabled;
  card.append(copy, button);
  return card;
}

function replaceWithItems(container, items, renderItem) {
  if (!container) return [];
  const documentRef = container.ownerDocument || globalThis.document;
  const fragment = documentRef.createDocumentFragment();
  const nodes = items.map(item => renderItem(documentRef, item));
  fragment.append(...nodes);
  container.replaceChildren(fragment);
  return nodes;
}

export function renderBlacksmithEquipment(elements, model) {
  replaceWithItems(elements.blacksmithBuyItems, model.buyItems, renderBuyItem);
  replaceWithItems(elements.blacksmithSellItems, model.sellItems, renderSellItem);
  if (elements.blacksmithEmptySaleText) elements.blacksmithEmptySaleText.hidden = model.sellItems.length > 0;
  return model;
}

export function renderInventoryEquipment(elements, model) {
  replaceWithItems(elements.inventoryWeaponItems, model.inventoryItems, renderInventoryItem);
  return model;
}
