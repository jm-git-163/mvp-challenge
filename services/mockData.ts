/**
 * mockData.ts — 10개 다양한 템플릿 (gesture / voice_read / timing / expression)
 */
import type { Template } from '../types/template';
import type { UserSession, UserProfile } from '../types/session';

export const MOCK_TEMPLATES: Template[] = [

  // ─── 1. 일상 브이로그 (daily_vlog) ───────────────────────────────────────
  {
    id: 'daily-vlog-001',
    name: '오늘의 브이로그',
    genre: 'daily',
    theme_id: 'daily',
    camera_mode: 'selfie',
    difficulty: 1,
    duration_sec: 15,
    bpm: 100,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '📱',
    scene: '오늘 하루를 셀카로 기록해보세요!',
    created_at: new Date().toISOString(),
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      frameColor: '#9b59b6',
    },
    sns_template: {
      hashtags: ['일상브이로그', '오늘하루', '일상기록', 'dailyvlog', '브이로그'],
      caption_template: '오늘도 기분 좋은 하루 🌟 {template_name} 점수 {score}점! #일상 #vlog',
      video_frame_css: 'border: 3px solid #9b59b6; border-radius: 16px;',
    },
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 3000,  text: '👋 안녕하세요~!',         style: 'highlight' },
      { start_ms: 3000,  end_ms: 7000,  text: '💝 오늘도 좋은 하루!',     style: 'bold' },
      { start_ms: 7000,  end_ms: 11000, text: '✌️ 오늘의 브이로그!',      style: 'normal' },
      { start_ms: 11000, end_ms: 15000, text: '❤️ 구독 좋아요 눌러줘요!', style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 3500,
        type: 'gesture', gesture_id: 'wave', gesture_emoji: '👋',
        threshold: 0.6, guide_text: '손 흔들어 인사!', guide_emoji: '👋', anim_type: 'float',
      },
      {
        seq: 2, start_ms: 3500, end_ms: 7500,
        type: 'gesture', gesture_id: 'heart', gesture_emoji: '💝',
        threshold: 0.65, guide_text: '하트 만들기!', guide_emoji: '💝', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 7500, end_ms: 11500,
        type: 'gesture', gesture_id: 'v_sign', gesture_emoji: '✌️',
        threshold: 0.6, guide_text: 'V 사인!', guide_emoji: '✌️', anim_type: 'bounce',
      },
      {
        seq: 4, start_ms: 11500, end_ms: 15000,
        type: 'gesture', gesture_id: 'thumbs_up', gesture_emoji: '👍',
        threshold: 0.65, guide_text: '엄지 척!', guide_emoji: '👍', anim_type: 'bounce',
      },
    ],
  },

  // ─── 2. 뉴스 앵커 (news_anchor) ───────────────────────────────────────────
  {
    id: 'news-anchor-002',
    name: '뉴스 앵커 챌린지',
    genre: 'news',
    theme_id: 'news',
    camera_mode: 'selfie',
    difficulty: 2,
    duration_sec: 25,
    bpm: 90,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '📺',
    scene: '뉴스 스튜디오에서 앵커가 되어봐요!',
    created_at: new Date().toISOString(),
    virtual_bg: {
      type: 'pattern',
      css: 'linear-gradient(180deg, #0a1628 0%, #1a2e4a 50%, #0d1f35 100%)',
      overlayTop: '📺 LIVE NEWS',
      overlayBottom: '🔴 속보 · 오늘의 뉴스 · BREAKING NEWS · 최신 뉴스 · ',
      frameColor: '#1565c0',
    },
    sns_template: {
      hashtags: ['뉴스앵커', '챌린지', '뉴스스타', 'newsanchor', '앵커챌린지'],
      caption_template: '내가 뉴스 앵커가 됐어요! 📺 {template_name} {score}점 달성! #뉴스앵커 #챌린지',
      video_frame_css: 'border: 3px solid #1565c0; border-radius: 8px; background: #0a1628;',
    },
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 4000,  text: '📺 안녕하세요. 뉴스 시작합니다.', style: 'news' },
      { start_ms: 4000,  end_ms: 10000, text: '오늘의 주요 뉴스를 전해드리겠습니다.', style: 'news' },
      { start_ms: 10000, end_ms: 17000, text: '전국적으로 맑겠으며 기온은 25도까지 오르겠습니다.', style: 'news' },
      { start_ms: 17000, end_ms: 25000, text: '이상으로 오늘의 뉴스를 마치겠습니다. 감사합니다.', style: 'news' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 5000,
        type: 'timing',
        threshold: 0.6, guide_text: '카메라를 정면으로 바라봐요', guide_emoji: '📷', anim_type: 'pulse',
      },
      {
        seq: 2, start_ms: 5000, end_ms: 12000,
        type: 'voice_read',
        read_text: '안녕하세요, 오늘의 주요 뉴스를 전해드리겠습니다.',
        read_lang: 'ko',
        threshold: 0.55, guide_text: '앵커처럼 읽어보세요!', guide_emoji: '🎙️', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 12000, end_ms: 19000,
        type: 'voice_read',
        read_text: '오늘 날씨는 전국적으로 맑겠으며, 기온은 25도까지 오르겠습니다.',
        read_lang: 'ko',
        threshold: 0.5, guide_text: '날씨 예보를 읽어요!', guide_emoji: '🌤️', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 19000, end_ms: 25000,
        type: 'voice_read',
        read_text: '이상으로 오늘의 뉴스를 마치겠습니다. 감사합니다.',
        read_lang: 'ko',
        threshold: 0.55, guide_text: '마무리 멘트!', guide_emoji: '🎬', anim_type: 'float',
      },
    ],
  },

  // ─── 3. 영어 레슨 (english_lesson) ───────────────────────────────────────
  {
    id: 'english-lesson-003',
    name: '영어 한마디 챌린지',
    genre: 'english',
    theme_id: 'english',
    camera_mode: 'selfie',
    difficulty: 2,
    duration_sec: 20,
    bpm: 95,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🇺🇸',
    scene: '영어 문장을 자신있게 읽어봐요!',
    created_at: new Date().toISOString(),
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      overlayTop: '🇺🇸 English Challenge',
      frameColor: '#2196f3',
    },
    sns_template: {
      hashtags: ['영어챌린지', '영어공부', 'englishchallenge', '영어한마디', 'speakenglish'],
      caption_template: '영어 말하기 도전! 🇺🇸 {template_name} {score}점! 나도 영어 할 수 있어! #영어챌린지',
      video_frame_css: 'border: 3px solid #2196f3; border-radius: 12px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 4000,  text: '🇺🇸 영어로 말해봐요!',         style: 'bold' },
      { start_ms: 4000, end_ms: 10000, text: 'Hello everyone! Today is a wonderful day.', style: 'highlight' },
      { start_ms: 10000,end_ms: 16000, text: 'I love learning English every day!',        style: 'highlight' },
      { start_ms: 16000,end_ms: 20000, text: 'See you next time! Bye bye! 👋',            style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'gesture', gesture_id: 'wave', gesture_emoji: '👋',
        threshold: 0.6, guide_text: '손 흔들어 인사!', guide_emoji: '👋', anim_type: 'bounce',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 11000,
        type: 'voice_read',
        read_text: 'Hello everyone! Today is a wonderful day.',
        read_lang: 'en',
        threshold: 0.5, guide_text: '영어로 읽어봐요!', guide_emoji: '🗣️', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 11000, end_ms: 17000,
        type: 'voice_read',
        read_text: 'I love learning English every day!',
        read_lang: 'en',
        threshold: 0.5, guide_text: '자신있게!', guide_emoji: '💪', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 17000, end_ms: 20000,
        type: 'gesture', gesture_id: 'wave', gesture_emoji: '👋',
        threshold: 0.6, guide_text: '작별 인사!', guide_emoji: '👋', anim_type: 'bounce',
      },
    ],
  },

  // ─── 4. 동화 낭독 (fairy_tale_reader) ────────────────────────────────────
  {
    id: 'fairy-tale-004',
    name: '동화책 낭독 챌린지',
    genre: 'kids',
    theme_id: 'fairy_tale',
    camera_mode: 'selfie',
    difficulty: 1,
    duration_sec: 20,
    bpm: 80,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '📖',
    scene: '동화책 주인공이 되어 낭독해봐요!',
    created_at: new Date().toISOString(),
    virtual_bg: {
      type: 'pattern',
      css: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      overlayTop: '📖 옛날 옛날에...',
      frameColor: '#ff9800',
    },
    sns_template: {
      hashtags: ['동화낭독', '동화챌린지', '동화책', '낭독챌린지', 'storytelling'],
      caption_template: '나만의 동화 낭독 🏰 {template_name} {score}점 달성! #동화 #낭독챌린지',
      video_frame_css: 'border: 4px solid #ff9800; border-radius: 20px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3000,  text: '📖 옛날 옛날에...',                           style: 'story' },
      { start_ms: 3000, end_ms: 10000, text: '숲속 깊은 곳에 작은 오두막이 있었어요.',        style: 'story' },
      { start_ms: 10000,end_ms: 17000, text: '그곳에는 마음씨 착한 소녀가 살고 있었답니다.',  style: 'story' },
      { start_ms: 17000,end_ms: 20000, text: '이야기는 계속됩니다... 🌙',                    style: 'story' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'expression',
        threshold: 0.6, guide_text: '이야기 시작 표정!', guide_emoji: '😊', anim_type: 'pulse',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 11000,
        type: 'voice_read',
        read_text: '옛날 옛적에 숲속 깊은 곳에 작은 오두막이 있었어요.',
        read_lang: 'ko',
        threshold: 0.5, guide_text: '동화처럼 읽어봐요!', guide_emoji: '📖', anim_type: 'float',
      },
      {
        seq: 3, start_ms: 11000, end_ms: 18000,
        type: 'voice_read',
        read_text: '그곳에는 마음씨 착한 소녀가 살고 있었답니다.',
        read_lang: 'ko',
        threshold: 0.5, guide_text: '계속 이야기해요!', guide_emoji: '🏡', anim_type: 'float',
      },
      {
        seq: 4, start_ms: 18000, end_ms: 20000,
        type: 'gesture', gesture_id: 'heart', gesture_emoji: '💕',
        threshold: 0.6, guide_text: '해피엔딩 하트!', guide_emoji: '💕', anim_type: 'pulse',
      },
    ],
  },

  // ─── 5. 여행 인증 (travel_cert) ───────────────────────────────────────────
  {
    id: 'travel-cert-005',
    name: '여행지 인증 챌린지',
    genre: 'travel',
    theme_id: 'travel',
    camera_mode: 'normal',
    difficulty: 1,
    duration_sec: 15,
    bpm: 110,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '✈️',
    scene: '여행지, 핫플, 카페 앞에서 인증해봐요!',
    created_at: new Date().toISOString(),
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #0099f7 0%, #f11712 100%)',
      overlayTop: '✈️ TRAVEL CERT',
      frameColor: '#00bcd4',
    },
    sns_template: {
      hashtags: ['여행인증', '여행스타그램', '핫플', 'travelgram', '여행챌린지'],
      caption_template: '여기 왔어요! ✈️ {template_name} {score}점! 강추 여행지 #여행인증 #여행스타그램',
      video_frame_css: 'border: 3px solid #00bcd4; border-radius: 12px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3500,  text: '✈️ 어디야? 배경 보여줘!',   style: 'bold' },
      { start_ms: 3500, end_ms: 7000,  text: '✌️ 여기 왔어요~',           style: 'highlight' },
      { start_ms: 7000, end_ms: 11000, text: '📸 인증샷 찍어줘!',          style: 'normal' },
      { start_ms: 11000,end_ms: 15000, text: '🙌 여기 강추입니다!!',        style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 3500,
        type: 'timing',
        threshold: 0.6, guide_text: '배경 보여줘!', guide_emoji: '🌍', anim_type: 'float',
      },
      {
        seq: 2, start_ms: 3500, end_ms: 7500,
        type: 'gesture', gesture_id: 'v_sign', gesture_emoji: '✌️',
        threshold: 0.65, guide_text: 'V 사인!', guide_emoji: '✌️', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 7500, end_ms: 11500,
        type: 'gesture', gesture_id: 'point_cam', gesture_emoji: '👉',
        threshold: 0.65, guide_text: '카메라 가리켜!', guide_emoji: '📸', anim_type: 'shake',
      },
      {
        seq: 4, start_ms: 11500, end_ms: 15000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.7, guide_text: '양손 번쩍!', guide_emoji: '🙌', anim_type: 'bounce',
      },
    ],
  },

  // ─── 6. 제품 언박싱 (product_unboxing) ───────────────────────────────────
  {
    id: 'product-unbox-006',
    name: '신상템 언박싱 챌린지',
    genre: 'promotion',
    theme_id: 'product',
    camera_mode: 'selfie',
    difficulty: 1,
    duration_sec: 20,
    bpm: 120,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🛍️',
    scene: '새로 산 아이템을 카메라 앞에서 소개해요!',
    created_at: new Date().toISOString(),
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      frameColor: '#e91e63',
    },
    sns_template: {
      hashtags: ['언박싱', '신상템', '제품리뷰', 'unboxing', '쇼핑스타그램'],
      caption_template: '신상 언박싱 완료 🛍️ {template_name} {score}점! 이거 진짜 강추!! #언박싱 #신상',
      video_frame_css: 'border: 3px solid #e91e63; border-radius: 16px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 4000,  text: '🛍️ 이거 봐봐요!!!',       style: 'bold' },
      { start_ms: 4000, end_ms: 8000,  text: '👆 두두등장~',             style: 'highlight' },
      { start_ms: 8000, end_ms: 13000, text: '😍 완전 대박이에요',        style: 'normal' },
      { start_ms: 13000,end_ms: 17000, text: '👍 이거 진짜 강추!!',       style: 'bold' },
      { start_ms: 17000,end_ms: 20000, text: '🤩 구경 와줘서 감사해요~', style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4500,
        type: 'gesture', gesture_id: 'arms_spread', gesture_emoji: '🙆',
        threshold: 0.65, guide_text: '두 팔 벌려 등장!', guide_emoji: '🙆', anim_type: 'bounce',
      },
      {
        seq: 2, start_ms: 4500, end_ms: 8500,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.68, guide_text: '아이템 번쩍!', guide_emoji: '🙌', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 8500, end_ms: 13000,
        type: 'expression',
        threshold: 0.65, guide_text: '감탄하는 표정!', guide_emoji: '😍', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 13000, end_ms: 17000,
        type: 'gesture', gesture_id: 'thumbs_up', gesture_emoji: '👍',
        threshold: 0.7, guide_text: '엄지 척!', guide_emoji: '👍', anim_type: 'bounce',
      },
      {
        seq: 5, start_ms: 17000, end_ms: 20000,
        type: 'gesture', gesture_id: 'wave', gesture_emoji: '👋',
        threshold: 0.65, guide_text: '손 흔들며 마무리!', guide_emoji: '👋', anim_type: 'bounce',
      },
    ],
  },

  // ─── 7. K-POP 챌린지 (kpop_challenge) ────────────────────────────────────
  {
    id: 'kpop-challenge-007',
    name: 'K-POP 댄스 챌린지',
    genre: 'kpop',
    theme_id: 'kpop',
    camera_mode: 'selfie',
    difficulty: 2,
    duration_sec: 20,
    bpm: 130,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🎤',
    scene: 'K-POP 스타가 되어 챌린지!',
    created_at: new Date().toISOString(),
    virtual_bg: {
      type: 'pattern',
      css: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      overlayTop: '🎤 K-POP CHALLENGE',
      frameColor: '#e94560',
    },
    sns_template: {
      hashtags: ['kpop챌린지', 'kpopchallenge', '케이팝', '댄스챌린지', 'kpop'],
      caption_template: '나도 K-POP 스타! 🎤 {template_name} {score}점 달성! 같이 춰요~ #kpop #댄스챌린지',
      video_frame_css: 'border: 3px solid #e94560; border-radius: 12px; background: #1a1a2e;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 4000,  text: '🎤 준비됐어요?',            style: 'bold' },
      { start_ms: 4000, end_ms: 8000,  text: '🙌 양손 번쩍!',             style: 'highlight' },
      { start_ms: 8000, end_ms: 13000, text: '💃 팔 넓게 벌려봐요~',      style: 'normal' },
      { start_ms: 13000,end_ms: 17000, text: '🤍 하트 포즈!',             style: 'bold' },
      { start_ms: 17000,end_ms: 20000, text: '✌️ 마지막 V!',              style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'timing',
        threshold: 0.6, guide_text: '카메라 정면!', guide_emoji: '🎬', anim_type: 'pulse',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 8000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.72, guide_text: '양손 번쩍!', guide_emoji: '🙌', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 8000, end_ms: 13000,
        type: 'gesture', gesture_id: 'arms_spread', gesture_emoji: '🦅',
        threshold: 0.68, guide_text: '양팔 펼쳐요!', guide_emoji: '🦅', anim_type: 'float',
      },
      {
        seq: 4, start_ms: 13000, end_ms: 17000,
        type: 'gesture', gesture_id: 'heart', gesture_emoji: '💝',
        threshold: 0.7, guide_text: '하트 만들어!', guide_emoji: '💝', anim_type: 'pulse',
      },
      {
        seq: 5, start_ms: 17000, end_ms: 20000,
        type: 'gesture', gesture_id: 'v_sign', gesture_emoji: '✌️',
        threshold: 0.68, guide_text: 'V 포즈!', guide_emoji: '✌️', anim_type: 'bounce',
      },
    ],
  },

  // ─── 8. 음식 리뷰 (food_review) ───────────────────────────────────────────
  {
    id: 'food-review-008',
    name: '맛집 리뷰 챌린지',
    genre: 'daily',
    theme_id: 'food',
    camera_mode: 'normal',
    difficulty: 1,
    duration_sec: 15,
    bpm: 95,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🍜',
    scene: '맛있는 음식 앞에서 리뷰해봐요!',
    created_at: new Date().toISOString(),
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
      overlayTop: '🍜 FOOD REVIEW',
      frameColor: '#ff5722',
    },
    sns_template: {
      hashtags: ['맛집리뷰', '음식스타그램', '먹스타그램', 'foodreview', '맛집'],
      caption_template: '진짜 맛집 발견! 🍜 {template_name} {score}점! 여기 꼭 오세요~ #맛집 #먹스타그램',
      video_frame_css: 'border: 3px solid #ff5722; border-radius: 12px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3500,  text: '🍜 여기 진짜 맛집이에요!!',  style: 'bold' },
      { start_ms: 3500, end_ms: 7500,  text: '😋 맛이 어떠냐고요?',        style: 'highlight' },
      { start_ms: 7500, end_ms: 11000, text: '👍 완전 맛있어요!!!',         style: 'bold' },
      { start_ms: 11000,end_ms: 15000, text: '📍 꼭 와보세요~!',           style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 3500,
        type: 'gesture', gesture_id: 'point_cam', gesture_emoji: '👉',
        threshold: 0.65, guide_text: '음식 가리켜!', guide_emoji: '👉', anim_type: 'shake',
      },
      {
        seq: 2, start_ms: 3500, end_ms: 7500,
        type: 'expression',
        threshold: 0.65, guide_text: '맛있는 표정!', guide_emoji: '😋', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 7500, end_ms: 11000,
        type: 'gesture', gesture_id: 'thumbs_up', gesture_emoji: '👍',
        threshold: 0.7, guide_text: '엄지 척!', guide_emoji: '👍', anim_type: 'bounce',
      },
      {
        seq: 4, start_ms: 11000, end_ms: 15000,
        type: 'gesture', gesture_id: 'wave', gesture_emoji: '👋',
        threshold: 0.65, guide_text: '손 흔들며 마무리!', guide_emoji: '👋', anim_type: 'bounce',
      },
    ],
  },

  // ─── 9. 동기부여 스피치 (motivation_talk) ────────────────────────────────
  {
    id: 'motivation-talk-009',
    name: '동기부여 스피치 챌린지',
    genre: 'daily',
    theme_id: 'motivation',
    camera_mode: 'selfie',
    difficulty: 2,
    duration_sec: 20,
    bpm: 105,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '💪',
    scene: '나를 응원하는 말 한마디!',
    created_at: new Date().toISOString(),
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      overlayTop: '💪 MOTIVATION',
      frameColor: '#00bcd4',
    },
    sns_template: {
      hashtags: ['동기부여', '자기계발', '오늘도화이팅', 'motivation', '긍정에너지'],
      caption_template: '오늘도 화이팅! 💪 {template_name} {score}점! 우리 모두 할 수 있어! #동기부여 #화이팅',
      video_frame_css: 'border: 3px solid #00bcd4; border-radius: 12px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 4000,  text: '💪 오늘도 할 수 있어!',                   style: 'bold' },
      { start_ms: 4000, end_ms: 11000, text: '매일 조금씩 성장하는 내가 자랑스러워요!', style: 'highlight' },
      { start_ms: 11000,end_ms: 17000, text: '포기하지 말고 끝까지 달려봐요!',          style: 'bold' },
      { start_ms: 17000,end_ms: 20000, text: '우리 모두 파이팅! 🔥',                   style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'gesture', gesture_id: 'thumbs_up', gesture_emoji: '👍',
        threshold: 0.65, guide_text: '파이팅 포즈!', guide_emoji: '💪', anim_type: 'bounce',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 11500,
        type: 'voice_read',
        read_text: '매일 조금씩 성장하는 내가 자랑스러워요!',
        read_lang: 'ko',
        threshold: 0.55, guide_text: '자신있게 외쳐요!', guide_emoji: '📢', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 11500, end_ms: 17500,
        type: 'voice_read',
        read_text: '포기하지 말고 끝까지 달려봐요!',
        read_lang: 'ko',
        threshold: 0.55, guide_text: '힘차게 말해봐요!', guide_emoji: '🔥', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 17500, end_ms: 20000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.7, guide_text: '마무리 파이팅!', guide_emoji: '🙌', anim_type: 'bounce',
      },
    ],
  },

  // ─── 10. 아이들 동화 (kids_abc) ───────────────────────────────────────────
  {
    id: 'kids-story-010',
    name: '어린이 동화 읽기',
    genre: 'kids',
    theme_id: 'kids',
    camera_mode: 'selfie',
    difficulty: 1,
    duration_sec: 20,
    bpm: 85,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🌈',
    scene: '어린이도 쉽게 따라 읽는 동화!',
    created_at: new Date().toISOString(),
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      overlayTop: '🌈 동화 세계로!',
      frameColor: '#ff80ab',
    },
    sns_template: {
      hashtags: ['어린이동화', '동화읽기', '키즈챌린지', 'kidsstory', '동화'],
      caption_template: '귀여운 동화 낭독 완료 🌈 {template_name} {score}점! 아이와 함께해요~ #어린이동화 #키즈',
      video_frame_css: 'border: 4px solid #ff80ab; border-radius: 20px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 4000,  text: '🌈 동화 세계로 출발!',       style: 'story' },
      { start_ms: 4000, end_ms: 10000, text: '토끼야, 어디 가니?',          style: 'story' },
      { start_ms: 10000,end_ms: 16000, text: '나는 당근을 찾아가요!',       style: 'story' },
      { start_ms: 16000,end_ms: 20000, text: '모두 함께 행복하게 살았대요!', style: 'story' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'expression',
        threshold: 0.6, guide_text: '신나는 표정!', guide_emoji: '😄', anim_type: 'bounce',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 10500,
        type: 'voice_read',
        read_text: '토끼야, 어디 가니?',
        read_lang: 'ko',
        threshold: 0.5, guide_text: '따라 읽어봐요!', guide_emoji: '🐰', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 10500, end_ms: 16500,
        type: 'voice_read',
        read_text: '나는 당근을 찾아가요!',
        read_lang: 'ko',
        threshold: 0.5, guide_text: '토끼처럼 말해요!', guide_emoji: '🥕', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 16500, end_ms: 20000,
        type: 'gesture', gesture_id: 'heart', gesture_emoji: '💕',
        threshold: 0.6, guide_text: '해피엔딩 하트!', guide_emoji: '💕', anim_type: 'pulse',
      },
    ],
  },
];

export const MOCK_USER_ID = 'mock-user-0001';

export const MOCK_PROFILE: UserProfile = {
  user_id: MOCK_USER_ID,
  preferred_genres: ['daily', 'kpop', 'travel', 'kids', 'news'],
  success_rates: {
    'daily-vlog-001':   0.82,
    'kpop-challenge-007': 0.75,
    'travel-cert-005':  0.68,
  },
  total_sessions: 8,
  weak_joints: ['left_wrist', 'right_wrist'],
};

export const MOCK_SESSIONS: UserSession[] = [
  {
    id: 'session-001',
    user_id: MOCK_USER_ID,
    template_id: 'daily-vlog-001',
    recorded_at: new Date(Date.now() - 86400000).toISOString(),
    avg_score: 0.82,
    success_rate: 0.80,
    tag_timeline: [],
    video_url: null,
    edited_video_url: null,
  },
  {
    id: 'session-002',
    user_id: MOCK_USER_ID,
    template_id: 'kpop-challenge-007',
    recorded_at: new Date(Date.now() - 172800000).toISOString(),
    avg_score: 0.71,
    success_rate: 0.75,
    tag_timeline: [],
    video_url: null,
    edited_video_url: null,
  },
  {
    id: 'session-003',
    user_id: MOCK_USER_ID,
    template_id: 'news-anchor-002',
    recorded_at: new Date(Date.now() - 259200000).toISOString(),
    avg_score: 0.65,
    success_rate: 0.70,
    tag_timeline: [],
    video_url: null,
    edited_video_url: null,
  },
];
