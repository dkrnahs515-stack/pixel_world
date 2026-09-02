const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const main = fs.readFileSync(path.join(root, "src/main-20260829-coast.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

test("성능 패널은 현재·평균·최저 FPS와 급락 횟수를 실제 DOM 요소로 제공한다", () => {
  assert.match(html, /id="fpsText"/);
  assert.match(html, /id="averageFpsText"/);
  assert.match(html, /id="minFpsText"/);
  assert.match(html, /id="frameDropCount"/);
  assert.match(html, /45 FPS 미만/);

  assert.match(main, /averageFpsText:\s*document\.querySelector\("#averageFpsText"\)/);
  assert.match(main, /minFpsText:\s*document\.querySelector\("#minFpsText"\)/);
  assert.match(main, /frameDropCount:\s*document\.querySelector\("#frameDropCount"\)/);
});

test("확장된 성능 패널은 데스크톱에서 여러 줄로 안전하게 접힐 수 있다", () => {
  assert.match(css, /\.performance-panel\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.performance-stat\s*\{[^}]*white-space:\s*nowrap/);
});
