# ASSET_CHECKLIST.md

Claude Code가 만들 수 없는(또는 만들면 품질이 부족한) 이미지·사운드 자산 목록. 사용자가 직접 교체.

## 🏷️ 공유 링크 카드 이미지 (우선순위 높음)

**현재 상태**: `public/og-cover.svg` 가 자동 생성된 플레이스홀더로 존재. Kakao / Facebook / Twitter / Discord / Slack 등 모두 SVG 를 파싱하지만, **Kakao 일부 구형 버전은 PNG 를 요구**.

**권장 교체**:
- 파일: `public/og-cover.png`
- 크기: **1200 × 630 px** (Open Graph 표준)
- 용량: 5 MB 미만, 300 KB 이하 권장
- 내용: 브랜드 로고 + "챌린지 스튜디오" + CTA 버튼 ("▶ 바로 도전") + 밝은 네온 그라디언트
- 제작 방법:
  1. `public/og-cover.svg` 를 크롬/사파리로 열고 개발자 도구에서 1200×630 캡처
  2. 또는 Figma / Canva 에서 1200×630 아트보드로 직접 제작
  3. 또는 AI 이미지 생성(Midjourney/DALL-E)으로 "vibrant neon Korean short-form challenge app cover, 1200x630"
- 교체 후 카카오 캐시 초기화: https://developers.kakao.com/tool/clear/og 에서 `https://mvp-ivory-kappa.vercel.app/` 초기화

PNG 가 있으면 `app/+html.tsx` 의 og:image 순서상 PNG 가 먼저 선택되므로 SVG 는 폴백으로 유지.

---

## 🎵 BGM

`public/bgm/*.mp3` — 현재 `.gitkeep` 만 있어 무음. 필요 시 로열티 프리 BGM(예: Artlist, Epidemic Sound) 구입해 교체.

## 🎬 Lottie / 스티커

`public/stickers/*.json` — `.gitkeep` 만. LottieFiles 에서 키워드 검색:
- 피트니스 템플릿: "squat counter neon", "dumbbell spark"
- K-POP 템플릿: "confetti burst", "beat pulse ring"
- 뉴스 템플릿: "headline ticker", "breaking news banner"

## 🖼️ 템플릿 배경

`public/bg/<template>/` — `.gitkeep` 만. Unsplash 나 직접 제작.
