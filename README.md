# MotiQ — AI 챌린지 숏폼 생성 MVP

> 특허 **10-2025-02049151** 기반 — 멀티모달 AI 미션 + 레이어드 컴포지션 + 결정론적 점수화의 엔드투엔드 파이프라인을 100% 클라이언트로 구현한 참조 구현체.

**Live**: https://mvp-ivory-kappa.vercel.app  
**Repo**: https://github.com/jm-git-163/mvp-challenge

---

## 무엇을 보여주는가 (What this MVP demonstrates)

- **실시간 멀티모달 인식**: 포즈(MediaPipe PoseLandmarker)·음성(SpeechRecognition)·표정(FaceLandmarker blendshapes)·제스처(GestureRecognizer)를 단일 세션에서 동시 가동.
- **결정론적 점수화**: setTimeout/Math.random 0개. 미션별 공식 기반(스쿼트 깊이·템포 / 자막 일치율 / 음성 dB·지속 / 표정 강도 등).
- **레이어드 컴포지션**: 카메라가 풀스크린이 아니라 *하나의 레이어*. 그라디언트·파티클·자막·HUD·AR 스티커가 동시 합성되는 메인 캔버스.
- **합성 영상 출력**: Canvas 2D 메인 + (계획) PixiJS 포스트프로세스 → MediaRecorder mp4/webm. EBML Duration 패치로 카톡 등 외부 플레이어 호환.
- **공유 루프**: navigator.share Files API + 코덱 협상 + 인앱 브라우저 분기 + 도전장(invite) 왕복.
- **풀 클라이언트**: 영상·오디오·랜드마크·사용자 입력 **0건 서버 전송**. 분석·계정·결제·광고 SDK 0개.

---

## 기술 스택 (Actual stack)

| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | Expo SDK 54 + expo-router 6 + React Native Web |
| 인식 엔진 | `@mediapipe/tasks-vision`, `@tensorflow-models/pose-detection`(폴백), Web Speech API, Web Audio AnalyserNode |
| 렌더링 | Canvas 2D (메인), `@shopify/react-native-skia`(부분), 향후 PixiJS v8 (포스트프로세스) |
| 상태 | Zustand + IndexedDB 영속 |
| 녹화 | MediaRecorder + 코덱 협상(`engine/recording/codecNegotiator.ts`) + EBML Duration 패치 |
| 스타일 | Tailwind 토큰 + Pretendard Variable + Framer Motion |
| 테스트 | Vitest (1100+ 테스트) |
| 백엔드 | Supabase (템플릿 메타데이터 read-only). 영상·점수·랜드마크는 절대 업로드 X |
| 배포 | Vercel `main` 자동 배포 |

---

## 빠른 실행 (Local run)

```bash
npm install
npm run web        # expo start --web (HTTPS 필요 시 ngrok/mkcert 추천)
npm run test       # vitest 1100+ 테스트
npm run analyze:bgm  # 사전 BGM 비트 분석 (essentia.js)
```

> Note: 카메라·마이크 권한이 필요하므로 **`https://localhost`** 또는 실기기 접속 필수. `http://localhost`는 권한 거부됨.

---

## 디렉토리 구조 (핵심만)

```
/app                  expo-router 라우트 (record, result, challenge/[slug], debug/*)
/components
  /camera             RecordingCamera.web.tsx, CanvasRecorder.web.tsx
  /record             PoseCalibration, JudgementBurst 등
  /studio             CompositionCanvas, PostFxPipeline (Phase 5)
/engine
  /session            mediaSession.ts (싱글톤 getUserMedia), wakeLock, popupSuppressor
  /recognition        pose/face/gesture/speech/audio
  /missions           squatCounter, scriptReader, hipMotionGate, noseSquat
  /scoring            미션별 scorer + aggregator
  /recording          codecNegotiator, recorder, audioMixer
  /composition        layerEngine, layers/*  (Phase 5 진행중)
  /beat               beatClock, onsetDetector, bgmAnalyzer.node.ts
  /ar                 oneEuroFilter (스무딩)
  /postfx             pixiPipeline (Phase 5f 예정)
/data/templates       선언형 템플릿 (zod 검증) — neon-arena, news-anchor, emoji-explosion
/utils                share, videoCompositor, fixBlobDuration, composedVideoStash 등
/store                studioStore, inviteStore (Zustand)
```

---

## 검증 시나리오 (Validation guide)

1. **권한**: `/permissions`에서 카메라·마이크 1회 허용 → 챌린지 중 추가 팝업 0개
2. **스쿼트 미션**: 피트니스 템플릿 → 무릎-엉덩이 각도 + 코 y축 진폭 다중 검증으로 카운트
3. **자막 읽기 미션**: 음성 템플릿 → 레벤슈타인 일치율 + 적응형 자막 페이싱
4. **결과 페이지**: `/result` 자동 합성 트리거 → mp4(우선) 또는 webm 출력
5. **공유**: `/result` → "SNS 공유" → `navigator.share({files})` (인앱 브라우저는 다운로드 폴백)
6. **도전장 왕복**: `/templates`에서 친구에게 카톡 전송 → 친구가 `/challenge/[slug]` 진입 → 결과 영상 회신
7. **진단**: `/debug/share` section 0에서 실제 합성된 영상의 MIME/크기/duration 확인 (IndexedDB 영구 저장)

---

## 솔직한 한계 (Known limitations)

- **레이어 컴포지션 엔진 (Phase 5)** 미완. 현재는 카메라 + HUD 수준. 15+ 레이어 동시 합성은 진행중 (`docs/COMPOSITION.md`)
- **PixiJS 포스트프로세스** 미도입. 블룸·LUT·크로매틱 미적용
- **AR 스티커** 랜드마크 트래킹 미연결
- **외부 SNS 자동 업로드 불가** (YouTube/TikTok/Instagram/Kakao API는 모두 OAuth+서버 필수). 현재는 시스템 공유 시트 호출까지만.
- **BGM 사전 비트 분석** 스크립트 존재하나 플레이스홀더 BGM만 사용중
- **iOS Safari 30fps 안정성** 실기기 검증 진행중

전체 미해결 이슈는 `CLAUDE.md` §3 (FORBIDDEN PATTERNS) 및 Phase 5 문서 참고.

---

## 다음 기술 단계 (Roadmap)

### Phase 5 — 레이어드 컴포지션 엔진 (제품의 60%, 진행중)
- 5a 메인 캔버스 + 카메라 프레이밍 6종 (원형·하트·육각형·분할 등)
- 5b 레이어 엔진 코어 (생명주기·zIndex·blend mode)
- 5c 기본 레이어 10종 (그라디언트·파티클·텍스트)
- 5d 비트 싱크 엔진 (사전 분석 JSON + 런타임 BeatClock + 리액티브 바인딩)
- 5e AR 트래킹 레이어 (face_sticker, hand_emoji)
- 5f 포스트프로세스 파이프라인 (PixiJS v8: 블룸·LUT·크로매틱·그레인)
- 5g HUD 레이어 (score/counter/timer/prompt)
- 5h 텍스트 레이어 (karaoke_caption/news_ticker/kinetic_text)
- 5i 3개 레퍼런스 템플릿 완전 구현 (`docs/TEMPLATES.md`)

### Phase 6~7 — 통합 품질·실기기 안정성
- 캘리브레이션 / 3-2-1 카운트다운 / 햅틱 / 재시도
- iOS Safari·Android Chrome·카톡 인앱 브라우저 실기기 체크리스트
- Lighthouse 90+ 성능

---

## 법적·윤리적 가드레일

- **100% 클라이언트**. 영상·오디오·랜드마크·사용자 입력 서버 전송 절대 금지
- **분석 SDK·광고·결제·소셜 OAuth 0개**
- **계정 시스템 없음**. 모든 상태는 IndexedDB / localStorage
- 라이선스 미정 (특허권자 동의 전 상업적 사용 불가)

---

## 문서

- `CLAUDE.md` — 최상위 명세 v4 (모든 작업 기준)
- `docs/COMPOSITION.md` — Phase 5 레이어 엔진 아키텍처
- `docs/TEMPLATES.md` — 3개 레퍼런스 템플릿 상세
- `docs/VISUAL_DESIGN.md` — 디자인 토큰
- `docs/COMPATIBILITY.md` — 브라우저·기기 호환성
- `docs/PERFORMANCE.md` — 성능 예산
- `docs/EDGE_CASES.md` — 엣지 케이스
- `docs/TESTING.md` — 검증 3계층
- `ASSET_CHECKLIST.md` — 사용자가 직접 교체할 자산 목록

---

## 관련 출원

- 특허 출원번호: **10-2025-02049151** (대한민국)
- 발명자·출원인: 본인 단독
