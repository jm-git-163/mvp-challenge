# docs/TEMPLATES.md — 3개 레퍼런스 템플릿 상세

> Phase 5i 작업 시 이 문서 그대로 구현. 레이어 수·반응성·포스트프로세스까지 모두 명시됨.
> 이 3개가 **서로 완전히 다른 무드**라는 것을 반드시 지켜야 한다.
> 두 템플릿이 같은 레이어 구성에 색만 바뀌면 **템플릿 시스템 실패**.

---

## 공통 사항

- 캔버스: 1080x1920 (9:16)
- 촬영 시간: 15~20초 (템플릿별)
- BGM은 사전 비트 분석 완료된 JSON 포함
- 모든 레이어는 `docs/COMPOSITION.md` §3 타입 중에서 조합

---

## 템플릿 1: `neon-arena` (사이버펑크 스쿼트 챌린지)

### 무드
네온 사이버펑크. 깊은 우주공간 배경에 지평선 그리드 플로어. 격렬한 에너지.
사용자를 **네온 아레나의 전사**로 만드는 컨셉.

- Primary: `--neon-pink #FF2D95`
- Secondary: `--electric-blue #00E0FF`
- Tertiary: `--acid-green #39FF7D`
- BGM: 신스웨이브, 128 BPM, 15초 루프
- 이펙트 강도: **최강**

### 카메라 프레이밍
```
{ kind: 'hexagon', centerX: 540, centerY: 960, size: 380 }
```
카메라는 육각형으로 클리핑. 화면 중앙에 위치.

### 레이어 구성 (22개)

**배경 레이어** (zIndex 1~10)
1. `gradient_mesh` — 딥 퍼플→블랙→딥 블루 메쉬, 천천히 회전 (60s 주기)
2. `animated_grid` — 네온 핑크 그리드 플로어, 원근감, 스크롤 이동 (비트 1마디당 한 칸)
3. `star_field` — 뒷배경 별들, 천천히 흐름
4. `floating_shapes` — 와이어프레임 정육면체 3개 + 피라미드 2개 + 구 1개, 각자 다른 축 회전
5. `noise_pattern` — 미세한 필름 노이즈, 지속 적용, opacity 0.08

**카메라 주변** (zIndex 20~25)
6. `camera_feed` — 육각형 클리핑
7. `camera_frame` — 육각형 외곽 네온 핑크 링 2px + 바깥 글로우 12px. **리액티브: onBeat every=1 → 글로우 intensity 1.0→1.5 pulse 120ms**
8. `camera_reflection` — 육각형 상단부에 빛 반사 글로스 (정적)

**AR 레이어** (zIndex 30~35)
9. `face_sticker` (선글라스) — 양쪽 눈 랜드마크 기준, 눈 위에 사이버 바이저 SVG 부착, roll 추적
10. `hand_emoji` (좌/우) — 양손 랜드마크에 전기 스파크 이펙트 (파티클) 지속

**미드 전경** (zIndex 40~50)
11. `particle_ambient` — 파란 전기 스파크, 화면 전체, 60개, 위로 상승하며 페이드
12. `orbiting_ring` — 카메라 육각형 주위에 얇은 네온 블루 링이 회전 (주기 8s)
13. `beat_flash` — 전체 화면 덮는 네온 핑크 섬광. **리액티브: onOnset → opacity 0→0.25→0, 150ms**

**HUD** (zIndex 60~70)
14. `counter_hud` — 중앙 상단, "**7 / 10**" 3D 크롬 텍스트, 숫자 바뀔 때 overshoot 스케일 애니메이션. 72px JetBrains Mono
15. `timer_ring` — 좌측 상단 원형 링, 남은 시간 각도로 표현
16. `score_hud` — 우측 상단 "SCORE 82" 글래스 칩
17. `mission_prompt` — 하단 "스쿼트 10회" 네온 텍스트, 처음 2초 등장 후 사라짐

**반응형** (zIndex 55)
18. `audio_visualizer` — 좌우 양쪽 세로 막대, 음량 반응, 네온 블루

**성공 이펙트용 (평소엔 비활성)** (zIndex 80~85)
19. `particle_burst` — 스쿼트 1회 성공 시 카메라 주변에서 50개 파티클 폭발 (0.4초)
20. `lens_flare` — 미션 완료 시 중앙에서 방사형 빛 (0.6초)
21. `chromatic_pulse` — 미션 완료 시 전체 화면 RGB 스플릿 8px → 0 (0.3초)
22. `kinetic_text` — 10회 달성 시 중앙에 "PERFECT!" 글자 하나씩 바운스 등장 (1.2초)

### 포스트프로세스
- Bloom (강도 1.2)
- Chromatic Aberration (기본 2px, onOnset 시 8px 펄스)
- CRT Scanlines (opacity 0.15)
- Vignette (강도 0.3)

### 미션 타임라인
- 0.0~2.0s: 카운트다운 (프롬프트 표시)
- 2.0~20.0s: `squat_count { target: 10 }` — 스쿼트 10회
- 씬 1개 구조, 전체 구간에서 동일 미션 유지

### 성공/실패 전역 이펙트
- `successEffects`: lens_flare + particle_burst (대량) + kinetic_text "CHAMPION"
- `failEffects`: chromatic_pulse + 모노크롬 LUT 0.5초

---

## 템플릿 2: `news-anchor` (시네마틱 뉴스룸 낭독)

### 무드
BBC/JTBC 뉴스룸 스타일. 시네마틱. 권위 있고 진지한 느낌.
사용자를 **뉴스 앵커**로 만드는 컨셉.

- Primary: `--electric-blue #00E0FF`
- Secondary: `#D4AF37` (골드)
- Background: 딥 네이비 #0B1828
- BGM: 오케스트럴 뉴스 인트로 루프, 90 BPM
- 이펙트 강도: **절제** (과한 파티클 없음)

### 카메라 프레이밍
```
{ kind: 'rounded_rect', x: 120, y: 260, w: 840, h: 1120, radius: 16 }
```
카메라는 상단 큰 직사각형. 하단에는 뉴스 하단 자막 영역.

### 레이어 구성 (18개)

**배경** (zIndex 1~10)
1. `image_bg` — 뉴스룸 스튜디오 일러스트 (흐림 블러 12px), 천천히 좌→우 패닝
2. `gradient_mesh` — 네이비 딥 블루 그라디언트, 상하 그라디언트
3. `noise_pattern` — 필름 그레인 0.12

**카메라 주변** (zIndex 20~25)
4. `camera_feed` — 라운드 직사각형
5. `camera_frame` — 1px 골드 보더 + 외곽 소프트 섀도우
6. `banner_badge` "LIVE" — 좌상단 카메라 위, 빨간 원 + 흰 텍스트. **리액티브: onBeat every=4 → 원 opacity 1→0.6→1 pulse**

**뉴스 그래픽** (zIndex 30~40)
7. `banner_badge` "BREAKING NEWS" — 카메라 아래, 골드 바에 네이비 글씨. 양 옆 경사 컷
8. `news_ticker` — 최하단 스크롤 바, 골드 배경. 텍스트: "실시간 뉴스 · 오늘의 주요 소식 · 미션 진행 중 · 챌린지 스튜디오"
9. `kinetic_text` (타이틀) — "앵커 챌린지" 상단, 처음 1.5초 등장 후 작게 축소되어 좌상단 고정
10. `image_bg` (네트워크 로고) — 우상단 작게, 정적

**자막** (zIndex 50)
11. `karaoke_caption` — 카메라 하단 중앙, 음성 인식 결과를 음절별로 표시. 발화된 단어는 골드, 아직 안 말한 단어는 회색. 스크립트의 단어와 일치하면 골드+밑줄 강조.
12. `mission_prompt` — 스크립트 원문 최상단에 작게 ghost 표시 (읽어야 할 문장)

**HUD** (zIndex 55~65)
13. `score_hud` — 우측 "정확도 87%" 네이비 글래스 칩 + 골드 보더
14. `timer_ring` — 좌측 "10s" 원형 카운트다운

**반응형** (zIndex 70)
15. `audio_visualizer` — 카메라 하단 얇은 골드 웨이브폼 (음성 있을 때만)

**성공 이펙트** (zIndex 80)
16. `particle_burst` — 골드 입자 소량 (문장 완료 시)
17. `chromatic_pulse` — 매우 약한 0.5px (자막 단어 맞출 때)
18. `beat_flash` — 문장 완료 시 전체 1회 (opacity 0.08)

### 포스트프로세스
- 약한 Bloom (강도 0.4)
- LUT: 따뜻한 뉴스 톤 (약간 노란기)
- Film Grain (opacity 0.2)
- 약한 Vignette

### 미션 타임라인
- 0.0~2.0s: "READY" + 스크립트 미리보기
- 2.0~17.0s: `read_script { script: "안녕하십니까, 오늘의 날씨를 전해드립니다. 맑은 하늘이 예상됩니다." }` 15초
- 17.0~20.0s: 결과 요약

### 성공/실패
- `successEffects`: 골드 파티클 드문드문 + "완벽한 앵커" kinetic_text (절제)
- `failEffects`: LUT 회색톤으로 0.3초 전환

---

## 템플릿 3: `emoji-explosion` (팝 코믹 표정+제스처)

### 무드
캔디 컬러 팝. 명랑 과장. 사용자를 **이모지 세계의 주인공**으로 만드는 컨셉.

- Primary: `--acid-green #39FF7D`
- Secondary: `--neon-pink #FF2D95`, `--sunset-orange #FF8A3D`
- 배경: 파스텔 메쉬
- BGM: K팝 업비트, 124 BPM
- 이펙트 강도: **중~강** (귀엽게 과장)

### 카메라 프레이밍
```
{ kind: 'heart', centerX: 540, centerY: 960, size: 420 }
```
카메라는 하트 모양. (SVG path로 클리핑)

### 레이어 구성 (25개)

**배경** (zIndex 1~10)
1. `gradient_mesh` — 파스텔 핑크·민트·라일락 메쉬, 색상 사이클 (30s 주기로 색조 회전)
2. `floating_shapes` — 3D 구름, 별, 하트 (귀여운 톤), 8개 천천히 떠다님
3. `particle_ambient` — 글리터·반짝이, 지속 생성 40개, 아래로 천천히 낙하

**카메라 주변** (zIndex 20~30)
4. `camera_feed` — 하트 클리핑
5. `camera_frame` — 하트 외곽 네온 핑크 3px + 글로우. **리액티브: onBeat every=1 → scale 1.0→1.05 bounce**
6. 하트 주위 6개의 작은 회전하는 **이모지 스티커** (layer type: `floating_shapes` 변형, 커스텀 이모지 텍스처) — 💖✨⭐️🎉🌈🦄 6개가 공전

**AR 레이어** (zIndex 35~45)
7. `face_sticker` (양 볼에 💖 블러셔) — 양 볼 랜드마크, yaw 추적
8. `face_sticker` (이마에 ⭐️) — 이마 중앙
9. `face_mask` (토끼 귀) — 얼굴 상단에 토끼 귀 이미지, faceSize 비례 스케일
10. `hand_emoji` — 양손에 ✌️ 또는 👍 (현재 인식된 제스처로 동적 전환)

**미드 전경** (zIndex 50~60)
11. `particle_ambient` (앞쪽) — 작은 하트 파티클 20개, 위로 떠오름
12. `beat_text` "LUV" — 우상단 핑크 글자, 비트마다 scale pulse
13. `kinetic_text` (하단) — "MAKE EM SMILE!" 임팩트 폰트, 자체 웨이브 애니 지속

**HUD** (zIndex 65~75)
14. `mission_prompt` — 현재 미션 타이틀 (미션마다 전환). "웃어보세요!" → "✌️ 만들어주세요!" → "슈퍼맨 포즈!"
15. `score_hud` — 우측 "85" 큰 숫자, 컬러풀
16. `timer_ring` — 좌측 원형 링

**반응형** (zIndex 70~80)
17. `voice_bubble` — 말할 때 랜덤 이모지 말풍선이 떠오름
18. `audio_visualizer` — 비트만 사용 (연속 시각화 안 함), 온셋 시 컬러풀 방사형 라인 잠깐

**미션별 전용 레이어**

[Scene 1: Smile] (zIndex 85~90, 해당 씬에서만 활성)
19. `particle_burst` — 미소 감지 시 하트·키스마크 이모지 위에서 쏟아짐 (대량)
20. `kinetic_text` "AWW 💕" — 중앙에 등장 (1.2초)

[Scene 2: Peace ✌️] (zIndex 85~90)
21. `particle_burst` — 피스 이모지 폭발, 방사형
22. `kinetic_text` "PEACE OUT ✌️"

[Scene 3: Hands Up Pose] (zIndex 85~90)
23. `lens_flare` — 양 손 위치에서 빛
24. `particle_burst` — 무지개 컬러 컨페티

**글로벌 성공** (zIndex 95)
25. `confetti` — 모든 씬 성공 시 최상단 전체 화면 컨페티 (2초)

### 포스트프로세스
- Bloom (강도 0.8, 파스텔이므로 덜 세게)
- 채도 부스트 (Saturation +20%)
- 약한 Bokeh (depth of field 흉내)

### 미션 타임라인 (3씬 혼합)
- 0.0~2.0s: 프롬프트 "자 시작해볼까요!"
- 2.0~7.0s: Scene 1 `smile { intensity: 0.6, durationMs: 2000 }`
- 7.0~12.0s: Scene 2 `gesture { gesture: 'peace' }`
- 12.0~17.0s: Scene 3 `pose_hold { pose: 'hands_up', holdMs: 2000 }`
- 17.0~18.5s: 글로벌 성공 연출

### 성공/실패
- `successEffects`: 전역 컨페티 + 모든 프레임 컬러 사이클 0.5초
- `failEffects`: 카메라 슬쩍 축소 + "AGAIN?" kinetic_text

---

## 구현 체크

각 템플릿은 `/data/templates/<id>/index.ts` 에 선언, zod 검증.
에셋(이미지/Lottie/BGM)은 `/public/templates/<id>/` 에 배치.

**템플릿 성공 기준 (Layer 3 실기기 체크)**
- [ ] 3개 템플릿이 서로 같은 앱이라고 믿기 어려울 만큼 다른 분위기
- [ ] 각 템플릿에서 최소 15개 이상 레이어가 동시에 동작 확인
- [ ] BGM 비트에 맞춰 여러 레이어가 펄스하는 것이 육안으로 인지됨
- [ ] AR 스티커가 얼굴/손 움직임 따라오며 떨리지 않음
- [ ] 포스트프로세스가 각 템플릿 무드에 맞게 적용됨 (neon은 강하게, news는 절제, emoji는 컬러풀)
- [ ] 녹화본에 모든 레이어와 후처리가 박힘
- [ ] 인스타 릴스에 올려도 아마추어 느낌 안 남

---

## 에셋 확보 전략

이 템플릿들은 상당한 에셋을 필요로 한다. Claude Code 자율 작업으로 전부 생성은 불가.

### 사용 가능한 소스 (Claude Code가 직접 다운로드 또는 CDN 사용)
- **Lottie 애니메이션**: https://lottiefiles.com (무료·상업용 가능 확인 필수)
- **BGM**: YouTube Audio Library, Pixabay Music (저작권 프리)
- **이모지**: Twemoji (Twitter 오픈소스 이모지, PNG/SVG)
- **SVG 도형**: Claude Code가 직접 SVG 코드 작성

### 비트 분석
- BGM을 essentia.js로 로컬 분석 → 결과 JSON 커밋
- Claude Code가 스크립트 작성 가능

### Claude Code가 만들 수 없는 것 (사용자 위임)
- 고품질 Lottie 커스텀 애니메이션 (LottieFiles에서 수동 선택 필요)
- 고품질 BGM (라이선스 있는 파일)
- 스튜디오 일러스트 배경 (AI 생성 또는 stock)

**전략**: Claude Code는 먼저 **플레이스홀더 에셋**(간단한 SVG, 무음 BGM 30초)으로 구현하고, 사용자가 아침에 진짜 에셋으로 교체.
