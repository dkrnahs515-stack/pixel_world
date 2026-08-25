const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main.js"), "utf8");
const css = readFileSync(path.join(__dirname, "../styles.css"), "utf8");

test("QA 도구는 기본 문서에서 숨겨진 버튼과 모달로 제공된다", () => {
  assert.match(html, /id="qaButton"[^>]*hidden/);
  assert.match(html, /id="qaOverlay"[^>]*hidden/);
  assert.match(html, /aria-labelledby="qaTitle"/);
  assert.match(html, /data-qa-world="village"/);
  assert.match(html, /data-qa-world="coast"/);
  assert.match(html, /data-qa-world="volcano"/);
  assert.match(html, /data-qa-world="forest"/);
  assert.equal((html.match(/data-qa-monster=/g) || []).length, 7);
});

test("main은 qa=1 판정 결과만으로 QA 도구를 활성화한다", () => {
  assert.match(main, /const qaEnabled\s*=\s*isQaMode\(location\.search\)/);
  assert.match(main, /qaEnabled,/);
  assert.match(main, /qaButton\.hidden\s*=\s*!qaEnabled/);
  assert.match(main, /qaOpen:\s*game\.isQaOpen\(\)/);
  assert.match(main, /close-qa[\s\S]*game\.closeQaPanel\(\)/);
});

test("QA 모달은 인벤토리보다 앞에 표시되고 모바일에서 한 열로 접힌다", () => {
  assert.match(css, /\.qa-overlay \{[^}]*z-index:\s*38/);
  assert.match(css, /\.qa-monster-grid \{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.qa-monster-grid \{[^}]*grid-template-columns:\s*1fr/);
});
