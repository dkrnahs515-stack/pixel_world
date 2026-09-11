const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");

test("index exposes accessible sanctuary ending choice and credits surfaces", () => {
  assert.match(html, /id="sanctuaryEndingOverlay"/);
  assert.match(html, /role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /id="endingRestoreButton"/);
  assert.match(html, /id="endingSealButton"/);
  assert.match(html, /id="endingResonateButton"/);
  assert.match(html, /id="endingLockedReason"[^>]*aria-live="polite"/);
  assert.match(html, /id="endingDeferButton"[^>]*>결정 보류</);
  assert.match(html, /id="endingSubtitle"[^>]*aria-live="polite"/);
  assert.match(html, /id="endingCredits"/);
  assert.match(html, /id="endingCreditsSkip"/);
});
