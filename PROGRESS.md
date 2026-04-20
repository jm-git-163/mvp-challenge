# PROGRESS.md — MotiQ 구현 진행 기록

> CLAUDE.md v4 기준 Phase별 작업 진행 추적. 매 커밋마다 한 줄 이상 추가.

---

## Phase 0 — 권한·세션 기반

### 0.1 인프라 · 중복 문서 정리 (2026-04-20)
- 루트 중복 md 7개 제거 (내용이 `docs/` 하위와 동일). `CLAUDE.md`, `START_OVERNIGHT.md` 만 루트 유지.
- Vitest + @vitest/coverage-v8 + @types/node devDeps 추가.
- `vitest.config.ts` 추가 — `engine/**`, `data/**`, `tests/**` 테스트 타겟.
- `package.json` scripts: `test`, `test:watch`, `test:coverage`.

### 0.2 `engine/session/compatibilityCheck.ts` (2026-04-20)
- `docs/COMPATIBILITY §7` CompatReport 스키마 그대로 구현.
- iOS/Mobile Safari/iPadOS 위장 감지, iOS 버전 파싱.
- `MIME_CANDIDATES` 폴백 체인 (mp4 → webm vp9 → vp8 → webm).
- `getBlockers()` / `getWarnings()` 분리 (블로커만 진입 차단).
- `runCompatibilityCheck(deps?)` — deps 주입으로 테스트 가능.
- Vitest: **17/17 pass**. `[자동검증완료]`

### 0.3 `engine/session/mediaSession.ts` (2026-04-20)
- CLAUDE.md §3 FORBIDDEN #13 + §4.5 강제: 앱 전체 **단일 getUserMedia** 지점.
- `MediaSession` 클래스: `acquire()`, `getStream()`, `release()`, `onEnded()`, `markStale()`.
- 동시 `acquire()` in-flight promise dedupe → 동시 3회 호출해도 getUserMedia 1회.
- `FALLBACK_CHAIN` 4단계: 720×1280@30 → 640×480@24 → facingMode only → `{video:true,audio:true}`.
- `classifyError`: NotAllowed/Security=denied, NotFound=notfound, NotReadable=notreadable, Overconstrained=overconstrained.
- denied/notfound → 즉시 throw (폴백 중단). notreadable/overconstrained → 다음 제약 재시도.
- track `ended` 이벤트 → stale 마킹 + `onEnded('track-ended')` 통지 (USB 분리·권한 철회 복구).
- `DEFAULT_CONSTRAINTS`: docs/COMPATIBILITY §3 그대로 (EC/NS/AGC 48kHz audio).
- 싱글톤 `getMediaSession()` + 테스트용 `__resetMediaSessionForTests()`.
- Vitest: **15/15 pass**. `[자동검증완료]`

### 0.4 `engine/session/wakeLock.ts` (2026-04-20)
- docs/COMPATIBILITY §4 Wake Lock 관리자.
- `WakeLockManager`: `acquire()`, `release()`, `getKind()`, `isActive()`.
- 3단계 경로: native (navigator.wakeLock) → polyfill (NoSleep.js 주입) → none.
- `visibilitychange` 리스너 자동 등록 — 탭 백그라운드→포그라운드 복귀 시 `desired`면 자동 재취득 (native wake lock은 백그라운드 진입 시 브라우저가 해제).
- CLAUDE.md §3 FORBIDDEN #12: "Wake Lock 없이 녹화 시작 금지" — 녹화기는 이 매니저 acquire 성공을 선행 조건으로.
- 싱글톤 + 테스트 리셋 API.
- Vitest: **6/6 pass**. `[자동검증완료]`

### 0.5 `engine/session/popupSuppressor.ts` (2026-04-20)
- docs/EDGE_CASES §5: 촬영 중 브라우저 팝업·모달 억제.
- `beforeinstallprompt` preventDefault + deferred 저장 → 촬영 완료 후 `promptInstall()`로 재트리거 가능.
- 녹화 중 `beforeunload` 가드 (이탈 confirm 유도).
- 녹화 중 `contextmenu`/`dragstart` 차단 (모바일 길게 누르기 메뉴 방지).
- `setRecording(flag)` 토글로 상태 동기화. CLAUDE.md §3 FORBIDDEN #17 "alert/confirm/prompt 금지" 준수.
- Vitest: **8/8 pass**. `[자동검증완료]`

### 0.6 `engine/session/permissionGate.ts` (2026-04-20)
- 권한 게이트를 **UI 프레임워크 무관 상태 머신**으로 구현 (Next.js/Expo/RN 어디서든 구독).
- 상태 전이: idle → checking_compat → (compat_failed) → requesting_media → (media_denied/media_failed) → acquiring_wake → ready.
- wake 실패는 진입 차단 아님 (경고로 fall-through).
- `subscribe(cb)`로 React 컴포넌트가 상태 변화 구독. `run()` / `retry()` / `teardown()`.
- `describeFailure()` 헬퍼: 상태→UI 문구 매핑.
- Vitest: **10/10 pass**.

### 0.7 Phase 0 closeout (2026-04-20)
- `CHECKLIST_PHASE_0.md` 작성 — docs/TESTING.md Layer 3 실기기 체크리스트.
- 기기 매트릭스: iOS 16.4+/15.x, Android Chrome/Samsung Internet, 데스크톱 Safari/Chrome/Edge/Firefox.
- 금지 사항 회귀 grep 항목 포함 (`rg 'getUserMedia' engine/` = 1).
- 전체 Vitest 스위트: **5 files, 56/56 pass**.

### BLOCKER (Phase 0)
- (없음)

---

## Phase 1 — 인식 엔진

### 1.6 `engine/missions/gestureMission.ts` (2026-04-20)
- 다중 프롬프트 순차 진행 상태머신. 각 프롬프트당 `defaultTimeoutMs`(5000ms) + 최소 신뢰도 0.6.
- 매칭 시점에 elapsed (응답속도) 기록. 타임아웃 시 실패 기록 후 진행.
- CLAUDE §5: `meanConfidence*70 + responseSpeed*30`, 매칭률로 곱해 실패 반영.
- fastResponseMs(800ms)=만점, slowResponseMs(4000ms)=0, 선형 보간.
- Vitest: **11/11 pass**.

### 1.5 `engine/recognition/faceTypes.ts` + `engine/missions/smileMission.ts` (2026-04-20)
- ARKit 표준 blendshape 추출 유틸: `smileIntensity=max(L,R)`, `jawOpen`, `browUp`, `blinkAmount`.
- `SmileMission`: hysteresis (활성 0.5/비활성 0.35) + peak + bestSustainedMs 추적.
- CLAUDE §5 Smile 공식: `intensity * 50 + sustain * 50`. `targetSustainMs` 기본 3000ms.
- Vitest: **13/13 pass**.

### 1.4 `engine/recognition/poseTypes.ts` + `engine/missions/squatCounter.ts` (2026-04-20)
- MediaPipe Pose 33-포인트 인덱스 상수 + `dist2D`/`angleDeg`/`mean` 순수 유틸.
- `SquatCounter` 4-phase 상태머신 (up → descending → down → ascending → up).
- Hysteresis: downAngle=100° / upAngle=160° / ±5° 전이 마진.
- Jitter 방지: `downHoldMs=150` 미만 유지는 descending 복귀.
- CLAUDE.md §5 Squat 점수 공식 구현: `achievement * 50 + depth * 30 + tempo * 20`.
- 깊이(60°↓=1.0, 100°=0), 템포(rep 간격 CV ≤0.1=1.0, ≥0.5=0).
- Vitest: **poseTypes 7/7** + **squatCounter 12/12** pass.

### 1.3 `engine/recognition/speechRecognizer.ts` (2026-04-20)
- webkitSpeechRecognition/SpeechRecognition 래퍼. 기본 `lang='ko-KR'`, continuous+interim.
- docs/COMPATIBILITY §5 iOS 세션 끊김 대응: `isIOS=true`면 `onend`에서 `setTimeout(100)` 후 재시작.
- `not-allowed`/`service-not-allowed` → 즉시 중단 (권한 거부 무한 루프 방지).
- 연속 에러 `maxConsecutiveErrors(3)` 초과 → 중단.
- 텍스트 유틸: `normalizeKorean`, `levenshtein`, `similarity`, `completion` — "Script" 미션 점수 공식 코어.
- Vitest: **20/20 pass**.

### 1.2 `engine/recognition/audioAnalyser.ts` (2026-04-20)
- `computeRMS`/`rmsToDbFS`/`smoothDbFS` 순수 함수 + attack/release 비대칭 스무딩.
- `OnsetDetector`: 스펙트럴 플럭스 (half-wave rectify) + 이동 평균 대비 threshold + refractory 기간.
- `AudioAnalyser`: 프레임당 `{rms, dbFS, smoothedDbFS, isLoud, isOnset, level}` 반환.
- "Loud Voice" 미션 · BGM 비트 폴백 감지 공용 코어.
- Vitest: **12/12 pass**.

### 1.1 `engine/ar/oneEuroFilter.ts` (2026-04-20)
- 1€ Filter (Casiez 2012) 구현. `minCutoff` + `beta` + `dCutoff` 파라미터.
- 스칼라용 `OneEuroFilter` + N차원 벡터용 `OneEuroVectorFilter`.
- 동일 타임스탬프 입력 방어, reset 지원.
- Vitest: **7/7 pass** — 분산 감소·스텝 수렴·reset·차원 체크.

---
