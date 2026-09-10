# Task 6 report — ORIGIN AI, authority/network transport and Firebase rules

Status: DONE for Task 6 gates; full browser finale journey remains Task 10.

## TDD evidence
- RED head: `3c27ff2c21d90df236361486654abedd1db3b69a` — expected failure before ORIGIN authority/controller/network/rules support existed.
- GREEN head: `2aca653059909f8a52adcda31ac36b2def19ce7f`.
- `Game tests and JavaScript syntax`: **success**.
- `Realtime Database emulator rules`: **success**.

## Implemented
- ORIGIN authority acquire/renew preserves HP, phase, anchors and rewrite cycle.
- Deterministic ORIGIN authority simulation with telegraph-first life/memory/energy/rewrite events.
- Rewrite entry creates exactly three fixed anchors.
- Added four sanctuary interiors to online presence serialization.
- Added a sanctuary-aware network adapter and shared-boss network transport.
- Existing public boss hierarchy `rooms/public/bosses/{mapId}` is retained.
- ORIGIN encounter creation dispatches to final-boss state; existing regional bosses retain old encounter state implementation.
- Firebase rules whitelist new map IDs, validate ORIGIN boss ID/phase/anchor IDs and allow zero-value ORIGIN defeat receipts.
- One-shot rules generation workflow/script were removed; only resulting `database.rules.json` remains.

## Review
Spec compliance: ✅
Rules emulator regression: ✅
Code quality: ✅

The ORIGIN-specific state normalizer owns final-boss fields rather than weakening the legacy regional normalizer. Firebase state creation does not require an `anchors` object before rewrite phase because RTDB drops empty objects; individual anchors are strictly validated once present.
