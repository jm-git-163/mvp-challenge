# Claude Code 작업 의뢰서 — MotiQ 프로덕션 완성도 상향 지시서

**대상 저장소** `jm-git-163/mvp-challenge` (https://github.com/jm-git-163/mvp-challenge)
**분석 기준 커밋** `0b3acea` (2026-04-20)
**특허** 10-2025-02049151 (팬텀특허법률사무소)
**라이브** https://mvp-ivory-kappa.vercel.app/
**작성일** 2026-04-20

> 이 문서는 저장소 ZIP 전체를 직접 열어 외부 감사한 결과를 근거로 작성되었으며, 주 기여자인 Claude Code 가 **세션 시작 시 먼저 읽어야 할 루트 지시서**입니다. `CLAUDE.md` v4·`docs/*`·`CHECKLIST_PHASE_*.md`와 충돌 시 본 문서의 수용 기준을 유지하되 구현 디테일은 저장소 실제 상태를 따릅니다.

---

## 0. 이 문서 사용법

1. 본 문서를 `WORK_ORDER.md` 로 저장소 루트에 커밋합니다.
2. Claude Code 세션 첫 메시지로 아래 문장을 붙여 넣습니다.
   ```
   WORK_ORDER.md 를 읽고 CLAUDE.md v4 규칙에 따라 Phase 1 부터 순차 진행.
   각 Phase 를 별도 브랜치(feat/phase-1-routes 등)로 분리.
   매 커밋마다 PROGRESS.md 한 줄 이상 갱신.
   Vitest 는 항상 green 유지. 테스트가 깨지면 해결 전까지 다음 파일 수정 금지.
   각 Phase 완료 시 PR 올리고 사용자 리뷰 요청. 자동 merge 금지.
   ```
3. Phase 는 종속성 순서대로 처리 (§14 그래프). 각 Phase 는 독립 PR.

---

## 1. 프로젝트 정체성 재확인

**MotiQ** = 게임화된 멀티모달 영상 콘텐츠 자동 생성 시스템 (특허 10-2025-02049151).

**제품 문장** 사용자가 홈에서 **챌린지**(촬영 시나리오)를 선택해 촬영을 완료하면, 결과 화면에서 **템플릿**(포스트프로덕션 비주얼 스타일)을 골라 CapCut·Instagram Reels·Canva 수준의 영상을 자동 완성하고 곧바로 SNS에 업로드할 수 있어야 한다.

### 1.1 용어 정의 (절대 혼동 금지)

**챌린지 (Challenge)** 홈 화면의 촬영 시나리오·미션 스크립트. 예: `K-POP 댄스 챌린지`, `뉴스 앵커 챌린지`. `subtitle_timeline`·제스처 ID·임계값·미션 배열·지속 시간으로 정의. 현재 `services/mockData.ts`(72KB) 내 하드코딩. **10종 모두 존재**.

**템플릿 (Template)** 촬영 끝난 원본에 덧씌우는 다중 레이어 포스트프로덕션 스타일. **22개 레이어** 내외 + 고유 BGM + 고유 postProcess + successEffects/failEffects. 위치 `data/templates/*.ts`. 현재 **3종만 존재** (`neon-arena`, `news-anchor`, `emoji-explosion`).

**합성기 (Compositor)** `utils/videoCompositor.ts`(92KB) + `engine/composition/*` + `engine/layers/*` + `engine/effects/*` + `engine/recording/compositor.ts`.

---

## 2. 외부 감사 결과 요약

### 2.1 스택 (package.json + app.json)

Expo ~54.0.33 + expo-router, React Native Web 단일 번들 1,534KB(코드 스플리팅 없음). `@mediapipe/tasks-vision ^0.10.34`, `@tensorflow-models/pose-detection ^2.1.3`, `@tensorflow/tfjs ^4.22.0`, `@shopify/react-native-skia 2.2.12`, `@supabase/supabase-js ^2.103.2`, `expo-av`, `expo-camera`, `expo-gl`.

### 2.2 확인된 버그 및 근본 원인

| 증상 | 근본 원인 (파일·라인 단위) |
|---|---|
| 콘솔 경고 `No route named "(auth)"/"record/index"/"result/index"` | **`app/_layout.tsx` 71~73라인** 의 Stack.Screen 선언이 Expo Router 폴더 규칙과 불일치. `(auth)` 는 파일 트리에 없음. `record/index`·`result/index` 는 폴더명 `record`·`result` 여야 함. |
| 포즈·스쿼트 카운트 미작동 | **`hooks/usePoseDetection.web.ts` 124~131라인** 의 catch 블록이 MediaPipe 로드 실패 시 `useMockRef.current = true` 후 `setIsReady(true)` 로 조용히 mock 폴백. 프로덕션에서도 동일 동작. WASM 로드는 `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm`, 모델은 `storage.googleapis.com/mediapipe-models/…`. 국내 네트워크 환경에 따라 로드 실패 잦음. |
| BGM "그 수준" | **`data/templates/neon-arena.ts` 24라인** `src: '/bgm/synthwave-128.mp3'` 는 정적 경로이며 실제 에셋이 존재하지 않는 플레이스홀더(파일 주석 7라인에 명시). `public/bgm/` 또는 Supabase Storage 에 음원 없음. |
| 템플릿 허접함 | **`data/templates/`** 에 **3종만 존재** (`neon-arena.ts`, `news-anchor.ts`, `emoji-explosion.ts`). 홈에 노출되는 **10 챌린지** 가운데 다수에 적합한 템플릿이 부족. 또한 `PROGRESS.md` 기준 Pixi.js 승인 대기로 bloom·LUT·DoF 품질 제한. |
| SNS 업로드 실패 | **`engine/result/shareSheet.ts`** 는 `navigator.share(files) → .mp4 download` 까지만 구현. 메타·틱톡·YouTube Content Publishing API, OAuth 토큰 관리 전면 미구현. |
| 크로스 브라우저 차이 | 1.5MB 단일 번들(코드 스플리팅 없음), iOS Safari Web Speech 자동 재시작 로직 Phase 1 수준(이미 `CHECKLIST_PHASE_1.md` 1.3 에 요구사항 존재), WebCodecs VideoEncoder 미사용. |
| `.env.production` 공개 노출 | **`.env.production`** 파일이 커밋되어 있음. `EXPO_PUBLIC_SUPABASE_ANON_KEY` JWT 그대로 노출. anon role 키이므로 설계상 공개 가능하나, 베스트 프랙티스 위반. Supabase RLS 정책 점검 필수. |

### 2.3 강점 (유지 대상)

- `engine/` 14개 서브시스템 (ar·beat·composition·design·effects·layers·missions·recognition·recording·result·scoring·session·studio·templates) 모두 `.test.ts` 페어 보유, **Vitest 517/517 green**.
- `engine/missions/` 에 6종 미션 엔진(gesture·loudVoice·poseHold·script·smile·squatCounter) 완비.
- `engine/studio/` 에 `errorClassifier`·`retry`·`unloadGuard`·`visibilityController`·`performanceBudget`·`permissionGate` 등 프로덕션 수준 장치.
- 템플릿 스키마(`engine/templates/schema.ts`)는 CapCut·Instagram Effects 수준의 개념을 모두 포함 (layers·reactive bindings·post_process·successEffects·failEffects·missionTimeline).

---

## 3. 전역 수용 기준 (Definition of Done)

1. iOS Safari 15+ / iOS Chrome / Android Chrome 최신 3개 / 데스크톱 Chrome·Edge·Firefox·Safari 에서 **동일한 기능 집합**이 작동.
2. 홈 → 챌린지 → 촬영 → 결과 → 템플릿 선택 → MP4 생성 → SNS 업로드 **전 구간 1 인터럽트 이하**.
3. 포즈·제스처·음성·표정·카운트 인식이 **실 데이터** 로 동작, 실패 시 명시적 UI.
4. 템플릿 **12종 이상**, 각 **20 레이어 이상**, 고유 BGM·무드·postProcess.
5. SNS 자동 업로드 **2개 플랫폼 이상** (Instagram Reels, TikTok, YouTube Shorts 중).
6. Vitest 전체 green, Playwright E2E 스모크 통과, `CHECKLIST_PHASE_0.md ~ 7.md` 실기기 섹션 완료.
7. 모바일 4G 기준 LCP < 2.5s, INP < 200ms, 녹화 프레임 드롭 < 5%, 렌더링 실패율 < 1%.

---

## 4. Phase 1 — 긴급 버그 수정 (0~3일)

### 4.1 라우트 선언 정합화 (P1-A, 0.5일)

**파일** `app/_layout.tsx` (71~73라인).

**현재 코드** (문제 있음)
```tsx
<Stack.Screen name="(main)" options={{ headerShown: false }} />
<Stack.Screen name="(auth)"  options={{ headerShown: false }} />
<Stack.Screen name="record/index" options={{ headerShown: false, animation: 'fade' }} />
<Stack.Screen name="result/index" options={{ headerShown: false, animation: 'fade' }} />
```

**패치**
```diff
         <Stack.Screen name="(main)" options={{ headerShown: false }} />
-        <Stack.Screen name="(auth)"  options={{ headerShown: false }} />
-        <Stack.Screen name="record/index" options={{ headerShown: false, animation: 'fade' }} />
-        <Stack.Screen name="result/index" options={{ headerShown: false, animation: 'fade' }} />
+        <Stack.Screen name="record" options={{ headerShown: false, animation: 'fade' }} />
+        <Stack.Screen name="result" options={{ headerShown: false, animation: 'fade' }} />
       </Stack>
```

**이유** Expo Router 의 Stack.Screen name 은 **폴더명** 을 가리킴. `record/index`·`result/index` 는 Expo Router 내부적으로 `record`·`result` 로 정규화되고, 명시적으로 `/index` 를 붙이면 불일치 경고 발생. `(auth)` 폴더는 존재하지 않음(삭제된 레거시).

**추가** `scripts/lint-routes.js`(신규). Node 스크립트로 `app/_layout.tsx` 내 `<Stack.Screen name="X">` 를 추출해 실제 디렉터리/파일 트리와 비교. 불일치 시 `process.exit(1)`. `package.json`의 `scripts.test`에 prelint 단계로 추가.

**수용 기준** 라이브 콘솔에 `No route named` 경고 0건. `/home` → 챌린지 탭 → `/record` → `/result` → `/home` 30회 왕복 렌더 실패 0건. Vitest green.

### 4.2 MediaPipe 로드 실패 UX 정상화 (P1-B, 0.5~1일)

**파일** `hooks/usePoseDetection.web.ts` 전체 리팩터.

**현재 문제**
```tsx
// 124~131라인
} catch (err: any) {
  if (destroyed) return;
  console.warn('[PoseDetection] MediaPipe failed to load, falling back to mock:', err);
  useMockRef.current = true;
  setIsReady(true);  // ← 실패해도 UI 는 "준비됨" 으로 인식
  setError('MediaPipe unavailable — using mock pose');
}
```

**패치 지침**
1. 반환 인터페이스를 `UsePoseDetectionReturn` 에서 `status: 'loading' | 'ready-real' | 'ready-mock' | 'error'` 로 확장.
2. `__DEV__ || process.env.EXPO_PUBLIC_ENV !== 'production'` 일 때만 mock 폴백 활성. 프로덕션에서는 `status: 'error'` 로 고정.
3. 신규 함수 `retry()` 추가 — 외부에서 호출하면 `landmarkerRef` 정리 후 `load()` 재실행.
4. `MODEL_URL` 과 WASM BASE URL 을 하드코딩 제거, 환경 변수 `EXPO_PUBLIC_MEDIAPIPE_BASE` 로 외부화. 기본값은 현재 jsdelivr + googleapis 유지, 프로덕션에서는 Supabase Storage 자체 호스팅 경로로 전환.
5. `components/camera/RecordingCamera.web.tsx` 에서 status 별 오버레이 렌더
   - `loading` → 스피너 + "포즈 엔진 다운로드 중"
   - `ready-real` → 아무것도 노출 안 함
   - `ready-mock` (dev only) → 배너 "개발 모드 — 모의 포즈 사용"
   - `error` → 카드 "포즈 엔진을 불러오지 못했습니다" + "Wi-Fi 연결을 확인하고 다시 시도" 버튼(→ `retry()` 호출) + "홈으로 돌아가기" 보조 버튼
6. `engine/studio/errorClassifier.ts` 에 분류 `pose-engine-load-failed` 추가 (`userTitle: '포즈 엔진 로드 실패'`, `actionLabel: '다시 시도'`, `recoverable: true`, `debugDetail: error.message`).
7. 프로덕션 빌드에서 `generateMockPose`·`generateSquatMockPose` 가 tree-shake 되도록 `utils/poseUtils.ts` 에서 해당 함수를 `if (__DEV__)` 가드로 감싸거나 별도 모듈 `utils/poseUtilsMock.ts` 로 분리.

**CDN 자체 호스팅 (병행)** Supabase Storage 에 `public/wasm/mediapipe/` 버킷 생성, `@mediapipe/tasks-vision/wasm/` 내용 복사 + `pose_landmarker_lite.task` 모델 업로드. `EXPO_PUBLIC_MEDIAPIPE_BASE=https://{project}.supabase.co/storage/v1/object/public/wasm/mediapipe` 설정.

**수용 기준**
- 크롬 DevTools Slow 3G 시뮬레이션 → `/record` 진입 시 10초 내 **정상 또는 명시적 실패 UI** 중 하나만 노출. mock 폴백 노출 금지(프로덕션).
- `grep -r "mock pose" dist/` 결과 0건(프로덕션 빌드).
- 테스트 `usePoseDetection.web.test.ts` 추가: 로드 성공·실패·retry 3 케이스.

### 4.3 렌더링 오류 `q is not a function` 재발 방지 (P1-C, 0.5일)

**파일** `scripts/patch-dist.js`, `vercel.json`.

**작업**
1. `scripts/patch-dist.js` 내용 검토 — 번들 심볼 변조 여부 확인. 변조한다면 Terser/esbuild 옵션과 충돌 가능성 점검.
2. `vercel.json` 의 `buildCommand` 를 `npm ci && npm run build:web` 로 고정. `installCommand` 는 `npm ci --legacy-peer-deps`.
3. Sentry 도입 — `npm i @sentry/react-native` 후 `app/_layout.tsx` 최상단에서 `__DEV__ === false` 시에만 초기화. DSN 은 `EXPO_PUBLIC_SENTRY_DSN`.

**수용 기준** 실기기 3종(iPhone Safari, Galaxy Chrome, MacBook Chrome) 에서 30회 녹화-결과 전환 반복 시 오류 0건.

### 4.4 Phase 1 PR 수용 기준

- [ ] 콘솔 경고 0건(라이브 기준).
- [ ] 포즈·제스처·음성 인식이 실 데이터로 작동(실기기 3종 확인).
- [ ] Vitest green, `scripts/lint-routes.js` 통과.
- [ ] Sentry 수집 활성, 첫 24시간 이벤트 0건 관측.
- [ ] `PROGRESS.md` 갱신, `CHECKLIST_PHASE_0.md` 실기기 체크.

---

## 5. Phase 2 — 크로스 브라우저 안정성 (3~7일)

### 5.1 호환성 매트릭스 확정 (`docs/COMPATIBILITY.md` 업데이트)

| 기능 | iOS Safari 15+ | iOS Chrome | Android Chrome | Desktop Chrome | Desktop Safari 16+ | Desktop Firefox |
|---|---|---|---|---|---|---|
| getUserMedia | O | O | O | O | O | O |
| MediaRecorder H264 | O(.mov) | O | O(.webm/.mp4) | O | O | 폴백(.webm) |
| WebCodecs VideoEncoder | X | X | O | O | O(16.4+) | X |
| MediaPipe Tasks GPU | O | O | O | O | O | CPU폴백 |
| Web Speech 연속 | 자동 재시작 | O | O | O | O | Whisper 폴백 |
| OffscreenCanvas | O | O | O | O | O | O |
| navigator.share(files) | O | O | O | O(14+) | O | X(다운로드 폴백) |

### 5.2 플랫폼 폴백 구현

1. **VideoEncoder 미지원** — `engine/recording/codecNegotiator.ts` 가 자동으로 `MediaRecorder` 로 전환. 컨테이너: iOS `.mp4`, Android Chrome `.webm` 우선.
2. **Firefox Web Speech 미지원** — `engine/recognition/speechRecognizer.ts` 가 Whisper.wasm 로 폴백. Whisper 모델은 Supabase Storage 자체 호스팅.
3. **iOS Web Speech 자동 재시작** — 이미 `CHECKLIST_PHASE_1.md` 1.3 에 요구사항 있음. `onend` 에서 150ms 내 `start()` 재호출, transcript 누적 유지.

### 5.3 코드 스플리팅

1. `expo export --platform web` 라우트 단위 분할 활성. `home`·`record`·`result`·`profile` 4분할 목표.
2. MediaPipe WASM·TensorFlow 모델·Pixi.js 는 **`/record` 진입 시 동적 import**. 홈 번들에 포함 금지.
3. `index.html` 에 `<link rel="preconnect" href="{supabase-url}">` 추가 (웹 템플릿 또는 `scripts/patch-dist.js`).
4. `vercel.json` 정적 자산 `Cache-Control: public, max-age=31536000, immutable`.

### 5.4 관측성

- `@sentry/react-native` 프로덕션 전용 초기화.
- Vercel Analytics + Speed Insights 활성.
- `engine/studio/performanceBudget.ts` 초과 시 Sentry breadcrumb.

**수용 기준** 주간 크래시 프리 세션 ≥ 99%, 실기기 섹션 100% 체크.

---

## 6. Phase 3 — 챌린지 엔진 정상화 및 구조 개선 (1~2주)

### 6.1 챌린지 10종 개별 파일 분리

`services/mockData.ts`(72KB)의 챌린지 컬렉션을 `data/challenges/*.ts` 로 분리.

**신규 파일 구조**
```
data/challenges/
├── types.ts                     // Challenge 타입
├── index.ts                     // 통합 export, getChallengeById 유틸
├── daily-vlog.ts
├── news-anchor.ts
├── english-speaking.ts
├── storybook-reading.ts
├── travel-checkin.ts
├── unboxing-promo.ts
├── kpop-dance.ts
├── food-review.ts
├── motivation-speech.ts
└── social-viral.ts
```

**Challenge 타입** (types.ts)
```typescript
import type { Mission } from '../../engine/missions/types';
import type { SubtitleCue } from '../../engine/recognition/types';

export type ChallengeGenre =
  | 'kpop' | 'fitness' | 'news' | 'daily' | 'travel'
  | 'storybook' | 'english' | 'hiphop' | 'promo' | 'viral';

export type Challenge = {
  id: string;
  name: string;
  genre: ChallengeGenre;
  theme_id: string;
  difficulty: 1 | 2 | 3;
  duration_sec: 15 | 20 | 25 | 30;
  bpm: number;
  camera_mode: 'selfie' | 'rear';
  default_template_id: string;
  compatible_templates: string[];  // 결과 화면 추천 템플릿
  scene: string;
  caption_template: string;
  missions: Mission[];
  subtitle_timeline: SubtitleCue[];
};
```

### 6.2 미션 ↔ 챌린지 결속 검증

각 챌린지가 선언한 미션이 `engine/missions/*` 판정 엔진과 실제 연결되어 동작하는지 확인. Vitest 에 챌린지 단위 테스트 추가.

### 6.3 챌린지 ↔ 템플릿 권장 매핑 (결과 화면용)

- `kpop-dance-001` → `kpop-stage`, `neon-arena`, `retro-vhs`, `cinematic-vlog`
- `news-anchor-001` → `news-anchor`, `minimal-glass`, `motivational-gold`
- `fitness-pushup-001` → `fitness-arena`, `neon-arena`, `motivational-gold`
- `travel-checkin-001` → `travel-polaroid`, `cinematic-vlog`, `retro-vhs`
- `food-review-001` → `food-neon-sign`, `emoji-explosion`, `retro-vhs`
- `english-speaking-001` → `minimal-glass`, `motivational-gold`, `news-anchor`
- `storybook-reading-001` → `storybook-pastel`, `minimal-glass`
- `daily-vlog-001` → `cinematic-vlog`, `retro-vhs`, `emoji-explosion`
- `unboxing-promo-001` → `food-neon-sign`, `emoji-explosion`, `minimal-glass`
- `motivation-speech-001` → `motivational-gold`, `cinematic-vlog`, `minimal-glass`
- `social-viral-001` → `emoji-explosion`, `neon-arena`, `retro-vhs`

**수용 기준** 10 챌린지 개별 파일 이전, mockData.ts 내 챌린지 컬렉션 제거, 10개 챌린지 각각 Vitest 1 케이스 이상.

---

## 7. Phase 4 — 템플릿 12종 확장 (2~4주, 가장 중요)

### 7.1 목표

현재 `data/templates/` 3종을 **12종**으로 확장. 각 템플릿은 `neon-arena.ts` 를 기준 패턴으로 하되 **완전히 다른 무드**여야 함.

### 7.2 12종 템플릿 명세

| # | ID | 한글명 | 무드 | 주 팔레트 | BGM 장르/BPM | 적합 챌린지 |
|---|---|---|---|---|---|---|
| 1 | `neon-arena` | 네온 아레나 (기존) | 사이버펑크 격렬 | #FF2D95·#00E0FF·#39FF7D | Synthwave 128 | K-POP, 피트니스, 힙합 |
| 2 | `news-anchor` | 뉴스 앵커 (기존) | 정식 브로드캐스트 | 네이비·화이트·레드 포인트 | Corporate 100 | 뉴스, 스피치 |
| 3 | `emoji-explosion` | 이모지 폭발 (기존) | 귀엽·활기 | 파스텔 멀티 | J-pop 120 | 일상, 맛집, 바이럴 |
| 4 | `cinematic-vlog` | 시네마틱 브이로그 | 영화적 티얼앤오렌지 + 레터박스 + 필름 그레인 | #0B6E6E·#E9825A·딥네이비 | LoFi ambient 85 | 브이로그, 여행, 동기부여 |
| 5 | `fitness-arena` | 피트니스 아레나 | 체육관·리프팅 바·대형 카운터 HUD·땀방울 파티클 | 블랙·#FF3B30·네온옐로 | EDM 140 | 피트니스, K-POP |
| 6 | `storybook-pastel` | 동화책 파스텔 | 수채 페이지·빈티지 테두리·손글씨 자막·구름 별 드리프트 | 파스텔 핑크·크림·민트 | Acoustic lullaby 80 | 동화책, 힐링 |
| 7 | `travel-polaroid` | 여행 폴라로이드 | 폴라로이드 프레임·스탬프·지도 동선·위치 핀 HUD | 선셋 오렌지·샌드·딥블루 | Indie folk 110 | 여행, 관광지 |
| 8 | `food-neon-sign` | 푸드 네온 사인 | 간판 네온 글로우·김 연기·메뉴판 타이포·별점 HUD | 네온레드·옐로·블랙 | Chill hop 95 | 맛집, 언박싱 |
| 9 | `motivational-gold` | 모티베이션 골드 | 골드 그라디언트·대형 키네틱 타이포·빛줄기·박수 파티클 | 블랙·골드·딥버건디 | Orchestral cinematic 90 | 동기부여, 스피치, 영어 |
| 10 | `retro-vhs` | 레트로 VHS | VHS 라인 노이즈·컬러 블리딩·타임코드 HUD·오래된 TV crop | 마젠타·시안·크림 | 80s synth 112 | 일상, 맛집, 여행 |
| 11 | `minimal-glass` | 미니멀 글라스 | 프로스트 글라스 패널·마이크로 타이포·심플 프레임·잔잔한 점등 | 오프화이트·그래파이트·소프트블루 | Minimal piano 82 | 뉴스, 스피치, 영어 |
| 12 | `kpop-stage` | K-POP 스테이지 | 아이돌 무대 조명·스팟라이트 스위프·LED 스크린 배경·스파클·시그니처 색 | 블랙·핫핑크·골드 | K-pop 128 | K-POP, 바이럴, 힙합 |

### 7.3 레이어 구성 표준 (`neon-arena.ts` 기준)

각 템플릿은 최소 **20 레이어**, 5 그룹으로 구성.

| 그룹 | zIndex 범위 | 레이어 수 | 대표 타입 |
|---|---|---|---|
| 배경 | 1~10 | 5~7 | gradient_mesh, animated_grid, star_field, floating_shapes, noise_pattern, parallax_layer |
| 카메라 | 20~25 | 2~3 | camera_feed, camera_frame (ring/mask), camera_reflection |
| AR | 30~35 | 2~4 | face_sticker, hand_emoji, body_aura |
| 전경 | 40~50 | 3~5 | particle_ambient, orbiting_ring, beat_flash, audio_visualizer, light_ray |
| HUD | 60~70 | 4~6 | counter_hud, timer_ring, score_hud, mission_prompt, genre_badge, caption_track |
| FX (기본 비활성) | 80~90 | 3~5 | particle_burst, lens_flare, chromatic_pulse, kinetic_text, lut_mono (for fail) |

### 7.4 BGM 및 반응형 바인딩

각 템플릿 `bgm.src` 는 **Supabase Storage 절대 URL** 로 설정. `bgm.beatsJson` 도 사전 분석 결과 업로드 후 URL 바인딩. `bgm.duckingDb` 는 기본 -8dB.

`reactive_bindings` 는 `neon-arena.ts` 의 `onBeat.every: 1`, `onOnset.duration_ms: 150` 패턴을 계승, 템플릿 무드에 맞게 조절.

### 7.5 postProcess 체인

템플릿별 권장 조합.

- `neon-arena` bloom 1.2 / chromatic 2~8 / crt_scanlines 0.15 / vignette 0.3 (기존)
- `cinematic-vlog` color_grade `teal-orange` / bokeh 0.4 / letterbox 0.12 / film_grain 0.08
- `fitness-arena` bloom 1.5 / contrast 1.2 / saturation 1.3 / vignette 0.2
- `storybook-pastel` saturation 0.85 / bloom 0.6 / watercolor_blur 0.3 / vignette 0.25
- `travel-polaroid` polaroid_frame / faded_film / bokeh 0.3 / warm_tint
- `food-neon-sign` bloom 1.8 / chromatic 3 / neon_glow 1.2 / vignette 0.4
- `motivational-gold` bloom 1.0 / gold_tint / glow 0.8 / letterbox 0.1
- `retro-vhs` chromatic 6 / crt_scanlines 0.35 / vhs_noise 0.5 / color_bleed 0.4
- `minimal-glass` glass_blur 0.2 / subtle_grain 0.05 / contrast 1.05
- `kpop-stage` bloom 1.6 / chromatic 2 / spotlight_sweep 1.0 / stage_glow 1.2

### 7.6 결과 페이지 템플릿 스위처 UX

`app/result/index.tsx`(58KB) 를 리팩터.

레이아웃
1. 상단: 1080×1920 세로 비디오 플레이어 (`playsinline`, `muted` 토글).
2. 중단: 수평 스크롤 **템플릿 썸네일 스트립**. `compatible_templates` 앞, 나머지 뒤. 각 썸네일은 3초 미리보기 WebP 또는 경량 Pixi 미리보기.
3. 탭 시 `videoCompositor.applyTemplate(recording, template)` 호출, iPhone 13 기준 500ms 내 프리뷰.
4. 하단: 점수·미션 결과·공유 버튼(§10).

**수용 기준**
- `data/templates/` 12 파일 존재.
- 각 템플릿 Vitest 스냅샷 (레이어 수·zIndex 유니크·postProcess 유효성).
- 결과 페이지에서 12종 전부 스위칭 가능.
- 최소 3종(cinematic·fitness·kpop-stage) 실기기 풀 플로우 검증.

---

## 8. Phase 5 — Pixi.js 도입 및 GPU 렌더 품질 (1~2주)

`PROGRESS.md` 승인 대기 해소 후 진행.

### 8.1 도입

`npm i pixi.js@^8 pixi-filters@^8`. peer dep 충돌 시 기존 `.npmrc legacy-peer-deps` 활용.

### 8.2 작업

1. `engine/effects/postProcess3d.ts` 신규. Pixi Filter 파이프라인으로 bloom·LUT·DoF·chromatic aberration GPU 구현.
2. `engine/effects/postProcess2d.ts` 는 SSR·WebGL 비지원 폴백 전용으로 격하.
3. `engine/layers/*` 를 Pixi `Container`·`Sprite`·`Graphics` 기반으로 리팩터. 기존 Canvas 2D 경로 보존.
4. WebGL 지원 감지 후 자동 분기 (`utils/webglSupport.ts`).
5. `@shopify/react-native-skia` 는 네이티브 경로 유지.

### 8.3 수용 기준

- `neon-arena`·`kpop-stage`·`fitness-arena` bloom 차이가 육안 확인.
- 실기기 30초 녹화 평균 프레임레이트 ≥ 30 FPS.
- WebGL 비지원 시 Canvas 2D 폴백 크래시 없음.

---

## 9. Phase 6 — BGM·오디오 파이프라인 (3~5일)

### 9.1 라이선스 (대표님 측 병행)

- Artlist 또는 Epidemic Sound (상업용).
- 12 템플릿 각 2~4곡, 총 24~48곡. 15·25·30 초 루프 버전 추출.
- 포맷 `.m4a` (AAC 128kbps).

### 9.2 저장 및 메타데이터

1. Supabase Storage 버킷 `bgm/` (public read) 생성.
2. `utils/bgmLibrary.ts` 의 분석 함수로 BPM·onset 시각 배열을 사전 생성, `*.beats.json` 을 함께 업로드.
3. `data/templates/*.ts` 의 `bgm.src`·`bgm.beatsJson` 을 실 URL 로 변경.

### 9.3 믹싱

`engine/recording/audioMixer.ts` — script·loudVoice 미션 구간 BGM -12dB 자동 더킹.
`engine/beat/beatClock.ts` — BGM onset ↔ `reactive_bindings.beat.onset` 동기화.

**수용 기준** 모든 템플릿의 `bgm.src` 가 실 파일 URL(빈 문자열 0건). 녹화 중 BGM 자동 시작·종료 페이드, 보이스 구간 더킹 확인.

---

## 10. Phase 7 — SNS 자동 업로드 (4~10주, 앱 심사 포함)

### 10.1 단계

1. **0~1주** 메타 Developer 앱 생성, Facebook 페이지 + Instagram Business 연결.
2. **1~6주** Instagram Graph API Content Publishing 권한 심사.
3. **병행** 틱톡 Developer Portal → Content Posting API 승인 (Direct Post 별도).
4. **병행** Google Cloud 프로젝트 → YouTube Data API v3 활성화 → OAuth 2.0 클라이언트 생성.
5. 승인 후 `services/publishers/` 구현.

### 10.2 코드 구조

```
services/publishers/
├── types.ts                    // PublishResult, PublishError
├── instagramPublisher.ts       // Graph API /media + /media_publish
├── tiktokPublisher.ts          // Content Posting API
└── youtubePublisher.ts         // videos.insert + 쇼츠 판별

engine/result/shareSheet.ts     // 기존 + 업로드 액션 추가
```

각 퍼블리셔 시그니처 `publish(videoFile: Blob, metadata): Promise<PublishResult>`.

### 10.3 토큰 관리

Supabase Edge Function `/functions/oauth/{platform}/callback` 로 수신. 리프레시 토큰은 `auth.users` 메타 또는 별도 `user_integrations` 테이블에 저장 + RLS 강제.

**수용 기준** 2개 플랫폼 이상 업로드 성공, 토큰 만료 자동 리프레시, 실패 시 `engine/studio/retry.ts` 큐 재활용.

---

## 11. Phase 8 — 성능·접근성·QA (전 Phase 병행)

### 11.1 성능 예산 (docs/PERFORMANCE.md)

- 초기 번들 < 400KB gzip, 라우트별 < 600KB.
- 녹화 1080×1920 30FPS 프레임 드롭 < 5%.
- 렌더링 30초 → MP4 < 10초(WebCodecs) / < 30초(서버).
- 메모리 세션 RSS < 500MB.

### 11.2 접근성

- 키보드 포커스 순서: 탭 → 챌린지 카드 → 시작.
- aria-label 모든 버튼.
- 자막 명도 대비 AA 이상.

### 11.3 QA

- `CHECKLIST_PHASE_0.md ~ 7.md` 실기기 100%.
- Playwright E2E: `home → challenge → record(fake media) → result → share preview`.
- Sentry 주간 크래시 0건 목표.

---

## 12. 보안·컴플라이언스

1. `.env.production` 재검토. **`EXPO_PUBLIC_` 접두사 이외 키 커밋 금지**. 서비스 롤 키·플랫폼 비밀키는 Edge Function 에만.
2. Supabase RLS 정책 `supabase/migrations/` 추가. 사용자 녹화·프로필 `auth.uid() = owner_id` 제한.
3. 지속학습프로파일링모듈 구현 시 개인정보 약관·고지 갱신.
4. SNS 배포 시 각 플랫폼 커뮤니티 가이드라인 준수.

---

## 13. Phase 종속성 그래프

```
Phase 1 (긴급) ──┬─> Phase 2 (호환성) ──┬─> Phase 3 (챌린지) ──┐
                 │                      │                     │
                 └─> Phase 6 (BGM)      └─> Phase 4 (템플릿 12) ─> Phase 5 (Pixi) ─> Phase 8 (QA)
                                                              ─> Phase 7 (SNS, 병행 심사)
```

- Phase 1·2 선행 필수.
- Phase 7 앱 심사는 Phase 3 시점부터 병행 신청.

---

## 14. PR 분리 및 승인 정책

- Phase 1 단일 PR, 대표님 직접 리뷰·머지.
- Phase 4 템플릿 12개는 **PR 12개** 로 분리, 각 PR 에 룩 스크린샷 1장.
- Phase 5 Pixi 도입 별도 PR, 성능 회귀 테스트 필수.
- Phase 7 SNS 는 플랫폼 심사 통과 증빙 첨부 후 머지.

---

## 15. 참고 문서

- `CLAUDE.md` v4 — 루트 규칙.
- `docs/COMPOSITION.md` — 컴포지션 엔진.
- `docs/TEMPLATES.md` — 기존 3 템플릿 스펙.
- `docs/COMPATIBILITY.md` — 호환성 매트릭스.
- `docs/PERFORMANCE.md` — 성능 예산.
- `docs/EDGE_CASES.md` — 엣지 케이스.
- 특허 10-2025-02049151 — 청구 모듈 7종 정합 기준.
- Expo Router docs — Stack/Tabs 정책.
- MediaPipe Tasks Vision — PoseLandmarker API.
- Pixi.js v8 docs — Filter, Assets.
- Meta Graph API / TikTok Content Posting API / YouTube Data API v3.

---

## 16. 책임 경계

본 문서는 외부 감사 결과 기반 **작업 지시서**이며, 지침과 저장소 실제 상태 충돌 시 **실제 상태를 기준으로 작업하되 본 문서 수용 기준은 유지**. 구현 디테일은 Claude Code 가 파일을 직접 읽고 판단.

문서 작성자: 외부 감사 에이전트 (Cowork mode).
작성일: 2026-04-20.
브랜치 명명: `feat/phase-N-slug`, `fix/phase-N-slug`.

---

## 부록 A — Phase 1 라우트 패치 (즉시 적용 가능)

**파일** `app/_layout.tsx`

```diff
         <Stack.Screen name="(main)" options={{ headerShown: false }} />
-        <Stack.Screen name="(auth)"  options={{ headerShown: false }} />
-        <Stack.Screen name="record/index" options={{ headerShown: false, animation: 'fade' }} />
-        <Stack.Screen name="result/index" options={{ headerShown: false, animation: 'fade' }} />
+        <Stack.Screen name="record" options={{ headerShown: false, animation: 'fade' }} />
+        <Stack.Screen name="result" options={{ headerShown: false, animation: 'fade' }} />
       </Stack>
```

---

## 부록 B — 기존 `data/templates/neon-arena.ts` 레이어 카탈로그 (타 템플릿 작성 시 참조)

```
배경     bg_mesh / bg_grid / bg_stars / bg_shapes / bg_noise        (5)
카메라   cam_feed / cam_frame / cam_reflect                          (3)
AR      ar_visor / ar_hand_l_spark / ar_hand_r_spark                (3)
전경     fg_particles / fg_ring / fg_flash / fg_visualizer            (4)
HUD     hud_counter / hud_timer / hud_score / hud_prompt            (4)
FX      fx_burst / fx_lens_flare / fx_chromatic / fx_perfect_text   (4, enabled: false)
──────────────────────────────────────────────────────────────────
합계 23 레이어
postProcess 4단(bloom·chromatic·crt_scanlines·vignette)
missionTimeline 1(main_squat: 2~20초, squat_count target 10)
successEffects 3(lens_flare·particle_burst·kinetic_text)
failEffects 2(chromatic_pulse·lut_mono)
```

신규 템플릿 11개는 이 구조를 유지하되 타입·파라미터를 무드에 맞게 변경. 완전히 같은 레이어 구성에 색만 바뀌면 실패.