# Task 8 report — Ending scripts, confirmation UI, credits and post-credit

Status: DONE

## TDD evidence
- RED head: `9277acf195d8ba0d39f646407455fe2f736631f0` — Game tests failed as expected before ending script/controller/UI existed.
- GREEN verification head: `54405f4371d69f50f8fbc838c9e02cad0f0dbe39` — `Game tests and JavaScript syntax` succeeded with the generated ending markup present.

## Implemented
- Structured approved restore/seal/resonate scripts and branch-specific captain/support cameos.
- Exact ending titles and reward titles.
- Exact two post-credit lines.
- `SanctuaryEndingController` with choice, second confirmation, defer, credits, skip and post-credit lifecycle.
- Credits exactly 30,000ms; skip rejected before 5,000ms and accepted at/after 5,000ms.
- Natural completion and skip both pass through post-credit before completion callback.
- Accessible ending choice/confirmation/credits markup added to `index.html`.
- `styles-20260910-sanctuary.css` extends the current production stylesheet.
- One-shot HTML patch workflow/script removed after generating the actual markup.

## Review
Spec compliance: ✅
Code quality: ✅

Ruling: initial test expected one-click ending confirmation, contradicting the approved irreversible two-step confirmation. Corrected test before implementation to `requestChoice()` → `confirmChoice()`.
