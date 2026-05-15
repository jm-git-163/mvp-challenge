# docs/EDGE_CASES.md — 엣지 케이스 및 에러 복구

> Phase 7 완료 전 이 문서의 모든 항목에 대응 구현 완료해야 함.

## 1. 권한 관련

| 상황 | 처리 |
|---|---|
| 카메라·마이크 둘 다 거부 | `/permissions/denied` 화면 + 브라우저별 설정 안내 + 재시도 버튼 |
| 카메라만 거부 | 음성 미션만 있는 템플릿은 진행 가능 안내, 영상 미션은 비활성 |
| 마이크만 거부 | 영상 미션만 가능 안내 |
| 권한 허용 후 브라우저 설정에서 철회 | 촬영 중이면 `getVideoTracks()[0].readyState='ended'` 감지 → 저장 후 안내 |
| 다른 탭에서 카메라 사용 중 | `getUserMedia` 에러 `NotReadableError` → 탭 닫고 재시도 안내 |
| 카메라 물리적으로 없음 | `NotFoundError` → "카메라가 없는 기기" 안내, PC에 웹캠 연결 유도 |

## 2. 촬영 중단 상황

| 상황 | 처리 |
|---|---|
| 탭 백그라운드 | `visibilitychange hidden` 감지 → recorder.stop() + `isPaused=true` 플래그, 돌아왔을 때 "녹화가 중단되었습니다. 지금까지 결과로 진행할까요?" |
| 전화 수신(모바일) | 동일 (OS가 탭을 suspend) |
| 배터리 5% 미만 | Battery API로 감지 (지원 시), 촬영 시작 전 경고 |
| 스토리지 부족 | `navigator.storage.estimate()` 촬영 예상 용량 대비 부족 시 경고 |
| USB 웹캠 분리 | 트랙 ended 이벤트 → 저장 후 결과 페이지 |
| 마이크 음소거(OS) | 오디오 레벨 지속 0 감지 → "마이크가 음소거 상태인지 확인해주세요" 토스트 (**촬영 시작 전에만**) |

## 3. 인식 엔진 실패

| 상황 | 처리 |
|---|---|
| 모델 다운로드 실패 | 재시도 3회 → 실패 시 네트워크 안내 + 오프라인 진입 불가 안내 |
| 포즈 감지 신뢰도 지속 낮음 | "전신이 프레임에 들어오도록 한 걸음 물러서주세요" 오버레이 |
| 사용자가 프레임 밖으로 나감 | 10초 이상 미검출 시 "카메라 앞으로 돌아와주세요" 안내, 타이머 일시정지 |
| SpeechRecognition 네트워크 에러(iOS) | 자동 재시작 로직, 3회 연속 실패 시 음성 미션 스킵 + 점수 0 |
| 조명 너무 어두움 | 캔버스 평균 밝기 임계값 이하 감지 시 "더 밝은 곳에서 촬영해주세요" |

## 4. 녹화·합성 실패

| 상황 | 처리 |
|---|---|
| MediaRecorder 코덱 모두 미지원 | 에러 화면 "이 브라우저에서 녹화가 지원되지 않습니다" + 지원 브라우저 안내 |
| 녹화 파일 0바이트 | 청크 수집 로직 버그 → 재시도 유도 + 에러 리포트 |
| Blob 조립 실패 | 청크 개수·크기 로깅 → 폴백으로 청크만 다운로드 |
| canvas.captureStream throttling (탭 비활성) | visibilitychange 대응과 동일 |
| audioMixer AudioContext suspended | 사용자 제스처 필요 안내 + 버튼 |

## 5. UI 전역

| 상황 | 처리 |
|---|---|
| JavaScript 에러 | Error Boundary 최상단 + 촬영 영역 각각 → "다시 시작하기" 버튼, 에러 로그 console |
| 네트워크 끊김 | `online/offline` 이벤트 → 모델 로드 전이면 에러, 로드 후면 정상 진행 가능 (전부 클라이언트) |
| 느린 네트워크 | 모델 로드 진행바, 15초 초과 시 "네트워크가 느립니다" 안내 |
| 브라우저 회전 | 가로 모드 감지 → "세로로 돌려주세요" 전체화면 안내 |
| 화면 사이즈 너무 작음 (<320px) | 축소 경고 |

## 6. 사용자 실수

| 상황 | 처리 |
|---|---|
| 시작 버튼 연타 | debounce 500ms, 촬영 시작 후 버튼 비활성 |
| 촬영 중 새로고침 | `beforeunload` 핸들러로 확인 다이얼로그 (단 촬영 중에만) |
| 뒤로가기 버튼 | 녹화 중이면 "중단하시겠습니까?" 확인 |
| 결과 페이지 떠나기 전 다운로드 안 함 | `beforeunload` "녹화본이 저장되지 않았습니다" 경고 |

## 7. 로깅·디버그

- `console.error`로 에러 로깅 (외부 전송 금지 — §CLAUDE §11)
- `/debug` 페이지에서 마지막 에러 로그 열람
- Error Boundary fallback에 "에러 정보 복사" 버튼 (사용자가 수동으로 제보 시)

## 8. Error Boundary 배치

```
<RootErrorBoundary>            // 최상단, 전체 크래시 대응
  <PermissionGate>
    <StudioErrorBoundary>      // 카메라/녹화 영역
      <CameraStage />
    </StudioErrorBoundary>
    <EngineErrorBoundary>      // MediaPipe 영역
      <RecognitionEngines />
    </EngineErrorBoundary>
  </PermissionGate>
</RootErrorBoundary>
```

## 9. 체크리스트

- [ ] 각 상황별 복구 UI 구현
- [ ] 테스트: 개발자도구로 권한 토글, 네트워크 오프라인, 탭 숨김 재현
- [ ] Error Boundary 3곳 이상 배치
- [ ] 모든 async 작업 try/catch
- [ ] `console.error` 로 에러 메시지 한국어 + 기술 원인 병기
