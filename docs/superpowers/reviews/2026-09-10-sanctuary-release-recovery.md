# Sanctuary release recovery checkpoint

Source fix commit: `5827152f5d4d9c79833966d215f40ab165c8aaf0`.
Baseline: `9969c63122edfa069a920dd5c166112d8ea17add`.

The previously reported local files were not present in the current workspace. The tracked source archive was restored in an isolated local checkout. The original four release regressions were reproduced before rebuilding the fixes. No prior unretained test count is used as evidence.

## Implemented corrections

- R1: real player attack targeting includes live ORIGIN anchors; local and online controllers preserve target IDs, validate geometry/resources, damage anchors independently, and prevent skipping the anchor phase with lethal damage. The core platform is render-only instead of blocking melee/projectiles.
- R3: warning shape and position are serialized and retained across authority handoff. Impact collision uses the frozen warning, excludes dead/out-of-arena players, and damages players who actually remain inside it. Warning and anchor rendering is wired to the game canvas.
- R2: the normal proximity prompt and F interaction reopen an unselected ending at the core. Sanctuary portals use the sanctuary progress gate rather than the old chapter gate.
- R4: after the permanent-choice write succeeds, the selected story remains playable even if the separate reward write fails. Credits and session reentry retry the idempotent reward. Choices cannot be changed by retry.
- Preserve level/MP/skill payment evidence on remote player interpolation; use the sanctuary skill-validation module; keep BOSSKILLBOSS isolated from ORIGIN controllers.

## Evidence before remote browser execution

- Original R1-R4 tests: four expected assertion failures reproduced on baseline.
- Rebuilt candidate: 857 Node tests passed, zero failed; all source JavaScript syntax and diff whitespace checks passed locally.
- The exact patch was transferred with SHA-256 `875c45cc4aa6a568fc46148820eb51a12e3933eb008cd6435b8de3627a28f8e0`. Its 857 tests also passed on the GitHub runner before the source commit was pushed.
- Local Chromium could not navigate the test origin because of an environment administrator policy. No successful local browser run is claimed.

## CI gates now required

`tests/sanctuary-real-input-smoke.cjs` arranges only a pre-chapter/pre-boss save before entry. Thereafter combat and recovery use real keyboard/DOM inputs, natural portals and the actual game/controller pipeline, rather than injecting damage, defeat receipts or ending choices.

The authenticated mode uses two isolated browser contexts, actual anonymous authentication and Realtime Database SDK connections to the local Firebase Auth/Database emulators. Only endpoint/SDK loading is redirected. It must demonstrate shared HP, owner exit and authority takeover, anchors, both local receipts, and independent DOM-selected endings. It is an emulator-backed network test, not production-server verification.

New emulator allow/deny cases test ORIGIN warning fields, anchor request IDs and unauthorized damage/state mutation. Existing rules and browser regressions remain required. Browser failures retain screenshots and runtime snapshots as CI artifacts.

**At this documentation commit the new browser and authenticated-network results are pending. This document does not declare the release complete, authorize bypassing a failure, or claim deployment. PR #33 remains draft and unmerged until final evidence is reviewed.**
