export const TRINITY_BASE_HP = 800;

const TELEGRAPH_DURATION = 0.45;
const COOLDOWN_DURATION = 1.25;

function safeRatio(hp, maxHp) {
  const max = Number.isFinite(maxHp) && maxHp > 0 ? maxHp : TRINITY_BASE_HP;
  return Math.max(0, Math.min(1, (Number.isFinite(hp) ? hp : max) / max));
}

export function trinityPhaseForHp(hp, maxHp) {
  const ratio = safeRatio(hp, maxHp);
  if (ratio > 0.7) return "life";
  if (ratio > 0.4) return "memory";
  if (ratio > 0.2) return "energy";
  return "mixed";
}

export function createTrinityEncounter({ now = Date.now() } = {}) {
  return {
    id: "trinity",
    name: "삼상 수호체 TRINITY",
    hp: TRINITY_BASE_HP,
    maxHp: TRINITY_BASE_HP,
    phase: "life",
    x: 1080,
    y: 760,
    attackState: "idle",
    attackElapsed: 0,
    attackFamily: null,
    attackSequence: 0,
    defeated: false,
    defeatedAt: null,
    updatedAt: Number.isFinite(now) ? now : 0,
  };
}

function familyForPhase(phase, rng = Math.random) {
  if (phase !== "mixed") return phase;
  const roll = Math.max(0, Math.min(0.999999, Number(rng()) || 0));
  return ["life", "memory", "energy"][Math.floor(roll * 3)];
}

function damagingEvent(state, family, player) {
  const base = {
    bossId: state.id,
    sequence: state.attackSequence,
    targetUid: player?.uid,
    source: { x: state.x, y: state.y },
  };
  if (family === "memory") {
    return {
      ...base,
      type: "trinity-projectile",
      damage: 34,
      speed: 420,
      target: { x: player?.x ?? state.x, y: player?.y ?? state.y },
    };
  }
  if (family === "energy") {
    return {
      ...base,
      type: "trinity-eruption",
      damage: 40,
      radius: 120,
      target: { x: player?.x ?? state.x, y: player?.y ?? state.y },
    };
  }
  return {
    ...base,
    type: "damage-player",
    attackId: `${state.id}:life:${state.attackSequence}`,
    amount: 36,
  };
}

export function advanceTrinityEncounter(value, dt, context = {}) {
  const state = { ...value };
  const events = [];
  if (state.defeated || !(state.hp > 0)) return { state, events };

  state.phase = trinityPhaseForHp(state.hp, state.maxHp);
  let remaining = Math.max(0, Number.isFinite(dt) ? dt : 0);

  if (state.attackState === "idle") {
    state.attackFamily = familyForPhase(state.phase, context.rng);
    state.attackState = "telegraph";
    state.attackElapsed = 0;
    state.attackSequence = (state.attackSequence || 0) + 1;
    events.push({
      type: "trinity-telegraph",
      bossId: state.id,
      phase: state.phase,
      family: state.attackFamily,
      sequence: state.attackSequence,
      target: {
        x: context.player?.x ?? state.x,
        y: context.player?.y ?? state.y,
      },
    });
  }

  if (state.attackState === "telegraph" && remaining > 0) {
    const step = Math.min(remaining, Math.max(0, TELEGRAPH_DURATION - state.attackElapsed));
    state.attackElapsed += step;
    remaining -= step;
    if (state.attackElapsed >= TELEGRAPH_DURATION - 1e-9) {
      events.push(damagingEvent(state, state.attackFamily, context.player));
      state.attackState = "cooldown";
      state.attackElapsed = 0;
    }
  }

  if (state.attackState === "cooldown" && remaining > 0) {
    const step = Math.min(remaining, Math.max(0, COOLDOWN_DURATION - state.attackElapsed));
    state.attackElapsed += step;
    if (state.attackElapsed >= COOLDOWN_DURATION - 1e-9) {
      state.attackState = "idle";
      state.attackElapsed = 0;
      state.attackFamily = null;
    }
  }

  state.updatedAt = Number.isFinite(context.now) ? context.now : state.updatedAt;
  return { state, events };
}

export function applyTrinityDamage(value, damage, now = Date.now()) {
  const state = { ...value };
  const events = [];
  if (state.defeated || !(state.hp > 0) || !(damage > 0)) return { state, events };

  const previousHp = state.hp;
  state.hp = Math.max(0, Math.round((state.hp - damage) * 10) / 10);
  state.phase = trinityPhaseForHp(state.hp, state.maxHp);
  if (previousHp > 0 && state.hp === 0) {
    state.defeated = true;
    state.defeatedAt = Number.isFinite(now) ? now : 0;
    state.attackState = "idle";
    state.attackFamily = null;
    state.attackElapsed = 0;
    events.push({ type: "trinity-defeated", bossId: state.id, defeatedAt: state.defeatedAt });
  }
  return { state, events };
}

export function trinityEncounterCount() {
  return 1;
}
