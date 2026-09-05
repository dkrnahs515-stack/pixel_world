import {
  coastActorDialogueModel,
  coastStoryDialogueModel,
} from "./story-dialogue-20260829-coast-20260905-upgrade.js";
import { VOLCANO_STORY_ACTORS } from "./volcano-story-data-20260903-volcano-20260905-upgrade.js";
import { chooseVolcanoRoute, normalizeWorldProgress } from "./chapter-progress-20260903-volcano-20260905-upgrade.js";

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

export function storyDialogueModel(interaction, worldProgress) {
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
