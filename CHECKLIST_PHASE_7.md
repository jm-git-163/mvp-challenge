# CHECKLIST_PHASE_7.md — 결과·배포·성능 실기기 검증

> Phase 7 완료 판정용. Claude Code 가 자동 검증할 수 없는 항목은 사용자가 체크.

## 1. 결과 페이지 (`/result`)

- [ ] 녹화본 즉시 재생 가능 (`<video>` inline playsinline)
- [ ] 총점 + 별점 + headline(한국어) 표시
- [ ] 미션별 라인(한글 라벨 · 점수 · 가중) 표시
- [ ] "공유" 버튼: iOS/Android 에서 Web Share API 네이티브 시트
- [ ] "저장" 버튼: Web Share 미지원 시 자동 .mp4 다운로드
- [ ] "다시 도전" 버튼 → 현재 템플릿으로 `/studio` 이동
- [ ] "템플릿 선택" 버튼 → `/templates`
- [ ] 페이지 이탈 전 다운로드 안 한 경우 `beforeunload` 경고

## 2. Error Boundary (docs/EDGE_CASES.md §8)

- [ ] `<RootErrorBoundary>` 최상단
- [ ] `<StudioErrorBoundary>` 카메라 영역
- [ ] `<EngineErrorBoundary>` MediaPipe 영역
- [ ] fallback UI: `classifyError()` 결과의 `userTitle` + `actionLabel` 노출
- [ ] `recoverable` 이면 "다시 시도", 아니면 "돌아가기" 버튼
- [ ] 개발자도구 콘솔에 `debugDetail` 로깅

## 3. 실기기 체크리스트

| 기기 | 브라우저 | 촬영 | 녹화 저장 | 공유 | 미션 |
|---|---|---|---|---|---|
| iPhone 15 (iOS 18) | Safari | ☐ | ☐ (.mp4) | ☐ | ☐ |
| iPhone 12 (iOS 17) | Safari | ☐ | ☐ | ☐ | ☐ |
| Galaxy S24 | Chrome | ☐ | ☐ (.webm/.mp4) | ☐ | ☐ |
| Galaxy A 시리즈 중급 | Chrome | ☐ | ☐ | ☐ | ☐ |
| Pixel 8 | Chrome | ☐ | ☐ | ☐ | ☐ |
| iPad | Safari | ☐ | ☐ | ☐ | ☐ |
| Windows + 웹캠 | Chrome | ☐ | ☐ | - | ☐ |

## 4. 성능 목표 (docs/PERFORMANCE)

- [ ] 30fps 유지 (PerfSampler p95 ≤ 50ms, 드롭 <10%)
- [ ] 모델 로드 < 8초 (네트워크 양호 시)
- [ ] 녹화 정지 → 결과 표시 < 3초
- [ ] 힙 사용량 < 350MB (performance.memory 가능한 환경)

## 5. Lighthouse 90+ (Mobile)

- [ ] Performance ≥ 90
- [ ] Accessibility ≥ 90
- [ ] Best Practices ≥ 90
- [ ] SEO ≥ 80

## 6. 접근성 & 다국어

- [ ] 모든 인터랙티브 요소 키보드 포커스 가능
- [ ] aria-label 한국어 (스크린리더)
- [ ] `prefers-reduced-motion` 존중: PostProcess strength ×0.3

## 7. 배포 직전

- [ ] `npm run build` 무경고 통과
- [ ] `npx vitest run` 전부 green
- [ ] 404/500 페이지 작성
- [ ] CSP meta (camera/microphone self)
- [ ] README 스크린샷 3장 (3 템플릿)
