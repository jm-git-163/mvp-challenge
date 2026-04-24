/**
 * store/inviteStore.ts
 *
 * 챌린지 초대 시스템 전역 상태.
 * 100% 클라이언트. 서버 저장 없음 (CLAUDE.md §12).
 *
 * - inviteContext: 친구가 보낸 도전장으로 진입한 경우 세팅. record → result
 *   구간 살아남아 "OO님이 보낸 도전장을 완료했어요" 힌트 표기에 쓰인다.
 *   답장(reply) 기능은 제거됨 — 서버 없이는 원 초대자에게 되돌아갈 back-channel이
 *   보장되지 않기 때문. 상세는 utils/share.ts 의 NOTE 참조.
 * - mySenderName: 내가 친구에게 도전장 보낼 때 캡션에 쓸 내 이름. 기본 "친구".
 */
import { create } from 'zustand';
import type { InviteContext } from '../utils/inviteLinks';

interface StoredInvite extends InviteContext {
  /** epoch ms — 도전장 수신 시각 */
  receivedAt: number;
}

interface InviteState {
  inviteContext: StoredInvite | null;
  mySenderName: string;

  setInviteContext: (ctx: InviteContext) => void;
  clearInvite: () => void;
  setMySenderName: (name: string) => void;
}

export const useInviteStore = create<InviteState>((set) => ({
  inviteContext: null,
  mySenderName: '친구',

  setInviteContext: (ctx) =>
    set({
      inviteContext: {
        ...ctx,
        receivedAt: Date.now(),
      },
    }),

  clearInvite: () => set({ inviteContext: null }),
  setMySenderName: (name) => set({ mySenderName: (name || '친구').slice(0, 40) }),
}));
