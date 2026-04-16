/**
 * api.ts — FastAPI 서버 호출 레이어
 * 서버 없을 때 목 응답으로 자동 폴백
 */
import type { FrameTag } from '../types/session';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// 서버 연결 가능 여부 (localhost는 웹 배포 환경에서 불가)
const IS_LOCAL_API =
  !process.env.EXPO_PUBLIC_API_URL ||
  (process.env.EXPO_PUBLIC_API_URL ?? '').includes('localhost');

// ──────────────────────────────────────────────
// 자동 편집 요청
// ──────────────────────────────────────────────
export async function requestAutoEdit(
  videoUri: string,
  tagTimeline: FrameTag[]
): Promise<string> {
  // 목 모드: 1초 딜레이 후 원본 URI 반환
  if (IS_LOCAL_API && typeof window !== 'undefined') {
    await new Promise((r) => setTimeout(r, 1200));
    return videoUri;
  }

  const formData = new FormData();
  formData.append('video', {
    uri:  videoUri,
    type: 'video/mp4',
    name: 'raw.mp4',
  } as unknown as Blob);
  formData.append('tag_timeline', JSON.stringify(tagTimeline));

  const res = await fetch(`${API_BASE}/edit/auto`, {
    method: 'POST',
    body:   formData,
  });
  if (!res.ok) throw new Error(`편집 실패: ${await res.text()}`);

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ──────────────────────────────────────────────
// BGM 비트 분석
// ──────────────────────────────────────────────
export async function analyzeBgmBeats(
  audioUri: string
): Promise<{ bpm: number; beats: number[] }> {
  if (IS_LOCAL_API && typeof window !== 'undefined') {
    // 목: 120 BPM 기준 비트 배열 생성
    const bpm = 120;
    const beats = Array.from({ length: 30 }, (_, i) => +(i * (60 / bpm)).toFixed(3));
    return { bpm, beats };
  }

  const formData = new FormData();
  formData.append('audio', {
    uri:  audioUri,
    type: 'audio/mpeg',
    name: 'bgm.mp3',
  } as unknown as Blob);

  const res = await fetch(`${API_BASE}/analyze/beats`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('비트 분석 실패');
  return res.json();
}
