import test from "node:test";
import assert from "node:assert/strict";
import { attackDefinition } from "../src/combat.js";
import { createEnemyInstance, drawEnemy } from "../src/enemies.js";
import * as gameModule from "../src/game-20260828-classes.js";

function recordingContext() {
  const fills = [];
  const arcs = [];
  const texts = [];
  const scaleCalls = [];
  const alphaCalls = [];
  const stack = [];
  let fillStyle = "#000000";
  let strokeStyle = "#000000";
  let globalAlpha = 1;
  let transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const project = (x, y) => ({
    x: transform.a * x + transform.c * y + transform.e,
    y: transform.b * x + transform.d * y + transform.f,
  });
  return {
    fills,
    arcs,
    texts,
    scaleCalls,
    alphaCalls,
    colors: () => fills.map(fill => fill.color),
    save() { stack.push({ fillStyle, strokeStyle, globalAlpha, transform: { ...transform } }); },
    restore() {
      const saved = stack.pop();
      if (saved) ({ fillStyle, strokeStyle, globalAlpha, transform } = saved);
    },
    translate(x, y) {
      transform.e += transform.a * x + transform.c * y;
      transform.f += transform.b * x + transform.d * y;
    },
    rotate(angle) {
      const { a, b, c, d } = transform;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      transform.a = a * cosine + c * sine;
      transform.b = b * cosine + d * sine;
      transform.c = c * cosine - a * sine;
      transform.d = d * cosine - b * sine;
    },
    scale(x, y) {
      scaleCalls.push({ x, y });
      transform.a *= x;
      transform.b *= x;
      transform.c *= y;
      transform.d *= y;
    },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    arc(x, y, radius, start, end) { arcs.push({ x, y, radius, start, end, color: strokeStyle, alpha: globalAlpha }); },
    clearRect() {},
    drawImage() {},
    fillText(value, x, y) { texts.push({ value, x, y, color: fillStyle, alpha: globalAlpha }); },
    set fillStyle(value) { fillStyle = value; },
    get fillStyle() { return fillStyle; },
    set strokeStyle(value) { strokeStyle = value; },
    get strokeStyle() { return strokeStyle; },
    set globalAlpha(value) { globalAlpha = value; alphaCalls.push(value); },
    get globalAlpha() { return globalAlpha; },
    fillRect(x, y, w, h) { fills.push({ x, y, w, h, center: project(x + w / 2, y + h / 2), color: fillStyle, alpha: globalAlpha }); },
    get depth() { return stack.length; },
  };
}

function enemy(kind) {
  return createEnemyInstance(kind, { x: 100, y: 100 }, kind);
}

function canonicalFills(fills) {
  const keys = ["color", "alpha", "x", "y", "w", "h"];
  return fills
    .map(({ x, y, w, h, color, alpha }) => ({ x, y, w, h, color, alpha }))
    .sort((left, right) => {
      for (const key of keys) {
        if (left[key] === right[key]) continue;
        if (typeof left[key] === "string") return left[key].localeCompare(right[key]);
        return left[key] - right[key];
      }
      return 0;
    });
}

test("regional monsters render their distinct approved pixel palettes and silhouettes", () => {
  const cases = [
    ["fang-shark", ["#159a9c", "#f4f7ed"], fill => fill.y <= -22],
    ["pirate-shark", ["#11787c", "#7650a8", "#f4f7ed"], fill => fill.y <= -22],
    ["magma-slime", ["#1b1719", "#f05a24", "#ffc857"], fill => fill.color === "#ffc857"],
    ["magma-slime-small", ["#1b1719", "#f05a24", "#ffc857"], fill => fill.color === "#f05a24"],
    ["flame-imp", ["#a91f2c", "#f05a24", "#ffc857"], fill => fill.color === "#ffc857" && fill.y <= -18],
    ["ancient-boar", ["#704b32", "#b58a4a", "#f4f7ed"], fill => fill.color === "#f4f7ed" && fill.w <= 8],
    ["moss-troll", ["#704b32", "#6f8f3d", "#b58a4a"], fill => fill.color === "#6f8f3d" && fill.h >= 10],
    ["ancient-mushroom-bug", ["#234f32", "#76508f", "#b58a4a"], fill => fill.color === "#76508f" && fill.w >= 30],
  ];

  for (const [kind, palette, distinctPart] of cases) {
    const ctx = recordingContext();
    drawEnemy(ctx, enemy(kind), 0, 0, 1);
    assert.ok(ctx.fills.length >= 6, `${kind} should contain shadow plus five pixel body parts`);
    for (const color of palette) assert.ok(ctx.colors().includes(color), `${kind} should use ${color}`);
    assert.ok(ctx.fills.some(distinctPart), `${kind} should expose its distinct silhouette cue`);
    assert.equal(ctx.depth, 0, `${kind} should restore its canvas state`);
  }
});

test("magma children render at a smaller relative scale than their parent", () => {
  const parent = recordingContext();
  const child = recordingContext();
  drawEnemy(parent, enemy("magma-slime"), 0, 0, 1);
  drawEnemy(child, enemy("magma-slime-small"), 0, 0, 1);

  assert.ok(parent.scaleCalls.some(call => call.x === 1 && call.y === 1));
  assert.ok(child.scaleCalls.some(call => call.x < 1 && call.y < 1));
});

test("근거리 몬스터는 고정 레벨·이름·현재 체력을 머리 위에 표시한다", () => {
  const shark = enemy("fang-shark");
  shark.hp = 18.7;
  const ctx = recordingContext();

  drawEnemy(ctx, shark, 0, 0, 1, { player: { x: 100, y: 100 } });

  assert.ok(ctx.texts.some(text => text.value === "Lv.7 송곳니 상어"));
  assert.ok(ctx.texts.some(text => text.value === "18.7 / 25"));
  assert.ok(ctx.fills.some(fill => fill.color === "rgba(4,10,7,.9)" && fill.w === 104));
  assert.ok(ctx.fills.some(fill => fill.color === "#ef4444" && fill.w > 77 && fill.w < 78));
  assert.equal(ctx.fills.filter(fill => fill.color === "#ef4444").length, 1);
});

test("위장하거나 표시 시간이 끝난 원거리 몬스터는 기존 체력 막대로 위치를 노출하지 않는다", () => {
  const troll = enemy("moss-troll");
  troll.hp = 80;
  troll.camouflaged = true;
  troll.opacity = 0.25;
  const trollCtx = recordingContext();
  drawEnemy(trollCtx, troll, 0, 0, 1, { player: { x: 100, y: 100 } });

  const distantShark = enemy("fang-shark");
  distantShark.hp = 18;
  distantShark.infoVisibleRemaining = 0;
  const sharkCtx = recordingContext();
  drawEnemy(sharkCtx, distantShark, 0, 0, 1, { player: { x: 1000, y: 1000 } });

  assert.equal(trollCtx.fills.some(fill => fill.color === "#ef4444"), false);
  assert.equal(sharkCtx.fills.some(fill => fill.color === "#ef4444"), false);
  assert.equal(trollCtx.texts.length, 0);
  assert.equal(sharkCtx.texts.length, 0);
});

test("behavior states render charge, bite, teleport, camouflage, and spore telegraphs", () => {
  const charge = enemy("fang-shark");
  charge.behaviorState = "telegraph";
  charge.lockedDirection = { x: 1, y: 0 };
  const chargeCtx = recordingContext();
  drawEnemy(chargeCtx, charge, 0, 0, 1);
  assert.ok(chargeCtx.fills.some(fill => fill.w >= 60 && fill.h <= 8), "shark charge should draw a locked-direction line");

  const burrow = enemy("ancient-boar");
  burrow.behaviorState = "telegraph";
  burrow.lockedDirection = { x: 0, y: 1 };
  const burrowCtx = recordingContext();
  drawEnemy(burrowCtx, burrow, 0, 0, 1);
  assert.ok(burrowCtx.fills.some(fill => fill.w <= 8 && fill.h >= 60), "boar burrow should draw a locked-direction dust line");

  const pirate = enemy("pirate-shark");
  pirate.behaviorState = "attack";
  const pirateCtx = recordingContext();
  drawEnemy(pirateCtx, pirate, 0, 0, 1);
  assert.ok(pirateCtx.colors().includes("#fde047"), "pirate bite should flash at its mouth");

  const vanishingImp = enemy("flame-imp");
  vanishingImp.behaviorState = "vanish";
  const vanishCtx = recordingContext();
  drawEnemy(vanishCtx, vanishingImp, 0, 0, 1);
  assert.ok(vanishCtx.alphaCalls.some(alpha => alpha < 1), "vanishing imp should leave a translucent afterimage");
  assert.ok(vanishCtx.fills.some(fill => fill.alpha <= 0.2), "vanishing imp should leave a fading afterimage behind its body");

  const reappearingImp = enemy("flame-imp");
  reappearingImp.behaviorState = "reappear";
  const reappearCtx = recordingContext();
  drawEnemy(reappearCtx, reappearingImp, 0, 0, 1);
  assert.ok(reappearCtx.arcs.some(arc => arc.radius >= 20), "reappearing imp should draw a ring");

  const troll = enemy("moss-troll");
  troll.camouflaged = true;
  troll.opacity = 0.25;
  const trollCtx = recordingContext();
  drawEnemy(trollCtx, troll, 0, 0, 1);
  assert.ok(trollCtx.alphaCalls.includes(0.25), "camouflaged troll should honor low opacity");

  const mushroom = enemy("ancient-mushroom-bug");
  mushroom.behaviorState = "telegraph";
  const mushroomCtx = recordingContext();
  drawEnemy(mushroomCtx, mushroom, 0, 0, 1);
  assert.ok(mushroomCtx.arcs.some(arc => arc.radius === 120), "mushroom telegraph should expose its spore radius");
});

test("diagonal shark and boar telegraphs follow both locked-direction components", () => {
  const shark = enemy("fang-shark");
  shark.behaviorState = "telegraph";
  shark.lockedDirection = { x: 0.7, y: 0.7 };
  const sharkCtx = recordingContext();
  drawEnemy(sharkCtx, shark, 100, 100, 1);
  const sharkLine = sharkCtx.fills.find(fill => fill.color === "rgba(244,247,237,.7)");
  assert.ok(sharkLine.center.x > 35 && sharkLine.center.y > 35, "diagonal shark warning should advance down and right");
  assert.equal(sharkCtx.depth, 0);

  const boar = enemy("ancient-boar");
  boar.behaviorState = "telegraph";
  boar.lockedDirection = { x: -0.6, y: 0.8 };
  const boarCtx = recordingContext();
  drawEnemy(boarCtx, boar, 100, 100, 1);
  const boarLine = boarCtx.fills.find(fill => fill.color === "rgba(181,138,74,.65)");
  const boarDust = boarCtx.fills.filter(fill => fill.color === "rgba(111,143,61,.7)");
  assert.ok(boarLine.center.x < -25 && boarLine.center.y > 35, "diagonal boar line should advance left and down");
  assert.ok(boarDust.some(fill => fill.center.x < -10 && fill.center.y > 10), "boar dust should share the locked diagonal");
  assert.equal(boarCtx.depth, 0);
});

test("burrowing ancient boar telegraph leaves only its direction and dust cue above ground", () => {
  const boar = enemy("ancient-boar");
  boar.behaviorState = "telegraph";
  boar.lockedDirection = { x: 0, y: 1 };
  boar.hp = 20;
  const ctx = recordingContext();
  drawEnemy(ctx, boar, 0, 0, 1);
  assert.deepEqual(canonicalFills(ctx.fills), canonicalFills([
    { x: -4, y: 24, w: 8, h: 8, color: "rgba(111,143,61,.7)", alpha: 1 },
    { x: -3, y: 16, w: 6, h: 68, color: "rgba(181,138,74,.65)", alpha: 1 },
    { x: -3, y: 45, w: 6, h: 6, color: "rgba(111,143,61,.7)", alpha: 1 },
  ]), "burrow telegraph should contain exactly its direction line and dust rectangles");

  const normal = enemy("ancient-boar");
  normal.hp = 20;
  const normalCtx = recordingContext();
  drawEnemy(normalCtx, normal, 0, 0, 1);
  assert.ok(normalCtx.fills.some(fill => fill.x === -20 && fill.y === 12 && fill.w === 40 && fill.h === 8 && fill.color === "rgba(0,0,0,.28)"));
  assert.ok(normalCtx.fills.some(fill => fill.x === -23 && fill.y === -13 && fill.w === 37 && fill.h === 27 && fill.color === "#704b32"));
  assert.ok(normalCtx.fills.some(fill => fill.x === 22 && fill.y === 5 && fill.w === 8 && fill.h === 4 && fill.color === "#f4f7ed"));
  assert.equal(ctx.depth, 0);
  assert.equal(normalCtx.depth, 0);
});

test("mushroom telegraph grows deterministic purple spores inside its 120px ring", () => {
  const renderSpores = behaviorTime => {
    const mushroom = enemy("ancient-mushroom-bug");
    mushroom.behaviorState = "telegraph";
    mushroom.behaviorTime = behaviorTime;
    const ctx = recordingContext();
    drawEnemy(ctx, mushroom, 100, 100, 1);
    return { ctx, spores: ctx.fills.filter(fill => fill.color === "rgba(118,80,143,.8)") };
  };
  const early = renderSpores(0.15);
  const late = renderSpores(0.5);
  const radius = fill => Math.hypot(fill.center.x, fill.center.y);

  assert.equal(early.spores.length, 6);
  assert.equal(late.spores.length, 6);
  assert.ok(early.spores.every(fill => radius(fill) <= 120), "early spores should remain inside the telegraph ring");
  assert.ok(late.spores.every(fill => radius(fill) <= 120), "late spores should remain inside the telegraph ring");
  assert.ok(
    late.spores.reduce((sum, fill) => sum + radius(fill), 0) > early.spores.reduce((sum, fill) => sum + radius(fill), 0),
    "spores should spread outward as telegraph time advances",
  );
  assert.ok(late.spores.every(fill => Number.isInteger(fill.x) && Number.isInteger(fill.y) && Number.isInteger(fill.w) && Number.isInteger(fill.h)));
  assert.equal(early.ctx.depth, 0);
  assert.equal(late.ctx.depth, 0);
});

test("vanishing flame imp renders only a fading black afterimage and separate embers", () => {
  const vanish = enemy("flame-imp");
  vanish.behaviorState = "vanish";
  vanish.behaviorTime = 0.2;
  const vanishCtx = recordingContext();
  drawEnemy(vanishCtx, vanish, 0, 0, 1);
  assert.deepEqual(canonicalFills(vanishCtx.fills), canonicalFills([
    { x: -17, y: -2, w: 21, h: 18, color: "#1b1719", alpha: 0.09 },
    { x: -12, y: -16, w: 15, h: 14, color: "#1b1719", alpha: 0.09 },
    { x: -5, y: -23, w: 8, h: 8, color: "#1b1719", alpha: 0.09 },
    { x: -19, y: 1, w: 5, h: 5, color: "#f05a24", alpha: 0.375 },
    { x: 10, y: -10, w: 5, h: 5, color: "#f05a24", alpha: 0.375 },
    { x: -3, y: -24, w: 4, h: 6, color: "#f05a24", alpha: 0.375 },
    { x: -13, y: -12, w: 4, h: 4, color: "#ffc857", alpha: 0.375 },
    { x: 15, y: 6, w: 4, h: 4, color: "#ffc857", alpha: 0.375 },
    { x: 4, y: -19, w: 3, h: 5, color: "#ffc857", alpha: 0.375 },
  ]), "vanish should render only its fading afterimage and ember rectangles");

  const reappear = enemy("flame-imp");
  reappear.behaviorState = "reappear";
  reappear.hp = reappear.maxHp - 1;
  const reappearCtx = recordingContext();
  drawEnemy(reappearCtx, reappear, 0, 0, 1, { player: { x: 100, y: 100 } });
  assert.ok(reappearCtx.colors().includes("#a91f2c"), "reappearing imp should restore the full crimson body");
  assert.ok(reappearCtx.fills.some(fill => fill.x === -20 && fill.y === 12 && fill.w === 40 && fill.h === 8 && fill.color === "rgba(0,0,0,.28)"));
  assert.ok(reappearCtx.fills.some(fill => fill.x === -11 && fill.y === -4 && fill.w === 22 && fill.h === 20 && fill.color === "#a91f2c"));
  assert.ok(reappearCtx.fills.some(fill => fill.w === 104 && fill.h === 10 && fill.color === "rgba(4,10,7,.9)"), "damaged reappearing imp should restore its HP background");
  assert.ok(reappearCtx.fills.some(fill => fill.h === 10 && fill.w > 100 && fill.w < 104 && fill.color === "#ef4444"), "damaged reappearing imp should restore its red HP fill");
  assert.ok(reappearCtx.arcs.some(arc => arc.x === 0 && arc.y === 8 && arc.radius === 24 && arc.color === "#ffc857"), "reappearing imp should restore its ring");
  assert.equal(vanishCtx.depth, 0);
  assert.equal(reappearCtx.depth, 0);
});

test("shark telegraphs change their visible mouth and fin art before the attack state", () => {
  const render = (kind, state, hitFlash = 0, behaviorTime = 0) => {
    const candidate = enemy(kind);
    candidate.behaviorState = state;
    candidate.hitFlash = hitFlash;
    candidate.behaviorTime = behaviorTime;
    if (kind === "fang-shark") candidate.lockedDirection = { x: 1, y: 0 };
    const ctx = recordingContext();
    drawEnemy(ctx, candidate, 0, 0, 1);
    return ctx;
  };

  const pirateIdle = render("pirate-shark", "idle");
  const pirateTelegraph = render("pirate-shark", "telegraph");
  const pirateAttack = render("pirate-shark", "attack");
  const isOpenPurpleMouth = fill => fill.color === "#7650a8"
    && fill.x >= 8 && fill.y >= -3 && fill.w >= 18 && fill.h >= 10;
  const isMouthTooth = fill => fill.color === "#f4f7ed"
    && fill.x >= 12 && fill.y >= 0 && fill.w <= 5 && fill.h <= 4;
  assert.equal(pirateIdle.fills.some(isOpenPurpleMouth), false, "idle pirate should keep its mouth closed");
  assert.equal(pirateAttack.fills.some(isOpenPurpleMouth), false, "attack flash should remain distinct from the open-mouth telegraph");
  assert.ok(pirateTelegraph.fills.some(isOpenPurpleMouth), "telegraph pirate should draw an enlarged purple mouth");
  assert.ok(
    pirateTelegraph.fills.filter(isMouthTooth).length > pirateIdle.fills.filter(isMouthTooth).length,
    "telegraph pirate should expose additional white teeth inside the open mouth",
  );
  assert.ok(pirateAttack.colors().includes("#fde047"), "attack retains its separate bite flash");

  const fangIdle = render("fang-shark", "idle");
  const fangEarlyTelegraph = render("fang-shark", "telegraph", 0, 0.05);
  const fangLateTelegraph = render("fang-shark", "telegraph", 0, 0.2);
  const fangHitTelegraph = render("fang-shark", "telegraph", 0.1, 0.2);
  const isFangBody = fill => fill.x === -22 && fill.y === -8 && fill.w === 39 && fill.h === 17;
  const isDorsalFin = fill => fill.x === -8 && fill.y === -25 && fill.w === 10 && fill.h === 11;
  const isFangLine = fill => fill.x === 16 && fill.y === -3 && fill.w === 68 && fill.h === 6;
  assert.equal(fangIdle.fills.find(isFangBody).color, "#159a9c", "idle shark body should remain teal");
  assert.equal(fangIdle.fills.find(isDorsalFin).color, "#159a9c", "idle dorsal fin should match the teal body");
  assert.equal(fangEarlyTelegraph.fills.find(isFangBody).color, "#f4f7ed", "early telegraph should flash the shark body white");
  assert.equal(fangEarlyTelegraph.fills.find(isDorsalFin).color, "#f4f7ed", "early telegraph should flash the dorsal fin white");
  assert.equal(fangEarlyTelegraph.fills.find(isFangLine).color, "rgba(244,247,237,.7)", "early telegraph direction line should match the white phase");
  assert.equal(fangLateTelegraph.fills.find(isFangBody).color, "#159a9c", "later telegraph should return the shark body to teal");
  assert.equal(fangLateTelegraph.fills.find(isDorsalFin).color, "#159a9c", "later telegraph should return the dorsal fin to teal");
  assert.equal(fangLateTelegraph.fills.find(isFangLine).color, "rgba(21,154,156,.75)", "later telegraph direction line should match the teal phase");
  assert.equal(fangHitTelegraph.fills.find(isDorsalFin).color, "#ffffff", "hit flash should override the telegraph fin accent");
  assert.equal(fangHitTelegraph.fills.find(isFangBody).color, "#ffffff", "hit flash should override the telegraph body accent");
  assert.equal(fangHitTelegraph.fills.find(isFangLine).color, "rgba(255,255,255,.85)", "hit flash should override the telegraph line accent");
  assert.equal(fangEarlyTelegraph.depth, 0);
  assert.equal(fangLateTelegraph.depth, 0);
  assert.equal(fangHitTelegraph.depth, 0);
});

test("slow particles are exactly six, purple, and only draw while the status is active", () => {
  assert.equal(typeof gameModule.drawPlayerSlowEffect, "function");
  const inactive = recordingContext();
  gameModule.drawPlayerSlowEffect(inactive, { x: 100, y: 100, step: 0, statusEffects: { slow: { remaining: 0 } } }, 0, 0);
  assert.equal(inactive.fills.length, 0);

  const active = recordingContext();
  gameModule.drawPlayerSlowEffect(active, { x: 100, y: 100, step: 0, statusEffects: { slow: { remaining: 0.1 } } }, 0, 0);
  assert.equal(active.fills.length, 6);
  assert.ok(active.colors().every(color => color === "rgba(118,80,143,.75)"));
  assert.equal(active.depth, 0);
});

test("the game render places active slow particles in the playfield before HUD work", () => {
  const ctx = recordingContext();
  const game = Object.create(gameModule.PixelRPG.prototype);
  game.ctx = ctx;
  game.camera = { x: 0, y: 0, prevX: 0, prevY: 0 };
  game.worldLayer = {};
  game.remotePlayers = new Map();
  game.enemies = [];
  game.npcs = [];
  game.player = {
    x: 100, y: 100, prevX: 100, prevY: 100, moving: false, step: 0,
    dir: "down", color: "#4f8e5b", statusEffects: { slow: { remaining: 1 } },
  };
  game.attackState = null;
  game.damageNumbers = [];
  game.chatMessages = [];
  game.mapId = "village";
  game.renderMinimap = () => {};

  globalThis.innerWidth = 320;
  globalThis.innerHeight = 240;
  game.render(1);

  const purple = ctx.fills.filter(fill => fill.color === "rgba(118,80,143,.75)");
  assert.equal(purple.length, 6);
  assert.ok(ctx.fills.indexOf(purple[0]) > 0, "slow particles should render inside the playfield after its background");
  assert.equal(ctx.depth, 0);
});

test("명중 판정이 적용되는 첫 프레임부터 검 궤적은 전체 유효 사거리를 표시한다", () => {
  const renderAttack = kind => {
    const ctx = recordingContext();
    const definition = attackDefinition(kind);
    const game = Object.create(gameModule.PixelRPG.prototype);
    game.ctx = ctx;
    game.camera = { x: 0, y: 0, prevX: 0, prevY: 0 };
    game.worldLayer = {};
    game.remotePlayers = new Map();
    game.enemies = [];
    game.npcs = [];
    game.player = {
      x: 100, y: 100, prevX: 100, prevY: 100, moving: false, step: 0,
      dir: "right", color: "#4f8e5b", statusEffects: { slow: { remaining: 0 } },
    };
    game.attackState = { kind, elapsed: definition.windup, definition };
    game.hitEffects = [];
    game.damageNumbers = [];
    game.chatMessages = [];
    game.mapId = "village";
    game.renderMinimap = () => {};

    globalThis.innerWidth = 320;
    globalThis.innerHeight = 240;
    game.render(1);
    return ctx;
  };

  const basicArc = renderAttack("basic").arcs.find(arc => arc.color === "#e0f2fe");
  const strongArc = renderAttack("strong").arcs.find(arc => arc.color === "#fde047");
  assert.equal(basicArc.radius, 64);
  assert.equal(strongArc.radius, 92);
});
