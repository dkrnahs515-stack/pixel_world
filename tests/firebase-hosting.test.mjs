import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const firebase = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));

test("Firebase의 고정 URL JavaScript와 CSS는 새 배포마다 재검증한다", () => {
  const assetRule = firebase.hosting.headers.find(rule => rule.source.includes("js|css"));
  const cacheControl = assetRule?.headers.find(header => header.key.toLowerCase() === "cache-control")?.value;

  assert.match(cacheControl ?? "", /(?:^|,\s*)no-cache(?:,|$)/);
  assert.doesNotMatch(cacheControl ?? "", /max-age=[1-9]\d*/);
});
