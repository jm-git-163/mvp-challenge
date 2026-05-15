# docs/PERFORMANCE.md — 성능 예산 및 메모리 관리

> Phase 1, 3, 7 작업 시 참조. 기준 미달 시 해당 Phase 미완.

## 1. 성능 예산 (기기별 목표)

| 지표 | iPhone 13+ | Galaxy S22+ | iPhone SE 3 | 저가 Android |
|---|---|---|---|---|
| 카메라 → 캔버스 프레임률 | 30 fps | 30 fps | 24+ fps | 20+ fps |
| MediaPipe 추론 빈도 | 24/s | 24/s | 18/s | 12/s |
| 추론 지연(1프레임) | <30ms | <30ms | <50ms | <80ms |
| 첫 진입 LCP | <2.5s | <2.5s | <3.5s | <4.5s |
| 모델 첫 다운로드 | <5s (wifi) | 동일 | 동일 | 동일 |
| 녹화 중 JS heap | <150MB | <150MB | <120MB | <100MB |

## 2. 메모리 관리 체크리스트

### 2.1 MediaPipe
```ts
// 사용 후 반드시
await poseLandmarker.close();
await faceLandmarker.close();
await gestureRecognizer.close();
```
컴포넌트 unmount의 cleanup 함수에 넣는다. 페이지 이동 후에도 누수 있으면 SPA 세션 동안 메모리가 계속 증가.

### 2.2 MediaStream 트랙
```ts
stream.getTracks().forEach(t => t.stop());
```
단, mediaSession.ts의 전역 스트림은 앱 종료 시에만 stop. 촬영 끝날 때마다 stop하면 다음 촬영에서 권한 재요청됨.

### 2.3 rAF 루프
```ts
let rafId: number | null = null;
const loop = () => { /* ... */; rafId = requestAnimationFrame(loop); };
// cleanup:
if (rafId) cancelAnimationFrame(rafId);
```

### 2.4 AudioContext
전역 싱글톤 1개 유지. 여러 번 생성하면 Safari가 제한 걸림.

### 2.5 Blob URL
`URL.createObjectURL` 사용 후 `URL.revokeObjectURL` 필수. 결과 페이지 떠날 때 정리.

### 2.6 Lottie 인스턴스
`anim.destroy()` 호출

## 3. React 렌더 최적화

### 3.1 랜드마크는 ref에
```ts
// ❌ 금지
const [landmarks, setLandmarks] = useState([]);
// poseEngine.onResults(r => setLandmarks(r.landmarks));  // 매 프레임 리렌더

// ✅ 올바름
const landmarksRef = useRef([]);
poseEngine.onResults(r => {
  landmarksRef.current = r.landmarks;
  // 캔버스에 직접 draw
});
```

### 3.2 점수 상태는 throttle
점수는 프레임마다 변할 수 있지만 UI 업데이트는 초당 6~10회면 충분.
- 캔버스 HUD: 매 프레임 (성능 저렴)
- React state 동기화 (결과 페이지용): 200ms throttle

### 3.3 메모이제이션
- 렌더러 컴포넌트는 `React.memo`
- 커스텀 훅의 콜백은 `useCallback`
- 단, 성급한 최적화 금지 — 프로파일링 후 필요한 곳만

## 4. 번들 크기·로딩

### 4.1 번들 분할
- MediaPipe 관련 코드는 `dynamic(() => import('...'), { ssr: false })`
- Lottie 애니메이션 JSON도 dynamic import
- 템플릿별 에셋은 템플릿 선택 시 로드

### 4.2 모델 파일
- `pose_landmarker_full.task`: ~6MB
- `face_landmarker.task`: ~3MB
- `gesture_recognizer.task`: ~8MB
- 합계 ~17MB → 3G에서 느림

대응:
- Service Worker로 캐시 (`next-pwa` 사용)
- 첫 진입 시 모델 프리페치 (템플릿 선택 화면에서 백그라운드로 당김)
- 프로그레스 표시: "AI 모델 준비 중 xx%"

### 4.3 폰트·에셋
- Pretendard Variable 단일 파일
- Lottie JSON은 gzip 후 50KB 이하로 유지
- 이미지는 next/image + WebP/AVIF

## 5. 프로파일링 절차

Phase 3, 6, 7 완료 시 각각 실행:

### 5.1 Chrome DevTools Performance
- 30초 세션 기록 (권한 → 촬영 → 녹화 → 결과)
- Long Task (>50ms) 개수: 10개 이하 목표
- FPS: 평균 24+ 목표

### 5.2 Memory
- Heap snapshot 3개: 진입 직후 / 촬영 종료 직후 / 결과 페이지 진입
- 촬영 종료 후 → 결과 페이지로 가면서 미디어 관련 메모리 해제 확인

### 5.3 Lighthouse (Phase 7)
- Performance 90+
- Accessibility 95+
- Best Practices 95+
- PWA 100 (설치 가능)

### 5.4 Claude Code 수행 방법
- Playwright Tracing + Performance API로 수치 수집
- PROGRESS.md에 수치 기록
- 목표 미달 시 BLOCKER 등록

## 6. 병목 발견 시 전략 순서

1. **스로틀**: 추론·렌더 빈도 낮추기
2. **레이지 로드**: 당장 필요 없는 것 미루기
3. **WebWorker**: MediaPipe를 워커로 옮기기 (복잡도 주의)
4. **OffscreenCanvas**: 지원 기기에서만
5. **모델 다운그레이드**: `lite` 모델로 대체 (사용자 승인 필요)
6. **이펙트 자동 감소**: 저사양 감지 시 크로매틱·파티클 개수 줄이기

## 7. 저사양 감지

`navigator.hardwareConcurrency`, `navigator.deviceMemory` 기반 간이 점수:
```ts
const cores = navigator.hardwareConcurrency ?? 4;
const memGB = navigator.deviceMemory ?? 4;
const tier = (cores >= 6 && memGB >= 4) ? 'high'
           : (cores >= 4 && memGB >= 2) ? 'mid' : 'low';
```
`low` → 이펙트 강도 자동 감소, 추론 빈도 12/s, 해상도 720p 대신 540p.

## 8. 녹화 품질 설정

```ts
const recorder = new MediaRecorder(stream, {
  mimeType: chosen,                   // §COMPATIBILITY §2.1
  videoBitsPerSecond: tier === 'low' ? 2_000_000 : 3_500_000,
  audioBitsPerSecond: 128_000,
});
recorder.start(1000);                  // 1초 청크
```

## 9. 체크리스트

- [ ] PoseLandmarker/FaceLandmarker close 호출 grep 검증 (CI)
- [ ] rAF id 저장 및 cancel 패턴 강제
- [ ] 랜드마크를 useState에 저장한 코드 0건 (grep)
- [ ] 모델 파일 Service Worker 캐시 확인
- [ ] Lighthouse 90+ 달성
- [ ] 저사양 tier 감지 + 자동 조정 동작
