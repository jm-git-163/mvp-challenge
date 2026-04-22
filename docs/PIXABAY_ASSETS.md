# PIXABAY_ASSETS.md — 에셋 수급 전략 (FIX-Z25, 2026-04-22)

사용자 질문: **"Pixabay mp3·이미지 내가 넣어야 하는지, 네가 API 로 가져올 수 있는지 검토"**.

Pixabay 공개 API (https://pixabay.com/api/docs/) 는 무료 API 키 발급 후 JSON 으로 이미지/비디오/음원 메타를 반환한다. MotiQ 에 어떻게 결합할지 세 가지 방식을 비교한다.

---

## 옵션 1 — 유저 수동 다운로드 (현재 방식)

**작동 방식**: 사용자가 Pixabay 웹에서 파일을 직접 받아 `public/bgm/`·`public/stickers/` 에 배치. 파일명은 템플릿의 `src` 와 일치시켜야 함.

| 항목 | 평가 |
|---|---|
| 재현성 | ✗ 파일명·버전 드리프트 (실제로 FIX-Z8 에서 `news-orchestra-90.mp3` 부재로 장애 발생) |
| CI/빌드 | ○ 외부 의존 없음 |
| API 키 | ○ 불필요 |
| 저작권 | ○ Pixabay License 명시, 별도 기록은 수작업 |
| 자동화 | ✗ 새 기기에서 git clone 만으로 재현 불가 |

**필요 파일 목록 (현재 템플릿 기준)**:

| 경로 | 내용 | Pixabay 검색어 |
|---|---|---|
| `public/bgm/synthwave-128.wav` | neon-arena BGM 128 BPM | `synthwave cyberpunk 128 bpm` |
| `public/bgm/atlasaudio-jazz-490623.mp3` | news-anchor BGM | `jazz news orchestra` |
| `public/bgm/backgroundmusicforvideos-no-copyright-music-334863.mp3` | emoji-explosion BGM | `kpop upbeat pop` |
| `public/templates/news-anchor/studio.jpg` | 뉴스 스튜디오 배경 | `news studio blue` |
| `public/templates/news-anchor/logo.png` | 로고 | (직접 제작/무관) |
| `public/stickers/cyber-visor.svg` | AR 바이저 | (SVG 직접 제작) |
| `public/stickers/rabbit-ears.svg` | AR 토끼귀 | (SVG 직접 제작) |

---

## 옵션 2 — 빌드타임 스크립트 (**추천**)

**작동 방식**: `scripts/fetch-pixabay.node.ts` 에서 Pixabay REST API 호출 → mp3/이미지 다운로드 → `public/bgm/` 에 저장 → 수동으로 git 커밋. 트리거는 `npm run fetch:assets`. API 키는 `.env.local` 의 `PIXABAY_API_KEY`. `.env.local` 은 `.gitignore` 처리.

| 항목 | 평가 |
|---|---|
| 재현성 | ○ 매니페스트 (query, min_duration, license) 가 스크립트에 박힘 |
| CI/빌드 | ○ 런타임엔 영향 0, 빌드 파이프라인 수정 불필요 |
| API 키 | △ 개발자 로컬에만 필요 (클라이언트 번들 노출 0) |
| 저작권 | ○ API 응답의 `pageURL`·`user` 를 `ATTRIBUTIONS.md` 로 자동 생성 가능 |
| 자동화 | ○ 신규 템플릿 추가 시 매니페스트 한 줄만 추가 |

**단점**:
- 사용자가 최초 한 번은 Pixabay 가입 & API 키 발급 필요.
- Pixabay API 는 월 5,000 요청 제한 (무료 플랜). 개발 용도엔 충분.

---

## 옵션 3 — 런타임 fetch (비권장)

**작동 방식**: 클라이언트(브라우저)에서 Pixabay API 를 직접 호출.

| 항목 | 평가 |
|---|---|
| API 키 번들 노출 | ✗ 브라우저 JS 에 박힘 → 키 크롤링 위험 |
| CLAUDE §12 준수 | △ 외부 GET 은 "서버 전송/업로드" 아니지만, 분석툴에 근접 |
| 네트워크 의존 | ✗ 오프라인에서 에셋 로드 실패 |
| CDN 캐시 | ✗ Pixabay 이미지 CDN 은 브라우저 캐시에만 의존 |
| 녹화본 재현 | ✗ 촬영 시점 네트워크 실패 시 배경 누락 |

**결론**: 사용하지 말 것.

---

## 추천: 옵션 2

**이유**
1. 재현성: 스크립트 하나가 모든 에셋을 관리. 팀원이 바뀌어도 `npm run fetch:assets` 한 줄.
2. 클라이언트 번들 안전: API 키가 브라우저에 내려가지 않음.
3. 저작권 투명성: 자동 ATTRIBUTIONS.md 생성 가능.
4. CLAUDE §12 (서버 전송 금지) 준수: 빌드타임 외부 GET 은 "사용자 데이터의 서버 전송" 과 무관.

**스켈레톤**: `scripts/fetch-pixabay.node.ts` — 현재는 매니페스트만 정의, 실제 다운로드 로직은 사용자가 API 키를 넣고 `node --import tsx scripts/fetch-pixabay.node.ts` 로 실행.

```bash
# 사용자 절차 (권장)
cp .env.local.example .env.local
echo "PIXABAY_API_KEY=xxxxx" >> .env.local
npm run fetch:assets
git add public/bgm/ public/images/ ATTRIBUTIONS.md
git commit -m "chore: refresh Pixabay assets"
```

---

## 저작권 주의

Pixabay License (2024) 는 Content License 와 Simplified Pixabay License 이중. 음악 상업적 사용엔 "Pixabay Content License" 확인 필수. 공무원 휴직 중 비수익 MVP (CLAUDE §12) 범위 내라면 문제 없지만, 장래 수익화 시 트랙별 라이선스 재검토 필요.
