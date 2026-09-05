# Combat Growth Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Repair bidirectional boss combat and deliver approved progression, skills, guidance and entry codes.
**Architecture:** Existing vanilla ES modules and PixelRPG runtime; focused modules hold pure policies, runtime integrates them. Shared definitions validate local and online damage. Keep compatible saved progress.
**Tech Stack:** JavaScript modules, Canvas2D, Firebase RTDB, Node tests, Playwright.
**Spec:** docs/superpowers/specs/2026-09-05-combat-growth-rewards.md

## Global Constraints
- Warrior/archer level attack +2, mage +3; 2-second 2% max MP regen minimum 1.
- E level 5, R level 10; Q unchanged; TEACHER/BOSSKILLBOSS solo only.
- Exactly eight codes and numeric rewards from spec. JAEHOON damage 100/range 76.
- No new framework; existing saves readable; common online validation; real combat browser evidence.
- Main shared runtime files are edited only by the current task implementer. Commit explicit task files, no blanket staging. No agent creates subagents.

### Task 1: Boss combat lifecycle and player damage
**Files:** src/coop-boss-controller-20260903-volcano.js, src/local-boss-controller-20260903-volcano.js, src/enemies-20260829-coast.js as needed; new tests/boss-lifecycle-damage.test.mjs.
**Interfaces:** Existing update(dt,context,timestamp), receiveSnapshot(snapshot), consumeEvents(); context.player and remotePlayers. Preserve controller APIs for later triple-boss wrapper.
- [ ] Add failing real-state regression: same encounter/epoch authority receives snapshot after view cooldownRemaining=2.8 and attackSequence=7; assert those remain. New encounter must reset.
```js
controller.view.cooldownRemaining=2.8;
controller.receiveSnapshot({...controller.snapshot,updatedAt:500});
assert.equal(controller.view.cooldownRemaining,2.8);
```
- [ ] Add overlapping player/boss regression using real simulation. Forest/volcano must produce damage-player, repeated ticks within contact cooldown must not duplicate; online sends to correct UID. Invulnerability should be applied by existing game handler.
- [ ] Run `node --test tests/boss-lifecycle-damage.test.mjs` and record RED.
- [ ] Preserve authority view state on same encounter/epoch, reset only new ownership/encounter; add cooldown-bound contact events to each controller and route online target events through sendPlayerDamage. Distinguish teleport from ordinary interpolation without speed multiplication.
- [ ] Run focused boss tests, inspect event and timer invariants, commit explicit files.

### Task 2: Growth, damage, MP and six E/R skills
**Files:** src/player-progression.js, src/class-data.js, combat/projectile/network validation modules, new skill-data and skill-runtime modules, src/game-20260903-volcano.js, index.html/main/styles integration, focused tests.
**Interfaces:** attackDefinition(kind,classId,weaponId,level=1) yields damage including level bonus; new skill kinds supported for E/R and online validation. Stats return attack bonus plus maxHp/maxMp.
- [ ] RED tests assert statsForLevel(30,'warrior').attackBonus===58, mage===87; level affects real hit damage locally and validateBossAttack. Tick regen across 1.9+0.1s, death, maximum and reset.
- [ ] Implement shared level formula and increased weapon values preserving JAEHOON later, retune ordinary enemies only for actual low-hit-count problem. Update numerical expectations that represent superseded balance, preserve test semantics.
- [ ] RED tests for E/R level lock, MP affordability, cooldown, class delivery (dash/sequence/spread/area/slow/meteor), multi-hit IDs and online request validation.
- [ ] Implement six skills with real effects, cooldown HUD and keyboard E/R; area skills target a point forward of player, no mouse requirement. Damage multi-hits use unique attack sequence, all derive from shared definitions.
- [ ] Run affected progression/combat/network and whole suite; commit.

### Task 3: Quest notifications and exploration guidance
**Files:** focused quest notification module and guidance module, game/main/index/styles, tests/quest-guidance.test.mjs.
**Interfaces:** notification policy consumes old/new quest/chapter progress and returns title/body/reward/next; rendering is nonblocking DOM. Guidance consumes eligible story interactions and world/camera/minimap coordinates.
- [ ] RED test first objective shown once, completion shown once only after successful save, next objective included. Test target direction within/offscreen and completed filtering.
- [ ] Implement central dismissible banners with objective location and F/direction controls; keep right tracker; queue completion before next goal. Do not capture combat keys or pause only one client in online mode.
- [ ] Render readable record icon/name and minimap points with offscreen nearest eligible target arrow. Collected objects distinct.
- [ ] Run focused quest/guidance tests, browser visual check, commit.

### Task 4: Entry codes, persistent cosmetics, solo modifiers and final validation
**Files:** new reward-codes module, storage/equipment/weapon/network schema/class rendering, game/main/index/styles, new triple-boss controller wrapper, tests/reward-codes.test.mjs and browser integration tests.
**Interfaces:** previewRewardCode(code) and redeemRewardCodes(progress,codes) pure immutable functions; entry persists result before game enter. progress redeemedCodeIds/cosmetics/soloModifiers normalized. Triple wrapper preserves controller APIs, adds targetableBosses and per-boss hit selection.
- [ ] RED tests exact eight rewards, normalized/deduplicated inputs, nonlowering level, >99 potions, insufficient storage rollback, v7 roundtrip, two solo flags inactive online.
- [ ] Implement entry preview/apply UI; persist full transaction and never claim on storage failure. Cap expanded inventory safely and retain shop semantics.
- [ ] Add JAEHOON nontradeable warrior reward weapon damage100/range76 with actual inventory equip support. Render slime and pencil modes; share only slime cosmetic in online validated payload.
- [ ] RED real triple encounter: 3 bosses distinct IDs and safe spawns, hit routing targets selected boss; chapter/reward once only after third defeat; no triple online. TEACHER bypass all damage paths only solo.
- [ ] Implement solo wrapper and cosmetic/runtime integration, ensure normal boss mode unchanged.
- [ ] Update README with controls/codes/solo restriction/save limitation. Produce cache-safe module graph and update tests/imports. Run entire Node suite, syntax/diff, real browser entry codes, injury, growth/MP, skills, banners, triple and online normal combat. Commit only verified work; final review.
