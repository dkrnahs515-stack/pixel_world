import {
  COAST_STORY_ACTORS,
  COAST_SUPPORT_FOLLOW_UPS,
} from "./coast-story-data-20260829-coast.js";

export { COAST_SUPPORT_FOLLOW_UPS } from "./coast-story-data-20260829-coast.js";

const CLOSE_ACTION = Object.freeze({ id: "story-close", label: "대화 마치기" });

function titleForInteraction(interaction) {
  if (interaction?.name) return interaction.name;
  if (interaction?.speaker) return `${interaction.speaker}의 통신 기록`;
  if (interaction?.type === "support") return "침수된 통신소";
  if (interaction?.type === "rescue") return "세라 구조";
  if (interaction?.type === "core") return "해안 코어 조각";
  if (interaction?.type === "reveal") return "에코";
  return "푸른 해안 신호";
}

export function coastStoryDialogueModel(interaction, worldProgress) {
  if (!interaction) return { title: "", pages: [], actions: [] };
  const actions = interaction.type === "record"
    ? [
      { id: "story-classify-current", label: "현재 구조 신호" },
      { id: "story-classify-past", label: "과거 통신 기록" },
    ]
    : interaction.type === "support"
      ? interaction.choices.map(choice => ({ id: `story-support-${choice.id}`, label: choice.label }))
      : [{ id: "story-complete", label: "계속" }];
  const supportChoice = worldProgress?.chapters?.coast?.supportChoice;
  const followUp = interaction.type === "reveal"
    ? COAST_SUPPORT_FOLLOW_UPS[supportChoice]?.[interaction.actorId]
    : null;
  return {
    title: titleForInteraction(interaction),
    pages: [...(interaction.pages || []), ...(followUp ? [followUp] : [])],
    actions,
  };
}

export function coastActorDialogueModel(actorId, worldProgress) {
  const actor = COAST_STORY_ACTORS.find(candidate => candidate.id === actorId);
  if (!actor) return null;
  const supportChoice = worldProgress?.chapters?.coast?.supportChoice;
  const followUp = COAST_SUPPORT_FOLLOW_UPS[supportChoice]?.[actorId];
  return {
    title: actor.name,
    pages: [...actor.pages, ...(followUp ? [followUp] : [])],
    actions: [{ ...CLOSE_ACTION }],
  };
}
