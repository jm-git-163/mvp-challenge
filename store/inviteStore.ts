/**
 * store/inviteStore.ts
 *
 * 챌린지 초대-답장 시스템 전역 상태.
 * 100% 클라이언트. 서버 저장 없음 (CLAUDE.md §12).
 *
 * - inviteContext: 친구가 보낸 도전장으로 진입한 경우 세팅. record → result 구간 살아남아
 *   결과 화면에서 "답장 보내기" 버튼을 노출하기 위함.
 * - mySenderName: 내가 친구에게 도전장 보낼 때 캡션에 쓸 내 이름. 기본 "친구".
 */
import { create } from 'zustand';
import type { InviteContext } from '../utils/inviteLinks';

interface StoredInvite extends InviteContext {
  /** epoch ms — 도전장 수신 시각 */
  receivedAt: number;
  /** 수신자가 본 원본 URL (답장 캡션 꼬리에 그대로 붙임) */
  originalInviteUrl: string;
}

interface InviteState {
  inviteContext: StoredInvite | null;
  mySenderName: string;

  setInviteContext: (ctx: InviteContext, originalInviteUrl: string) => void;
  clearInvite: () => void;
  setMySenderName: (name: string) => void;
}

export const useInviteStore = create<InviteState>((set) => ({
  inviteContext: null,
  mySenderName: '친구',

  setInviteContext: (ctx, originalInviteUrl) =>
    set({
      inviteContext: {
        ...ctx,
        receivedAt: Date.now(),
        originalInviteUrl,
      },
    }),

  clearInvite: () => set({ inviteContext: null }),
  setMySenderName: (name) => set({ mySenderName: (name || '친구').slice(0, 40) }),
}));
