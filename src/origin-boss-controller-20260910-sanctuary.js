import { createOriginAnchors, normalizeOriginEncounter, originPhaseForHp } from "./origin-boss-state-20260910-sanctuary.js";

const WARNING_SECONDS = 0.8;
const RECOVERY_SECONDS = 1.2;

function activePlayers(context, mapId) {
  return (context.players || []).filter(player => player && player.alive !== false
    && (player.hp === undefined || player.hp > 0) && !(player.respawnTimer > 0)
    && (!player.mapId || player.mapId === mapId) && typeof player.uid === "string"
    && Number.isFinite(player.x) && Number.isFinite(player.y)
    && player.x >= 0 && player.x <= 2160 && player.y >= 0 && player.y <= 1800);
}

function makeWarning(encounter, target) {
  const kind = encounter.originPhase;
  return {
    kind, sourceX: encounter.x, sourceY: encounter.y,
    targetX: kind === "life" ? encounter.x : target.x,
    targetY: kind === "life" ? encounter.y : target.y,
    radius: {life: 90, memory: 24, energy: 130, rewrite: 145}[kind],
  };
}

function hitsWarning(attack, player) {
  const radius = 14;
  if (attack.kind !== "memory") {
    return Math.hypot(player.x - attack.targetX, player.y - attack.targetY) <= attack.radius + radius;
  }
  // The entire beam path is previewed, not a homing hit on the selected UID.
  const dx = attack.targetX - attack.sourceX, dy = attack.targetY - attack.sourceY;
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1,
    ((player.x - attack.sourceX) * dx + (player.y - attack.sourceY) * dy) / length2)) : 0;
  return Math.hypot(player.x - attack.sourceX - t * dx, player.y - attack.sourceY - t * dy) <= attack.radius + radius;
}

export function advanceOriginAuthorityState(value, dt, context = {}) {
  const normalized = normalizeOriginEncounter(value);
  if (!normalized || normalized.status !== "alive") return { encounter: normalized || value, events: [] };
  const encounter = { ...normalized,
    anchors: Object.fromEntries(Object.entries(normalized.anchors).map(([id,a]) => [id,{...a}])),
    rewriteCycle: { ...normalized.rewriteCycle },
  };
  const events = [];
  const players = activePlayers(context, encounter.mapId);
  const target = players.find(p => p.uid === encounter.targetUid)
    || [...players].sort((a,b) => Math.hypot(a.x-encounter.x,a.y-encounter.y)-Math.hypot(b.x-encounter.x,b.y-encounter.y))[0];
  encounter.targetUid = target?.uid ?? null;
  encounter.originPhase = originPhaseForHp(encounter.hp, encounter.maxHp);
  encounter.phase = {life:1,memory:2,energy:3,rewrite:4}[encounter.originPhase];
  if (encounter.originPhase === "rewrite" && Object.keys(encounter.anchors).length === 0) encounter.anchors = createOriginAnchors();

  // Old mid-warning snapshots do not contain geometry: issue a fresh warning,
  // never invent an already elapsed attack at the reconnecting player's position.
  if (["warning", "impact"].includes(encounter.rewriteCycle.phase) && !encounter.rewriteCycle.attack) {
    encounter.rewriteCycle = {phase:"idle",elapsed:0,sequence:encounter.rewriteCycle.sequence};
  }
  let remaining = Math.min(1, Math.max(0, Number.isFinite(dt) ? dt : 0));
  if (encounter.rewriteCycle.phase === "idle" && target) {
    encounter.rewriteCycle = {phase:"warning",elapsed:0,sequence:encounter.rewriteCycle.sequence+1,
      attack:makeWarning(encounter,target)};
    events.push({type:encounter.originPhase === "rewrite" ? "rewrite-warning" : "origin-telegraph",
      bossId:encounter.bossId,encounterId:encounter.encounterId,sequence:encounter.rewriteCycle.sequence,
      target:{x:encounter.rewriteCycle.attack.targetX,y:encounter.rewriteCycle.attack.targetY}});
  }
  if (encounter.rewriteCycle.phase === "warning" && remaining > 0) {
    const step = Math.min(remaining, Math.max(0, WARNING_SECONDS-encounter.rewriteCycle.elapsed));
    encounter.rewriteCycle.elapsed += step; remaining -= step;
    if (encounter.rewriteCycle.elapsed >= WARNING_SECONDS-1e-9) {
      const attack=encounter.rewriteCycle.attack;
      const type={life:"origin-player-damage",memory:"origin-projectile",energy:"origin-eruption",rewrite:"rewrite-impact"}[attack.kind];
      for (const player of players.filter(p => hitsWarning(attack,p))) {
        events.push({type,bossId:encounter.bossId,encounterId:encounter.encounterId,
          authorityEpoch:encounter.authorityEpoch,sequence:encounter.rewriteCycle.sequence,
          targetUid:player.uid,damage:{life:34,memory:36,energy:42,rewrite:48}[attack.kind],
          radius:attack.radius,target:{x:attack.targetX,y:attack.targetY},
          source:{x:attack.sourceX,y:attack.sourceY}});
      }
      encounter.rewriteCycle={...encounter.rewriteCycle,phase:"recovery",elapsed:0};
    }
  }
  if (encounter.rewriteCycle.phase === "recovery" && remaining > 0) {
    encounter.rewriteCycle.elapsed += Math.min(remaining, Math.max(0,RECOVERY_SECONDS-encounter.rewriteCycle.elapsed));
    if (encounter.rewriteCycle.elapsed >= RECOVERY_SECONDS-1e-9) {
      encounter.rewriteCycle={phase:"idle",elapsed:0,sequence:encounter.rewriteCycle.sequence};
    }
  }
  encounter.updatedAt=Number.isFinite(context.now)?context.now:encounter.updatedAt;
  return {encounter,events};
}

export function drawOriginMechanics(ctx, encounter, cameraX, cameraY) {
  if (!encounter || encounter.bossId !== "origin-zero" || encounter.status !== "alive") return;
  ctx.save();
  const cycle=encounter.rewriteCycle, attack=cycle?.attack;
  if (attack && cycle.phase === "warning") {
    ctx.strokeStyle="#ffb74d"; ctx.fillStyle="rgba(255,120,50,.18)"; ctx.lineWidth=3;
    ctx.beginPath();
    if (attack.kind === "memory") {
      ctx.lineWidth=attack.radius*2;
      ctx.moveTo(attack.sourceX-cameraX,attack.sourceY-cameraY);
      ctx.lineTo(attack.targetX-cameraX,attack.targetY-cameraY);
      ctx.globalAlpha=.45;ctx.stroke();ctx.globalAlpha=1;
    } else {
      ctx.arc(attack.targetX-cameraX,attack.targetY-cameraY,attack.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
  }
  for (const [id,a] of Object.entries(encounter.anchors || {})) {
    if (!a.active || !(a.hp>0)) continue;
    const x=a.x-cameraX,y=a.y-cameraY;
    ctx.fillStyle="#b4f3ff";ctx.fillRect(x-16,y-20,32,40);
    ctx.strokeStyle="#ffffff";ctx.lineWidth=2;ctx.strokeRect(x-24,y-24,48,48);
    ctx.fillStyle="#192536";ctx.fillRect(x-28,y-34,56,6);
    ctx.fillStyle="#76deab";ctx.fillRect(x-28,y-34,56*a.hp/a.maxHp,6);
    ctx.fillStyle="#ffffff";ctx.font="12px sans-serif";ctx.textAlign="center";
    ctx.fillText(id.replace("origin-anchor-","앵커 · "),x,y-42);
  }
  ctx.restore();
}
