# 03. 템플릿 비주얼 재디자인 연구

> 작성일 2026-04-22. 대상: `data/templates/neon-arena.ts`, `news-anchor.ts`, `emoji-explosion.ts`.
> 사용자 피드백 3건 해결을 위한 설계 문서.
>
> **피드백 요약**
> 1. 스쿼트 템플릿에서 몸이 "동그란 구멍(hexagon)" 안에만 나와 운동 활동 체크가 어렵다.
> 2. 3개 템플릿이 같은 레이어를 반복해서 주제만 갈아끼운 느낌이 강하다.
> 3. 챌린지 주제와 무관한 자막이 **얼굴 정면**을 가린다.

---

## 1. 현 3개 템플릿 레이어 중복 감사

### 1.1 레이어 타입 출현 횟수 매트릭스

| 레이어 타입 | neon-arena | news-anchor | emoji-explosion | 합계 |
|---|---:|---:|---:|---:|
| `gradient_mesh` | 1 | 1 | 1 | **3** |
| `animated_grid` | 1 | 1 | 0 | 2 |
| `star_field` | 1 | 0 | 1 | 2 |
| `floating_shapes` | 2 | 0 | 8 | **10** |
| `particle_ambient` | 2 | 2 | 3 | **7** |
| `noise_pattern` / `film_grain` | 1 | 1 | 0 | 2 |
| `image_bg` | 0 | 2 | 0 | 2 |
| `beat_flash` | 5 | 4 | 3 | **12** |
| `kinetic_text` | 10 | 8 | 10 | **28** |
| `news_ticker` | 2 | 4 | 1 | **7** |
| `particle_burst` | 4 | 1 | 5 | **10** |
| `camera_feed` | 1 | 1 | 1 | 3 |
| `camera_frame` | 1 | 1 | 1 | 3 |
| `camera_reflection` | 1 | 0 | 0 | 1 |
| `face_sticker` / `face_mask` | 1 | 0 | 4 | 5 |
| `hand_emoji` | 2 | 0 | 1 | 3 |
| `orbiting_ring` | 3 | 0 | 0 | 3 |
| `lens_flare` | 2 | 0 | 2 | 4 |
| `chromatic_pulse` | 2 | 1 | 0 | 3 |
| `audio_visualizer` | 1 | 1 | 1 | 3 |
| `score_hud` / `timer_ring` / `counter_hud` / `mission_prompt` | 4 | 4 | 5 | 13 |
| `banner_badge` | 0 | 2 | 0 | 2 |
| `karaoke_caption` | 0 | 1 | 0 | 1 |
| `beat_text` | 0 | 0 | 1 | 1 |
| `voice_bubble` | 0 | 0 | 1 | 1 |
| `confetti` | 0 | 0 | 1 | 1 |

### 1.2 중복 진단

- **심각 중복 (3개 모두 동일 사용)**: `gradient_mesh`, `camera_feed`, `camera_frame`, `particle_ambient`, `kinetic_text`, `beat_flash`, `news_ticker`, `score_hud`, `timer_ring`, `audio_visualizer`.
- **해시태그 스트립 `news_ticker` + bottom 자막 스트립**: 3개 모두 동일한 `news_ticker` 패턴 반복. 시청자가 "같은 앱"이라고 느끼는 원인 1순위.
- **intro 시퀀스 구성 판박이**: 3개 템플릿 모두 `intro_flash + intro_title(top-center, kinetic_text pop) + intro_sub(bottom-center, drop) + intro_burst/ticker` 4단 구성. 컬러만 바꾼 복붙.
- **outro 시퀀스 판박이**: 3개 모두 `outro_flash → outro_title(top-center) → outro_score(★★★★★ drop) → outro_cta(bottom-center)`.
- **kinetic_text 과용**: 총 28회. 템플릿 평균 9개가 동시 텍스트. 주제 차별화에 기여 없음.

### 1.3 차별화 구조로 돌려야 할 지점

| 구간 | 현재 (동일) | 재설계 방향 |
|---|---|---|
| intro 0~2.5s | flash+title+sub+burst | 템플릿별 **고유 모션 프리미티브** (네온: CRT 부팅 / 뉴스: 스튜디오 ON-AIR 시퀀스 / 이모지: 스티커 터짐) |
| 메인 자막 | 상·하 kinetic_text 로테이션 | 네온: HUD 숫자 위주 / 뉴스: karaoke_caption 단독 / 이모지: 말풍선+face_sticker |
| outro | flash+★★★★★ | 네온: 글리치 wipe / 뉴스: END CARD 슬레이트 / 이모지: 폴라로이드 스냅 |
| 하단 스트립 | 3개 모두 news_ticker | 이모지는 제거하고 **스티커 콜라주 스트립**으로 교체 |

---

## 2. 자막 가림 문제 감사

얼굴존(9:16, 1080×1920) = **y 500~1300**. 카메라 프레이밍 중심(centerY=960) 기준 ±400px.
판정: `position: 'top-center'` 는 y≈140, `bottom-center` 는 y≈1780, **그러나** 기본 center 또는 명시 좌표가 얼굴존 안에 들어오면 가림.

### 2.1 neon-arena 얼굴존(500~1300) 침범 레이어

| 레이어 id | position/좌표 | 폰트 | 판정 |
|---|---|---:|---|
| `intro_title` (FITNESS MODE) | top-center | 110 | 안전 |
| `intro_subtitle` (SQUAT × 10) | bottom-center | 72 | 안전 |
| `cap_ready` (준비) | top-center | 84 | 안전 |
| `cap_start` (GO!) | top-center 120 | 120 | **경계** (top-center 폰트 120은 y≈60~260로 안전하나 strokeWidth 10 + bloom으로 주목도 과다, 인지적 가림) |
| `cap_push`, `cap_half`, `cap_final` | top/bottom-center | 72 | 안전 |
| `hud_counter` | bottom-center 72 | 72 | 안전 (하단 스트립과 겹침 주의) |
| `hud_prompt` ("스쿼트 10회") | 기본 center (mission_prompt 기본) | ? | **의심** — `mission_prompt` 기본 y가 960이면 얼굴 정면. props 에 position 미지정. **수정 필수**. |
| `main_lens_flare` | x=540, y=400 | — | 안전 (얼굴 위) |
| `outro_title` (CHALLENGE COMPLETE) | top-center 80 | 80 | 안전 |
| `outro_score` (★★★★★) | top-center 110 | 110 | 안전 |
| `fx_perfect_text` | 기본 (enabled:false) | 120 | 기본값이 center면 활성 시 가림, position 명시 필요 |

### 2.2 news-anchor 얼굴존 침범 레이어

| 레이어 id | position/좌표 | 폰트 | 판정 |
|---|---|---:|---|
| `live_badge` | x=140, y=280 | — | 안전 (얼굴 위쪽 모서리) |
| `main_mission_prompt` ("대본을 또박또박 읽어주세요") | `mission_prompt` 기본 | — | **의심** — 기본이 center면 얼굴 직격. position 미지정. **수정 필수**. |
| `script_ghost` | `position: 'top'` | 18 | 안전 (얇음) |
| `caption` (karaoke_caption) | 기본 | — | karaoke_caption 기본 y 확인 필요. 뉴스 자막은 보통 y≈1500~1650. 현재 props 에 position 미지정 → **수정 필수** (명시적 `position: 'bottom'` 또는 y=1550) |
| `head_1~4` (안녕하십니까/오늘의 날씨/맑은 하늘/뉴스 마무리) | top-center 64 | 64 | 안전 |
| `outro_title` (속보 종료) | top-center 88 | 88 | 안전 |

### 2.3 emoji-explosion 얼굴존 침범 레이어

| 레이어 id | position/좌표 | 폰트 | 판정 |
|---|---|---:|---|
| `beat_luv` (LUV) | top-right 120 | 120 | 안전 (모서리) |
| `kinetic_cta` (MAKE EM SMILE!) | bottom-center 60 | 60 | 안전 |
| `hud_prompt`, `hud_prompt2`, `hud_prompt3` | `mission_prompt` 기본 | — | **의심** — position 미지정 → 얼굴 가능성. **수정 필수**. |
| `cue_smile`, `cue_heart`, `cue_peace`, `cue_jump` | top-center 88 | 88 | 안전 (단, strokeWidth 8 + bloom 으로 시각 무게 큼, top-center로 OK) |
| `sc1_burst`, `sc2_burst`, `sc3_confetti` (enabled:false) | — | — | origin 기본 center. 파티클 자체는 얼굴 가림 약함. |
| `orbit_emoji_1~6` | radius 260, centerY 기본 960 | — | **심각** — 오비트 반경 260이면 얼굴존을 계속 통과. 사용자 피드백의 "얼굴 가리는 이모지" 정체. |
| `forehead_star` 등 face_sticker | 랜드마크 tracking | — | 정상 (얼굴 기준) |

### 2.4 공통 문제: `mission_prompt` 기본 position

`mission_prompt` 레이어의 기본 position이 문서화되지 않은 상태에서 3개 템플릿 모두 position 미지정으로 사용. 얼굴 직격 가능성 높음. **즉시 수정 필요**:
- `engine/composition/layers/mission_prompt.ts` 기본값을 `bottom-center y=1600`으로.
- 또는 선언 시점에 `props.position: 'bottom-center'` 강제.

### 2.5 특히 `orbit_emoji_*` (emoji-explosion)

반경 260px @ centerY=960 → y 범위 700~1220. **정확히 얼굴 한가운데**. 사용자 피드백 직격.
수정안 A: orbit 중심을 얼굴 위 (centerY=500) 또는 아래 (centerY=1400)로 이동, 반경 그대로.
수정안 B: orbit 제거하고 face_landmark 기반 "귀걸이·모자" 이모지로 대체.
수정안 C: orbit 반경을 460~520px로 키워 얼굴존 밖(폭 1080 제약 때문에 좌우 잘림 감수).

---

## 3. 스쿼트 프레이밍 재설계 (hexagon 제거)

현 `cameraFraming: { kind: 'hexagon', size: 380 }` = **지름 760px** 원형/육각 창. 1080×1920 캔버스에 비해 과소. 스쿼트 상하 운동 범위(머리~무릎) 수직 1.2m 이상을 담기엔 세로 공간 절대 부족. 사용자 피드백의 "몸이 안 나온다" 정체.

### 대안 A: 풀프레임 (fullscreen)

카메라가 캔버스 전체를 채움. 레이어는 상·하 마진 띠(semi-transparent)에 집중.

- pros
  - 스쿼트 전신(머리~무릎) 완전히 담김. 운동 체크 정확도 최대.
  - 구현 단순 (clip path 없음).
  - 30fps 안정적.
- cons
  - 배경 레이어가 카메라 뒤로 가려 시각 임팩트 반감.
  - "템플릿 속에 들어간 느낌" 약화 → CLAUDE §3.4 (템플릿 1개 이상은 창의적 프레이밍 필수) 정신 위배 가능. 단, 나머지 2개(heart, rounded_rect)가 있으므로 이 1개는 허용됨.

### 대안 B: 상하 분할 (portrait_split)

상단 1/3 (y 0~640) = 네온 HUD/스카이라인 반사, 하단 2/3 (y 640~1920) = 카메라. 카메라 영역이 1080×1280으로 확보됨.

- pros
  - 스쿼트 전신 담김 (1280px 세로로 충분).
  - 상단 HUD 존이 생겨서 점수·타이머·카운터가 얼굴 근처 안 감.
  - 게임 UI 느낌 강함 (피트니스 앱스러움).
- cons
  - 신규 `cameraFraming.kind: 'portrait_split'` 구현 필요.
  - 상단 영역을 무엇으로 채울지 별도 디자인 (미러 반사? HUD? 캐릭터 아바타?).

### 대안 C: 레터박스 (letterbox_cinematic)

카메라가 가로 전폭(1080) × 세로 1620 (y 150~1770), 상·하에 75px 블랙 바. 내부에 타이틀/점수 얹음.

- pros
  - 영화적 느낌. 16:9보다 2.35:1 느낌.
  - 스쿼트 전신 OK.
  - 구현 난이도 최저 (단순 마스크).
- cons
  - 3개 템플릿 중 1개 이상 창의적 프레이밍 요구(hexagon/heart/rounded_rect 이미 있음)를 약화. neon-arena의 "사이버펑크 아레나" 무드와 거리 있음 (시네마틱은 뉴스 쪽).
  - 상·하 바가 좁아 HUD 배치 공간 부족 → HUD가 카메라 위에 overlay 되는 기존 문제 그대로.

### 추천: **대안 B (portrait_split)**

운동 체크 정확도 + 네온 무드 유지 + HUD가 얼굴 안 가림. 신규 프레이밍 구현 1회 비용 감당 가치 있음.
차선은 대안 A (풀프레임, 구현 즉시 가능).

---

## 4. 3개 템플릿 차별화 무드보드

### 4.1 컬러 팔레트 (hex)

| 템플릿 | 프라이머리 | 세컨더리 | 악센트 | 배경 베이스 | 중성/텍스트 | 현 상태 | 조정안 |
|---|---|---|---|---|---|---|---|
| neon-arena | `#FF2D95` 마젠타 | `#00E0FF` 시안 | `#39FF7D` 라임 | `#1A0B2E` / `#000000` 네이비블랙 | `#FFFFFF` | 그대로 | **채도 유지·마젠타 1포인트로 감축**. 모든 자막이 마젠타라 단조로움 → 시안과 라임 비율 올림 (6:3:1 → 4:3:3) |
| news-anchor | `#D4AF37` 앤티크골드 | `#0B1828` 네이비 | `#FF3B5C` 속보레드 | `#0B1828`~`#12263F` 그라디언트 | `#FFFFFF` / `#A0AEC0` | 그대로 | 골드 더 탁하게 `#B8941F`로, 속보레드는 피크 순간에만 |
| emoji-explosion | `#FF2D95` 핫핑크 | `#39FF7D` 민트 | `#FFD700` 골드 | `#FFB6C1`~`#D8BFD8` 핑크 그라디언트 | `#FFFFFF` | **핫핑크 neon-arena와 충돌**. | 핫핑크 → `#FF6FB5` 소프트핑크로 톤다운. 악센트 `#B794F4` 라벤더 추가. 마젠타는 neon-arena 전용으로 예약 |

### 4.2 배경 스타일

| 템플릿 | 현재 | 조정안 |
|---|---|---|
| neon-arena | gradient_mesh + animated_grid(원근) + star_field + skyline(floating_shapes) + orbiting_ring(tube) + noise | **유지**하되 grid 색을 마젠타 → 시안으로 교체, skyline을 SVG 실루엣으로 (floating_shapes 재사용 제거) |
| news-anchor | image_bg(스튜디오) + gradient_mesh + animated_grid(모니터) + glitter_down + noise | animated_grid 제거 (neon과 중복). 대신 **세로 스캔라인 bars** 레이어 신규. image_bg 스튜디오 이미지를 실제 블러드 모니터월 SVG로 교체 |
| emoji-explosion | gradient_mesh(핑크) + star_field + floating_shapes ×2 + glitter + hearts | floating_shapes 총 8개가 과다. **3개로 감축**. 대신 `sticker_collage` 신규 레이어 (스크랩북 프레임) 도입 |

### 4.3 파티클/모션 프리미티브

| 템플릿 | 고유 프리미티브 | 타 템플릿과 중복 금지 |
|---|---|---|
| neon-arena | 전기 스파크(라인 버스트), CRT 스캔라인 플리커, chromatic_pulse 강(peakPx 8) | `particle_ambient` preset 은 `electric_blue_rise` 전용 |
| news-anchor | 종이 먼지(slow down), gold glitter_down, typewriter 커서, breaking_bar skew | `beat_flash`를 사용하지 않음 (시네마틱 톤 유지). chromatic 0.5px 미만 |
| emoji-explosion | 하트 상승, 홀로그램 번짐(saturation boost), 스탬프 임프린트(face_sticker pop-in), bokeh | `news_ticker` 제거 (뉴스 전용 예약). 대신 `sticker_strip` 가로 슬라이드 |

### 4.4 폰트 느낌

| 템플릿 | 제안 폰트 | 용도 |
|---|---|---|
| neon-arena | `JetBrains Mono` (카운터·타이머) + `Orbitron` / `Audiowide` (타이틀) | 모노스페이스 + 지오메트릭. 사이버펑크 |
| news-anchor | `Pretendard Bold` (헤드라인) + `Noto Serif KR` (ghost 대본) + `Inter Mono` (티커) | 세리프+산세리프 조합으로 품격 |
| emoji-explosion | `Cafe24 Ssurround` / `Jua` (한글 둥근 고딕) + `Fredoka` / `Baloo 2` (영문) | 둥글고 말랑. 팝 |

### 4.5 카메라 프레이밍

| 템플릿 | 현재 | 조정안 |
|---|---|---|
| neon-arena | `hexagon` 지름 760 | **`portrait_split`** (상단 HUD, 하단 카메라 1080×1280) — §3 추천 |
| news-anchor | `rounded_rect` 840×1120 | 유지. 단 카메라 아래 공간에 `lower_third` 자막 밴드 전용 존 확보 |
| emoji-explosion | `heart` 420 | 유지. 단 `orbit_emoji_*` 반경을 얼굴존 밖(520)으로 확대 또는 centerY 오프셋 |

### 4.6 포스트프로세스 차별화

| 템플릿 | 현재 | 조정안 |
|---|---|---|
| neon-arena | bloom 1.2 + chromatic + crt_scanlines + vignette | **유지** (가장 강한 후처리 = 캐릭터) |
| news-anchor | bloom 0.4 + warm LUT + film_grain + vignette | LUT 따뜻한 톤 → `cool-news.cube`로 변경(BBC 느낌), film_grain 강도 올림 |
| emoji-explosion | bloom 0.8 + saturation 0.2 + bokeh | bokeh 유지, 신규 `halation` (붉은 헤일로) 추가, chromatic 명시적 제거 |

---

## 5. 트렌디 숏폼 레퍼런스 (2025 키워드)

일반 지식 기반 (§7 참조).

1. **Y2K frutiger aero 부활**: 투명 글래스, 그라디언트, 물방울. emoji-explosion에 적합.
2. **CapCut "neon grid arena"**: 1인칭 게임 HUD + 체력바 + 콤보 카운터. neon-arena 참고.
3. **BBC/JTBC style "lower-third on steroids"**: 3단 lower-third, 속보 애니메이션 와이프. news-anchor 참고.
4. **Sticker collage / scrapbook overlay**: 폴라로이드, 마스킹테이프, 도장. emoji-explosion 차별화.
5. **Liquid chrome / holographic foil**: 홀로그램 포일 텍스처가 비트에 맞춰 흐름. 3개 중 1개 선택적 도입.

---

## 6. 구현 우선순위 (커밋 단위)

빠른 효과 → 큰 구조 순.

1. **[commit 1] `mission_prompt` 기본 position 수정**: `position='bottom-center' y=1600` 디폴트. 3개 템플릿 즉시 얼굴 가림 제거. 10분 작업. (§2.4)
2. **[commit 2] `orbit_emoji_*` 얼굴 회피**: emoji-explosion `orbit_emoji_1~6` centerY=500 이동 + 반경 320으로 축소. 사용자 피드백 직격 해결. (§2.5)
3. **[commit 3] neon-arena hexagon → portrait_split**: 신규 `cameraFraming.kind: 'portrait_split'` 엔진 구현 + neonArena.ts 적용. 스쿼트 전신 담김. (§3 추천)
4. **[commit 4] intro/outro 시퀀스 템플릿별 차별화**: 3개 공통 4단 구성을 고유 프리미티브로 교체 (neon: CRT 부팅, news: ON-AIR 슬레이트, emoji: 스티커 임프린트). (§1.3)
5. **[commit 5] 하단 스트립 차별화**: emoji-explosion 의 `hashtag_strip`(news_ticker) → `sticker_strip` 신규 레이어로 교체. news-anchor 하단 티커와 구분. (§4.3)
6. **[commit 6] 컬러 팔레트 정리**: emoji-explosion 핫핑크 `#FF2D95` → 소프트핑크 `#FF6FB5`, 라벤더 `#B794F4` 악센트 추가. neon-arena 와 채도 분리. (§4.1)
7. **[commit 7] 포스트프로세스 차별화**: news-anchor LUT 교체, emoji-explosion halation 필터 신규 추가, neon-arena 현상 유지. (§4.6)
8. **[commit 8] karaoke_caption / caption 기본 position 명시**: news-anchor `caption` 에 `position='bottom' y=1550` 명시. 미래 얼굴 가림 회귀 방지. (§2.2)

---

## 7. 연구 한계 고지

- WebSearch / WebFetch 권한 미검증 상태로 진행. §5 숏폼 레퍼런스는 **일반 지식 기반**이며 2025~2026 최신 바이럴 크리에이터 샘플 실측 없음.
- 사용자 실제 화면(iPhone/Android) 해상도에서의 자막-얼굴 픽셀 거리 실측 없음. 얼굴존 y=500~1300 은 "카메라가 centerY=960에 피사체 배치" 가정.
- `mission_prompt`, `karaoke_caption` 기본 position 의 실제 구현 확인 없이 "기본값 불명 → 수정 권장"으로 처리. commit 1/8 에서 실제 코드 확인 후 조정 필요.
- 3개 템플릿의 `duration`/`startMs` 타임라인 충돌(동시 표시) 검증 별도 필요 (본 문서 범위 외).

---

## 추천 요약 (3줄)

1. **즉시 수정 3건**: `mission_prompt` 기본 position 을 bottom-center 로, emoji-explosion `orbit_emoji_*` 얼굴존 밖 이동, neon-arena hexagon 을 portrait_split 으로 교체. 사용자 피드백 3건을 이 커밋 세 개로 해결 가능.
2. **근본 차별화**: intro/outro 판박이 4단 구성과 하단 news_ticker 스트립 중복을 템플릿별 고유 프리미티브(CRT부팅 / ON-AIR / 스티커콜라주)로 갈아끼워야 "같은 걸 반복한다" 인상 해소.
3. **팔레트 분리**: `#FF2D95` 핫핑크를 neon-arena 전속으로 두고 emoji-explosion 은 소프트핑크+라벤더로 이동해 "3개가 같은 톤" 문제의 시각 뿌리를 끊는다.
