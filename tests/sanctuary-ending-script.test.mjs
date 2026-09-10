import test from "node:test";
import assert from "node:assert/strict";
import {
  POST_CREDIT_LINES,
  sanctuaryEndingScript,
} from "../src/sanctuary-ending-script-20260910-sanctuary.js";

function text(script) {
  return JSON.stringify(script);
}

test("restore ending contains approved title, aren reflection and narrator close", () => {
  const script = sanctuaryEndingScript({
    choice: "restore",
    captainOutcome: "rescued",
    supportChoice: "echo",
    playerName: "테스터",
  });
  assert.equal(script.endingTitle, "원래의 세계");
  assert.equal(script.rewardTitle, "세계의 복원자");
  assert.match(text(script), /RESTORE/);
  assert.match(text(script), /내가 시작했던 일을.*결국 네가 끝냈어/s);
  assert.match(text(script), /복원되었다는 것은.*아무 일도 없었다는 뜻이 아니다/s);
  assert.match(text(script), /이번에는 누군가의 실수를 덮기 위해 코어를 움직인 게 아니군/s);
});

test("restore lost-captain branch uses the final recording", () => {
  const script = sanctuaryEndingScript({ choice: "restore", captainOutcome: "lost", playerName: "테스터" });
  assert.match(text(script), /우리가 실패한 이유만은 기억해 줘/);
  assert.doesNotMatch(text(script), /이번에는 누군가의 실수를 덮기 위해 코어를 움직인 게 아니군/);
});

test("seal ending contains approved world-preservation close", () => {
  const script = sanctuaryEndingScript({ choice: "seal", captainOutcome: "rescued", playerName: "테스터" });
  assert.equal(script.endingTitle, "지켜낸 현재");
  assert.equal(script.rewardTitle, "코어의 수호자");
  assert.match(text(script), /SEAL/);
  assert.match(text(script), /완벽하게 고치지 않는 것도.*선택이구나/s);
  assert.match(text(script), /고쳐진 세계가 아니라.*지켜내는 세계가 되었다/s);
});

test("resonate ending includes all three principles and support-choice cameo", () => {
  const expected = {
    sera: /세계가 사람의 목소리를 듣게 된 것 같아/,
    echo: /서로 다른 진실이 동시에 존재할 수 있다는 결과/,
    mari: /지금까지 나온 답 중에서는.*가장 오래 버틸 수 있을 것 같네/s,
  };
  for (const [supportChoice, pattern] of Object.entries(expected)) {
    const script = sanctuaryEndingScript({
      choice: "resonate",
      captainOutcome: "rescued",
      supportChoice,
      playerName: "테스터",
    });
    assert.equal(script.endingTitle, "새로운 세계");
    assert.equal(script.rewardTitle, "세계의 공명자");
    assert.match(text(script), /한 사람이 모든 권한을 가지면.*판단에 종속/s);
    assert.match(text(script), /권한을 완전히 끊으면.*스스로 회복할 수 없다/s);
    assert.match(text(script), /서로 다른 권한이 서로를 확인할 때.*대화가 된다/s);
    assert.match(text(script), /명령이 아니라.*공명으로 전환합니다/s);
    assert.match(text(script), pattern);
  }
});

test("all endings share approved common authority transfer intro", () => {
  for (const choice of ["restore", "seal", "resonate"]) {
    const script = sanctuaryEndingScript({ choice, playerName: "테스터" });
    assert.match(script.commonIntro.map(frame => frame.text).join(" "), /생명 관리자 권한 확인/);
    assert.match(script.commonIntro.map(frame => frame.text).join(" "), /기억 관리자 권한 확인/);
    assert.match(script.commonIntro.map(frame => frame.text).join(" "), /에너지 관리자 권한 확인/);
    assert.match(script.commonIntro.map(frame => frame.text).join(" "), /최종 결정 권한을 이관합니다/);
  }
});

test("credits include the player and Part 1 completion, post-credit copy is exact", () => {
  const script = sanctuaryEndingScript({ choice: "resonate", playerName: "PLAYER_X" });
  assert.match(script.credits.lines.join(" "), /PIXEL WORLD/);
  assert.match(script.credits.lines.join(" "), /제1부.*부서진 코어/);
  assert.match(script.credits.lines.join(" "), /PLAYER_X/);
  assert.match(script.credits.lines.join(" "), /제1부 종료/);
  assert.match(script.credits.lines.join(" "), /당신이 선택한 세계는 계속됩니다/);
  assert.deepEqual(POST_CREDIT_LINES, [
    "UNKNOWN NODE SIGNAL DETECTED",
    "SOURCE: OUTSIDE CORE RANGE",
  ]);
  assert.deepEqual(script.postCredit.lines, POST_CREDIT_LINES);
});
