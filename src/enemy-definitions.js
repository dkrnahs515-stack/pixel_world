const define = value => Object.freeze(value);

export const ENEMY_DEFINITIONS = Object.freeze({
  "fire-slime": define({
    name: "화염 슬라임", hp: 4, speed: 92, damage: 12, radius: 18,
    color: "#ef5a32", accent: "#ffb23f", behavior: "legacy-contact", contactMode: "contact", contactCooldown: 1,
  }),
  "forest-slime": define({
    name: "숲 슬라임", hp: 4, speed: 88, damage: 10, radius: 18,
    color: "#4fb867", accent: "#91d66f", behavior: "legacy-contact", contactMode: "contact", contactCooldown: 1,
  }),
  boar: define({
    name: "멧돼지", hp: 6, speed: 112, damage: 15, radius: 20,
    color: "#8b5a3c", accent: "#d2a36f", behavior: "legacy-contact", contactMode: "contact", contactCooldown: 1,
  }),
  crab: define({
    name: "해안 게", hp: 5, speed: 76, damage: 12, radius: 20,
    color: "#ef6b57", accent: "#ffc3a7", behavior: "legacy-contact", contactMode: "contact", contactCooldown: 1,
  }),
  "water-slime": define({
    name: "물방울 슬라임", hp: 4, speed: 84, damage: 10, radius: 18,
    color: "#48a9d8", accent: "#9be5f2", behavior: "legacy-contact", contactMode: "contact", contactCooldown: 1,
  }),
  "fang-shark": define({ name: "송곳니 상어", hp: 25, speed: 100, damage: 50, radius: 20, color: "#159a9c", accent: "#f4f7ed", behavior: "fang-charge", contactMode: "ability" }),
  "pirate-shark": define({ name: "해적선 상어", hp: 35, speed: 106, damage: 55, radius: 21, color: "#11787c", accent: "#7650a8", behavior: "pirate-bite", contactMode: "ability" }),
  "magma-slime": define({ name: "마그마 슬라임", hp: 10, speed: 78, damage: 20, radius: 18, color: "#1b1719", accent: "#f05a24", behavior: "magma-split", contactMode: "contact", contactCooldown: 1 }),
  "magma-slime-small": define({ name: "작은 마그마 슬라임", hp: 3, speed: 95, damage: 20, radius: 12, color: "#1b1719", accent: "#ffc857", behavior: "legacy-contact", contactMode: "contact", contactCooldown: 1, generation: 1 }),
  "flame-imp": define({ name: "불꽃 도깨비", hp: 40, speed: 148, damage: 60, radius: 16, color: "#a91f2c", accent: "#ffc857", behavior: "flame-teleport", contactMode: "contact", contactCooldown: 1.2 }),
  "ancient-boar": define({ name: "고대 멧돼지", hp: 55, speed: 105, damage: 45, radius: 23, color: "#704b32", accent: "#b58a4a", behavior: "burrow-charge", contactMode: "ability" }),
  "moss-troll": define({ name: "이끼 트롤", hp: 100, speed: 58, damage: 50, radius: 28, color: "#704b32", accent: "#6f8f3d", behavior: "camouflage-regeneration", contactMode: "contact", contactCooldown: 1.2 }),
  "ancient-mushroom-bug": define({ name: "고대 버섯충", hp: 45, speed: 82, damage: 35, radius: 18, color: "#234f32", accent: "#76508f", behavior: "spore-slow", contactMode: "contact", contactCooldown: 1 }),
});

export function getEnemyDefinition(kind) {
  return Object.hasOwn(ENEMY_DEFINITIONS, kind) ? ENEMY_DEFINITIONS[kind] : null;
}
