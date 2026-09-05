import test from "node:test";
import assert from "node:assert/strict";
import {
  drawScabbard,
  drawWeapon,
  drawWeaponPreview,
} from "../src/weapon-rendering-20260903-volcano-20260905-upgrade.js";
import { WEAPON_ORDER, WEAPON_ORDER_BY_CLASS, WEAPONS } from "../src/weapon-data-20260903-volcano-20260905-upgrade.js";

function recordingContext() {
  const fills = [];
  const rotations = [];
  let fillStyle = "";
  let depth = 0;
  return {
    fills,
    rotations,
    get depth() { return depth; },
    save() { depth += 1; },
    restore() { depth -= 1; },
    translate() {},
    rotate(angle) { rotations.push(angle); },
    clearRect() {},
    fillRect(x, y, width, height) {
      fills.push({ fillStyle, x, y, width, height });
    },
    set fillStyle(value) { fillStyle = value; },
    get fillStyle() { return fillStyle; },
  };
}

function fillsOf(context, color) {
  return context.fills.filter(fill => fill.fillStyle === color);
}

function boundsRecordingContext() {
  const fills = [];
  const stack = [];
  let transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const point = (x, y) => ({
    x: transform.a * x + transform.c * y + transform.e,
    y: transform.b * x + transform.d * y + transform.f,
  });
  return {
    fills,
    save() { stack.push({ ...transform }); },
    restore() { transform = stack.pop(); },
    translate(x, y) {
      transform.e += transform.a * x + transform.c * y;
      transform.f += transform.b * x + transform.d * y;
    },
    rotate(angle) {
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      transform = {
        a: transform.a * cosine + transform.c * sine,
        b: transform.b * cosine + transform.d * sine,
        c: transform.c * cosine - transform.a * sine,
        d: transform.d * cosine - transform.b * sine,
        e: transform.e,
        f: transform.f,
      };
    },
    clearRect() {},
    fillRect(x, y, width, height) {
      const corners = [
        point(x, y),
        point(x + width, y),
        point(x, y + height),
        point(x + width, y + height),
      ];
      fills.push({
        minX: Math.min(...corners.map(corner => corner.x)),
        maxX: Math.max(...corners.map(corner => corner.x)),
        minY: Math.min(...corners.map(corner => corner.y)),
        maxY: Math.max(...corners.map(corner => corner.y)),
      });
    },
    set fillStyle(_value) {},
  };
}

test("여덟 검은 승인된 검신 길이와 색을 Canvas 픽셀로 그린다", () => {
  for (const id of WEAPON_ORDER) {
    const context = recordingContext();
    const weapon = WEAPONS[id];
    drawWeapon(context, { direction: "right", weaponId: id });
    assert.ok(
      fillsOf(context, weapon.visual.bladeColor)
        .some(fill => fill.width === weapon.visual.bladeLength && fill.height === weapon.visual.bladeWidth),
      `${id} blade`,
    );
    assert.ok(fillsOf(context, weapon.visual.spineColor).length > 0, `${id} spine`);
    assert.ok(fillsOf(context, weapon.visual.gripColor).length > 0, `${id} grip`);
    assert.equal(context.depth, 0);
  }
});

test("명검 계열은 카타나보다 길고 강화 명검은 금장과 붉은 장식이 더 많다", () => {
  const katana = recordingContext();
  const masterwork = recordingContext();
  const reinforced = recordingContext();
  drawWeapon(katana, { direction: "right", weaponId: "katana" });
  drawWeapon(masterwork, { direction: "right", weaponId: "masterwork-katana" });
  drawWeapon(reinforced, { direction: "right", weaponId: "reinforced-masterwork-katana" });
  assert.ok(
    fillsOf(masterwork, "#f4f7f8")[0].width
      > fillsOf(katana, "#dceeff")[0].width,
  );
  assert.ok(fillsOf(reinforced, "#d4a72c").length > fillsOf(masterwork, "#d4a72c").length);
  assert.ok(fillsOf(reinforced, "#9f2f32").length > fillsOf(masterwork, "#9f2f32").length);
});

test("방향과 공격 진행은 회전만 바꾸고 선택 무기의 색상은 유지한다", () => {
  const idle = recordingContext();
  const down = recordingContext();
  const attacking = recordingContext();
  drawWeapon(idle, { direction: "right", weaponId: "katana" });
  drawWeapon(down, { direction: "down", weaponId: "katana" });
  drawWeapon(attacking, {
    direction: "right",
    weaponId: "katana",
    attackState: { kind: "basic", elapsed: 0.18, definition: { duration: 0.18 } },
  });
  assert.ok(Math.abs((down.rotations[0] - idle.rotations[0]) - Math.PI / 2) < 1e-9);
  assert.notEqual(attacking.rotations[0], idle.rotations[0]);
  for (const context of [idle, down, attacking]) {
    assert.ok(fillsOf(context, "#dceeff").length > 0);
    assert.ok(fillsOf(context, "#15191f").length > 0);
  }
});

test("알 수 없는 무기와 방향은 시작 검과 오른쪽 방향으로 안전하게 복구한다", () => {
  const fallback = recordingContext();
  const starter = recordingContext();
  drawWeapon(fallback, { direction: "unknown", weaponId: "unknown" });
  drawWeapon(starter, { direction: "right", weaponId: "starter-sword" });
  assert.deepEqual(fallback.fills, starter.fills);
  assert.deepEqual(fallback.rotations, starter.rotations);
  assert.equal(fallback.depth, 0);
});

test("명검 계열 칼집은 검은 몸체와 붉은·금색 문양을 캐릭터 허리에 그린다", () => {
  const starter = recordingContext();
  const masterwork = recordingContext();
  const reinforced = recordingContext();
  assert.equal(drawScabbard(starter, { weaponId: "starter-sword" }), false);
  assert.equal(drawScabbard(masterwork, { direction: "down", weaponId: "masterwork-katana" }), true);
  assert.equal(drawScabbard(reinforced, { direction: "left", weaponId: "reinforced-masterwork-katana" }), true);
  assert.ok(fillsOf(masterwork, "#101319").some(fill => fill.width === 35));
  assert.ok(fillsOf(masterwork, "#9f2f32").length >= 1);
  assert.ok(fillsOf(masterwork, "#d4a72c").length >= 1);
  assert.ok(fillsOf(reinforced, "#d4a72c").length > fillsOf(masterwork, "#d4a72c").length);
  assert.equal(starter.fills.length, 0);
});

test("잘못된 방향은 검과 칼집 모두 오른쪽 방향으로 동일하게 복구한다", () => {
  const invalidScabbard = recordingContext();
  const rightScabbard = recordingContext();
  drawScabbard(invalidScabbard, {
    direction: "unknown",
    weaponId: "masterwork-katana",
  });
  drawScabbard(rightScabbard, {
    direction: "right",
    weaponId: "masterwork-katana",
  });
  assert.deepEqual(invalidScabbard.rotations, rightScabbard.rotations);
});

test("대장간 미리보기는 선택 무기를 전용 캔버스에 한 번 그린다", () => {
  const context = recordingContext();
  const canvas = { width: 54, height: 32, getContext: () => context };
  assert.equal(drawWeaponPreview(canvas, "elite-katana"), true);
  assert.ok(fillsOf(context, "#eff6ff").some(fill => fill.width === 30));
  assert.equal(context.depth, 0);
  assert.equal(drawWeaponPreview(null, "katana"), false);
});

test("대장간 미리보기는 가장 긴 무기까지 캔버스 경계 안에 모두 표시한다", () => {
  for (const weaponId of WEAPON_ORDER.slice(1)) {
    const context = boundsRecordingContext();
    const canvas = { width: 54, height: 32, getContext: () => context };
    assert.equal(drawWeaponPreview(canvas, weaponId), true);
    assert.ok(context.fills.length > 0);
    for (const fill of context.fills) {
      assert.ok(fill.minX >= 0, `${weaponId} minX ${fill.minX}`);
      assert.ok(fill.maxX <= canvas.width, `${weaponId} maxX ${fill.maxX}`);
      assert.ok(fill.minY >= 0, `${weaponId} minY ${fill.minY}`);
      assert.ok(fill.maxY <= canvas.height, `${weaponId} maxY ${fill.maxY}`);
    }
  }
});

test("활 8종은 현과 등급별 재료색을 가진 활 모양으로 그린다", () => {
  for (const weaponId of WEAPON_ORDER_BY_CLASS.archer) {
    const context = recordingContext();
    const weapon = WEAPONS[weaponId];
    drawWeapon(context, { classId: "archer", direction: "right", weaponId });
    assert.ok(fillsOf(context, weapon.visual.woodColor).length >= 2, `${weaponId} limbs`);
    assert.ok(fillsOf(context, weapon.visual.stringColor).length >= 1, `${weaponId} string`);
    assert.equal(fillsOf(context, "#bec9d4").length, 0, `${weaponId} is not sword`);
  }
});

test("지팡이 8종은 축과 발광 코어를 등급별 색으로 그린다", () => {
  for (const weaponId of WEAPON_ORDER_BY_CLASS.mage) {
    const context = recordingContext();
    const weapon = WEAPONS[weaponId];
    drawWeapon(context, { classId: "mage", direction: "right", weaponId });
    assert.ok(fillsOf(context, weapon.visual.shaftColor).length >= 1, `${weaponId} shaft`);
    assert.ok(fillsOf(context, weapon.visual.coreColor).length >= 1, `${weaponId} core`);
    assert.ok(fillsOf(context, weapon.visual.glowColor).length >= 1, `${weaponId} glow`);
  }
});

test("모든 24종 무기 미리보기가 전용 Canvas 안에 표시된다", () => {
  for (const weaponId of Object.values(WEAPON_ORDER_BY_CLASS).flat()) {
    const context = boundsRecordingContext();
    const canvas = { width: 54, height: 32, getContext: () => context };
    assert.equal(drawWeaponPreview(canvas, weaponId), true);
    assert.ok(context.fills.length > 0, weaponId);
    for (const fill of context.fills) {
      assert.ok(fill.minX >= 0, `${weaponId} minX ${fill.minX}`);
      assert.ok(fill.maxX <= canvas.width, `${weaponId} maxX ${fill.maxX}`);
      assert.ok(fill.minY >= 0, `${weaponId} minY ${fill.minY}`);
      assert.ok(fill.maxY <= canvas.height, `${weaponId} maxY ${fill.maxY}`);
    }
  }
});
