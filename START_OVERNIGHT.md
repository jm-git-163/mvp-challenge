# START_OVERNIGHT.md v4 — 레이어드 컴포지션 버전

## 1. 자기 전 세팅

```bash
cd [MotiQ 레포 경로]

git checkout -b backup/$(date +%Y%m%d-%H%M) && git push origin HEAD
git checkout main

# 파일 배치 (8개)
# 루트: CLAUDE.md, START_OVERNIGHT.md
# docs/: COMPOSITION.md, TEMPLATES.md, VISUAL_DESIGN.md,
#        COMPATIBILITY.md, PERFORMANCE.md, EDGE_CASES.md, TESTING.md

mkdir -p docs

npm i -D @playwright/test vitest
npx playwright install chromium
echo "# MotiQ 진행 로그" > PROGRESS.md

git add -A && git commit -m "chore: v4 레이어드 컴포지션 명세"
git push
```

## 2. 실행

```bash
tmux new -s motiq
claude --dangerously-skip-permissions
```

## 3. 첫 프롬프트 (복붙)

---

```
먼저 다음 8개 문서를 순서대로 읽어라. 특히 COMPOSITION.md와 TEMPLATES.md는 반드시 정독.

1. 레포 루트 CLAUDE.md v4 (절대 규칙서, 템플릿 개념 완전히 수정됨)
2. docs/COMPOSITION.md ★ 가장 중요. 레이어드 컴포지션 엔진 전체 아키텍처
3. docs/TEMPLATES.md ★ 3개 템플릿의 레이어별 상세 (15~25개 레이어)
4. docs/VISUAL_DESIGN.md (디자인 토큰)
5. docs/COMPATIBILITY.md (브라우저/기기 호환)
6. docs/PERFORMANCE.md (성능 예산)
7. docs/EDGE_CASES.md (엣지 케이스)
8. docs/TESTING.md (검증 3계층)

지금까지의 실패 원인 전면 재정의:

템플릿 = 인트로+촬영+아웃트로 분할 (❌ 이전 이해)
템플릿 = 촬영 전 구간에 15~25개 레이어가 동시 연출되는 실시간 모션그래픽 컴포지션 (✓ 진짜 개념)

카메라 영상은 수많은 레이어 중 하나일 뿐이고, 보통 창의적으로 프레이밍(원형/하트/육각형/분할)된다.
배경·미드·전경·AR·포스트프로세스가 모두 BGM 비트·음성·미션 이벤트·얼굴 랜드마크에 실시간 반응한다.

지금까지의 사이트가 "HTML 목업 수준"이었던 이유는:
- 레이어 엔진이 없어서 카메라 풀스크린 위에 HUD 하나만 있음
- 비트 싱크가 없어서 모든 것이 정적 또는 단순 반복
- AR 트래킹이 없어서 인스타 필터 같은 반응형 요소 부재
- 포스트프로세스가 없어서 생짜 영상 느낌
- 카메라 프레이밍이 풀스크린 고정

오늘 너의 임무 (Phase 순서대로):

Phase 0: 권한·세션 기반 (mediaSession 단일 getUserMedia, PermissionGate, popupSuppressor, Wake Lock, compatibilityCheck)
Phase 1: 인식 엔진 (pose/speech/gesture/face/audio) + Vitest
Phase 2: 점수 엔진 (미션별 scorer + aggregator)
Phase 3: 기본 녹화 파이프라인 (codec/compositor/recorder/audioMixer) — 여기선 단순 합성만
Phase 4: 디자인 시스템 (Tailwind 토큰, Pretendard, 글래스 shadcn, Framer 프리셋, GSAP 도입, zod 스키마)

★ Phase 5 — 레이어드 컴포지션 엔진 (가장 중요, COMPOSITION.md §11 세분화)
  5a: 메인 캔버스 + 카메라 프레이밍 6종 (fullscreen/circle/rounded_rect/hexagon/heart/split)
  5b: 레이어 엔진 코어 (BaseLayer, zIndex, blendMode, opacity, enabled, 라이프사이클)
  5c: 기본 레이어 10종 (gradient_mesh, animated_grid, star_field, noise_pattern,
      floating_shapes, particle_ambient, kinetic_text, mission_prompt 등)
  5d: 비트 싱크 엔진 (essentia.js 오프라인 분석 → JSON, BeatClock 런타임,
      onBeat/onOnset/onDownbeat 이벤트, 리액티브 바인딩 시스템)
  5e: AR 트래킹 (FaceAnchor/BodyAnchor 추출, One Euro Filter 스무딩,
      face_sticker, face_mask, hand_emoji 레이어)
  5f: 포스트프로세스 (PixiJS v8 도입 → 사용자 승인 먼저 요청,
      bloom/chromatic/LUT/grain/vignette/CRT scanlines 필터)
  5g: HUD 레이어 (score_hud, counter_hud, timer_ring, mission_prompt)
  5h: 텍스트 레이어 (karaoke_caption 음절별, news_ticker 스크롤, beat_text 펄스)
  5i: 3개 템플릿 완전 구현 (TEMPLATES.md 그대로)
      - neon-arena (사이버펑크 스쿼트, 22개 레이어, 헥사곤 카메라)
      - news-anchor (시네마틱 뉴스룸, 18개 레이어, 라운드 사각 카메라)
      - emoji-explosion (팝 코믹 표정+제스처, 25개 레이어, 하트 카메라)

Phase 6: 통합 품질 (캘리브레이션, 카운트다운, 햅틱, 재시도, EDGE_CASES 전부)
Phase 7: 결과·배포·성능 (결과 페이지, Error Boundary, Lighthouse 90+, 실기기 체크리스트)

각 Phase 절대 규칙:
- COMPOSITION.md와 TEMPLATES.md의 레이어 구성은 그대로 구현. 임의로 레이어 수 줄이지 말 것
- 15개 미만 레이어는 실패로 간주
- 카메라 풀스크린 고정 금지 (TEMPLATES.md의 프레이밍 지정 그대로 사용)
- 비트 싱크 없는 레이어 연출 금지 (BGM 있을 때)
- 얼굴·손 미션 템플릿에 AR 트래킹 레이어 누락 금지
- 포스트프로세스 생략 금지 (저사양 tier 제외)
- 모든 레이어는 단일 메인 캔버스에 합성 (녹화본에 박히도록)
- DOM 오버레이는 UI 전용 (시작 버튼, 설정 등)

작업 루프:
1. 현재 Phase 첫 미완료 항목 → 관련 docs 재확인
2. 구현 → lint/typecheck/build → Vitest
3. commit → push → 60s 대기
4. Playwright 자동 검증 (TESTING.md §3)
   - 레이어별 /debug/layers/<type> 페이지에서 단독 확인
   - 템플릿별 /debug/template/<id> 에서 전체 렌더
5. 자동 검증 불가는 CHECKLIST_PHASE_N.md 에 항목 추가
6. 실패 시 같은 항목 재작업 (삭제/주석/가짜 금지)
7. PROGRESS.md 업데이트 ([자동검증완료] / [실기기확인필요])

Playwright Chromium 플래그 (모두 필수):
  --use-fake-device-for-media-stream
  --use-fake-ui-for-media-stream
  --use-file-for-fake-video-capture=./test-assets/squat.y4m
  --use-file-for-fake-audio-capture=./test-assets/speech.wav
  --autoplay-policy=no-user-gesture-required

test-assets 없으면 Phase 0 첫 작업으로 scripts/generate-test-assets.sh 작성.

에셋 전략 (Phase 5 핵심):
- 고품질 Lottie/BGM/이미지는 너가 만들 수 없음
- 플레이스홀더: 순수 SVG/Canvas 드로잉 + 무음 BGM 30초로 우선 구현
- ASSET_CHECKLIST.md 생성 → 사용자가 아침에 실제 에셋으로 교체하도록 안내
  예: "LottieFiles에서 'confetti'로 검색해 JSON 다운로드, /public/lottie/confetti.json에 저장"

PixiJS 도입 (Phase 5f):
- 작업 시작 전 반드시 사용자에게 한 번 확인 ("PixiJS v8 도입해도 되는지, 번들 ~300KB 추가")
- 승인 받으면 `npm i pixi.js@^8` 후 진행

BGM 비트 분석:
- 첫 작업으로 scripts/analyze-bgm.node.ts 작성 (essentia.js 또는 web-audio-beat-detector)
- 플레이스홀더 BGM(무음 또는 간단한 합성음)에도 JSON 생성해 onBeat 테스트 가능하게

막히면 PROGRESS.md 상단 "BLOCKER:" 기록 후 다른 독립 항목으로 우회. 멈추지 않음.
"멈춰" / "stop" 전까지 Phase 7까지 진행.

시작 전 보고 (한 번만):
  A. 8개 문서 각 한 줄 요약
  B. 현재 구조와 목표 구조의 gap
  C. Phase 0~1 구체 구현 계획
  D. test-assets 생성 명령 초안
  E. BGM 비트 분석 접근법
  F. PixiJS 도입 예정 시점 (Phase 5f)

보고 후 즉시 Phase 0.1부터 작업.
```

---

## 4. 아침 점검

```bash
tmux attach -t motiq
cat PROGRESS.md
ls CHECKLIST_PHASE_*.md ASSET_CHECKLIST.md 2>/dev/null
open https://mvp-ivory-kappa.vercel.app

# Phase 5 진입했다면 /debug/layers 와 /debug/template 스크린샷 확인
ls test-results/

# 망쳤으면 롤백
git log --oneline -50
git reset --hard <커밋> && git push --force-with-lease
```

### 아침에 네가 할 것
1. PROGRESS.md 확인, 어느 Phase까지 갔는지
2. 자동 검증 통과 항목 수 / 실기기 확인 필요 항목 수
3. CHECKLIST_PHASE_N.md 체크리스트 들고 실기기 테스트
4. ASSET_CHECKLIST.md 보고 LottieFiles·Pixabay 등에서 실제 에셋 다운로드 후 커밋
5. 다음 밤 프롬프트에 "실기기 확인 결과 + 에셋 교체 완료" 첨부

---

## 5. Phase 5 진입 시 특히 주의

Phase 5는 단일 Phase 중 가장 오래 걸릴 것 (5a~5i 9개 소단계).
한 번의 밤으로 Phase 5 전체 완성은 어려울 수 있음.

**현실적 기대치**:
- 밤 1: Phase 0~3 완료, Phase 4 대부분
- 밤 2: Phase 5a~5d (레이어 엔진 + 비트 싱크)
- 밤 3: Phase 5e~5f (AR + 포스트프로세스)
- 밤 4: Phase 5g~5i (HUD + 3개 템플릿)
- 밤 5: Phase 6~7

각 밤 끝나면 체크리스트 + 에셋 리스트로 네가 확인하고 다음 밤 조정.

## 6. 리스크

- PixiJS 도입은 번들 추가(~300KB). 사용자 승인 필수
- BGM 에셋은 저작권 프리 필수 (Pixabay, YouTube Audio Library)
- Lottie 에셋은 상업용 라이선스 확인 필수
- 실기기(iPhone·Android)에서의 30fps 유지가 최대 기술 리스크. Phase 5 완료 후 성능 측정해 BLOCKER 발견 시 저사양 tier 저하 전략 재조정 필요
