# Task 2 report — combat growth and E/R skills

## Status
Implemented. Unit suite: **706/706 passing** (`node --test tests/*.test.mjs tests/*.test.cjs`). All `src/*.js` syntax checks passed; `git diff --check` clean. Chromium actual runtime test passed (`tests/combat-growth-browser.cjs`, local HTTP server port4175). Task1 boss contact/authority state fixes preserved. Root README/.gitignore and triple controller modules untouched.

## Contracts
- `attackDefinition(kind,classId,weaponId,level=1)` retains legacy omitted-level and weapon argument support. Active normal and Q attacks plus skill-e/skill-r derive damage from the same active weapon catalog and class level bonus. `statsForLevel` now returns `attackBonus`, `maxHp`, `maxMp`; class stats expose `attackPerLevel` (warrior/archer2, mage3).
- `skill-data.js`: `SKILLS`, `skillDefinition`. Multipliers apply to (weapon base damage + attackBonus). `skill-runtime.js`: `tickManaRegen(player,dt)`, `skillAvailability`, `createSkillCast`, `advanceSkillCast`. Cast hits have immutable `castId` and distinct `hitIndex`/ID. `player.manaRegenElapsed` resets on entry/reset/respawn/death; fixed simulation increments 2% maxMP/min1 every2s.
- Skill definitions: E5 / R10; Q controls and behavior unchanged.

| Class | Key/name | MP | Cooldown | Damage | Delivery |
|---|---|---:|---:|---|---|
| Warrior | E 돌진 베기 |18|5s|1.8×1|90px collision-limited dash;100px forward slash|
| Warrior | R 연속 검격 |32|9s|1.1×4|120px forward slashes at .12/.30/.48/.66s|
| Archer | E 세 갈래 화살 |20|5s|1×3|440px arrows, angles −.22/0/+.22 radians|
| Archer | R 화살비 |36|10s|.9×5|220px forward area, radius110, .4/.65/.9/1.15/1.4s|
| Mage | E 빙결탄 |22|6s|1.6×1|380px ice bolt,50% movement slow2s|
| Mage | R 운석 낙하 |42|12s|4×1|210px forward telegraph, radius130, impact .8s|

- HUD E/R slots show damage/hit count, MP, configured cooldown, locked level and active cooldown overlay. Touch buttons and keyboard work. Area targets are fixed forward points; no mouse targeting required. Level-up notices show actual attack/HP/MP deltas.
- Boss controllers `requestHit` accept `castId,hitIndex` in addition to legacy fields. Runtime now uses `targetableBosses()` plural with singular fallback and passes `targetId` for every boss request, compatible with root triple wrapper. Root still integrates plural boss rendering.
- Local/online boss validation derives level **from player presence**, rejects invalid levels, locks, unaffordable initial casts, invalid hit indices, duplicate hits, stale casts, changed class/weapon/level within cast and per-kind cooldown violations. Controllers keep per-kind cast ledgers; sequence rejection remains. Mage slow applies to authority/local boss AI.
- Presence now includes bounded `level`, `mp`, and `skillResources` (per-kind `{castId,mpBefore}`) so casts paid before projectile impact still validate when MP reaches zero. This is validated presence context, not attack-request-supplied damage or level. Publication signature includes level/HP/MP/cast IDs, allowing immediate updates while stationary.
- Database rules admit skill kinds with bounded cast IDs, integer hit index, required presence level and bounded level/MP fields. Root plans actual emulator validation and deployed rules update. The architecture remains peer authority with client-owned progress/presence, matching existing project trust model; not a server-authoritative economy.

## Final balance
Active ordinary/shop/hidden weapon damage ×4; warrior starter4, archer starter3.6, mage starter4. JAEHOON **100/range76**, not multiplied. Ordinary enemies HP×4, including split child20/12. Boss solo base HP **coast300 / volcano450 / forest600** (old120/160/200); party multiplier unchanged. Level30 warrior starter62 damage vs old1; forest is ~10 basic hits instead of200. Ordinary starter forest slimes16HP retain four starter hits. Existing class/progression/balance fixtures updated numerically; no weakened behavior assertions. Legacy versioned modules/catalog remain untouched for existing consumers.

## TDD and browser evidence
- RED missing skill module, then GREEN growth/regen/unlock/mana/cooldown/multi-hit tests.
- RED skill boss validation rejecting valid new kinds, then GREEN shared level damage, duplicate/range/cast checks.
- Local boss four-hit R test:96.8 damage once per hit; same-cast duplicate rejected; basic cooldown independent.
- Actual Chromium runtime, Lv10 starter weapons and exact skill MP: warrior E39.6 damage with90px dash, R96.8; archer E64.8, R97 (existing tenth-HP rounding each pulse); mage E49.6 and2s slow, R124. All left0MP. Regen0 at1.9s and4.06 at2s for mage max203. No page errors. Browser script tests existing instantiated game via test-only route instrumentation, not a separate game implementation.
- Full suite 706/706; full source syntax pass; diff whitespace clean.

## Remaining integration owned by root
Cache graph/version rename; triple controller and cosmetics hookup; quest guidance task; final viewport screenshots and Firebase rules emulator/deploy. Browser test currently matches main-20260903-volcano.js and imports active dated modules; include it in final cache-reference update if filenames change. Root may choose further visual refinement of meteor/rain presentation; combat effects are implemented.
