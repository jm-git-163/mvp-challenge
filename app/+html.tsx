/**
 * app/+html.tsx — web-only HTML document wrapper
 * Adds SEO/OG meta tags so shared links get rich previews.
 * Mobile (native) renders skip this file entirely.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const TITLE = '챌린지 스튜디오 — AI 챌린지 숏폼 제작';
const DESC  = '포즈 인식 + 리얼타임 판정 + 시네마틱 합성으로 만드는 AI 챌린지 쇼츠. K-POP·피트니스·뉴스 템플릿을 골라 바로 찍고 SNS에 공유하세요.';
const URL   = 'https://mvp-ivory-kappa.vercel.app';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* FIX-CACHE (2026-04-22): HTML 쉘 캐시 금지.
            Vercel edge 에서 Cache-Control 을 내려도 일부 모바일 브라우저(Safari, 일부 삼성인터넷)는
            meta httpEquiv 없이는 back/forward 캐시에서 꺼내 쓰는 경우가 있어 중복 방어. */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0F0A1F" />
        <meta name="color-scheme" content="dark" />

        <title>{TITLE}</title>
        <meta name="description" content={DESC} />

        {/* Gen-Z 리브랜드(2026-04-23): Pretendard Variable — CDN 경량 동적 서브셋.
            로컬 번들 추가 없이 한글 가변 폰트 즉시 적용. */}
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="챌린지 스튜디오" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESC} />
        <meta property="og:url" content={URL} />
        <meta property="og:locale" content="ko_KR" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESC} />

        {/* PWA hints */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="챌린지" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />

        <ScrollViewStyleReset />

        {/* Global web styles: no bounce/overflow, dark body bg for above-fold flashes */}
        <style dangerouslySetInnerHTML={{ __html: responsiveCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveCss = `
html, body, #root {
  height: 100%;
  background-color: #0F0A1F;
  background-image:
    radial-gradient(60% 40% at 12% 8%, rgba(255,61,127,0.32) 0%, rgba(255,61,127,0) 60%),
    radial-gradient(45% 35% at 92% 18%, rgba(0,229,255,0.26) 0%, rgba(0,229,255,0) 65%),
    radial-gradient(55% 45% at 78% 95%, rgba(198,255,0,0.18) 0%, rgba(198,255,0,0) 60%),
    radial-gradient(70% 60% at 30% 95%, rgba(139,92,246,0.30) 0%, rgba(139,92,246,0) 70%),
    linear-gradient(180deg, #150A28 0%, #0F0A1F 100%);
  background-attachment: fixed;
}

/* TEAM-UX (2026-04-23): 사용자 피드백 "배경이 너무 밝음" → 다크 모드 토글.
   <html class="motiq-dark"> 가 붙으면 네온 radial 제거하고 순수 딥 블랙으로.
   home 에 토글 버튼, localStorage('motiq_theme') 로 세션 영속. */
html.motiq-dark, html.motiq-dark body, html.motiq-dark #root {
  background-color: #050509 !important;
  background-image:
    radial-gradient(50% 40% at 15% 12%, rgba(255,61,127,0.08) 0%, rgba(255,61,127,0) 70%),
    radial-gradient(40% 35% at 88% 22%, rgba(0,229,255,0.06) 0%, rgba(0,229,255,0) 72%),
    linear-gradient(180deg, #07070C 0%, #050509 100%) !important;
}
/* TEAM-UX (2026-04-23): React Native Web 의 expo-router Tabs sceneContainer 가
   인라인 스타일로 흰/밝은 배경을 삽입하는 경우가 있어, 다크모드에서 html 배경을
   가림. 클래스 하위의 앱 루트 컨테이너도 강제로 투명 처리. */
html.motiq-dark #root > div,
html.motiq-dark #root > div > div {
  background-color: transparent !important;
}
body {
  margin: 0;
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  color: #FFFFFF;
  font-family: "Pretendard Variable", Pretendard, "Inter", -apple-system,
    BlinkMacSystemFont, "Segoe UI", Roboto, "Apple SD Gothic Neo",
    "Malgun Gothic", "Noto Sans KR", Arial, sans-serif;
  font-feature-settings: "ss01", "ss02", "cv11";
  letter-spacing: -0.01em;
}
* { -webkit-tap-highlight-color: transparent; }

/* Gen-Z gradient text helper (className="gz-grad-text") */
.gz-grad-text {
  background: linear-gradient(120deg, #FFE066 0%, #FF3D7F 50%, #00E5FF 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

/* Subtle wiggle for emoji badges */
@keyframes gzWiggle {
  0%,100% { transform: rotate(-4deg) scale(1); }
  50%     { transform: rotate(6deg)  scale(1.06); }
}

/* Global skeleton shimmer sweep (used by home loading placeholders) */
@keyframes skeletonSweep {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;
