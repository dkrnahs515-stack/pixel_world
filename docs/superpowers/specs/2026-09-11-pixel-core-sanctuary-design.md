# 픽셀 코어 성역 설계 명세

- 작성일: 2026-09-11
- 기준 저장소: dkrnahs515-stack/pixel_world
- 기준 브랜치: main
- 기준 커밋: 1c802981e2ceeffc68c42b47b39d533cfad86509
- 구현 브랜치: codex/pixel-core-sanctuary
- 릴리스 접미사: -20260911-sanctuary
- 상태: 대화 설계 승인 후 구현 전 명세

## 1. 목적

현재 안전지대 입구만 있는 픽셀 코어 성역을 제12장 「세계가 버린 기억」, 제13장 「마지막 귀환 기록」, 제14장 「세 개의 미래」를 잇는 네 개의 2160×1800 물리 맵으로 확장한다.

성역은 기억의 순서를 복원하고, 잘못된 기록을 지우지 않은 채 정정 기록을 연결하고, 이름을 잃은 기억의 결속을 풀고, 세 미래 중 하나를 개인별로 선택하는 서사형 퍼즐 지역이다. 최신 추가 요구에 따라 최종 보스 “무명의 합창”을 포함하되, 별개의 악의를 가진 괴물이나 처치 대상이 아니라 잘못 엉킨 기억을 분리하는 협력 전투로 설계한다.

기존 저장, 활화산 분기, 솔로/온라인 전환, 포털 구조, 순수 전이 함수, Firebase 인증 경계를 유지한다.

## 2. 비목표와 금지 원칙

- 기존 화구의 선발대장 전투에 성역 시험 기능이나 신규 전투 규칙을 넣지 않는다.
- 무명의 합창 외에 성역 수호자나 별도 보스를 추가하지 않는다.
- 최초 기록관을 단순 악당으로 만들지 않는다. 삭제는 당시의 공포와 보호 의도가 섞인 선택으로 기록한다.
- 루멘을 코어 분열의 범인으로 확정하지 않는다. 루멘의 선택과 코어 자가분열 원인을 분리한다.
- captainOutcome이 lost일 때 루멘을 부활시키지 않는다.
- 가렌의 흉터와 후유증은 어떤 결말에서도 완치되지 않는다.
- 에코를 단순 안내 AI로 축소하지 않는다.
- 기존 오기록을 삭제하지 않는다.
- 세 결말에 진엔딩, 배드엔딩, 점수, 선악 또는 능력치 우열을 부여하지 않는다.
- 재의 서약이나 특정 직업 무기를 필수 조건으로 사용하지 않는다.
- 진행에 따라 물리 문 충돌 데이터를 바꾸지 않는다.
- 일반 공격으로 무명의 합창의 결속도를 직접 감소시키지 않는다.
- 보스 종료에 죽음, 처치, 폭발, 시체 연출을 사용하지 않는다.
- 개인 오염도, 개인 진행, endingChoice를 공유 Firebase 상태에 기록하지 않는다.

기존 “성역 보스 추가 금지” 요구는 뒤에 명시적으로 승인된 무명의 합창 한 건에 한해서만 대체된다. 그 밖의 보스 금지는 유지한다.

## 3. 기준 구조와 통합 원칙

현재 main은 index.html이 물리 릴리스 파일명을 직접 import하는 구조이며, 활성 JavaScript 그래프는 78개 모듈이다. 구현은 기존 region/world/story interaction/chapter progress/portal 구조와 순수 전이 함수 패턴을 재사용한다.

통합 원칙은 다음과 같다.

- index.html의 CSS 및 JavaScript import는 구현 마지막에 새 릴리스 접미사로 전환한다.
- 활성 import 그래프의 물리 파일은 모두 동일한 -20260911-sanctuary 접미사를 사용한다.
- 기존 릴리스 파일은 삭제하거나 덮어쓰지 않는다.
- 새 모듈은 성역 전용 데이터, 전이, 렌더링, 네트워크 책임을 나눠 추가한다.
- mapId 판정은 문자열 접두사 추론이 아니라 명시적 상수 집합을 사용한다.
- 무명의 합창은 기존 일반 협력 보스 목록과 상태 경로에 넣지 않고 전용 컨트롤러와 전용 Firebase 경계를 사용한다.
- 기존 sanctuary mapId와 화구 제단 왕복 포털을 유지한다.
- 기존 v1~v7 저장은 입력을 먼저 보존한 뒤 v8로 정규화한다.

## 4. 월드 흐름과 네 개 맵

포털 흐름은 다음과 같다.

    caldera
      ↕
    sanctuary
      ↕
    sanctuary-memory-archive
      ↕
    sanctuary-return-record
      ↕
    sanctuary-three-futures

모든 맵은 2160×1800이며, 충돌 데이터는 정적이다. 조건을 만족하지 않은 다음 맵 포털은 비활성 상호작용으로 남고, 조건 충족 시 같은 포털을 활성화한다.

### 4.1 sanctuary — 픽셀 코어 성역 입구

역할은 전투 없는 안전지대와 세 지역 코어의 안치 공간이다.

- 정확히 세 개의 봉인함만 배치한다.
- 봉인함 ID는 forest-core-casket, coast-core-casket, volcano-core-casket이다.
- 숲 초록, 해안 파랑, 화산 주황의 연결선을 각 봉인함에서 중앙 성역 장치로 잇는다.
- 루멘과 가렌을 이 맵의 상주 인물로 배치하지 않는다.
- 화구 제단과의 기존 왕복 포털은 유지한다.
- 세 activatedCoreIds가 모두 정규화된 상태로 존재할 때 기억 회랑 포털을 연다.
- 다른 플레이어의 진행은 봉인함 활성화나 포털 해금에 영향을 주지 않는다.

### 4.2 sanctuary-memory-archive — 기억 회랑

역할은 제12장의 기억 순서 복원, 원본 기록 공개, 완벽한 귀환 환영 거부다.

네 소리의 ID와 정답 순서는 다음과 같다.

1. departure-bell — 출정 종
2. dawn-bird — 새벽새
3. tide-bell — 밀물 종
4. mine-shift-bell — 광산 교대 종

플레이어는 네 소리를 수집한 뒤 memorySequence를 제출한다. 오답은 진행을 완료시키지 않고, 수집 상태는 보존하며, 즉시 재시도할 수 있다. 정답 전이는 memoryOrderSolved를 true로 만든다.

정답 뒤 다음 원본을 순서대로 연다.

- false-return-resonance-time: 4시 13분 22초는 사건 시각이 아니라 코어와 기록이 겹친 공명 시각이다.
- first-archivist-deletion-log: 최초 기록관은 혼란과 2차 피해를 막으려 일부 기록을 삭제했지만, 그 결과 이름과 책임이 함께 사라졌다.
- core-self-division-original: 코어는 외부의 단일 범인이 깨뜨린 것이 아니라 상충하는 귀환 기록을 견디지 못해 자가분열했다.

원본 공개 뒤 완벽한 귀환 환영을 보여 준다. 환영은 또렷한 얼굴 대신 흐릿한 실루엣, 손, 건축물, 묘비, 빛의 흔적으로 구성한다. 플레이어는 아래 모순을 모두 확인해야 거부할 수 있다.

- false-return-garen-unscarred: 가렌에게 흉터와 후유증이 없다.
- false-return-source-erased: 귀환의 대가와 삭제된 이름이 존재하지 않는다.
- false-return-resonance-time: 공명 시각을 사건 시각으로 오기록했다.

모순 확인 후 거부하면 falseReturnRejected가 true가 된다. 짧은 노이즈 방어전은 브라우저별 로컬 몬스터 상태로 허용하지만 별도 보스, 공유 HP, 공유 처치 상태를 만들지 않는다.

memoryOrderSolved, coreTruthRevealed, falseReturnRejected가 모두 true일 때 마지막 귀환 기록실 포털을 연다.

### 4.3 sanctuary-return-record — 마지막 귀환 기록실

역할은 제13장의 정정 기록 작성과 무명의 합창 전투다.

작성해야 할 기록 필드는 다음과 같다.

- vanguard-return-state — 선발대 귀환 상태
- core-division-cause — 코어 분열 원인
- delay-roan — 로안의 선택과 지연 책임
- delay-sera — 세라의 선택과 지연 책임
- delay-garen — 가렌의 선택과 지연 책임
- delay-lumen — 루멘의 선택과 지연 책임

각 필드는 자료를 읽고 선택지를 검증한 뒤 completedRecordFieldIds에 추가한다. 루멘의 책임과 코어 분열 원인은 반드시 서로 다른 필드로 유지한다.

기존 오기록은 삭제하지 않는다. 모든 필드가 완료되면 원본 기록 ID, 정정 기록 ID, 근거 기록 ID를 잇는 correction link를 생성한다. 전이 결과는 correctionLinked=true이며, 원본은 기록 보관함에서 계속 읽을 수 있다.

correctionLinked가 true가 되면 노이즈가 정정을 또 다른 삭제로 오해한다. 이때 배경 오버레이와 소리가 응집되고 무명의 합창 전투가 시작된다. 보스는 제12장 초반에 등장하지 않으며, 정정 연결 전에는 생성되지 않는다.

전투가 separated 상태로 끝나고 개인 완료 청구가 검증되면 chorusSeparated=true가 된다. 이 값이 세 개의 미래 포털 해금 조건이다.

### 4.4 sanctuary-three-futures — 세 개의 미래

역할은 제14장의 증언 확인, 미래 미리보기, 개인 결말 확정이다.

다섯 의견 ID는 roan, sera, garen, lumen, echo다.

- captainOutcome=rescued이면 lumen은 생존한 현재 인물의 직접 증언이다.
- captainOutcome=lost이면 lumen을 등장시키지 않고 미전송 철수 명령서와 잔류 기억을 같은 증언 슬롯의 자료로 사용한다.
- 두 분기 모두 다섯 의견을 완료할 수 있고, 세 결말 선택 자격이 동일하다.

봉인, 재결합, 해방은 결과와 대가를 모두 선택 전에 보여 준다. previewedFutureIds에는 seal, restore, release가 모두 있어야 한다.

선택은 두 단계다.

1. 첫 확인은 해당 미래의 독립 장면, 대가, 칭호, 에코 상태를 다시 보여 주는 런타임 선택이다.
2. 두 번째 확인만 endingChoice 저장을 시도한다.

두 번째 저장이 성공해야 endingChoice와 completed가 확정된다. 저장 실패 시 첫 확인 화면으로 돌아가며 다른 결말을 선택할 수 있다. 최종 선택 연출 중 원격 플레이어와 채팅을 숨기고, 완료 또는 취소 후 복원한다.

공통 에필로그는 사용하지 않는다. 각 결말은 독립 장면과 독립 마지막 문장으로 종료한다.

## 5. 로컬 영구 진행 상태와 저장 마이그레이션

v8의 기본 성역 상태는 다음과 같다.

    chapters.sanctuary = {
      activatedCoreIds: [],
      collectedMemoryIds: [],
      memorySequence: [],
      memoryOrderSolved: false,
      coreTruthRevealed: false,
      falseReturnRejected: false,
      completedRecordFieldIds: [],
      correctionLinked: false,
      chorusSeparated: false,
      collectedTestimonyIds: [],
      previewedFutureIds: [],
      endingChoice: null,
      completed: false
    }

endingChoice 허용값은 seal, restore, release뿐이다.

### 5.1 정규화

- 배열 필드는 배열이 아니면 빈 배열로 바꾼다.
- 배열 항목은 문자열만 받고, 각 필드의 허용 ID 집합으로 필터링하며, 중복을 제거한다.
- boolean 필드는 값이 정확히 true일 때만 true다. "true", 1, 객체 등은 false다.
- memorySequence는 네 개의 허용 소리 ID만 유지하되, 정답 배열과 정확히 같을 때만 memoryOrderSolved를 인정한다.
- endingChoice는 세 허용값 외에는 null이다.
- completed는 endingChoice가 유효하고 모든 선행 조건이 충족된 경우에만 true다.
- 뒤 단계 상태가 있어도 앞 단계 의존성이 깨져 있으면 뒤 상태를 안전하게 내린다. 예를 들어 correctionLinked가 false이면 chorusSeparated와 endingChoice와 completed를 인정하지 않는다.
- boss shared snapshot은 영구 저장 migration 입력으로 사용하지 않는다.
- captainOutcome은 기존 값을 그대로 보존하며 sanctuary 내부로 복제하지 않는다.

### 5.2 의존성

- memoryOrderSolved는 네 소리 정답 배열에 의존한다.
- coreTruthRevealed는 memoryOrderSolved에 의존한다.
- falseReturnRejected는 coreTruthRevealed와 모순 기록 수집에 의존한다.
- correctionLinked는 여섯 기록 필드 완료에 의존한다.
- chorusSeparated는 correctionLinked와 검증된 전투 완료 청구에 의존한다.
- endingChoice는 chorusSeparated, 다섯 의견 수집, 세 미래 미리보기에 의존한다.
- completed는 유효한 endingChoice의 성공 저장에 의존한다.

v1~v7에는 새 상태를 기본값으로 추가하고 기존 필드는 손실 없이 보존한다. v8 입력도 같은 정규화기를 통과시켜 손상된 배열, 문자열 boolean, 허용되지 않은 endingChoice가 완료 상태를 만들지 못하게 한다.

## 6. 범용 기록 보관함

기존 해안 전용 통신 기록 UI를 source/region/chapter 메타데이터를 받는 범용 기록 보관함으로 확장한다.

기록 항목은 최소 다음 필드를 갖는다.

    {
      id,
      chapterId,
      sourceRegionId,
      title,
      body,
      discoveredAt,
      recordKind,
      correctsRecordId,
      evidenceRecordIds
    }

- 기존 해안 통신 기록은 데이터 변경 없이 어댑터를 거쳐 같은 보관함에 표시한다.
- 성역 소리, 삭제 기록, 코어 자가분열 원본, 오기록, 정정 연결, rescued/lost 증언을 다시 읽을 수 있다.
- 정정 기록은 correctsRecordId로 원본을 가리키며 원본을 삭제하거나 대체하지 않는다.
- 기록 정렬과 필터는 UI 관심사이며 진행 전이는 record ID만 사용한다.

## 7. 무명의 합창 상태 머신

### 7.1 의미

무명의 합창은 이름, 시간, 주인을 잃은 기억들이 다시 지워지지 않기 위해 서로 결속해 만든 임시 육체다. 나무뿌리, 바닷물, 용암 균열, 검은 간섭이 뒤섞여 보이지만 얼굴은 특정 인물로 고정하지 않는다.

UI에는 hp 대신 “노이즈 결속도”를 표시한다. 기존 게이지 부품 호환을 위해 내부 hp/maxHp를 결속도 0~100에 재사용할 수 있다. 이 값은 승인된 전이만 감소시키며 일반 공격 damage 값으로 직접 감소하지 않는다.

### 7.2 공유 상태

전용 순수 reducer가 다음 공유 상태를 다룬다.

    {
      encounterId,
      bossId: "unnamed-chorus",
      mapId: "sanctuary-return-record",
      status: "active" | "separated" | "reforming",
      phase: "anchors" | "testimonies" | "onslaught" | "separated",
      hp,
      maxHp: 100,
      stabilizedAnchorIds,
      resolvedTestimonyIds,
      severedBondIds,
      activeRecordId,
      currentPatternId,
      patternStartedAt,
      patternEndsAt,
      vulnerableUntil,
      lumenAssistUsed,
      contributors,
      authorityUid,
      authorityEpoch,
      leaseUntil,
      spawnedAt,
      updatedAt,
      separatedAt,
      reformAt
    }

Firebase에서는 ID 집합을 boolean map으로 저장할 수 있으며 클라이언트 경계에서 정렬된 배열로 정규화한다. 불명 필드와 잘못된 phase/status, 범위 밖 hp, 허용되지 않은 ID는 거부하거나 안전한 초기값으로 내린다.

### 7.3 개인 런타임 상태

다음 값은 브라우저 메모리 안에서만 관리하고 Firebase 및 영구 저장에 쓰지 않는다.

    {
      contamination: 0,
      carriedFragmentId: null,
      processedContaminationEventIds: [],
      confusedUntil: 0,
      attackLockedUntil: 0,
      movementSlowUntil: 0
    }

독립 브라우저 컨텍스트마다 별도 상태를 갖는다. 한 플레이어의 오답, 오배치, 오염, 혼선이 다른 플레이어에게 전파되지 않는다.

### 7.4 단계 전이

    idle
      └─ correctionLinked → anchors (100)
          └─ 세 기록 닻 안정화 → testimonies (70)
              └─ 여섯 증언 해결 → onslaught (40)
                  └─ 네 결속선 분리 → separated (0)

#### anchors — 결속도 100→70

- 숲, 해안, 화산 기억 파편을 공격으로 생성한다.
- 공격은 파편 생성에만 쓰며 결속도를 직접 줄이지 않는다.
- 플레이어는 한 번에 파편 하나만 운반한다.
- 올바른 지역 닻에 배치하면 닻을 안정화하고 결속도를 정확히 10 줄인다.
- forest, coast, volcano 세 닻이 각각 한 번 안정화되어 70이 된다.
- 이미 안정화된 닻과 중복 action은 변화가 없는 멱등 전이다.
- 오배치하면 공유 상태를 바꾸지 않고 해당 브라우저의 오염도만 올린다.

#### testimonies — 결속도 70→40

각 증언은 사실, 일부 사실, 근거 없음 중 하나로 판정한다. 여섯 항목은 각각 최초 정답 한 번에만 결속도를 5 줄인다.

- 코어 자가분열 원본 — 사실
- 루멘이 코어 분열을 일으켰다 — 근거 없음
- 루멘이 분화를 늦추기 위해 봉인을 건드렸다 — 사실
- 귀환 지연은 루멘 한 명의 책임이다 — 근거 없음
- 최초 기록관의 삭제는 모두를 보호했다 — 일부 사실
- 4시 13분 22초는 사건 시각이다 — 근거 없음

오답은 공유 증언을 해결하지 않고 해당 플레이어의 오염도만 올린다. 루멘의 책임과 코어 분열 원인은 reducer와 UI 모두 별개 항목으로 유지한다.

#### onslaught — 결속도 40→0

- 숲, 해안, 화산의 기존 시각/충돌 공격 패턴을 성역 데이터로 재구성해 순환한다.
- 패턴 순서는 authority가 timestamp 기반으로 진행하며 모든 클라이언트가 같은 currentPatternId와 시간 창을 본다.
- 로안, 세라, 가렌, 루멘 기록을 차례로 활성화한다. lost 루트의 루멘 슬롯은 미전송 철수 명령서와 잔류 기록을 표시한다.
- activeRecordId에 대응하는 기록이 활성화된 vulnerableUntil 구간에만 검은 결속선이 공격 가능하다.
- 네 결속선은 각각 최초 유효 분리 때 결속도를 10 줄인다.
- 취약 시간 밖 공격, 일반 몸통 공격, 중복 공격은 결속도를 줄이지 않는다.
- 검사, 궁수, 마법사는 서로 다른 타격 연출을 사용하되 같은 기록 활성화와 결속선 분리 전이를 수행한다.
- 직업별 damage나 무기 등급은 결속도 감소량에 영향을 주지 않는다.

#### separated — 결속도 0

- status와 phase를 separated로 바꾼다.
- 죽음, 폭발, 시체, 처치 문구를 만들지 않는다.
- 검은 연결선이 풀리고 숲, 해안, 화산 기억 파편이 분리된다.
- 검증된 기록은 증언 닻에 안정화한다.
- 이름 없는 기억은 어느 지역에도 강제로 귀속시키지 않고 중립 상태로 남긴다.
- 유효 기여자마다 개인 completion claim을 생성한다.
- 완료 문구는 정확히 다음 의미와 문장을 유지한다.

“무명의 합창의 결속이 풀렸습니다.
기억들은 아직 어느 곳에도 귀속되지 않았습니다.
이제 남겨진 기억의 운명을 결정해야 합니다.”

## 8. 오염도 규칙

오염도는 0~100 범위의 개인 런타임 게이지다.

- 잘못된 파편 배치와 잘못된 증언 판정만 오염 이벤트를 만든다.
- event ID로 중복 처리를 막는다.
- 100에 도달하면 운반 중인 파편을 원래 생성 가능 상태로 반환한다.
- 3초간 기억 혼선을 적용한다.
- 혼선 동안 공격을 막고 이동 속도를 낮춘다.
- 혼선 시작과 동시에 오염도를 50으로 복구한다.
- 영구 실패, 보상 박탈, 기록 삭제, 결말 잠금을 만들지 않는다.
- 연결 해제와 재연결은 다른 플레이어의 오염도에 영향을 주지 않는다.
- 페이지 재접속 시 런타임 오염도는 기본값으로 다시 시작하고 영구 진행은 유지한다.

HUD는 노이즈 결속도와 개인 오염도 두 게이지를 동시에 명확히 구분해 표시한다.

## 9. captainOutcome 분기

captainOutcome은 기존 활화산 결과를 그대로 사용한다.

### rescued

- 소설의 공식 흐름임을 기록 보관함 메타데이터로 설명한다.
- 루멘이 살아 있는 통신으로 자신의 선택과 책임을 직접 증언한다.
- 전투 중 근거 없는 거짓 명령을 한 번 끊는다.
- 기존 히든 무기를 보유했다면 플레이어가 기록 닻 하나를 한 번만 즉시 안정화할 수 있다.
- lumenAssistUsed는 encounter 단위 공유 멱등 값이다.
- 히든 무기는 편의 연출이며 공략 또는 결말의 필수 조건이 아니다.

### lost

- 게임 전용 대체 분기임을 기록 보관함 메타데이터로 설명한다.
- 루멘을 현재 인물이나 유령으로 부활시키지 않는다.
- 미전송 철수 명령서와 잔류 기억이 증언 닻과 기록 활성화 역할을 한다.
- 히든 무기 없이 모든 단계를 정상 공략할 수 있다.
- rescued와 동일한 EXP, Gold, 칭호 선택, 세 결말 접근성을 갖는다.

온라인에서 서로 다른 captainOutcome을 가진 플레이어가 함께 있으면 공유 reducer는 동일한 사실 ID와 전투 상태만 사용하고, 음성, 인물 표현, 자료 출처는 각 플레이어의 로컬 분기에 맞춰 표시한다.

## 10. 기여와 개인 완료 청구

공유 전투 기여 action은 다음 종류다.

- fragment-strike
- anchor-stabilize
- testimony-resolve
- record-activate
- bond-cut
- lumen-assist

contributors는 타격뿐 아니라 파편 배치, 증언 해결, 기록 활성화를 모두 인정한다. 허용된 단계에서 서버 규칙과 authority reducer가 승인한 action만 기여가 된다.

separated 전이 시 encounterId 아래 유효 contributors에 completion claim을 만든다. 각 클라이언트는 자신의 인증 UID에 대한 claim만 읽고 로컬 저장의 chorusSeparated 전이를 요청할 수 있다. 다른 사용자의 claim, chapter progress, endingChoice를 쓰지 못한다.

이미 separated인 encounter에 기여 없이 늦게 접속한 플레이어는 자동 완료되지 않는다. reformAt 이후 새 encounter에 참여할 수 있으며, 이 제한은 영구 결말 잠금이 아니다. 개별 브라우저가 온라인 전투 도중 연결 해제되어 솔로 모드로 전환되면 마지막 검증된 snapshot을 독립 로컬 전장으로 이어 가고, 그 뒤의 솔로 완료는 로컬 진행만 연다.

## 11. Firebase 구조와 보안 경계

### 11.1 플레이어와 채팅 mapId

기존 Firebase 플레이어/채팅 mapId 허용 목록에 다음을 추가한다.

- sanctuary-memory-archive
- sanctuary-return-record
- sanctuary-three-futures

기존 sanctuary는 유지한다. 메시지 작성자는 자기 인증 UID만 사용하며 허용 mapId 밖 위치나 채팅을 쓸 수 없다.

### 11.2 무명의 합창 전용 경로

    rooms/public/chorus/sanctuary-return-record/state
    rooms/public/chorus/sanctuary-return-record/actions/$uid/$sequence
    rooms/public/chorus/sanctuary-return-record/completionClaims/$encounterId/$uid

- state는 authority lease를 가진 인증 사용자만 허용된 스키마와 전이 범위 안에서 갱신한다.
- action 작성자는 경로의 $uid와 auth.uid가 같아야 한다.
- action은 종류별 필수 필드, encounterId, monotonic sequence, 허용 ID를 검증한다.
- 클라이언트가 hp 감소량, 완료 status, contributor 목록, 다른 사용자의 오염 결과를 직접 제출하지 못한다.
- completionClaims는 reducer가 만든 separated encounter와 contributor 사실에 의존하며, 사용자는 자기 claim만 소비한다.
- contamination, carriedFragmentId, chapters.sanctuary, endingChoice는 이 공유 트리에 두지 않는다.
- 기존 rooms/public/bosses allowlist와 공유 보스 규칙은 변경하지 않는다.

### 11.3 권한 이전과 멱등성

- authorityUid, authorityEpoch, leaseUntil을 사용한다.
- authority가 연결 종료되면 만료 뒤 인증된 참가자 중 결정적인 순서로 다음 authority가 lease를 획득한다.
- 새 authority는 가장 최신 shared state와 아직 처리하지 않은 sequence만 적용한다.
- action ID, UID/sequence, 안정화/해결/분리 ID 집합으로 중복을 막는다.
- 오래된 epoch, 다른 encounterId, 이미 처리한 action은 무시한다.
- Firebase server timestamp를 기준으로 취약 시간과 패턴 창을 계산해 로컬 시계 차이를 줄인다.
- 공유 상태 검증 실패는 클라이언트 성공으로 간주하지 않고 로컬 UI에 재시도 가능한 오류로 표시한다.

## 12. 솔로와 온라인 전환

동일한 순수 reducer에 transport만 바꾼다.

- 솔로는 메모리 transport와 로컬 authority를 사용한다.
- 온라인은 실제 Firebase SDK, 익명 인증 또는 현재 인증, Auth/Realtime Database 에뮬레이터 또는 운영 설정을 사용한다.
- 연결이 끊기면 마지막 검증 snapshot에서 솔로 controller를 시작한다.
- 성역 로컬 영구 진행과 개인 전투 상태는 연결 유무에 따라 덮어쓰지 않는다.
- 일반 노이즈 몬스터는 언제나 브라우저별 로컬 상태다.
- 재연결 시 독립 솔로 encounter를 공유 encounter에 억지로 병합하지 않는다. 현재 로컬 전투를 끝내거나 성역 기록실을 다시 진입한 뒤 새 공유 encounter에 참가한다.
- 원격 플레이어 렌더와 채팅은 결말 최종 연출 동안만 로컬로 숨긴다.

## 13. 시각 및 상호작용 설계

성역 전체는 백색과 청록을 바탕으로 하며, 지역 기원은 숲 초록, 해안 파랑, 화산 주황만 보조색으로 쓴다.

- 입구에는 정확히 세 봉인함을 둔다.
- 기억 화면은 선명한 얼굴을 피하고 흐릿한 실루엣, 손, 건축물, 묘비, 빛의 흔적으로 표현한다.
- 현실의 플레이어와 현재 시점 인물만 또렷하게 표현한다.
- 무명의 합창은 나무뿌리, 바닷물, 용암 균열, 검은 간섭의 임시 결속체다.
- 이름 없는 기억은 깨진 반사상, 부분적인 눈과 입, 흐릿한 윤곽으로 표현한다.
- 합창은 로안, 세라, 가렌, 루멘의 목소리를 흉내 낼 수 있으나 얼굴은 어느 한 인물로 고정하지 않는다.
- 봉인함 연결선, 기억 화면, 포털 빛, 정정 연결, 합창의 검은 선, 취약 기록은 정적 배경이 아니라 동적 오버레이로 렌더링한다.
- 동적 오버레이는 상태의 투영일 뿐 게임 판정의 원본이 아니다.
- 키보드 F는 근처 상호작용의 공통 진입점으로 유지한다.
- 결정 보류 뒤 재접속하거나 맵을 돌아와도 코어/미래 장치 근처 F로 결말 선택을 다시 연다.

## 14. 결말 상태, 보상, 장면

모든 결말은 정확히 300 EXP와 200 Gold를 지급한다. 능력치, 장비 성능, 다음 콘텐츠 접근성 차이를 만들지 않는다.

| endingChoice | 칭호 | 에코 상태 | 핵심 대가 |
| --- | --- | --- | --- |
| seal | 봉인의 계승자 | 봉인 안에서 생존하지만 바깥과의 목소리가 희미해짐 | 기억을 보호하는 대신 접근과 해석을 제한함 |
| restore | 이름의 복원자 | 자기 이름을 되찾고 독립한 뒤 현재 형태는 소멸함 | 이름을 돌려주지만 완벽한 과거는 재현하지 못함 |
| release | 해방의 기록자 | 어느 주인도 흉내 내지 않는 자기 목소리를 유지함 | 기억이 흩어져 일부는 다시 만날 수 없음 |

- 가렌은 세 결말 모두 흉터와 후유증을 가진 채 살아간다.
- 각 결말은 독립 장면, 독립 마지막 문장, 독립 시각 효과를 갖는다.
- 어떤 UI에도 진엔딩, 배드엔딩, 점수, 추천 선택을 표시하지 않는다.
- rewardId는 sanctuary-ending-$endingChoice처럼 결정적으로 만들고, EXP/Gold와 칭호 지급을 멱등 처리한다.
- endingChoice 저장 성공과 보상 저장은 별도 재시도 단계로 다룬다.
- endingChoice 저장 성공 후 보상 저장만 실패해도 컷신을 재생하고 복구 대기 상태를 남긴다.
- 재시도 시 완료된 reward component를 다시 지급하지 않는다.
- 결말을 바꾸어 중복 보상을 받지 못하도록 최초 성공한 endingChoice를 불변값으로 취급한다.

## 15. 오류 및 복구 정책

- 기록/퍼즐 저장 실패: UI 선택은 보존하고 영구 완료만 표시하지 않으며 재시도한다.
- endingChoice 저장 실패: 선택을 확정하지 않고 두 번째 확인으로 되돌린다.
- endingChoice 성공, 보상 실패: 결말 장면은 유지하고 reward ledger에서 누락된 EXP, Gold, 칭호만 재시도한다.
- Firebase action 거부: 공유 성공 연출을 하지 않고 개인 오염도도 소급 변경하지 않는다.
- authority 종료: lease 만료와 epoch 증가로 이전하며 처리된 action을 재적용하지 않는다.
- 비기여 늦은 접속: 완료 claim을 만들지 않고 다음 encounter 재형성 시 참여시킨다.
- 로컬 저장 손상: v8 정규화로 선행 조건을 재검증하며 기존 안전한 데이터는 보존한다.
- 브라우저 새로고침: 영구 성역 진행은 복원하고 개인 오염도/운반 파편은 초기화한다.

## 16. 영향 파일과 모듈 경계

구현 전에 main의 실제 파일명을 다시 확인한 뒤 아래 책임에 대응하는 활성 물리 파일을 복제하거나 신규 생성한다. 이름은 현재 저장소의 접미사 계약에 맞춘다.

기존 계층의 수정 범위:

- index.html — 활성 CSS/JS import를 마지막에 일괄 전환
- CSS 및 HUD/대화/기록 보관함 스타일
- regions/world map registry — 세 신규 mapId, 표시명, 크기, 정적 충돌, 포털
- story interaction/chapter progress — 성역 수집, 순서, 기록, 증언, 미래 선택
- save schema/migration — v8 성역 상태와 엄격 정규화
- renderer — 네 맵 배경과 동적 오버레이
- input/interaction — F 상호작용, 운반/배치, 결말 재열기
- Firebase player/chat validation — 신규 mapId
- 테스트와 브라우저 스모크 도구

신규 책임 모듈:

- sanctuary-world-data — 맵, 포털, 배치, 오버레이 앵커 데이터
- sanctuary-story-data — 소리, 기록, 모순, 증언, 미래 텍스트 데이터
- sanctuary-progress — 로컬 순수 진행 reducer와 정규화
- record-archive — 범용 기록 보관함 어댑터
- sanctuary-ending — 두 단계 확정, 보상 ledger, 장면 상태
- sanctuary-chorus-data — 전투 상수와 허용 ID
- sanctuary-chorus-state — 공유/개인 초기 상태와 순수 reducer
- sanctuary-chorus-controller — 입력을 action으로 변환하고 phase를 진행
- sanctuary-chorus-network — Firebase transport, authority lease, dedupe, completion claim
- sanctuary-chorus-rendering — 합창, 두 게이지, 파편, 닻, 공격 예고, 분리 연출

구체적인 기존 파일명, import 순서, 테스트 파일 배치는 구현 계획 작성 시 최신 main 트리를 다시 인용해 확정한다.

## 17. 구현 순서

사용자가 서면 명세를 검토한 뒤 별도 구현 계획을 작성하며, 구현은 다음 순서를 유지한다.

1. 최신 main 기준 활성 import와 테스트 명령 재확인
2. 성역 전용 로컬 테스트 전장과 결속도/오염도 두 게이지
3. 네 맵 데이터와 정적 포털
4. v8 저장 상태, 정규화, v1~v7 마이그레이션
5. 기록 보관함 범용화
6. 기억 수집, 배열 정답/오답/재시도, 원본 공개, 환영 거부
7. 기록 필드 작성과 보존 후 정정 연결
8. 기록 닻과 기억 파편 운반
9. 여섯 증언 판정
10. 숲/해안/화산 공격 패턴과 네 기록 취약 창
11. 솔로 전체 공략과 separated/결말 연결
12. Firebase 전용 규칙, 공유 결속도, 개인 오염도, authority 이전
13. rescued/lost 및 세 직업 연출
14. 세 결말, 보상 ledger, 저장 실패 복구
15. 새 릴리스 접미사로 전체 import 그래프와 index.html 전환
16. 전체 회귀, Firebase 에뮬레이터, 실제 입력 브라우저 검증

## 18. 테스트 계획

### 18.1 순수 Node 단위 테스트

- 네 맵이 모두 2160×1800이고 ID/표시명이 정확함
- 포털 연결과 단계별 해금, 정적 충돌 불변
- 세 봉인함만 존재하고 세 색 연결 데이터가 정확함
- 기억 순서 정답, 모든 대표 오답, 중복, 불명 ID, 재시도
- 4시 13분 22초 의미, 원본 공개, 환영 모순 세 항목
- 여섯 기록 필드와 correction link가 원본을 보존함
- v1~v7→v8 마이그레이션과 기존 필드 보존
- 문자열 boolean, 잘못된 배열, 불명 endingChoice, 선행 조건 없는 completed 강등
- chorus 단계별 결속도 경계 100/70/40/0
- 일반 공격이 결속도를 직접 감소시키지 않음
- 오배치/오답이 공유 state를 바꾸지 않고 개인 오염도만 바꿈
- 오염도 100의 파편 반환, 3초 혼선, 공격 잠금, 이동 저하, 50 복구
- action dedupe, 오래된 epoch, 잘못된 encounter, 중복 닻/증언/결속선
- fragment-strike, anchor-stabilize, testimony-resolve, record-activate, bond-cut 기여 인정
- separated가 죽음/처치 상태를 만들지 않음
- rescued/lost 두 루트가 같은 전투 경계와 결말 접근성을 가짐
- 검사/궁수/마법사가 다른 연출 ID와 같은 서사 전이를 가짐
- 세 결말 상태, 독립 장면, 마지막 문장, 300 EXP/200 Gold 불변
- 에코의 세 상태와 가렌 미완치 불변
- endingChoice 성공 후 보상 부분 실패/재시도에서 중복 지급 없음
- 결정 보류와 재접속 뒤 F로 결말 선택 재개

### 18.2 JavaScript 문법 및 import 검사

- 활성 78개 기존 모듈과 신규 모듈 전체 node --check
- index.html의 모든 물리 import 파일 존재
- 신규 접미사가 활성 그래프 전체에서 일관됨
- 활성 파일이 이전 접미사 모듈을 역참조하지 않음
- 순환 import와 누락된 export 없음

### 18.3 Firebase Auth/Realtime Database 에뮬레이터

- 신규 세 mapId의 인증 플레이어/채팅 허용
- 불명 mapId, 타인 UID, 비인증 쓰기 거부
- 두 독립 인증 클라이언트가 같은 chorus hp/phase/닻/증언/패턴/취약 창을 관찰
- 한 클라이언트의 개인 오염도, 운반 파편, 영구 진행, endingChoice가 네트워크에 나타나지 않음
- 다른 플레이어가 내 completion claim 소비나 결말 저장을 하지 못함
- 파편 배치, 증언 해결, 기록 활성화도 contributor로 기록됨
- authority 브라우저 종료 후 lease/epoch 이전과 전투 지속
- 중복, 순서 역전, 위조 damage, 위조 completion, 허용되지 않은 ID 거부
- 개인별 처치 대신 개인별 “기억 분리 완료” 기록과 서로 다른 endingChoice 유지
- 연결 해제 후 솔로 전환에서도 로컬 성역 진행 보존
- 기존 공유 보스 규칙과 기존 mapId 회귀 유지

### 18.4 실제 입력 브라우저 검사

Playwright의 keyboard/mouse 실제 입력으로 상태 직접 주입 없이 확인한다.

- 세 직업 각각 입구→기억 회랑→기록실→합창→세 미래 완주
- 일반 공격과 Q/E/R이 단계 목적에 맞는 파편 생성 또는 결속선 공격을 수행
- 기억 순서 오답 후 재시도와 정답
- 오기록이 보관함에 남고 정정 링크로 함께 열림
- rescued와 lost 화면/증언 차이 및 동일 공략 가능성
- 숲/해안/화산 공격 예고 영역을 실제 이동으로 벗어나 피해 회피
- 오염도 혼선과 회복
- 합창 0에서 분리 연출과 정확한 완료 문구
- 결정 보류 후 재접속, 코어/미래 장치 근처 F로 선택 재개
- 세 결말 두 단계 확인과 독립 장면
- endingChoice 저장 성공 뒤 보상 저장만 실패시키는 테스트 경계에서 컷신과 복구
- 보상 재시도 시 EXP, Gold, 칭호 중복 없음
- 최종 선택 연출 동안 원격 플레이어/채팅이 숨겨지고 종료 후 복원
- 브라우저 콘솔 오류와 미처리 promise rejection 없음

브라우저 검사는 networkidle만 성공 조건으로 삼지 않는다. 게임 준비 신호, 캔버스/HUD 상태, 실제 입력에 따른 관찰 가능한 상태 전이와 결과를 명시적으로 기다린다.

### 18.5 인증된 두 클라이언트 네트워크 검사

서로 독립된 두 browser context를 실제 Firebase SDK와 Auth/Database 에뮬레이터에 연결한다.

- 각 context가 별도 UID를 가짐
- 보스 결속도와 단계가 양쪽에 동기화됨
- 닻/증언/기록/패턴/취약 창이 공유됨
- 개인 오염과 carried fragment가 분리됨
- 관리자/authority context 종료 후 권한이 이전됨
- 남은 context가 전투를 실제 입력으로 계속해 separated를 만듦
- 기여한 각 UID만 completion claim을 얻음
- 두 UID가 투표 없이 서로 다른 endingChoice를 저장할 수 있음
- 보스 완료나 결말을 DB에 직접 주입하지 않음

## 19. 수용 기준

다음이 모두 만족되어야 구현 완료로 보고할 수 있다.

- 최신 main 기반 구현이며 기존 sanctuary와 화구 왕복 포털이 유지됨
- 네 물리 맵과 제12~14장 흐름이 실제 입력으로 이어짐
- 보존 후 정정 연결이 데이터와 UI 모두에서 확인됨
- 무명의 합창은 정정 뒤에만 등장하고 일반 공격만으로 결속도가 줄지 않음
- 세 단계와 separated 상태, 두 게이지, 개인 오염 규칙이 정확함
- rescued/lost, 세 직업, 솔로/온라인이 모두 완주 가능함
- 온라인 공유 항목과 개인 항목의 경계가 Firebase 규칙으로 강제됨
- 세 결말이 동일 보상과 다른 칭호/기록/시각 효과를 가지며 우열 표시가 없음
- 저장 마이그레이션, 보상 멱등성, 연결 해제 복구가 검증됨
- Node 전체 테스트, JavaScript 문법/import 검사, Firebase 에뮬레이터, 실제 입력 브라우저, 인증된 두 클라이언트 검사가 모두 통과함
- 통과하지 못했거나 실행하지 못한 검사는 통과로 표시하지 않음
- 구현 브랜치와 PR은 Draft를 유지하며 main 병합과 운영 배포를 수행하지 않음
