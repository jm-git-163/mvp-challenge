/**
 * mockData.ts — 풍부한 목 데이터 (제스처 미션 포함)
 */
import type { Template } from '../types/template';
import type { UserSession, UserProfile } from '../types/session';

export const MOCK_TEMPLATES: Template[] = [
  // ── 1. 관광지 인증 챌린지 ──
  {
    id: 'mock-001',
    name: '관광지 인증 챌린지',
    genre: 'travel',
    difficulty: 1,
    duration_sec: 15,
    bpm: 110,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🗺️',
    scene: '여행지, 핫플, 카페 앞 등 배경이 있는 곳에서!',
    created_at: new Date().toISOString(),
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 3500,  text: '🗺️ 어디야? 배경 보여줘!',  style: 'bold' },
      { start_ms: 3500,  end_ms: 7000,  text: '✌️ 여기 왔어요~',          style: 'highlight' },
      { start_ms: 7000,  end_ms: 11000, text: '📸 인증샷 찍어줘!',         style: 'normal' },
      { start_ms: 11000, end_ms: 15000, text: '🙌 여기 강추입니다!!',       style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 3500,
        type: 'timing', threshold: 0.6,
        guide_text: '카메라 정면 응시!', guide_emoji: '📷',
      },
      {
        seq: 2, start_ms: 3500, end_ms: 7000,
        type: 'gesture', gesture_id: 'v_sign', threshold: 0.65,
        guide_text: 'V 사인!', guide_emoji: '✌️',
      },
      {
        seq: 3, start_ms: 7000, end_ms: 11000,
        type: 'gesture', gesture_id: 'point_cam', threshold: 0.65,
        guide_text: '카메라 가리켜!', guide_emoji: '👉',
      },
      {
        seq: 4, start_ms: 11000, end_ms: 15000,
        type: 'gesture', gesture_id: 'hands_up', threshold: 0.70,
        guide_text: '양손 번쩍!', guide_emoji: '🙌',
      },
    ],
  },

  // ── 2. 신상템 언박싱 챌린지 ──
  {
    id: 'mock-002',
    name: '신상템 언박싱 챌린지',
    genre: 'promotion',
    difficulty: 1,
    duration_sec: 20,
    bpm: 120,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🛍️',
    scene: '새로 산 아이템을 카메라 앞에서 소개해보세요!',
    created_at: new Date().toISOString(),
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 4000,  text: '🛍️ 이거 봐봐요!!!',          style: 'bold' },
      { start_ms: 4000,  end_ms: 8000,  text: '👆 두두등장~',               style: 'highlight' },
      { start_ms: 8000,  end_ms: 13000, text: '😍 완전 대박이에요',          style: 'normal' },
      { start_ms: 13000, end_ms: 17000, text: '👍 이거 진짜 강추!!',         style: 'bold' },
      { start_ms: 17000, end_ms: 20000, text: '🤩 구경 와줘서 감사해요~',    style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'gesture', gesture_id: 'arms_spread', threshold: 0.65,
        guide_text: '아이템 들고 두 팔 벌려!', guide_emoji: '🙆',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 8000,
        type: 'gesture', gesture_id: 'hands_up', threshold: 0.68,
        guide_text: '아이템 번쩍 들어올려!', guide_emoji: '🙌',
      },
      {
        seq: 3, start_ms: 8000, end_ms: 13000,
        type: 'gesture', gesture_id: 'point_cam', threshold: 0.65,
        guide_text: '카메라에 가까이!', guide_emoji: '📸',
      },
      {
        seq: 4, start_ms: 13000, end_ms: 17000,
        type: 'gesture', gesture_id: 'thumbs_up', threshold: 0.70,
        guide_text: '엄지 척!', guide_emoji: '👍',
      },
      {
        seq: 5, start_ms: 17000, end_ms: 20000,
        type: 'gesture', gesture_id: 'wave', threshold: 0.65,
        guide_text: '손 흔들며 마무리!', guide_emoji: '👋',
      },
    ],
  },

  // ── 3. 일상 브이로그 챌린지 ──
  {
    id: 'mock-003',
    name: '오늘의 브이로그 챌린지',
    genre: 'daily',
    difficulty: 1,
    duration_sec: 15,
    bpm: 100,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '📱',
    scene: '오늘 하루를 영상으로 기록해보세요!',
    created_at: new Date().toISOString(),
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3000,  text: '👋 안녕하세요~!',            style: 'highlight' },
      { start_ms: 3000, end_ms: 7000,  text: '💝 오늘도 좋은 하루!',        style: 'bold' },
      { start_ms: 7000, end_ms: 11000, text: '✌️ 오늘의 브이로그!',         style: 'normal' },
      { start_ms: 11000,end_ms: 15000, text: '❤️ 구독 좋아요 눌러줘요!',    style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 3000,
        type: 'gesture', gesture_id: 'wave', threshold: 0.65,
        guide_text: '손 흔들어 인사!', guide_emoji: '👋',
      },
      {
        seq: 2, start_ms: 3000, end_ms: 7000,
        type: 'gesture', gesture_id: 'heart', threshold: 0.68,
        guide_text: '하트 만들기!', guide_emoji: '💝',
      },
      {
        seq: 3, start_ms: 7000, end_ms: 11000,
        type: 'gesture', gesture_id: 'v_sign', threshold: 0.65,
        guide_text: 'V 사인!', guide_emoji: '✌️',
      },
      {
        seq: 4, start_ms: 11000, end_ms: 15000,
        type: 'gesture', gesture_id: 'thumbs_up', threshold: 0.68,
        guide_text: '엄지 척!', guide_emoji: '👍',
      },
    ],
  },

  // ── 4. K-POP 챌린지 ──
  {
    id: 'mock-004',
    name: 'K-POP 댄스 챌린지',
    genre: 'kpop',
    difficulty: 2,
    duration_sec: 20,
    bpm: 130,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🎤',
    scene: '신나는 K-POP과 함께 댄스 챌린지!',
    created_at: new Date().toISOString(),
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 4000,  text: '🎤 준비됐어요?',             style: 'bold' },
      { start_ms: 4000, end_ms: 8000,  text: '🙌 양손 번쩍!',              style: 'highlight' },
      { start_ms: 8000, end_ms: 13000, text: '💃 팔 넓게 벌려봐요~',       style: 'normal' },
      { start_ms: 13000,end_ms: 17000, text: '🤍 하트 포즈!',              style: 'bold' },
      { start_ms: 17000,end_ms: 20000, text: '✌️ 마지막 V!',               style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'timing', threshold: 0.6,
        guide_text: '카메라 정면!', guide_emoji: '🎬',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 8000,
        type: 'gesture', gesture_id: 'hands_up', threshold: 0.72,
        guide_text: '양손 번쩍!', guide_emoji: '🙌',
      },
      {
        seq: 3, start_ms: 8000, end_ms: 13000,
        type: 'gesture', gesture_id: 'arms_spread', threshold: 0.68,
        guide_text: '양팔 펼쳐요!', guide_emoji: '🦅',
      },
      {
        seq: 4, start_ms: 13000, end_ms: 17000,
        type: 'gesture', gesture_id: 'heart', threshold: 0.70,
        guide_text: '하트 만들어!', guide_emoji: '💝',
      },
      {
        seq: 5, start_ms: 17000, end_ms: 20000,
        type: 'gesture', gesture_id: 'v_sign', threshold: 0.68,
        guide_text: 'V 포즈!', guide_emoji: '✌️',
      },
    ],
  },

  // ── 5. 맛집 소개 챌린지 ──
  {
    id: 'mock-005',
    name: '맛집 리뷰 챌린지',
    genre: 'daily',
    difficulty: 1,
    duration_sec: 15,
    bpm: 95,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🍜',
    scene: '맛있는 음식 앞에서 리뷰해봐요!',
    created_at: new Date().toISOString(),
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3500,  text: '🍜 여기 진짜 맛집이에요!!',   style: 'bold' },
      { start_ms: 3500, end_ms: 7500,  text: '😋 맛이 어떠냐고요?',         style: 'highlight' },
      { start_ms: 7500, end_ms: 11000, text: '👍 완전 맛있어요!!!',          style: 'bold' },
      { start_ms: 11000,end_ms: 15000, text: '📍 꼭 와보세요~!',            style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 3500,
        type: 'gesture', gesture_id: 'point_cam', threshold: 0.65,
        guide_text: '음식 가리켜!', guide_emoji: '👉',
      },
      {
        seq: 2, start_ms: 3500, end_ms: 7500,
        type: 'expression', threshold: 0.65,
        guide_text: '맛있는 표정!', guide_emoji: '😋',
      },
      {
        seq: 3, start_ms: 7500, end_ms: 11000,
        type: 'gesture', gesture_id: 'thumbs_up', threshold: 0.70,
        guide_text: '엄지 척!', guide_emoji: '👍',
      },
      {
        seq: 4, start_ms: 11000, end_ms: 15000,
        type: 'gesture', gesture_id: 'wave', threshold: 0.65,
        guide_text: '손 흔들며 마무리!', guide_emoji: '👋',
      },
    ],
  },

  // ── 6. 소셜 바이럴 챌린지 ──
  {
    id: 'mock-006',
    name: '소셜 바이럴 챌린지',
    genre: 'challenge',
    difficulty: 2,
    duration_sec: 15,
    bpm: 140,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🔥',
    scene: '지금 가장 핫한 챌린지!',
    created_at: new Date().toISOString(),
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3000,  text: '🔥 챌린지 시작!!',            style: 'bold' },
      { start_ms: 3000, end_ms: 6000,  text: '🤟 팔짱 크로스!',             style: 'highlight' },
      { start_ms: 6000, end_ms: 10000, text: '🙌 두 손 번쩍!',              style: 'bold' },
      { start_ms: 10000,end_ms: 15000, text: '🔥 왼쪽으로 기울기!',         style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 3000,
        type: 'timing', threshold: 0.6,
        guide_text: '카메라 정면!', guide_emoji: '🎬',
      },
      {
        seq: 2, start_ms: 3000, end_ms: 6000,
        type: 'gesture', gesture_id: 'arms_cross', threshold: 0.68,
        guide_text: '팔짱 크로스!', guide_emoji: '🤟',
      },
      {
        seq: 3, start_ms: 6000, end_ms: 10000,
        type: 'gesture', gesture_id: 'hands_up', threshold: 0.72,
        guide_text: '두 손 번쩍!', guide_emoji: '🙌',
      },
      {
        seq: 4, start_ms: 10000, end_ms: 15000,
        type: 'gesture', gesture_id: 'lean_left', threshold: 0.68,
        guide_text: '왼쪽으로 기울어!', guide_emoji: '↙️',
      },
    ],
  },
];

export const MOCK_USER_ID = 'mock-user-0001';

export const MOCK_PROFILE: UserProfile = {
  user_id: MOCK_USER_ID,
  preferred_genres: ['challenge', 'daily', 'travel'],
  success_rates: { 'mock-001': 0.82, 'mock-003': 0.75, 'mock-006': 0.61 },
  total_sessions: 8,
  weak_joints: ['left_wrist', 'right_wrist'],
};

export const MOCK_SESSIONS: UserSession[] = [
  {
    id: 'session-001', user_id: MOCK_USER_ID, template_id: 'mock-001',
    recorded_at: new Date(Date.now() - 86400000).toISOString(),
    avg_score: 0.82, success_rate: 0.80, tag_timeline: [], video_url: null, edited_video_url: null,
  },
  {
    id: 'session-002', user_id: MOCK_USER_ID, template_id: 'mock-003',
    recorded_at: new Date(Date.now() - 172800000).toISOString(),
    avg_score: 0.71, success_rate: 0.75, tag_timeline: [], video_url: null, edited_video_url: null,
  },
];
