# docs/COMPOSITION.md — 레이어드 컴포지션 엔진

> **이 문서가 MotiQ의 핵심이다.** Phase 5 작업 전 반드시 정독.
> 이 엔진이 제대로 구현되어야 캡컷/인스타/캔바를 넘어서는 결과물이 나온다.

---

## 1. 왜 레이어 엔진인가

### 1.1 잘못된 모델
```
[인트로] → [카메라 풀스크린 + HUD] → [아웃트로]
```
→ 이것은 단순 편집이고, 결과물은 HTML 수준에 머문다.

### 1.2 올바른 모델
```
촬영 전체 구간 동안 하나의 메인 캔버스에
15개 이상의 레이어가 동시에 렌더링되며,
BGM 비트·음성·포즈 인식 결과에 실시간 반응한다.

카메라 영상은 그 중 하나의 레이어일 뿐이며,
보통 전체 화면을 덮지 않고 창의적으로 프레이밍된다.
```

**이 차이가 "HTML 목업"과 "캡컷 수준"을 가른다.**

---

## 2. 하나의 캔버스 원칙

모든 레이어는 **단 하나의 메인 `<canvas>`** 에 순서대로 그려진다.
이유: `canvas.captureStream()` 으로 녹화될 때 레이어가 전부 박히려면 한 캔버스여야 함.

DOM 오버레이는 인터랙션 UI(시작 버튼, 설정 등 카메라 위가 아닌 요소)에만 사용.

```
렌더 순서(매 프레임):
1. Clear
2. Background layers      (그라디언트 메쉬, 그리드, 기하 도형)
3. Mid-back layers        (파티클 배경, 플로팅 요소)
4. Camera layer           (프레이밍·마스킹 적용)
5. Camera-adjacent layers (카메라 프레임 링, 글로우)
6. Face-tracked layers    (얼굴 스티커 - AR)
7. Body-tracked layers    (포즈 기반 이펙트)
8. Mid-front layers       (전경 파티클, 광택)
9. Text layers            (자막, 타이포 애니)
10. HUD layers            (점수, 카운트, 미션 표시)
11. Post-process pass     (블룸, LUT, 그레인, CRT 등)
12. Transition layers     (씬 전환 시에만)
```

---

## 3. 레이어 타입 분류

모두 공통 인터페이스를 따르되 타입에 따라 동작이 다르다.

```ts
interface BaseLayer {
  id: string;
  type: LayerType;
  zIndex: number;           // 렌더 순서
  opacity: number;          // 0~1
  blendMode?: GlobalCompositeOperation;  // 'screen' 'multiply' 등
  enabled: boolean;
  reactive?: ReactiveBinding;  // 비트/음성/미션 반응 정의
}

type LayerType =
  // 배경
  | 'gradient_mesh'         // 애니메이션 메쉬 그라디언트
  | 'animated_grid'         // 원근 그리드 (네온 플로어)
  | 'star_field'            // 스타 필드
  | 'noise_pattern'         // 필름 노이즈
  | 'image_bg'              // 정적/애니 배경 이미지

  // 기하 도형
  | 'floating_shapes'       // 떠다니는 3D 도형
  | 'orbiting_ring'         // 회전 링
  | 'pulse_circle'          // 비트 펄스 원

  // 파티클
  | 'particle_ambient'      // 지속 파티클 (먼지, 빛가루)
  | 'particle_burst'        // 트리거형 폭발 파티클
  | 'particle_trail'        // 움직임 궤적

  // 카메라 관련
  | 'camera_feed'           // 카메라 영상 본체
  | 'camera_frame'          // 카메라를 감싸는 프레임/보더
  | 'camera_reflection'     // 카메라 위에 덧씌우는 빛 반사

  // AR (랜드마크 기반)
  | 'face_sticker'          // 얼굴 특정 부위에 부착 (코/이마/볼)
  | 'face_mask'             // 얼굴 전체에 씌우는 가면·필터
  | 'body_accessory'        // 포즈 기반 의상·소품
  | 'hand_emoji'            // 손 위치에 이모지

  // 텍스트
  | 'kinetic_text'          // 글자 단위 등장 애니메이션
  | 'karaoke_caption'       // 음성 실시간 자막 (음절별 하이라이트)
  | 'beat_text'             // 비트에 맞춰 스케일 펄스
  | 'news_ticker'           // 하단 스크롤 뉴스
  | 'banner_badge'          // 고정 배지 (LIVE, HOT 등)

  // HUD
  | 'score_hud'             // 점수 3D
  | 'counter_hud'           // 미션 카운트
  | 'timer_ring'            // 남은 시간 링
  | 'mission_prompt'        // 현재 미션 지시문

  // 리액티브
  | 'audio_visualizer'      // 음량 기반 시각화 (막대, 웨이브)
  | 'voice_bubble'          // 말할 때 뜨는 말풍선
  | 'beat_flash'            // 비트마다 섬광
  | 'chromatic_pulse'       // RGB 스플릿 펄스

  // 특수
  | 'lottie'                // Lottie 애니메이션
  | 'lens_flare'            // 렌즈 플레어
  | 'lightning'             // 번개 이펙트
  | 'smoke'                 // 스모크
  | 'confetti'              // 컨페티
```

---

## 4. 반응성 시스템 (Reactive Binding)

레이어는 외부 이벤트에 자동으로 반응한다. 이것이 "살아 있는 템플릿"의 핵심.

```ts
interface ReactiveBinding {
  // BGM 비트에 반응
  onBeat?: {
    every: 1 | 2 | 4 | 8 | 16;      // 매 비트 / 2비트 / 소절 단위
    property: 'scale' | 'opacity' | 'rotate' | 'translate' | 'color';
    amount: number;                   // 변화량
    easing: EasingToken;
    durationMs: number;
  };

  // 온셋(킥드럼 같은 강한 음) 반응
  onOnset?: { ... };

  // 음성 볼륨 반응
  onVolume?: {
    threshold: number;                 // dB 기준
    property: 'scale' | 'glow';
    amount: number;
  };

  // 미션 이벤트
  onMissionProgress?: (progress: 0..1) => AnimationState;
  onMissionSuccess?: AnimationState;
  onMissionFail?: AnimationState;

  // AR 랜드마크 추적 (face_sticker, body_accessory 등 자동 활용)
  track?: {
    landmark: LandmarkId;              // 'nose' 'left_eye' 'right_shoulder' 등
    offset: { x: number; y: number };
    rotateWith?: 'face_yaw' | 'face_roll' | 'none';
    scaleWith?: 'face_size' | 'none';
  };
}
```

이 바인딩은 **선언형 JSON으로 템플릿 파일에 정의**된다. 렌더러가 매 프레임 바인딩을 해석해 레이어 속성을 업데이트.

---

## 5. 비트 싱크 엔진 (`/engine/beat/`)

BGM이 재생되는 동안 레이어가 비트에 맞춰 움직이게 하는 핵심 엔진.

### 5.1 사전 분석
- 템플릿 빌드 시점에 BGM mp3의 BPM·비트 시간·온셋 시간을 사전 계산 (웹/Node에서 `essentia.js` 또는 오프라인 분석 결과 JSON)
- 결과물 `bgm/<track>.beats.json`:
```json
{
  "bpm": 128,
  "beats": [0.021, 0.489, 0.957, ...],
  "onsets": [0.021, 0.957, 1.892, ...],
  "downbeats": [0.021, 1.895, 3.769, ...]
}
```

### 5.2 런타임 API
```ts
class BeatClock {
  start(bgm: HTMLAudioElement, beatsJson: BeatData): void;
  getCurrentTime(): number;
  getBeatPhase(): number;            // 0..1 (현재 비트 진행도)
  getBarPhase(): number;             // 0..1 (현재 소절 진행도)
  onBeat(cb: (beatIdx: number) => void): Unsubscribe;
  onOnset(cb: (onsetIdx: number) => void): Unsubscribe;
  onDownbeat(cb: (barIdx: number) => void): Unsubscribe;
}
```

### 5.3 폴백 (사전 분석 없을 때)
Web Audio API `AnalyserNode` 로 실시간 온셋 감지.
정확도 떨어지지만 사용자가 임의 BGM을 올릴 때 사용.

---

## 6. AR 트래킹 엔진 (`/engine/ar/`)

MediaPipe FaceLandmarker, PoseLandmarker 결과를 레이어 좌표로 변환.

### 6.1 얼굴 트래킹
```ts
// MediaPipe가 준 478개 랜드마크 중 의미 있는 기준점 추출
interface FaceAnchor {
  nose: Point2D;
  leftEye: Point2D; rightEye: Point2D;
  mouth: Point2D;
  forehead: Point2D;
  chin: Point2D;
  leftCheek: Point2D; rightCheek: Point2D;
  yaw: number;    // 좌우 회전 (rad)
  pitch: number;  // 위아래
  roll: number;   // 기울기
  faceSize: number;  // 정규화된 크기
}
```

### 6.2 포즈 트래킹
```ts
interface BodyAnchor {
  head: Point2D;
  leftShoulder: Point2D; rightShoulder: Point2D;
  leftHand: Point2D; rightHand: Point2D;
  hip: Point2D;
  // 팔 각도 등 파생값
}
```

### 6.3 스무딩
랜드마크는 프레임별로 지터가 있음 → One Euro Filter로 스무딩. 스티커가 떨리지 않게.

### 6.4 안정성
- 얼굴 미감지 시 스티커는 최근 위치에서 페이드아웃 (스냅처럼 사라지지 않음)
- 여러 얼굴 감지 시 가장 큰 얼굴 하나만 사용

---

## 7. 포스트프로세스 파이프라인 (`/engine/postfx/`)

캔버스 최종 합성 후 전체 이미지에 적용되는 셰이더 체인.

### 7.1 효과 종류
- **Bloom**: 밝은 부분 번지기 (네온 느낌)
- **LUT**: 컬러 그레이딩 (.cube 파일 → 3D 텍스처)
- **Chromatic Aberration**: RGB 분리
- **Film Grain**: 필름 노이즈
- **Vignette**: 가장자리 어둡게
- **CRT Scanlines**: 레트로 스캔라인
- **Pixelate**: 픽셀화 (8비트 효과)
- **Kaleidoscope**: 만화경
- **Motion Blur**: 움직임 블러

### 7.2 구현 선택지
- **A안 (권장)**: 별도 WebGL 캔버스에서 텍스처로 메인 캔버스 받아 셰이더 적용 → 최종 합성 캔버스에 복사
- **B안 (저사양)**: `ctx.filter = 'blur(2px)'` 같은 CSS 필터만 사용. 단 Safari에서 canvas filter 불안정
- 저사양 기기 tier=low 감지 시 포스트프로세스 전부 비활성

### 7.3 라이브러리 옵션
- `PixiJS` + 내장 필터 (bloom, chromatic, CRT 모두 있음) — **권장**
- 또는 `three.js` EffectComposer
- 순수 WebGL 구현은 과잉

**PixiJS v8로 포스트프로세스 전담 레이어를 구현하는 것이 현실적**. 단 메인 렌더링은 Canvas 2D 유지 (MediaPipe 랜드마크 드로잉이 단순).

---

## 8. 카메라 프레이밍 (Camera Framing)

카메라 영상을 어떻게 캔버스에 그릴지. 풀스크린만 고집하면 평범해짐.

### 8.1 프레이밍 종류
```ts
type CameraFraming =
  | { kind: 'fullscreen' }
  | { kind: 'circle'; centerX, centerY, radius }
  | { kind: 'rounded_rect'; x, y, w, h, radius }
  | { kind: 'hexagon'; centerX, centerY, size }
  | { kind: 'heart'; centerX, centerY, size }
  | { kind: 'split_vertical'; left: CameraFraming, right: CameraFraming }
  | { kind: 'picture_in_picture'; main, inset }
  | { kind: 'tv_frame'; framePath: string }  // 외곽을 TV·폴라로이드 이미지로
  | { kind: 'custom_mask'; maskPath: string };  // SVG path로 클리핑
```

### 8.2 구현
Canvas clipping path + `ctx.clip()` 사용. 프레이밍 경계 주변에 글로우/섀도우는 별도 레이어로.

### 8.3 매핑
- 카메라 원본 영상: 720x1280
- 캔버스: 1080x1920 (9:16)
- 카메라를 작게 프레이밍해도 원본 해상도는 유지되므로 화질 문제 없음

---

## 9. 템플릿 스키마 (최종)

```ts
interface Template {
  id: string;
  title: string;
  description: string;
  thumbnail: string;          // 정적 썸네일 (미리보기용)
  previewVideo?: string;      // 선택 화면에서 재생되는 루프 미리보기

  duration: number;           // 촬영 총 시간 (초)
  aspectRatio: '9:16';        // 현재는 세로만
  canvasSize: { w: 1080, h: 1920 };

  mood: MoodToken;            // VISUAL_DESIGN §2~§5 에서 하나

  bgm: {
    src: string;
    volume: number;
    beatsJson: string;        // 사전 분석 결과 경로
    loop: boolean;
    duckingDb: number;        // 음성 있을 때 감소량
  };

  cameraFraming: CameraFraming;

  layers: Layer[];            // 15~25개 정도가 표준

  missionTimeline: MissionEvent[];  // 미션 이벤트 순서 (시간축)

  postProcess: PostFxChain;

  successEffects: Effect[];   // 미션 성공 시 전역 발동
  failEffects: Effect[];
}

interface MissionEvent {
  id: string;
  startSec: number;
  endSec: number;
  mission: Mission;
  scoreWeight: number;        // 합계 = 1.0
  hudBinding: string;         // 어느 HUD 레이어가 이 미션을 표시하는지
}
```

---

## 10. 성능 예산

15~25개 레이어를 60fps는 무리. 목표는 **30fps 안정**.

### 10.1 최적화 전략
- 정적 배경은 **한 번만 그리고 오프스크린 캔버스에 캐시**, 매 프레임 copy만
- 파티클은 풀(pool) 재사용
- 레이어별 `enabled` 플래그 + 시간 기반 활성화 범위 → 비활성 레이어는 건너뜀
- 포스트프로세스는 저사양 tier 자동 비활성
- AR 트래킹은 FaceLandmarker 결과를 **스무딩 캐시** 해두고 랜드마크 없는 프레임엔 보간값 사용

### 10.2 측정
- 프레임 시간 16ms(60fps) / 33ms(30fps) 기준
- 저사양 tier: 25ms 초과 시 포스트프로세스 순차 비활성 (자동 품질 저하)

---

## 11. 구현 Phase 재구성

기존 CLAUDE.md Phase 5는 이 문서 기준으로 세분화:

**Phase 5a — 메인 캔버스 & 카메라 프레이밍**
- 메인 캔버스 설정 + rAF 루프
- CameraFraming 타입 전체 구현
- clip path 렌더러

**Phase 5b — 레이어 엔진 코어**
- BaseLayer 인터페이스 + 렌더러 순회
- zIndex·blendMode·opacity 지원
- 레이어 라이프사이클 (enter/update/exit)

**Phase 5c — 기본 레이어 구현 (배경·파티클·텍스트)**
- gradient_mesh, animated_grid, particle_ambient, kinetic_text
- `/debug/layers/<type>` 페이지에서 단독 확인

**Phase 5d — 비트 싱크 엔진**
- BeatClock 구현
- 사전 분석 JSON 로더
- 3개 템플릿용 BGM 비트 JSON 생성 (기본 제공)
- 리액티브 바인딩 onBeat 작동

**Phase 5e — AR 트래킹 레이어**
- FaceAnchor/BodyAnchor 추출기
- One Euro Filter 스무딩
- face_sticker, hand_emoji 구현

**Phase 5f — 포스트프로세스 (PixiJS)**
- PixiJS 도입, 메인 캔버스 → Pixi 텍스처 파이프라인
- bloom, chromatic, LUT, grain 필터
- 저사양 자동 비활성

**Phase 5g — HUD 레이어 (미션·점수)**
- score_hud, counter_hud, timer_ring, mission_prompt

**Phase 5h — 텍스트 레이어 (카라오케 자막 등)**
- karaoke_caption, beat_text, news_ticker

**Phase 5i — 통합 및 3개 템플릿 구현**
- `docs/TEMPLATES.md` 의 3개 템플릿을 선언형 JSON으로 구현
- 각 템플릿이 20개 내외 레이어로 구성되었는지, 서로 완전히 다른 무드인지 검증

각 단계마다 `/debug/*` 페이지로 자체 확인 가능하게.

---

## 12. 체크리스트 (Phase 5 완료 조건)

- [ ] 메인 캔버스 1개에서 모든 레이어 합성
- [ ] 카메라 프레이밍 6종 이상 동작
- [ ] 레이어 엔진 zIndex·blend·opacity 정상
- [ ] 20+ 레이어 동시 렌더 시 30fps 유지 (iPhone 13)
- [ ] 비트 싱크: BGM 재생 시 지정 레이어가 비트 정확히 맞춰 펄스
- [ ] AR 얼굴 스티커가 얼굴 움직임 따라감, 지터 없음
- [ ] 포스트프로세스 5종 토글 가능
- [ ] 카라오케 자막이 음성 인식에 실시간 동기
- [ ] 녹화본 mp4에 **모든 레이어와 포스트프로세스까지 박혀 있음**
- [ ] 저사양 tier 감지 시 포스트프로세스·AR·파티클 자동 감소
