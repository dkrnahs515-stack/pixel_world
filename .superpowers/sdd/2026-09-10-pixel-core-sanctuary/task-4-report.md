# Task 4 report — Sanctuary enemies and personal TRINITY

Status: DONE

## TDD evidence
- RED head: `7082e05b0f29a218d3a3b61d5a18f83d39e46122` — Game tests failed as expected because sanctuary enemy/TRINITY modules were absent.
- GREEN head: `e818b27960ae244030f815b5a91073113856667b` — Game tests and JavaScript syntax succeeded.

## Implemented
- `defect-pixel`: telegraphed short dash.
- `core-sentinel`: telegraphed ranged core bolt event.
- `rewrite-echo`: telegraphed blink strike.
- `TRINITY`: personal/local HP 800 encounter with life/memory/energy/mixed thresholds.
- Positive→zero defeat emits exactly one `trinity-defeated` event.
- `trinityEncounterCount()` is fixed to 1, making `BOSSKILLBOSS` exclusion explicit.

## Review
Spec compliance: ✅
Code quality: ✅

The generic deployed enemy update loop has not yet been switched to the new behavior wrapper; that wiring belongs to Task 9 game integration. New sanctuary behavior functions and instance definitions are independently testable now, without changing current deployed-region semantics.
