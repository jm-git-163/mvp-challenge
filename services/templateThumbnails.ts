/**
 * services/templateThumbnails.ts
 *
 * 템플릿 ID → 큐레이션 썸네일 URL.
 *
 * 2026-05-09: Pixabay /get/<hash>?...&t=<token> URL 은 토큰 만료로 며칠 만에 HTTP 400 으로
 *   깨지는 사례가 반복돼 13개 메인 챌린지를 **로컬 호스팅**으로 영구 전환.
 *   파일 위치: public/thumbs/<id>.jpg (640px), public/thumbs/<id>-1280.jpg (1280px).
 *   다운로드 스크립트: scripts/fetch-local-thumbs.js + scripts/refetch-thumbs.js.
 *   attribution: docs/ATTRIBUTIONS.md.
 *
 * 추가/보조 챌린지 (fitness-squat-001 외 5개) 는 기존 Unsplash CDN URL 유지 — Unsplash 는
 *   영구 호스팅이라 만료 이슈 없음.
 *
 * 갱신 규칙:
 *  - 새 템플릿 추가 시 위 스크립트에 ID·키워드 등록 → 실행 → 본 파일에 로컬 경로 병합.
 *  - 외부 Pixabay /get/... 토큰형 URL 은 절대 직접 참조 금지 (만료됨).
 *  - mockData.ts 의 thumbnail_url 은 폴백 체인이므로 변경 금지.
 */

export interface TemplateThumb {
  url: string;       // ~640px (썸네일 그리드용)
  largeURL: string;  // ~1280px (상세/로딩 시 풀화면용)
  tags: string;
  user: string;
  pixabayId: number; // Pixabay 0 = Unsplash 출처
}

// CACHE-BUST 2026-05-10: 사용자 폰 브라우저·SW 캐시가 옛 외부 URL 응답을 그대로 들고 있어
//   로컬 경로로 갱신해도 새 이미지가 안 보이는 케이스. 모든 url 끝에 ?v=BUILD 자동 부착해서
//   캐시 키 강제로 새로 만든다. 빌드마다 BUILD 값 갱신 시 한 줄만 bump.
const BUILD = '20260510-local';
const RAW_TEMPLATE_THUMBS: Record<string, TemplateThumb> = {
  // LOCAL 2026-05-09 — Pixabay search "smartphone gimbal coffee" (fallback). 카페·스마트폰 정물.
  "daily-vlog-001": {
    url: "/thumbs/daily-vlog-001.jpg",
    largeURL: "/thumbs/daily-vlog-001-1280.jpg",
    tags: "cafe, coffee, juice, cappuccino, food, smartphone, coffee mug, restaurant",
    user: "Pixabay/KIMDAEJEUNG",
    pixabayId: 5097128,
  },
  // LOCAL 2026-05-09 — Pixabay "newspaper microphone studio desk". 마이크·스튜디오 정물.
  "news-anchor-002": {
    url: "/thumbs/news-anchor-002.jpg",
    largeURL: "/thumbs/news-anchor-002-1280.jpg",
    tags: "studio, microphone, mic, recording, session, orchestra, cable, music",
    user: "Pixabay/MountainDweller",
    pixabayId: 9054709,
  },
  // LOCAL 2026-05-09 — Pixabay "english book dictionary alphabet". 사전 펼친 페이지.
  "english-lesson-003": {
    url: "/thumbs/english-lesson-003.jpg",
    largeURL: "/thumbs/english-lesson-003-1280.jpg",
    tags: "hallelujah, dictionary, page, light, book, paper, words, meaning, closeup",
    user: "Pixabay/InTellIGentFan",
    pixabayId: 6516410,
  },
  // LOCAL 2026-05-09 — Pixabay "fairy tale book pages illustration". 펼쳐진 동화책 정물.
  "fairy-tale-004": {
    url: "/thumbs/fairy-tale-004.jpg",
    largeURL: "/thumbs/fairy-tale-004-1280.jpg",
    tags: "open book, nostalgia, mood, literature, reading, library, vintage, novel, storytelling",
    user: "Pixabay/Ri_Ya",
    pixabayId: 7637805,
  },
  // LOCAL 2026-05-09 — Pixabay "eiffel tower paris". 에펠탑 + 지도 미니어처.
  "travel-cert-005": {
    url: "/thumbs/travel-cert-005.jpg",
    largeURL: "/thumbs/travel-cert-005-1280.jpg",
    tags: "eiffel tower, france, landmark, map, miniature, navigation, paris, travel, trip",
    user: "Pixabay/Pexels",
    pixabayId: 1839974,
  },
  // LOCAL 2026-05-09 — Pixabay "parcel unboxing tape" (fallback). 선물·소포 정물.
  "product-unbox-006": {
    url: "/thumbs/product-unbox-006.jpg",
    largeURL: "/thumbs/product-unbox-006-1280.jpg",
    tags: "christmas, gifts, surprise, decoration, package, parcel, ribbon",
    user: "Pixabay/Bru-nO",
    pixabayId: 7663699,
  },
  // LOCAL 2026-05-09 — Pixabay "concert stage lights neon". 네온 콘서트 무대.
  "kpop-idol-007": {
    url: "/thumbs/kpop-idol-007.jpg",
    largeURL: "/thumbs/kpop-idol-007-1280.jpg",
    tags: "wallpaper, microphone, smoke, concert, music, stage, light, neon light, illuminated, sound, nightlife, live",
    user: "Pixabay/Simoneph",
    pixabayId: 3272504,
  },
  // LOCAL 2026-05-09 — Pixabay "barbell weight gym". 바벨·역기 정물.
  "fitness-squat-master-008": {
    url: "/thumbs/fitness-squat-master-008.jpg",
    largeURL: "/thumbs/fitness-squat-master-008-1280.jpg",
    tags: "weightlifting, power, fitness, gym, workout, training, exercise, weight, strength",
    user: "Pixabay/TheDigitalArtist",
    pixabayId: 2427475,
  },
  // LOCAL 2026-05-09 — Pixabay "open dictionary book" (fallback). 펼친 책 + 커피.
  "english-speak-009": {
    url: "/thumbs/english-speak-009.jpg",
    largeURL: "/thumbs/english-speak-009-1280.jpg",
    tags: "leaves, coffee cup, coffee, cup, nature, still life, book, reading, leisure, hobby, open book, bookworm",
    user: "Pixabay/josealbafotos",
    pixabayId: 1076307,
  },
  // LOCAL 2026-05-09 — Pixabay "children illustration toy bear". 풀밭 위 테디베어.
  "kids-story-010": {
    url: "/thumbs/kids-story-010.jpg",
    largeURL: "/thumbs/kids-story-010-1280.jpg",
    tags: "teddy bear, bear, little bear, stuffed animal, teddy, cute, plush, cuddly toy, toy",
    user: "Pixabay/Alexas_Fotos",
    pixabayId: 797577,
  },
  // LOCAL 2026-05-09 — Pixabay "luggage suitcase passport map". 여행 가방 + 바다 합성.
  "travel-vlog-011": {
    url: "/thumbs/travel-vlog-011.jpg",
    largeURL: "/thumbs/travel-vlog-011-1280.jpg",
    tags: "fantasy, travel, vacations, suitcase, sea, beach, luggage, surreal, holiday plans",
    user: "Pixabay/Darkmoon_Art",
    pixabayId: 3502188,
  },
  // LOCAL 2026-05-09 — Pixabay "vintage microphone retro" (fallback). 빈티지 마이크 + 헤드폰.
  "hiphop-cypher-012": {
    url: "/thumbs/hiphop-cypher-012.jpg",
    largeURL: "/thumbs/hiphop-cypher-012-1280.jpg",
    tags: "microphone, headphones, radio, airwaves, audio, brown microphone, brown radio",
    user: "Pixabay/StockSnap",
    pixabayId: 2627991,
  },
  // REVIEWED 2026-04-23 — squat: Pixabay 결과는 다운워드 도그(요가, mismatch).
  //   Unsplash 의 실제 스쿼트 자세 사진으로 교체.
  "fitness-squat-001": {
    "url": "https://images.unsplash.com/photo-1567598508481-65985588e295?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1567598508481-65985588e295?auto=format&fit=crop&w=1280&q=80",
    "tags": "squat, legs, fitness, bodyweight, woman",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-04-23 (v4) — 사용자 "플랭크 썸네일 교체" 피드백.
  //   Unsplash 검증된 플랭크 사진 (photo-page subject: "woman executing plank on mat")
  //   HTTP 200 확인 · 2026-04-23.
  "fitness-plank-001": {
    "url": "https://images.unsplash.com/photo-1767611097425-87ceea79a3f0?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1767611097425-87ceea79a3f0?auto=format&fit=crop&w=1280&q=80",
    "tags": "plank, core, mat, fitness, hold, posture",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-04-23 — kpop dance: Pixabay 는 발레리나(mismatch).
  //   Unsplash 의 K-pop 안무/스튜디오 댄스 사진으로 교체. 핑크/퍼플 톤 우선.
  // REVIEWED 2026-04-23 (v6) — 사용자 3차 재교체 요청 "주제와 맞게 다시".
  //   Unsplash 검증 "group of people standing on stage" (photo MwYbVO00m6w).
  //   조명이 강조된 무대 위 그룹 — K-pop 콘서트 비주얼 매칭. HTTP 200 확인.
  "dance-kpop-001": {
    "url": "https://images.unsplash.com/photo-1620244822399-3e22cba4e628?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1620244822399-3e22cba4e628?auto=format&fit=crop&w=1280&q=80",
    "tags": "dance, kpop, stage, lights, group performance, concert",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-04-23 — meditation: 명상 자세 여성. OK (소프트 파스텔).
  // REVIEWED 2026-04-23 (v4) — 사용자 "명상 썸네일 교체" 피드백. 이전 Pixabay 해시 URL 400.
  //   Unsplash 검증 "woman doing yoga meditation" (HTTP 200).
  "meditation-001": {
    "url": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1280&q=80",
    "tags": "meditation, yoga, peaceful, woman, calm",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-04-23 — pushup: Pixabay 결과는 역기 드는 여성(mismatch, weightlifting).
  //   Unsplash 의 푸시업 자세 사진으로 교체.
  "fitness-pushup-001": {
    "url": "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=1280&q=80",
    "tags": "pushup, push-up, exercise, upper body, floor",
    "user": "unsplash",
    "pixabayId": 0
  },
  // LOCAL 2026-05-09 — Pixabay "graffiti wall street" (fallback). 자전거 + 그래피티 벽.
  "dance-hiphop-001": {
    url: "/thumbs/dance-hiphop-001.jpg",
    largeURL: "/thumbs/dance-hiphop-001-1280.jpg",
    tags: "bicycle, graffiti, art, wall art, paint, wall, vintage, street, background",
    user: "Pixabay/Engin_Akyurt",
    pixabayId: 3045580,
  },
  // REVIEWED 2026-04-23 — squat 50 challenge: Pixabay 는 트레드밀 스트레칭(mismatch).
  //   Unsplash 의 홈 스쿼트 챌린지 사진으로 교체.
  "fitness-squat-50": {
    "url": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1280&q=80",
    "tags": "squat, home workout, woman, challenge, fitness",
    "user": "unsplash",
    "pixabayId": 0
  }
} as const;

// CACHE-BUST: 모든 url/largeURL 끝에 ?v=BUILD 자동 부착. 외부 URL 은 ? 가 이미 있으면 &v= 로 합침.
function bust(u: string): string {
  if (!u) return u;
  if (u.startsWith('/')) {
    // 로컬 경로 — 단순 ?v= 부착
    return `${u}?v=${BUILD}`;
  }
  const sep = u.includes('?') ? '&' : '?';
  return `${u}${sep}v=${BUILD}`;
}

export const TEMPLATE_THUMBNAILS: Record<string, TemplateThumb> = Object.fromEntries(
  Object.entries(RAW_TEMPLATE_THUMBS).map(([k, v]) => [k, { ...v, url: bust(v.url), largeURL: bust(v.largeURL) }])
) as Record<string, TemplateThumb>;
