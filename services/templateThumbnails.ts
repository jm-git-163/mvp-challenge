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

export const TEMPLATE_THUMBNAILS: Record<string, TemplateThumb> = {
  // REVIEWED 2026-04-23 (v5) — 사용자 "오늘의 브이로그 주제와 맞는거로 재교체" 피드백.
  //   Unsplash 검증 "Man filming himself live on smartphone" (photo onyMKLN7aow).
  //   실제 스마트폰으로 셀프 촬영하는 장면 — 브이로그 주제 정확 매칭. HTTP 200 확인.
  "daily-vlog-001": {
    "url": "https://images.unsplash.com/photo-1764162051244-1391c41122ac?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1764162051244-1391c41122ac?auto=format&fit=crop&w=1280&q=80",
    "tags": "vlog, selfie, phone, live, recording, self-filming",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-04-23 — news anchor: Pixabay 결과는 컨트리뮤직 스튜디오 마이크였음 (mismatch).
  //   Unsplash 의 뉴스 데스크/방송실 사진으로 교체. 차분한 블루 톤.
  "news-anchor-002": {
    "url": "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1280&q=80",
    "tags": "news, newspaper, journalism, broadcast, anchor, studio",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-04-23 — english lesson: 영어 사전·노트 정물. 수업 분위기 OK.
  "english-lesson-003": {
    "url": "https://pixabay.com/get/gb09de625816925bc07b4b525e166f418a6cbdfbf129fd16e899796529f43c0701fabe87dcb1c28376a8a1ed82cbc540a8c82cc92bf64fb1a87cf66dd88a25c20_640.jpg",
    "largeURL": "https://pixabay.com/get/gd1f5d894fe0a0e4a64cd4fd746aa62088342a6451d0a14c122d612f8ddd205cbacfd462a5d53827b22f127d689363b4d6f537569d1702a64899024bc7de6019e_1280.jpg",
    "tags": "education, language learning, english, dictionary, book, notes",
    "user": "akirEVarga",
    "pixabayId": 4382169
  },
  // REVIEWED 2026-04-23 — fairy tale: Pixabay 결과는 크리스마스 데스크탑 배경화면(mismatch).
  //   Unsplash 의 동화책/판타지 일러스트 톤 사진으로 교체. 따뜻한 색감.
  // REVIEWED 2026-04-23 (v5) — 사용자 "동화책읽기 주제와 맞는거로 재교체" 피드백.
  //   Unsplash 검증 "little girl sitting on the floor reading a book" (photo j8ms2KHBTag).
  //   바닥에 앉아 동화책 펼쳐 읽는 소녀 — 동화책 읽기 주제 정확 매칭. HTTP 200 확인.
  "fairy-tale-004": {
    "url": "https://images.unsplash.com/photo-1647621148693-720553a7b41e?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1647621148693-720553a7b41e?auto=format&fit=crop&w=1280&q=80",
    "tags": "fairy tale, child, girl, reading, storybook, floor, cozy",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-04-23 — travel cert: 앙코르와트 전경. 여행 인증샷 톤 OK.
  "travel-cert-005": {
    "url": "https://pixabay.com/get/g6571567ebd36cede014be5b68de1a5798ca272697828d0b34792a885a092eba5044056ed0d571720578d9f363b4b6c9ef9da6945f901ce8cc7eb6bd0c2c6bf24_640.jpg",
    "largeURL": "https://pixabay.com/get/g8b17c15708fdf11be10d3395e243987fff3380dbf2f64a56b51781bb8e068bcede9635dee30befaa6db53c1595723ed95ee7e827560abed6bbe42236ca7b8068_1280.jpg",
    "tags": "travel, temple, landmark, tourist, selfie",
    "user": "Sushuti",
    "pixabayId": 3741233
  },
  // REVIEWED 2026-04-23 — product unbox: 택배 상자. 언박싱 컨텍스트 OK.
  "product-unbox-006": {
    "url": "https://pixabay.com/get/ga7b47737a84b243cc653d4cace24dac0e6ad0ce58c81d34ef3304ee92e3ed15e4e074e57fdfc99e047b6ba9e836b6cab6f068e960786f4e4a9f7b3efbfb5a1fa_640.jpg",
    "largeURL": "https://pixabay.com/get/gbf0e1f5afba57fc0bee055c4443e0f7cba916dc536c3ba8188a1eba19a1e94720cfaf1d4c49ec45a6706fdee3aba89f899fad9283b26add9a717c785fc786723_1280.jpg",
    "tags": "package, parcel, box, unboxing, delivery",
    "user": "ha11ok",
    "pixabayId": 4967335
  },
  // REVIEWED 2026-04-23 — kpop idol: Pixabay 는 흑백 락밴드 공연(분위기 미스매치).
  //   Unsplash 의 네온 핑크/퍼플 콘서트 무대 사진으로 교체. K-pop 비주얼 매칭.
  "kpop-idol-007": {
    "url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1280&q=80",
    "tags": "concert, stage, neon, lights, idol, performance",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-04-23 (v4) — 사용자 "스쿼트 마스터 썸네일 교체" 피드백.
  //   Unsplash 검증된 바벨 스쿼트 사진 (photo-page subject: "man holding barbell gym")
  //   HTTP 200 확인 · 2026-04-23.
  "fitness-squat-master-008": {
    "url": "https://images.unsplash.com/photo-1683147779485-24912f480130?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1683147779485-24912f480130?auto=format&fit=crop&w=1280&q=80",
    "tags": "squat, barbell, strength, gym, fitness, master",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-04-23 — english speak: Pixabay 는 빈 칠판 정물(mismatch, 사람 없음).
  //   Unsplash 의 영어 회화 수업 장면으로 교체.
  "english-speak-009": {
    "url": "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1280&q=80",
    "tags": "classroom, students, speaking, english, education",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-04-23 — kids story: 책 읽는 아이들. OK.
  "kids-story-010": {
    "url": "https://pixabay.com/get/g156b9d4084ccd51f4d728c6bde76eccfe2450c2e33a0b5edd7a343450ddd2fa6089e2af4838d981d227270cf18ff91bfae032498f7da497f0cbfae59518f4140_640.jpg",
    "largeURL": "https://pixabay.com/get/g864d063ffb85829de4329a4b0f44161c605566853605170e566caee3187a733142b5041bd90cab46839e17682138a9e1b81b7ba8b384e33e0dbe4eb59915e705_1280.jpg",
    "tags": "children, books, reading, learning",
    "user": "ParentiPacek",
    "pixabayId": 4624899
  },
  // REVIEWED 2026-04-23 — travel vlog: 카메라 든 여성. OK (레트로 톤).
  "travel-vlog-011": {
    "url": "https://pixabay.com/get/g7262c809b4747347ac8e0df19d6767467d0b5ba551fae8c277e8b46aa6a651f7d749b9304f4322296b2869159572b8fe_640.jpg",
    "largeURL": "https://pixabay.com/get/gf953bab708f778a917d73ecfe90c7ad05073a75c666aaf21a89745088fd0ce03b8fc9b36f1004ef6999b3e7312e4000433f9a4902d29f4c650edea07bd53a0b1_1280.jpg",
    "tags": "girl, camera, travel, photographer",
    "user": "Alexsander-777",
    "pixabayId": 549154
  },
  // REVIEWED 2026-04-23 — hiphop cypher: 래퍼 마이크. OK.
  "hiphop-cypher-012": {
    "url": "https://pixabay.com/get/gc882e6ff8287d8a675b0b74ef0506fe28971529e68cc1f9a0d2dfd7e8cfaa9761a23d02dbdf59cc804c967d1578635a47f1d50b7a6753acc8c7f424965686ee5_640.jpg",
    "largeURL": "https://pixabay.com/get/g86084680e87e11843c96d1cacdba0d496be98a024e7038c132f91edc2738e56033bd71ad825fd23e31af1a4f882b26fcb344b16e14919cff7e2bfdbcd9d98167_1280.jpg",
    "tags": "rapper, microphone, recording, hip hop",
    "user": "Pexels",
    "pixabayId": 1845432
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
  // REVIEWED 2026-04-23 (v5) — 사용자 "k-pop댄스 주제와 맞는거로 재교체" 피드백.
  //   Unsplash 검증 "group of young men dancing on a stage" (photo 9kpsxy2k76g).
  //   무대 위 남성 그룹 댄스 퍼포먼스 — K-pop 댄스 주제 정확 매칭. HTTP 200 확인.
  "dance-kpop-001": {
    "url": "https://images.unsplash.com/photo-1729166240683-d571ede41f8b?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1729166240683-d571ede41f8b?auto=format&fit=crop&w=1280&q=80",
    "tags": "dance, performance, stage, kpop, boy group, young men",
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
  // REVIEWED 2026-04-23 — hiphop dance: 스트리트 힙합 댄서. OK.
  "dance-hiphop-001": {
    "url": "https://pixabay.com/get/g896004f4b1b6c23b29eb0391cf3a83aafb74156acb76cbfe541c3278f3a909df3b9bd8880565b884eb9c7751ae21bbc343ac27bd3e2f9ca3a4789a7e2b09006b_640.jpg",
    "largeURL": "https://pixabay.com/get/g8dd7a5a0058dc1fbe6934c91d67a3feea3519e732fe9795a8dcc13757b334ecf2f889a62e88c9c9f3139623565d58e47ee3464acc2ec35add38755216016e156_1280.jpg",
    "tags": "hip hop, dancer, street, urban",
    "user": "tazzanderson",
    "pixabayId": 2093990
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
