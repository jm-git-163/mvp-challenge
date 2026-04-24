# CHECKLIST_PHASE_0 — 권한·세션 기반 실기기 검증

> docs/TESTING.md Layer 3 기준. Phase 0 완료 선언 전 **실기기**에서 전부 통과해야 함.
> Layer 1 (Vitest 단위): 자동화 완료 (56/56).
> Layer 2 (Playwright E2E, fake media): Phase 1에서 확장.
> Layer 3 (수동 실기기): 이 문서.

## 테스트 기기 매트릭스 (최소)

- [ ] iPhone 13+ / iOS 16.4+ / Mobile Safari
- [ ] iPhone 13 / iOS 15.x / Mobile Safari (폴백 경로 확인)
- [ ] Pixel 6+ / Android 13+ / Chrome
- [ ] Samsung Galaxy / Android 12 / Samsung Internet
- [ ] MacBook / macOS / Chrome · Safari · Firefox
- [ ] Windows / Chrome · Edge · Firefox

---

## 0.2 호환성 감지

- [ ] iOS Safari: `mediaRecorderMime === 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'`
- [ ] Android Chrome: webm vp9 또는 vp8 선택
- [ ] Firefox: webm 선택, `speechRecognition=false` 경고 노출
- [ ] iOS 15.x: 특정 경고 문구 노출되지만 진입은 허용
- [ ] 데스크톱 Safari 16+: `wakeLock='native'`
- [ ] 지원 불가 환경 (예: 구형 Samsung Internet) → 블로커 화면 + 안내 문구

## 0.3 mediaSession (단일 getUserMedia)

- [ ] 앱 전체에서 getUserMedia 콜이 정확히 **1회** (DevTools Network + 직접 console hook)
- [ ] 프리뷰 ↔ 녹화기 ↔ 미션 엔진 모두 같은 MediaStream 사용
- [ ] 녹화 종료 후 release 호출 안 됨 (스트림 유지) — 재녹화 빠르게 시작
- [ ] USB 웹캠 분리 → 자동 stale → 재접속 시 `acquire()` 재획득 성공
- [ ] 브라우저 권한 철회 (설정에서 카메라 거부) → 안내 화면 + 재요청 경로
- [ ] OverconstrainedError (iOS 저가 기기) → 폴백 체인 성공
- [ ] NotReadableError (다른 앱이 카메라 점유) → 친절한 안내
- [ ] 동시 acquire 호출 경쟁 조건 없음 (빠르게 페이지 전환해도 1회)

## 0.4 wakeLock

- [ ] 녹화 시작 30초 후에도 화면 꺼지지 않음 (iOS/Android)
- [ ] 탭 백그라운드 → 포그라운드 복귀 시 wake lock 자동 재취득
- [ ] iOS 15.x: NoSleep.js 폴리필 경로로도 화면 유지
- [ ] 녹화 종료 (release) 후 정상적으로 화면 dim/잠금
- [ ] wakeLock 실패해도 녹화는 진행 (경고만 표시)

## 0.5 popupSuppressor

- [ ] Android Chrome 설치 프롬프트가 녹화 화면에서 뜨지 않음
- [ ] "앱 설치" UI 버튼으로 나중에 프롬프트 재트리거 가능
- [ ] 녹화 중 뒤로가기 · 탭 닫기 시 이탈 confirm 다이얼로그
- [ ] 녹화 중 길게 누르기 → 컨텍스트 메뉴 안 뜸 (모바일)
- [ ] 녹화 중 드래그 제스처 → 시스템 드래그 프리뷰 안 뜸

## 0.6 permissionGate 전체 흐름

- [ ] 콜드 로드: 스플래시 → compat check (<100ms) → 권한 요청 1회 → ready
- [ ] compat_failed 화면: 블로커 목록 읽기 쉬움, 재시도 불가 상태 명확
- [ ] media_denied 화면: "설정에서 허용" 안내 + 재시도 버튼
- [ ] media_failed (장치 점유) 화면: 다른 앱 종료 안내
- [ ] ready 진입 시 wakeLock 상태 (native/polyfill/none) UI 인디케이터
- [ ] 홈 재진입: 이미 ready 상태라면 게이트 스킵

## 금지 사항 회귀 테스트 (CLAUDE.md §3)

- [ ] `rg 'getUserMedia' engine/ components/ app/ | wc -l` = 1 (mediaSession.ts 뿐)
- [ ] `rg '(alert|confirm|prompt)\\(' engine/` 빈 결과 (녹화 경로에서)
- [ ] Wake Lock 취득 전 녹화 시작 차단 코드 확인

---

완료일: _____
확인자: _____
