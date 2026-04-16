import { create } from 'zustand';
import type { UserProfile } from '../types/session';

interface UserState {
  userId: string | null;
  profile: UserProfile | null;
  setUserId: (id: string) => void;
  setProfile: (profile: UserProfile) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  profile: null,

  setUserId: (id) => set({ userId: id }),
  setProfile: (profile) => set({ profile }),
  logout: () => set({ userId: null, profile: null }),
}));
