# Task 7 report — Permanent sanctuary endings and rewards

Status: DONE

## TDD evidence
- RED head: `be0362c4b59ca49c96e1fe0f11c017002110a270` — Game tests failed as expected before the ending state module existed.
- GREEN head: `7b5c6968e2b1b678646e9e74e9d5e5837c57c064` — `Game tests and JavaScript syntax` succeeded.

## Implemented
- Exact ending IDs: `restore`, `seal`, `resonate`.
- Exact titles: `세계의 복원자`, `코어의 수호자`, `세계의 공명자`.
- Restore/seal unlock after local ORIGIN defeat; resonate additionally requires all 3 origin records.
- First confirmed ending is permanent per nickname progress.
- Ending reward uses existing level-up reward helper and grants exactly EXP 500 + Gold 1000.
- Reward sets title, `endingRewardClaimed`, `chapterCompleted`, and completes the sanctuary region.
- A second reward attempt is an idempotent no-op.

## Review
Spec compliance: ✅
Code quality: ✅

Persistence transaction ordering is intentionally not embedded in the pure ending module; Task 9 game orchestration will save ending choice before cutscene, then save reward/title as a separate retryable write so storage failures cannot duplicate currency/EXP.
