# docs/TESTING.md — 테스트 전략

> 모든 Phase의 검증 단계에서 참조.

## 1. 검증 3계층

**Layer 1: 단위 테스트 (Vitest)** — Claude Code가 자체 작성·실행
**Layer 2: E2E 자동 (Playwright + fake media)** — Claude Code가 자체 실행
**Layer 3: 실기기 수동 체크리스트** — 사용자 아침 확인

Claude Code는 Layer 1, 2까지만 "합격" 판정 가능. Layer 3는 `[실기기확인필요]` 태그로 PROGRESS.md에 남기고 사용자에게 위임.

---

## 2. Layer 1 — Vitest 단위 테스트 (필수)

### 2.1 점수 공식
각 scorer마다:
- 경계값: 0, target, target*0.5, target*2
- 극단값: 모두 성공 / 모두 실패
- 시간 초과 케이스
- NaN·undefined 입력 방어

### 2.2 상태머신
- 스쿼트 카운터: 가짜 hip y 시퀀스 입력 → 예상 카운트
- 포즈 홀드: landmark 시퀀스 → 유지 시간 계산

### 2.3 유틸
- 레벤슈타인: 한국어 음절 단위 검증
- 코사인 유사도
- 덕킹 램프 값 계산

### 2.4 템플릿 zod 스키마
- 정상 케이스
- 누락 필드 → 검증 실패
- scoreWeight 합 != 1.0 → 검증 실패

목표 커버리지: `/engine/scoring/`, `/engine/missions/`, `/data/templates/` 90% 이상

---

## 3. Layer 2 — Playwright E2E

### 3.1 Chromium 플래그 고정
```ts
const browser = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--use-file-for-fake-video-capture=./test-assets/squat.y4m',
    '--use-file-for-fake-audio-capture=./test-assets/speech.wav',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({
  permissions: ['camera', 'microphone'],
  viewport: { width: 390, height: 844 },  // iPhone 14 Pro 사이즈
});
```

### 3.2 test-assets 생성
첫 Phase 0 작업 시 `scripts/generate-test-assets.sh`:
```bash
# 더미 스쿼트 영상 (상하 움직임 있는 합성 영상)
ffmpeg -f lavfi -i "color=black:size=720x1280:rate=30,drawbox=x=300:y='abs(sin(2*PI*t/2))*400':w=120:h=200:color=white@1:t=fill" \
  -t 30 -pix_fmt yuv420p test-assets/squat.y4m

# 한국어 TTS (시스템 say 또는 외부 서비스)
# 없으면 일단 무음 wav
ffmpeg -f lavfi -i "sine=f=440:d=30" -ar 48000 test-assets/speech.wav
```
한국어 TTS는 정확도 검증에 한계 → Layer 3 체크리스트 항목.

### 3.3 자동 검증 가능 시나리오

| 시나리오 | 검증 방법 |
|---|---|
| getUserMedia 1회 호출 | window 객체에 카운터 주입, 세션 끝날 때 확인 |
| /templates 직접 접근 → /permissions 리다이렉트 | URL 확인 |
| 권한 허용 후 /templates 진입 가능 | URL 확인 |
| 촬영 중 모달/토스트 DOM 없음 | `document.querySelectorAll('[role=dialog], .toast').length === 0` |
| 점수 HUD 캔버스 존재 | 캔버스 픽셀 분석 또는 오버레이 테스트 모드 |
| 녹화 mp4 생성 | download 이벤트 캡처 후 파일 크기 > 0 |
| 녹화 mp4에 오버레이 박힘 | 저장된 mp4를 ffmpeg로 프레임 추출 → 특정 좌표 픽셀이 투명/불투명 |
| Error Boundary 동작 | throw 강제 후 fallback UI 표시 확인 |
| Lighthouse 점수 | `lighthouse` CLI 또는 Playwright Lighthouse plugin |

### 3.4 자동 검증 **불가능** 항목
Claude Code가 착각하기 쉬운 부분. 반드시 Layer 3로 미룰 것:

- 스쿼트 "정확한" 인식 (가짜 영상으론 진짜 사람 포즈 재현 불가)
- 한국어 음성 인식 품질
- 녹화본의 "예쁨"·캡컷 수준 여부
- 템플릿 3개가 정말 다른 무드인가
- 저사양 기기에서의 프레임률
- iOS Safari 특수 동작

---

## 4. Layer 3 — 실기기 체크리스트 (사용자 수행)

Phase 완료 시 Claude Code는 다음 포맷으로 `CHECKLIST_PHASE_N.md` 생성:

```
# Phase N 실기기 체크리스트

## iPhone (iOS Safari)
- [ ] /permissions 에서 허용 후 스튜디오 진입까지 막힘 없음
- [ ] 촬영 중 어떤 팝업·프롬프트도 뜨지 않음
- [ ] 스쿼트 10회 실제로 수행 → HUD 카운트 10
- [ ] 점수가 공식대로 체감됨 (빨리 하면 템포 점수 낮음 등)
- [ ] 녹화본 다운로드 → 사진 앱에서 재생 가능 (mp4)
- [ ] 녹화본에 점수 HUD, 자막, 이펙트 모두 박혀 있음

## Android (Chrome)
- 동일 항목들

## 캡컷 수준 비교
- [ ] 인스타 릴스에 올려도 초라하지 않음
- [ ] 3개 템플릿이 서로 완전히 다른 분위기로 느껴짐
- [ ] 폰트·색·애니메이션이 시스템 기본값 같지 않음

## BLOCKER
사용자가 발견한 문제를 자유 서술
```

사용자는 아침에 이 체크리스트를 보고 각 항목 체크 → BLOCKER가 있으면 Claude Code에 전달.

---

## 5. 회귀 테스트

Phase 진행해도 이전 Phase 기능이 깨지지 않아야 함. 매 Phase 마지막에:
```bash
npm run test          # 전체 Vitest
npx playwright test   # 전체 E2E
```
실패 항목 있으면 BLOCKER 등록.

---

## 6. 수치 기록

PROGRESS.md에 Phase별로 기록:
```
## Phase 3 완료
- Vitest: 47/47 pass
- Playwright: 12/12 pass [자동검증완료]
- Lighthouse Performance: 92
- 실기기 체크리스트: CHECKLIST_PHASE_3.md [사용자확인대기]
- BLOCKER:
  - (없음)
```

---

## 7. 금지

- 실기기 확인이 필요한 항목을 `[자동검증완료]` 로 표기 금지
- 실패한 테스트를 `.skip` 으로 우회 금지 (원인 해결)
- Vitest·Playwright 결과 파일을 조작해 통과처럼 보이게 하는 행위 금지
- 작성한 테스트가 사실상 아무것도 검증하지 않는 경우(예: `expect(true).toBe(true)`) 금지
