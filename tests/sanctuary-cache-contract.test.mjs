import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getVolcanoChapterObjective } from "../src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { getSanctuaryChapterObjective } from "../src/sanctuary-story-data-20260911-sanctuary.js";
import { createChorusEncounter } from "../src/sanctuary-chorus-state-20260911-sanctuary.js";
import { TESTIMONY_IDS as CHORUS_TESTIMONY_IDS } from "../src/sanctuary-chorus-data-20260911-sanctuary.js";
import { PixelRPG } from "../src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";

const CORE_IDS = ["forest-core-casket", "coast-core-casket", "volcano-core-casket"];
const SOUND_IDS = ["departure-bell", "dawn-bird", "tide-bell", "mine-shift-bell"];
const TRUTH_IDS = ["truth-resonance-time", "truth-first-archivist-log", "truth-core-self-division"];
const FALSE_RETURN_IDS = ["false-return-garen-unscarred", "false-return-source-erased", "false-return-resonance-time"];
const FIELD_IDS = ["vanguard-return-state", "core-division-cause", "delay-roan", "delay-sera", "delay-garen", "delay-lumen"];
const OPINION_IDS = ["roan", "sera", "garen", "lumen", "echo"];

function sanctuaryProgress(overrides = {}) {
  return {
    unlockedMapIds: ["volcano", "sanctuary"],
    completedRegionIds: ["volcano"],
    chapters: {
      volcano: { coreFragmentObtained: true },
      sanctuary: {
        activatedCoreIds: [], collectedMemoryIds: [], memoryOrderSolved: false,
        coreTruthRevealed: false, falseReturnRejected: false, completedRecordFieldIds: [],
        correctionLinked: false, chorusSeparated: false, collectedTestimonyIds: [],
        previewedFutureIds: [], endingChoice: null, ...overrides,
      },
    },
  };
}

function assertObjective(progress, expected, chorus = null) {
  assert.deepEqual(getSanctuaryChapterObjective(progress, chorus), expected);
}

test("sanctuary objective advances through the approved gates", () => {
  assertObjective(sanctuaryProgress(), {
    id: "activate-three-cores", mapId: "sanctuary", interactionIds: CORE_IDS,
    label: "세 코어 조각을 성역 석관에 안치한다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS }), {
    id: "collect-four-sounds", mapId: "sanctuary-memory-archive", interactionIds: SOUND_IDS,
    label: "기억 회랑의 네 소리를 수집한다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: SOUND_IDS }), {
    id: "restore-memory-order", mapId: "sanctuary-memory-archive", interactionIds: ["memory-sequence-console"],
    label: "네 소리를 기억의 순서대로 배열한다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: SOUND_IDS, memoryOrderSolved: true }), {
    id: "restore-three-originals", mapId: "sanctuary-memory-archive", interactionIds: TRUTH_IDS,
    label: "세 보존 원본을 대조해 코어의 진실을 복원한다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: [...SOUND_IDS, ...FALSE_RETURN_IDS], memoryOrderSolved: true, coreTruthRevealed: true }), {
    id: "reject-false-return", mapId: "sanctuary-memory-archive", interactionIds: FALSE_RETURN_IDS,
    label: "거짓 귀환 환영의 세 모순을 확인한다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: [...SOUND_IDS, ...FALSE_RETURN_IDS], memoryOrderSolved: true, coreTruthRevealed: true, falseReturnRejected: true }), {
    id: "complete-six-fields", mapId: "sanctuary-return-record", interactionIds: FIELD_IDS,
    label: "여섯 책임 기록을 보존 근거로 검증한다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: [...SOUND_IDS, ...FALSE_RETURN_IDS], memoryOrderSolved: true, coreTruthRevealed: true, falseReturnRejected: true, completedRecordFieldIds: FIELD_IDS }), {
    id: "link-correction", mapId: "sanctuary-return-record", interactionIds: ["correction-link-console"],
    label: "원본을 보존한 채 마지막 귀환 기록의 정정 링크를 만든다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: [...SOUND_IDS, ...FALSE_RETURN_IDS], memoryOrderSolved: true, coreTruthRevealed: true, falseReturnRejected: true, completedRecordFieldIds: FIELD_IDS, correctionLinked: true, chorusSeparated: true }), {
    id: "collect-five-opinions", mapId: "sanctuary-three-futures", interactionIds: OPINION_IDS.map(id => `future-testimony-${id}`),
    label: "로안·세라·가렌·루멘·에코의 의견을 모두 듣는다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: [...SOUND_IDS, ...FALSE_RETURN_IDS], memoryOrderSolved: true, coreTruthRevealed: true, falseReturnRejected: true, completedRecordFieldIds: FIELD_IDS, correctionLinked: true, chorusSeparated: true, collectedTestimonyIds: OPINION_IDS }), {
    id: "preview-three-futures", mapId: "sanctuary-three-futures", interactionIds: ["future-preview-seal", "future-preview-restore", "future-preview-release"],
    label: "봉인·복원·해방의 미래를 모두 확인한다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: [...SOUND_IDS, ...FALSE_RETURN_IDS], memoryOrderSolved: true, coreTruthRevealed: true, falseReturnRejected: true, completedRecordFieldIds: FIELD_IDS, correctionLinked: true, chorusSeparated: true, collectedTestimonyIds: OPINION_IDS, previewedFutureIds: ["seal", "restore", "release"] }), {
    id: "choose-future", mapId: "sanctuary-three-futures", interactionIds: ["sanctuary-ending-console"],
    label: "남겨진 기억의 운명을 정한다.",
  });
});

test("volcano completion delegates to the sanctuary entrance objective", () => {
  assert.deepEqual(getVolcanoChapterObjective(sanctuaryProgress()), getSanctuaryChapterObjective(sanctuaryProgress()));
});

function chorusSnapshot(overrides = {}) {
  return {
    ...createChorusEncounter({ encounterId: "chorus-review-1", authorityUid: "reviewer", now: 1 }),
    ...overrides,
  };
}

function correctionReady() {
  return sanctuaryProgress({
    activatedCoreIds: CORE_IDS, collectedMemoryIds: [...SOUND_IDS, ...FALSE_RETURN_IDS],
    memoryOrderSolved: true, coreTruthRevealed: true, falseReturnRejected: true,
    completedRecordFieldIds: FIELD_IDS, correctionLinked: true,
  });
}

test("shared chorus phase guides anchors, testimonies, and onslaught before a personal completion claim", () => {
  assertObjective(correctionReady(), {
    id: "separate-chorus", mapId: "sanctuary-return-record", interactionIds: ["unnamed-chorus"],
    label: "무명의 합창에서 기억들을 분리한다.",
  });
  assertObjective(correctionReady(), {
    id: "stabilize-chorus-anchors", mapId: "sanctuary-return-record",
    interactionIds: ["unnamed-chorus", "chorus-anchor-forest", "chorus-anchor-coast", "chorus-anchor-volcano"],
    label: "무명의 합창을 공격해 기억 파편을 모아 세 기록 닻에 F로 놓는다.",
  }, chorusSnapshot());
  assertObjective(correctionReady(), {
    id: "resolve-chorus-testimonies", mapId: "sanctuary-return-record",
    interactionIds: CHORUS_TESTIMONY_IDS.map(id => `chorus-testimony-${id}`),
    label: "무명의 합창의 증언을 F로 판정한다.",
  }, chorusSnapshot({ stabilizedAnchorIds: ["forest", "coast", "volcano"] }));
  assertObjective(correctionReady(), {
    id: "sever-chorus-bonds", mapId: "sanctuary-return-record",
    interactionIds: ["chorus-record-roan", "chorus-bond-roan"],
    label: "로안 기록을 F로 활성화한 뒤 드러난 결속선을 공격한다.",
  }, chorusSnapshot({
    stabilizedAnchorIds: ["forest", "coast", "volcano"], resolvedTestimonyIds: CHORUS_TESTIMONY_IDS,
  }));
});

test("later flags and a shared separated snapshot cannot bypass the personal chorus completion claim", () => {
  const beforeClaim = correctionReady();
  beforeClaim.chapters.sanctuary.collectedTestimonyIds = [...OPINION_IDS];
  beforeClaim.chapters.sanctuary.previewedFutureIds = ["seal", "restore", "release"];
  assert.equal(getSanctuaryChapterObjective(beforeClaim, chorusSnapshot({
    stabilizedAnchorIds: ["forest", "coast", "volcano"], resolvedTestimonyIds: CHORUS_TESTIMONY_IDS,
    severedBondIds: ["roan", "sera", "garen", "lumen"],
  })).id, "separate-chorus");
  const game = Object.create(PixelRPG.prototype);
  game.progress = { worldProgress: { ...beforeClaim, unlockedRegionIds: ["sanctuary"] } };
  game.latestChorusSnapshot = chorusSnapshot({
    stabilizedAnchorIds: ["forest", "coast", "volcano"], resolvedTestimonyIds: CHORUS_TESTIMONY_IDS,
  });
  const persistedBefore = structuredClone(game.progress);
  assert.equal(game.currentChapterObjective().id, "sever-chorus-bonds");
  assert.deepEqual(game.progress, persistedBefore);
  assert.equal("chorusSnapshot" in game.progress.worldProgress, false);
});

test("four of five opinions cannot unlock previews or a choice", () => {
  const progress = correctionReady();
  progress.chapters.sanctuary.chorusSeparated = true;
  progress.chapters.sanctuary.collectedTestimonyIds = OPINION_IDS.slice(0, 4);
  progress.chapters.sanctuary.previewedFutureIds = ["seal", "restore", "release"];
  assert.equal(getSanctuaryChapterObjective(progress).id, "collect-five-opinions");
  progress.chapters.sanctuary.collectedTestimonyIds = [...OPINION_IDS];
  assert.equal(getSanctuaryChapterObjective(progress).id, "choose-future");
});

function relativeModuleSpecifiers(source) {
  const specifiers = [];
  const isWord = value => /[A-Za-z0-9_$]/.test(value || "");
  const readString = index => {
    const quote = source[index];
    if (!["'", '"'].includes(quote)) return null;
    let value = "";
    for (index += 1; index < source.length; index += 1) {
      if (source[index] === "\\") { value += source[index + 1] || ""; index += 1; continue; }
      if (source[index] === quote) return { value, end: index + 1 };
      value += source[index];
    }
    return null;
  };
  const add = value => {
    if ((value.startsWith("./") || value.startsWith("../")) && value.endsWith(".js")) specifiers.push(value);
  };
  const skipTrivia = index => {
    while (index < source.length) {
      if (/\s/.test(source[index])) { index += 1; continue; }
      if (source.startsWith("//", index)) {
        const lineEnd = source.indexOf("\n", index + 2);
        index = lineEnd < 0 ? source.length : lineEnd + 1;
        continue;
      }
      if (source.startsWith("/*", index)) {
        const commentEnd = source.indexOf("*/", index + 2);
        index = commentEnd < 0 ? source.length : commentEnd + 2;
        continue;
      }
      break;
    }
    return index;
  };
  const skipRegex = index => {
    for (index += 1; index < source.length; index += 1) {
      if (source[index] === "\\") { index += 1; continue; }
      if (source[index] === "/") {
        index += 1;
        while (/[A-Za-z]/.test(source[index] || "")) index += 1;
        return index;
      }
      if (source[index] === "\n") return index;
    }
    return index;
  };
  const scan = (start, stopAtBrace = false) => {
    let index = start;
    while (index < source.length) {
      if (stopAtBrace && source[index] === "}") return index + 1;
    if (source.startsWith("//", index)) {
      const lineEnd = source.indexOf("\n", index + 2);
      index = lineEnd < 0 ? source.length : lineEnd + 1;
      continue;
    }
    if (source.startsWith("/*", index)) {
      const commentEnd = source.indexOf("*/", index + 2);
      index = commentEnd < 0 ? source.length : commentEnd + 2;
      continue;
    }
    if (["'", '"'].includes(source[index])) {
      index = readString(index)?.end || source.length;
      continue;
    }
    if (source[index] === "`") {
      index = scanTemplate(index);
      continue;
    }
    if (source[index] === "/") {
      index = skipRegex(index);
      continue;
    }
    const keyword = source.startsWith("import", index) ? "import" : source.startsWith("export", index) ? "export" : null;
    if (!keyword || isWord(source[index - 1]) || isWord(source[index + keyword.length])) { index += 1; continue; }
    let cursor = skipTrivia(index + keyword.length);
    if (keyword === "import" && source[cursor] === ".") { index = cursor + 1; continue; }
    if (keyword === "import" && source[cursor] === "(") {
      cursor = skipTrivia(cursor + 1);
      const module = readString(cursor);
      if (module) add(module.value);
      index = module ? module.end : source[cursor] === "`" ? scanTemplate(cursor) : cursor + 1;
      continue;
    }
    let module = readString(cursor);
    if (!module) {
      while (cursor < source.length) {
        if (source.startsWith("from", cursor) && !isWord(source[cursor - 1]) && !isWord(source[cursor + 4])) {
          module = readString(skipTrivia(cursor + 4));
          break;
        }
        if (source.startsWith("//", cursor) || source.startsWith("/*", cursor)) { cursor = skipTrivia(cursor); continue; }
        if (["'", '"'].includes(source[cursor])) { cursor = readString(cursor)?.end || source.length; continue; }
        cursor += 1;
      }
    }
    if (module) add(module.value);
    index = module?.end || cursor + 1;
  }
    return index;
  };
  const scanTemplate = start => {
    for (let index = start + 1; index < source.length; index += 1) {
      if (source[index] === "\\") { index += 1; continue; }
      if (source[index] === "`") return index + 1;
      if (source[index] === "$" && source[index + 1] === "{") index = scan(index + 2, true) - 1;
    }
    return source.length;
  };
  scan(0);
  return specifiers;
}

async function reachableLocalModules(entryUrl) {
  const visited = new Set();
  async function visit(url) {
    if (visited.has(url.href)) return;
    visited.add(url.href);
    const source = await readFile(url, "utf8");
    for (const specifier of relativeModuleSpecifiers(source)) await visit(new URL(specifier, url));
  }
  await visit(entryUrl);
  return visited;
}

test("every reachable local module uses the sanctuary physical suffix", async () => {
  const visited = await reachableLocalModules(new URL(
    "../src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js",
    import.meta.url,
  ));
  assert.equal(visited.size, 88);
  for (const url of visited) assert.match(new URL(url).pathname, /-20260911-sanctuary\.js$/);
});

test("cache scanner finds static, side-effect, dynamic, and parent-relative local modules without string decoys", () => {
  const source = `
    // import "./comment-20260905-upgrade.js";
    /* export { stale } from "../block-20260905-upgrade.js"; */
    const decoy = 'import("../decoy-20260905-upgrade.js")';
    const regexDecoy = /import\\s*\\(\\s*["']\\.\\/regex-20260905-upgrade\\.js["']\\s*\\)/;
    const templateDecoy = \`import("../template-20260905-upgrade.js")\`;
    import "./side-effect-20260911-sanctuary.js";
    import { value } from "../parent-20260911-sanctuary.js";
    export { value as copied } from "./re-export-20260911-sanctuary.js";
    await import("../dynamic-20260911-sanctuary.js");
    await import /* cache note */ ("../dynamic-comment-20260905-upgrade.js");
    import /* note */ "./side-comment-20260905-upgrade.js";
    export /* note */ { value } from "../export-comment-20260905-upgrade.js";
    await import(\`raw import("../template-raw-20260905-upgrade.js") \${ import("../template-expression-20260905-upgrade.js") }\`);
    await import(\`outer \${ \`\${ import("./nested-expression-20260905-upgrade.js") }\` }\`);
    console.log(import.meta.url);
  `;
  assert.deepEqual(relativeModuleSpecifiers(source), [
    "./side-effect-20260911-sanctuary.js",
    "../parent-20260911-sanctuary.js",
    "./re-export-20260911-sanctuary.js",
    "../dynamic-20260911-sanctuary.js",
    "../dynamic-comment-20260905-upgrade.js",
    "./side-comment-20260905-upgrade.js",
    "../export-comment-20260905-upgrade.js",
    "../template-expression-20260905-upgrade.js",
    "./nested-expression-20260905-upgrade.js",
  ]);
});
