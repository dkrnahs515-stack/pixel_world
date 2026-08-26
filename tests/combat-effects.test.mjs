import test from "node:test";
import assert from "node:assert/strict";
import * as gameModule from "../src/game.js";

function effectApi(name) {
  assert.equal(typeof gameModule[name], "function", `${name} should be exported`);
  return gameModule[name];
}

function effectContext() {
  const fills = [];
  let fillStyle = "#000000";
  let globalAlpha = 1;
  return {
    fills,
    save() {},
    restore() {},
    fillRect(x, y, w, h) { fills.push({ x, y, w, h, color: fillStyle, alpha: globalAlpha }); },
    set fillStyle(value) { fillStyle = value; },
    get fillStyle() { return fillStyle; },
    set globalAlpha(value) { globalAlpha = value; },
    get globalAlpha() { return globalAlpha; },
  };
}

test("기본 공격과 강한 공격은 서로 다른 색상과 파편량으로 명중을 표시한다", () => {
  const createHitEffect = effectApi("createHitEffect");
  const drawHitEffects = effectApi("drawHitEffects");
  const basic = createHitEffect({ x: 100, y: 100, kind: "basic" });
  const strong = createHitEffect({ x: 200, y: 100, kind: "strong" });
  const ctx = effectContext();

  drawHitEffects(ctx, [basic, strong], 0, 0);

  const blue = ctx.fills.filter(fill => fill.color === "#e0f2fe");
  const gold = ctx.fills.filter(fill => fill.color === "#fde047");
  assert.equal(blue.length, 7);
  assert.equal(gold.length, 11);
  assert.ok(gold.some(fill => fill.w > blue[0].w));
});

test("강한 공격 화면 흔들림은 기본 공격보다 크고 효과 종료 후 사라진다", () => {
  const createHitEffect = effectApi("createHitEffect");
  const hitShakeOffset = effectApi("hitShakeOffset");
  const advanceHitEffects = effectApi("advanceHitEffects");
  const basic = createHitEffect({ x: 0, y: 0, kind: "basic" });
  const strong = createHitEffect({ x: 0, y: 0, kind: "strong" });

  const basicOffset = hitShakeOffset([basic]);
  const strongOffset = hitShakeOffset([strong]);
  assert.ok(Math.hypot(strongOffset.x, strongOffset.y) > Math.hypot(basicOffset.x, basicOffset.y));
  assert.deepEqual(advanceHitEffects([strong], 1), []);
  assert.deepEqual(hitShakeOffset([]), { x: 0, y: 0 });
});

test("피해 숫자는 크게 나타난 뒤 원래 크기로 줄어든다", () => {
  const fonts = [];
  let font = "";
  const ctx = {
    save() {}, restore() {}, fillText() {},
    set font(value) { font = value; fonts.push(value); },
    get font() { return font; },
    set textAlign(_value) {},
    set globalAlpha(_value) {},
    set fillStyle(_value) {},
  };
  const game = Object.create(gameModule.PixelRPG.prototype);
  game.damageNumbers = [{ x: 0, y: 0, value: 3, kind: "strong", age: 0, duration: 0.55 }];

  game.drawDamageNumbers(ctx, 0, 0);
  game.damageNumbers[0].age = 0.4;
  game.drawDamageNumbers(ctx, 0, 0);

  const fontSize = value => Number.parseInt(value.match(/(\d+)px/)[1], 10);
  assert.ok(fontSize(fonts[0]) > fontSize(fonts[1]));
  assert.ok(fontSize(fonts[1]) >= 15);
});
