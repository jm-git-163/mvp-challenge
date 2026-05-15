# 04 — 에셋 조달·저작권 리서치 (MotiQ)

> 작성: 2026-04-22 · 대상: MotiQ MVP (100% 클라이언트, 비수익 / CLAUDE §12)
> 기반 문서: `docs/PIXABAY_ASSETS.md` (FIX-Z25), `scripts/fetch-pixabay.node.ts` (스켈레톤)
> **주의**: WebSearch 권한이 차단되어 라이선스 세부 조항은 최신 원문으로 사용자가 교차 확인 필요. 본 문서의 라이선스 서술은 2025-말 기준 공개 정보를 종합한 것이며, 수익화 단계에서는 각 서비스의 현행 약관을 재검토해야 함.

---

## 0. 결론 (TL;DR)

- **추천 방식**: 옵션 B (빌드타임 스크립트) + 옵션 A(수동)를 하이브리드. 기본은 매니페스트 기반 `npm run fetch:assets` 로 재현성 확보, 라이선스 특수 자료(Freesound CC-BY 등)만 사람 손으로 검토.
- **오디오 주 공급원**: Pixabay Music > Mixkit > Uppbeat (저작권 안전·고지 최소).
- **이미지/아이콘**: Unsplash > Pixabay > OpenMoji/Twemoji (SVG emoji).
- **Lottie**: LottieFiles 에서 "Free License" 탭만. IconScout Free 는 개수 제한.
- **폰트**: Pretendard (OFL) 기본, 눈누 선별(상업용 허용만) 보조.
- **런타임 fetch 는 금지** (API 키 노출 + 녹화본 재현성 파괴).

---

## 1. 에셋 소스 카탈로그

### 1.1 오디오 (BGM · SFX)

| 서비스 | 라이선스 | API | 크레딧 의무 | 상업 | 한국 음원 | 비고 |
|---|---|---|---|---|---|---|
| **Pixabay Music** (pixabay.com/music) | Pixabay Content License | REST (`/api/`, 일 1만/분 100 여유) | 불필요 (권장) | ○ (현재) | 적음 | 재배포·단독재판매 금지. 주력 공급원 |
| **Mixkit** (mixkit.co) | Mixkit License | 없음 (HTML 스크래이핑 필요) | 불필요 | ○ | 거의 없음 | mp3 직링크, 스크립트화 가능 |
| **Bensound** | Bensound License (CC 유사) | 없음 | Free 플랜은 필요 | 유료 플랜만 순수 상업 | 없음 | MVP 에는 과함 |
| **Uppbeat** (uppbeat.io) | Uppbeat License | 없음 (계정 + 다운로드 토큰) | Free 플랜은 필요 | △ (YouTube 수익화 제한) | 일부 | 수익화 시 재검토 |
| **Freesound** | **CC0 / CC-BY / CC-BY-NC** 혼재 | REST + OAuth2 | **CC-BY 는 필수** (artist, URL, license) | 라이선스별 | 효과음 한국어 태그 적음 | SFX(박수, 알림, 히트) 보강용 |
| **YouTube Audio Library** | YouTube License / CC-BY | 없음 (수동 다운로드) | 일부 곡 필수 | ○ | 중간 | 자동화 불가 |
| **Chosic** (chosic.com) | CC-BY 재큐레이션 | 없음 | 원작자 크레딧 필수 | ○ | 없음 | Freesound 의 2차 디렉토리 |
| **Zapsplat** | Zapsplat Standard License | 없음 | Free 플랜은 필수 | △ | 없음 | SFX 보강 |
| **Fesliyan** | Fesliyan License | 없음 | 필요 | △ | 없음 | 수익화 시 제약 많음 |

**MotiQ 전략**: Pixabay Music 로 BGM 3종 확보(완료), SFX(비트 히트·카운트다운 삐·점수 치링) 는 Pixabay 우선, 부족하면 Freesound CC0 탭에서 보강.

### 1.2 이미지 / 배경 / 질감

| 서비스 | 라이선스 | API | 크레딧 | 상업 |
|---|---|---|---|---|
| **Unsplash** | Unsplash License | REST (앱 등록 필요, 50 req/h 기본) | 권장 (불필요) | ○ |
| **Pixabay Photos** | Pixabay Content License | 위와 동일 API | 불필요 | ○ |
| **Pexels** | Pexels License | REST (무료) | 권장 | ○ |
| **Public Domain Review** | PD (CC0) | 없음 | 불필요 | ○ |

MotiQ 는 카메라 프레이밍이 주력이라 배경 이미지는 보조용. `public/templates/news-anchor/studio.jpg` 같은 소수만 필요.

### 1.3 아이콘 · 스티커 · Emoji (SVG)

| 서비스 | 라이선스 | 배포 형태 | 비고 |
|---|---|---|---|
| **OpenMoji** | CC-BY-SA 4.0 | SVG/PNG 일괄 ZIP · npm `openmoji` | **크레딧 필수**. 스티커 주 공급원으로 유력 |
| **Twemoji** | CC-BY 4.0 (그래픽), MIT (코드) | npm `@twemoji/api` | 크레딧 필수. Twitter 스타일 |
| **Noto Emoji** | OFL / Apache 2.0 | Git · npm | 구글. 크레딧 의무 약함 |
| **Iconify** | 아이콘 세트별 상이 | `@iconify/json` | 세트마다 라이선스 개별 확인 |
| **SVGRepo** | 컬렉션별 상이 | 수동 다운로드 | 필터 필수 |
| **Lucide / Tabler Icons** | ISC / MIT | npm | UI 아이콘용 |

**권장**: AR 얼굴 스티커(토끼귀·하트·바이저) 는 **OpenMoji SVG 직접 편집** + 자체 SVG. Twemoji 는 `emoji-explosion` 템플릿의 파티클에 이상적.

### 1.4 Lottie 애니메이션

| 서비스 | 라이선스 | 배포 | 크레딧 |
|---|---|---|---|
| **LottieFiles** | 파일별 상이 — "Free License" 탭만 상업 허용 | JSON 다운로드 · API 有 | 일부 필수 |
| **IconScout Free** | 월 다운로드 개수 제한 | JSON | 플랜별 |
| **LordIcon Free** | Free 는 고지 필수 | Web Component / JSON | 필수 |

**주의**: LottieFiles 는 2024 년부터 크리에이터별 라이선스 세분화. 파일 상세 페이지의 "Free for personal and commercial use" 문구 있는 것만 사용. JSON 내 크레딧 태그를 파싱해 `ATTRIBUTIONS.md` 자동 생성 권장.

### 1.5 폰트

| 폰트 | 라이선스 | 장르 매핑 |
|---|---|---|
| **Pretendard** (OFL) | SIL OFL 1.1 | 기본 UI · 자막 (주력) |
| **Pretendard JP** (OFL) | 동일 | 일문 혼용 |
| **Paperlogy / 에스코어드림 / 프리텐다드** (눈누) | 개별 — 상업 허용만 선별 | 키네틱 텍스트 |
| **Gmarket Sans** (눈누) | 상업 허용 | 뉴스 앵커 hero |
| **Black Han Sans** (Google Fonts) | OFL | 강조 텍스트 |
| **Jua / Do Hyeon / Gugi** (Google Fonts) | OFL | 팝 / 이모지 템플릿 |
| **Orbitron / Audiowide** (Google Fonts) | OFL | 네온 아레나 SF |

**원칙**: Google Fonts 는 self-host (next/font 로컬) — 런타임 fonts.googleapis.com 호출 금지(§12 분석툴 차단 정책과 병행).

---

## 2. 통합 방식 3안 비교

| 항목 | A) 수동 | **B) 빌드타임** | C) 런타임 fetch |
|---|---|---|---|
| 재현성 | ✗ 드리프트 (FIX-Z8 선례) | ◎ 매니페스트 해시 검증 | △ 네트워크 의존 |
| 오프라인 동작 | ◎ | ◎ (다운로드 후) | ✗ |
| 번들 크기 | 동일 | 동일 | 0 (런타임 스트림) |
| API 키 노출 | 없음 | 로컬/CI secret | **브라우저 JS 노출** |
| CLAUDE §12 | ◎ | ◎ | △ (서버 전송 아님 but 외부 로그 가능) |
| 녹화본 재현 | ◎ | ◎ | ✗ 촬영 중 네트워크 실패시 레이어 누락 |
| 라이선스 추적 | 수동 | 매니페스트→`ATTRIBUTIONS.md` 자동 | 런타임 API 응답에서 추출 (불안정) |
| 신규 에셋 추가 비용 | 파일 복사 | JSON 한 줄 | 런타임 fetch 코드 수정 |
| CI 소요 시간 | 0 | 다운로드 캐시(현행 Vercel) | 0 |

**C 는 금지 결정**. A/B 하이브리드로.

---

## 3. 추천안 (하이브리드)

### 3.1 기본 (옵션 B)
- `assets/manifest.json` 에 BGM · SFX · 스티커 · Lottie · 이미지 전부 선언.
- `scripts/fetch-assets.node.ts` (기존 `fetch-pixabay.node.ts` 확장) 가 매니페스트를 읽어 API 호출 + SHA256 검증 + `public/` 배치.
- 같은 스크립트가 `docs/ATTRIBUTIONS.md` 자동 생성.
- `.env.local` 에 `PIXABAY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `FREESOUND_TOKEN` 배치. `.gitignore` 이미 설정.

### 3.2 예외 (옵션 A)
- Freesound CC-BY 트랙: OAuth2 토큰 발급 + 크레딧 의무 때문에 수동 리뷰 → 매니페스트에 수기 추가.
- 직접 제작 SVG(회사 로고·가상 캐릭터) 는 `public/` 에 바로.

### 3.3 근거
1. 재현성 (git clone → npm run fetch:assets → 빌드 가능).
2. API 키가 클라이언트 번들에 절대 포함되지 않음.
3. 라이선스 감사 흔적(manifest + ATTRIBUTIONS.md) 이 자동화.
4. CLAUDE §12 준수: 런타임 외부 호출 0.

---

## 4. 매니페스트 스키마 제안

`assets/manifest.json`:

```json
{
  "$schema": "./manifest.schema.json",
  "version": "1.0.0",
  "generated": "2026-04-22T00:00:00Z",
  "entries": [
    {
      "id": "bgm.neon-arena.main",
      "kind": "bgm",
      "provider": "pixabay",
      "source": { "type": "pixabay-api", "query": "synthwave cyberpunk 128 bpm", "id": 123456 },
      "url": "https://cdn.pixabay.com/download/audio/2024/.../synthwave.mp3",
      "target": "public/bgm/synthwave-128.mp3",
      "sha256": "ab12...",
      "license": { "id": "pixabay-content", "version": "2024", "commercial": true, "requires_attribution": false },
      "attribution": { "author": "PixabayUser", "source_url": "https://pixabay.com/music/...", "title": "Synthwave 128" },
      "meta": { "bpm": 128, "duration_s": 45, "genre": "neon_cyberpunk" }
    },
    {
      "id": "sfx.hit.punch",
      "kind": "sfx",
      "provider": "freesound",
      "source": { "type": "freesound-api", "id": 789012 },
      "url": "https://freesound.org/apiv2/sounds/789012/download/",
      "target": "public/sfx/punch.mp3",
      "sha256": "cd34...",
      "license": { "id": "cc-by-4.0", "commercial": true, "requires_attribution": true },
      "attribution": { "author": "fs_user", "source_url": "https://freesound.org/s/789012/" }
    },
    {
      "id": "lottie.confetti",
      "kind": "lottie",
      "provider": "lottiefiles",
      "source": { "type": "direct", "id": "gh/...confetti.json" },
      "url": "https://lottie.host/....json",
      "target": "public/lottie/confetti.json",
      "sha256": "ef56...",
      "license": { "id": "lottiefiles-free", "commercial": true, "requires_attribution": false }
    }
  ]
}
```

**강제 필드**: `id`, `kind`, `target`, `sha256`, `license.id`, `license.commercial`.
**zod 스키마**: `assets/schema.ts` 에 정의. 템플릿 zod 스키마(§ CLAUDE 4.6) 와 동일 패턴.

---

## 5. 저작권 고지 자동화 설계

### 5.1 파일
`docs/ATTRIBUTIONS.md` — 스크립트 생성, 수기 편집 금지 (상단 배너).

### 5.2 생성 규칙
```
require_attribution === true  → 별도 섹션, 필수
commercial === false           → 에러 throw (MVP 는 상업 호환만)
source_url 누락                → 에러
```

### 5.3 앱 내 노출
- `/about` 페이지에 `<AttributionsList/>` 컴포넌트 (정적 MD → MDX 임포트).
- 결과 페이지 공유 모달 하단에 "음원·비주얼 크레딧" 링크.
- 영상 워터마크는 선택 (CC-BY 는 대부분 문서 고지로 충분. 일부 Freesound 저자는 영상 내 고지 요구 → 매니페스트 `license.requires_video_credit: true` 플래그로 처리).

### 5.4 검증
- `npm run lint:attributions` 가 `public/` 실파일과 매니페스트 차집합이 0 인지 확인.
- CI 에 병합 (이미 `scripts/lint-routes.js` 유사 패턴).

---

## 6. 번들 크기 · 배포 고려

### 6.1 예산
- Vercel 정적 파일 개당 한도(실측 최근 250 MB 초과 시 경고, 이론상 더 큼) — BGM 은 문제 없음.
- **총 `public/` 목표 50 MB 이내** (첫 방문 SW 프리캐시 상한).
- BGM: 한 곡 45 초 · 128 kbps ≈ 0.7 MB, 3 곡 = 2 MB.
- SFX: 개당 < 50 KB, 20 개 = 1 MB.
- Lottie: 개당 30–200 KB, 15 개 = 2 MB.
- 이미지: 템플릿 배경 3 장 · WebP = 1 MB.
- 폰트: Pretendard subset(한글 KS + ASCII) 2 weights × 200 KB = 400 KB.
- **합계 ≈ 7 MB** — 여유 충분.

### 6.2 LFS / 외부 CDN 옵션
- 현재 규모에서는 **LFS 불필요**. git blob 에 그대로.
- 외부 CDN(pixabay 직접링크) 참조는 CLAUDE §12 위반 여지 + 링크 만료 위험 → **금지**.
- 미래 영상 에셋(100 MB +) 도입 시 jsDelivr 경유 npm 패키지화 검토.

### 6.3 자동 갱신 (선택)
GitHub Actions 예시:
```yaml
name: refresh-assets
on: { workflow_dispatch: {} }
jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run fetch:assets
        env:
          PIXABAY_API_KEY: ${{ secrets.PIXABAY_API_KEY }}
          FREESOUND_TOKEN: ${{ secrets.FREESOUND_TOKEN }}
      - uses: peter-evans/create-pull-request@v6
        with: { title: "chore: refresh assets", branch: chore/refresh-assets }
```
수동 트리거. 자동 머지 금지 (라이선스 시각 검토 필요).

---

## 7. 리스크 · 오픈 질문

1. **Freesound OAuth2 빌드 자동화**: 토큰 만료(24h)로 CI 에서 재발급 플로우 필요. 장기 Client Credentials 미제공. → 수동 다운로드 후 매니페스트 기입이 현실적.
2. **LottieFiles 라이선스 페이지 스크래이핑 금지** → JSON 메타의 `author` 만으로는 상업 가능 여부 판별 불가. 사용자가 다운로드 시점에 "Free / Commercial" 배지 확인 후 매니페스트 `license.id: "lottiefiles-free"` 기입하는 절차로.
3. **수익화 전환 시**: Pixabay Content License 가 "너무 유사한 플랫폼의 경쟁" 조항을 포함 — 숏폼 생성 SaaS 로 확장하면 재검토 필요.
4. **특허(10-2025-02049151) 와의 관계**: 에셋 라이선스는 특허 청구범위와 무관. 별도 이슈.

---

## 8. 다음 작업 (문서 범위 외 제안)

- `assets/manifest.json` 초기화 + zod 스키마 (구현은 별도 세션).
- `scripts/fetch-pixabay.node.ts` → `scripts/fetch-assets.node.ts` 로 확장 (Unsplash·Freesound 프로바이더 추가).
- `docs/ATTRIBUTIONS.md` 자동 생성기 + `lint:attributions` 체크.
- `/about` 페이지에 크레딧 노출 UI.

끝.
