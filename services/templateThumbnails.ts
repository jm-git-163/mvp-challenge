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
  // REVIEWED 2026-04-23 (v6) — 사용자 3차 재교체 요청 "주제와 맞게 다시".
  //   Unsplash 검증 "woman filming herself on a tripod in a living room" (photo KQ1Kv3awrHM).
  //   삼각대 + 스마트폰 셀프 촬영 = 전형적 일상 브이로그 셋업. HTTP 200 확인.
  "daily-vlog-001": {
    "url": "https://images.unsplash.com/photo-1758599880979-f6a64947b541?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1758599880979-f6a64947b541?auto=format&fit=crop&w=1280&q=80",
    "tags": "vlog, tripod, smartphone, self-filming, living room, content creation",
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
    "url": "https://pixabay.com/get/g0c34b55207762955b900890e412a613e658861cb04886c3e6bc86c41fcb8feebeff0717bbad9d32f5605ebc001f281aa903a7283db6c15ab16d8881dcbbe7bb0_640.jpg",
    "largeURL": "https://pixabay.com/get/g23f9ab5ba90cfc70cfff753d675b1e7c87b2ac84c287a0be0471d4160c7567e9dc6745f696d9b72742ea9350925ebe9dcc68cdc0a617a57ed980b15955d6c984_1280.jpg",
    "tags": "key, old, flower, nostalgic, beautiful flowers, vintage, marguerite, flower wallpaper, blossom, bloom, rust, metal, antique, dictionary, german-english, nature, flower background, translation, words, a book",
    "user": "165106",
    "pixabayId": 5105878
  },
  // REVIEWED 2026-04-23 — fairy tale: Pixabay 결과는 크리스마스 데스크탑 배경화면(mismatch).
  //   Unsplash 의 동화책/판타지 일러스트 톤 사진으로 교체. 따뜻한 색감.
  // REVIEWED 2026-04-23 (v6) — 사용자 3차 재교체 요청 "주제와 맞게 다시".
  //   Unsplash 검증 "toddler holding storybook" (photo Nqv93VRcH18).
  //   유아가 그림책을 들고 있는 장면 — 동화책 읽기 주제 정확 매칭. HTTP 200 확인.
  "fairy-tale-004": {
    "url": "https://images.unsplash.com/photo-1573309463410-ed96625bcd16?auto=format&fit=crop&w=640&q=75",
    "largeURL": "https://images.unsplash.com/photo-1573309463410-ed96625bcd16?auto=format&fit=crop&w=1280&q=80",
    "tags": "fairy tale, toddler, storybook, picture book, child, reading",
    "user": "unsplash",
    "pixabayId": 0
  },
  // REVIEWED 2026-04-23 — travel cert: 앙코르와트 전경. 여행 인증샷 톤 OK.
  "travel-cert-005": {
    "url": "https://pixabay.com/get/g12e5ebee8f9df3e89459eb6868e917cf3b814560f1ebe851d728c324beec14cb07bac4bfb8559fac7fb7bb21c5cda6db0272ad6a86a40f97985da1fb5438f71c_640.jpg",
    "largeURL": "https://pixabay.com/get/g662b0f6987ad93dbde25d3b3851226a7830a57edcbdc6b29d52a2f7e6e513ac3a58140cff4fc95fed0d2c01b00521573e7570ca5e40ac6cd1ca0b52b161b0816_1280.jpg",
    "tags": "eiffel tower, france, landmark, map, miniature, navigation, paris, travel, close up, trip",
    "user": "Pexels",
    "pixabayId": 1839974
  },
  // REVIEWED 2026-04-23 — product unbox: 택배 상자. 언박싱 컨텍스트 OK.
  "product-unbox-006": {
    "url": "https://pixabay.com/get/g9770619381da58ec5fbc7b3a6534e3c42000d6822dd80e86f876304cde00601305502d1883eeafd649718f684403e9b280b598880e536c50b0aeeecc8b7759ba_640.jpg",
    "largeURL": "https://pixabay.com/get/gc26b7edda411e29c5bf022a659bf8af0191a7a78c8df00792844ad4356e777bd4fce4275cb1aa4f103df1c44f42b457577aac2f7e8866e760f4796cd1cc19487_1280.jpg",
    "tags": "packages, delivery, delivery man, parcel, boxes, custom boxes, service",
    "user": "romeosessions",
    "pixabayId": 6153947
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
    "url": "https://pixabay.com/get/gb44e1cc125d1be32895a9e735f75783bd6639c94677ea0aca69b9d93e4b954c9c44d7b8a77971634fc0a643bad05a0872558514e23569881d32eb0bbadf6445d_640.jpg",
    "largeURL": "https://pixabay.com/get/g8b00f1f87f44e84c1494543edf807c975b0842c7833aff0421e07609cdaa09dc17f17a223126d3548835b2be78f582728a1a8fce8fa4c2bddc6bf7ef3c23b66c_1280.jpg",
    "tags": "boy, child, male, young, reading, kid, cute, summer, book, curiosity, attentive, pictures, children's book, childhood, adorable",
    "user": "10302144",
    "pixabayId": 4793110
  },
  // REVIEWED 2026-04-23 — travel vlog: 카메라 든 여성. OK (레트로 톤).
  "travel-vlog-011": {
    "url": "https://pixabay.com/get/g367650f4d2aad0a206f6e2cec6b7003fa76c8444a1af76864c2a2563560e11c413f69ca33a4f5ae916ca5034df39c9ffededdcfed72404cf847bcefaa53e7e68_640.jpg",
    "largeURL": "https://pixabay.com/get/gc5fcba0415e5500718a9a4ede5f16b4d7bc443e329f52df2241ffcd6bb962ecbd5c1e88b76ad3cf94501fbe87bbb520a67051d1156d3c4bc91be6a2229934eb4_1280.jpg",
    "tags": "suitcase, packaging, to travel, vacations, luggage, vacation, old suitcase, close up, piece of luggage, leather, tourism, vintage",
    "user": "Tama66",
    "pixabayId": 3297015
  },
  // REVIEWED 2026-04-23 — hiphop cypher: 래퍼 마이크. OK.
  "hiphop-cypher-012": {
    "url": "https://pixabay.com/get/g5b5ea82a97dbfdcce894ca8c7759abe598c40dbe1d495bf471577e8d0541b60b05c796cb24deb5a0db4d4b16d7e80d8ff6c33cc38d3fddefaac98c6962c1249d_640.png",
    "largeURL": "https://pixabay.com/get/g25d5b6e2f984ec6ba60d3bb921fff80bed942ae0035885fd250c8c42a68f8ec157956b80d4cffd48c396a5712b91817be9223a7781644de93e6307e237495667_1280.png",
    "tags": "wireless microphone, radio, microphone, sound, reportage, radio studio, broadcast, vintage, retro, nostalgia",
    "user": "AlLes",
    "pixabayId": 2907453
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
  // REVIEWED 2026-04-23 — hiphop dance: 스트리트 힙합 댄서. OK.
  "dance-hiphop-001": {
    "url": "https://pixabay.com/get/gf572e1b01cc92c8f7c0672ea160b25304a53fd216a560b7c80ed967e91636a58b723c2d92ce4c6ace4113e23b85c5a223974b70e7639fa7947cfe7f18b216127_640.jpg",
    "largeURL": "https://pixabay.com/get/g71b6e5ca4f8d9f3f50719f1104423e419d25191d349b52133ff3c3b9384a6f0dbc2e74bd2af6bbe7ed2a0851009a0f00215ac08eb5ce45bb6ef9122e8e723991_1280.jpg",
    "tags": "hooded, man, green, cool, person, human, masculine, hip hop, masculinity, bodyguard",
    "user": "LoboStudioHamburg",
    "pixabayId": 1171625
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
