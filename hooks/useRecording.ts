/**
 * useRecording.ts
 *
 * 영상 녹화 전체 흐름 제어
 *  - 카운트다운 → 녹화 시작 → 자동 종료 (템플릿 duration 기준)
 *  - sessionStore 연동 (startSession / stopSession)
 *  - 완료 후 videoUri 반환
 */

import { useState, useRef, useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import type { RecordingCameraHandle } from '../components/camera/RecordingCamera';

export type RecordingState = 'idle' | 'countdown' | 'recording' | 'processing' | 'done';

interface UseRecordingReturn {
  state:      RecordingState;
  countdown:  number;         // 카운트다운 남은 초 (3→2→1→0)
  elapsed:    number;         // 녹화 경과 ms
  videoUri:   string | null;
  start:      (cameraHandle: RecordingCameraHandle) => void;
  stop:       (cameraHandle: RecordingCameraHandle) => void;
  reset:      () => void;
}

const COUNTDOWN_SEC = 3;

export function useRecording(): UseRecordingReturn {
  const [state, setState]       = useState<RecordingState>('idle');
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [elapsed, setElapsed]   = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const { activeTemplate, startSession, stopSession } = useSessionStore();
  const elapsedRef  = useRef(0);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

  // ── 카운트다운 + 녹화 시작 ──────────────────
  const start = useCallback((cameraHandle: RecordingCameraHandle) => {
    if (state !== 'idle') return;
    if (!activeTemplate) return;

    durationRef.current = activeTemplate.duration_sec * 1000;
    setState('countdown');
    setCountdown(COUNTDOWN_SEC);
    let cdRemain = COUNTDOWN_SEC;

    const cdTimer = setInterval(() => {
      cdRemain -= 1;
      setCountdown(cdRemain);

      if (cdRemain <= 0) {
        clearInterval(cdTimer);
        _beginRecording(cameraHandle);
      }
    }, 1000);
  }, [state, activeTemplate]);

  const _beginRecording = useCallback((cameraHandle: RecordingCameraHandle) => {
    const template = useSessionStore.getState().activeTemplate;
    if (!template) return;

    setState('recording');
    // NOTE: startSession already called in home screen; calling stopSession+start
    // here just updates isRecording flag without resetting frameTags again.
    useSessionStore.getState().stopSession();
    useSessionStore.getState().startSession(template);

    elapsedRef.current = 0;
    setElapsed(0);

    // 경과 타이머 (자동 종료는 stop ref로 처리)
    timerRef.current = setInterval(() => {
      elapsedRef.current += 100;
      setElapsed(elapsedRef.current);

      if (elapsedRef.current >= durationRef.current) {
        clearInterval(timerRef.current!);
        useSessionStore.getState().stopSession();
        setState('processing');
        cameraHandle.stopRecording();
      }
    }, 100);

    // 카메라 녹화 시작 → 완료 후 uri 수신
    cameraHandle.startRecording().then((uri) => {
      setVideoUri(uri);
      setState('done');
    }).catch(() => {
      setState('idle');
    });
  }, [startSession]);

  // ── 수동 중지 ────────────────────────────────
  const stop = useCallback((cameraHandle: RecordingCameraHandle) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopSession();
    setState('processing');
    cameraHandle.stopRecording();
  }, [stopSession]);

  // ── 리셋 ────────────────────────────────────
  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState('idle');
    setCountdown(COUNTDOWN_SEC);
    setElapsed(0);
    setVideoUri(null);
    elapsedRef.current = 0;
  }, []);

  return { state, countdown, elapsed, videoUri, start, stop, reset };
}
