import test from "node:test";
import assert from "node:assert/strict";
import { drawPixelCharacter } from "../src/game-20260829-coast.js";

function recordingContext() {
  const fills = [];
  let fillStyle = "";
  return {
    fills,
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    fillRect(x, y, width, height) { fills.push({ fillStyle, x, y, width, height }); },
    fillText() {},
    measureText() { return { width: 20 }; },
    set fillStyle(value) { fillStyle = value; },
    get fillStyle() { return fillStyle; },
  };
}

function player(overrides = {}) {
  return {
    x: 100,
    y: 100,
    dir: "right",
    moving: false,
    step: 0,
    color: "#4f8e5b",
    name: "검객",
    equippedWeaponId: "starter-sword",
    ...overrides,
  };
}

test("로컬 캐릭터는 장착한 명검의 은빛 검신과 금장·붉은 장식을 그린다", () => {
  const context = recordingContext();
  drawPixelCharacter(context, player({ equippedWeaponId: "masterwork-katana" }), 0, 0);
  assert.ok(context.fills.some(fill => fill.fillStyle === "#f4f7f8" && fill.width === 31));
  assert.equal(context.fills.filter(fill => fill.fillStyle === "#d4a72c").length, 3);
  assert.equal(context.fills.filter(fill => fill.fillStyle === "#9f2f32").length, 3);
});

test("원격 캐릭터도 전달된 강화 명검을 그리고 잘못된 ID는 시작 검으로 복구한다", () => {
  const remote = recordingContext();
  drawPixelCharacter(remote, player({ remote: true, equippedWeaponId: "reinforced-masterwork-katana" }), 0, 0);
  assert.ok(remote.fills.some(fill => fill.fillStyle === "#f7fafc" && fill.width === 32));

  const fallback = recordingContext();
  drawPixelCharacter(fallback, player({ remote: true, equippedWeaponId: "unknown" }), 0, 0);
  assert.ok(fallback.fills.some(fill => fill.fillStyle === "#bec9d4" && fill.width === 21));
});

test("로컬·원격 궁수는 장착 활과 화살통을 그린다", () => {
  for (const remote of [false, true]) {
    const context = recordingContext();
    drawPixelCharacter(context, player({
      classId: "archer",
      remote,
      equippedWeaponId: "hunter-bow",
    }), 0, 0);
    assert.ok(context.fills.some(fill => fill.fillStyle === "#7d542f"));
    assert.ok(context.fills.some(fill => fill.fillStyle === "#795548"));
    assert.equal(context.fills.some(fill => fill.fillStyle === "#bec9d4" && fill.width === 21), false);
  }
});

test("로컬·원격 마법사는 장착 지팡이와 발광 코어를 그린다", () => {
  for (const remote of [false, true]) {
    const context = recordingContext();
    drawPixelCharacter(context, player({
      classId: "mage",
      remote,
      equippedWeaponId: "apprentice-staff",
    }), 0, 0);
    assert.ok(context.fills.some(fill => fill.fillStyle === "#6d4c41"));
    assert.ok(context.fills.some(fill => fill.fillStyle === "#93c5fd"));
    assert.equal(context.fills.some(fill => fill.fillStyle === "#bec9d4" && fill.width === 21), false);
  }
});
