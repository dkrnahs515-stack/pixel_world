import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const firebase = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Firebase의 고정 URL JavaScript와 CSS는 새 배포마다 재검증한다", () => {
  const assetRule = firebase.hosting.headers.find(rule => rule.source.includes("js|css"));
  const cacheControl = assetRule?.headers.find(header => header.key.toLowerCase() === "cache-control")?.value;

  assert.match(cacheControl ?? "", /(?:^|,\s*)no-cache(?:,|$)/);
  assert.doesNotMatch(cacheControl ?? "", /max-age=[1-9]\d*/);
});

test("진입 HTML은 CSS와 JavaScript의 실제 파일명으로 기존 배포 캐시를 우회한다", () => {
  const stylesheetVersion = index.match(/href="\.\/styles\.css\?v=([^"]+)"/)?.[1];
  const modulePath = index.match(/src="(\.\/src\/main-([^"]+?)\.js)"/)?.[1];
  const moduleVersion = index.match(/src="\.\/src\/main-([^"]+?)\.js"/)?.[1];

  assert.ok(stylesheetVersion);
  assert.equal(moduleVersion, stylesheetVersion);
  assert.ok(modulePath);
  assert.ok(existsSync(new URL(`..\/${modulePath}`, import.meta.url)));

  const entry = readFileSync(new URL(`..\/${modulePath}`, import.meta.url), "utf8");
  const gameModulePath = entry.match(/from "(\.\/game-([^"]+?)\.js)"/)?.[1];
  const gameModuleVersion = entry.match(/from "\.\/game-([^"]+?)\.js"/)?.[1];

  assert.equal(gameModuleVersion, stylesheetVersion);
  assert.ok(gameModulePath);
  assert.ok(existsSync(new URL(`..\/src\/${gameModulePath}`, import.meta.url)));
});
