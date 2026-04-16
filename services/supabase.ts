/**
 * supabase.ts
 * 실 Supabase (templates 공개 읽기) + 로컬 게스트 세션 폴백
 */
import { createClient } from '@supabase/supabase-js';
import type { Template } from '../types/template';
import type { UserSession, UserProfile } from '../types/session';
import {
  MOCK_TEMPLATES,
  MOCK_SESSIONS,
  MOCK_PROFILE,
  MOCK_USER_ID,
} from './mockData';

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL      ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const HAS_SUPABASE =
  !!SUPABASE_URL && !SUPABASE_URL.includes('your-project-id');

export const supabase = HAS_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ──────────────────────────────────────────────
// 게스트 유저 ID (localStorage 영구 저장)
// ──────────────────────────────────────────────
function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return MOCK_USER_ID; // SSR 안전
  try {
    const key = 'mvp_guest_id';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const newId = `guest-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
    localStorage.setItem(key, newId);
    return newId;
  } catch {
    return MOCK_USER_ID;
  }
}

// ──────────────────────────────────────────────
// Auth — 익명 로그인 시도, 실패하면 게스트 ID
// ──────────────────────────────────────────────
export async function signInAnonymously(): Promise<string> {
  // 목 모드
  if (!supabase) return getOrCreateGuestId();

  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (!error && data.user?.id) return data.user.id;
  } catch {
    /* 익명 Auth 미활성 시 폴백 */
  }
  return getOrCreateGuestId();
}

export async function getCurrentUserId(): Promise<string> {
  if (!supabase) return getOrCreateGuestId();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? getOrCreateGuestId();
}

export function getMockUserId(): string | null {
  if (!HAS_SUPABASE) return MOCK_USER_ID;
  return null; // 실 Supabase 연결 시 null → 앱이 signInAnonymously 호출
}

// ──────────────────────────────────────────────
// Templates — 실 Supabase (공개 읽기)
// ──────────────────────────────────────────────
export async function fetchTemplates(options?: {
  genre?: Template['genre'];
  difficulty?: Template['difficulty'];
}): Promise<Template[]> {
  if (!supabase) {
    let list = [...MOCK_TEMPLATES];
    if (options?.genre)      list = list.filter(t => t.genre === options.genre);
    if (options?.difficulty) list = list.filter(t => t.difficulty === options.difficulty);
    return list;
  }
  try {
    let q = supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (options?.genre)      q = q.eq('genre', options.genre);
    if (options?.difficulty) q = q.eq('difficulty', options.difficulty);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Template[];
  } catch {
    // DB 오류 시 목 데이터 폴백
    return MOCK_TEMPLATES;
  }
}

export async function fetchTemplateById(id: string): Promise<Template> {
  if (!supabase) {
    return MOCK_TEMPLATES.find(t => t.id === id) ?? MOCK_TEMPLATES[0];
  }
  try {
    const { data, error } = await supabase
      .from('templates').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Template;
  } catch {
    return MOCK_TEMPLATES.find(t => t.id === id) ?? MOCK_TEMPLATES[0];
  }
}

// ──────────────────────────────────────────────
// User Sessions — 로컬 + Supabase 시도
// ──────────────────────────────────────────────
const _sessions: UserSession[] = [...MOCK_SESSIONS];

export async function createSession(
  session: Omit<UserSession, 'id' | 'recorded_at'>
): Promise<UserSession> {
  const newSession: UserSession = {
    ...session,
    id:          `session-${Date.now()}`,
    recorded_at: new Date().toISOString(),
  };
  _sessions.unshift(newSession);

  // Supabase 저장 시도 (실패해도 로컬에는 저장됨)
  if (supabase) {
    void supabase.from('user_sessions').insert(session);
  }
  return newSession;
}

export async function fetchUserSessions(userId: string): Promise<UserSession[]> {
  if (!supabase) return _sessions.filter(s => s.user_id === userId);
  try {
    const { data, error } = await supabase
      .from('user_sessions').select('*').eq('user_id', userId)
      .order('recorded_at', { ascending: false });
    if (error) throw error;
    return (data ?? _sessions) as UserSession[];
  } catch {
    return _sessions.filter(s => s.user_id === userId);
  }
}

export async function updateSessionVideo(
  sessionId: string,
  urls: { video_url?: string; edited_video_url?: string }
): Promise<void> {
  const s = _sessions.find(s => s.id === sessionId);
  if (s) Object.assign(s, urls);
  if (supabase) void supabase.from('user_sessions').update(urls).eq('id', sessionId);
}

// ──────────────────────────────────────────────
// User Profiles
// ──────────────────────────────────────────────
let _profile: UserProfile = { ...MOCK_PROFILE };

export async function upsertUserProfile(profile: UserProfile): Promise<void> {
  _profile = profile;
  if (supabase) {
    void supabase.from('user_profiles')
      .upsert({ ...profile, updated_at: new Date().toISOString() });
  }
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  if (!supabase) return _profile;
  try {
    const { data, error } = await supabase
      .from('user_profiles').select('*').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') return _profile;
    return (data ?? _profile) as UserProfile;
  } catch {
    return _profile;
  }
}

// ──────────────────────────────────────────────
// Storage
// ──────────────────────────────────────────────
export async function uploadVideo(
  userId: string, sessionId: string, fileUri: string, type: 'raw' | 'edited' = 'raw'
): Promise<string> {
  if (!supabase) return fileUri;
  try {
    const path = `${userId}/${sessionId}/${type}.mp4`;
    const blob = await fetch(fileUri).then(r => r.blob());
    await supabase.storage.from('videos').upload(path, blob, { contentType: 'video/mp4', upsert: true });
    return supabase.storage.from('videos').getPublicUrl(path).data.publicUrl;
  } catch {
    return fileUri;
  }
}
