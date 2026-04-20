# PROGRESS.md — MotiQ 구현 진행 기록

> CLAUDE.md v4 기준 Phase별 작업 진행 추적. 매 커밋마다 한 줄 이상 추가.

---

## Phase 0 — 권한·세션 기반

### 0.1 인프라 · 중복 문서 정리 (2026-04-20)
- 루트 중복 md 7개 제거 (내용이 `docs/` 하위와 동일). `CLAUDE.md`, `START_OVERNIGHT.md` 만 루트 유지.
- Vitest + @vitest/coverage-v8 + @types/node devDeps 추가.
- `vitest.config.ts` 추가 — `engine/**`, `data/**`, `tests/**` 테스트 타겟.
- `package.json` scripts: `test`, `test:watch`, `test:coverage`.

### 0.2 `engine/session/compatibilityCheck.ts` (2026-04-20)
- `docs/COMPATIBILITY §7` CompatReport 스키마 그대로 구현.
- iOS/Mobile Safari/iPadOS 위장 감지, iOS 버전 파싱.
- `MIME_CANDIDATES` 폴백 체인 (mp4 → webm vp9 → vp8 → webm).
- `getBlockers()` / `getWarnings()` 분리 (블로커만 진입 차단).
- `runCompatibilityCheck(deps?)` — deps 주입으로 테스트 가능.
- Vitest: **17/17 pass**. `[자동검증완료]`

### 0.3 `engine/session/mediaSession.ts` (2026-04-20)
- CLAUDE.md §3 FORBIDDEN #13 + §4.5 강제: 앱 전체 **단일 getUserMedia** 지점.
- `MediaSession` 클래스: `acquire()`, `getStream()`, `release()`, `onEnded()`, `markStale()`.
- 동시 `acquire()` in-flight promise dedupe → 동시 3회 호출해도 getUserMedia 1회.
- `FALLBACK_CHAIN` 4단계: 720×1280@30 → 640×480@24 → facingMode only → `{video:true,audio:true}`.
- `classifyError`: NotAllowed/Security=denied, NotFound=notfound, NotReadable=notreadable, Overconstrained=overconstrained.
- denied/notfound → 즉시 throw (폴백 중단). notreadable/overconstrained → 다음 제약 재시도.
- track `ended` 이벤트 → stale 마킹 + `onEnded('track-ended')` 통지 (USB 분리·권한 철회 복구).
- `DEFAULT_CONSTRAINTS`: docs/COMPATIBILITY §3 그대로 (EC/NS/AGC 48kHz audio).
- 싱글톤 `getMediaSession()` + 테스트용 `__resetMediaSessionForTests()`.
- Vitest: **15/15 pass**. `[자동검증완료]`

### 0.4 `engine/session/wakeLock.ts` (2026-04-20)
- docs/COMPATIBILITY §4 Wake Lock 관리자.
- `WakeLockManager`: `acquire()`, `release()`, `getKind()`, `isActive()`.
- 3단계 경로: native (navigator.wakeLock) → polyfill (NoSleep.js 주입) → none.
- `visibilitychange` 리스너 자동 등록 — 탭 백그라운드→포그라운드 복귀 시 `desired`면 자동 재취득 (native wake lock은 백그라운드 진입 시 브라우저가 해제).
- CLAUDE.md §3 FORBIDDEN #12: "Wake Lock 없이 녹화 시작 금지" — 녹화기는 이 매니저 acquire 성공을 선행 조건으로.
- 싱글톤 + 테스트 리셋 API.
- Vitest: **6/6 pass**. `[자동검증완료]`

### BLOCKER (Phase 0)
- (없음)

---
