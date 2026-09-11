# Task 1 report — Sanctuary progression state, fixtures and v8 persistence

Status: DONE

## TDD evidence

- RED head: `6688d0713a9267603cb83b8e4cf8f9f2390be8b7`
- GitHub Actions `Game tests and JavaScript syntax`: **failure**, as expected because `src/chapter-progress-20260910-sanctuary.js` / v8 modules did not exist.
- GREEN head: `219f2ecb0bffe8fd2cef771e6d1f0f3dbaf71e5a`
- GitHub Actions `Game tests and JavaScript syntax`: **success**.

## Implemented

- Added immutable `worldProgress.chapters.sanctuary` state.
- Added fixed resonance/archive/origin-record ID allow-lists.
- Added resonance → archive → zero boundary → TRINITY → core-heart progression transitions.
- Added ORIGIN defeat receipt storage without selecting an ending.
- Added v8 progress key and v7→v8 migration while preserving older v1-v6 fallback paths.
- Added `endingTitle` with exact-title validation.
- Added shared sanctuary progress fixtures and focused v8 migration tests.

## Review

Spec compliance: ✅

Code quality: ✅

- Existing coast/volcano transition code was copied without semantic changes except the sanctuary completion guard and the new sanctuary terminal repair.
- New transitions are immutable/idempotent through the existing `transition()` normalizer pattern.
- Unknown/duplicate sanctuary IDs are discarded during normalization.
- `originDefeated` requires a valid non-empty receipt ID; repeat receipts cannot overwrite the first receipt.
- v7 records may omit `endingTitle`; migrated v8 progress normalizes it to `null`.
- Invalid non-null title strings are rejected on save.

## Ruling carried forward

Task 1 temporarily allow-lists `sanctuary-resonance-hall` plus the other future interior IDs inside chapter progress because canonical region/world registration belongs to Task 2. Task 2 must remove this transitional duplication by importing the `20260910-sanctuary` region registry and relying on the canonical sanctuary map list.
