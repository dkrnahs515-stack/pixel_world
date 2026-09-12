export function bindExperienceSelector({
  experienceOverlay,
  entryOverlay,
  rpgExperienceButton,
  returnToExperienceButton,
  nicknameInput,
}) {
  const requiredElements = {
    experienceOverlay,
    entryOverlay,
    rpgExperienceButton,
    returnToExperienceButton,
    nicknameInput,
  };

  for (const [name, element] of Object.entries(requiredElements)) {
    if (!element) {
      throw new TypeError(`bindExperienceSelector requires ${name}`);
    }
  }

  const openRpgRegistration = () => {
    experienceOverlay.hidden = true;
    entryOverlay.hidden = false;
    nicknameInput.focus();
  };
  const returnToExperienceSelector = () => {
    entryOverlay.hidden = true;
    experienceOverlay.hidden = false;
    rpgExperienceButton.focus();
  };

  rpgExperienceButton.addEventListener("click", openRpgRegistration);
  returnToExperienceButton.addEventListener("click", returnToExperienceSelector);

  return () => {
    rpgExperienceButton.removeEventListener("click", openRpgRegistration);
    returnToExperienceButton.removeEventListener("click", returnToExperienceSelector);
  };
}
