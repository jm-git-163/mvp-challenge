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

    // FIX-S: 녹화 중 BGM 재생 없음 → 대기 불필요. 바로 MediaRecorder 시작.

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

    // FIX-INVITE-KAKAO-LOOP (2026-04-24): 초대 경로에서 layered/비규격 템플릿이
    //   흘러들어와 duration_sec 가 undefined 면 NaN → 타이머 무한루프 / 즉시 종료.
    //   최소 15초 / 최대 120초 범위로 clamp. `duration` (legacy) 도 수용.
    const rawDur = (typeof activeTemplate.duration_sec === 'number' ? activeTemplate.duration_sec : undefined)
      ?? (typeof (activeTemplate as any).duration === 'number' ? (activeTemplate as any).duration : undefined);
    const safeDurSec = typeof rawDur === 'number' && isFinite(rawDur) && rawDur > 0
      ? Math.min(120, Math.max(5, rawDur))
      : 20; // fallback — 20s 기본 촬영
    durationRef.current = safeDurSec * 1000;
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
