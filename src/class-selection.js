import { getClassDefinition } from "./class-data.js";

export const CLASS_PREFERENCE_KEY = "pixelWorldClassId";

export function getBrowserStorage(globalObject = globalThis) {
  try {
    return globalObject?.localStorage ?? null;
  } catch {
    return null;
  }
}

function normalizedNickname(value) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, 12)
    : "";
}

export function readStoredClassId(storage) {
  try {
    const classId = storage?.getItem?.(CLASS_PREFERENCE_KEY);
    return getClassDefinition(classId)?.id || null;
  } catch {
    return null;
  }
}

export function storeClassId(storage, classId) {
  const definition = getClassDefinition(classId);
  if (!definition) return { ok: false };
  try {
    storage?.setItem?.(CLASS_PREFERENCE_KEY, definition.id);
    return typeof storage?.setItem === "function" ? { ok: true } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export function validateEntrySelection(nickname, classId) {
  const normalized = normalizedNickname(nickname);
  const length = Array.from(normalized).length;
  if (length < 1) return { ok: false, field: "nickname", error: "닉네임을 입력해 주세요." };
  if (length > 12) return { ok: false, field: "nickname", error: "닉네임은 12자 이내로 입력해 주세요." };
  if (/[<>\\/{}\[\]]/.test(normalized)) {
    return { ok: false, field: "nickname", error: "닉네임에 사용할 수 없는 문자가 포함되어 있습니다." };
  }
  const definition = getClassDefinition(classId);
  if (!definition) return { ok: false, field: "classId", error: "플레이할 직업을 선택해 주세요." };
  return { ok: true, nickname: normalized, classId: definition.id };
}

export function entryButtonLabel(classId) {
  const definition = getClassDefinition(classId);
  return definition ? `${definition.name}로 입장` : "직업을 선택해 주세요";
}
