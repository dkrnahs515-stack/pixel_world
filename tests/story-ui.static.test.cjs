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

function cssUnescape(value) {
  return value.replace(/\\([\da-f]{1,6})\s?|\\(.)/gi, (_, hex, escaped) => (
    hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : escaped
  ));
}

function normalizedResource(value) {
  let normalized = cssUnescape(value.trim());
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
    } catch {
      break;
    }
  }
  return normalized;
}

function resourceAttributes(markup) {
  const entries = [];
  const tagPattern = /<([a-z][\w:-]*)\b[^>]*>/gi;
  let tagMatch;

  while ((tagMatch = tagPattern.exec(markup))) {
    const [tag, tagName] = tagMatch;
    const attributePattern = /\b(src|srcset|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    let attributeMatch;
    while ((attributeMatch = attributePattern.exec(tag))) {
      entries.push({
        tag,
        tagName: tagName.toLowerCase(),
        name: attributeMatch[1].toLowerCase(),
        value: attributeMatch[2] ?? attributeMatch[3] ?? attributeMatch[4],
      });
    }
  }

  return entries;
}

function cssUrls(styles) {
  const urls = [];
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi;
  let match;
  while ((match = urlPattern.exec(styles))) {
    urls.push(match[1] ?? match[2] ?? match[3]);
  }
  return urls;
}

const lateArtworkName = "02_제01장_지워질 네 이름, 돌아온 신호.png";

function referencesLateArtwork(value) {
  return normalizedResource(value).toLowerCase().includes(lateArtworkName.toLowerCase());
}

function cssEscapeEveryCharacter(value) {
  return [...value].map(character => `\\${character.codePointAt(0).toString(16)} `).join("");
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
  const storyArtTag = html.match(/<img\b[^>]*\bid="storyArt"[^>]*>/i)?.[0];
  assert.ok(storyArtTag, "#storyArt must be an image element");
  assert.match(storyArtTag, /\bwidth\s*=\s*["']1024["']/i);
  assert.match(storyArtTag, /\bheight\s*=\s*["']1536["']/i);
  assert.match(storyArtTag, /\bdecoding\s*=\s*["']async["']/i);
  assert.match(storyArtTag, /\baria-describedby\s*=\s*["']storyArtFallback["']/i);
  assert.doesNotMatch(storyArtTag, /\b(?:src|srcset)\s*=/i, "#storyArt must not request artwork before Task 6 renders a scene");
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

  const figureMarkup = html.match(/<figure\b[\s\S]*?<\/figure>/i)?.[0];
  assert.ok(figureMarkup, "story artwork needs a semantic figure");
  assert.doesNotMatch(figureMarkup, /id="storyArtFallback"|id="storyArtRetryButton"/);
  const figureEnd = html.indexOf("</figure>");
  const fallbackIndex = html.indexOf('id="storyArtFallback"');
  assert.ok(fallbackIndex > figureEnd, "the fallback must be physically outside and after the figure");
  assert.match(html, /<section id="storyArtFallback"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden/);

  const resources = resourceAttributes(html);
  const permittedResourceSet = new Set(["./story.css", "../", "../src/story-controller.js"]);
  for (const resource of resources) {
    const normalized = normalizedResource(resource.value);
    assert.equal(/^(?:data|blob):/i.test(normalized), false, `non-file URL not allowed: ${resource.value}`);
    assert.equal(referencesLateArtwork(resource.value), false, `late artwork must not be referenced: ${resource.value}`);
    assert.equal(permittedResourceSet.has(normalized), true, `unexpected ${resource.name} resource: ${resource.value}`);
  }
  assert.deepEqual(
    new Set(resources.map(resource => normalizedResource(resource.value))),
    permittedResourceSet,
    "the independent shell may reference only its stylesheet, root return link, and controller",
  );
  assert.deepEqual(cssUrls(css), [], "story CSS must not request assets before Task 6 chooses current artwork");

  const scriptTags = [...html.matchAll(/<script\b[^>]*>/gi)];
  assert.equal(scriptTags.length, 1, "the story shell has exactly one script");
  assert.match(scriptTags[0][0], /\btype\s*=\s*["']module["']/i);
  assert.match(scriptTags[0][0], /\bsrc\s*=\s*["']\.\.\/src\/story-controller\.js["']/i);
  assert.equal([...html.matchAll(/<link\b[^>]*\brel\s*=\s*["'][^"']*\bpreload\b[^"']*["'][^>]*>/gi)].length, 0);

  for (const forbiddenLateReference of [
    lateArtworkName,
    encodeURIComponent(lateArtworkName),
    cssEscapeEveryCharacter(lateArtworkName),
    `data:text/plain,${encodeURIComponent(lateArtworkName)}`,
    `./assets/chapter-01/${encodeURIComponent(lateArtworkName)}`,
  ]) {
    assert.equal(referencesLateArtwork(forbiddenLateReference), true, `must detect late-art variant: ${forbiddenLateReference}`);
  }
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
