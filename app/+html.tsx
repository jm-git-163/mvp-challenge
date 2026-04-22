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
        <meta name="theme-color" content="#0b0d1a" />
        <meta name="color-scheme" content="dark" />

        <title>{TITLE}</title>
        <meta name="description" content={DESC} />

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
html, body, #root { height: 100%; background: #05060d; }
body {
  margin: 0;
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", "Apple SD Gothic Neo", "Malgun Gothic",
    "Noto Sans KR", Arial, sans-serif;
}
* { -webkit-tap-highlight-color: transparent; }

/* Global skeleton shimmer sweep (used by home loading placeholders) */
@keyframes skeletonSweep {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;
