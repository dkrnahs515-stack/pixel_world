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

function drawStation(ctx, station, camera, label, options = {}) {
  const offset = cameraPosition(camera);
  const x = station.x - offset.x;
  const y = station.y - offset.y;
  ctx.save();
  ctx.fillStyle = options.fill || "rgba(7,16,24,.84)";
  ctx.strokeStyle = options.color || COLORS.cyan;
  ctx.lineWidth = options.active ? 5 : 3;
  ctx.beginPath();
  ctx.arc(x, y, options.radius || 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = options.textColor || COLORS.white;
  ctx.font = options.active ? "900 15px sans-serif" : "800 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y);
  ctx.restore();
}

function drawTestimonyStations(ctx, testimony, stations, camera) {
  if (!testimony || !stations?.length) return;
  const offset = cameraPosition(camera);
  const x = CHORUS_TEXT_CENTER.x - offset.x;
  const y = CHORUS_TEXT_CENTER.y - offset.y;
  ctx.save();
  ctx.fillStyle = "rgba(7,16,24,.9)";
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 3;
  ctx.fillRect(x - 280, y - 38, 560, 76);
  ctx.strokeRect?.(x - 280, y - 38, 560, 76);
  ctx.fillStyle = COLORS.cyan;
  ctx.font = "800 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("현재 증언", x, y - 13);
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 17px sans-serif";
  ctx.fillText(testimony.statement, x, y + 14);
  ctx.restore();
  for (const station of stations) {
    drawStation(ctx, station, camera, `F · ${station.name}`, {
      color: station.verdict === "fact"
        ? COLORS.forest
        : station.verdict === "partial"
          ? COLORS.coast
          : COLORS.volcano,
    });
  }
}

function drawRecordStations(ctx, model, camera) {
  if (model.shared?.phase !== "onslaught") return;
  const severed = new Set(model.shared.severedBondIds || []);
  const activeRecordId = model.shared.activeRecordId;
  const availableRecordId = activeRecordId
    ? null
    : (model.recordStations || []).find(station => !severed.has(station.id))?.id;
  for (const station of model.recordStations || []) {
    if (severed.has(station.id)) continue;
    const active = station.id === activeRecordId;
    const available = station.id === availableRecordId;
    drawStation(ctx, station, camera,
      active ? `활성 중 · ${station.name}` : available ? `F · ${station.name} 활성화` : `대기 · ${station.name}`,
      {
        active,
        color: active ? COLORS.white : available ? COLORS.cyan : "#64748b",
        textColor: active || available ? COLORS.white : "#cbd5e1",
      });
  }
}

function drawLumenBranch(ctx, model, camera) {
  const lumen = model.branch?.lumen;
  if (!lumen || model.shared?.status !== "active") return;
  const offset = cameraPosition(camera);
  const x = 1080 - offset.x;
  const y = 1460 - offset.y;
  ctx.save();
  ctx.textAlign = "center";
  if (lumen.mode === "live-voice") {
    ctx.fillStyle = "rgba(103,232,249,.18)";
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.white;
    ctx.font = "800 13px sans-serif";
    ctx.fillText("루멘 · 생존 통신", x, y + 58);
    if (model.lumenAssist) ctx.fillText(model.lumenAssist.prompt, x, y + 78);
  } else {
    ctx.fillStyle = "rgba(248,250,252,.1)";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.fillRect(x - 76, y - 26, 64, 52);
    ctx.strokeRect?.(x - 76, y - 26, 64, 52);
    ctx.fillStyle = "rgba(103,232,249,.16)";
    ctx.beginPath();
    ctx.arc(x + 42, y, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "800 13px sans-serif";
    ctx.fillText("미전송 명령서 · 잔류 기억", x, y + 58);
  }
  ctx.restore();
}

function drawAttackPresentation(ctx, presentation, camera, now) {
  if (!presentation || !Number.isFinite(presentation.createdAt) || now - presentation.createdAt > 420) return;
  const offset = cameraPosition(camera);
  const x = presentation.x - offset.x;
  const y = presentation.y - offset.y;
  ctx.save();
  ctx.strokeStyle = COLORS.white;
  ctx.fillStyle = COLORS.cyan;
  ctx.lineWidth = 4;
  if (presentation.presentationId === "warrior-sever") {
    ctx.beginPath();
    ctx.moveTo(x - 30, y + 24);
    ctx.lineTo(x + 30, y - 24);
    ctx.stroke();
  } else if (presentation.presentationId === "archer-pin") {
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(x - 3, y - 30, 6, 60);
  } else if (presentation.presentationId === "mage-dispel") {
    ctx.setLineDash?.([6, 5]);
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSeparatedMessage(ctx, model, options) {
  if (!model.separated || !model.message) return;
  const width = Number.isFinite(options.viewWidth) ? options.viewWidth : finiteDimension(ctx.canvas?.width, 800);
  const height = Number.isFinite(options.viewHeight) ? options.viewHeight : finiteDimension(ctx.canvas?.height, 600);
  const panelWidth = Math.min(680, Math.max(320, width - 32));
  const centerX = width / 2;
  const top = width <= 520
    ? Math.min(Math.max(220, height * 0.29), Math.max(220, height - 262))
    : Math.max(84, height * 0.16);
  const lines = model.message.split("\n");
  ctx.save();
  ctx.fillStyle = "rgba(7,16,24,.94)";
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 3;
  ctx.fillRect(centerX - panelWidth / 2, top, panelWidth, 148);
  ctx.strokeRect?.(centerX - panelWidth / 2, top, panelWidth, 148);
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.cyan;
  ctx.font = "900 18px sans-serif";
  ctx.fillText(model.statusLabel || "기억 분리 완료", centerX, top + 30);
  ctx.fillStyle = COLORS.white;
  ctx.font = "800 14px sans-serif";
  lines.forEach((line, index) => ctx.fillText(line, centerX, top + 62 + index * 25));
  ctx.restore();
}

const CHORUS_TEXT_CENTER = Object.freeze({ x: 1080, y: 990 });

function finiteDimension(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function drawSanctuaryOverlays(ctx, model, camera = {}, options = {}) {
  if (!ctx || !model?.active) return false;
  const layer = options.layer || "all";
  if ((layer === "all" || layer === "telegraph") && model.telegraph) drawTelegraph(ctx, model.telegraph, camera);
  if (layer === "telegraph") return true;
  drawAnchors(ctx, model.anchors, camera);
  drawTestimonyStations(ctx, model.testimony, model.verdictStations, camera);
  drawRecordStations(ctx, model, camera);
  drawLumenBranch(ctx, model, camera);
  drawBody(ctx, model.body, camera);
  drawBonds(ctx, model.bonds, camera);
  drawAttackPresentation(ctx, model.attackPresentation, camera, Number.isFinite(options.now) ? options.now : Date.now());
  drawFragments(ctx, [...(model.fragments || []), ...(model.separatedFragments || [])], camera);
  drawSeparatedMessage(ctx, model, options);
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
  const separated = shared?.phase === "separated" || shared?.status === "separated" || shared?.status === "reforming";
  hud.hidden = !shared || separated;
  if (elements.questTracker) elements.questTracker.hidden = separated;
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
