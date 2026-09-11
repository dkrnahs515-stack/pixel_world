import {
  coastActorDialogueModel,
  coastStoryDialogueModel,
} from "./story-dialogue-20260829-coast-20260905-upgrade-20260911-sanctuary.js";
import { VOLCANO_STORY_ACTORS } from "./volcano-story-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { chooseVolcanoRoute, normalizeWorldProgress } from "./chapter-progress-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { MEMORY_SOUND_IDS } from "./sanctuary-progress-20260911-sanctuary.js";

const MEMORY_SOUND_LABELS = Object.freeze({
  "departure-bell": "출발 종",
  "dawn-bird": "새벽 새",
  "tide-bell": "조수 종",
  "mine-shift-bell": "광산 교대 종",
});

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function titleForVolcanoInteraction(interaction) {
  if (interaction.type === "volcano-route") return "화구 진입 제어장치";
  if (interaction.type === "volcano-captain") return "오염된 선발대장";
  if (interaction.type === "volcano-core") return "세 번째 코어 조각";
  if (interaction.speaker) return `${interaction.speaker}의 기록`;
  return "활화산 조사";
}

export function storyDialogueModel(interaction, worldProgress, options = {}) {
  if (interaction?.chapterId === "sanctuary") {
    const progress = normalizeWorldProgress(worldProgress);
    const pages = [...(interaction.pages || [])];
    if (options.retryError) pages.push(options.retryError);
    if (interaction.type === "sanctuary-memory-sequence") {
      const sequence = Array.isArray(options.sequence)
        ? options.sequence.filter((value, index, values) => MEMORY_SOUND_IDS.includes(value) && values.indexOf(value) === index)
        : [];
      const actions = MEMORY_SOUND_IDS
        .filter(id => !sequence.includes(id))
        .map(id => ({ id: `story-memory-add-${id}`, label: `${MEMORY_SOUND_LABELS[id]} 추가` }));
      actions.push({ id: "story-memory-submit", label: "배열 제출" });
      return { title: "기억 소리 배열 장치", pages, actions };
    }
    if (interaction.type === "sanctuary-record-field") {
      const outcome = progress.chapters.volcano.captainOutcome === "rescued" ? "rescued" : "lost";
      const source = interaction.sourceByCaptainOutcome?.[outcome];
      if (source?.pages) pages.push(...source.pages);
      return {
        title: interaction.title || "마지막 귀환 기록",
        pages,
        actions: (interaction.answers || []).map(answer => ({
          id: `story-record-answer-${answer.id}`,
          label: answer.label,
        })),
      };
    }
    return {
      title: interaction.speaker || "기억 회랑",
      pages,
      actions: [{ id: "story-complete", label: "계속" }],
    };
  }
  if (interaction?.chapterId !== "volcano") {
    return coastStoryDialogueModel(interaction, worldProgress);
  }
  const progress = normalizeWorldProgress(worldProgress);
  if (interaction.type === "volcano-route") {
    const prepared = changed(progress, chooseVolcanoRoute(progress, "rescue").progress);
    return {
      title: titleForVolcanoInteraction(interaction),
      pages: prepared
        ? [...interaction.pages, "구조 장비를 완성했다. 냉각 쐐기를 가동하고 화구로 진입한다."]
        : [
          ...interaction.pages,
          "지금 진입하면 대장을 구할 수 없고 히든 무기를 얻지 못한다. 그래도 코어를 회수해 본편 진행은 계속할 수 있다.",
          "구조 포기는 영구 확정되며 되돌릴 수 없다.",
        ],
      actions: prepared
        ? [{ id: "story-volcano-route-rescue", label: "구조 장비를 완성하고 화구로 간다" }]
        : [
          { id: "story-volcano-route-return", label: "구조 준비를 더 한다" },
          { id: "story-volcano-route-proceed", label: "구조를 포기하고 지금 진입한다" },
        ],
    };
  }
  const volcano = progress.chapters.volcano;
  const pages = interaction.type === "volcano-captain"
    ? volcano.routeDecision === "rescue"
      ? [...interaction.pages, "냉각 쐐기가 오염을 걷어 낸다. 선발대장을 구출한다."]
      : [...interaction.pages, "선발대장: 코어 조각을 회수해 성역으로 가라. 나는 여기까지다."]
    : [...(interaction.pages || [])];
  return {
    title: titleForVolcanoInteraction(interaction),
    pages,
    actions: [{ id: "story-complete", label: "계속" }],
  };
}

export function actorDialogueModel(actorId, worldProgress) {
  const actor = VOLCANO_STORY_ACTORS.find(value => value.id === actorId);
  if (!actor) return coastActorDialogueModel(actorId, worldProgress);
  return {
    title: actor.name,
    pages: [...actor.pages],
    actions: [{ id: "story-close", label: "대화 마치기" }],
  };
}
