/**
 * mockData.ts
 * Supabase 연결 없이 완전히 동작하는 로컬 목 데이터
 */
import type { Template } from '../types/template';
import type { UserSession, UserProfile } from '../types/session';

export const MOCK_TEMPLATES: Template[] = [
  {
    id: 'mock-001',
    name: 'K-POP 챌린지 베이직',
    genre: 'kpop',
    difficulty: 1,
    duration_sec: 15,
    bpm: 128,
    bgm_url: '',
    thumbnail_url: '',
    created_at: new Date().toISOString(),
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 3000,  text: '손을 위로 올려요!' },
      { start_ms: 3000,  end_ms: 6000,  text: '좌우로 펼쳐요!' },
      { start_ms: 6000,  end_ms: 10000, text: '하트 만들어요!' },
      { start_ms: 10000, end_ms: 15000, text: '마지막 포즈!' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 3000, type: 'pose',
        target_joints: { left_wrist: [0.20, 0.10], right_wrist: [0.80, 0.10] },
        threshold: 0.70, guide_text: '양손을 머리 위로!',
      },
      {
        seq: 2, start_ms: 3000, end_ms: 6000, type: 'pose',
        target_joints: { left_wrist: [0.05, 0.50], right_wrist: [0.95, 0.50] },
        threshold: 0.70, guide_text: '양손을 옆으로 쭉!',
      },
      {
        seq: 3, start_ms: 6000, end_ms: 10000, type: 'pose',
        target_joints: {
          left_wrist:  [0.40, 0.65],
          right_wrist: [0.60, 0.65],
          left_elbow:  [0.30, 0.50],
          right_elbow: [0.70, 0.50],
        },
        threshold: 0.65, guide_text: '하트 만들어!',
      },
      {
        seq: 4, start_ms: 10000, end_ms: 15000, type: 'pose',
        target_joints: { left_wrist: [0.50, 0.05], right_wrist: [0.50, 0.05] },
        threshold: 0.75, guide_text: '최후의 포즈!',
      },
    ],
  },
  {
    id: 'mock-002',
    name: '힙합 배틀 챌린지',
    genre: 'hiphop',
    difficulty: 2,
    duration_sec: 20,
    bpm: 95,
    bgm_url: '',
    thumbnail_url: '',
    created_at: new Date().toISOString(),
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 5000,  text: '크로스 암!' },
      { start_ms: 5000,  end_ms: 10000, text: '바운스!' },
      { start_ms: 10000, end_ms: 15000, text: '스핀 준비!' },
      { start_ms: 15000, end_ms: 20000, text: '피니시!' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 5000, type: 'pose',
        target_joints: {
          left_wrist:  [0.65, 0.40],
          right_wrist: [0.35, 0.40],
          left_elbow:  [0.55, 0.30],
          right_elbow: [0.45, 0.30],
        },
        threshold: 0.68, guide_text: '팔 크로스!',
      },
      {
        seq: 2, start_ms: 5000, end_ms: 10000, type: 'pose',
        target_joints: { left_wrist: [0.15, 0.30], right_wrist: [0.85, 0.30] },
        threshold: 0.65, guide_text: '양팔 넓게!',
      },
      {
        seq: 3, start_ms: 10000, end_ms: 15000, type: 'pose',
        target_joints: {
          left_shoulder: [0.35, 0.22],
          right_shoulder: [0.65, 0.22],
          left_hip: [0.40, 0.55],
          right_hip: [0.60, 0.55],
        },
        threshold: 0.60, guide_text: '상체 기울이기!',
      },
      {
        seq: 4, start_ms: 15000, end_ms: 20000, type: 'pose',
        target_joints: { left_wrist: [0.30, 0.15], right_wrist: [0.70, 0.15] },
        threshold: 0.72, guide_text: 'V 포즈!',
      },
    ],
  },
  {
    id: 'mock-003',
    name: '피트니스 스트레칭',
    genre: 'fitness',
    difficulty: 1,
    duration_sec: 30,
    bpm: 80,
    bgm_url: '',
    thumbnail_url: '',
    created_at: new Date().toISOString(),
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 8000,  text: '어깨 스트레칭' },
      { start_ms: 8000,  end_ms: 16000, text: '옆구리 늘리기' },
      { start_ms: 16000, end_ms: 24000, text: '팔 앞으로' },
      { start_ms: 24000, end_ms: 30000, text: '마무리 자세' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 8000, type: 'pose',
        target_joints: { left_wrist: [0.10, 0.22], right_wrist: [0.90, 0.22] },
        threshold: 0.65, guide_text: '팔 수평으로!',
      },
      {
        seq: 2, start_ms: 8000, end_ms: 16000, type: 'pose',
        target_joints: { left_wrist: [0.80, 0.05], right_wrist: [0.50, 0.50] },
        threshold: 0.60, guide_text: '왼쪽으로 기울기!',
      },
      {
        seq: 3, start_ms: 16000, end_ms: 24000, type: 'pose',
        target_joints: { left_wrist: [0.35, 0.30], right_wrist: [0.65, 0.30] },
        threshold: 0.68, guide_text: '팔 앞으로 뻗기!',
      },
      {
        seq: 4, start_ms: 24000, end_ms: 30000, type: 'pose',
        target_joints: { left_wrist: [0.50, 0.50], right_wrist: [0.50, 0.50] },
        threshold: 0.70, guide_text: '정면 자세!',
      },
    ],
  },
];

export const MOCK_USER_ID = 'mock-user-0001';

export const MOCK_PROFILE: UserProfile = {
  user_id: MOCK_USER_ID,
  preferred_genres: ['kpop', 'hiphop'],
  success_rates: {
    'mock-001': 0.72,
    'mock-002': 0.58,
  },
  total_sessions: 5,
  weak_joints: ['left_wrist', 'right_ankle'],
};

export const MOCK_SESSIONS: UserSession[] = [
  {
    id: 'session-001',
    user_id: MOCK_USER_ID,
    template_id: 'mock-001',
    recorded_at: new Date(Date.now() - 86400000).toISOString(),
    avg_score: 0.78,
    success_rate: 0.72,
    tag_timeline: [],
    video_url: null,
    edited_video_url: null,
  },
  {
    id: 'session-002',
    user_id: MOCK_USER_ID,
    template_id: 'mock-002',
    recorded_at: new Date(Date.now() - 172800000).toISOString(),
    avg_score: 0.61,
    success_rate: 0.58,
    tag_timeline: [],
    video_url: null,
    edited_video_url: null,
  },
];
