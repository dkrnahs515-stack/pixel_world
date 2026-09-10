const fs = require('node:fs');
const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
if (!html.includes('id="sanctuaryEndingOverlay"')) {
  const markup = `
    <section id="sanctuaryEndingOverlay" class="screen-overlay sanctuary-ending-overlay" hidden>
      <div class="modal-card sanctuary-ending-card" role="dialog" aria-modal="true" aria-labelledby="sanctuaryEndingTitle">
        <p class="ending-kicker">PIXEL CORE SANCTUARY</p>
        <h2 id="sanctuaryEndingTitle">최종 관리자 결정</h2>
        <div id="endingChoicePanel">
          <p>세계의 다음 규칙을 선택합니다. 확정한 엔딩은 이 닉네임에 영구 기록됩니다.</p>
          <div class="ending-choice-grid">
            <button id="endingRestoreButton" type="button"><strong>복원</strong><small>사건 이전의 안정 규칙으로 되돌린다</small></button>
            <button id="endingSealButton" type="button"><strong>봉인</strong><small>현재 세계를 지키고 재작성 권한을 닫는다</small></button>
            <button id="endingResonateButton" type="button"><strong>공명</strong><small>상호 승인으로 작동하는 새로운 규칙을 만든다</small></button>
          </div>
          <p id="endingLockedReason" class="ending-locked-reason" aria-live="polite"></p>
          <div class="ending-choice-actions">
            <button id="endingDeferButton" class="secondary-button" type="button">결정 보류</button>
          </div>
        </div>
        <div id="endingConfirmPanel" hidden>
          <p id="endingConfirmText" class="modal-description"></p>
          <div class="ending-confirm-actions">
            <button id="endingConfirmCancel" class="secondary-button" type="button">다시 선택</button>
            <button id="endingConfirmButton" class="primary-button" type="button">이 선택 확정</button>
          </div>
        </div>
        <p id="endingSubtitle" class="ending-subtitle" aria-live="polite"></p>
        <div id="endingCredits" class="ending-credits" hidden>
          <div id="endingCreditsText" class="ending-credits-text"></div>
          <button id="endingCreditsSkip" class="secondary-button" type="button" disabled>크레딧 건너뛰기</button>
        </div>
      </div>
    </section>
`;
  html = html.replace('\n  <noscript>', `${markup}\n  <noscript>`);
  fs.writeFileSync(path, html);
}
