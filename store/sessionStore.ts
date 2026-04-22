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

  // FIX-S: 녹화 중 BGM 재생은 하지 않지만, 선택된 장르의 BGM URL 을 미리 저장해
  //   포스트 컴포지터(완성 영상 만들기)에서 참조하도록 보관.
  pendingBgmUrl: string | null;
  /** 녹화 중 수집된 이벤트 타임라인 (post-compositor 가 레이어 트리거에 사용) */
  eventTimeline: Array<{ tMs: number; type: string; payload?: any }>;

  // 액션
  /** 홈에서 챌린지 선택 시 호출 — sessionKey 증가 + template 설정 */
  startSession: (template: Template) => void;
  /** 카운트다운 종료 후 실제 녹화 시작 시 호출 — activeTemplate 변경 없이 frameTags만 리셋 */
  markRecordingStarted: () => void;
  appendFrameTag: (tag: FrameTag) => void;
  stopSession: () => void;
  setLastSession: (session: UserSession) => void;
  setPendingBgmUrl: (url: string | null) => void;
  pushTimelineEvent: (ev: { tMs: number; type: string; payload?: any }) => void;
  resetTimeline: () => void;
  reset: () => void;
  /**
   * Team RELIABILITY (2026-04-22): 결과 화면 "다시 찍기" 용 완전 리셋.
   * activeTemplate 제외 모든 휘발성 상태를 0 으로 되돌리고 sessionKey 를 증가시켜
   * record 화면이 멱등 remount 로 동작하게 함.
   */
  fullResetForRetake: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeTemplate: null,
  sessionKey: 0,
  frameTags: [],
  isRecording: false,
  recordingStartedAt: null,
  lastSession: null,
  pendingBgmUrl: null,
  eventTimeline: [],

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

  setPendingBgmUrl: (url) => set({ pendingBgmUrl: url }),
  pushTimelineEvent: (ev) =>
    set((s) => ({ eventTimeline: [...s.eventTimeline, ev] })),
  resetTimeline: () => set({ eventTimeline: [] }),

  setLastSession: (session) =>
    set({ lastSession: session }),

  reset: () =>
    set({
      activeTemplate: null,
      frameTags: [],
      isRecording: false,
      recordingStartedAt: null,
      pendingBgmUrl: null,
      eventTimeline: [],
    }),

  fullResetForRetake: () =>
    set((s) => ({
      // activeTemplate 은 result 화면에서 다시 startSession 호출로 세팅됨.
      //  여기선 "지난 세션" 잔존물만 전부 제거 + sessionKey 증가.
      sessionKey: s.sessionKey + 1,
      frameTags: [],
      isRecording: false,
      recordingStartedAt: null,
      pendingBgmUrl: null,
      eventTimeline: [],
      lastSession: null,
    })),
}));
