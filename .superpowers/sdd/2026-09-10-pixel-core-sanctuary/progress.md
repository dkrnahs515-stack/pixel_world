# SDD ledger — plan: docs/superpowers/plans/2026-09-10-pixel-core-sanctuary.md

## Preflight interface scan

| Pair / Task | Shared file or interface | Finding |
|---|---|---|
| Task 1 → 2 | `unlockedMapIds`, sanctuary chapter state | Clean: Task 2 consumes Task 1 destination-unlock contract. |
| Task 1 → 3 | sanctuary transition APIs | Clean: story resolution depends on Task 1 immutable transitions. |
| Task 1 → 7 | `endingChoice`, `endingRewardClaimed`, `endingTitle` | Clean: Task 7 owns ending transitions; Task 1 owns persistence shape only. |
| Task 2 → 3 | sanctuary map IDs | Clean: story IDs map to the four new interior maps. |
| Task 2 → 9 | world registry/rendering | Clean: Task 9 consumes the 15-map registry. |
| Task 4 → 9 | TRINITY local state | Clean: never enters Firebase and remains one encounter. |
| Task 5 → 6 | ORIGIN state + shared validator | Clean: Task 6 owns network transport/authority, not attack semantics. |
| Task 5 → 9 | `tripleEligible:false` | Clean: protects ORIGIN from `BOSSKILLBOSS`. |
| Task 6 → 9 | zero-value ORIGIN reward claims | Clean: Task 9 converts them to local defeat receipts before acknowledgement. |
| Task 7 → 8 | ending IDs/titles | Clean: controller renders pure Task 7 choice model. |
| Task 7 → 9 | two-phase save contract | Clean: choice and reward markers are saved separately. |
| Task 8 → 9 | ending controller callbacks | Clean: Task 9 orchestrates; copy/timing stay isolated. |
| Task 9 → 10 | release entries / browser journey | Clean: Task 10 verifies exact versioned graph. |
| Task 10 → 11 | verification evidence | Clean: Task 11 requires fresh exact-head evidence before merge. |
| Task 1 | tests vs persistence implementation | Clean. |
| Task 2 | map count/geometry vs world definitions | Clean. |
| Task 3 | story gating vs optional records | Clean. |
| Task 4 | phase thresholds vs HP 800 | Clean. |
| Task 5 | ORIGIN phases/anchors vs generic boss state | Clean. |
| Task 6 | Firebase rules vs online state | Clean. |
| Task 7 | permanent ending vs retry-safe reward | Clean. |
| Task 8 | 30s credits / 5s skip / post-credit | Clean. |
| Task 9 | spectator recovery vs shared respawn | Clean. |
| Task 10 | cache graph / browser smoke | Clean. |
| Task 11 | PR / merge / deployed smoke | Clean. |

Ruling: this ChatGPT session does not expose an actual subagent-dispatch runtime. I will preserve the same isolation/review gates with one feature branch, task-scoped commits, CI-backed RED/GREEN evidence where local network prevents cloning, and explicit diff review between tasks. Cost if wrong: less context isolation than true fresh subagents, but no change to repository safety gates.

Ruling: Task 1 must persist `sanctuary-resonance-hall` before Task 2 formally adds that map to the region/world registry. Task 1 temporarily allowed the future map IDs; Task 2 replaced that with the canonical registry.

Task 1: complete (RED `6688d07` → GREEN `219f2ec`; report present; review clean).

Ruling: the approved Task 2 plan omitted a new portal-transition module, but the existing module statically imports the pre-sanctuary chapter-progress implementation. Added `portal-transition-20260910-sanctuary.js`.

Task 2: complete (RED `e23049d` → GREEN `c24124d`; report present; review clean).
Task 3: complete (RED `ae65256` → GREEN `cafe87a`; report present; review clean).
Task 4: complete (RED `7082e05` → GREEN `e818b27`; report present; review clean).
Task 5: complete (RED `b1361ee` → GREEN `9493bab`; report present; review clean).
Task 6: complete for its game/rules gates (RED `3c27ff2` → GREEN `2aca653`; Rules Emulator green; report present).
Task 7: complete (RED `be0362c` → GREEN `7b5c696`; report present; review clean).

Ruling: Task 8 initial controller test incorrectly treated an ending button click as final confirmation. The approved design requires a second confirmation. The contract was corrected to `requestChoice()` → `confirmChoice()` before implementation. Cost if wrong: one extra controller state and confirmation surface; without it an irreversible ending could be selected by a single accidental click.

Task 8: implementation present; one-shot HTML patch tooling removed; verification checkpoint triggered by this commit.
