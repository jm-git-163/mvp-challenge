# WORK_ORDER_FOCUSED.md

**Goal: mvp-ivory-kappa.vercel.app 에서 K-POP 댄스 챌린지를 누구나 끝까지 완주할 수 있게 한다.**

## 단일 유저 저니 (100% 완성 대상)

홈 → "K-POP 댄스 챌린지" 카드 탭 → 녹화 → 결과 화면 → neon-arena 템플릿 자동 적용 → MP4 다운로드

위 플로우가 **iPhone Safari · Galaxy Chrome · MacBook Chrome** 3기기에서 동일하게 동작할 때까지 다른 어떤 것도 만들지 않는다.

## 이 세션의 4개 커밋 (순서 고정)

1. **라우트 정합화** — `app/_layout.tsx` Stack.Screen 선언 ↔ `app/` 트리 일치.  *(이미 main 병합됨 — 검증만)*
2. **포즈 로더 프로덕션 mock 폴백 제거 + UI 노출** — `hooks/usePoseDetection.web.ts` 의 catch 블록을 `__DEV__` 한정. `components/camera/RecordingCamera.web.tsx` / `app/record/index.tsx` 에서 `status` 와 `retry()` 를 실제 사용자에게 노출.
3. **neon-arena BGM 실재화** — `data/templates/neon-arena.ts` 의 `bgm.src` 를 동작하는 URL 로 교체. `public/bgm/placeholder-synthwave-128.mp3` 배치. `bgm.beatsJson` 사전 생성.
4. **결과 화면 MP4 다운로드 파이프라인 검증** — `app/result/index.tsx` 녹화 종료 후 neon-arena 합성 → MP4 생성 → 다운로드까지 실제 동작 확인.

## 금지

- 새 Phase 시작 금지
- 새 엔진 모듈 추가 금지
- 새 템플릿 추가 금지
- 새 문서 작성 금지 (이 파일 제외)
- Pixi·SNS·다른 챌린지·cinematic/fitness/storybook 등 확장 작업 금지
- 위 4커밋이 라이브에서 100% 동작 입증되기 전엔 어떤 이탈도 없음

## 수용 기준

- [ ] Vercel 라이브에서 홈 → K-POP 카드 → 녹화 → 결과 → MP4 다운로드 한 번도 안 끊기고 완주 가능
- [ ] BGM 이 녹화 중 실제로 들림
- [ ] 포즈 로드 실패 시 "다시 시도" 버튼이 UI 에 보이고 동작함
- [ ] Vitest 항상 green
