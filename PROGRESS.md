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

### BLOCKER (Phase 5f — PixiJS 포스트프로세스)
- **현황**: 미진행. CLAUDE.md §11 — "PixiJS 도입은 사용자 승인 필요" 항목.
- **이유**: 현재 package.json에 PixiJS 없음. 자율 모드로도 의존성 추가는 금지 대상.
- **우회**: Phase 5i 템플릿 구현에서 `postProcess` 체인은 스펙으로만 보관하고, 렌더는 Canvas 2D 기본 필터(ctx.filter) 폴백으로 시뮬레이션. Safari 호환성 한계는 기록.
- **사용자 조치**: 아침에 PixiJS v8 도입 승인하면 Phase 5f 재개.

---

## Phase 3 — 녹화 파이프라인 (기본)

### 3.1 `engine/recording/codecNegotiator.ts` (2026-04-20)
- `MIME_CANDIDATES` 순회해 첫 지원 코덱 선택 (CLAUDE §3 #16: 코덱 하드코딩 금지).
- `BITRATE_BY_TIER`: high(3.5M) / mid(2M) / low(1M).
- `estimateTier(nav)`: deviceMemory + hardwareConcurrency 기반, iOS(정보 없음) 폴백.
- `isTypeSupported` 예외 안전.
- Vitest: **12/12 pass**.

### 3.2 `engine/recording/recorder.ts` (2026-04-20)
- `MediaRecorder` 래퍼. `start(stream, codec)` → `pause`/`resume` → `stop(): Promise<Blob>`.
- 청크 누적, 빈 Blob 무시, `onerror` → `state='error'` + Promise reject.
- `subscribe(cb)` 이벤트 구독.
- MediaRecorder 생성자 + Blob 생성자 DI로 node 환경 테스트 가능.
- Vitest: **8/8 pass**.

## Phase 4 — 디자인 시스템 (토큰·모션·스키마)

### 4.1 `engine/design/tokens.ts` (2026-04-20)
- docs/VISUAL_DESIGN.md §2~7 **단일 진실 공급원**. 프레임워크 중립 (TS 모듈).
- 색 팔레트 (bgBase/bgElevated/bgGlass + 5 accent + 텍스트/상태), `parseColor`/`rgbaString` 합성 유틸.
- 타이포 스케일 9단 (display→micro + score 전용 tabular-nums).
- SPACING/RADIUS/SAFE_AREA(12%/16%)/CANVAS(1080×1920) 상수.
- `GLASS_CARD` · `neonGlow(accent)` 레시피.
- Vitest: **12/12 pass**.

### 4.2 `engine/design/motion.ts` (2026-04-20)
- docs/VISUAL_DESIGN §4 모션 토큰 + **순수 함수** 이징 곡선 (Framer 의존 X).
- `cubicBezier` Newton–Raphson 평가기 + 바이섹션 폴백.
- `EASE` 토큰 8종 (standard/overshoot/bounce/anticipate + 기본 4종).
- `DURATION` 5단 (instant 100 ~ cinematic 1200).
- `MOTION_PRESETS` 6종 (enter/exit/successPop/press/sceneWipeIn/Out).
- `evaluatePreset(preset, elapsedMs)` 키프레임 보간.
- Vitest: **11/11 pass**.

### 4.3 `engine/templates/schema.ts` (2026-04-20)
- docs/COMPOSITION.md §9 + docs/TEMPLATES.md 기준 **zod** 템플릿 스키마.
- `zCameraFraming` 7종 discriminated union (fullscreen/circle/rounded_rect/hexagon/heart/tv_frame/custom_mask).
- `zLayerType` 35종 (COMPOSITION §3 전수).
- `zReactiveBinding`: onBeat(1/2/4/8/16) · onOnset · onVolume · onMission* · track(landmark+offset+rotateWith+scaleWith).
- `zMissionSpec` 6종 (Phase 1 엔진과 1:1 매칭).
- `zPostFx` 9종 파이프라인.
- Superrefine: scoreWeight 합=1.0, layer/mission id 중복 금지, mission endSec ≤ duration.
- `parseTemplate(x)` helper: 실패 시 경로 포함 상세 에러 throw.
- Vitest: **17/17 pass**.

---

### 3.4 `engine/recording/compositor.ts` (2026-04-20)
- Phase 3용 **단순 컴포지터** — 본격 `LayerEngine`은 Phase 5로 연기 (CLAUDE.md 로드맵 준수).
- `requestAnimationFrame` 루프 + `targetFps` 게이팅 (기본 30fps).
- `addRenderer(r)` 체인 + unsubscribe, 렌더러 예외는 try/catch로 격리.
- `RendererContext`: `{ ctx, width, height, tMs, frameIndex }` — 주입 가능한 canvas 컨텍스트.
- `drawOnce()`: 녹화기가 강제로 한 프레임 그리는 용도.
- `raf`/`cancelRaf`/`now` 전부 DI → node 환경에서 프레임 타이밍 검증 가능.
- Vitest: **9/9 pass**.

### 3.3 `engine/recording/audioMixer.ts` (2026-04-20)
- mic / bgm / sfx 3-버스 구조 + `MediaStreamAudioDestinationNode` 출력.
- 발화 덕킹: `setVoiceActive(true)` → `setTargetAtTime` attack 0.08s, release 0.3s.
- `playBgm(buffer, loop)` / `playSfx(buffer)` 헬퍼.
- 동일 상태 재설정은 no-op.
- `AudioContextLike` 인터페이스 주입 → node mock으로 검증.
- Vitest: **9/9 pass**.

---

## Phase 2 — 점수 엔진

### 2.1 `engine/scoring/scorer.ts` (2026-04-20)
- 공통 `Scorer` 인터페이스 (`totalScore(): number`) — 모든 미션이 이미 만족.
- `aggregate(missions, opts)`: 가중 평균 세션 점수 + `passed` 판정 (기본 60점).
- `starsFromScore`: `1 + round(score/25)` → 1..5. 경계값 12/13/37/38/62/63/87/88 테스트.
- `clampScore`: NaN/Infinity → 0, 범위 밖 → [0..100]로 정수 라운드.
- `missionResultOf` 헬퍼: Scorer + 메타 → MissionResult.
- 결정론: 동일 입력 → 동일 출력 (Math.random 없음, CLAUDE §3 #2 준수).
- Vitest: **23/23 pass**.

---

## Phase 1 — 인식 엔진

### 1.8 `engine/missions/scriptMission.ts` (2026-04-20)
- SpeechRecognizer transcript 입력을 받아 CLAUDE §5 공식: `similarity*60 + completion*20 + timeScore*20`.
- `similarity`/`completion`는 `speechRecognizer`의 텍스트 유틸 재사용.
- `timeScore = min(1, targetReadMs / elapsedMs)`. `minTimeScore` 하한 지원.
- Vitest: **7/7 pass**.

### 1.9 Phase 1 closeout (2026-04-20)
- `CHECKLIST_PHASE_1.md` 작성 — 7 미션 실기기 검증 + 회귀 grep 항목.
- 전체 Vitest 스위트: **15 files, 168/168 pass**.

### 1.7 `engine/missions/poseHoldMission.ts` + `loudVoiceMission.ts` (2026-04-20)
- **PoseHold**: 8-관절 각도 벡터 기반 유사도 + 최근 20프레임 std 기반 안정성.
  - hysteresis (enter 0.8 / exit 0.7 similarity) + `targetHoldMs` 3000ms.
  - CLAUDE §5: `(sim*60 + stab*40) * holdRatio`. 안정성은 std 2°=1.0 / 20°=0.
  - Vitest: **15/15 pass**.
- **LoudVoice**: smoothedDbFS 입력 기반 활성/비활성 hysteresis (−20dB / −25dB).
  - `targetSustainMs` 2000ms, dB 선형 매핑 (−40dB=0 / −10dB=1).
  - CLAUDE §5: `dBScore*60 + sustainScore*40`.
  - Vitest: **9/9 pass**.

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
