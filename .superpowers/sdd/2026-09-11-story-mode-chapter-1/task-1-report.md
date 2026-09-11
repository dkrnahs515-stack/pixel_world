# Task 1 — Root Experience Selector Report

## Implementation summary

- Added the initial `#experienceOverlay` with the specified existing-RPG button and `./story/` anchor.
- Kept the existing RPG registration form, initially hidden it, and added a form-local return button.
- Added `bindExperienceSelector` as a focused DOM-only binding: it validates required fields, changes overlay visibility, restores the requested focus, and returns listener cleanup.
- Created the `20260911-story` root CSS and main entry files from the active RPG release. The main entry adds only selector binding/integration and changes initial focus to the RPG choice; `game.enter(selection.nickname, selection.classId, selection.playMode)` is unchanged.
- Updated active-file test references. A single cache-contract assertion also needed the new root filenames for the complete suite to remain accurate.
- Normalized CRLF to LF in the CI workflow test before its regex assertions, without changing those assertions.

## Changed files

- `index.html`
- `styles-20260911-story.css`
- `src/main-20260911-story.js`
- `src/experience-entry.js`
- `tests/experience-entry.test.mjs`
- `tests/experience-entry-ui.static.test.cjs`
- `tests/entry-ui.static.test.cjs`
- `tests/play-mode-ui.static.test.cjs`
- `tests/firebase-hosting.test.mjs`
- `tests/ci-workflow.test.mjs`
- `tests/volcano-cache-contract.test.mjs`

## RED evidence

Command:

```powershell
node --test tests/experience-entry.test.mjs tests/experience-entry-ui.static.test.cjs
```

Result: failed as expected before production files existed. The behavioral suite failed with `ERR_MODULE_NOT_FOUND` for `src/experience-entry.js`; static contracts also reported the absent selector markup, absent `20260911-story` CSS/main files, and missing selector CSS.

## GREEN evidence

Commands:

```powershell
node --test tests/experience-entry.test.mjs tests/experience-entry-ui.static.test.cjs tests/entry-ui.static.test.cjs tests/play-mode-ui.static.test.cjs tests/firebase-hosting.test.mjs tests/ci-workflow.test.mjs
node --check src/experience-entry.js
node --check src/main-20260911-story.js
node --test tests/*.test.mjs tests/*.static.test.cjs
```

Results:

- Focused/static suite: 22 tests passed, 0 failed.
- Both JavaScript syntax checks exited successfully.
- Full suite: 733 tests passed, 0 failed.

## Self-review

- Behavioral tests cover RPG selection, return selection, cleanup, and missing required elements using real event-capable `EventTarget` instances.
- Static tests cover selector DOM IDs/route, root physical assets, retained RPG form/HUD IDs, two-column/mobile-one-column layout, focus visibility, and reduced motion.
- The new CSS content has the active CSS as an exact normalized-text prefix before selector additions.
- The root main module imports no story controller; it retains the existing RPG game module and unchanged three-argument game-entry call.
- `git diff --check` reports no whitespace errors.

## Concerns

- The full suite emits Node's pre-existing experimental warning: `localStorage is not available because --localstorage-file was not provided.` It has no associated test failures and was not suppressed.
- Git reports the repository's normal Windows CRLF conversion notices for edited text files; the CI test is deliberately CRLF-tolerant.
