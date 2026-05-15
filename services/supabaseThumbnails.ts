/**
 * services/supabaseThumbnails.ts
 *
 * 자동 생성 — scripts/fetch-supabase-thumbnails.js 로 재생성.
 * 프로덕션 Supabase 의 실제 템플릿 UUID → Pixabay 큐레이션 이미지.
 * 홈 화면에서 최우선으로 사용.
 *
 * FIX-THUMBS v12 (2026-04-23): 이전 v11 까지 `?v=10/11` 쿼리 파라미터만 바꿨는데
 *   유저는 여전히 옛 이미지를 보는 보고. 근본 원인은 (a) Vercel Edge CDN 이 이 파일이
 *   속한 JS 번들을 캐싱 → 옛 번들이 옛 URL 을 리턴 혹은 (b) 일부 브라우저 HTTP 캐시 가
 *   Unsplash URL 을 쿼리 변화에도 재사용. 본 v12 는 (1) 모든 URL 을 runtime 에 BUILD_ID
 *   로 재구성 → 클라이언트가 받은 번들 해시에 종속되는 URL 로 만들고, (2) BUILD_ID
 *   자체를 빌드시마다 새 상수로 바꿔 강제 무효화한다.
 */

import type { TemplateThumb } from './templateThumbnails';

// FIX-THUMBS v12: 빌드마다 새 값. 배포 시 이 숫자를 bump 하면 전 사용자 캐시가 무효화.
const BUILD_ID = 'v12-20260423';

function bust(url: string): string {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  // 기존 cb=* 제거 후 재부착 (id-potent).
  const clean = url.replace(/([?&])cb=[^&]*/g, '$1').replace(/[?&]$/, '');
  const sep2 = clean.includes('?') ? '&' : '?';
  return `${clean}${sep2}cb=${BUILD_ID}`;
}

interface RawThumb {
  url: string;
  largeURL: string;
  tags: string;
  user: string;
  pixabayId: number;
}

const RAW: Record<string, RawThumb> = {
  "021ccc86-7d9f-41c0-88bd-970406bebd2e": {
    "url": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1280&q=80",
    "tags": "daily life, street, people, cafe, city",
    "user": "unsplash",
    "pixabayId": 0
  },
  "77756254-94ea-40a2-9c9e-b5c4257945cd": {
    "url": "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1280&q=80",
    "tags": "newspaper, news, print, broadcast",
    "user": "unsplash",
    "pixabayId": 0
  },
  "84592fbd-b1f2-4cc1-be02-0224284bcb98": {
    "url": "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1280&q=80",
    "tags": "english, books, study, classroom, learning",
    "user": "unsplash",
    "pixabayId": 0
  },
  "8e0b4493-5c5e-4ece-82dd-2ba93f9b8036": {
    "url": "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=1280&q=80",
    "tags": "teddy bear, plush toy, kids, fairy tale",
    "user": "unsplash",
    "pixabayId": 0
  },
  "4c3f1f85-ec15-48fd-a197-dc507ceb8400": {
    "url": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1280&q=80",
    "tags": "travel, tropical, beach, vacation, tourist",
    "user": "unsplash",
    "pixabayId": 0
  },
  "af337411-5b84-408a-b16a-e4fc04e78ebb": {
    "url": "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=1280&q=80",
    "tags": "gift box, present, wrapped, ribbon, unboxing",
    "user": "unsplash",
    "pixabayId": 0
  },
  "e2d9cc60-08c3-4200-86ba-3a7cdfa6ad54": {
    "url": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1280&q=80",
    "tags": "concert stage, lights, crowd silhouette, kpop vibe",
    "user": "unsplash",
    "pixabayId": 0
  },
  "981093f7-b455-4e48-82b2-6ce05850929a": {
    "url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1280&q=80",
    "tags": "food, plate, restaurant, review",
    "user": "unsplash",
    "pixabayId": 0
  },
  "5ccf6904-960f-4fa0-9af7-1dada6d598f7": {
    "url": "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1280&q=80",
    "tags": "speaker, stage, audience, motivation, keynote",
    "user": "unsplash",
    "pixabayId": 0
  },
  "9e766788-4591-41d8-9c96-13103f269a0b": {
    "url": "https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=1280&q=80",
    "tags": "tiktok, social viral, phone content, short form",
    "user": "unsplash",
    "pixabayId": 0
  }
};

// 런타임에 BUILD_ID 를 끼워넣어 export. URL 이 빌드마다 바뀌므로 React Native Image 가
// 이전 src 와 다르다고 판단 → 재요청 → 새 이미지. CDN 캐시도 우회.
export const SUPABASE_TEMPLATE_THUMBNAILS: Record<string, TemplateThumb> = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k, {
    ...v,
    url:      bust(v.url),
    largeURL: bust(v.largeURL),
  }]),
) as Record<string, TemplateThumb>;
