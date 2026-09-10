from pathlib import Path

root = Path('.')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label} marker missing')
    return text.replace(old, new, 1)

# game runtime
path = root / 'src/game-20260910-sanctuary.js'
text = path.read_text()
text = replace_once(
    text,
    '  getQaMonster,\n  prepareWeaponQaProgress,\n} from "./qa-mode-20260910-sanctuary.js";',
    '  getQaMonster,\n  prepareSanctuaryQaProgress,\n  prepareWeaponQaProgress,\n} from "./qa-mode-20260910-sanctuary.js";',
    'game qa import',
)
text = replace_once(
    text,
    '''    for (const button of elements.qaWorldButtons || []) {\n      button.addEventListener("click", () => this.qaTravel(button.dataset.qaWorld));\n    }\n    for (const button of elements.qaMonsterButtons || []) {''',
    '''    for (const button of elements.qaWorldButtons || []) {\n      button.addEventListener("click", () => this.qaTravel(button.dataset.qaWorld));\n    }\n    for (const button of elements.qaSanctuarySetupButtons || []) {\n      button.addEventListener("click", () => this.qaPrepareSanctuary(button.dataset.qaSanctuarySetup));\n    }\n    for (const button of elements.qaMonsterButtons || []) {''',
    'game qa button bind',
)
text = replace_once(
    text,
    '''        ...(elements.qaWorldButtons || []),\n        ...(elements.qaMonsterButtons || []),''',
    '''        ...(elements.qaWorldButtons || []),\n        ...(elements.qaSanctuarySetupButtons || []),\n        ...(elements.qaMonsterButtons || []),''',
    'game qa focus controls',
)
text = replace_once(
    text,
    '''  qaTravel(mapId) {\n    if (!this.qaEnabled || !this.running) return false;''',
    '''  qaPrepareSanctuary(setupId) {\n    if (!this.qaEnabled || !this.running || !this.isQaOpen()) return false;\n    const previousProgress = this.progress;\n    const prepared = prepareSanctuaryQaProgress(previousProgress, setupId);\n    if (!prepared.ok) {\n      this.notify(prepared.reason === "terminal_state"\n        ? "이미 정식 엔딩이 기록된 세이브는 성역 QA 진행을 덮어쓸 수 없습니다."\n        : "지원하지 않는 성역 QA 상태입니다.");\n      return false;\n    }\n\n    this.progress = prepared.progress;\n    if (!this.persistProgress("성역 QA 진행 상태를 저장할 수 없습니다.")) {\n      this.progress = previousProgress;\n      return false;\n    }\n\n    this.trinityBoss = null;\n    const world = getWorldDefinition(prepared.mapId);\n    this.switchWorld(world.id, world.spawn.x, world.spawn.y);\n    this.closeQaPanel();\n    if (prepared.openEndingChoice) {\n      this.openSanctuaryEndingChoice();\n      const focusKey = {\n        restore: "endingRestoreButton",\n        seal: "endingSealButton",\n        resonate: "endingResonateButton",\n      }[prepared.focusEndingId];\n      this.ui?.[focusKey]?.focus?.();\n    }\n    this.notify(prepared.label);\n    return true;\n  }\n\n  qaTravel(mapId) {\n    if (!this.qaEnabled || !this.running) return false;''',
    'game sanctuary qa method',
)
path.write_text(text)

# main DOM wiring
path = root / 'src/main-20260910-sanctuary.js'
text = path.read_text()
text = replace_once(
    text,
    '  qaWorldButtons: [...document.querySelectorAll("[data-qa-world]")],\n  qaMonsterButtons:',
    '  qaWorldButtons: [...document.querySelectorAll("[data-qa-world]")],\n  qaSanctuarySetupButtons: [...document.querySelectorAll("[data-qa-sanctuary-setup]")],\n  qaMonsterButtons:',
    'main sanctuary qa elements',
)
path.write_text(text)

# QA panel markup
path = root / 'index.html'
text = path.read_text()
text = replace_once(
    text,
    '''            <button type="button" data-qa-world="volcano-core-caldera">화구 코어 제단</button>\n          </div>\n        </section>''',
    '''            <button type="button" data-qa-world="volcano-core-caldera">화구 코어 제단</button>\n            <button type="button" data-qa-world="sanctuary">픽셀 코어 성역 입구</button>\n            <button type="button" data-qa-world="sanctuary-resonance-hall">공명 회랑</button>\n            <button type="button" data-qa-world="sanctuary-origin-archive">원점 기록고</button>\n            <button type="button" data-qa-world="sanctuary-zero-boundary">제로 경계</button>\n            <button type="button" data-qa-world="sanctuary-core-heart">코어 심장부</button>\n          </div>\n        </section>\n\n        <section class="qa-section" aria-labelledby="qaSanctuaryTitle">\n          <h3 id="qaSanctuaryTitle">픽셀 코어 성역 진행 준비</h3>\n          <div class="qa-weapon-actions">\n            <button class="qa-weapon-action" type="button" data-qa-sanctuary-setup="origin-records-3"><span>원점 기록 3/3</span>공명 엔딩 조건 준비</button>\n            <button class="qa-weapon-action" type="button" data-qa-sanctuary-setup="trinity-ready"><span>TRINITY-ready</span>제로 경계 전투 직전</button>\n            <button class="qa-weapon-action" type="button" data-qa-sanctuary-setup="origin-ready"><span>ORIGIN-ready</span>코어 심장부 전투 직전</button>\n            <button class="qa-weapon-action" type="button" data-qa-sanctuary-setup="ending-restore-ready"><span>복원 엔딩-ready</span>ORIGIN 처치·복원 선택 준비</button>\n            <button class="qa-weapon-action" type="button" data-qa-sanctuary-setup="ending-seal-ready"><span>봉인 엔딩-ready</span>ORIGIN 처치·봉인 선택 준비</button>\n            <button class="qa-weapon-action" type="button" data-qa-sanctuary-setup="ending-resonate-ready"><span>공명 엔딩-ready</span>원점 기록 3/3·공명 선택 준비</button>\n          </div>\n        </section>''',
    'index sanctuary qa controls',
)
path.write_text(text)

# Bring the legacy QA static regression forward to the current physical entry.
path = root / 'tests/qa-ui.static.test.cjs'
text = path.read_text()
text = replace_once(
    text,
    'const main = readFileSync(path.join(__dirname, "../src/main-20260903-volcano-20260905-upgrade.js"), "utf8");',
    'const main = readFileSync(path.join(__dirname, "../src/main-20260910-sanctuary.js"), "utf8");',
    'qa ui current main',
)
text = replace_once(
    text,
    '  assert.doesNotMatch(html, /data-qa-world="sanctuary"/);',
    '''  for (const mapId of [\n    "sanctuary", "sanctuary-resonance-hall", "sanctuary-origin-archive",\n    "sanctuary-zero-boundary", "sanctuary-core-heart",\n  ]) {\n    assert.match(html, new RegExp(`data-qa-world="${mapId}"`));\n  }\n  assert.equal((html.match(/data-qa-sanctuary-setup=/g) || []).length, 6);''',
    'qa ui sanctuary expectation',
)
text = replace_once(
    text,
    '''  assert.match(main, /qaBossButton:\\s*document\\.querySelector\\("\\[data-qa-boss='approach'\\]"\\)/);''',
    '''  assert.match(main, /qaBossButton:\\s*document\\.querySelector\\("\\[data-qa-boss='approach'\\]"\\)/);\n  assert.match(main, /qaSanctuarySetupButtons:\\s*\\[\\.\\.\\.document\\.querySelectorAll\\("\\[data-qa-sanctuary-setup\\]"\\)\\]/);''',
    'qa ui sanctuary main expectation',
)
path.write_text(text)

# Existing QA unit tests should exercise the current QA module instead of the historical compatibility entry.
path = root / 'tests/qa-mode.test.mjs'
text = path.read_text()
text = replace_once(
    text,
    '    return await import("../src/qa-mode.js");',
    '    return await import("../src/qa-mode-20260910-sanctuary.js");',
    'qa mode current module',
)
path.write_text(text)
