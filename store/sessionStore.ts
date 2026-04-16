import { create } from 'zustand';
import type { FrameTag, UserSession } from '../types/session';
import type { Template } from '../types/template';

interface SessionState {
  // 현재 촬영 세션
  activeTemplate: Template | null;
  frameTags: FrameTag[];
  isRecording: boolean;
  recordingStartedAt: number | null;

  // 완료된 세션
  lastSession: UserSession | null;

  // 액션
  startSession: (template: Template) => void;
  appendFrameTag: (tag: FrameTag) => void;
  stopSession: () => void;
  setLastSession: (session: UserSession) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeTemplate: null,
  frameTags: [],
  isRecording: false,
  recordingStartedAt: null,
  lastSession: null,

  startSession: (template) =>
    set({
      activeTemplate: template,
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
