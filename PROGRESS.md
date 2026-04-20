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

### BLOCKER (Phase 0)
- (없음)

---
