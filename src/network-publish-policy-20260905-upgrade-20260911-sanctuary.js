const MOVEMENT_INTERVAL_MS = 500;
const HEARTBEAT_INTERVAL_MS = 30_000;

export function createPublishPolicyState() {
  return Object.freeze({ lastPublishedAt: null, signature: null });
}

function stateSignature(snapshot) {
  return [
    snapshot?.dir,
    Boolean(snapshot?.moving),
    snapshot?.mapId,
    snapshot?.classId,
    snapshot?.equippedWeaponId,
    snapshot?.level,
    snapshot?.hp,
    snapshot?.mp,
    snapshot?.skillResources?.["skill-e"]?.castId,
    snapshot?.skillResources?.["skill-r"]?.castId,
  ].join("|");
}

export function nextPublishDecision(policy, snapshot, now, visible = true) {
  const current = policy && typeof policy === "object" ? policy : createPublishPolicyState();
  const timestamp = Number.isFinite(now) ? now : 0;
  if (!visible) return { shouldPublish: false, reason: "hidden", policy: current };

  const signature = stateSignature(snapshot);
  const first = current.lastPublishedAt === null;
  const changed = !first && current.signature !== signature;
  const elapsed = first ? Infinity : Math.max(0, timestamp - current.lastPublishedAt);
  const interval = snapshot?.moving ? MOVEMENT_INTERVAL_MS : HEARTBEAT_INTERVAL_MS;
  const shouldPublish = first || changed || elapsed >= interval;
  if (!shouldPublish) return { shouldPublish: false, reason: "throttled", policy: current };

  return {
    shouldPublish: true,
    reason: first ? "initial" : changed ? "state_changed" : snapshot?.moving ? "movement" : "heartbeat",
    policy: Object.freeze({ lastPublishedAt: timestamp, signature }),
  };
}
