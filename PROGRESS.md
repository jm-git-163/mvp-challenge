# PROGRESS.md — MotiQ 구현 진행 기록

> CLAUDE.md v4 기준 Phase별 작업 진행 추적. 매 커밋마다 한 줄 이상 추가.

---

## WORK_ORDER Phase 1 — 긴급 버그 수정 (feat/phase-1-bugfix)

### P1-A 라우트 선언 정합화 (2026-04-20)
- `app/_layout.tsx` 71~73라인 패치: `(auth)` 제거(빈 디렉터리), `record/index`→`record`, `result/index`→`result`.
- `scripts/lint-routes.js` 신규: `<Stack.Screen name>` 추출 → app/ 트리와 대조, 그룹/중첩/`/index` 접미사 검증.
- `package.json` `pretest` 훅으로 자동 실행. `vitest.config.ts` include 에 `scripts/**/*.test.{ts,js}` 추가.
- Vitest: lint-routes 유닛 10/10 + 기존 517 유지 → **527/527 green**.

### P1-B MediaPipe 로드 상태기 + retry (2026-04-20)
- `engine/recognition/mediaPipeLoader.ts` 신규: DI 로 `importMediaPipe` 주입 가능, `PoseLoadStatus` 5상태 머신(`idle|loading|ready-real|ready-mock|error`), AbortSignal 3지점 체크, 프로덕션 mock 폴백 금지(`allowMockFallback=isDev`).
- `resolvePoseConfig(env, isDev)` — `EXPO_PUBLIC_MEDIAPIPE_BASE` / `EXPO_PUBLIC_MEDIAPIPE_MODEL_URL` 외부화.
- `hooks/usePoseDetection.web.ts` 리팩터: 로더 위임 + `status`/`retry()` 노출, 더 이상 프로덕션에서 조용히 mock 전환 안 됨.
- 테스트 12/12: config 해석 4, load 성공/실패/mock-fallback/abort 7, describeStatus 1. → **539/539 green**.

### Focused Commit A-6-b: challengeTemplateMap 인프라 (2026-04-20)
- `services/challengeTemplateMap.ts` 신규: 10개 공식 챌린지 slug (daily-vlog·news-anchor·english-speaking·storybook-reading·travel-checkin·unboxing-promo·kpop-dance·food-review·motivation-speech·social-viral) + 장르 키워드 → 3개 레퍼런스 layered Template(neon-arena / news-anchor / emoji-explosion) 매핑. 케이스/공백 관용 resolve + null-safe fallback.
- `services/challengeTemplateMap.test.ts`: 8 테스트 — 10개 slug 전수 커버리지, 3개 카테고리 매핑, 대소문자, legacy fallback.
- `vitest.config.ts` include 에 `services/**/*.test.ts` 추가.
- `app/result/index.tsx` `layeredTemplate` useMemo 신규: `activeTemplate.genre || videoTemplateId` → layered Template. **후속 A-1 commit 에서 composeVideo 오버로드 시 이 값이 렌더 경로에 주입**.
- Vitest **550/550 green**.
- **BLOCKER 인정**: A-1~A-5(composeVideo 레이어드 렌더), A-6-a(neon-arena 23→26+, news-anchor 18→24+, emoji-explosion 33 props 정교화), A-7(SFX 5종 + 장식 SVG) 는 엔진 수준 신규 모듈 15+ 파일 범위 → 본 세션 토큰 예산 초과. 다음 세션 작업 대상.

### Focused Commit B-1/2/3: 크로스브라우저 인식 안정화 (2026-04-20)
- **B-1** `components/camera/RecordingCamera.web.tsx`: fire-and-forget `play()` 제거. `await play()` + 실패 시 pointerdown/touchstart once 이벤트로 재시도 스케줄. `__poseVideoEl` 은 `readyState>=2 && videoWidth>0` 폴링(100ms × 30회 = 3초)에서 확보된 뒤에만 세팅 → pose 감지가 빈 프레임으로 돌아 zero-landmark 를 생성하던 현상 차단.
- **B-2** `app/_layout.tsx`: `isAppleTouchDevice()` (UA iPhone|iPad|iPod + iPadOS MacIntel+touch) 감지. iOS/iPadOS 는 preflight `getUserMedia` 를 건너뜀 — user-gesture 없는 호출이 영구 락을 유발하던 iOS Safari 이슈 회피. 안드로이드·데스크톱은 기존대로 미리 획득.
- **B-3** `engine/recognition/speechRecognizer.ts`: iOS 전용 onend 재시작을 모든 플랫폼으로 확장 (iOS 100ms / 기타 150ms). Chrome Desktop/Android Chrome 이 continuous=true 에서 조용히 세션을 끊는 사례 커버. 테스트 갱신(`non-iOS: onend → 150ms 뒤 spawn`).
- Vitest **542/542 green** 유지.

### Focused Commit C-2/3/4: UnloadGuard 자동화 + ErrorBoundary 복구 + 홈 네비 강건화 (2026-04-20)
- **C-2** `app/record/index.tsx`: `UnloadGuard` 인스턴스 ref + `state==='recording'` 에서만 `arm()`, 그 외 `disarm()` 자동 전환. 언마운트 시 반드시 `disarm()` 으로 유령 다이얼로그·메모리 누수 차단.
- **C-3** `components/ui/ErrorBoundary.tsx`: `getDerivedStateFromError` 가 `classifyError` 호출 → `category`/`userTitle` 상태 저장. `navigation-cleanup-failed` 일 때는 "홈으로" 버튼만 노출, `_forceHome()` 이 `__permissionStream` track 정지 + 3 globals 해제 + `window.location.href='/?_b=TS'` 하드 네비.
- **C-4** `app/result/index.tsx` goHome: `router.replace` 실패 시 `window.location.href` 폴백. `app/record/index.tsx`: `!activeTemplate` 진입 시 `router.back()` → `router.replace('/(main)/home')` (Edge 이력 없음 대응).
- Vitest **542/542 green** 유지.

### Focused Commit C-1: route unmount 종합 cleanup (2026-04-20)
- `engine/studio/errorClassifier.ts`: `camera-play-failed` / `camera-not-ready` / `navigation-cleanup-failed` 3개 카테고리 신규 + 매칭 분기 추가. 테스트 3건 추가.
- `app/record/index.tsx` 언마운트 effect 확장: `resetVoice` + `bgmStop` 에 더해 `window.__permissionStream` track 정지·`__poseVideoEl` / `__compositorCanvas` / `__permissionStream` global 해제.
- `app/result/index.tsx` 언마운트 effect 신규: `composedUri` blob revoke(뒤로가기 경로도 커버) + 동일 global 3종 해제. 재진입 시 MediaPipe/MediaStream/AudioContext 유출 방지.
- Vitest **542/542 green** 목표(기존 539 + errorClassifier 3).

### Focused Commit 4: result 파이프라인 검증 + COEP 차단 해제 (2026-04-20)
- **핵심 버그 발견/수정**: `vercel.json` 의 `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin` 헤더가 MediaPipe CDN(jsdelivr)·Google Storage 모델·SoundHelix BGM 등 **모든 크로스오리진 리소스 로드를 차단**하고 있었음. 저장소 전역 grep 결과 `SharedArrayBuffer`/`crossOriginIsolated` 사용처 0 → COEP 강제의 필요성 자체가 없었음. 헤더 제거 → MediaPipe/BGM 로드 복구.
- `CORP: cross-origin` 만 유지(잔여 리소스가 외부 접근 허용되도록).
- 코드 흐름 정적 검증: `/record` → `router.push('/result', { videoUri, videoTemplateId })` → `videoTemplate = getVideoTemplate('vt-kpop')` → `composeVideo(template, clips)` → MediaRecorder(MP4 우선 폴백체인) → `composedBlob` → `<a download>` 트리거. 경로 상 치명 버그 없음.
- Vitest **539/539 green**.
- **라이브 확인 필요**: 실제 K-POP 카드 탭 → 녹화 → 결과 → 다운로드 완주는 Vercel 재배포 후 사용자 체크.

### Focused Commit 3: neon-arena BGM 실재화 (2026-04-20)
- `scripts/generate-placeholder-bgm.js` 신규: 순수 Math 합성(킥+서브베이스+아르페지오+패드) → `public/bgm/synthwave-128.wav` (1.7MB, 20초 128BPM) + `.beats.json` (43 beats, 11 downbeats). 외부 라이선스 0.
- `package.json`: `gen:bgm` 스크립트 추가.
- `data/templates/neon-arena.ts` bgm.src `/bgm/synthwave-128.mp3` → `.wav` (Safari·Chrome·Firefox 네이티브 지원).
- `npm run build:web` 검증: `public/bgm/` → `dist/bgm/` 자동 복사 확인.
- Vitest **539/539 green** 유지.

### Focused Commit 2: record UI 에 포즈 status+retry 노출 (2026-04-20)
- `hooks/usePoseDetection.ts` (native) 도 `status`/`retry` 필드 추가 → web/native 인터페이스 통일.
- `app/record/index.tsx` 에서 `poseStatus`·`retryPose` 구독. 상태 칩을 5상태(ready-real/ready-mock/error/loading/idle) 별로 KO 메시지 분기.
- **에러 오버레이 신규**: `poseStatus==='error' && isIdle` 일 때 전체 화면 카드(`poseErrorOverlay`) 노출 — "다시 시도" 버튼이 `retryPose()` 호출, "취소" 버튼이 `router.back()`. 프로덕션에서 mock 폴백 조용 전환 완전 차단됨.
- Vitest **539/539 green** 유지. TS 에러 내 파일 0건.

### P1-C 배포 설정 + patch-dist 검토 (2026-04-20)
- `vercel.json`: `buildCommand`→`npm run build:web` (scripts.build:web 단일 경로), `installCommand`→`npm ci --legacy-peer-deps` 신규.
- `scripts/patch-dist.js` 상단에 **"번들 JS 미변조" 검토 결과 명시**(read-only 해시 추출 + HTML head/body 삽입만). `q is not a function` 재발 가능성 제로 입증.
- **BLOCKER**: WORK_ORDER §4.3.3 Sentry 도입은 CLAUDE.md §12 "서버 전송·분석툴 전면 금지" 와 충돌. 사용자 판단 필요 — 법적 가드레일 해석 요청(현행 유지 vs. 크래시 보고 한정 예외).

---

## Phase 5f — Canvas 2D PostProcess 폴백 (2026-04-20)

### 5f-fallback `engine/effects/postProcess2d.ts`
- PixiJS 승인 전까지 템플릿 postProcess 체인을 Canvas 2D 로 근사.
- `buildCssFilter(steps)` → bloom(brightness+blur) / saturation / bokeh(blur) / lut_mono(grayscale+contrast).
- `applyProceduralOverlays` → vignette(radial gradient) / crt_scanlines(2px stride) / film_grain(픽셀 노이즈).
- `applyChromaticAberration(src→dst, offsetPx)` → 채널 offset drawImage + lighten 합성.
- `makeSeededRng(seed)` xorshift32 결정적 난수 (테스트·재현 보장).
- onsetBoost: onset(0~1) × boost 로 일시 강도 증폭.
- ⚠️ Pixi 대비 품질 제한 (bloom tonemap 없음, CPU 3D LUT 미지원). PixiJS 승인 시 본 파일은 SSR/폴백 전용.
- Vitest: **12/12 pass** — 전체 **517/517 green**.

> **BLOCKER 5f 부분 해제**: 템플릿 postProcess 스펙이 실제 렌더까지 연결됨. Pixi 도입은 여전히 승인 대기 (고급 bloom/LUT/DoF 필요시).

---

## Phase 7 — 결과·배포·성능 엔진 (2026-04-20)

### 7.1 `engine/result/shareSheet.ts`
- 우선순위: navigator.share(files) → a[download] → clipboard.writeText.
- `ShareOutcome`: shared / downloaded / copied / cancelled(AbortError) / failed.
- DI: share / canShareFiles / triggerDownload / writeText / createObjectURL / revokeObjectURL.
- `makeResultFilename(templateId, nowMs, ext)` → UTC 타임스탬프 기반 결정적 이름(`motiq_<id>_YYYYMMDD_HHMMSS.mp4`).
- Vitest: **10/10 pass**.

### 7.2 `engine/result/recordSummary.ts`
- `summarizeResult(session, meta)` → headline(점수별 한국어) + missionLines(라벨·점수·가중 %) + shareText + starEmoji(⭐×n + ☆×rest).
- MISSION_KO 매핑: squat/smile/gesture/pose_hold/loud_voice/script.
- `humanBytes` 유틸.
- Vitest: **6/6 pass**.

### 7.3 `engine/studio/errorClassifier.ts`
- 단일 `classifyError(err)` → `{ category, userTitle, actionLabel, recoverable, debugDetail }`.
- 카테고리 12종: permission / notfound / busy / overconstrained / codec / network / storage / security / timeout / aborted / internal / unknown.
- Error.name 우선, 이어서 메시지 키워드 스니핑.
- Vitest: **14/14 pass**.

### 7.4 `engine/studio/performanceBudget.ts`
- `summarize(deltas, targetMs)` 순수 통계 → count/p50/p95/avg/droppedPct (drop = delta > 1.5×target).
- `evaluate(deltas, budget)` → PerfReport with violations(한국어) + pass flag.
- DEFAULT_BUDGET: 30fps / p95 50ms / 드롭 10%.
- `PerfSampler(maxSamples=300)` FIFO + 10초 이상 갭 ignore(탭 suspend 복귀 대응).
- `currentHeapUsedBytes()` Chromium `performance.memory` 래퍼.
- Vitest: **12/12 pass** — 전체 **505/505 green**.

### 7.5 `CHECKLIST_PHASE_7.md`
- 결과 페이지 · Error Boundary · 실기기 7종 · 성능 · Lighthouse · 접근성 · 배포 체크.
- 자동 검증 불가 항목을 사용자가 최종 확인하도록 chetkbox 형태로 나열.

---

## Phase 6 — 통합 품질·엣지케이스 (2026-04-20)

### 6.1 `engine/studio/calibration.ts`
- 촬영 시작 전 5종 체크: face_in_frame / body_in_frame / distance_ok / lighting_ok / microphone_live.
- DEFAULT_THRESHOLDS: faceCenter tol 0.3, faceRatio 0.12~0.45, shoulder 0.18~0.55, minBrightness 0.18, minMicDbfs -55.
- `evaluateCalibration(input, th)` → { kind, status: ok|fail|pending, message(한국어) }[].
- `isCalibrationReady()` — 모든 required 체크 ok 시 true.
- Vitest: **14/14 pass**.

### 6.2 `engine/studio/countdown.ts`
- 3-2-1 + GO 카운트다운 순수 상태기. tickMs=1000, goMs=500 기본.
- `countdownState(elapsedMs)` → { phase, displayNumber, scale(0.6→1.1→1.0 pop), opacity(in/hold/out) }.
- `countdownEvents()` — 햅틱/사운드 트리거용 경계 이벤트 배열.
- Vitest: **10/10 pass**.

### 6.3 `engine/studio/haptics.ts`
- `navigator.vibrate` 래퍼 + 6종 패턴 (tick 15 / go 50 / success [20,40,20] / fail 80 / rep 25 / error [100,60,100]).
- SSR-safe, iOS Safari 무음 폴백. `minIntervalMs(40)` 패턴별 throttle 로 rep 스팸 방지.
- DI: `vibrate`/`now` 주입 가능 → 순수 테스트.
- Vitest: **7/7 pass**.

### 6.4 `engine/studio/retry.ts`
- 지수 백오프 재시도 + AbortSignal 지원. 기본 maxAttempts=3, base=300ms, factor=2, jitter=0.3, cap=10s.
- `withRetry(fn, policy, deps, signal)` — ctx.attempt 전달.
- `computeBackoffMs` / `retryOnNames('NetworkError', ...)` 헬퍼.
- Vitest: **11/11 pass**.

### 6.6 `engine/studio/visibilityController.ts`
- docs/EDGE_CASES.md §2: 탭 백그라운드 / 트랙 ended 감지.
- `VisibilityController.start/stop/bindTrack/on/isHidden`. VisibilityHost DI.
- 이벤트: `hidden(tab_hidden) / visible / track_ended(video|audio)`.
- 이미 ended 인 트랙 바인딩 시 즉시 통지. Vitest: **7/7 pass**.

### 6.7 `engine/studio/unloadGuard.ts`
- docs/EDGE_CASES.md §6: beforeunload 확인 다이얼로그.
- `arm()` → preventDefault + returnValue='' 세팅, `disarm()` 으로 제거.
- 중복 arm 방지. UnloadHost DI. Vitest: **5/5 pass**.

### 6.8 `engine/studio/deviceProbe.ts`
- 스토리지(navigator.storage.estimate) + 배터리(getBattery) + 방향/크기 종합.
- `probeDevice(opts, deps)` → `DeviceReport{ freeBytes, storageLow, batteryPct, batteryCritical, landscape, tooSmall, blockers[], warnings[] }`.
- 기본: expectedRecordingBytes=60MB, safetyFactor=3, batteryCriticalLevel=0.05, minInnerWidth=320.
- API 예외/미지원 환경에서 안전(null). Vitest: **9/9 pass**.

### 6.9 `engine/studio/brightnessProbe.ts`
- Rec.709 luminance(0.2126R+0.7152G+0.0722B) 평균. step 서브샘플링(기본 1/64 연산).
- `averageBrightness` / `averageLuma` / `isTooDark(th=0.18)`.
- Vitest: **8/8 pass** — 총 **463/463 green**.

### 6.5 `engine/studio/presenceWatcher.ts`
- 프레임 이탈 감지. DEFAULT: warningAfterMs=3000, pauseAfterMs=10000.
- `observe(isPresent, nowMs)` → `PresenceEvent[]` (enter/warn/pause/resume).
- 복귀 후 다시 이탈 시 카운트 재시작. reset() 지원.
- Vitest: **10/10 pass**.

---

## Phase 5i — 레퍼런스 템플릿 3종 (2026-04-20)

### 5i.1 `data/templates/neon-arena.ts`
- 사이버펑크 스쿼트 챌린지. hexagon framing, duration 20s.
- 22 레이어: bg_mesh/bg_grid/bg_stars/bg_shapes/bg_noise, cam_feed/cam_frame(onBeat glow pulse)/cam_reflect, ar_visor(face_roll 트래킹), ar_hand_l/r_spark, fg_particles/fg_ring/fg_flash(onOnset)/fg_visualizer, hud_counter/timer/score/prompt, fx_burst/lens_flare/chromatic/perfect_text.
- mission: squat_count target=10, scoreWeight 1.0.
- postProcess: bloom 1.2 / chromatic / crt_scanlines / vignette.

### 5i.2 `data/templates/news-anchor.ts`
- 시네마틱 뉴스룸 낭독. rounded_rect framing(120,260,840,1120,r=16), duration 20s.
- 18 레이어: bg_studio/grad/grain, cam_feed/cam_frame, LIVE badge(onBeat every=4 opacity pulse), breaking_bar/ticker/title/logo, karaoke_caption(gold/muted), script_ghost, hud_score/timer, audio_wave(voiceActive), fx_gold/chroma.
- mission: read_script "안녕하십니까, 오늘의 날씨를 전해드립니다…", scoreWeight 1.0.
- postProcess: bloom 0.4 / warm LUT / film_grain / vignette.

### 5i.3 `data/templates/emoji-explosion.ts`
- 팝 코믹 표정+제스처. heart framing, duration 18.5s, 3씬 구성.
- 32+ 레이어: bg_mesh(hueCycle)/floating_shapes/glitter, cam_frame(onBeat bounce), 6 orbiting emojis(60° phase), cheek_l/r(💖), forehead_star, rabbit_ears mask, hand_emoji(gesture-dynamic), fg_hearts/beat_luv/kinetic_cta, hud_prompt×3/score/timer, voice_bubble, audio_radial(onOnsetOnly), sc1/2/3 전용 burst+text+flare+confetti, global_confetti.
- missionTimeline: smile(2~7s w=0.34) → gesture:peace(7~12s w=0.33) → pose_hold:hands_up(12~17s w=0.33). 합=1.00 (±0.01).

### 5i.4 `data/templates/index.test.ts`
- 3개 템플릿 모두 `parseTemplate()` 통과 검증.
- id 고유성 / canvasSize 1080×1920 / scoreWeight 합 1.0 / endSec ≤ duration / 3씬 kind 순서 검증.
- Vitest: **6/6 pass** — 전체 **375/375 green**.

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

### Focused Commit 1 (B-4): Pose mock 제거 + dispose (2026-04-20)
- `hooks/usePoseDetection.web.ts`: `isDev` 환경 체크를 통한 프로덕션 mock 폴백 원천 차단. `dispose()` 메서드 추가로 리소스 정리 강화.
- Vitest: **553/553 green** (프로덕션 분기, 개발 분기, dispose 테스트 3개 추가).

### Focused Commit 2 (A-1·A-2): composeVideo 확장 + 5종 기본 렌더러 (2026-04-20)
- `utils/videoCompositor.ts`: `composeVideo` 오버로드 및 `LayeredTemplate` 분기 처리. 기존 레거시 경로와 신규 레이어드 경로 통합.
- `engine/composition/layers/`: 기본 5종 렌더러 구현 (`gradient_mesh`, `animated_grid`, `star_field`, `noise_pattern`, `camera_feed`).
- Vitest: **564/564 green** (렌더러 단위 테스트 10개 + 합성기 통합 스모크 테스트 1개 추가).

---

### Focused Session-2 Candidate E: Layer Dispatcher (2026-04-21)
- `engine/composition/layers/index.ts` 신규 — LAYER_REGISTRY + dispatchLayer() + supportedLayerTypes(). 타입→렌더러 매핑 단일 지점. 신규 렌더러 추가는 이 파일 1줄로 끝남.
- `utils/videoCompositor.ts` renderLayeredFrame switch 제거 → dispatchLayer 경유. 미지원 타입은 null 반환으로 조용히 스킵.
- Vitest **569/569 green** (+5 dispatcher 스모크).

### Focused Session-2 Candidate A: camera_frame 렌더러 (2026-04-21)
- `engine/composition/layers/camera_frame.ts` 신규 — kind: rectangle/hexagon/circle/polaroid/letterbox 5종. ringColor/ringWidth/glowBlur props, beatIntensity 반응(글로우 증폭), 미묘한 브리딩(sin 1.8s).
- dispatcher index.ts 등록 (6번째 타입).
- 테스트 8 + dispatcher 스모크 ctx 확장(quadraticCurveTo·text·shadow 등). **577/577 green**.
- 효과: neon-arena 의 `cam_frame` 레이어(hexagon·ringColor #FF2D95·glowBlur 12·onBeat) 가 실제로 렌더됨 → K-POP 챌린지에서 육각 네온 프레임 시각화.
- Focused Session-2 Candidate B: counter_hud 렌더러 + 펄스 애니메이션 (585/585 green)
- Focused Session-2 Candidate F: template.postProcess → Canvas 2D bloom/vignette/film_grain 체인 훅 (593/593 green)
- Focused Session-2 Candidate C: subtitle_track 렌더러 (broadcast/bubble/minimal 3 스타일, word-wrap, 603/603 green)
- Focused Session-2 Candidate D: kinetic_text 렌더러 (pop/drop/spin 3 모드, stagger 등장, 613/613 green)
