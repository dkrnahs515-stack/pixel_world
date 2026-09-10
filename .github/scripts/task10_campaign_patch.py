from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)

path = Path("src/game-20260910-sanctuary.js")
game = path.read_text(encoding="utf-8")
game = replace_once(
    game,
    'import { storyGuidance } from "./quest-guidance-20260910-sanctuary.js";',
    'import { campaignObjective, storyGuidance } from "./quest-guidance-20260910-sanctuary.js";',
    "campaign guidance import",
)
game = replace_once(
    game,
    'import { arenDialogueModel } from "./aren-dialogue-20260829-coast-20260905-upgrade.js";',
    'import { arenDialogueModel } from "./aren-dialogue-20260910-sanctuary.js";',
    "Aren dialogue import",
)
game = replace_once(
    game,
'''  updateChapterUi() {
    const worldProgress = this.progress?.worldProgress;
    const objective = this.currentChapterObjective();
    if (this.ui.chapterObjective) {
      this.ui.chapterObjective.textContent = `CHAPTER · ${objective.label}`;
    }
    this.ui.renderCommunicationLog?.(getCollectedCoastRecords(worldProgress));
  }

  currentChapterObjective() {
    return getVolcanoChapterObjective(this.progress?.worldProgress);
  }
''',
'''  updateChapterUi() {
    const worldProgress = this.progress?.worldProgress;
    const objective = this.currentChapterObjective();
    if (this.ui.chapterObjective) {
      this.ui.chapterObjective.textContent = `${objective.eyebrow} · ${objective.text}`;
    }
    this.ui.renderCommunicationLog?.(getCollectedCoastRecords(worldProgress));
  }

  currentChapterObjective() {
    return campaignObjective(this.progress, this.mapId);
  }
''',
    "chapter HUD",
)
path.write_text(game, encoding="utf-8")

path = Path("index.html")
html = path.read_text(encoding="utf-8")
html = replace_once(
    html,
    '<span id="chapterObjective" class="chapter-objective">CHAPTER · 푸른 해안의 신호를 찾는다.</span>',
    '<span id="chapterObjective" class="chapter-objective">CHAPTER 1 · 아렌에게 대륙의 상황을 듣는다.</span>',
    "initial chapter placeholder",
)
path.write_text(html, encoding="utf-8")
