import test from "node:test";
import assert from "node:assert/strict";
import { renderCommunicationLog } from "../src/communication-log-20260829-coast.js";

function fakeDocument() {
  return {
    createElement() {
      return {
        children: [],
        className: "",
        textContent: "",
        append(...children) {
          this.children.push(...children);
        },
      };
    },
    createTextNode(textContent) {
      return { textContent };
    },
  };
}

test("통신 기록은 입력 순서와 무관하게 timelineOrder 순서로 DOM에 렌더링된다", () => {
  const documentRef = fakeDocument();
  const list = {
    ownerDocument: documentRef,
    children: [],
    replaceChildren(...children) {
      this.children = children;
    },
  };

  renderCommunicationLog(list, [
    { timelineOrder: 60, speaker: "세라", pages: ["현재 구조 신호"] },
    { timelineOrder: 10, speaker: "로안", pages: ["만에서 대기한다"] },
    { timelineOrder: 40, speaker: "가렌", pages: ["시간대를 확인한다"] },
  ]);

  assert.deepEqual(list.children.map(entry => entry.children[0].textContent), ["로안", "가렌", "세라"]);
  assert.deepEqual(list.children.map(entry => entry.children[1].textContent), [
    "만에서 대기한다",
    "시간대를 확인한다",
    "현재 구조 신호",
  ]);
});
