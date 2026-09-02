import test from "node:test";
import assert from "node:assert/strict";
import {
  findActivePortal,
  getBiome,
  isWorldPositionBlocked,
} from "../src/world-20260829-coast.js";

test("region boundaries and representative landmarks block movement", () => {
  assert.equal(isWorldPositionBlocked("village", -1, 100, 14), true);
  assert.equal(isWorldPositionBlocked("village", 1440, 1110, 14), false);
  assert.equal(isWorldPositionBlocked("volcano", 200, 1800, 14), true);
  assert.equal(isWorldPositionBlocked("forest", 2160, 800, 14), true);
  assert.equal(isWorldPositionBlocked("coast-beach", 1080, 1500, 14), true);
  assert.equal(isWorldPositionBlocked("coast-wreck-bay", 1080, 820, 14), true);
  assert.equal(isWorldPositionBlocked("coast-flooded-station", 1080, 900, 14), true);
  assert.equal(isWorldPositionBlocked("coast-tide-core-cave", 1080, 900, 14), true);
});

test("portal lookup reports only overlapping portals", () => {
  assert.equal(findActivePortal("village", 618, 458, 14)?.id, "to-forest");
  assert.equal(findActivePortal("village", 1440, 1110, 14), null);
  assert.equal(findActivePortal("coast-beach", 1032, 148, 14)?.id, "to-village");
  assert.equal(findActivePortal("coast-beach", 2012, 852, 14)?.id, "to-wreck-bay");
  assert.equal(findActivePortal("coast-wreck-bay", 148, 852, 14)?.id, "to-beach");
});

test("the active region name is exposed for the HUD", () => {
  assert.equal(getBiome("village"), "중앙 마을");
  assert.equal(getBiome("volcano"), "끓어오르는 활화산");
  assert.equal(getBiome("forest"), "태고의 숲");
  assert.equal(getBiome("coast"), "푸른 해변");
  assert.equal(getBiome("coast-wreck-bay"), "난파선 만");
  assert.equal(getBiome("coast-flooded-station"), "침수된 통신소");
  assert.equal(getBiome("coast-tide-core-cave"), "조수 코어 동굴");
});
