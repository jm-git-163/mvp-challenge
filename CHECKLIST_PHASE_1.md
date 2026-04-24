# CHECKLIST_PHASE_1 — 인식 엔진 실기기 검증

> docs/TESTING.md Layer 3 기준. Phase 1 완료 선언 전 실기기 검증.
> Layer 1 (Vitest): 자동 완료 (168/168).
> Layer 2 (Playwright E2E with fake media): Phase 3 통합 테스트에서.
> Layer 3 (실기기): 이 문서.

## 1.1 OneEuroFilter (AR 스무딩)

- [ ] 얼굴 스티커가 빠른 머리 움직임에도 200ms 이내 추종
- [ ] 정지 시 지터 없음 (육안)
- [ ] beta=0, minCutoff=1 vs beta=0.007, minCutoff=1 비교해 응답/스무딩 트레이드오프 확인

## 1.2 AudioAnalyser

- [ ] 무음 환경 — level < 0.05, isLoud=false 항상
- [ ] 박수 소리 — isOnset 프레임 맞게 감지
- [ ] 평범한 말소리 — level 0.3..0.6
- [ ] 소리치기 — level > 0.8, isLoud=true
- [ ] OnsetDetector refractory (120ms) 작동 — 급한 연속 박수도 분리

## 1.3 SpeechRecognizer

- [ ] iPhone Safari: 15초 연속 말해도 끊김 없이 transcript 이어짐
- [ ] iOS: 세션 자동 재시작 확인 (onend 후 100ms 내 재개)
- [ ] Android Chrome: continuous=true로 10초+ 연속 동작
- [ ] 권한 거부 → error 상태로 고정, 무한 재시도 없음
- [ ] 노이즈 환경 (TV 배경음) — 정확도 급락해도 앱 안 죽음
- [ ] 한국어 받아쓰기 정확도 ≥ 80% (정상 발화)

## 1.4 SquatCounter (실제 스쿼트)

- [ ] 10회 스쿼트 실행 → 정확히 10 reps 카운트 (±1 허용)
- [ ] 얕은 스쿼트 (무릎 각 > 100°) → 카운트 안 됨
- [ ] 제자리 걷기 · 허리 굽히기 등 오동작 0
- [ ] 빠른 bounce (<150ms 홀드) → 지터 무시
- [ ] totalScore 공식 체감: 정확하게 깊게 일정하게 10회 → ≥ 90점

## 1.5 SmileMission

- [ ] 웃지 않음 → peak < 0.3, score 낮음
- [ ] 살짝 웃음 → peak 0.4..0.6
- [ ] 활짝 웃음 3초 → peak > 0.8, sustain 만점
- [ ] 카메라 각도 변화에도 안정적 감지

## 1.6 GestureMission

- [ ] 각 MediaPipe 카테고리 (Thumb_Up, Victory, Open_Palm, ILoveYou) 인식
- [ ] 프롬프트별 5초 제한 — 느리게 반응해도 실패 기록
- [ ] 응답 < 800ms → 만점 체감
- [ ] matchRatio가 totalScore에 곱셈으로 반영

## 1.7 PoseHoldMission

- [ ] T-Pose 2초 유지 → holding=true, bestHoldMs ≥ 2000
- [ ] 흔들림 있으면 stability 하락
- [ ] target pose 바꾸고 reset → 새 포즈 평가

## 1.7 LoudVoiceMission

- [ ] 일반 대화 (-30dB) → totalScore 낮음
- [ ] 크게 외치기 (-10dB) 2초 → totalScore ≥ 90

## 1.8 ScriptMission

- [ ] 정확 낭독 + 제한시간 내 → ≥ 90
- [ ] 중간 생략 → completion 직관적 감소
- [ ] 유사한 오타 (발음 비슷) → similarity 적당히 감점

## 공통 회귀

- [ ] `rg 'setTimeout\\(.*score' engine/` 0건 (가짜 스코어 금지)
- [ ] `rg 'Math\\.random' engine/` 0건 (점수 관련)
- [ ] CLAUDE.md §3 금지 #1, #2 위반 없음

---

완료일: _____
확인자: _____
