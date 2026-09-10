import { validatePlayerBossAttack } from "./boss-attack-validation-20260910-sanctuary.js";

export * from "./coop-boss-state-20260903-volcano-20260905-upgrade.js";
export { validatePlayerBossAttack };

export function validateBossAttack(request, validation = {}) {
  return validatePlayerBossAttack(request, validation);
}
