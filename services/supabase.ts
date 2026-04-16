/**
 * supabase.ts
 * 실 Supabase 연결 — 환경변수 없을 때 목 데이터 자동 폴백
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

// 실 Supabase 여부
export const HAS_SUPABASE =
  !!SUPABASE_URL &&
  !SUPABASE_URL.includes('your-project-id');

// Supabase 클라이언트 (환경변수 있을 때만 생성)
export const supabase = HAS_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// 목 세션 저장소 (메모리)
const _localSessions: UserSession[] = [...MOCK_SESSIONS];
let   _localProfile: UserProfile    = { ...MOCK_PROFILE };

// ──────────────────────────────────────────────
// Auth: 익명 로그인 (세션/프로필 RLS 우회용)
// ──────────────────────────────────────────────
export async function signInAnonymously(): Promise<string | null> {
  if (!supabase) return MOCK_USER_ID;
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return MOCK_USER_ID;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
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

  let query = supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.genre)      query = query.eq('genre', options.genre);
  if (options?.difficulty) query = query.eq('difficulty', options.difficulty);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Template[];
}

export async function fetchTemplateById(id: string): Promise<Template> {
  if (!supabase) {
    const t = MOCK_TEMPLATES.find(t => t.id === id);
    if (!t) throw new Error('Template not found');
    return t;
  }
  const { data, error } = await supabase
    .from('templates').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Template;
}

// ──────────────────────────────────────────────
// User Sessions
// ──────────────────────────────────────────────
export async function createSession(
  session: Omit<UserSession, 'id' | 'recorded_at'>
): Promise<UserSession> {
  const newSession: UserSession = {
    ...session,
    id:          `session-${Date.now()}`,
    recorded_at: new Date().toISOString(),
  };

  if (!supabase) {
    _localSessions.unshift(newSession);
    return newSession;
  }

  const { data, error } = await supabase
    .from('user_sessions').insert(session).select().single();
  if (error) {
    // RLS 실패(익명 미로그인) 시 로컬 저장
    _localSessions.unshift(newSession);
    return newSession;
  }
  return data as UserSession;
}

export async function fetchUserSessions(userId: string): Promise<UserSession[]> {
  if (!supabase) return _localSessions.filter(s => s.user_id === userId);
  const { data, error } = await supabase
    .from('user_sessions').select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false });
  if (error) return _localSessions;
  return (data ?? []) as UserSession[];
}

export async function updateSessionVideo(
  sessionId: string,
  urls: { video_url?: string; edited_video_url?: string }
): Promise<void> {
  const s = _localSessions.find(s => s.id === sessionId);
  if (s) Object.assign(s, urls);
  if (!supabase) return;
  await supabase.from('user_sessions').update(urls).eq('id', sessionId);
}

// ──────────────────────────────────────────────
// User Profiles
// ──────────────────────────────────────────────
export async function upsertUserProfile(profile: UserProfile): Promise<void> {
  _localProfile = profile;
  if (!supabase) return;
  await supabase.from('user_profiles')
    .upsert({ ...profile, updated_at: new Date().toISOString() });
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return _localProfile;
  const { data, error } = await supabase
    .from('user_profiles').select('*').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') return _localProfile;
  return (data ?? _localProfile) as UserProfile;
}

// ──────────────────────────────────────────────
// Storage: 영상 업로드
// ──────────────────────────────────────────────
export async function uploadVideo(
  userId: string,
  sessionId: string,
  fileUri: string,
  type: 'raw' | 'edited' = 'raw'
): Promise<string> {
  if (!supabase) return fileUri;
  try {
    const path = `${userId}/${sessionId}/${type}.mp4`;
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const { error } = await supabase.storage
      .from('videos').upload(path, blob, { contentType: 'video/mp4', upsert: true });
    if (error) return fileUri;
    return supabase.storage.from('videos').getPublicUrl(path).data.publicUrl;
  } catch {
    return fileUri;
  }
}

export function getMockUserId() {
  return !HAS_SUPABASE ? MOCK_USER_ID : null;
}
