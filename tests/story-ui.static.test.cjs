const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const path = require("node:path");

const root = path.join(__dirname, "..");
const storyHtmlPath = path.join(root, "story", "index.html");
const storyCssPath = path.join(root, "story", "story.css");
const theoPath = path.join(
  root,
  "story",
  "assets",
  "chapter-01",
  "01_제01장_고대 숲의 초보 궁수 테오.png",
);
const returnedSignalPath = path.join(
  root,
  "story",
  "assets",
  "chapter-01",
  "02_제01장_지워질 네 이름, 돌아온 신호.png",
);

function pngInfo(filePath) {
  const bytes = readFileSync(filePath);
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

test("제1장 스토리 셸은 독립된 조사 화면의 시맨틱 훅을 제공한다", () => {
  assert.equal(existsSync(storyHtmlPath), true, "story/index.html must exist");
  assert.equal(existsSync(storyCssPath), true, "story/story.css must exist");

  const html = readFileSync(storyHtmlPath, "utf8");
  const css = readFileSync(storyCssPath, "utf8");

  for (const id of [
    "storyStartOverlay",
    "storyNewButton",
    "storyContinueButton",
    "storyResetOverlay",
    "storyResetConfirmButton",
    "storyResetCancelButton",
    "storyScreen",
    "storySceneTitle",
    "storyArt",
    "storyArtFallback",
    "storyArtRetryButton",
    "storyDocument",
    "storyActions",
    "storyClues",
    "storyStatus",
    "storyCompletion",
    "storyReplayButton",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }

  assert.match(html, /id="storyContinueButton"[^>]*disabled/);
  assert.match(html, /id="storyResetOverlay"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*hidden/);
  assert.match(html, /<main id="storyScreen"[^>]*hidden/);
  assert.match(html, /<section id="storyCompletion"[^>]*hidden/);
  assert.match(html, /<script type="module" src="\.\.\/src\/story-controller\.js"><\/script>/);
  assert.match(html, /<a[^>]*href="\.\.\/"[^>]*>[^<]*첫 화면으로/);
  assert.match(html, /<figure[^>]*class="story-figure"/);
  assert.match(html, /<figcaption[^>]*>/);
  assert.match(html, /<article id="storyDocument"/);
  assert.match(html, /<section id="storyActions"[^>]*aria-label=/);
  assert.match(html, /<h3[^>]*>발견한 단서<\/h3>/);
  assert.match(html, /id="storyClues"/);
  assert.match(html, /id="storyStatus"[^>]*aria-live="polite"/);
  assert.match(html, /id="storySceneTitle"[^>]*tabindex="-1"/);
  assert.match(html, /id="storyArt"[^>]*width="1024"[^>]*height="1536"[^>]*decoding="async"/);
  assert.doesNotMatch(html, /id="storyArt"[^>]*\ssrc=/);
  assert.doesNotMatch(html, /firebase|game-2026|network-/i);

  for (const controlId of [
    "storyNewButton",
    "storyContinueButton",
    "storyResetConfirmButton",
    "storyResetCancelButton",
    "storyArtRetryButton",
    "storyReplayButton",
  ]) {
    assert.match(html, new RegExp(`<button[^>]*id="${controlId}"`));
  }

  assert.doesNotMatch(
    `${html}\n${css}`,
    /02_제01장_지워질 네 이름, 돌아온 신호\.png/,
    "the late-reveal artwork must not be requested or referenced by the initial shell",
  );
  assert.match(css, /:root\s*\{[\s\S]*--story-ink:/);
  assert.match(css, /\.story-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.35fr\)\s+minmax\(320px,\s*\.65fr\)/);
  assert.match(css, /\.story-art\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*contain/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /button[^}]*min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.story-layout\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /env\(safe-area-inset-/);
  assert.match(css, /\[aria-pressed="true"\][^}]*border/);
});

test("제1장 공식 삽화는 원본 바이트와 PNG 크기를 보존한다", () => {
  assert.equal(existsSync(theoPath), true, "opening Theo artwork must exist");
  assert.equal(existsSync(returnedSignalPath), true, "late-reveal artwork must exist");
  assert.deepEqual(pngInfo(theoPath), {
    width: 1024,
    height: 1536,
    sha256: "f2bceb0fedf479f445989d2b89db2d8ee9382300d8e76fd164f0ed69cd21063b",
  });
  assert.deepEqual(pngInfo(returnedSignalPath), {
    width: 1536,
    height: 1024,
    sha256: "6aa870833ac6e440743d2be4c5b5c61b64f521c3a4f852b2606a5925f5e3a896",
  });
});
