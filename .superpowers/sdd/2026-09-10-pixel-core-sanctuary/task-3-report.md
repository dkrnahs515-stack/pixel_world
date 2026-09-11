# Task 3 report — Sanctuary story interactions, truth records and guidance

Status: DONE

## TDD evidence

- RED head: `ae652562032ae8c18eaca723a9c9ac32500d19b0`
- `Game tests and JavaScript syntax`: **failure**, expected because sanctuary story/dialogue/guidance modules were absent.
- GREEN head: `cafe87a061c5a4e178b236c333991a03bbdbf638`
- `Game tests and JavaScript syntax`: **success**.

## Implemented

- Added three resonance interactions in the resonance hall.
- Added three required archive truths, enforced in order.
- Added three optional origin records with exact resonance-ending principles.
- Extended unified story dispatcher while preserving coast/volcano state.
- Added captain rescued/lost presentation branches and sera/echo/mari perspective lines without changing progression actions.
- Added sanctuary objective priority and explicit `결정 보류 가능 · 원점 기록 n/3` guidance after ORIGIN defeat.
- Extended story markers to understand sanctuary completion arrays.

## Review

Spec compliance: ✅
Code quality: ✅

- Optional origin records do not unlock required maps and therefore cannot block core-heart access.
- Required archive sequencing is enforced independently of optional records.
- Captain/support choices alter copy only; progression result/action shape remains unchanged.
- Coast resolution merges preserve volcano and sanctuary chapters exactly.
- Guidance targets the first missing origin record after ORIGIN defeat so backtracking remains actionable.
