# HANDOFF_PLAN.md — MotiQ 전문가 구현 로드맵 v1

> 작성일: 2026-04-22.
> 목적: 남은 핵심 작업(포스트 컴포지터 / Whisper STT / 공유)을 다음 세션 Claude 가 **컨텍스트 없이** 이어받을 수 있게 하는 단일 문서.

---

## 현재 아키텍처 (FIX-S 이후, 2026-04-22)

```
┌─── 촬영 페이즈 ────────────────────────────────────────┐
│  camera + raw mic → MediaRecorder → webm/mp4 (원본)     │
│  BGM / SFX / 레이어 / 포스트FX = 모두 OFF               │
│  인식 엔진: MediaPipe Pose + webkitSpeech + 얼굴 Y       │
│  수집: scoreAccumRef + eventTimeline(sessionStore)      │
└─────────────────────────────────────────────────────────┘
                         ↓
          [사용자가 "완성 영상 만들기" 버튼 탭]
                         ↓
┌─── 포스트 컴포지터 (Track D, 미구현) ──────────────────┐
│  1. HTMLVideoElement(원본) + Canvas 합성 루프           │
│  2. 레이어 엔진 재활용 → 각 프레임에 layers 렌더        │
│  3. AudioContext 에서 원본 mic track + BGM + SFX 믹스   │
│  4. canvas.captureStream + MediaRecorder → 최종 webm    │
│  5. ffmpeg.wasm 으로 webm → mp4 트랜스코드 (옵션)       │
└─────────────────────────────────────────────────────────┘
                         ↓
          ┌─── 공유 (Track F) ─────┐
          │ Web Share API Level 2   │
          │  + 로컬 다운로드 폴백   │
          └─────────────────────────┘
```

---

## 이번 세션(2026-04-22) 완료 사항

- **FIX-S** 녹화 중 BGM 재생·오디오 믹싱 전부 제거. 원본 클립 = camera + raw mic.
- **FIX-T** 근접 스쿼트 디텍터 임계 강화: `MIN_PIVOT_AMPL 0.05→0.08`, `MIN_REP_MS 400→600`.
  → 머리 끄덕임 false-positive 억제. 실제 스쿼트만 카운트.
- **FIX-T** `components/record/StanceGuide.tsx` 추가. fitness 장르 촬영 시 랜드마크 가시성 실시간 분석 → "책상 거치 / 뒤로 / 정면 측면 OK" 안내. 2.8s 후 작은 뱃지로 축소.
- **FIX-U** `sessionStore.eventTimeline[]` + `pendingBgmUrl` 추가. 점수 스파이크·미션 시작 이벤트 자동 수집.
- **썸네일 5종 교체** (Round 2): 문신/탱고/락콘서트/치킨/모호함 → 스쿼트·언박싱·댄스 맥락 이미지.

---

## Track D — 포스트 컴포지터 (다음 세션 최우선)

### 목표
녹화된 원본 webm/mp4 + `activeTemplate.layers` + `pendingBgmUrl` + `eventTimeline` 을 입력으로, **레이어·BGM·SFX·포스트FX 가 모두 박힌 최종 MP4** 를 생성.

### 설계
1. **페이지**: `app/record/compose.tsx` (신규) — `/record` 종료 시 자동 진입.
2. **컴포넌트**: `components/compose/PostCompositor.tsx`
   - props: `srcVideoUri`, `template`, `timeline`, `bgmUrl`, `onDone(finalBlob)`
   - 내부 state: `phase: 'idle'|'encoding'|'transcoding'|'done'`, `progress 0..1`
3. **렌더 루프**:
   ```ts
   const vid = document.createElement('video');
   vid.src = srcVideoUri; vid.muted = true; vid.playsInline = true;
   await vid.play();
   const canvas = document.createElement('canvas');
   canvas.width = 1080; canvas.height = 1920; // 9:16
   const ctx = canvas.getContext('2d')!;
   const loop = () => {
     const tMs = vid.currentTime * 1000;
     ctx.drawImage(vid, ...); // base
     layerEngine.renderFrame(ctx, tMs, { template, timeline });
     if (!vid.ended) requestAnimationFrame(loop);
   };
   ```
4. **오디오**:
   ```ts
   const audioCtx = new AudioContext();
   const src = audioCtx.createMediaElementSource(vid);
   src.connect(audioCtx.destination); // 원본 mic
   const bgm = new Audio(bgmUrl); bgm.crossOrigin = 'anonymous'; bgm.loop = true;
   const bgmSrc = audioCtx.createMediaElementSource(bgm);
   const bgmGain = audioCtx.createGain(); bgmGain.gain.value = 0.35;
   bgmSrc.connect(bgmGain).connect(audioCtx.destination);
   const dest = audioCtx.createMediaStreamDestination();
   src.connect(dest); bgmGain.connect(dest);
   ```
5. **재녹화**: `canvas.captureStream(30)` + `dest.stream.getAudioTracks()[0]` → MediaRecorder → webm Blob
6. **MP4 트랜스코드** (옵션): `@ffmpeg/ffmpeg` v0.12 WASM. 5~10MB 클립 기준 10~20초 소요. 모바일에서 무리면 webm 다운로드 제공 + "iOS 에서는 트위터 호환 위해 PC 변환 권장" 안내.

### 의존성
- `ffmpeg.wasm` npm: `@ffmpeg/ffmpeg@^0.12`, `@ffmpeg/util@^0.12`
- 기존 `engine/composition/layerEngine.ts` 그대로 사용

### 엣지 케이스
- iOS Safari: `createMediaElementSource` crossOrigin 필수. BGM URL 이 CORS 허용되는 CDN(SoundHelix, HuggingFace) 이어야 함.
- Android Chrome: captureStream@30 + MediaRecorder 로 인코딩 중 탭 백그라운드 가면 정지 → "화면 켠 채로 기다려주세요" 안내 + Wake Lock.
- 메모리: 원본 30초 × 1080p ≈ 50MB. 중간 캔버스 복제 금지, 직접 캡처.

---

## Track E — Whisper WASM (음성 인식 모바일 고도화)

### 이유
`webkitSpeechRecognition` 이 Android Chrome 에서 불안정 (조용히 stall, 결과 0건). 노트북 크롬은 OK. 모바일 필수 해결.

### 확정된 스택
- `@huggingface/transformers@^3.3`  (v3 신규; v2 `@xenova/transformers` 아님)
- 모델: `Xenova/whisper-base` (q8 ≈ 80MB, 다국어 ko 포함)
- 저사양 fallback: `Xenova/whisper-tiny` (~40MB)
- VAD: `@ricky0123/vad-web@^0.0.22`

### 설계
1. `utils/sttWhisper.ts` (신규). 기존 `utils/sttFactory.ts` 가 `engine=whisper` 경로 이미 스텁 상태 — 실제 구현만 채우면 됨.
2. 초기화 (lazy, 사용자 기록 버튼 탭 직후):
   ```ts
   import { pipeline, env } from '@huggingface/transformers';
   env.useBrowserCache = true;
   const asr = await pipeline(
     'automatic-speech-recognition',
     'Xenova/whisper-base',
     { device: 'webgpu', dtype: 'q8' }
   ).catch(() => pipeline('automatic-speech-recognition', 'Xenova/whisper-base', { dtype: 'q8' }));
   ```
3. 스트리밍: 5s chunk, 1s stride. AudioWorklet 으로 16kHz mono Float32 변환.
4. 언어: `language: 'korean'` 또는 템플릿 언어 태그 기반 동적 ('english' for 영어 뉴스 템플릿).
5. VAD 로 발화 구간만 Whisper 에 태움 → CPU/배터리 절약.
6. 결과 스트림 → 기존 `useJudgement` 의 `handleInterim/handleFinal` 로 그대로 라우팅. UI 변경 없음.

### 디바이스 게이팅
- `navigator.deviceMemory < 3` → whisper-tiny, 정확도 경고 표시.
- `navigator.gpu` 존재 + WebGPU 어댑터 ≥ 1 → webgpu dtype; 없으면 wasm.
- iOS 17.2 미만 → webkitSpeech 유지 (WASM thread 이슈).

### 첫 진입 UX
- 모델 다운로드 약 10초 (80MB @ 8Mbps 모바일). 프로그레스 모달 필수. 1회만 받으면 IndexedDB 캐시.

### 의존성
- `@huggingface/transformers` npm 패키지 추가 → Metro/Webpack 설정 손볼 수 있음. Expo Web 은 Webpack 5 기본 지원.
- `onnxruntime-web` 이 transformers.js v3 의 서브디펜던시. wasm 파일 CDN 로드 설정 확인.

---

## Track F — 공유 / 다운로드

### 설계
1. 최종 Blob 확보 직후 `app/record/compose.tsx` 에서:
   ```ts
   const file = new File([blob], 'motiq.mp4', { type: 'video/mp4' });
   if (navigator.canShare?.({ files: [file] })) {
     await navigator.share({ files: [file], title: 'MotiQ 챌린지' });
   } else {
     const a = document.createElement('a');
     a.href = URL.createObjectURL(blob); a.download = 'motiq.mp4'; a.click();
   }
   ```
2. Instagram/TikTok 직접 딥링크는 모바일에서만 제한적. Web Share Level 2 로 "앱 선택" 시트 뜨면 OK.
3. PC 사용자 → 자동 다운로드.

---

## 세션 분할 권장

| # | 세션 테마 | 예상 작업량 |
|---|---|---|
| 1 | (이번) FIX-S~U | 완료 |
| 2 | Track D 전체 (PostCompositor + ffmpeg) | 3~4h |
| 3 | Track E 전체 (Whisper WASM) | 4~6h |
| 4 | Track F + Phase 5 레이어 고도화 시작 | 2~3h |

각 세션 시작 시 `CLAUDE.md` + 이 문서 + `docs/COMPOSITION.md` 읽고 진입.

---

## 절대 하지 말 것 (재확인)

- 녹화 중 BGM 재생 복구 (오디오 누출 원인)
- 가짜 점수·가짜 STT 결과 (CLAUDE.md §3)
- 서버 전송 (§12 법적 가드레일)
- 촬영 중 팝업·모달 (§3 #12)
