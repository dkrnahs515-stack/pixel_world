import {
  coastActorDialogueModel,
  coastStoryDialogueModel,
} from "./story-dialogue-20260829-coast-20260905-upgrade.js";
import { VOLCANO_STORY_ACTORS } from "./volcano-story-data-20260903-volcano-20260905-upgrade.js";
import { SANCTUARY_STORY_ACTORS } from "./sanctuary-story-data-20260910-sanctuary.js";
import { chooseVolcanoRoute, normalizeWorldProgress } from "./chapter-progress-20260910-sanctuary.js";

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

function titleForSanctuaryInteraction(interaction) {
  if (interaction?.name) return interaction.name;
  if (interaction?.type === "sanctuary-resonance") return "공명 회랑";
  if (interaction?.type === "sanctuary-archive") return "원점 기록고";
  if (interaction?.type === "sanctuary-origin-record") return "숨겨진 원점 기록";
  return "픽셀 코어 성역";
}

function supportPerspective(choice) {
  if (choice === "sera") {
    return "세라: 사람의 목소리와 구조 기록이 지워지지 않는 것이 중요해.";
  }
  if (choice === "echo") {
    return "에코: 기록과 데이터가 남아야 진실을 다시 검증할 수 있습니다.";
  }
  if (choice === "mari") {
    return "마리: 무엇보다 세계가 안정되어야 재건을 이어갈 수 있어.";
  }
  return null;
}

function sanctuaryStoryDialogueModel(interaction, worldProgress) {
  const progress = normalizeWorldProgress(worldProgress);
  const pages = [...(interaction.pages || [])];

  if (interaction.id === "archive-defense-protocol") {
    if (progress.chapters.volcano.captainOutcome === "rescued") {
      pages.push("선발대장: 내가 직접 코어에 긴급 접속했다. 대원들을 살릴 다른 방법이 없었다.");
    } else if (progress.chapters.volcano.captainOutcome === "lost") {
      pages.push("선발대장의 마지막 통신 기록: 내가 코어에 직접 접근했다. 방어 프로토콜은 그 직후 시작됐다.");
    }
    const perspective = supportPerspective(progress.chapters.coast.supportChoice);
    if (perspective) pages.push(perspective);
  }

  return {
    title: titleForSanctuaryInteraction(interaction),
    pages,
    actions: [{ id: "story-complete", label: "계속" }],
  };
}

export function storyDialogueModel(interaction, worldProgress) {
  if (interaction?.chapterId === "sanctuary") {
    return sanctuaryStoryDialogueModel(interaction, worldProgress);
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
  const sanctuaryActor = SANCTUARY_STORY_ACTORS.find(value => value.id === actorId);
  if (sanctuaryActor) {
    return {
      title: sanctuaryActor.name,
      pages: [...sanctuaryActor.pages],
      actions: [{ id: "story-close", label: "대화 마치기" }],
    };
  }

  const volcanoActor = VOLCANO_STORY_ACTORS.find(value => value.id === actorId);
  if (volcanoActor) {
    return {
      title: volcanoActor.name,
      pages: [...volcanoActor.pages],
      actions: [{ id: "story-close", label: "대화 마치기" }],
    };
  }

  return coastActorDialogueModel(actorId, worldProgress);
}
