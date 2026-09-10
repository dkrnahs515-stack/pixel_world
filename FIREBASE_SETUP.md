# Firebase 배포 및 온라인 연결

Firebase 프로젝트: `pixel-world-8cb9b`

이 프로젝트는 Firebase Hosting, 익명 Authentication, Realtime Database를 사용합니다. GitHub Pages는 공식 솔로/진입 주소를 유지하고, 온라인 모드에서만 Firebase 네트워크 기능을 사용합니다.

## 현재 온라인 범위

- 익명 인증으로 플레이어 UID 발급
- 최대 10명의 공개방 슬롯
- 같은 물리 맵 플레이어 위치·방향·직업·장착 무기 동기화
- 전체 월드 채팅과 같은 맵 말풍선
- 숲·푸른 해안·활화산 지역 협동 보스
- 픽셀 코어 성역 최종 보스 `ORIGIN-0` 공유 encounter
- 위치 2Hz 상한, 보스 상태 2Hz, 채팅/보상 데이터 만료 정리
- 5초 이상 연결이 끊기면 로컬 진행을 유지한 채 솔로 fallback

`introSeen`, 개인 퀘스트/챕터 진행, TRINITY, 엔딩 선택과 칭호는 Firebase에 저장하지 않습니다.

## 1. 익명 로그인

Firebase Console:

`Authentication > Sign-in method > Anonymous > Enable`

## 2. Realtime Database

Database URL은 `src/firebase-config.js`의 `databaseURL`에 설정합니다.

예시:

```js
databaseURL: "https://pixel-world-8cb9b-default-rtdb.REGION.firebasedatabase.app"
```

## 3. Database 규칙

저장소의 `database.rules.json`이 운영 규칙 원본입니다.

```bash
firebase deploy --only database
```

운영 규칙 배포 전에는 Firebase Emulator allow/deny 테스트를 통과해야 합니다.

### 허용 물리 mapId

현재 정확히 15개 물리 맵을 사용합니다.

- `village` — 2880×1800
- `forest` — 4320×3600
- `coast-beach` — 2160×1800
- `coast-wreck-bay` — 2160×1800
- `coast-flooded-station` — 2160×1800
- `coast-tide-core-cave` — 2160×1800
- `volcano` — 2160×1800
- `volcano-magma-route` — 2160×1800
- `volcano-observatory` — 2160×1800
- `volcano-core-caldera` — 2160×1800
- `sanctuary` — 2160×1800
- `sanctuary-resonance-hall` — 2160×1800
- `sanctuary-origin-archive` — 2160×1800
- `sanctuary-zero-boundary` — 2160×1800
- `sanctuary-core-heart` — 2160×1800

레거시 `coast`, 누락값, 미등록 mapId, 음수 좌표, 맵 경계를 넘는 좌표는 거부합니다.

## 4. 데이터 구조

### 플레이어 presence

`rooms/public/players/{uid}`

현재 위치·방향·물리 `mapId`·직업·장착 무기·온라인 생존 판정에 필요한 제한된 HP 상태를 저장합니다. 이동 중 위치 쓰기는 최대 2Hz이며 정지 중에는 30초 heartbeat를 사용합니다. 최초 `joinedAt`은 같은 UID가 임의로 교체할 수 없습니다.

직업별 장착 무기는 허용된 해당 직업 무기만 전송할 수 있습니다. 히든 무기는 명시적인 일치 `classId`가 있어야 합니다.

다음 값은 presence에 넣지 않습니다.

- `introSeen`
- 개인 레벨/Gold 전체 저장 객체
- 개인 챕터 진행
- 엔딩 선택/칭호
- `TEACHER` 무적 권한
- `BOSSKILLBOSS` 삼중 보스 권한

### 전체 채팅

`rooms/public/chat/{uid}/{messageId}`

UID별 최근 메시지는 최대 5개를 유지하고 전체 채팅 구독은 최근 목록을 표시합니다. 정상 종료와 연결 종료 시 해당 UID 채팅을 정리합니다.

### 공유 보스

기존 지역 보스 경로:

- `rooms/public/bosses/forest`
- `rooms/public/bosses/coast-tide-core-cave`
- `rooms/public/bosses/volcano-core-caldera`

최종 보스 경로:

- `rooms/public/bosses/sanctuary-core-heart`

보스 하위 구조는 기존 공유 계약을 사용합니다.

- `state` — 현재 encounter/HP/위치/authority lease
- `attacks/{uid}/{sequence}` — 플레이어 공격 요청
- `playerDamage/{uid}/{eventId}` — authority가 생성한 피해 이벤트
- `rewardClaims/{uid}/{encounterId}` — 개인 수령/완료 claim

공격 damage는 클라이언트 요청값을 신뢰하지 않고 서버 역할을 하는 authority가 직업·레벨·무기·스킬 자원·위치·방향·시간·sequence로 다시 계산합니다.

## 5. ORIGIN-0 온라인 계약

`ORIGIN-0 — 최초의 수호자`는 `sanctuary-core-heart`에서만 공유되는 최종 보스입니다.

- 솔로 base HP: 1200
- 온라인 HP는 기존 party multiplier 계약을 사용
- 최대 공개방 10명
- HP·위치·phase·3개 core anchor·rewrite 진행을 공유
- authority lease가 만료되거나 현재 authority가 나가면 다음 참가자가 마지막 확정 상태를 이어받음
- Phase 4의 anchor가 활성 상태이면 보스를 1 HP 아래로 끝낼 수 없음
- 처치 후 기존 지역 보스와 같은 3분 lifecycle을 사용할 수 있지만, 개인적으로 처치 영수증을 가진 플레이어는 재등장 ORIGIN 전투에 다시 참여하지 않음

ORIGIN `rewardClaims`는 일반 EXP/Gold 보상이 아니라 **개인 로컬 처치 영수증 전달용 0/0 claim**입니다. 게임은 해당 claim을 받으면 먼저 닉네임의 v8 로컬 저장에 `originDefeated`와 encounter receipt를 기록합니다. 로컬 저장 성공 후에만 원격 claim을 acknowledge합니다.

저장 성공 후 그 클라이언트는 `sanctuary-core-heart`에서 ORIGIN spectator가 됩니다.

- 이후 공유 ORIGIN을 로컬에 렌더링하지 않음
- ORIGIN 공격을 보내지 않음
- ORIGIN의 playerDamage를 적용하지 않음
- `결정 보류` 후 성역을 다시 탐사하고 엔딩 선택으로 돌아갈 수 있음
- 같은 온라인 파티의 다른 플레이어 전투/선택에는 영향을 주지 않음

엔딩 `restore`, `seal`, `resonate`, 엔딩 칭호와 EXP/Gold 보상은 Firebase에 쓰지 않습니다. 같은 ORIGIN을 함께 처치한 플레이어가 서로 다른 엔딩을 선택할 수 있습니다.

## 6. TRINITY와 보상 코드 경계

`TRINITY`는 솔로와 온라인 모두 **개인 로컬 중간 보스**이며 Firebase boss 경로를 사용하지 않습니다.

- base HP 800
- 온라인에서도 다른 플레이어와 HP/phase를 공유하지 않음
- `BOSSKILLBOSS`로 수가 늘어나지 않음

`TEACHER`와 `BOSSKILLBOSS`는 솔로 전용입니다. Firebase presence/attack payload에 특수 권한을 싣지 않습니다. `BOSSKILLBOSS`는 숲·해안·활화산 기존 지역 보스에만 적용하고 TRINITY와 ORIGIN에는 적용하지 않습니다.

## 7. 캐시 안전 릴리스

현재 브라우저 물리 엔트리:

- JS: `src/main-20260910-sanctuary.js`
- CSS: `styles-20260910-sanctuary.css`

성역 릴리스에서 변경된 ES 모듈과 그 import 상위 그래프는 `20260910-sanctuary` 물리 파일 체인을 사용합니다. 쿼리 문자열 버전에 의존하지 않습니다. `tests/sanctuary-cache-contract.test.mjs`가 변경된 parent가 이전 physical copy의 변경 child를 참조하지 않는지 검사합니다.

## 8. Firebase Hosting

자동 배포 워크플로:

`.github/workflows/firebase-hosting-merge.yml`

필요한 GitHub Actions Secret:

`FIREBASE_SERVICE_ACCOUNT_PIXEL_WORLD_8CB9B`

배포 브랜치는 `main`입니다.

수동 배포:

```bash
npm install -g firebase-tools
firebase login
firebase use pixel-world-8cb9b
firebase deploy --only hosting,database
```

Hosting 주소:

- `https://pixel-world-8cb9b.web.app`
- `https://pixel-world-8cb9b.firebaseapp.com`

## 9. 테스트

PR과 `main`에서는 다음 검증을 유지합니다.

```bash
node --test tests/*.test.mjs tests/*.static.test.cjs
for file in src/*.js; do node --check "$file"; done
```

Realtime Database:

```bash
firebase emulators:exec --only database -- <rules test command>
```

브라우저 smoke는 기존 솔로·기본·채팅·해안·활화산 회귀 뒤에 `tests/sanctuary-browser-smoke.cjs`를 실행해 첫 플레이 인트로와 성역 최종장을 검증합니다.

## 10. 보안

- Firebase 웹 API 키는 브라우저 공개 식별자 전제입니다.
- Firebase Admin SDK 개인 키/서비스 계정 JSON은 저장소에 커밋하지 않습니다.
- GitHub Actions에는 Secret 참조만 저장합니다.
- Realtime Database는 인증 사용자와 경로별 본인 쓰기/authority 쓰기 조건을 규칙으로 제한합니다.
- App Check는 metric을 먼저 관찰한 뒤 강제합니다.
- 공식 GitHub Pages 주소와 `?qa=1` QA 주소를 모두 관찰한 후 enforcement를 적용합니다.
