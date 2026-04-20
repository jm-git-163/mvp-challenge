# CLAUDE.md — MotiQ 프로덕션 레디 구현 명세 v4

> 이 문서는 Claude Code가 **매 세션 시작 시 반드시 먼저 읽고**, 모든 작업의 기준으로 삼는 **루트 규칙서**다.
> 특정 작업 수행 전에 `docs/` 하위 해당 보조 문서를 반드시 읽는다.

## 보조 문서 (작업 시점에 해당 문서 로드)
- **`docs/COMPOSITION.md`** — **가장 중요.** 레이어드 컴포지션 엔진 (Phase 5 전체) 아키텍처
- **`docs/TEMPLATES.md`** — 3개 레퍼런스 템플릿 레이어별 상세 구성
- `docs/VISUAL_DESIGN.md` — 디자인 토큰 (색·타이포·이징)
- `docs/COMPATIBILITY.md` — 브라우저·기기 호환성
- `docs/PERFORMANCE.md` — 성능 예산, 메모리 관리
- `docs/EDGE_CASES.md` — 엣지 케이스, 에러 복구
- `docs/TESTING.md` — 검증 3계층

---

## 0. 프로젝트 정체성

MotiQ = **게임화된 멀티모달 영상 콘텐츠 자동 생성 시스템** (특허 10-2025-02049151).

**핵심 가치 제안**: 사용자가 템플릿을 선택하면, 촬영 전체 구간에 걸쳐 **15~25개의 애니메이션 레이어가 실시간 합성**되며, AI가 사용자의 포즈·음성·표정·제스처를 인식해 미션 성공/실패 이벤트로 레이어들이 반응하고, 결과물은 **캡컷/인스타 릴스/캔바 템플릿을 능가하는** 완성형 영상으로 자동 출력되는 시스템.

**단순 편집 앱이 아니다. 실시간 모션그래픽 엔진 + AI 미션 시스템 + 자동 편집본 출력**이 하나로 결합된 제품이다.

---

## 1. 템플릿의 정의 (절대 오해 금지)

### 1.1 틀린 개념
```
[인트로 2초 타이틀 카드]
→ [카메라가 풀스크린 + HUD만 얹힘]
→ [아웃트로 2초 결과 카드]
```
이것은 단순 영상 편집이다. 이 구조로 구현하면 HTML 목업 수준을 벗어나지 못한다.

### 1.2 올바른 개념
```
촬영 시작 시점부터 종료까지 하나의 메인 캔버스에
15~25개 레이어가 동시에 렌더링되며 계속 움직인다.

카메라 영상은 그 중 하나의 레이어일 뿐이고,
대부분 창의적으로 프레이밍된다 (원형·하트·육각형·분할 등).

모든 레이어는 BGM 비트·음성·미션 이벤트·AR 랜드마크에 반응한다.

결과: 사용자가 "내가 촬영한" 느낌보다
"내가 어떤 컨텐츠 속에 들어간" 느낌을 받는다.
```

**상세 구현은 `docs/COMPOSITION.md`**. 3개 레퍼런스 템플릿 상세는 `docs/TEMPLATES.md`.

---

## 2. 출시 수준의 정의

1. 사용자가 템플릿 선택 → **단 한 번** 권한 허용 → 카운트다운 → 촬영 시작
2. 촬영 중 **어떤 팝업·모달·배너도** 뜨지 않음
3. 화면에 **15개 이상 레이어가 동시 연출**, BGM 비트에 맞춰 실시간 반응
4. AI 인식(포즈·음성·표정·제스처)이 **정확히** 동작하고 점수가 공식대로 누적
5. AR 얼굴 스티커·손 이펙트가 랜드마크 따라 움직이며 지터 없음
6. 포스트프로세스(블룸·LUT·크로매틱·그레인) 적용
7. 촬영 종료 시 **모든 레이어와 후처리가 박힌 mp4** + 총점·별점·미션별 점수
8. iOS Safari·Android Chrome에서 30fps 안정

위 8개 모두 만족해야 완성. 하나라도 깨지면 미완성.

---

## 3. 절대 금지 (FORBIDDEN PATTERNS)

Claude Code가 다음을 하면 즉시 되돌리고 재작업.

1. **가짜 인식**: setTimeout/랜덤/버튼으로 카운트·점수 증가
2. **가짜 점수**: Math.random, 고정값, 단순 카운터
3. **"인트로→촬영→아웃트로" 분할 구조**: 이 구조로 템플릿 구현 금지. 반드시 §1.2 레이어드 컴포지션
4. **카메라 풀스크린 고정**: 템플릿 1개 이상은 반드시 창의적 프레이밍(원형·하트·육각형 등) 사용
5. **레이어 10개 미만**: 출시 템플릿은 15개 이상 레이어 필수
6. **정적 배경**: 단색 또는 정지 이미지 배경 금지. 반드시 애니메이션
7. **비트 싱크 누락**: BGM이 있는데 아무 레이어도 비트에 반응하지 않으면 실패
8. **AR 없음**: 표정·제스처 템플릿에 얼굴/손 랜드마크 기반 레이어 없으면 실패
9. **포스트프로세스 생략**: 최소 블룸+LUT는 필수 (저사양 tier 제외)
10. **DOM 오버레이로 녹화본 누락**: 모든 시각 요소는 캔버스 합성. DOM은 UI 전용
11. **하드코딩 템플릿**: if/else 분기 금지. `/data/templates/*/index.ts` 선언형 + zod 검증
12. **챌린지 중 팝업**: 촬영 시작~종료 팝업·모달·토스트·alert 0개
13. **getUserMedia 중복 호출**: 앱 전체 1회만
14. **랜드마크를 useState에 저장**: useRef 강제, 리렌더 폭탄 방지
15. **MediaPipe `.close()` 누락**: 메모리 누수
16. **코덱 하드코딩**: webm만 쓰면 iOS에서 실패. `isTypeSupported` 폴백
17. **`'use client'` 누락**: MediaPipe·canvas·AR 사용 컴포넌트
18. **StrictMode 미대응**: useEffect cleanup으로 멱등 보장
19. **Error Boundary 누락**: 카메라·녹화·인식·컴포지션 영역 각각
20. **거짓 완료 보고**: Playwright + Vitest + 실기기 체크리스트 3계층 통과 전엔 완료 불가
21. **기능 삭제**: 주석·삭제 금지, 원인 해결
22. **한글 깨짐**: UI/에러/자막 한국어, `lang: 'ko-KR'`
23. **시각 게으름**: `docs/VISUAL_DESIGN.md` + `docs/TEMPLATES.md` 기준 미달 금지
24. **서버 전송**: 영상·오디오·랜드마크·사용자 입력 서버 전송 금지

---

## 4. 필수 기술 스택

### 4.1 인식 엔진
- `@mediapipe/tasks-vision` PoseLandmarker, FaceLandmarker(blendshapes), GestureRecognizer
- 네이티브 `SpeechRecognition` (`webkitSpeechRecognition` 폴백, `ko-KR`)
- Web Audio API `AnalyserNode`

### 4.2 컴포지션 엔진 (핵심)
- **메인 렌더**: Canvas 2D (MediaPipe 랜드마크 드로잉 단순)
- **포스트프로세스**: **PixiJS v8** (bloom/chromatic/CRT/LUT 필터)
- 메인 캔버스 → Pixi 텍스처 → 포스트프로세스 → 최종 캔버스 (녹화 대상)
- AR 스무딩: **One Euro Filter** 자체 구현
- Lottie: `lottie-web` canvas 렌더러

### 4.3 비트 싱크
- 사전 분석: `essentia.js` 로컬 노드 스크립트로 BGM 분석 → JSON 커밋
- 런타임: `BeatClock` 커스텀 (`docs/COMPOSITION.md` §5)
- 폴백: `AnalyserNode` 실시간 온셋 감지

### 4.4 녹화
- 히든 `<video playsInline muted>` + 표시 `<canvas>` (포스트프로세스 통과된 최종 캔버스)
- `canvas.captureStream(30)` + MediaRecorder
- 코덱: `docs/COMPATIBILITY.md §2.1` 폴백 체인
- `videoBitsPerSecond: 3_500_000`, 1초 청크
- 오디오: 마이크 + BGM + SFX, GainNode 덕킹

### 4.5 권한·세션
- `engine/session/mediaSession.ts`에서만 `getUserMedia` 호출 (CI grep 강제)
- Zustand 전역 스트림
- Wake Lock + NoSleep 폴백
- popupSuppressor (beforeinstallprompt, 앱 모달 억제)

### 4.6 상태·UI
- Next.js 14+ App Router
- `dynamic(() => import, { ssr: false })` MediaPipe·PixiJS
- Zustand (권한·스트림·실행상태·점수·억제플래그)
- Tailwind + shadcn/ui
- Framer Motion (UI 전환), GSAP (캔버스 고급 이징)
- zod (템플릿 런타임 검증)

### 4.7 성능
- MediaPipe: `requestVideoFrameCallback` 기반 20~24fps
- 랜드마크 useRef 저장, 수동 draw
- 저사양 tier 자동 감지 → 레이어·포스트프로세스·AR 자동 감소
- 정적 배경 오프스크린 캔버스 캐시

### 4.8 배포
- Vercel `main` 자동 배포, HTTPS

---

## 5. 점수 시스템

0~100 결정론적 공식. 상세는 이전 버전과 동일 (§4 공식).

| 미션 | 공식 |
|---|---|
| Squat | 달성률 50 + 깊이 30 + 템포 20 |
| Script | 레벤슈타인 60 + 완주율 20 + 시간 20 |
| Pose Hold | 유사도 60 + 안정성 40, 유지시간 비례 |
| Smile | 강도 50 + 지속 50 |
| Gesture | 신뢰도 70 + 응답속도 30 |
| Loud Voice | dB 60 + 지속 40 |

별점: `1 + round(총점/25)`.

---

## 6. 디렉토리 구조

```
/app
  /permissions /templates /studio /result/[id] /debug/*
/components
  /permissions/PermissionGate.tsx
  /studio
    CompositionCanvas.tsx  ← 메인 캔버스 (레이어 엔진 호스트)
    PostFxPipeline.tsx     ← PixiJS 포스트프로세스
    MissionOverlay.tsx     ← 미션 상태 표시 (레이어 엔진과 별개 DOM UI)
  /templates/*
  /ui/*
/engine
  /recognition             # pose/gesture/face/speech/audio
  /missions                # squatCounter, scriptReader, ...
  /scoring                 # 미션별 scorer + aggregator
  /composition             # ★ 신규 핵심
    layerEngine.ts         # 레이어 생명주기·렌더 오케스트레이션
    layers/                # 레이어 타입별 구현
      gradient_mesh.ts
      animated_grid.ts
      particle_ambient.ts
      particle_burst.ts
      camera_feed.ts
      camera_frame.ts
      face_sticker.ts
      hand_emoji.ts
      kinetic_text.ts
      karaoke_caption.ts
      news_ticker.ts
      score_hud.ts
      counter_hud.ts
      timer_ring.ts
      mission_prompt.ts
      beat_flash.ts
      chromatic_pulse.ts
      lens_flare.ts
      audio_visualizer.ts
      voice_bubble.ts
      lottie.ts
      ... (docs/COMPOSITION §3 타입)
    cameraFraming.ts       # 프레이밍 종류별 clip path
    reactiveBinding.ts     # onBeat/onOnset/onVolume/onMission 해석
  /beat
    beatClock.ts           # 사전 분석 JSON 기반 비트 시간 제공
    onsetDetector.ts       # 폴백 실시간 감지
    bgmAnalyzer.node.ts    # 오프라인 분석 스크립트
  /ar
    faceAnchor.ts          # FaceLandmarker → FaceAnchor
    bodyAnchor.ts          # PoseLandmarker → BodyAnchor
    oneEuroFilter.ts       # 스무딩
  /postfx
    pixiPipeline.ts        # PixiJS 합성·필터 체인
    filters/
      bloom.ts lut.ts chromatic.ts grain.ts vignette.ts scanlines.ts
  /recording
    codecNegotiator.ts compositor.ts recorder.ts audioMixer.ts
  /session
    mediaSession.ts wakeLock.ts popupSuppressor.ts compatibilityCheck.ts
/data/templates
  /neon-arena/ index.ts assets/*
  /news-anchor/ index.ts assets/*
  /emoji-explosion/ index.ts assets/*
  schema.ts                # zod
/store/studioStore.ts
/types/template.ts
/test-assets
/docs
```

---

## 7. 작업 Phase

### Phase 0 — 권한·세션 기반 (이전 버전과 동일)
0.1~0.5 `docs/COMPATIBILITY §7` 참조

### Phase 1 — 인식 엔진 (UI 금지)
pose/speech/gesture/face/audio + Vitest

### Phase 2 — 점수 엔진
scorer + aggregator + 경계값 테스트

### Phase 3 — 녹화 파이프라인 (기본)
codecNegotiator → compositor → recorder → audioMixer
단, Phase 3에서는 **단순 합성** (video + 테스트 텍스트 1개만). 본격적 레이어 합성은 Phase 5에서.

### Phase 4 — 디자인 시스템
Tailwind 토큰 / Pretendard / 글래스 shadcn / Framer 프리셋 / GSAP 도입 / zod 스키마

### Phase 5 — **레이어드 컴포지션 엔진** (가장 크고 중요)
**`docs/COMPOSITION.md` §11 세분화된 Phase 5a~5i 그대로 따른다**:

- 5a: 메인 캔버스 & 카메라 프레이밍 6종
- 5b: 레이어 엔진 코어 (생명주기·zIndex·blend)
- 5c: 기본 레이어 10종 (배경·파티클·텍스트)
- 5d: 비트 싱크 엔진 (사전 분석 + 런타임 + 리액티브 바인딩)
- 5e: AR 트래킹 레이어 (face_sticker, hand_emoji 등)
- 5f: 포스트프로세스 (PixiJS 파이프라인)
- 5g: HUD 레이어 (score/counter/timer/prompt)
- 5h: 텍스트 레이어 (karaoke_caption/news_ticker/kinetic_text)
- 5i: **3개 템플릿 구현** (`docs/TEMPLATES.md` 그대로)

각 단계마다 `/debug/layers/<type>` 또는 `/debug/*` 페이지로 단독 확인.

### Phase 6 — 통합 품질·엣지케이스
캘리브레이션, 3-2-1, 햅틱, 재시도, `docs/EDGE_CASES.md` 전부

### Phase 7 — 결과·배포·성능
결과 페이지, Error Boundary, Lighthouse 90+, 실기기 체크리스트

---

## 8. Phase 5 특별 주의사항

이 Phase가 제품의 **60%**다. 이전 Phase들은 이 Phase를 위한 준비.

### 8.1 에셋 현실
- Lottie·BGM·이미지 등 고품질 에셋은 Claude Code가 만들 수 없음
- **플레이스홀더 전략**: 순수 SVG/Canvas 드로잉 + 무음 BGM 30초로 먼저 구현
- 사용자에게 `ASSET_CHECKLIST.md` 생성: "아침에 LottieFiles에서 이 이름으로 검색하세요" 등

### 8.2 BGM 비트 분석
- 첫 작업으로 `scripts/analyze-bgm.node.ts` 작성
- essentia.js 또는 web-audio-beat-detector 사용
- 플레이스홀더 BGM이라도 비트 JSON 생성해야 onBeat 테스트 가능

### 8.3 PixiJS 도입
- 메인 렌더는 Canvas 2D, 포스트프로세스만 Pixi
- 두 캔버스 사이 텍스처 복사 오버헤드 측정 (docs/PERFORMANCE §5)
- 오버헤드 과다 시 메인도 Pixi로 전환 검토 (사용자 승인)

### 8.4 3개 템플릿 차별화 검증
마지막 체크는 사용자 실기기. 자동 검증 불가.
Claude Code는 `CHECKLIST_PHASE_5.md` 에:
- 각 템플릿 5초 분량 녹화 mp4 첨부
- 육안 비교 항목 나열 ("색이 다른가? 카메라 프레이밍이 다른가? 레이어 구성이 다른가? 이펙트 강도가 다른가?")

---

## 9. 자율 실행 루프

이전 버전과 동일하되 추가:
- Phase 5 진입 시 반드시 `docs/COMPOSITION.md` + `docs/TEMPLATES.md` 전체 재로드
- Phase 5 각 소단계 완료 시 `/debug/*` 페이지 Playwright 스크린샷 첨부

---

## 10. 보고·사용자 위임

- 매 commit: PROGRESS.md 한 줄
- Phase 완료: CHECKLIST_PHASE_N.md (자동/실기기 분리)
- 에셋 필요 시: ASSET_CHECKLIST.md (사용자가 교체할 것)
- BLOCKER: 우회하고 기록, 아침에 판단

## 11. 예외적으로 물어볼 것
- 유료 API, 의존성 교체, 서버 도입, 모델 변경, **PixiJS 도입** (Phase 5f 시작 전 확인)

## 12. 법적 가드레일
공무원 휴직 중 → 서버 전송·업로드·공유·수익화·광고·결제·분석툴 전부 금지. 100% 클라이언트.

## 13. 사용자 컨텍스트
법학 전문, 기술 세부는 비유로. 직설·논리 피드백, 칭찬 불필요. 한국어.
