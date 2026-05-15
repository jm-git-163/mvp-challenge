# docs/VISUAL_DESIGN.md — 캡컷 수준 시각 품질 기준

> Phase 4 시작 전 및 UI 관련 작업 전 반드시 정독. 이 문서의 토큰을 변경하려면 사용자 승인 필요.

## 1. 왜 이 문서가 필요한가

"HTML 목업 수준"과 "캡컷/인스타 수준"의 차이는 **구체적 디자인 토큰**에 있다.
막연히 "예쁘게 만들어" 라고 하면 시스템 기본값이 나온다. 이 문서는 그 틈을 메운다.

---

## 2. 색 팔레트 (Dark Cinematic 기본)

### 2.1 배경·서피스
```css
--bg-base:      #050814;   /* 가장 깊은 배경 */
--bg-elevated:  #0A0E27;   /* 카드/모달 배경 */
--bg-glass:     rgba(10,14,39,0.6);   /* 글래스모피즘용 */
--bg-overlay:   rgba(0,0,0,0.75);     /* 모달 뒤 딤 */
```

### 2.2 액센트 (템플릿 무드마다 하나씩 주력)
```css
--neon-pink:    #FF2D95;   /* 사이버/에너제틱 */
--electric-blue:#00E0FF;   /* 테크/시네마틱 */
--acid-green:   #39FF7D;   /* 코믹/팝 */
--sunset-orange:#FF8A3D;   /* 따뜻한 무드 */
--royal-purple: #8B5CF6;   /* 럭셔리/ASMR */
```

### 2.3 텍스트
```css
--text-primary:   #FFFFFF;
--text-secondary: #A0AEC0;
--text-muted:     #4A5568;
--text-on-accent: #050814;   /* 밝은 액센트 위 텍스트 */
```

### 2.4 상태
```css
--success: #00FFB2;
--warning: #FFB800;
--danger:  #FF3B5C;
```

---

## 3. 타이포그래피

### 3.1 폰트
- 한국어: **Pretendard Variable** (https://cdn.jsdelivr.net/gh/orioncactus/pretendard)
- 영어·숫자: Pretendard가 커버하지만 카운트 숫자는 `JetBrains Mono` + `font-variant-numeric: tabular-nums` (자릿수 흔들림 방지)

### 3.2 스케일
```
display:  72px / 800 weight / -2% tracking  (타이틀 카드, 결과 화면)
h1:       48px / 800 / -1%
h2:       32px / 700 / -0.5%
h3:       24px / 700 / 0%
body-lg:  18px / 500 / 0%
body:     16px / 400 / 0%
caption:  14px / 500 / 0%
micro:    12px / 600 / +1%                  (HUD 라벨)
score:    56px / 900 / 0% / tabular-nums    (점수 숫자 전용)
```

### 3.3 라인 높이
헤드라인 1.1, 본문 1.5, 점수 숫자 1.0

---

## 4. 모션 토큰

### 4.1 이징
```
--ease-standard:  cubic-bezier(0.4, 0.0, 0.2, 1);     /* 일반 전환 */
--ease-overshoot: cubic-bezier(0.34, 1.56, 0.64, 1);  /* 등장 시 튕김 */
--ease-bounce:    cubic-bezier(0.68, -0.55, 0.27, 1.55); /* 성공 이펙트 */
--ease-anticipate:cubic-bezier(0.36, 0, 0.66, -0.56); /* 퇴장 시 반동 */
```

### 4.2 지속
```
--duration-instant: 100ms
--duration-fast:    180ms    /* 버튼 누름, HUD 업데이트 */
--duration-medium:  320ms    /* 모달, 카드 등장 */
--duration-slow:    540ms    /* 씬 전환 */
--duration-cinematic: 1200ms /* 타이틀 카드, 결과 카드 */
```

### 4.3 주요 패턴
- **등장**: translateY(20px) + opacity(0) → 0 + 1, overshoot, medium
- **퇴장**: scale(1) + opacity(1) → 0.95 + 0, anticipate, fast
- **성공 팝업**: scale(0.5) + opacity(0) → 1.15 → 1, bounce, medium
- **점수 증가**: 새 값을 overshoot로 카운트업 (Framer `MotionValue` + `animate`)
- **씬 전환**: 와이프 + RGB 스플릿 0→1→0 (120ms+160ms+120ms)

---

## 5. 글래스모피즘·레이어링

### 5.1 글래스 카드
```css
background: var(--bg-glass);
backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.08);
box-shadow:
  0 8px 32px rgba(0, 0, 0, 0.4),
  inset 0 1px 0 rgba(255, 255, 255, 0.08);
border-radius: 20px;
```

### 5.2 네온 글로우 (미션 성공 시)
```css
box-shadow:
  0 0 0 1px var(--accent),
  0 0 20px var(--accent),
  0 0 60px rgba(<accent-rgb>, 0.4);
```

### 5.3 그라디언트 메쉬 (배경)
두 개 이상 radial-gradient 중첩, 블러 처리
```css
background:
  radial-gradient(ellipse at 20% 30%, var(--accent)/20, transparent 50%),
  radial-gradient(ellipse at 80% 70%, var(--accent-2)/15, transparent 50%),
  var(--bg-base);
```

---

## 6. 캔버스 이펙트 라이브러리

모두 `/engine/effects/` 하위 구현. requestAnimationFrame 기반.

### 6.1 파티클 시스템 (`particles.ts`)
- 풀(pool) 기반: 최대 200개 재사용
- 속성: x, y, vx, vy, size, color, alpha, lifeMs
- 중력/감쇠/페이드아웃 지원
- 프리셋: `confettiBurst`, `starShower`, `sparkle`, `dust`

### 6.2 렌즈 플레어 (`lensFlare.ts`)
- 성공 순간 화면 중앙에 빛 번짐
- 6-sided 플레어 + 할로 + 방사형 빔
- 200ms 페이드인 → 400ms 페이드아웃

### 6.3 카메라 셰이크 (`cameraShake.ts`)
- 캔버스 전체에 translate 흔들기
- 강도(subtle/medium/strong) × 지속 선택
- 랜덤이 아닌 perlin noise 기반 (자연스러움)

### 6.4 크로매틱 어베레이션 (`chromaticAberration.ts`)
- RGB 채널 분리 후 수 픽셀 어긋나게 합성
- 성공 순간 0 → 8px → 0 애니메이션
- 저사양 기기 감지 시 자동 비활성

### 6.5 카라오케 자막 (`caption.ts`)
- 음성 인식 결과를 음절별로 렌더
- 현재 말한 음절은 `--accent`로, 발화 전은 어둡게
- 각 음절 등장 시 scale 1.0 → 1.15 → 1.0 (bounce, 200ms)
- 하단 16% 위치, safe area 고려

### 6.6 씬 전환 (`transitions.ts`)
- `wipeLeft`, `wipeRadial`, `zoomBlur`, `rgbSplit`, `pixelDissolve`
- 각 전환 540ms

### 6.7 타이틀 카드 (`titleCard.ts`)
- 인트로 2초: 타이틀 텍스트 + 서브타이틀 + 템플릿 무드 그래픽
- 키네틱 타이포그래피 (글자 단위 지연 등장)
- 아웃로 2초: 결과 티저 (점수 프리뷰)

---

## 7. 버튼·컨트롤

### 7.1 Primary CTA
```
높이: 56px
패딩: 0 28px
배경: linear-gradient(135deg, var(--accent), var(--accent)/80)
글자: 16px / 700 weight
라운드: 16px
그림자: 0 8px 24px var(--accent)/40
호버: scale(1.02) + 그림자 강화
누름: scale(0.97), 100ms
```

### 7.2 Secondary
글래스 카드 + 보더만

### 7.3 Icon 버튼 (촬영 중지 등)
64x64px 원형, 글래스 + 네온 글로우

---

## 8. 템플릿 무드 (→ 별도 문서)

3개 레퍼런스 템플릿의 상세 구성(레이어 25개 내외, AR, 비트 싱크, 포스트프로세스 포함)은
**`docs/TEMPLATES.md`** 에 별도로 관리한다. 이 문서는 디자인 토큰만.

---

## 9. 반응형 원칙

- **세로 9:16 우선**: 릴스 출력이 기본. 데스크톱은 세로 중앙 정렬 + 사이드 장식
- 안전 영역: 상단 12%, 하단 16% (HUD·자막 배치 구역)
- 브레이크포인트: 기본 모바일, md(768) 이상은 컨테이너 고정폭 420px
- 노치·홈바 대응: `env(safe-area-inset-*)`

---

## 10. 접근성·감소 모션

- `prefers-reduced-motion: reduce` → 카메라 셰이크·크로매틱·과장 애니 비활성
- 캡션은 필수 (녹화본에도)
- 색 대비 WCAG AA 이상 (텍스트 기준)
- 깜빡임 3Hz 이하 (뇌전증 가이드)

---

## 11. 구현 체크 (Phase 4 완료 조건)

- [ ] Tailwind config에 위 색·이징·반경 전부 반영
- [ ] Pretendard 웹폰트 로드, tabular-nums 유틸 클래스
- [ ] 글래스 Card/Button shadcn 오버라이드
- [ ] Framer Motion 프리셋 (`motionPresets.ts`)
- [ ] Lottie 3종 prefetch + canvas 렌더
- [ ] 파티클 시스템 `/debug/effects` 페이지에서 확인 가능
- [ ] 카라오케 자막 `/debug/caption` 에서 텍스트 입력 시 동작
- [ ] 씬 전환 5종 `/debug/transitions` 에서 토글
