/**
 * services/templateThumbnails.ts
 *
 * 템플릿 ID → 큐레이션 썸네일 URL.
 * Pixabay 자동 수집본을 베이스로, 주제와 어긋나는 항목은 Unsplash CDN URL 로 교체.
 * Unsplash 는 API 키 불필요·크레딧 불필요 (Unsplash License).
 * Pixabay 는 자동 수집(scripts/fetch-pixabay-thumbnails.js)이 키워드 매칭 오류로
 * 잘못된 사진을 가져올 수 있어 본 파일을 단일 진실 소스로 운영.
 *
 * 마지막 감사(audit): 2026-04-23. 각 항목 // REVIEWED 2026-04-23 주석 참조.
 *
 * 갱신 규칙:
 *  - Pixabay 재수집 후에도 본 파일에 손으로 검토한 URL 이 우선.
 *  - 새 템플릿 추가 시: scripts/fetch-pixabay-thumbnails.js 키워드 등록 → 실행 →
 *    결과를 사람이 검수 후 본 파일에 병합 (mismatch 발견 시 Unsplash 로 교체).
 *  - mockData.ts 의 thumbnail_url 은 폴백 체인이므로 변경 금지.
 */

export interface TemplateThumb {
  url: string;       // ~640px (썸네일 그리드용)
  largeURL: string;  // ~1280px (상세/로딩 시 풀화면용)
  tags: string;
  user: string;
  pixabayId: number; // Pixabay 0 = Unsplash 출처
}

// FIX-THUMBS v13 (2026-05-02): 사용자 재제보 — 옛 썸네일이 다시 보이는 문제. v12 이후
//   본 파일에 변경이 없었음에도 CDN/HTTP 캐시가 옛 응답을 재사용했을 가능성. supabaseThumbnails
//   와 동일한 BUILD_ID cache-bust 메커니즘을 본 파일에도 신규 적용.
const BUILD_ID = 'v14-20260502-curated';
function bustUrl(url: string): string {
  if (!url) return url;
  const clean = url.replace(/([?&])cb=[^&]*/g, '$1').replace(/[?&]$/, '');
  const sep = clean.includes('?') ? '&' : '?';
  return `${clean}${sep}cb=${BUILD_ID}`;
}

const RAW_TEMPLATE_THUMBNAILS: Record<string, TemplateThumb> = {
  // REVIEWED 2026-05-02 (v14) — 사용자 재제보 "사람 이상함". 사람 없는 정물로 안전 큐레이션.
  //   카메라/렌즈/장비 정물 — 일상 브이로그 셋업. HTTP 200 확인.
  "daily-vlog-001": {
    "url": "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?auto=format&fit=crop&w=1280&q=80",
    "tags": "vlog gear, camera, content creation, setup, lifestyle",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-05-02 (v14) — 신문/저널리즘 정물. 차분한 블루 톤. HTTP 200 확인.
  "news-anchor-002": {
    "url": "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1280&q=80",
    "tags": "news, newspaper, journalism, broadcast, anchor, studio",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-05-02 (v14) — 사용자 제보 "썸네일 없음". Pixabay 해시 URL 만료.
  //   Unsplash 영어 책/사전 정물로 교체. HTTP 200 확인.
  "english-lesson-003": {
    "url": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1280&q=80",
    "tags": "english, dictionary, book, study, language learning",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-05-02 (v14) — 사용자 제보 "방향 이상". 토들러 들고 있는 회전된 책 사진 → 사람 없는
  //   펼쳐진 컬러풀한 동화책 정면 평면 촬영으로 교체. HTTP 200 확인.
  "fairy-tale-004": {
    "url": "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1280&q=80",
    "tags": "open book, storybook, pages, reading, library",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-05-02 (v14) — 사용자 제보 "썸네일 없음". Pixabay URL 만료.
  //   에펠탑 랜드마크 (사람 없는 풍경) 으로 교체. HTTP 200 확인.
  "travel-cert-005": {
    "url": "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1280&q=80",
    "tags": "eiffel tower, paris, landmark, travel, certification",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-05-02 (v14) — 사용자 제보 "썸네일 없음". Pixabay URL 만료.
  //   깨끗한 박스/패키지 정물로 교체. HTTP 200 확인.
  "product-unbox-006": {
    "url": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1280&q=80",
    "tags": "package, box, parcel, unboxing, delivery",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-05-02 (v14) — 사용자 제보 "손이 이상". 사람 손/얼굴 없는
  //   콘서트 홀 무대 조명 실루엣으로 교체. HTTP 200 확인.
  "kpop-idol-007": {
    "url": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1280&q=80",
    "tags": "concert hall, stage lights, performance, idol, kpop",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-05-02 (v14) — 사용자 제보 "스쿼트 이미지 아님". 실제 사람이 바벨 스쿼트 자세.
  //   HTTP 200 확인.
  "fitness-squat-master-008": {
    "url": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=1280&q=80",
    "tags": "squat, barbell, gym, strength training, fitness",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-05-02 (v14) — 영어 회화 정물 (지구본·책·노트). 사람 없음. HTTP 200 확인.
  "english-speak-009": {
    "url": "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1280&q=80",
    "tags": "globe, books, english, conversation, learning",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-05-02 (v14) — 사용자 제보 "썸네일 없음". Pixabay URL 만료.
  //   어린이 동화 일러스트 톤 정물 (책장에 펼쳐진 동화책). HTTP 200 확인.
  "kids-story-010": {
    "url": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1280&q=80",
    "tags": "children, books, fairy tale, library, kids story",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-05-02 (v14) — 사용자 제보 "썸네일 없음". Pixabay URL 만료.
  //   캐리어/지도/카메라 정물 (사람 없는 여행 셋업). HTTP 200 확인.
  "travel-vlog-011": {
    "url": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1280&q=80",
    "tags": "suitcase, travel, map, camera, vlog",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-05-02 (v14) — 사용자 제보 "썸네일 없음". Pixabay URL 만료.
  //   빈티지 마이크 정물 (힙합 사이퍼 레코딩 톤). 사람 없음. HTTP 200 확인.
  "hiphop-cypher-012": {
    "url": "https://images.unsplash.com/photo-1453738773917-9c3eff1db985?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1453738773917-9c3eff1db985?auto=format&fit=crop&w=1280&q=80",
    "tags": "microphone, vintage, hip hop, cypher, recording",
    "user": "unsplash",
    "pixabayId": 0
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
  // REVIEWED 2026-05-02 (v14) — 사용자 제보 "썸네일 없음". Pixabay URL 만료.
  //   힙합 댄서 스트리트 (자연스러운 동작, 손 부자연 없음). HTTP 200 확인.
  "dance-hiphop-001": {
    "url": "https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=1280&q=80",
    "tags": "hip hop, dance, street, urban, choreography",
    "user": "unsplash",
    "pixabayId": 0
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
};

// 런타임에 BUILD_ID cache-bust 를 끼워 export. 빌드/배포마다 URL 이 바뀌므로 RN Image /
// HTML <img> 모두 새 src 로 인식 → 재요청 → 새 이미지. CDN HTTP 캐시도 우회.
export const TEMPLATE_THUMBNAILS: Record<string, TemplateThumb> = Object.fromEntries(
  Object.entries(RAW_TEMPLATE_THUMBNAILS).map(([k, v]) => [k, {
    ...v,
    url:      bustUrl(v.url),
    largeURL: bustUrl(v.largeURL),
  }]),
);
