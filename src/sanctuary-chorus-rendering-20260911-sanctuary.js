const COLORS = Object.freeze({
  white: "#f8fafc",
  cyan: "#67e8f9",
  forest: "#4ade80",
  coast: "#38bdf8",
  volcano: "#fb923c",
  black: "#071018",
});

const PHASE_TEXT = Object.freeze({
  anchors: "기억 파편을 올바른 지역 기록 닻으로 운반하세요.",
  testimonies: "증언을 사실 · 일부 사실 · 근거 없음으로 판정하세요.",
  onslaught: "인물 기록을 활성화한 동안 검은 결속선을 끊으세요.",
  separated: "기억 분리 완료 · 남겨진 기억의 운명을 결정할 수 있습니다.",
});

function cameraPosition(camera) {
  return {
    x: Number.isFinite(camera?.x) ? camera.x : Number.isFinite(camera?.cameraX) ? camera.cameraX : 0,
    y: Number.isFinite(camera?.y) ? camera.y : Number.isFinite(camera?.cameraY) ? camera.cameraY : 0,
  };
}

function fragmentColor(id) {
  return COLORS[id] || COLORS.cyan;
}

function drawTelegraph(ctx, telegraph, camera) {
  const offset = cameraPosition(camera);
  ctx.save();
  ctx.fillStyle = `${telegraph.color || COLORS.cyan}44`;
  ctx.strokeStyle = telegraph.color || COLORS.cyan;
  ctx.lineWidth = 3;
  ctx.setLineDash?.([10, 8]);
  if (telegraph.shape === "rect") {
    ctx.fillRect(telegraph.x - offset.x, telegraph.y - offset.y, telegraph.width, telegraph.height);
    ctx.strokeRect?.(telegraph.x - offset.x, telegraph.y - offset.y, telegraph.width, telegraph.height);
  } else if (telegraph.shape === "circle") {
    ctx.beginPath();
    ctx.arc(telegraph.x - offset.x, telegraph.y - offset.y, telegraph.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (telegraph.shape === "cross") {
    ctx.fillRect(
      telegraph.x - telegraph.armWidth / 2 - offset.x,
      telegraph.y - telegraph.length / 2 - offset.y,
      telegraph.armWidth,
      telegraph.length,
    );
    ctx.fillRect(
      telegraph.x - telegraph.length / 2 - offset.x,
      telegraph.y - telegraph.armHeight / 2 - offset.y,
      telegraph.length,
      telegraph.armHeight,
    );
  }
  ctx.restore();
}

function drawBody(ctx, body, camera) {
  if (!body) return;
  const offset = cameraPosition(camera);
  const x = body.x - offset.x;
  const y = body.y - offset.y;
  ctx.save();
  ctx.fillStyle = "rgba(7,16,24,.82)";
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, body.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (const [index, color] of [COLORS.forest, COLORS.coast, COLORS.volcano].entries()) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 68 + index * 68, y + 65);
    ctx.lineTo(x - 100 + index * 100, y + 122);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAnchors(ctx, anchors, camera) {
  const offset = cameraPosition(camera);
  for (const anchor of anchors || []) {
    ctx.save();
    ctx.strokeStyle = anchor.color || fragmentColor(anchor.id);
    ctx.fillStyle = anchor.stabilized ? `${anchor.color || fragmentColor(anchor.id)}66` : "rgba(248,250,252,.08)";
    ctx.lineWidth = anchor.stabilized ? 5 : 3;
    ctx.beginPath();
    ctx.arc(anchor.x - offset.x, anchor.y - offset.y, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawBonds(ctx, bonds, camera) {
  const offset = cameraPosition(camera);
  for (const bond of bonds || []) {
    ctx.save();
    ctx.strokeStyle = bond.vulnerable ? COLORS.white : COLORS.black;
    ctx.lineWidth = bond.vulnerable ? 8 : 12;
    ctx.setLineDash?.(bond.vulnerable ? [12, 8] : []);
    ctx.beginPath();
    ctx.moveTo(bond.x1 - offset.x, bond.y1 - offset.y);
    ctx.lineTo(bond.x2 - offset.x, bond.y2 - offset.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFragments(ctx, fragments, camera) {
  const offset = cameraPosition(camera);
  for (const fragment of fragments || []) {
    ctx.save();
    ctx.fillStyle = fragmentColor(fragment.id);
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.fillRect(fragment.x - offset.x - 8, fragment.y - offset.y - 8, 16, 16);
    ctx.strokeRect?.(fragment.x - offset.x - 8, fragment.y - offset.y - 8, 16, 16);
    ctx.restore();
  }
}

export function drawSanctuaryOverlays(ctx, model, camera = {}, options = {}) {
  if (!ctx || !model?.active) return false;
  const layer = options.layer || "all";
  if ((layer === "all" || layer === "telegraph") && model.telegraph) drawTelegraph(ctx, model.telegraph, camera);
  if (layer === "telegraph") return true;
  drawAnchors(ctx, model.anchors, camera);
  drawBody(ctx, model.body, camera);
  drawBonds(ctx, model.bonds, camera);
  drawFragments(ctx, [...(model.fragments || []), ...(model.separatedFragments || [])], camera);
  return true;
}

function text(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}

function transform(element, ratio) {
  if (element?.style) element.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
}

export function updateChorusHud(elements, shared, personal, now = Date.now()) {
  const hud = elements?.chorusHud;
  if (!hud) return false;
  hud.hidden = !shared;
  if (!shared) return false;
  if (elements.coopBossHud) elements.coopBossHud.hidden = true;
  const hp = Math.max(0, Number(shared.hp) || 0);
  const maxHp = Math.max(1, Number(shared.maxHp) || 100);
  const contamination = Math.max(0, Math.min(100, Number(personal?.contamination) || 0));
  text(elements.chorusCohesionText, `${Math.ceil(hp)} / ${Math.ceil(maxHp)}`);
  text(elements.chorusContaminationText, `${Math.ceil(contamination)} / 100`);
  transform(elements.chorusCohesionBar, hp / maxHp);
  transform(elements.chorusContaminationBar, contamination / 100);
  const confused = Number(personal?.confusedUntil) > now;
  text(elements.chorusPhaseText, confused
    ? `기억 혼선 · ${Math.max(0, ((personal.confusedUntil - now) / 1000)).toFixed(1)}초`
    : PHASE_TEXT[shared.phase] || PHASE_TEXT.anchors);
  return true;
}
