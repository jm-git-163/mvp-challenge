# OG 리치 프리뷰 아키텍처

카카오톡·라인·페이스북 등 메신저의 링크 미리보기 크롤러는 **JavaScript 를 실행하지
않는다.** expo-router 는 웹에서 SPA 로 동작하므로 `app/challenge/[slug]/index.tsx`
의 `useEffect` 메타 주입은 크롤러에게 보이지 않는다. 결과: 수신자 채팅창에 빈 URL
한 줄만 노출 → 아무도 탭하지 않음.

## 해법: Vercel serverless 가 정적 OG HTML 반환

발신자가 공유하는 URL 은 별도 네임스페이스 `/share/challenge/<slug>` 를 사용한다.
이 경로는 `vercel.json` rewrite 로 `/api/share/challenge/<slug>` serverless 함수에
연결되며, 함수는 **JS 없이도 완성된 OG 메타가 박힌 HTML** 을 반환한다.

실제 사용자 브라우저가 같은 URL 을 열면 `<meta http-equiv="refresh">` + `location.replace`
가 SPA 라우트 `/challenge/<slug>?c=...` 로 자동 이동시킨다.

## 플로우

```
발신자 ─ buildInviteUrl() ─→ https://motiq.app/share/challenge/kpop-dance?c=<base64url>
                                        │
                        (카톡 붙여넣기)  │
                                        ▼
            ┌──────────────── GET /share/challenge/kpop-dance?c=… ─────────────┐
            │                                                                   │
  [카톡 크롤러 / JS 안 돎]                                  [수신자 브라우저 / JS 돎]
            │                                                                   │
      vercel rewrite                                              vercel rewrite
            │                                                                   │
  /api/share/challenge/[slug].ts                              /api/share/challenge/[slug].ts
            │                                                                   │
    정적 OG HTML 반환                                              정적 OG HTML 반환
            │                                                                   │
     og:title/desc/image 파싱                                    meta refresh + JS redirect
            │                                                                   │
       리치 카드 렌더                                          /challenge/kpop-dance?c=…
                                                                                │
                                                                       SPA 기동 → 챌린지 시작
```

## 파일

| 파일 | 역할 |
|---|---|
| `utils/challengeMeta.ts` | 순수 TS. slug→{name, thumbUrl} 맵, base64url 디코더, OG HTML 렌더러. React/DOM 의존 없음. |
| `api/share/challenge/[slug].ts` | Vercel Node serverless. 요청 파싱 → `renderOgHtml()` → HTML 응답. |
| `utils/inviteLinks.ts` | `buildInviteUrl()` 출력 경로를 `/share/challenge/…` 로 변경. `parseInviteUrl()` 은 `/challenge/`, `/share/challenge/`, `/c/` 셋 다 허용 (backward compat). |
| `vercel.json` | `/share/challenge/:slug` → `/api/share/challenge/:slug` rewrite. SPA 폴백에서 `share/`, `api/` 제외. |

## 검증

1. 로컬: `npm test -- utils/challengeMeta.test.ts utils/inviteLinks.test.ts`
2. 배포 후: `curl -A "KakaoTalk-Scrap" https://motiq.app/share/challenge/kpop-dance?c=<b64>` → OG 메타 확인.
3. 실기기: 카톡에서 URL 붙여넣기 → 썸네일·타이틀·설명 카드 렌더 확인.

## SPA 는 변경 없음

기존 `/challenge/<slug>?c=…` 라우트는 건드리지 않는다. 수신자는 OG HTML 에서 자동
리다이렉트로 이 경로에 도착하며, 컴포넌트는 기존대로 `parseInviteUrl()` 로 컨텍스트
를 복원해 미션을 시작한다.
