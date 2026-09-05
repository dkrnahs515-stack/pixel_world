import test from "node:test";
import assert from "node:assert/strict";
import { DialogueController } from "../src/dialogue-controller-20260829-coast-20260905-upgrade.js";

function button() {
  const listeners = [];
  return {
    textContent: "",
    addEventListener(type, listener) {
      if (type === "click") listeners.push(listener);
    },
    click() {
      for (const listener of listeners) listener();
    },
  };
}

function renderedButton() {
  return { ...button(), dataset: {}, className: "", type: "" };
}

function actionContainer() {
  const container = {
    children: [],
    ownerDocument: { createElement: () => renderedButton() },
    replaceChildren(...children) {
      this.children = children;
    },
  };
  return container;
}

function fixture(onAction = () => {}) {
  const overlay = { hidden: true };
  const title = { textContent: "" };
  const body = { textContent: "" };
  const actionButton = button();
  return {
    overlay,
    title,
    body,
    actionButton,
    controller: new DialogueController({ overlay, title, body, actionButton, onAction }),
  };
}

test("open은 대화 모델을 표시하고 오버레이를 연다", () => {
  const view = fixture();
  view.controller.open({
    title: "현자 아렌",
    body: "슬라임을 처치해 주세요.",
    action: "accept",
    actionLabel: "퀘스트 수락",
  });

  assert.equal(view.overlay.hidden, false);
  assert.equal(view.title.textContent, "현자 아렌");
  assert.equal(view.body.textContent, "슬라임을 처치해 주세요.");
  assert.equal(view.actionButton.textContent, "퀘스트 수락");
});

test("반복해서 열어도 현재 행동은 클릭 한 번에 한 번만 전달된다", () => {
  const actions = [];
  const view = fixture(action => actions.push(action));
  view.controller.open({ title: "아렌", body: "첫 대화", action: "accept", actionLabel: "수락" });
  view.controller.open({ title: "아렌", body: "둘째 대화", action: "complete", actionLabel: "보고" });
  view.actionButton.click();

  assert.deepEqual(actions, ["complete"]);
});

test("close는 대화 오버레이를 숨긴다", () => {
  const view = fixture();
  view.controller.open({ title: "아렌", body: "안녕하세요", action: "close", actionLabel: "마치기" });
  view.controller.close();

  assert.equal(view.overlay.hidden, true);
});

test("legacy Aren 모델은 단일 행동으로 정규화해 그대로 표시한다", () => {
  const actions = [];
  const view = fixture(action => actions.push(action));
  view.controller.open({
    title: "현자 아렌",
    body: "슬라임을 처치해 주세요.",
    action: "accept",
    actionLabel: "퀘스트 수락",
  });

  assert.deepEqual(view.controller.actions, [{ id: "accept", label: "퀘스트 수락" }]);
  view.actionButton.click();
  assert.deepEqual(actions, ["accept"]);
});

test("pages와 actions 모델의 세 선택은 각각의 행동 ID를 전달한다", () => {
  const actions = [];
  const view = fixture(action => actions.push(action));
  view.controller.open({
    title: "침수된 통신소",
    pages: ["세 목소리 모두 조수 코어를 향한다.", "누구의 말을 지지할까?"],
    actions: [
      { id: "support-sera", label: "세라를 지지한다" },
      { id: "support-echo", label: "에코를 지지한다" },
      { id: "support-mari", label: "마리를 지지한다" },
    ],
  });

  assert.equal(view.body.textContent, "세 목소리 모두 조수 코어를 향한다.\n누구의 말을 지지할까?");
  assert.deepEqual(view.controller.actions.map(action => action.id), [
    "support-sera",
    "support-echo",
    "support-mari",
  ]);
  view.controller.choose("support-echo");
  view.controller.choose("support-mari");
  assert.deepEqual(actions, ["support-echo", "support-mari"]);
});

test("다중 행동 모델은 실제 세 선택 버튼을 렌더링한다", () => {
  const actions = [];
  const overlay = { hidden: true };
  const title = { textContent: "" };
  const body = { textContent: "" };
  const actionButton = renderedButton();
  const container = actionContainer();
  const controller = new DialogueController({
    overlay,
    title,
    body,
    actionButton,
    actionContainer: container,
    onAction: action => actions.push(action),
  });

  controller.open({
    title: "통신소",
    pages: ["세 목소리"],
    actions: [
      { id: "sera", label: "세라" },
      { id: "echo", label: "에코" },
      { id: "mari", label: "마리" },
    ],
  });

  assert.equal(container.children.length, 3);
  assert.deepEqual(container.children.map(choice => choice.dataset.dialogueAction), ["sera", "echo", "mari"]);
  container.children[0].click();
  container.children[1].click();
  container.children[2].click();
  assert.deepEqual(actions, ["sera", "echo", "mari"]);
});
