export const SANCTUARY_TITLE_IDS = Object.freeze([
  "sanctuary-title-seal",
  "sanctuary-title-restore",
  "sanctuary-title-release",
]);

export const SANCTUARY_REWARD_COMPONENT_IDS = Object.freeze(
  ["seal", "restore", "release"].flatMap(choice => [
    `sanctuary-ending-${choice}-exp`,
    `sanctuary-ending-${choice}-gold`,
    `sanctuary-ending-${choice}-title`,
  ]),
);
