function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export const CHORUS_BOSS_ID = "unnamed-chorus";
export const CHORUS_MAP_ID = "sanctuary-return-record";
export const CHORUS_MAX_HP = 100;
export const CHORUS_AUTHORITY_LEASE_MS = 5_000;
export const CHORUS_AUTHORITY_RENEW_MS = 2_000;
export const CHORUS_ACTION_TIME_TOLERANCE_MS = 5_000;
export const CHORUS_ACTION_ID_MAX_LENGTH = 160;
export const CHORUS_PROCESSED_ACTION_LIMIT = 256;
export const CHORUS_VULNERABLE_MS = 3_000;
export const CHORUS_CONFUSION_MS = 3_000;
export const CHORUS_CONTAMINATION_PER_MISTAKE = 10;

export const ANCHOR_IDS = freeze(["forest", "coast", "volcano"]);
export const TESTIMONY_VERDICTS = freeze(["fact", "partial", "unsupported"]);
export const CHORUS_TESTIMONIES = freeze([
  {
    id: "core-self-division-original",
    verdict: "fact",
    statement: "코어 자가분열 원본",
  },
  {
    id: "lumen-caused-core-division",
    verdict: "unsupported",
    statement: "루멘이 코어 분열을 일으켰다",
  },
  {
    id: "lumen-touched-seal-to-delay-eruption",
    verdict: "fact",
    statement: "루멘이 분화를 늦추기 위해 봉인을 건드렸다",
  },
  {
    id: "return-delay-was-lumen-alone",
    verdict: "unsupported",
    statement: "귀환 지연은 루멘 한 명의 책임이다",
  },
  {
    id: "first-archivist-deletion-protected-everyone",
    verdict: "partial",
    statement: "최초 기록관의 삭제는 모두를 보호했다",
  },
  {
    id: "resonance-time-was-incident-time",
    verdict: "unsupported",
    statement: "4시 13분 22초는 사건 시각이다",
  },
]);
export const TESTIMONY_IDS = freeze(CHORUS_TESTIMONIES.map(value => value.id));
export const TESTIMONY_VERDICT_BY_ID = freeze(Object.fromEntries(
  CHORUS_TESTIMONIES.map(value => [value.id, value.verdict]),
));

export const BOND_IDS = freeze(["roan", "sera", "garen", "lumen"]);
export const RECORD_IDS = BOND_IDS;
export const CHORUS_PATTERN_IDS = freeze(["forest-roots", "coast-tide", "volcano-rift"]);
export const CHORUS_PHASES = freeze(["anchors", "testimonies", "onslaught", "separated"]);
export const CHORUS_STATUSES = freeze(["active", "separated", "reforming"]);
export const CHORUS_CONTRIBUTION_TYPES = freeze([
  "fragment-strike",
  "anchor-stabilize",
  "testimony-resolve",
  "record-activate",
  "bond-cut",
  "lumen-assist",
]);
