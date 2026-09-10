from pathlib import Path

FILES = [
    "tests/browser-smoke.cjs",
    "tests/chat-game-smoke.cjs",
    "tests/coast-browser-smoke.cjs",
    "tests/volcano-browser-smoke.cjs",
    "tests/combat-growth-browser.cjs",
    "tests/reward-browser-smoke.cjs",
]

for filename in FILES:
    p = Path(filename)
    s = p.read_text(encoding="utf-8")
    s = s.replace("main-20260903-volcano-20260905-upgrade.js", "main-20260910-sanctuary.js")
    s = s.replace("game-20260903-volcano-20260905-upgrade.js", "game-20260910-sanctuary.js")
    s = s.replace("pixel-world.progress.v7:", "pixel-world.progress.v8:")
    s = s.replace("v7 progress checkpoint is missing", "v8 progress checkpoint is missing")
    s = s.replace("beforeReload.version, 7", "beforeReload.version, 8")
    s = s.replace("initial.version, 7", "initial.version, 8")

    # Any fresh browser nickname now sees the first journey. Explicitly dismiss it before
    # legacy smoke continues with its pre-existing interaction assertions.
    marker = 'await page.locator("#hud").waitFor({ state: "visible" });'
    if marker in s and 'firstJourneySkip' not in s:
        s = s.replace(marker, marker + '\n    if (await page.locator("#firstJourneySkip").isVisible()) await page.locator("#firstJourneySkip").click();', 1)
    marker2 = "await page.locator('#hud').waitFor({state:'visible'});"
    if marker2 in s and 'firstJourneySkip' not in s:
        s = s.replace(marker2, marker2 + "\n if(await page.locator('#firstJourneySkip').isVisible())await page.locator('#firstJourneySkip').click();", 1)
    p.write_text(s, encoding="utf-8")

# Reward smoke has additional fresh peer entries that also need the one-time intro dismissed.
p = Path("tests/reward-browser-smoke.cjs")
s = p.read_text(encoding="utf-8")
needle = "await peer.locator('#enterButton').click();await peer.locator('#hud').waitFor({state:'visible'});"
if needle in s and "peer.locator('#firstJourneySkip')" not in s:
    s = s.replace(needle, needle + "if(await peer.locator('#firstJourneySkip').isVisible())await peer.locator('#firstJourneySkip').click();")
p.write_text(s, encoding="utf-8")

# Coast room-full fallback also uses a fresh nickname and then checks online/solo state.
p = Path("tests/coast-browser-smoke.cjs")
s = p.read_text(encoding="utf-8")
needle = 'await page.locator("#hud").waitFor({ state: "visible" });\n  await page.waitForFunction('
if needle in s:
    s = s.replace(needle, 'await page.locator("#hud").waitFor({ state: "visible" });\n  if (await page.locator("#firstJourneySkip").isVisible()) await page.locator("#firstJourneySkip").click();\n  await page.waitForFunction(', 1)
p.write_text(s, encoding="utf-8")
