# 01. 한국어 STT 엔진 리서치 보고서

> 작성 2026-04-22 · 대상 미션: voice_read (한국어 대본 낭독 정확도 판정)
> 범위: 100% 클라이언트, CLAUDE.md §12 준수 (서버 전송 금지).
> 비고: 이번 라운드는 WebSearch 권한이 차단되어 외부 최신 벤치마크 URL 확인은 불가. 수치는 학습 지식(2025-말~2026-초 기준) 범위에서 작성하며 실기기 재측정이 필요한 항목은 "[측정 필요]" 로 표시.

---

## 1. 현재 구현 진단

### 1.1 상태 요약

| 항목 | 파일 | 상태 |
|---|---|---|
| STT 팩토리 | `utils/sttFactory.ts` | webkit 만 활성 (`WHISPER_ENABLED = false`) |
| webkit 래퍼 | `utils/speechUtils.ts` | 모바일 `continuous=false` + onend 재시작 + watchdog(4s stall) + onerror 자동재시도(5회) |
| Whisper 래퍼 | `utils/whisperRecognizer.ts` | CDN 지연+메인스레드 추론 freeze 로 잠금 상태 |
| 판정/자막 dataflow | `hooks/useJudgement.ts` §judge voice_read | interim→state→ref, final→state+latestJudgementRef |
| 캔버스 자막 | `utils/liveCaption.ts` → `RecordingCamera.web.tsx` drawFrame | `liveCaptionText={speechBadge.transcript || voiceTranscript || ''}` |

### 1.2 "자막이 안 보인다" 의심 경로 (읽은 그대로 추적)

Record 화면에서 `liveCaptionText` 는 아래 두 값의 OR 로 들어간다 (`app/record/index.tsx:1873`):

```
speechBadge.transcript   ← 폴링이 getDiagnostic().transcript 를 주기적으로 읽어 state 로 복사
voiceTranscript          ← useJudgement 의 setVoiceTranscript 에 의해 갱신
```

두 경로 모두 **_interimCb 가 호출되어야만** 채워진다. 따라서 "자막이 비어 있다" 의 가능한 원인 세 갈래:

1. **SpeechRecognition 이 listen() 호출되지 않음.**
   - `useJudgement.judge()` 안의 `if (!_voiceActive && sr.isSupported())` 블록은 **mission.type === 'voice_read' 일 때만** 실행된다.
   - 만약 실기기에서 voice 미션 진입 전에 이미 faith-based 초기 자막 기대로 확인했다면, 아직 listen() 호출 자체가 없다. (spec 상으로는 정상 동작.)
   - prewarmSpeech() 는 FIX-F에서 "모바일에서 권한팝업을 부르기 위해" 존재하나, FIX-Z11 직후 코드에서도 여전히 실제 `sr.listen()` 을 호출하여 _voiceStopFn 을 잡는다. 즉 prewarm 이 불렸고 성공했다면 listen() 은 이미 돌고 있어야 한다.

2. **listen() 은 돌지만 onresult 가 안 온다 (ASR stall).**
   - 이것이 가장 흔한 실기기 증상. 사용자 피드백 "듣는중 상태는 뜨는데 자막은 안 보임" 과 정확히 일치.
   - Android Chrome 의 `webkitSpeechRecognition` 은 Google ASR 백엔드에 오디오를 업로드해 결과를 받는 구조다 (§CLAUDE §12 법적 가드레일 관점에서 이미 사용자 데이터가 Google 로 전송되고 있음 — **중대 발견**, §3 에서 별도 경고).
   - ASR 백엔드가 네트워크 지연 · VAD 민감도 · 잡음 수준에 따라 **결과를 수십 초 뒤늦게 또는 아예 안 주는** 케이스가 재현된다. `_watchdog` 는 4초 간격으로 resultCount 변화를 체크해 7초(2회) 무증가면 `stop()` 을 호출해 onend 재시작을 노린다.
   - 그러나 **무음 상태에서는 Google ASR 이 아무 결과도 주지 않는 것이 정상 동작** 이다. 사용자가 실제로 말을 해도 VAD threshold 아래로 인식되면 동일.

3. **마이크 트랙은 있지만 실제 오디오가 비어있음.**
   - `window.__cameraStream` 의 audioTrack 이 live 라도 muted 이거나, 다른 탭/페이지에서 이미 선점 중이면 실제 PCM 은 전부 0.
   - iOS 에서 BGM <audio> 재생 시 AVAudioSession 이 **record 카테고리 전환을 강제하여 마이크가 음소거** 되는 버그 계열이 존재 [측정 필요].

### 1.3 끊긴 연결 의심 지점

코드 정밀 독해 결과, **dataflow 자체는 연결되어 있다**:

```
rec.onresult → onInterim(current) → bridgedInterim(wrapInterimCallback(...)) → _interimCb(t)
             → setVoiceTranscript(interim)  ✓  (useJudgement 내부)
             → voiceTranscriptRef.current = interim  ✓
```

그리고 `getDiagnostic().transcript` 는 `this.lastTranscript` 에서 오는데, `lastTranscript = current` 는 onresult 내부에서 직접 세팅된다. 따라서 **웹스피치 API 가 onresult 를 한 번이라도 주면 자막은 반드시 뜬다**. → 결론: **자막이 안 보이는 것 = onresult 가 호출되지 않는 것** = §1.2 의 (2) 또는 (3).

### 1.4 브라우저별 `webkitSpeechRecognition` 지원 매트릭스

| 브라우저 | 한국어 지원 | 실사용 안정성 | 비고 |
|---|---|---|---|
| Desktop Chrome (Win/Mac/Linux) | O (`ko-KR`) | 매우 좋음 | Google ASR 백엔드, 네트워크 필수 |
| Desktop Edge | O | 좋음 | Chromium 공유 |
| Desktop Firefox | **X** | — | API 미구현 (2026 현재) |
| Desktop Safari | 부분적 | 불안정 | Safari 14.1+ 에서 `SpeechRecognition` 있으나 `continuous=true` 가 첫 결과 후 자주 종료 |
| Android Chrome | O | **중간** | ASR 스톨 빈발. 모바일 특화 watchdog 필수 |
| Android Samsung Internet | O | 중간 | Chromium 기반, Android Chrome 과 유사 |
| iOS Safari 16 이하 | **X** | — | API 자체 없음 |
| iOS Safari 17+ | 부분적 | **매우 불안정** | `SpeechRecognition` 객체는 존재하나 `start()` 시 `service-not-allowed` / `language-not-supported` 에러가 흔함. 한국어는 특히 취약 [측정 필요] |
| iOS Chrome/Firefox/Edge | **X** | — | iOS는 모든 브라우저가 WebKit 엔진 → Safari 와 동일 |

**결론**: 현재 구현은 Android Chrome 주요 타깃에 대해서는 한계까지 방어책이 들어가 있고, iOS 는 명시적으로 `checkSpeechCapability()` 에서 거부 메시지를 띄워 사용자를 Android/Desktop Chrome 으로 유도하는 패턴이다.

### 1.5 정책상 치명적 발견 (priority high)

`webkitSpeechRecognition` 은 **사용자 마이크 오디오를 Google ASR 서버로 전송** 하여 결과를 받는다. CLAUDE.md §12:
> 공무원 휴직 중 → 서버 전송·업로드·공유·수익화·광고·결제·분석툴 전부 금지. 100% 클라이언트.

현재 구현은 이 조항을 **기술적으로 위반** 하고 있다. 공식 명세는 이를 명시하지 않지만 Chrome/Edge 구현의 기본 동작이 Google Speech API 로의 전송이며, 이는 Chromium 소스(`content/browser/speech/`)에서 확인 가능하다. 단순 문자열 비교 UI 에서는 유저 입장의 "업로드" 체감이 없으므로 여태 문제 제기가 없었을 뿐이다.

→ 즉, **"iOS 에서 자막이 안 뜬다" 보다 더 근본적인 이슈: webkit 는 § 12 위반이므로 어차피 대체해야 한다.**

---

## 2. 대체 STT 엔진 비교

### 2.1 후보 매트릭스

| 엔진 | 모델 | 모델 크기 | 로딩 | RTF (모바일) | 한국어 WER | 라이선스 | 모바일 Safari |
|---|---|---|---|---|---|---|---|
| **webkitSpeechRecognition** | (Google ASR) | 0 | 즉시 | ~RT | ~8-12% (추정) | 서버 의존 | 불안정 |
| **Whisper.cpp WASM** (ggerganov) | whisper-tiny ko | ~75 MB | 5-15 s | 0.3-0.7 | ~14-18% | MIT | 동작 (WebAssembly SIMD) |
| **Whisper.cpp WASM** | whisper-base ko | ~140 MB | 10-25 s | 0.5-1.2 | ~10-14% | MIT | 동작하나 메모리 타이트 |
| **transformers.js** (@xenova) | Xenova/whisper-tiny | ~40 MB (quantized) | 8-20 s | 0.4-1.0 | ~15-19% | MIT | 동작 |
| **transformers.js** | Xenova/whisper-small | ~240 MB | 20-60 s | 1.0-2.0 | ~8-11% | MIT | 메모리 위험 |
| **Vosk-browser** (alphacep) | vosk-model-small-ko | **~82 MB** (`vosk-model-small-ko-0.22`) | 5-12 s | **0.05-0.15** | ~15-20% | Apache 2.0 | **미확인** [측정 필요] |
| **Vosk-browser** | 큰 모델 | ~1.4 GB | — | — | ~8-10% | Apache 2.0 | 비현실적 |
| **sherpa-onnx-wasm** (k2-fsa) | zipformer-ko-streaming | ~80-150 MB | 8-20 s | 0.1-0.3 | ~12-15% (추정) | Apache 2.0 | 동작 |
| **Moonshine** (usefulsensors) | moonshine-tiny | ~60 MB | 5-10 s | 0.2-0.5 | **한국어 미지원** | MIT | 동작 |

수치 주의:
- RTF = 처리 시간 / 오디오 길이. 0.3 = 3초 오디오 1초에 처리.
- 모바일은 Pixel 7 / Galaxy S22 급 가정. 저가형은 2~3배 느릴 수 있음.
- "[측정 필요]" 없는 숫자도 외부 벤치/릴리스 노트 기반 추정치이므로 실기기 재검증 전제.

### 2.2 각 후보 상세 코멘트

**A. Whisper.cpp WASM (ggerganov/whisper.cpp/examples/whisper.wasm)**
- 장점: 공식 whisper.cpp, SIMD+threads 빌드, 제일 "순정" Whisper 품질.
- 단점: 빌드 산출물이 크다(wasm binary ~2MB + 모델). 모델은 huggingface CDN 직접 로드. Worker 래핑 필요.
- 한국어: whisper-tiny 는 자모 경계 오인이 잦고, whisper-base 부터 실용적 [측정 필요].

**B. transformers.js (@xenova/transformers)**
- 장점: 설치 간단 (`pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny')`), IndexedDB 캐시 내장, API 가 깔끔.
- 단점: 현재 프로젝트에서 이미 CDN 로드 + Metro 번들러 충돌 이슈 경험 (`utils/whisperRecognizer.ts` 주석). ONNX Runtime Web 런타임 크기 부담.
- 한국어: Xenova/whisper-tiny 는 OpenAI 오리지널을 INT8 양자화한 것. ~40MB. [측정 필요]: 한국어 WER 공식 벤치마크 부재.

**C. Vosk-browser (alphacep/vosk-browser)**
- 장점: **스트리밍 네이티브**. 500ms 단위 부분결과를 바로 주므로 라이브 자막 UX 에 최적. Kaldi 기반 → CPU 만으로 빠름.
- 단점: 한국어 small 모델 자체가 82MB 로 큼. 발음 사전 기반이라 **동화/뉴스 리딩 처럼 준비된 대본** 에는 강하지만 자유 발화 WER 은 Whisper 보다 나쁨.
- 이 프로젝트 미션(voice_read: 정해진 read_text 와 비교)에는 **오히려 Whisper 보다 적합**. 약점인 open-domain 발화를 요구하지 않기 때문.
- 모바일 Safari: 라이브러리 README 에 명시 지원 플랫폼 — Chrome, Firefox. Safari 는 [측정 필요].

**D. sherpa-onnx-wasm (k2-fsa)**
- 장점: Next-gen Kaldi. Zipformer 모델은 스트리밍+높은 정확도. 여러 한국어 모델 공개.
- 단점: 문서/예제가 연구자 친화적이라 브라우저 통합 레퍼런스가 적음. 빌드 복잡.
- 이번 프로젝트 타임라인상 위험.

**E. Moonshine (usefulsensors)**
- 2024 말 공개된 "더 작고 빠른 Whisper 대체". 다만 **영어 전용**. 한국어는 로드맵에 있으나 2026-04 현재 미공개 [측정 필요].

### 2.3 크기·성능 정책 기준 필터링

프로젝트 제약 (추정):
- 앱 첫 방문 → voice_read 미션 실행까지 **초기 대기 < 20s** (사용자 인내 한계).
- 번들에 영구 포함하지 않고 **voice_read 미션이 있는 템플릿 선택 시에만** IndexedDB 캐시로 로드.
- 모바일 저가형도 고려 → 모델은 **100 MB 이하** 권장.

이 필터를 통과하는 현실 후보:
1. Vosk-browser small-ko (82 MB, 스트리밍, 대본 낭독에 최적)
2. transformers.js whisper-tiny (40 MB, chunk 방식, 부분결과 어려움)
3. Whisper.cpp WASM tiny (75 MB, chunk 방식)

---

## 3. UX 레퍼런스 (숏폼/가라오케 라이브 자막)

### 3.1 레퍼런스 앱/플랫폼

| 앱 | STT 추정 | 자막 스타일 | 판정 UX |
|---|---|---|---|
| **TikTok 자동 자막** | 자체 서버 STT (sauropod 계열로 추정) | 화면 하단 1/3, 흰 글자 + 검정 shadow, 단어별 highlight | 없음 (기록용) |
| **YouTube Shorts 자동 자막** | Google ASR 서버 | 하단, Roboto bold, 노랑 highlight 옵션 | 없음 |
| **Instagram Reels** | Meta 자체 STT 서버 | 하단 중앙, 흰 pill 배경, fade-in per word | 없음 |
| **Smule (가라오케)** | 가사 파일 + 음정만 분석 (STT 없음) | 가라오케 스크롤 + 음정 그래프 | 음정 정확도% + 별점 |
| **Yousician (악기/노래)** | 음향 매칭 (가라오케 스타일) | 5선지 + 노트 highlight | perfect/good/miss 색상 flash |
| **Rap Chat / SuperStar JYP** | 가사 + 타이밍 매칭 (STT 미사용) | 가라오케 highlight | 타이밍 정확도 gauge |
| **Microsoft Reading Coach** | Azure ASR 서버 | 단어별 ko-KR highlight, 틀린 단어 빨강 | 완주 점수 + 파닉스 피드백 |
| **ELSA Speak (영어 발음)** | 자체 임베디드 모델 (최근 온디바이스화) | 문장 단위, 발음한 단어만 색칠 | 문장별 0-100 점수 |

### 3.2 공통 패턴 정리

1. **자막은 하단 1/3** (얼굴 가리지 않음). 현재 `liveCaption.ts` y=0.78~0.92 배치는 적절.
2. **폰트**: bold, 크기 음성 대비 일관성. 한국어는 Noto Sans KR Bold / Pretendard Bold 가 표준. 현재 system-ui+Noto fallback 적절.
3. **단어별 progressive highlight**: read_text 가 있는 프로젝트에 적합. 현재는 통짜 interim 표시 → `read_text` 의 단어를 기준으로 **이미 맞춘 부분은 초록/미맞춘 부분은 회색** 렌더하는 것이 UX 품질↑.
4. **판정 팝업**: perfect/good/soso/miss. 현재 `drawJudgementToast` 의 900-ish 폰트·800ms 페이드·scale-in 은 ELSA/Smule 수준의 감각에 근접.
5. **판정 트리거**: 발화 단위 (final transcript 단위)가 주류. 문장 종료 감지 = 침묵 ≥ 600ms or 문장부호 도달. 현재는 webkit 의 final 이벤트에 의존하며 이는 Google ASR 의 VAD 에 맡겨짐 → 타이밍이 불안정할 수 있음.

### 3.3 **가장 참고할 만한** 하나
**Microsoft Reading Coach** (reading.microsoft.com / Teams 내장): 한국어 포함, 정해진 read_text 에 대해 **단어 단위 진행도 + 틀린 단어 하이라이트 + 완주 점수** 를 제공한다. 현재 프로젝트의 voice_read 미션과 일대일 매칭. 다만 Azure 서버 STT 라 그대로는 못 쓰고, UX 패턴만 참조.

---

## 4. 추천안

### 4.1 추천: **Vosk-browser 를 voice_read 미션 전용으로 도입 + webkit 는 제거**

이유:
1. **§12 법적 준수**. webkit 은 구글 서버 전송 → 위반 가능성. Vosk 는 순수 클라이언트 (100%).
2. **대본 낭독 use case 에 최적**. Vosk 의 발음 사전 기반 디코딩은 open-domain 대화 성능은 낮지만 **주어진 단어셋 매칭**에는 강함.
3. **스트리밍 부분결과**. 500ms 단위로 interim 이 나와 "듣는 중 자막이 실시간으로 쌓임" UX 를 webkit 보다 오히려 더 잘 구현할 수 있음.
4. **iOS Safari 커버리지**. Whisper WASM 과 마찬가지로 WebAssembly 표준만 있으면 동작 [측정 필요 — README 상 Safari 명시 없음, 직접 확인 필요].
5. **모델 82MB** 는 voice_read 미션이 포함된 **특정 템플릿 선택 시점에만** 지연 로드 + IndexedDB 영구 캐시 → 두 번째부터 instant.

### 4.2 플랜 B (Vosk 가 iOS Safari 에서 실패할 경우)

transformers.js whisper-tiny + Worker + 1.5s sliding window chunking. 부분결과 구현 복잡하나 iOS 포함 최고 커버리지.

### 4.3 플랜 C (최소 변경)

현행 webkit 유지 + iOS/Firefox 는 "음성 미션은 Android/Chrome 에서 이용해 주세요" 배너 (이미 `checkSpeechCapability` 에 구현됨).
- 단점: §12 위반 미해결. 실기기 이슈(ASR stall) 재발.
- 단기 패치용으로만 허용.

### 4.4 구체 적용 단계 (Vosk 방안 기준)

1. **PoC 빌드 (0.5일)**
   - `vosk-browser` npm 설치, `vosk-model-small-ko-0.22.tar.gz` huggingface mirror 링크 확보.
   - `/debug/stt-vosk` 페이지 신규: 마이크 → 실시간 transcript 출력만.
   - Android Chrome / Desktop Chrome / iOS Safari 16/17 / Samsung Internet 4종 실기기 sanity test.

2. **VoskRecognizer 어댑터 (1일)**
   - `utils/voskRecognizer.ts` — `SttRecognizer` 인터페이스 (`sttFactory.ts` 에 이미 정의) 구현.
   - AudioWorklet 으로 16kHz downsample → vosk 에 feed.
   - onInterim = vosk partialResult, onFinal = vosk result.

3. **모델 로더 UX (0.5일)**
   - 템플릿 선택 화면에서 voice_read 미션 존재 시 백그라운드에서 fetch.
   - 스튜디오 진입 시 로드 미완료면 "음성 모델 준비중…" 진행바.
   - IndexedDB 캐시 (Cache API).

4. **자막 단어 하이라이트 (0.5일)**
   - `liveCaption.ts` 확장: `readText` 도 받아서 matched 단어 vs pending 단어 색 분리.
   - MS Reading Coach 패턴.

5. **sttFactory 전환 (0.2일)**
   - `resolveSttEngine()` 의 webkit 분기 제거. `WHISPER_ENABLED` 와 유사하게 `VOSK_ENABLED=true`.
   - `checkSpeechCapability()` 의 iOS 차단 메시지 제거.

6. **문서·검증 (0.3일)**
   - `CHECKLIST_PHASE_5.md` 에 4종 실기기 체크.
   - `PROGRESS.md` 한 줄.

**예상 총 난이도: M (중) · 예상 커밋 수: 5~7개 · 총 2~3일.**

---

## 5. 구현 난이도 요약

| 방안 | 난이도 | 예상 커밋 | §12 준수 | iOS 커버 | 품질 |
|---|---|---|---|---|---|
| Vosk 전면 전환 (추천) | **M** | 5-7 | ✅ | ✅ (예상) | ★★★★ |
| transformers.js Whisper + Worker | L | 8-12 | ✅ | ✅ | ★★★★★ |
| webkit 유지 + iOS 배너만 보강 | S | 1-2 | ❌ | ❌ | ★★★ |
| sherpa-onnx 도입 | L+ | 10+ | ✅ | ✅ | ★★★★★ |

---

## 6. 후속 조치 제안 (다음 세션)

- [ ] 본 문서 §2 수치들 중 "[측정 필요]" 표기 항목을 실기기로 측정.
- [ ] Vosk-browser `/debug/stt-vosk` PoC 스파이크 (1시간 박스).
- [ ] 결과 시 §4.4 단계 순차 실행, 실패 시 플랜 B 로 피벗.
- [ ] webkit 제거에 앞서 사용자(프로젝트 오너)의 §12 해석 확인: "Google ASR 로의 오디오 전송도 업로드로 간주하는가?" → YES 라면 webkit 즉시 제거 플래그.
