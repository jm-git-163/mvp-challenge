/**
 * useRecording.ts — 영상 녹화 전체 흐름 제어
 *
 * 핵심 수정:
 *  - stateRef: start()가 항상 최신 state를 읽도록 (stale closure 버그 수정)
 *  - Tabs 네비게이터에서 화면이 캐시되어도 state를 ref로 추적
 */
import { useState, useRef, useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import type { RecordingCameraHandle } from '../components/camera/RecordingCamera';
import { getBgmPlayer } from '../utils/bgmLibrary';

export type RecordingState = 'idle' | 'countdown' | 'recording' | 'processing' | 'done';

interface UseRecordingReturn {
  state:     RecordingState;
  countdown: number;
  elapsed:   number;
  videoUri:  string | null;
  start:     (cameraHandle: RecordingCameraHandle) => void;
  stop:      (cameraHandle: RecordingCameraHandle) => void;
  reset:     () => void;
}

const COUNTDOWN_SEC = 3;

export function useRecording(): UseRecordingReturn {
  const [state, _setState]     = useState<RecordingState>('idle');
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [elapsed, setElapsed]  = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  // stateRef: start/stop/reset callbacks always read the latest state
  const stateRef = useRef<RecordingState>('idle');
  const setState = useCallback((s: RecordingState) => {
    stateRef.current = s;
    _setState(s);
  }, []);

  const elapsedRef  = useRef(0);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const cdTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const _beginRecording = useCallback(async (cameraHandle: RecordingCameraHandle) => {
    const template = useSessionStore.getState().activeTemplate;
    if (!template) return;

    setState('recording');
    // markRecordingStarted: frameTags 리셋 + isRecording=true (activeTemplate/sessionKey 변경 없음)
    useSessionStore.getState().markRecordingStarted();

    elapsedRef.current = 0;
    setElapsed(0);

    timerRef.current = setInterval(() => {
      elapsedRef.current += 100;
      setElapsed(elapsedRef.current);

      if (elapsedRef.current >= durationRef.current) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        useSessionStore.getState().stopSession();
        setState('processing');
        cameraHandle.stopRecording();
      }
    }, 100);

    // FIX-R: BGM 을 시작한 뒤(최대 500ms 대기) MediaRecorder 를 켠다.
    //   순서가 뒤집히면 BgmPlayer 의 gain 노드가 아직 생성 전이라
    //   RecordingCamera.web.tsx 의 오디오 믹서가 BGM 을 못 잡아 결과 영상에 BGM 누락.
    try {
      const startedAt = Date.now();
      while (!getBgmPlayer().getOutputNode() && Date.now() - startedAt < 500) {
        await new Promise(r => setTimeout(r, 40));
      }
    } catch {}

    cameraHandle.startRecording().then((uri) => {
      setVideoUri(uri);
      setState('done');
    }).catch(() => {
      setState('idle');
    });
  }, [setState]);

  // start: uses stateRef so it ALWAYS reads the current state, not a stale closure
  const start = useCallback((cameraHandle: RecordingCameraHandle) => {
    if (stateRef.current !== 'idle') return;      // ← stateRef, not state
    const activeTemplate = useSessionStore.getState().activeTemplate;
    if (!activeTemplate) return;

    durationRef.current = activeTemplate.duration_sec * 1000;
    setState('countdown');
    setCountdown(COUNTDOWN_SEC);
    let cdRemain = COUNTDOWN_SEC;

    if (cdTimerRef.current) clearInterval(cdTimerRef.current);
    cdTimerRef.current = setInterval(() => {
      cdRemain -= 1;
      setCountdown(cdRemain);
      if (cdRemain <= 0) {
        clearInterval(cdTimerRef.current!);
        cdTimerRef.current = null;
        _beginRecording(cameraHandle);
      }
    }, 1000);
  }, [_beginRecording, setState]);

  const stop = useCallback((cameraHandle: RecordingCameraHandle) => {
    if (timerRef.current)   { clearInterval(timerRef.current);   timerRef.current = null; }
    if (cdTimerRef.current) { clearInterval(cdTimerRef.current); cdTimerRef.current = null; }
    useSessionStore.getState().stopSession();
    setState('processing');
    cameraHandle.stopRecording();
  }, [setState]);

  const reset = useCallback(() => {
    if (timerRef.current)   { clearInterval(timerRef.current);   timerRef.current = null; }
    if (cdTimerRef.current) { clearInterval(cdTimerRef.current); cdTimerRef.current = null; }
    setState('idle');
    setCountdown(COUNTDOWN_SEC);
    setElapsed(0);
    setVideoUri(null);
    elapsedRef.current = 0;
  }, [setState]);

  return { state, countdown, elapsed, videoUri, start, stop, reset };
}
