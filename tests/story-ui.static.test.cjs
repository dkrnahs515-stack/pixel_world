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

function decodeNumericHtmlCharacterReferences(value) {
  return value.replace(/&#(?:(x[\da-f]+)|(\d+));?/gi, (match, hexadecimal, decimal) => {
    const codePoint = Number.parseInt(hexadecimal ? hexadecimal.slice(1) : decimal, hexadecimal ? 16 : 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : match;
  });
}

function decodeUriComponents(value) {
  return value.replace(/(?:%[\da-f]{2})+/gi, encoded => {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  });
}

function normalizedDocument(value) {
  let normalized = String(value);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const decoded = decodeUriComponents(cssUnescape(decodeNumericHtmlCharacterReferences(normalized)));
    if (decoded === normalized) break;
    normalized = decoded;
  }
  return normalized;
}

function normalizedResource(value) {
  return normalizedDocument(value.trim());
}

function tagAttributes(tag) {
  const entries = [];
  const attributePattern = /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let attributeMatch;

  while ((attributeMatch = attributePattern.exec(tag))) {
    entries.push({
      name: attributeMatch[1].toLowerCase(),
      value: attributeMatch[2] ?? attributeMatch[3] ?? attributeMatch[4] ?? "",
    });
  }

  return entries;
}

function resourceAttributes(markup) {
  const entries = [];
  const tagPattern = /<([a-z][\w:-]*)\b[^>]*>/gi;
  let tagMatch;

  while ((tagMatch = tagPattern.exec(markup))) {
    const [tag, tagName] = tagMatch;
    for (const attribute of tagAttributes(tag)) {
      if (!["src", "srcset", "href", "poster"].includes(attribute.name)) continue;
      entries.push({
        tag,
        tagName: tagName.toLowerCase(),
        name: attribute.name,
        value: attribute.value,
      });
    }
  }

  return entries;
}

function wholeDocumentResourceAssignments(markup) {
  const entries = [];
  const assignmentPattern = /(?<![\w-])(srcset|imagesrcset|poster|src|href|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  let assignmentMatch;

  while ((assignmentMatch = assignmentPattern.exec(markup))) {
    entries.push({
      name: assignmentMatch[1].toLowerCase(),
      value: normalizedResource(assignmentMatch[2] ?? assignmentMatch[3] ?? assignmentMatch[4]),
    });
  }

  return entries;
}

const permittedInitialResourceAssignments = [
  { name: "href", value: "./story.css" },
  { name: "href", value: "../" },
  { name: "href", value: "../" },
  { name: "href", value: "../" },
  { name: "src", value: "../src/story-controller.js" },
];

function hasExactInitialResourceAllowlist(markup) {
  const actual = wholeDocumentResourceAssignments(markup);
  return actual.length === permittedInitialResourceAssignments.length
    && actual.every((assignment, index) => (
      assignment.name === permittedInitialResourceAssignments[index].name
      && assignment.value === permittedInitialResourceAssignments[index].value
    ));
}

function linkRelTokens(tag) {
  return tagAttributes(tag)
    .filter(attribute => attribute.name === "rel")
    .flatMap(attribute => normalizedResource(attribute.value).toLowerCase().split(/\s+/))
    .filter(Boolean);
}

function cssUrls(styles) {
  const urls = [];
  const normalizedStyles = normalizedDocument(styles);
  const addUrl = value => urls.push(normalizedResource(value));
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi;
  let match;
  while ((match = urlPattern.exec(normalizedStyles))) {
    addUrl(match[1] ?? match[2] ?? match[3]);
  }

  const importStringPattern = /@import\s+(?:"([^"]*)"|'([^']*)')/gi;
  while ((match = importStringPattern.exec(normalizedStyles))) {
    addUrl(match[1] ?? match[2]);
  }

  const imageSetPattern = /image-set\s*\(([\s\S]*?)\)/gi;
  while ((match = imageSetPattern.exec(normalizedStyles))) {
    const quotedResourcePattern = /"([^"]*)"|'([^']*)'/g;
    let quotedMatch;
    while ((quotedMatch = quotedResourcePattern.exec(match[1]))) {
      addUrl(quotedMatch[1] ?? quotedMatch[2]);
    }
  }
  return urls;
}

function cssForbiddenSyntax(styles) {
  const normalizedStyles = normalizedDocument(styles);
  return {
    hasImport: /@import\b/i.test(normalizedStyles),
    hasImageSet: /\bimage-set\s*\(/i.test(normalizedStyles),
  };
}

const lateArtworkName = "02_제01장_지워질 네 이름, 돌아온 신호.png";
const lateArtworkStem = lateArtworkName.replace(/\.png$/i, "");
const lateArtworkPath = `assets/chapter-01/${lateArtworkName}`;

function referencesLateArtwork(value) {
  const normalizedValue = normalizedDocument(value).toLowerCase();
  return [lateArtworkName, lateArtworkStem, lateArtworkPath]
    .map(marker => normalizedDocument(marker).toLowerCase())
    .some(marker => normalizedValue.includes(marker));
}

function hasPreloadToken(value) {
  return /\b(?:preload|modulepreload)\b/i.test(normalizedDocument(value));
}

function hasUnsafeResourceScheme(value) {
  return /\b(?:data|blob):/i.test(normalizedDocument(value));
}

function hasInlineStylePath(markup) {
  const normalizedMarkup = normalizedDocument(markup);
  return /\bstyle\s*=/i.test(normalizedMarkup) || /<\s*style\b/i.test(normalizedMarkup);
}

function hasMetaRefresh(markup) {
  return /\bhttp-equiv\s*=\s*(?:"\s*refresh\s*"|'\s*refresh\s*'|refresh\b)/i.test(normalizedDocument(markup));
}

function cssEscapeEveryCharacter(value) {
  return [...value].map(character => `\\${character.codePointAt(0).toString(16)} `).join("");
}

test("리소스 스캐너는 우회형 CSS와 인용 없는 preload 관계를 정규화해 감지한다", () => {
  assert.deepEqual(
    cssUrls(`@import "${encodeURIComponent(lateArtworkName)}";`),
    [lateArtworkName],
    "string-form @import must expose its normalized resource",
  );
  assert.deepEqual(
    cssUrls(`.art { background-image: image-set("${cssEscapeEveryCharacter(lateArtworkName)}" 1x); }`),
    [lateArtworkName],
    "string-form image-set must expose its CSS-escaped resource",
  );
  assert.deepEqual(
    cssForbiddenSyntax(`@\\69 mport "safe.css"; .art { image-set("safe.png" 1x); }`),
    { hasImport: true, hasImageSet: true },
    "normalized CSS syntax must flag import and image-set even before resource allowlisting",
  );

  for (const { markup, relation } of [
    { markup: "<link HREF=../src/story-controller.js REL=preload>", relation: "preload" },
    { markup: '<link rel="modulepreload" href="../src/story-controller.js">', relation: "modulepreload" },
  ]) {
    const attributes = tagAttributes(markup);
    assert.equal(
      attributes.some(attribute => attribute.name === "rel" && normalizedResource(attribute.value).toLowerCase() === relation),
      true,
      `${relation} relation must be detected regardless attribute order, quote form, or case`,
    );
    assert.deepEqual(
      linkRelTokens(markup),
      [relation],
      `${relation} must be tokenized independently from its attribute quoting or order`,
    );
  }
});

test("문서 전체 스캔은 인용된 태그 경계와 엔터티 우회를 넘어서 리소스를 찾는다", () => {
  for (const hiddenDataUrl of [
    '<img data-note=">" src="data:image/png;base64,AA==">',
    '<source data-note=">" src="data:image/png;base64,AA==">',
  ]) {
    assert.deepEqual(
      wholeDocumentResourceAssignments(hiddenDataUrl),
      [{ name: "src", value: "data:image/png;base64,AA==" }],
      "a quoted > before src must not hide a data URL from resource scanning",
    );
    assert.equal(hasUnsafeResourceScheme(hiddenDataUrl), true, "a data URL after quoted > must be rejected");
  }
  const entityPreload = '<link rel="modulepre&#108;oad" href="../src/story-controller.js">';
  assert.deepEqual(
    linkRelTokens(entityPreload),
    ["modulepreload"],
    "numeric HTML character references must not hide preload tokens",
  );
  assert.equal(hasPreloadToken(entityPreload), true, "whole-document preload detection must decode numeric references");
});

test("초기 로드 계약은 모든 브라우저 리소스 속성과 인라인 경로를 거부한다", () => {
  const benignLookingResources = [
    '<img data-note=">" srcset="https://example.test/hero.png 1x" imagesrcset="../hero.png 1x">',
    '<video data-note=">" poster="/poster.png"></video>',
    '<object data="../guide.html"></object>',
  ].join("");
  assert.deepEqual(
    wholeDocumentResourceAssignments(benignLookingResources),
    [
      { name: "srcset", value: "https://example.test/hero.png 1x" },
      { name: "imagesrcset", value: "../hero.png 1x" },
      { name: "poster", value: "/poster.png" },
      { name: "data", value: "../guide.html" },
    ],
    "quoted > must not hide non-src initial-load attributes or benign-looking URLs",
  );
  assert.equal(hasExactInitialResourceAllowlist(benignLookingResources), false, "only the shell's exact resource list is allowed");
  assert.deepEqual(
    wholeDocumentResourceAssignments('<div data-story-next="duty" data-note="safe" data-srcset="safe.png" data-href="../safe"></div>'),
    [],
    "data-* hooks must not be treated as initial-load resources",
  );

  const inlinePaths = '<div style="background: url(safe.png)"></div><style>.x { color: teal; }</style><meta http-equiv="refresh" content="0;url=/safe">';
  assert.equal(hasInlineStylePath(inlinePaths), true, "inline style attributes and blocks are forbidden initial-load paths");
  assert.equal(hasMetaRefresh(inlinePaths), true, "http-equiv refresh is forbidden even for local URLs");
});

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

  assert.deepEqual(
    wholeDocumentResourceAssignments(html),
    permittedInitialResourceAssignments,
    "the independent shell has exactly one controller src, one stylesheet href, and three root-back href values",
  );
  assert.equal(hasExactInitialResourceAllowlist(html), true, "only the exact initial stylesheet and controller resources are allowed");
  assert.deepEqual(cssUrls(css), [], "story CSS must not request assets before Task 6 chooses current artwork");
  assert.deepEqual(
    cssForbiddenSyntax(css),
    { hasImport: false, hasImageSet: false },
    "the static shell rejects CSS import and image-set disclosure paths even when their resources are otherwise allowlisted",
  );
  assert.equal(hasPreloadToken(html), false, "preload and modulepreload tokens are forbidden anywhere in decoded HTML");
  assert.equal(hasUnsafeResourceScheme(`${html}\n${css}`), false, "data and blob resource schemes are forbidden anywhere in decoded shell files");
  assert.equal(referencesLateArtwork(`${html}\n${css}`), false, "the normalized late-art filename, stem, and path are forbidden anywhere in shell files");
  assert.equal(hasInlineStylePath(html), false, "story HTML must not contain inline style attributes or style blocks");
  assert.equal(hasMetaRefresh(html), false, "story HTML must not contain an http-equiv refresh");

  const scriptTags = [...html.matchAll(/<script\b[^>]*>/gi)];
  assert.equal(scriptTags.length, 1, "the story shell has exactly one script");
  assert.match(scriptTags[0][0], /\btype\s*=\s*["']module["']/i);
  assert.match(scriptTags[0][0], /\bsrc\s*=\s*["']\.\.\/src\/story-controller\.js["']/i);

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
