# Firebase 배포 및 온라인 연결

Firebase 프로젝트: `pixel-world-8cb9b`

이 프로젝트는 Firebase Hosting, Authentication 익명 로그인, Realtime Database를 사용합니다.

## 현재 완료된 설정

- Firebase 웹 앱 설정 연결
- `.firebaserc` 프로젝트 별칭 연결
- `firebase.json` Hosting 및 Database 규칙 설정
- Firebase Hosting GitHub Actions 워크플로 추가
- 익명 인증 및 Realtime Database 클라이언트 코드 구현
- 원격 플레이어 위치 보간 및 접속 종료 자동 삭제 구현
- 전체 월드 채팅, 플레이어 말풍선 및 접속 종료 시 채팅 자동 삭제 구현

## 1. 익명 로그인 활성화

Firebase Console에서 다음 경로로 이동합니다.

`Authentication > Sign-in method > Anonymous > Enable`

## 2. Realtime Database 만들기

1. `Build > Realtime Database > Create Database`로 이동합니다.
2. 앱 이용자와 가까운 리전을 선택합니다.
3. 잠금 모드로 생성합니다.
4. 생성된 Database URL을 복사합니다.
5. `src/firebase-config.js`의 빈 `databaseURL` 값에 붙여 넣습니다.

예시 형식:

```js
databaseURL: "https://pixel-world-8cb9b-default-rtdb.REGION.firebasedatabase.app"
```

## 3. Database 보안 규칙 배포

저장소의 `database.rules.json`을 Firebase Console의 Realtime Database `Rules` 탭에 붙여 넣고 게시하거나 Firebase CLI로 배포합니다.

```bash
firebase deploy --only database
```

이 명령은 운영 Realtime Database 규칙을 즉시 변경합니다. 로컬 테스트와 보안 검사를 완료하고 배포 승인을 받은 뒤 실행해야 합니다. 채팅 클라이언트만 먼저 배포하고 규칙을 배포하지 않으면 채팅 쓰기가 거부됩니다.

## 4. Firebase Hosting 자동 배포 연결

워크플로 파일:

`.github/workflows/firebase-hosting-merge.yml`

필요한 GitHub Actions Secret:

`FIREBASE_SERVICE_ACCOUNT_PIXEL_WORLD_8CB9B`

Firebase CLI에서 아래 명령을 실행하면 GitHub 저장소 연결, 서비스 계정 생성, Secret 등록 과정을 자동으로 진행할 수 있습니다.

```bash
firebase login
firebase init hosting:github
```

저장소는 `dkrnahs515-stack/pixel_world`, 배포 브랜치는 `main`을 선택합니다.

푸른 해안의 변경되지 않은 ES 모듈은 `-20260829-coast.js` 물리 파일명을 유지합니다. 만료 lease hotfix에서 변경된 controller와 캐시 의존 상위 모듈은 `coop-boss-controller-20260902-lease.js` → `game-20260902-lease.js` → `main-20260902-lease.js` 체인을 사용하며, HTML의 CSS 버전도 `20260902-lease`로 맞춥니다. 새 릴리스에서 모듈을 수정할 때는 엔트리만이 아니라 변경 모듈부터 엔트리까지 재귀 import 상위 그래프의 물리 버전을 함께 올리고 `tests/coast-cache-contract.test.mjs`를 통과시켜야 합니다.

## 5. 수동 배포

Firebase CLI가 설치된 컴퓨터에서 저장소 루트 기준으로 실행합니다.

```bash
npm install -g firebase-tools
firebase login
firebase use pixel-world-8cb9b
firebase deploy --only hosting,database
```

배포 주소:

- `https://pixel-world-8cb9b.web.app`
- `https://pixel-world-8cb9b.firebaseapp.com`

## 온라인 구조

- 익명 인증으로 플레이어별 UID 발급
- `rooms/public/players/{uid}`에 위치, 방향과 현재 `mapId` 저장
- 위치는 초당 최대 20회 전송
- 같은 `mapId`에 있는 원격 캐릭터만 보간하여 부드럽게 표시
- 이전 데이터에 `mapId`가 없으면 중앙 마을(`village`)로 처리
- 접속 종료 시 `onDisconnect().remove()`로 플레이어 데이터 삭제
- `rooms/public/chat/{uid}/{messageId}`에 전체 월드 채팅 저장
- UID별 메시지는 최대 5개이며 새 메시지 추가와 오래된 메시지 삭제를 한 번의 원자적 갱신으로 처리
- `rooms/public/chat` 전체를 구독하므로 지역이 달라도 채팅 패널에서는 메시지 확인 가능
- 캐릭터 말풍선은 같은 `mapId`의 최신 메시지만 4초간 표시
- 재연결 시 플레이어와 채팅의 `onDisconnect().remove()`를 다시 예약
- `database.rules.json`에서 본인 데이터만 수정 가능

허용되는 물리 `mapId`는 정확히 `village`, `forest`, `volcano`, `coast-beach`, `coast-wreck-bay`, `coast-flooded-station`, `coast-tide-core-cave` 일곱 개입니다. 레거시 `coast`, 빈 값, 미등록 ID는 규칙에서 거부합니다.

맵별 좌표 경계는 다음과 같습니다.

- `village`: `2,880 × 1,800`
- `forest`: `4,320 × 3,600`
- `volcano`: `4,320 × 3,600`
- `coast-beach`, `coast-wreck-bay`, `coast-flooded-station`, `coast-tide-core-cave`: 각각 `2,160 × 1,800`

좌표가 음수이거나 해당 맵의 최대 경계를 넘으면 플레이어 쓰기와 보스 공격 요청을 거부합니다. 월드 확장 코드를 배포할 때 갱신된 `database.rules.json`도 함께 게시해야 온라인 이동이 거부되지 않습니다.

### 협동 보스 동기화와 거부 조건

- 관리자 브라우저는 보스 상태를 `2Hz`(초당 2회)로 게시하며 3분 재등장과 lease 기반 관리자 승계를 유지합니다.
- 공격 요청의 경로 `sequence`와 숫자 payload `sequence`가 정확히 대응하지 않으면 규칙과 관리자 클라이언트가 요청을 거부하고 실제 경로만 정리합니다.
- 보상 claim 생성은 현재 처치(`defeated`) 상태인 `encounter`와 경로 ID가 다르면 거부합니다. 이미 생성된 24시간 claim은 이후 보스가 재등장해도 해당 기여자가 수령할 수 있습니다.
- 처치 상태와 contributor별 claim은 하나의 교차 경로 transaction으로 저장되지 않습니다. 상태 게시 뒤 각 UID claim을 독립적인 멱등 transaction으로 기록하고, 부분 실패·재연결·관리자 승계 시 누락 claim만 재조정합니다.

## Firebase 키와 보안 점검

- `src/firebase-config.js`의 Firebase 웹 API 키는 브라우저에서 사용하는 공개 전제 식별자입니다.
- Firebase Admin SDK 개인 키 또는 서비스 계정 JSON 값은 소스코드에 저장하지 않습니다.
- GitHub Actions 워크플로에는 `${{ secrets.FIREBASE_SERVICE_ACCOUNT_PIXEL_WORLD_8CB9B }}` 참조만 저장하고 실제 값은 GitHub Actions Secret에서 관리합니다.
- Realtime Database 규칙은 인증된 사용자만 읽고, 각 사용자가 자신의 UID 아래 데이터만 수정하도록 제한합니다.
- Google Cloud HTTP 리퍼러 제한, Firebase App Check, GitHub Secret scanning 상태는 각 서비스 콘솔에서 별도로 확인합니다.

## App Check 운영 적용 순서

App Check는 실제 이용자를 차단하지 않도록 관찰 후 강제 적용합니다.

1. Firebase Console의 App Check에서 GitHub Pages 웹 앱을 등록합니다.
2. 웹 provider로 reCAPTCHA Enterprise를 선택하고 공식 GitHub Pages 일반 주소를 등록합니다.
3. 공식 주소와 `?qa=1` 점검 주소에서 요청 metric(메트릭)을 먼저 관찰합니다.
4. 유효 요청 비율과 세 직업·협동 보스 플레이가 정상인지 확인한 뒤 Realtime Database enforcement(강제 적용)를 켭니다.
5. 강제 적용 전 로컬·CI 검증은 Firebase Emulator 또는 App Check debug token(디버그 토큰)을 사용합니다.

사이트 키가 실제 프로젝트에 등록되기 전에는 임의 키를 저장소에 넣거나 enforcement를 먼저 활성화하지 않습니다.
