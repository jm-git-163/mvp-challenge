# docs/COMPATIBILITY.md — 브라우저/기기 호환성 매트릭스

> Phase 0, Phase 3, Phase 7 작업 시 반드시 참조.

## 1. 지원 기준

**Tier 1 (완전 지원, 출시 블로커)**
- iOS Safari 16.4+
- Android Chrome 최신 2버전
- 데스크톱 Chrome/Edge 최신

**Tier 2 (동작 보장, 일부 이펙트 감소)**
- iOS Safari 14.3~16.3 (Wake Lock 폴백)
- 삼성 인터넷 최신

**Tier 3 (감지 후 안내)**
- Firefox (SpeechRecognition 미지원 → 음성 미션 비활성화 안내)
- WebView 환경 (카메라 제한 가능)

## 2. API별 호환성·폴백

### 2.1 MediaRecorder 코덱
```ts
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',  // iOS 14.3+, 데스크톱 최신
  'video/webm;codecs=vp9,opus',                // Chrome/Firefox
  'video/webm;codecs=vp8,opus',                // 폴백
  'video/webm',                                 // 최후
];
const chosen = MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t));
if (!chosen) throw new Error('MediaRecorder 지원 안 됨');
```
iOS Safari는 mp4 우선이어야 함. webm 하드코딩 시 녹화 파일 0바이트.

### 2.2 Wake Lock API
- iOS 16.4+, Android Chrome, 데스크톱 Chrome: 네이티브 `navigator.wakeLock`
- 미지원: `NoSleep.js` 폴백 (무음 영상 루프 트릭)
```ts
if ('wakeLock' in navigator) { /* native */ }
else { /* import NoSleep dynamically */ }
```

### 2.3 SpeechRecognition
- iOS Safari: `webkitSpeechRecognition` (iOS 14.5+), **자동 재시작 필요** (5~10초마다 끊김)
- Android Chrome: 안정적
- Firefox: 미지원 → `navigator.userAgent`/feature detection으로 감지, 음성 미션 "이 브라우저에서는 지원하지 않습니다" 안내 + 해당 템플릿 비활성화

### 2.4 Permissions API
```ts
try {
  const result = await navigator.permissions.query({ name: 'camera' });
} catch (e) {
  // 일부 iOS에서 throw → 바로 getUserMedia 시도로 폴백
}
```

### 2.5 `<video>` 재생
- iOS는 반드시 `playsInline muted autoPlay` (셋 다 필수). muted 없으면 autoPlay 차단
- 카메라 스트림은 초기엔 muted 상태, 오디오는 별도 MediaStream 트랙으로 처리

### 2.6 `requestVideoFrameCallback`
- 대부분 브라우저 지원, Safari 15.4+
- 미지원 시 `requestAnimationFrame` 폴백 (단, 프레임 동기화 덜 정밀)

### 2.7 `navigator.vibrate` (햅틱)
- iOS Safari 미지원 → try/catch로 감싸고 조용히 실패
- Android Chrome 지원

### 2.8 OffscreenCanvas (성능 최적화용)
- Safari 16.4+ 지원 (그 전엔 감지 후 메인 스레드 처리)

## 3. 필수 `getUserMedia` 제약

```ts
const constraints = {
  video: {
    facingMode: 'user',              // 셀피 기본
    width:  { ideal: 720, max: 1080 },
    height: { ideal: 1280, max: 1920 },
    frameRate: { ideal: 30, max: 30 },
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
  },
};
```
실패 시 단계적으로 완화 (facingMode만 유지, 해상도 낮추기).

## 4. 미러링 정책 (통일)

- 셀피 카메라: 화면 표시는 **미러**(좌우 반전)로 자연스럽게
- **녹화본도 미러 기준으로 저장** (사용자가 본 그대로)
- canvas 합성 단계에서 `ctx.scale(-1, 1)` 적용, 모든 오버레이는 미러 이후 그리기
- 이 정책이 지켜지지 않으면 "화면에선 오른손인데 녹화본은 왼손" 혼란 발생

## 5. 화면 방향·잠금

- 세로(portrait) 강제: 메타 `screen.orientation.lock('portrait')` 시도 (미지원 기기 무시)
- 가로로 돌렸을 때: 안내 오버레이 "세로로 돌려주세요"

## 6. 안전 영역

```css
padding-top:    env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```
- HUD 배치는 안전 영역 내부
- 노치·다이나믹 아일랜드 침범 금지

## 7. 감지 체크리스트 (Phase 0 완료 시 구현)

`/engine/session/compatibilityCheck.ts`:
```ts
export interface CompatReport {
  mediaDevices: boolean;
  mediaRecorder: boolean;
  mediaRecorderMime: string | null;
  wakeLock: 'native' | 'polyfill' | 'none';
  speechRecognition: boolean;
  permissionsAPI: boolean;
  requestVideoFrameCallback: boolean;
  vibrate: boolean;
  isIOS: boolean;
  isMobileSafari: boolean;
  iOSVersion: number | null;
}
```
PermissionGate 진입 시 자동 실행, 블로커 발견 시 명확한 안내 화면.

## 8. 알려진 지뢰

- **iOS Safari 사진 앱 권한 다이얼로그**: 파일 선택이 필요한 경우에만 뜸. 우리 앱은 파일 업로드 없으므로 문제 없음.
- **iOS Safari 오디오 컨텍스트**: 사용자 제스처로 시작 필요 (Phase 0에서 해결)
- **Android Chrome 카메라 전환 시 스트림 끊김**: 전/후면 전환 버튼 구현 시 스트림 재생성 필요
- **Safari의 MediaRecorder 청크 이벤트**: `timeslice` 인자를 안 주면 종료 때만 1번 발생 → 반드시 `recorder.start(1000)` 로 1초 청크 강제
- **모바일 브라우저 탭 백그라운드**: 녹화 중단 + 이후 재개 불가. `visibilitychange` 감지 시 자동 저장 후 안내

## 9. 테스트 실기기 리스트 (권장)

- iPhone 13 이상 (iOS 17+)
- iPhone SE 3세대 (저사양 베이스라인)
- Galaxy S22 이상
- Pixel 7
- 저가 Android (Galaxy A 시리즈)

Claude Code는 이 기기 직접 접근 불가 → `docs/TESTING.md` 실기기 체크리스트로 사용자에게 위임.
