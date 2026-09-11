# Task 5 report — Shared boss validator and ORIGIN state

Status: DONE

## TDD evidence
- RED head: `b1361eef1832cd6276b81758daf099cd9e034c5f` — Game tests failed as expected before the new shared validator/ORIGIN modules existed.
- GREEN head: `9493baba91ca8f4d23fec9a072a8e4a6386e93da` — Game tests and JavaScript syntax succeeded.

## Implemented
- Added `boss-attack-validation-20260910-sanctuary.js` with the existing player-to-boss security checks.
- Regional `validateBossAttack()` delegates to the shared validator.
- Added ORIGIN shared boss definition (`origin-zero`, base HP 1200, final, tripleEligible false).
- Added ORIGIN four-phase normalization and exact three anchor IDs.
- Active rewrite anchors prevent lethal damage below 1 HP.
- After all anchors are inactive, ORIGIN can cross positive→zero exactly once.

## Review
Spec compliance: ✅
Code quality: ✅

The regional valid-attack fixture returns exactly the same result from the legacy and extracted validators. ORIGIN uses a separate state normalizer so the existing regional encounter normalizer does not need risky behavior changes in this task.
