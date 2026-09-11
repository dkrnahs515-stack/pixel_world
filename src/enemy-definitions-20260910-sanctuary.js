import { ENEMY_DEFINITIONS as LEGACY_ENEMY_DEFINITIONS } from "./enemy-definitions-20260905-upgrade.js";

function define(value) {
  return Object.freeze({ ...value, hp: value.hp * 4 });
}

const SANCTUARY_ENEMY_DEFINITIONS = Object.freeze({
  "defect-pixel": define({
    name: "결함 픽셀",
    level: 20,
    hp: 24,
    speed: 130,
    damage: 38,
    radius: 16,
    color: "#22d3ee",
    accent: "#ecfeff",
    behavior: "defect-dash",
    contactMode: "ability",
  }),
  "core-sentinel": define({
    name: "코어 감시자",
    level: 22,
    hp: 30,
    speed: 72,
    damage: 42,
    radius: 20,
    color: "#8b5cf6",
    accent: "#ede9fe",
    behavior: "core-bolt",
    contactMode: "ability",
  }),
  "rewrite-echo": define({
    name: "재작성 잔상",
    level: 24,
    hp: 22,
    speed: 118,
    damage: 46,
    radius: 17,
    color: "#f472b6",
    accent: "#fdf2f8",
    behavior: "rewrite-blink",
    contactMode: "ability",
  }),
});

export const ENEMY_DEFINITIONS = Object.freeze({
  ...LEGACY_ENEMY_DEFINITIONS,
  ...SANCTUARY_ENEMY_DEFINITIONS,
});

export function getEnemyDefinition(kind) {
  return Object.hasOwn(ENEMY_DEFINITIONS, kind) ? ENEMY_DEFINITIONS[kind] : null;
}
