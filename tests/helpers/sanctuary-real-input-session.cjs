function qaUrl(baseUrl, online) {
  return `${String(baseUrl).replace(/\/$/, "")}/?qa=1${online ? "&onlineFixture=1" : ""}`;
}

async function prepareSanctuaryCheckpoint({
  page,
  baseUrl,
  online,
  name,
  classId,
  full,
  expose,
}) {
  await expose(page);
  await page.goto(qaUrl(baseUrl, online), { waitUntil: "domcontentloaded" });
  await page.locator("#nicknameInput").waitFor({ state: "visible" });
  await page.evaluate(async ({ name, classId, full }) => {
    const { createInitialProgress } = await import("/src/quest-state-20260910-sanctuary.js");
    const { prepareWeaponQaProgress } = await import("/src/qa-mode-20260910-sanctuary.js");
    const fixtures = await import("/tests/helpers/sanctuary-fixtures.mjs");
    const { saveProgress } = await import("/src/progress-storage-20260910-sanctuary.js");
    let progress = prepareWeaponQaProgress(createInitialProgress(), classId);
    progress.introSeen = true;
    progress.inventory = { ...progress.inventory, hpPotion: 99, mpPotion: 99 };
    progress.redeemedCodeIds = location.search.includes("onlineFixture=1")
      ? ["TEACHER", "BOSSKILLBOSS"]
      : [];
    progress.worldProgress = full
      ? fixtures.sanctuaryUnlockedProgress()
      : fixtures.originReadyProgress({ originRecordIds: [
        "origin-record-single-authority",
        "origin-record-sealed-recovery",
      ] });
    if (!saveProgress(localStorage, name, progress).ok) throw Error("Cannot save checkpoint");
  }, { name, classId, full });
}

module.exports = { prepareSanctuaryCheckpoint };
