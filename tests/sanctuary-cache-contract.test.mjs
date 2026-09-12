import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getVolcanoChapterObjective } from "../src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { getSanctuaryChapterObjective } from "../src/sanctuary-story-data-20260911-sanctuary.js";
import { createChorusEncounter } from "../src/sanctuary-chorus-state-20260911-sanctuary.js";
import { TESTIMONY_IDS as CHORUS_TESTIMONY_IDS } from "../src/sanctuary-chorus-data-20260911-sanctuary.js";
import * as sanctuaryGameModule from "../src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";

const { PixelRPG } = sanctuaryGameModule;

const CORE_IDS = ["forest-core-casket", "coast-core-casket", "volcano-core-casket"];
const SOUND_IDS = ["departure-bell", "dawn-bird", "tide-bell", "mine-shift-bell"];
const TRUTH_IDS = ["truth-resonance-time", "truth-first-archivist-log", "truth-core-self-division"];
const FALSE_RETURN_IDS = ["false-return-garen-unscarred", "false-return-source-erased", "false-return-resonance-time"];
const FIELD_IDS = ["vanguard-return-state", "core-division-cause", "delay-roan", "delay-sera", "delay-garen", "delay-lumen"];
const OPINION_IDS = ["roan", "sera", "garen", "lumen", "echo"];

test("entry document declares a self-contained favicon for strict browser diagnostics", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<link\s+rel="icon"\s+href="data:,"\s*\/?>/);
});

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

test("sanctuary diagnostics are gated to an explicit local Firebase emulator page", () => {
  assert.equal(typeof sanctuaryGameModule.isSanctuaryNetworkDiagnosticsEnabled, "function");
  const enabled = sanctuaryGameModule.isSanctuaryNetworkDiagnosticsEnabled;
  assert.equal(enabled("127.0.0.1", "?firebaseEmulator=1"), true);
  assert.equal(enabled("localhost", "?mode=online&firebaseEmulator=1"), true);
  assert.equal(enabled("127.0.0.1", "?firebaseEmulator=0"), false);
  assert.equal(enabled("pixel-world-8cb9b.web.app", "?firebaseEmulator=1"), false);
});

test("sanctuary diagnostics expose detached gameplay snapshots and observed input only", () => {
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, {
    sanctuaryNetworkDiagnosticsEnabled: true,
    sanctuaryNetworkInputCodes: ["KeyF", "ControlLeft"],
    running: true,
    inputEnabled: true,
    sessionMode: "online",
    mapId: "sanctuary-return-record",
    network: {
      uid: "uid-a",
      mode: "firebase",
      chorus: { latestState: { encounterId: "encounter-a", authorityUid: "uid-a", phase: "anchors" } },
    },
    player: { x: 100, y: 200, dir: "up", hp: 90, respawnTimer: 0 },
    progress: { worldProgress: { chapters: { sanctuary: { endingChoice: null } } } },
    nearbyStoryInteraction: { id: "vanguard-return-state" },
    nearbyChorusInteraction: { type: "anchor", anchorId: "forest" },
    attackState: { type: "basic" },
    chorusController: {
      snapshot: { phase: "anchors", hp: 100 },
      personalSnapshot: { contamination: 10, carriedFragmentId: "forest" },
      completionClaims: { "uid-a": { eligible: true } },
      renderModel: () => ({ telegraph: null }),
      canAttack: () => true,
    },
  });

  assert.equal(typeof game.readSanctuaryNetworkDiagnostics, "function");
  const diagnostics = game.readSanctuaryNetworkDiagnostics();
  assert.deepEqual(diagnostics, {
    running: true,
    inputEnabled: true,
    sessionMode: "online",
    mapId: "sanctuary-return-record",
    uid: "uid-a",
    networkMode: "firebase",
    player: { x: 100, y: 200, dir: "up", hp: 90, respawnTimer: 0 },
    progress: { worldProgress: { chapters: { sanctuary: { endingChoice: null } } } },
    nearbyStoryId: "vanguard-return-state",
    nearbyChorus: { type: "anchor", anchorId: "forest" },
    attackActive: true,
    inputCodes: ["KeyF", "ControlLeft"],
    chorus: {
      shared: { phase: "anchors", hp: 100 },
      firebaseState: { encounterId: "encounter-a", authorityUid: "uid-a", phase: "anchors" },
      personal: { contamination: 10, carriedFragmentId: "forest" },
      claims: { "uid-a": { eligible: true } },
      render: { telegraph: null },
      canAttack: true,
    },
  });

  diagnostics.player.x = 999;
  diagnostics.progress.worldProgress.chapters.sanctuary.endingChoice = "release";
  diagnostics.chorus.shared.hp = 0;
  diagnostics.inputCodes.push("KeyR");
  assert.equal(game.player.x, 100);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
  assert.equal(game.chorusController.snapshot.hp, 100);
  assert.deepEqual(game.sanctuaryNetworkInputCodes, ["KeyF", "ControlLeft"]);
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
  const isIdentifierPart = value => /[A-Za-z0-9_$]/.test(value || "");
  const add = value => {
    if ((value.startsWith("./") || value.startsWith("../")) && value.endsWith(".js")) specifiers.push(value);
  };

  // This deterministic lexer accepts ESM static, side-effect, and re-export
  // declarations plus dynamic import() with quoted or constant-template paths.
  // It scans interpolation expressions recursively, while treating comments,
  // strings, regex literals, and raw template text as non-code. A parenthesis
  // stack preserves statement-start regexes after control conditions while
  // keeping grouping, call, and parameter closes as completed operands.
  function readEscape(index) {
    const next = source[index + 1];
    if (next === "u") {
      if (source[index + 2] === "{") {
        const close = source.indexOf("}", index + 3);
        const digits = close < 0 ? "" : source.slice(index + 3, close);
        if (/^[0-9A-Fa-f]{1,6}$/.test(digits)) return { value: String.fromCodePoint(Number.parseInt(digits, 16)), end: close + 1 };
      }
      const digits = source.slice(index + 2, index + 6);
      if (/^[0-9A-Fa-f]{4}$/.test(digits)) return { value: String.fromCodePoint(Number.parseInt(digits, 16)), end: index + 6 };
    }
    if (next === "x") {
      const digits = source.slice(index + 2, index + 4);
      if (/^[0-9A-Fa-f]{2}$/.test(digits)) return { value: String.fromCharCode(Number.parseInt(digits, 16)), end: index + 4 };
    }
    const escaped = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", 0: "\0" }[next];
    return { value: escaped ?? (next || ""), end: Math.min(index + 2, source.length) };
  }

  function readString(start) {
    const quote = source[start];
    if (!["'", '"'].includes(quote)) return null;
    let value = "";
    for (let index = start + 1; index < source.length;) {
      if (source[index] === "\\") {
        const escaped = readEscape(index);
        value += escaped.value;
        index = escaped.end;
        continue;
      }
      if (source[index] === quote) return { value, end: index + 1 };
      if (/\r|\n/.test(source[index])) return null;
      value += source[index];
      index += 1;
    }
    return null;
  }

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

  function skipRegex(start) {
    let inClass = false;
    for (let index = start + 1; index < source.length; index += 1) {
      if (source[index] === "\\") { index += 1; continue; }
      if (source[index] === "[") { inClass = true; continue; }
      if (source[index] === "]") { inClass = false; continue; }
      if (!inClass && source[index] === "/") {
        index += 1;
        while (/[A-Za-z]/.test(source[index] || "")) index += 1;
        return index;
      }
      if (/\r|\n/.test(source[index])) return index;
    }
    return source.length;
  }

  function readTemplate(start) {
    let value = "";
    let constant = true;
    for (let index = start + 1; index < source.length;) {
      if (source[index] === "\\") {
        const escaped = readEscape(index);
        value += escaped.value;
        index = escaped.end;
        continue;
      }
      if (source[index] === "`") return { value, constant, end: index + 1 };
      if (source[index] === "$" && source[index + 1] === "{") {
        constant = false;
        index = scanCode(index + 2, true);
        continue;
      }
      value += source[index];
      index += 1;
    }
    return null;
  }

  function consumeModuleKeyword(keyword, afterKeyword) {
    let cursor = skipTrivia(afterKeyword);
    if (keyword === "import" && source[cursor] === ".") return cursor + 1;
    if (keyword === "import" && source[cursor] === "(") {
      cursor = skipTrivia(cursor + 1);
      const module = readString(cursor) || (source[cursor] === "`" ? readTemplate(cursor) : null);
      if (module?.constant !== false) add(module?.value || "");
      return module?.end || cursor + 1;
    }

    let module = readString(cursor);
    if (module) {
      add(module.value);
      return module.end;
    }

    while (cursor < source.length) {
      cursor = skipTrivia(cursor);
      if (isIdentifierPart(source[cursor])) {
        const start = cursor;
        while (isIdentifierPart(source[cursor])) cursor += 1;
        if (source.slice(start, cursor) === "from") {
          module = readString(skipTrivia(cursor));
          if (module) add(module.value);
          return module?.end || cursor;
        }
        continue;
      }
      if (["'", '"'].includes(source[cursor])) {
        cursor = readString(cursor)?.end || source.length;
        continue;
      }
      if (source[cursor] === "`") {
        cursor = readTemplate(cursor)?.end || source.length;
        continue;
      }
      if (source[cursor] === ";" || source[cursor] === "\n") return cursor + 1;
      cursor += 1;
    }
    return cursor;
  }

  function scanCode(start, stopAtInterpolation = false) {
    let index = start;
    let braceDepth = 0;
    let expectsOperand = true;
    let controlParenPending = false;
    const parenKinds = [];
    while (index < source.length) {
      const triviaEnd = skipTrivia(index);
      if (triviaEnd !== index) { index = triviaEnd; continue; }
      const token = source[index];
      if (stopAtInterpolation && token === "}") {
        if (braceDepth === 0) return index + 1;
        braceDepth -= 1;
        expectsOperand = false;
        index += 1;
        continue;
      }
      if (["'", '"'].includes(token)) {
        index = readString(index)?.end || source.length;
        expectsOperand = false;
        continue;
      }
      if (token === "`") {
        index = readTemplate(index)?.end || source.length;
        expectsOperand = false;
        continue;
      }
      if (token === "/") {
        if (expectsOperand) {
          index = skipRegex(index);
          expectsOperand = false;
        } else {
          index += 1;
          expectsOperand = true;
        }
        continue;
      }
      if (isIdentifierPart(token) && !/[0-9]/.test(token)) {
        const wordStart = index;
        while (isIdentifierPart(source[index])) index += 1;
        const word = source.slice(wordStart, index);
        if ((word === "import" || word === "export")
          && !isIdentifierPart(source[wordStart - 1]) && !isIdentifierPart(source[index])) {
          index = consumeModuleKeyword(word, index);
          expectsOperand = false;
          continue;
        }
        const afterWord = skipTrivia(index);
        const forAwaitHeader = word === "for"
          && source.startsWith("await", afterWord)
          && !isIdentifierPart(source[afterWord + "await".length])
          && source[skipTrivia(afterWord + "await".length)] === "(";
        const continuingForAwait = controlParenPending && word === "await" && source[afterWord] === "(";
        controlParenPending = continuingForAwait || (source[wordStart - 1] !== "."
          && ["catch", "for", "if", "switch", "while", "with"].includes(word)
          && (source[afterWord] === "(" || forAwaitHeader));
        expectsOperand = ["case", "delete", "do", "else", "in", "instanceof", "new", "return", "throw", "typeof", "void", "yield"].includes(word);
        continue;
      }
      if (/[0-9]/.test(token)) {
        index += 1;
        while (/[A-Za-z0-9_.]/.test(source[index] || "")) index += 1;
        expectsOperand = false;
        continue;
      }
      if (token === "{") { braceDepth += 1; expectsOperand = true; index += 1; continue; }
      if (token === "(") {
        parenKinds.push(controlParenPending ? "control" : "ordinary");
        controlParenPending = false;
        expectsOperand = true;
        index += 1;
        continue;
      }
      if (token === ")") {
        expectsOperand = parenKinds.pop() === "control";
        index += 1;
        continue;
      }
      if (token === "}" || token === "]") { expectsOperand = false; index += 1; continue; }
      controlParenPending = false;
      expectsOperand = !["++", "--"].includes(source.slice(index, index + 2));
      index += 1;
    }
    return index;
  }

  scanCode(0);
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
    const quotient = 18 / 3; await import("./after-division-20260905-upgrade.js");
    await import(\`./constant-template-20260905-upgrade.js\`);
    await import("./escaped-\\u0032\\u0030\\u0032\\u0036\\u0030\\u0039\\u0030\\u0035-upgrade.js");
    await import(\`../template-escaped-\\u0032\\u0030\\u0032\\u0036\\u0030\\u0039\\u0030\\u0035-upgrade.js\`);
    await import(\`outer \${ ({ nested: { value: true } }, import("../nested-brace-template-20260905-upgrade.js")) }\`);
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
    "./after-division-20260905-upgrade.js",
    "./constant-template-20260905-upgrade.js",
    "./escaped-20260905-upgrade.js",
    "../template-escaped-20260905-upgrade.js",
    "../nested-brace-template-20260905-upgrade.js",
  ]);
});

test("cache scanner treats a control-condition close as a regex-literal position", () => {
  const source = `
    if (ready) /if-same+/.test(name); import("./after-if-same-20260905-upgrade.js");
    if (ready) /if-asi+/.test(name)
    import("./after-if-asi-20260905-upgrade.js");
    while (ready) /while-same+/.test(name); import("./after-while-same-20260905-upgrade.js");
    while (ready) /while-asi+/.test(name)
    import("./after-while-asi-20260905-upgrade.js");
    for (let index = 0; index < 1; index += 1) /for-same+/.test(name); import("./after-for-same-20260905-upgrade.js");
    for (let index = 0; index < 1; index += 1) /for-asi+/.test(name)
    import("./after-for-asi-20260905-upgrade.js");
    async function scanForAwait() {
      for /* for note */ await /* await note */ (const item of stream) /for-await-same+/.test(item); import("./after-for-await-same-20260905-upgrade.js");
      for /* for note */ await /* await note */ (const item of stream) /for-await-asi+/.test(item)
      import("./after-for-await-asi-20260905-upgrade.js");
    }
    with (scope) /with+/.test(name); import("./after-with-20260905-upgrade.js");
    try {} catch (error) { /catch+/.test(name); } import("./after-catch-20260905-upgrade.js");
    switch (value) { default: /switch+/.test(name); } import("./after-switch-20260905-upgrade.js");
    do /do-body+/.test(name); while (ready); import("./after-do-while-20260905-upgrade.js");
    const quotient = (a) / b; import("./after-grouping-division-20260905-upgrade.js");
    call() / divisor; import("./after-call-division-20260905-upgrade.js");
    promise.catch() / divisor; import("./after-catch-call-division-20260905-upgrade.js");
  `;
  assert.doesNotThrow(() => new Function(source));
  assert.deepEqual(relativeModuleSpecifiers(source), [
    "./after-if-same-20260905-upgrade.js",
    "./after-if-asi-20260905-upgrade.js",
    "./after-while-same-20260905-upgrade.js",
    "./after-while-asi-20260905-upgrade.js",
    "./after-for-same-20260905-upgrade.js",
    "./after-for-asi-20260905-upgrade.js",
    "./after-for-await-same-20260905-upgrade.js",
    "./after-for-await-asi-20260905-upgrade.js",
    "./after-with-20260905-upgrade.js",
    "./after-catch-20260905-upgrade.js",
    "./after-switch-20260905-upgrade.js",
    "./after-do-while-20260905-upgrade.js",
    "./after-grouping-division-20260905-upgrade.js",
    "./after-call-division-20260905-upgrade.js",
    "./after-catch-call-division-20260905-upgrade.js",
  ]);
});
