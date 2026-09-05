# Combat, growth, guidance, skills and reward codes

Approved by user 2026-09-05: implement the proposed design; TEACHER and BOSSKILLBOSS solo only; exactly eight codes.

## Requirements
- Correct forest/volcano boss contact damage in solo and online; attack IDs and cooldowns prevent duplicate damage. Online snapshots must not reconstruct the current authority AI for the same encounter/epoch; preserve AI timers and sequence. Ordinary movement and teleport presentation must remain distinct.
- Increase ordinary/shop/hidden weapon damage; include level attack bonus: warrior/archer +2 per level after level 1, mage +3. Keep HP/MP class growth. Display actual growth deltas. Use common damage definitions for local combat and online validation; do not multiply special JAEHOON weapon damage 100. Retune enemy health where needed for several normal hits and a short, meaningful boss fight.
- Regenerate MP every 2 simulation seconds while alive, 2% maxMP (minimum 1), clamp max; reset timer on entry/respawn, no offline catch-up.
- Keep right quest tracker. Central first-entry/main-objective/quest-complete notifications show goal, location, controls, reward and next task. Avoid modal combat traps online; banners should not block input and be dismissible. No repeated notification each frame/reconnect for unchanged goals.
- Coast records: visible world marker, label, minimap marker, offscreen direction; collected status distinct; only eligible targets guide player.
- Keep Q. E unlocked level 5, R level 10. Warrior E dash slash, R repeated forward slashes; archer E three spread arrows, R repeated area arrow rain; mage E slowing ice bolt, R telegraphed meteor area. Show MP cost/cooldown/damage and locked levels. Use same multiplayer validation and effects; no fake network skills.
- Main entry screen reward code input with reward preview, whitespace/case normalization, per save profile one-time application and multiple code stacking. Preserve existing level if above grant. Save atomically before entry; storage failure must not claim code or duplicate inventory. Existing v7 saves stay readable. Potion capacity must allow 100+105 etc, not truncate at existing 99.
- JAEHOON: warrior weapon named 천상천하 유아독존, damage 100, basic range 76px. Grant ownership, never forced autoequip; no level lock so starter code usable.
- MINAH: level at least 100. KANGIN: 100 each HP/MP potions. JOOHYEONG: level at least 30 and 5,000,000 gold. NOISE: 5 each HP/MP potions. SLIME: persistent slime appearance, selected class combat intact and visible to peers.
- BOSSKILLBOSS: solo only, 3 concurrent bosses in each existing regional boss encounter; defeat all 3 for the chapter objective, no duplicate chapter/reward claim. Does not create a boss in every small nonboss map.
- TEACHER: solo only, immune to damage and pencil weapon appearance, keeping selected class attacks. Online entry disables solo-only effects with clear explanation, never transports invulnerability or triple bosses into shared rooms.
- Stable cache-safe entry/modules for changed code; no dependency/framework rewrite. Browser combat tests must observe real HP damage, player injury, events and persisted state.
