import { create } from 'zustand';
import type { FrameTag, UserSession } from '../types/session';
import type { Template } from '../types/template';

interface SessionState {
  // 현재 촬영 세션
  activeTemplate: Template | null;
  /**
   * 홈에서 챌린지를 선택할 때마다 증가.
   * 같은 챌린지를 다시 선택해도 값이 달라져서 record 화면이 항상 리셋됨.
   */
  sessionKey: number;
  frameTags: FrameTag[];
  isRecording: boolean;
  recordingStartedAt: number | null;

  // 완료된 세션
  lastSession: UserSession | null;

  // 액션
  /** 홈에서 챌린지 선택 시 호출 — sessionKey 증가 + template 설정 */
  startSession: (template: Template) => void;
  /** 카운트다운 종료 후 실제 녹화 시작 시 호출 — activeTemplate 변경 없이 frameTags만 리셋 */
  markRecordingStarted: () => void;
  appendFrameTag: (tag: FrameTag) => void;
  stopSession: () => void;
  setLastSession: (session: UserSession) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeTemplate: null,
  sessionKey: 0,
  frameTags: [],
  isRecording: false,
  recordingStartedAt: null,
  lastSession: null,

  startSession: (template) =>
    set((s) => ({
      activeTemplate: template,
      sessionKey: s.sessionKey + 1,   // ← 항상 증가 → 같은 챌린지 재선택도 감지
      frameTags: [],
      isRecording: false,
      recordingStartedAt: null,
    })),

  markRecordingStarted: () =>
    set({
      frameTags: [],
      isRecording: true,
      recordingStartedAt: Date.now(),
    }),

  appendFrameTag: (tag) =>
    set((s) => ({ frameTags: [...s.frameTags, tag] })),

  stopSession: () =>
    set({ isRecording: false }),

  setLastSession: (session) =>
    set({ lastSession: session }),

  reset: () =>
    set({
      activeTemplate: null,
      frameTags: [],
      isRecording: false,
      recordingStartedAt: null,
    }),
}));
