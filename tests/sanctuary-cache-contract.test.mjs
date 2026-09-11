import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getVolcanoChapterObjective } from "../src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { getSanctuaryChapterObjective } from "../src/sanctuary-story-data-20260911-sanctuary.js";

const CORE_IDS = ["forest-core-casket", "coast-core-casket", "volcano-core-casket"];
const SOUND_IDS = ["departure-bell", "dawn-bird", "tide-bell", "mine-shift-bell"];
const TRUTH_IDS = ["truth-resonance-time", "truth-first-archivist-log", "truth-core-self-division"];
const FALSE_RETURN_IDS = ["false-return-garen-unscarred", "false-return-source-erased", "false-return-resonance-time"];
const FIELD_IDS = ["vanguard-return-state", "core-division-cause", "delay-roan", "delay-sera", "delay-garen", "delay-lumen"];

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

function assertObjective(progress, expected) {
  assert.deepEqual(getSanctuaryChapterObjective(progress), expected);
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
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: [...SOUND_IDS, ...FALSE_RETURN_IDS], memoryOrderSolved: true, coreTruthRevealed: true, falseReturnRejected: true, completedRecordFieldIds: FIELD_IDS, correctionLinked: true }), {
    id: "separate-chorus", mapId: "sanctuary-return-record", interactionIds: [],
    label: "무명의 합창에서 기억들을 분리한다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: [...SOUND_IDS, ...FALSE_RETURN_IDS], memoryOrderSolved: true, coreTruthRevealed: true, falseReturnRejected: true, completedRecordFieldIds: FIELD_IDS, correctionLinked: true, chorusSeparated: true }), {
    id: "collect-three-testimonies", mapId: "sanctuary-three-futures", interactionIds: ["future-testimony-forest", "future-testimony-coast", "future-testimony-volcano"],
    label: "세 지역에 남은 증언을 듣는다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: [...SOUND_IDS, ...FALSE_RETURN_IDS], memoryOrderSolved: true, coreTruthRevealed: true, falseReturnRejected: true, completedRecordFieldIds: FIELD_IDS, correctionLinked: true, chorusSeparated: true, collectedTestimonyIds: ["forest", "coast", "volcano"] }), {
    id: "preview-three-futures", mapId: "sanctuary-three-futures", interactionIds: ["future-preview-seal", "future-preview-restore", "future-preview-release"],
    label: "봉인·복원·해방의 미래를 모두 확인한다.",
  });
  assertObjective(sanctuaryProgress({ activatedCoreIds: CORE_IDS, collectedMemoryIds: [...SOUND_IDS, ...FALSE_RETURN_IDS], memoryOrderSolved: true, coreTruthRevealed: true, falseReturnRejected: true, completedRecordFieldIds: FIELD_IDS, correctionLinked: true, chorusSeparated: true, collectedTestimonyIds: ["forest", "coast", "volcano"], previewedFutureIds: ["seal", "restore", "release"] }), {
    id: "choose-future", mapId: "sanctuary-three-futures", interactionIds: ["sanctuary-ending-console"],
    label: "남겨진 기억의 운명을 정한다.",
  });
});

test("volcano completion delegates to the sanctuary entrance objective", () => {
  assert.deepEqual(getVolcanoChapterObjective(sanctuaryProgress()), getSanctuaryChapterObjective(sanctuaryProgress()));
});

function relativeModuleSpecifiers(source) {
  return [...source.matchAll(/(?:import|export)\s+(?:[^"';]*?\s+from\s+)?["'](\.\/[^"']+\.js)["']/g)].map(match => match[1]);
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
