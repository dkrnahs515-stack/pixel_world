export const PLAY_MODES = Object.freeze(["solo", "online"]);
export const DEFAULT_PLAY_MODE = "solo";
export const PLAY_MODE_PREFERENCE_KEY = "pixel_world_play_mode";

export function normalizePlayMode(value) {
  return PLAY_MODES.includes(value) ? value : DEFAULT_PLAY_MODE;
}

export function readStoredPlayMode(storage) {
  try {
    return normalizePlayMode(storage?.getItem?.(PLAY_MODE_PREFERENCE_KEY));
  } catch {
    return DEFAULT_PLAY_MODE;
  }
}

export function storePlayMode(storage, value) {
  if (!PLAY_MODES.includes(value)) return false;
  try {
    if (typeof storage?.setItem !== "function") return false;
    storage.setItem(PLAY_MODE_PREFERENCE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function validatePlayMode(value) {
  return PLAY_MODES.includes(value)
    ? { ok: true, playMode: value }
    : { ok: false, field: "playMode", error: "플레이 모드를 선택해 주세요." };
}
