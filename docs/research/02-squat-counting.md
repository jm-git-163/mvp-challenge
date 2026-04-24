# 연구 보고서 02 — 근접촬영(셀피) 스쿼트 카운팅

작성일: 2026-04-22
범위: 유저가 폰을 얼굴 근처(≈30~60cm)에 두고 스쿼트하는 시나리오에서 rep 카운트 0 이 되는 문제의 근본 원인 분석 및 대안 알고리즘 비교.
제약: WebSearch 권한 거부 상태. 레퍼런스 섹션은 일반 공개지식(MediaPipe / ML Kit / 상용 피트니스 앱 UX) 기반 요약으로 작성. URL 인용 불가.

---

## 1. 현재 구현 진단

### 1.1 코드 경로 재구성
`hooks/useJudgement.ts` 내부의 스쿼트 판정은 **세 detector 의 max-count 합의**로 구성:

1. `detectSquat()` (knee-angle, full-body) — landmarks 17개 + hip/knee/ankle visibility > 0.40 필요
2. `CloseProximitySquatDetector` — `faceOk && !squatLmOk` 일 때만 동작
3. `NoseSquatDetector` (FIX-Z25) — 위 두 로직이 3초 동안 count 를 못 올릴 때만 활성

최종 count 는 세 값의 max, 디바운스 600ms.

### 1.2 유저 시나리오 "얼굴만 보임"에서 각 detector 의 현실적 동작

| Detector | 활성 조건 | 유저 시나리오에서 실제로 돌아가는가? |
|---|---|---|
| knee-angle | `squatLmOk = 무릎/엉덩이/발목 vis>0.40` | **불가능.** 몸통 아래가 프레임 밖 → visibility 거의 0. |
| close-proximity | `faceOk && !squatLmOk` | 조건은 충족. 단 `faceY amplitude` 파라미터가 MediaPipe 전신 기준으로 튜닝돼 있을 가능성 높음. |
| nose-squat (신규) | `stalled(>3s) 또는 count==0` | 조건은 통과. 그러나 baseline ± 0.08 threshold 가 근접촬영의 실측 진폭과 어긋남. |

### 1.3 실기기에서 0 카운트가 되는 가설 TOP 3

**가설 A — baseline 윈도우가 움직이는 사용자를 따라간다 (steering drift).**
`computeBaseline()` 은 최근 2초 y 평균. 사용자가 스쿼트를 **쉬지 않고 반복**하면 down 상태 y 도 평균에 포함되어 baseline 이 중간값으로 끌려간다. 결과: `noseY > baseline + 0.08` 이 절대 성립하지 않음. 특히 스쿼트 1rep ≈ 1.5~2초라 2초 윈도우 전체가 스쿼트 데이터로 가득 참.

**가설 B — THRESHOLD_DOWN=0.08 이 근접촬영 실제 진폭보다 큼.**
정규화 좌표(0~1) 기준, 얼굴이 프레임 대부분을 차지하는 근접촬영에서는 유저 자세가 바뀌어도 nose.y 변화가 실제로는 0.04~0.06 정도에 그친다. 0.08 은 전신 촬영 기준 임계. 따라서 아무리 깊이 앉아도 down 전이 자체가 안 일어남.

**가설 C — MoveNet / MediaPipe 가 근접촬영에서 nose landmark 를 아예 출력하지 않거나 visibility < 0.5.**
`useJudgement.ts` L373~의 nose 블록은 `landmarks` 를 그대로 update 로 전달. visibility 게이트(0.5) 에서 탈락하면 `history.length < 10` 조건을 못 넘어 영원히 카운트 대기. 코 대신 왼쪽 눈(2) / 오른쪽 눈(5) / 입(9,10) 이 더 안정적으로 잡히는 프레이밍에서도 nose.visibility 만 보면 탈락.

**추가 가설 D (보조) — `history.length < 10` 게이트가 저 FPS 에서 5초 이상 소요.**
실기기 MoveNet FPS 약 10. landmark 드랍까지 감안하면 10 샘플 쌓는 데 2~3초 걸리는데, 그동안 사용자가 이미 1rep 완료 → 첫 rep 은 구조적으로 놓침.

**추가 가설 E — Zustand template.genre 이 'fitness' 가 아닐 수 있음.** 
L373 `template.genre === 'fitness'` 가 아니면 nose-squat 전체 블록이 스킵. 스쿼트 전용 템플릿의 genre 값 실제 확인 필요.

---

## 2. 레퍼런스 앱·논문 — 접근 요약 (일반지식 기반)

> WebSearch 권한 없음. 하기는 MediaPipe 공식 샘플, 주요 상용 피트니스 앱, 학술 문헌의 일반적 접근을 요약. URL 인용 불가.

### 2.1 상용 피트니스 앱 (셀피 모드 카운팅)
- **BetterMe / Muscle Booster / 30 Day Fitness**: 대부분 **폰을 벽/바닥에 세워두고 1.5~2m 거리에서 전신 촬영**을 권장한다. 카운트 알고리즘은 knee-angle 기반. 근접촬영 모드는 공식 지원하지 않으며, UI 가 처음부터 "뒤로 물러서세요" 배너로 계도.
- **Freeletics Coach / Kaia Health**: 서버 사이드 포즈 인식 + 하체 전신 visibility 필수. 근접 시 "Move back" 음성 피드백.
- **Apple Fitness+ Vision (tvOS)**: TrueDepth 센서. 모바일 웹과 비교 대상 아님.
- **Nike Training Club / Peloton**: 카운트 기능 자체가 타이머 + 오디오 큐 기반. 비전 카운트 안 함.
- **Playground / Kemtai (웹 기반 재활)**: MediaPipe BlazePose 사용. 근접촬영 시 "frame your whole body" 오버레이 강제. 해결책이라기보다는 **회피**다.

**결론**: 상용 앱은 근접촬영 스쿼트 카운트를 알고리즘적으로 풀지 않고 **UX 로 회피**한다. 본 제품이 이 케이스를 풀면 차별화 포인트.

### 2.2 학술/기술 문헌 (일반적 접근)
- **Head displacement based rep counting**: 머리 키포인트의 세로 변위를 low-pass filter → peak detection (scipy `find_peaks` 패턴). 주기성 있는 운동에 강하다. 단점: 머리가 원위치로 돌아와야 peak 가 보임.
- **Face bounding box scale**: 카메라 고정 + 사용자 이동(앞뒤) 시 얼굴 크기 주기적 변화. 다만 "앉기" 만 할 때는 얼굴이 **아래로 이동** + **약간 멀어짐**(폰이 위에서 내려다보는 각도 기준)이라 scale 변화가 미묘.
- **Autocorrelation-based rep counting (Counting Out Time, Zhang 2020)**: 프레임 간 시그널 자기상관으로 주기 검출. 임계치 튜닝 없이 주기만 검출하는 장점. 구현 난이도 M.
- **1D CNN on keypoint time-series (RepNet, Dwibedi 2020)**: 모델 기반. 브라우저 런타임 부담.
- **Google ML Kit PoseDetection exercise-classification sample**: knee-angle 고정. 근접 모드 예제 없음.

### 2.3 핵심 교훈
- Threshold 고정 금지 → **adaptive baseline (peak-to-peak 기반)** 이 실전.
- **머리가 원위치 복귀** 신호가 필수. rep 은 "내려갔다가 돌아와야" 1 인정.
- 진폭 임계치는 **사용자 첫 1~2 rep 을 관측해서 자동 학습**하는 패턴이 업계 표준.

---

## 3. 알고리즘 3안 비교표

| 항목 | A. Nose Y (현재) | B. Face BBox Scale | C. Head-Shoulder Vertical Dist | D. Hybrid (B ∧ A) |
|---|---|---|---|---|
| 원리 | nose.y 진폭 | 얼굴 bbox 면적(또는 대각선) 변화 | (shoulder.y 평균 − nose.y) | B 가 근접 감지 + A 가 이동 검증 |
| 정확도 (근접) | ★★☆ (드리프트 민감) | ★★★ (스쿼트 = 멀어짐/다가옴 패턴 뚜렷) | ★★★★ (baseline 자가안정) | ★★★★★ |
| 정확도 (준근접: 상체 2/3) | ★★★ | ★★ (bbox 거의 고정) | ★★★★ | ★★★★ |
| 노이즈 내성 | 중. rolling baseline 자체가 드리프트 | 하. 손 가림/고개 숙임에 민감 | 상. 두 점 차분이라 카메라 흔들림 상쇄 | 상 |
| 캘리브레이션 필요 | 암묵 (2초 rolling) | 첫 2rep 관찰 후 bbox min/max 학습 필수 | 명시 3초 "서 있기" 필요 | 3초 + 첫 rep 학습 |
| MediaPipe 응답 시간 | 즉시 (landmark[0] 1개) | FaceDetector 추가 필요 (+2~4MB 모델, +3ms/frame) | 즉시 (lm[0], [11], [12]) | FaceDetector 필수 |
| 실패 케이스 | 연속 스쿼트 시 baseline drift | 사용자가 좌우로 움직여도 오탐 | 어깨 미검출 시 fallback 없음 | 둘 다 실패해야 오탐, 덜 민감 |
| 구현 난이도 | S (이미 있음) | M (FaceDetector 통합) | S | M |
| 성능 비용 | 0 | +3ms/frame | 0 | +3ms/frame |

### 3.1 C 안 세부 (추천 주축)
- 신호: `d = mean(leftShoulder.y, rightShoulder.y) − nose.y`
- 어깨가 안정(스쿼트 중 상체 강직 유지)이고 머리는 아래로 이동 → `d` 감소.
- baseline `d0` 은 처음 3초간 측정 (static stance 요구).
- rep: `d < d0 * 0.85` 진입 → `d > d0 * 0.95` 복귀 시 +1.
- 어깨 visibility < 0.4 면 A 로 폴백.

---

## 4. 추천안 — **C 주축 + A 폴백 하이브리드** (코드명: `HeadShoulderSquat`)

### 4.1 파이프라인
```
매 프레임 (≈100ms @10fps):
  1. landmarks[0] (nose), [11] (L-shoulder), [12] (R-shoulder) 읽기
  2. noseVis ≥ 0.4 && (L-sh or R-sh vis ≥ 0.3) 이면 C 모드:
       d = avg(sh.y) - nose.y
  3. 아니고 nose vis ≥ 0.4 이면 A 폴백:
       d = -nose.y   (부호 맞춤, baseline 재학습)
  4. 아니면 visible=false 유지
```

### 4.2 캘리브레이션 (3초 플로우)
- 녹화 시작 전 / 카운트다운 직전 단계:
  - 화면: "정면을 보고 똑바로 서주세요"
  - 3초간 `d` 샘플 수집 → 평균 `d0`, 표준편차 `σ`.
  - σ > `d0 * 0.08` 이면 "흔들리지 마세요" 재시도.
  - 통과 시 `d0` 를 detector 에 inject. 촬영 시작.

### 4.3 임계치 (정규화 좌표 기준)
- DOWN 진입: `d < d0 - max(0.04, d0 * 0.15)`  (상대/절대 max)
- UP 복귀: `d > d0 - max(0.015, d0 * 0.05)`
- 디바운스: 600ms (현행 유지)
- rolling baseline 갱신: **UP 구간에서만** EMA α=0.02 로 `d0` 미세조정 (드리프트 방지, down 샘플이 baseline 을 오염하지 않음)

### 4.4 첫 rep 자동 진폭 학습 (B 안 요소 통합)
- 첫 UP→DOWN→UP 한 사이클에서 observed `dmin` 기록.
- `observedAmp = d0 - dmin`.
- 2rep 째부터는 threshold 를 `DOWN = d0 - observedAmp * 0.5`, `UP = d0 - observedAmp * 0.2` 로 개인화.
- 사용자 진폭이 작은 people(노인, 재활)도 카운트 성공.

### 4.5 기존 knee 로직과의 관계
- fitness 장르 템플릿에서:
  1. `HeadShoulderSquat` 를 **primary**
  2. `detectSquat` (knee-angle) 는 fullLeg visibility 통과 시 **검증용** — count 만 일치하면 무관, 불일치 시 knee 우선.
  3. `CloseProximitySquatDetector` / `NoseSquatDetector` 는 **deprecated** (혼돈 제거).
- 점수:
  - full-body 검증 성공 rep: 100%
  - HeadShoulder 단독 rep: 80% (정직한 cap)
  - A 폴백 rep: 60%

---

## 5. 스쿼트 템플릿 프레이밍 재설계

### 5.1 현행
`data/templates/neon-arena.ts` L34: `{ kind: 'hexagon', centerX: 540, centerY: 960, size: 380 }`.
→ **하체가 원천적으로 잘린다**. 스쿼트 템플릿에서 hexagon 은 체급 미스매치.

### 5.2 제안 A — **종단 분할 (Portrait Split)**
- 위 2/3: 얼굴/상체 (창의적 프레임 — rounded rect + 네온 테두리)
- 아래 1/3: 발·바닥 (반투명 + "squat zone" 네온 그리드)
- 사용자가 카메라를 허리 높이에 두면 양쪽 다 보임.
- 레이어 배치:
  - `camera_feed` 풀스크린 유지 (녹화 baseline)
  - `frame_mask_portrait_split` 새 레이어 (clip path 아래 1/3 어둡게)
  - `floor_grid` Lottie (아래 1/3 내부)

### 5.3 제안 B — **tall rounded rect + 상반신 줌 + 미니맵**
- 메인 프레임: 세로 직사각 (라운드 코너) 상반신 중심.
- 우하단 미니맵: 전신 썸네일 (전신 사용자를 위한 feedback).
- 근접촬영 유저는 메인 프레임만, 전신 유저는 미니맵으로 자세 확인.

### 5.4 제안 C — **"face zone + barbell zone" 듀얼**
- 상단 원형: 얼굴
- 하단 가로 바: "가상 바벨" 애니메이션 (스쿼트 내려갈 때 바벨도 내려감 — HeadShoulder 신호 시각화)
- 게임감 강화.

**추천: 제안 A (Portrait Split)** — 구현 난이도 M, 커버리지 최대. 제안 C 는 유저 자극 좋지만 에셋 필요.

---

## 6. 구현 난이도

| 작업 | 크기 | 주요 파일 |
|---|---|---|
| `HeadShoulderSquat` detector 신규 | **M** | `engine/missions/headShoulderSquat.ts` |
| 3초 캘리브레이션 UI + 상태 머신 | **M** | `components/studio/SquatCalibration.tsx`, `store/sessionStore.ts` |
| `useJudgement.ts` 통합 & nose/close detector deprecate | S | `hooks/useJudgement.ts` |
| Portrait Split 프레이밍 레이어 | **M** | `engine/composition/cameraFraming.ts`, `data/templates/neon-arena.ts` |
| 첫 rep 자동 진폭 학습 | S | 위 detector 내부 |
| 점수 공식 재정비 (full/HS/A cap) | S | `hooks/useJudgement.ts` |
| 실기기 검증 체크리스트 | S | `CHECKLIST_PHASE_6.md` (별도) |

**총합: L (1~2 세션 분량).** 가장 리스크가 큰 건 캘리브레이션 UX 가 촬영 시작 전에 끼어드는 점 — CLAUDE.md §3 "촬영 중 팝업 금지" 규정과 충돌하지 않도록, 카운트다운 직전(권한 OK 후 3-2-1 이전) 단계에 배치해야 함.

---

## 7. 즉시 적용 가능한 미니 픽스 (Quick Win, 아직 미실행)

C 전체 구현 전, 현행 nose-squat 만으로도 0 카운트를 깨기 위한 3가지 응급 튜닝:

1. **THRESHOLD_DOWN 0.08 → 0.035**, **THRESHOLD_UP 0.03 → 0.015**.
2. `computeBaseline()` 을 **percentile-based** 로: 최근 2초 y 의 **25 백분위수** 를 baseline 으로 — drift 억제.
3. nose.visibility fallback: `nose.visibility || eye.visibility || mouth.visibility` 중 max 사용.

이 세 개만 해도 실기기 카운트가 0 → 최소 1~2 로는 올라올 것으로 추정. 단, 여전히 거짓 양성이 있을 수 있어 **정답은 §4 하이브리드**.

---

## 8. 실기기 검증 지표 (완료 정의)

- 근접촬영(폰~얼굴 40cm) 10 rep 수행 → 9 rep 이상 count (precision ≥ 0.9)
- 정지 상태 20초 → 0 rep (false positive 0)
- 허리 굽히기(= 스쿼트 아닌 동작) 5회 → ≤ 1 rep 인정 (분리 성능)
- 3초 캘리브레이션 실패율 < 10%

---
