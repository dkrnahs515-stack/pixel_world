# Task 1 report: boss combat lifecycle and player damage

## Result

- Same-encounter, same-epoch snapshots for the current authority retain the live boss view object and its AI timers/attack sequence. A changed encounter or ownership still creates a fresh view.
- Contact-mode forest and volcano bosses now emit cooldown-bound `damage-player` events even though they are outside `game.enemies`.
- Local contact events use the existing controller event queue. Online authority events are converted through `createBossPlayerDamageEvent` and sent with `sendPlayerDamage` to the selected overlapping player's UID.
- Contact is checked before and after simulation. This covers a flame imp that teleports away during its update while preserving the existing movement/teleport simulation.
- Generic enemy regeneration cannot make boss HP diverge from encounter HP: both controllers restore view HP/max HP from the authoritative encounter after simulation.

## RED evidence

Command:

`node --test tests/boss-lifecycle-damage.test.mjs`

Before production changes: 4 tests, 0 passed, 4 failed. Failures showed authority snapshots replacing the view (`cooldownRemaining` 2.8 -> 0 and `attackSequence` 7 -> 0), no local forest/volcano contact event, and no online player-damage send.

## GREEN evidence

Focused command:

`node --test tests/boss-lifecycle-damage.test.mjs tests/enemies.test.mjs tests/enemy-behaviors.test.mjs tests/boss-controller-contract.test.mjs tests/coop-boss-load.test.mjs`

Result: 58 tests passed, 0 failed.

Full automated command:

`node --test tests/*.test.mjs tests/*.test.cjs`

Result: 690 tests passed, 0 failed. `git diff --check` also completed successfully.

## Changed files

- `src/coop-boss-controller-20260903-volcano.js`
- `src/local-boss-controller-20260903-volcano.js`
- `src/enemies-20260829-coast.js`
- `tests/boss-lifecycle-damage.test.mjs`
- `.superpowers/sdd/2026-09-05-combat-growth-rewards/task-1-report.md`

## Concerns

- The online controller intentionally consumes boss damage events and sends them over the existing target-specific network route, so they do not also appear in its local `consumeEvents()` result. This preserves the existing single-delivery contract.
- Ability-mode coast boss damage remains owned by its existing behavior events. The new helper is restricted to `contactMode === "contact"` to avoid duplicate coast damage.
- No shared game entry point, `main`, or `index` file was changed. Existing controller public APIs remain unchanged for later wrappers.

## Review follow-up

Two additional RED regressions reproduced the important review findings:

- Two players overlapping the online forest boss produced one send instead of two.
- After installing a new encounter, its first contact pulse was suppressed by the prior encounter's reused internal attack ID.

The online controller now evaluates contact against every live player in the current arena. Each event carries its collision target UID, while the nearest selected player remains the AI movement target. A single contact pulse starts the shared boss cooldown and emits one uniquely targeted event per overlapping player. Replacing the authority simulation view now also clears damage-event dedupe and player-damage sequence state.

Review GREEN command:

`node --test tests/boss-lifecycle-damage.test.mjs tests/enemies.test.mjs tests/enemy-behaviors.test.mjs tests/boss-controller-contract.test.mjs tests/coop-boss-load.test.mjs`

Result: 60 tests passed, 0 failed. A concurrent full-suite run reached an unrelated in-progress `reward-codes.test.mjs` failure (`previewRewardCode` was not yet exported); task 1 does not touch that module or test.
