# Phase 3 — 녹화 파이프라인 (기본) 수동 체크리스트

Phase 3은 녹화 파이프라인의 **기본 뼈대**까지만 커버한다. 본격적인 레이어
컴포지션과 비트-싱크 연동은 Phase 5(docs/COMPOSITION.md)에서 추가된다.

## 3.1 코덱 네고시에이터 (`engine/recording/codecNegotiator.ts`)

- [ ] Chrome(데스크톱): `video/webm;codecs=vp9,opus` 선택되는지 콘솔 확인
- [ ] Safari: `video/mp4;codecs=avc1.42E01E,mp4a.40.2` 폴백되는지 확인
- [ ] Firefox: `video/webm;codecs=vp8,opus`로 떨어지는지 확인
- [ ] iOS Safari 실기: MIME 선택 실패 없이 녹화 시작
- [ ] `estimateTier(navigator)` deviceMemory=undefined(iOS)일 때 `'mid'` 반환
- [ ] MediaRecorder 생성자 없는 환경에서 `isRecordingSupported()=false`

## 3.2 MediaRecorder 래퍼 (`engine/recording/recorder.ts`)

- [ ] `start → pause → resume → stop` 상태 전이 정상 (UI에서 토글)
- [ ] 청크가 `timesliceMs` 간격으로 누적되는지 `getChunkCount()` 확인
- [ ] `stop()` 결과 Blob의 MIME 타입이 codec 선택값과 일치
- [ ] 탭 백그라운드로 전환 후 복귀 시에도 녹화 유지
- [ ] `onerror` 발생 시 UI에 "녹화 중단" 배너 표시 + state=error
- [ ] 중복 `start()` 호출 시 새 MediaRecorder 생성되지 않음

## 3.3 오디오 믹서 (`engine/recording/audioMixer.ts`)

- [ ] getUserMedia 스트림 → `connectMicSource` → MediaStream에 마이크 트랙 포함
- [ ] BGM 재생 중 사용자 발화 시 BGM 볼륨 약 −8dB 감쇠 (귀로 확인)
- [ ] 발화 종료 후 release 시간(약 300ms) 뒤 원래 볼륨으로 복귀
- [ ] SFX 트리거 시 BGM을 건드리지 않고 일회성 재생
- [ ] `setBgmVolume(v)` 비-덕킹 시 즉시 반영, 덕킹 중엔 release 후 새 기본값으로 복귀
- [ ] iOS: AudioContext `suspended` → 사용자 탭 후 `resume()` 정상 작동

## 3.4 단순 컴포지터 (`engine/recording/compositor.ts`)

- [ ] `start()` 후 requestAnimationFrame 루프가 도는지 DevTools Performance로 확인
- [ ] `targetFps=30` 설정 시 실제 draw 호출 간격이 ~33ms 근방
- [ ] `addRenderer(r)` 반환 함수로 unsubscribe 동작 (rendererCount 감소)
- [ ] 렌더러 하나에서 throw 해도 다른 렌더러는 계속 그려짐
- [ ] `stop()` 후 rAF 콜백이 더 이상 발화 안 함
- [ ] `drawOnce()` 호출로 녹화 기 외부에서 강제 프레임 가능

## 통합 체크

- [ ] Record → Stop 흐름: 결과 Blob을 `<video>`로 재생 성공
- [ ] 메모리: 5분 녹화 중 청크 누적량 `getBytes()` 모니터링
- [ ] CLAUDE.md §3 #16 준수: 코덱 문자열이 negotiator 외부에서 하드코딩되지 않음
- [ ] CLAUDE.md §4.4 준수: 오디오는 WebAudio 그래프로만 합성, 트랙 직결 금지
- [ ] 모든 Phase 3 Vitest 그린 — **codec 12 + recorder 8 + mixer 9 + compositor 9 = 38**

## 알려진 제한 (Phase 5에서 해결)

- 컴포지터는 레이어 우선순위/카메라 framing이 없다 → Phase 5a/5b
- 비트 동기화 훅 없음 → Phase 5d (BeatClock + ReactiveBinding)
- AR 스티커 레이어 없음 → Phase 5e
- PixiJS 포스트 이펙트 파이프라인 없음 → Phase 5f (사용자 승인 필요)
