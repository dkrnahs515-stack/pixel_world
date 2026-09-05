import test from "node:test";
import assert from "node:assert/strict";
import { drawClassEquipment, drawClassPreview } from "../src/class-rendering-20260905-upgrade.js";

function recordingContext() {
  const calls = [];
  const context = {
    canvas: { width: 96, height: 72 },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    calls,
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    clearRect(...args) { calls.push(["clearRect", ...args]); },
    fillRect(...args) { calls.push(["fillRect", this.fillStyle, ...args]); },
    beginPath() { calls.push(["beginPath"]); },
    moveTo(...args) { calls.push(["moveTo", ...args]); },
    lineTo(...args) { calls.push(["lineTo", ...args]); },
    arc(...args) { calls.push(["arc", this.strokeStyle, ...args]); },
    stroke() { calls.push(["stroke", this.strokeStyle, this.lineWidth]); },
  };
  return context;
}

test("세 직업 미리보기는 검·활·지팡이를 구분하는 서로 다른 명령을 그린다", () => {
  const warrior = recordingContext();
  const archer = recordingContext();
  const mage = recordingContext();

  drawClassPreview(warrior, "warrior");
  drawClassPreview(archer, "archer");
  drawClassPreview(mage, "mage");

  assert.notDeepEqual(warrior.calls, archer.calls);
  assert.notDeepEqual(archer.calls, mage.calls);
  assert.ok(warrior.calls.some(call => call[0] === "fillRect" && call[1] === "#e5edf7"));
  assert.ok(archer.calls.some(call => call[0] === "arc"));
  assert.ok(mage.calls.some(call => call[0] === "fillRect" && call[1] === "#c084fc"));
  for (const context of [warrior, archer, mage]) {
    assert.deepEqual(context.calls[0], ["save"]);
    assert.deepEqual(context.calls.at(-1), ["restore"]);
  }
});

test("알 수 없는 직업은 검사 미리보기로 복구한다", () => {
  const warrior = recordingContext();
  const unknown = recordingContext();
  drawClassPreview(warrior, "warrior");
  drawClassPreview(unknown, "unknown");
  assert.deepEqual(unknown.calls, warrior.calls);
});

test("월드 캐릭터 보조 장비는 궁수 화살통과 마법사 룬을 구분한다", () => {
  const warrior = recordingContext();
  const archer = recordingContext();
  const mage = recordingContext();

  drawClassEquipment(warrior, { classId: "warrior", direction: "right" });
  drawClassEquipment(archer, { classId: "archer", direction: "right" });
  drawClassEquipment(mage, { classId: "mage", direction: "right" });

  assert.equal(warrior.calls.some(call => call[1] === "#795548"), false);
  assert.ok(archer.calls.some(call => call[0] === "fillRect" && call[1] === "#795548"));
  assert.ok(archer.calls.filter(call => call[1] === "#f4c95d").length >= 2);
  assert.ok(mage.calls.some(call => call[0] === "fillRect" && call[1] === "#c084fc"));
});
