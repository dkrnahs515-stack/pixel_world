import test from "node:test";
import assert from "node:assert/strict";

async function qaModule() {
  try {
    return await import("../src/qa-mode.js");
  } catch {
    return {};
  }
}

test("QA 모드는 URL의 qa 값이 정확히 1일 때만 활성화된다", async () => {
  const { isQaMode } = await qaModule();

  assert.equal(typeof isQaMode, "function");
  assert.equal(isQaMode("?qa=1"), true);
  assert.equal(isQaMode("?mode=play&qa=1"), true);
  assert.equal(isQaMode(""), false);
  assert.equal(isQaMode("?qa=0"), false);
  assert.equal(isQaMode("?qa=true"), false);
});

test("QA 신규 몬스터 목록은 종류마다 고유 지역을 지정한다", async () => {
  const { getQaMonster } = await qaModule();

  assert.equal(typeof getQaMonster, "function");
  assert.deepEqual(getQaMonster("fang-shark"), {
    kind: "fang-shark",
    name: "송곳니 상어",
    mapId: "coast",
  });
  assert.deepEqual(getQaMonster("flame-imp"), {
    kind: "flame-imp",
    name: "불꽃 도깨비",
    mapId: "volcano",
  });
  assert.deepEqual(getQaMonster("moss-troll"), {
    kind: "moss-troll",
    name: "이끼 트롤",
    mapId: "forest",
  });
  assert.equal(getQaMonster("magma-slime-small"), null);
  assert.equal(getQaMonster("unknown"), null);
});

test("QA 소환 위치는 정면 장애물을 피하고 포탈 밖의 첫 안전 후보를 선택한다", async () => {
  const { findQaSpawnPosition } = await qaModule();
  const checked = [];

  assert.equal(typeof findQaSpawnPosition, "function");
  const position = findQaSpawnPosition({
    player: { x: 100, y: 100, dir: "right" },
    radius: 20,
    portals: [{ x: 220, y: 70, w: 80, h: 80 }],
    isBlocked(x, y) {
      checked.push([x, y]);
      return x === 240 && y === 100;
    },
  });

  assert.deepEqual(checked.slice(0, 2), [[240, 100], [100, 240]]);
  assert.deepEqual(position, { x: 100, y: 240 });
});

test("QA 소환 후보가 모두 막히면 위치를 만들지 않는다", async () => {
  const { findQaSpawnPosition } = await qaModule();

  assert.equal(typeof findQaSpawnPosition, "function");
  assert.equal(findQaSpawnPosition({
    player: { x: 100, y: 100, dir: "up" },
    radius: 20,
    portals: [],
    isBlocked: () => true,
  }), null);
});
