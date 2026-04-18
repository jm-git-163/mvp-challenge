/**
 * utils/videoTemplates.ts
 *
 * CapCut/TikTok-style video template definitions.
 * Each template defines its OWN visual design: gradient background,
 * top zone, bottom zone, decorative elements, and the exact clipArea
 * rectangle where the user's recorded video is placed.
 *
 * Canvas size: 720 × 1280 (9:16 portrait)
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ClipArea {
  xPct: number;         // 0-1 left edge of user video
  yPct: number;         // 0-1 top edge of user video
  wPct: number;         // 0-1 width of user video
  hPct: number;         // 0-1 height of user video
  borderRadius: number;
  borderColor?: string;
  borderWidth?: number;
  glowColor?: string;
}

export interface TextOverlay {
  text: string;
  start_ms: number;
  end_ms: number;
  xPct: number;
  yPct: number;
  fontSize: number;
  color: string;
  align?: 'left' | 'center' | 'right';
  animation?: 'fade' | 'slide_up' | 'slide_left' | 'bounce';
  bold?: boolean;
  bgColor?: string;
}

export interface TemplateZone {
  text: string;
  bgColor: string;
  textColor: string;
  fontSize?: number;
  bold?: boolean;
  subtext?: string;
  scrolling?: boolean;
}

export interface BgmSpec {
  genre: 'lofi' | 'news' | 'kpop' | 'bright' | 'fairy' | 'none';
  bpm: number;
  volume: number;
}

export interface ClipSlot {
  id: string;
  start_ms: number;
  end_ms: number;
  label: string;
}

export interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  duration_ms: number;
  gradientColors: [string, string];
  accentColor: string;
  decorativeElements?: 'stars' | 'circles' | 'lines' | 'sparkles';
  topZone?: TemplateZone;
  bottomZone?: TemplateZone;
  clipArea: ClipArea;
  text_overlays: TextOverlay[];
  bgm: BgmSpec;
  clip_slots: ClipSlot[];
  hashtags: string[];
}

// ─── Template Definitions ─────────────────────────────────────────────────────

/**
 * 1. vt-vlog — 일상 브이로그
 * Purple gradient · sparkles · scrolling hashtag ticker at bottom
 * clipArea: full-width band in the middle (top 15% = header, bottom 15% = ticker)
 */
const VT_VLOG: VideoTemplate = {
  id: 'vt-vlog',
  name: '오늘의 브이로그',
  description: '감각적인 보라 그라디언트 배경에 나의 일상을 담아보세요. 스크롤 해시태그 바가 자동으로 삽입됩니다.',
  duration_ms: 30_000,
  gradientColors: ['#4c1d95', '#7c3aed'],
  accentColor: '#c4b5fd',
  decorativeElements: 'sparkles',
  topZone: {
    text: '📱 오늘의 브이로그',
    bgColor: 'rgba(76,29,149,0.92)',
    textColor: '#e9d5ff',
    fontSize: 22,
    bold: true,
    subtext: 'Daily Vlog · 오늘 하루',
  },
  bottomZone: {
    text: '#오늘의브이로그 #데일리 #일상 #Vlog #Daily #챌린지 #오늘하루 #일상기록 #vlogger #dailyvlog',
    bgColor: 'rgba(76,29,149,0.88)',
    textColor: '#e9d5ff',
    fontSize: 14,
    scrolling: true,
  },
  clipArea: {
    xPct: 0,
    yPct: 0.155,
    wPct: 1,
    hPct: 0.665,
    borderRadius: 0,
  },
  text_overlays: [
    {
      text: '✨ 오늘의 하이라이트',
      start_ms: 1000,
      end_ms: 4500,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 18,
      color: '#fde68a',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(0,0,0,0.55)',
    },
    {
      text: '🌟 VLOG',
      start_ms: 5000,
      end_ms: 9000,
      xPct: 0.5,
      yPct: 0.18,
      fontSize: 26,
      color: '#fff',
      align: 'center',
      animation: 'bounce',
      bold: true,
    },
    {
      text: '오늘도 좋은 하루 보내세요 💜',
      start_ms: 10000,
      end_ms: 15000,
      xPct: 0.5,
      yPct: 0.80,
      fontSize: 16,
      color: '#e9d5ff',
      align: 'center',
      animation: 'fade',
      bgColor: 'rgba(76,29,149,0.7)',
    },
    {
      text: '📍 오늘의 장소',
      start_ms: 16000,
      end_ms: 21000,
      xPct: 0.12,
      yPct: 0.83,
      fontSize: 14,
      color: '#fde68a',
      align: 'left',
      animation: 'slide_left',
    },
    {
      text: '구독 & 좋아요 💜',
      start_ms: 25000,
      end_ms: 30000,
      xPct: 0.5,
      yPct: 0.81,
      fontSize: 20,
      color: '#fff',
      align: 'center',
      animation: 'bounce',
      bold: true,
      bgColor: 'rgba(124,58,237,0.8)',
    },
  ],
  bgm: { genre: 'lofi', bpm: 75, volume: 0.18 },
  clip_slots: [
    { id: 'vlog-main', start_ms: 0, end_ms: 30_000, label: '메인 영상' },
  ],
  hashtags: ['오늘의브이로그', '데일리', '일상', 'Vlog', '챌린지'],
};

/**
 * 2. vt-news — 뉴스 속보 템플릿
 * Dark navy · diagonal lines · LIVE badge topZone · scrolling news ticker bottomZone
 * clipArea: slightly inset with blue border for TV-frame feel
 */
const VT_NEWS: VideoTemplate = {
  id: 'vt-news',
  name: '뉴스 속보',
  description: '전문 뉴스 방송 스타일 템플릿. LIVE 배지와 스크롤 자막 바가 포함됩니다.',
  duration_ms: 30_000,
  gradientColors: ['#0d1b2a', '#1565c0'],
  accentColor: '#42a5f5',
  decorativeElements: 'lines',
  topZone: {
    text: '📺 LIVE  속보',
    bgColor: 'rgba(13,27,42,0.97)',
    textColor: '#ffffff',
    fontSize: 24,
    bold: true,
    subtext: '● BREAKING NEWS · 실시간 업데이트',
  },
  bottomZone: {
    text: '🔴 LIVE  속보 | 지금 바로 전해드립니다 | 최신 뉴스 업데이트 | BREAKING NEWS | 자세한 내용은 영상을 확인하세요 | 구독하고 알림 설정!',
    bgColor: '#1565c0',
    textColor: '#ffffff',
    fontSize: 14,
    scrolling: true,
  },
  clipArea: {
    xPct: 0,
    yPct: 0.17,
    wPct: 1,
    hPct: 0.625,
    borderRadius: 0,
    borderColor: '#1565c0',
    borderWidth: 3,
  },
  text_overlays: [
    {
      text: '🔴 LIVE',
      start_ms: 0,
      end_ms: 30_000,
      xPct: 0.08,
      yPct: 0.19,
      fontSize: 14,
      color: '#fff',
      align: 'left',
      bold: true,
      bgColor: '#e53935',
    },
    {
      text: '속보: 지금 전해드립니다',
      start_ms: 1500,
      end_ms: 7000,
      xPct: 0.5,
      yPct: 0.80,
      fontSize: 18,
      color: '#fff',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(21,101,192,0.88)',
    },
    {
      text: '📢 현장 연결',
      start_ms: 8000,
      end_ms: 13000,
      xPct: 0.5,
      yPct: 0.80,
      fontSize: 16,
      color: '#ffd54f',
      align: 'center',
      animation: 'fade',
      bold: true,
    },
    {
      text: '▶ 자세한 내용은 영상을 확인하세요',
      start_ms: 18000,
      end_ms: 24000,
      xPct: 0.5,
      yPct: 0.80,
      fontSize: 14,
      color: '#e3f2fd',
      align: 'center',
      animation: 'slide_left',
    },
    {
      text: '구독 & 알림 🔔',
      start_ms: 25000,
      end_ms: 30000,
      xPct: 0.5,
      yPct: 0.80,
      fontSize: 18,
      color: '#fff',
      align: 'center',
      animation: 'bounce',
      bold: true,
      bgColor: 'rgba(229,57,53,0.85)',
    },
  ],
  bgm: { genre: 'news', bpm: 120, volume: 0.15 },
  clip_slots: [
    { id: 'news-main', start_ms: 0, end_ms: 30_000, label: '뉴스 영상' },
  ],
  hashtags: ['속보', '뉴스', 'LIVE', '브레이킹뉴스', '실시간'],
};

/**
 * 3. vt-kpop — K-POP 챌린지 템플릿
 * Black/dark purple · stars · neon pink border + glow on clipArea
 * Rounded 16px clip for idol stage vibe
 */
const VT_KPOP: VideoTemplate = {
  id: 'vt-kpop',
  name: 'K-POP 챌린지',
  description: '아이돌 무대 컨셉의 K-POP 챌린지 템플릿. 네온 핑크 테두리와 글로우 효과가 포함됩니다.',
  duration_ms: 30_000,
  gradientColors: ['#0a0010', '#1a0030'],
  accentColor: '#e94560',
  decorativeElements: 'stars',
  topZone: {
    text: '🎤 K-POP CHALLENGE',
    bgColor: 'rgba(10,0,16,0.96)',
    textColor: '#ff6b9d',
    fontSize: 22,
    bold: true,
    subtext: '✦ 지금 바로 따라해보세요! ✦',
  },
  bottomZone: {
    text: '#KPOP #케이팝챌린지 #댄스챌린지 #아이돌 #커버댄스 #KpopChallenge #Dance #챌린지 #idol #cover',
    bgColor: 'rgba(10,0,16,0.93)',
    textColor: '#ff6b9d',
    fontSize: 14,
    scrolling: true,
  },
  clipArea: {
    xPct: 0.025,
    yPct: 0.16,
    wPct: 0.95,
    hPct: 0.665,
    borderRadius: 16,
    borderColor: '#e94560',
    borderWidth: 3,
    glowColor: 'rgba(233,69,96,0.55)',
  },
  text_overlays: [
    {
      text: '🔥 CHALLENGE',
      start_ms: 500,
      end_ms: 4000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 22,
      color: '#fff',
      align: 'center',
      animation: 'bounce',
      bold: true,
      bgColor: 'rgba(233,69,96,0.85)',
    },
    {
      text: '✨ 따라해보세요!',
      start_ms: 5000,
      end_ms: 9500,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 18,
      color: '#ffd700',
      align: 'center',
      animation: 'slide_up',
      bold: true,
    },
    {
      text: '💃 DANCE BREAK',
      start_ms: 10000,
      end_ms: 15000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 20,
      color: '#fff',
      align: 'center',
      animation: 'bounce',
      bold: true,
      bgColor: 'rgba(106,0,255,0.7)',
    },
    {
      text: '🎵 같이 챌린지해요!',
      start_ms: 17000,
      end_ms: 23000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 16,
      color: '#ff6b9d',
      align: 'center',
      animation: 'fade',
    },
    {
      text: '💜 태그하고 공유해요!',
      start_ms: 25000,
      end_ms: 30000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 18,
      color: '#fff',
      align: 'center',
      animation: 'bounce',
      bold: true,
      bgColor: 'rgba(233,69,96,0.88)',
    },
  ],
  bgm: { genre: 'kpop', bpm: 128, volume: 0.20 },
  clip_slots: [
    { id: 'kpop-main', start_ms: 0, end_ms: 30_000, label: '챌린지 영상' },
  ],
  hashtags: ['KPOP', '케이팝챌린지', '댄스챌린지', '아이돌', '커버댄스'],
};

/**
 * 4. vt-english — 영어 학습 템플릿
 * Dark teal · floating circles · clean academic look
 * Rounded 12px clip with sky-blue border
 */
const VT_ENGLISH: VideoTemplate = {
  id: 'vt-english',
  name: '영어 말하기 챌린지',
  description: '영어 스피킹 챌린지를 위한 클린한 학습 템플릿. 자막과 함께 나의 영어 실력을 공유하세요.',
  duration_ms: 30_000,
  gradientColors: ['#0f2027', '#1a4a5c'],
  accentColor: '#38bdf8',
  decorativeElements: 'circles',
  topZone: {
    text: '🌍 English Speaking Challenge',
    bgColor: 'rgba(15,32,39,0.96)',
    textColor: '#bae6fd',
    fontSize: 20,
    bold: true,
    subtext: 'Speak up! 영어로 도전해보세요',
  },
  bottomZone: {
    text: '#영어챌린지 #영어공부 #스피킹 #EnglishChallenge #영어 #영어말하기 #외국어 #영어학습 #말하기 #Speaking',
    bgColor: 'rgba(15,32,39,0.92)',
    textColor: '#bae6fd',
    fontSize: 14,
    scrolling: true,
  },
  clipArea: {
    xPct: 0.02,
    yPct: 0.155,
    wPct: 0.96,
    hPct: 0.665,
    borderRadius: 12,
    borderColor: '#38bdf8',
    borderWidth: 2,
  },
  text_overlays: [
    {
      text: "🎙 Let's speak English!",
      start_ms: 1000,
      end_ms: 5000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 18,
      color: '#fff',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(14,116,144,0.82)',
    },
    {
      text: '💬 따라 읽어보세요!',
      start_ms: 6000,
      end_ms: 11000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 16,
      color: '#fde68a',
      align: 'center',
      animation: 'fade',
    },
    {
      text: '✅ Great job!',
      start_ms: 12000,
      end_ms: 17000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 20,
      color: '#4ade80',
      align: 'center',
      animation: 'bounce',
      bold: true,
    },
    {
      text: '🌟 Keep practicing!',
      start_ms: 19000,
      end_ms: 24000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 16,
      color: '#bae6fd',
      align: 'center',
      animation: 'slide_left',
    },
    {
      text: '📚 함께 공부해요!',
      start_ms: 25000,
      end_ms: 30000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 18,
      color: '#fff',
      align: 'center',
      animation: 'bounce',
      bold: true,
      bgColor: 'rgba(56,189,248,0.8)',
    },
  ],
  bgm: { genre: 'bright', bpm: 100, volume: 0.15 },
  clip_slots: [
    { id: 'english-main', start_ms: 0, end_ms: 30_000, label: '스피킹 영상' },
  ],
  hashtags: ['영어챌린지', '영어공부', '스피킹', 'EnglishChallenge', '영어말하기'],
};

/**
 * 5. vt-fairy — 동화책 낭독 템플릿
 * Purple/pink gradient · sparkles · dreamy rounded clip with pink glow
 * Soft fairy-tale aesthetic
 */
const VT_FAIRY: VideoTemplate = {
  id: 'vt-fairy',
  name: '동화책 낭독',
  description: '동화 속 세계로! 몽환적인 분홍 빛깔 템플릿으로 낭독 영상을 완성하세요.',
  duration_ms: 30_000,
  gradientColors: ['#3b0764', '#831843'],
  accentColor: '#f9a8d4',
  decorativeElements: 'sparkles',
  topZone: {
    text: '📖 동화책 낭독',
    bgColor: 'rgba(59,7,100,0.94)',
    textColor: '#fce7f3',
    fontSize: 22,
    bold: true,
    subtext: '✨ Fairy Tale Reading Time ✨',
  },
  bottomZone: {
    text: '#동화책낭독 #동화 #낭독 #독서 #어린이 #FairyTale #Reading #책읽기 #낭독챌린지 #스토리텔링',
    bgColor: 'rgba(59,7,100,0.9)',
    textColor: '#fce7f3',
    fontSize: 14,
    scrolling: true,
  },
  clipArea: {
    xPct: 0.03,
    yPct: 0.155,
    wPct: 0.94,
    hPct: 0.665,
    borderRadius: 20,
    borderColor: '#f9a8d4',
    borderWidth: 3,
    glowColor: 'rgba(249,168,212,0.38)',
  },
  text_overlays: [
    {
      text: '📖 옛날 옛적에...',
      start_ms: 1000,
      end_ms: 5500,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 20,
      color: '#fce7f3',
      align: 'center',
      animation: 'fade',
      bold: true,
      bgColor: 'rgba(59,7,100,0.78)',
    },
    {
      text: '✨ 마법 같은 이야기',
      start_ms: 7000,
      end_ms: 12000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 18,
      color: '#fde68a',
      align: 'center',
      animation: 'slide_up',
    },
    {
      text: '🧚 함께 읽어요!',
      start_ms: 13000,
      end_ms: 18000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 18,
      color: '#f9a8d4',
      align: 'center',
      animation: 'bounce',
      bold: true,
    },
    {
      text: '💫 이야기 속으로 빠져들어요',
      start_ms: 20000,
      end_ms: 25000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 14,
      color: '#fce7f3',
      align: 'center',
      animation: 'fade',
      bgColor: 'rgba(131,24,67,0.7)',
    },
    {
      text: '💜 THE END · 구독해주세요!',
      start_ms: 26000,
      end_ms: 30000,
      xPct: 0.5,
      yPct: 0.82,
      fontSize: 18,
      color: '#fff',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(249,168,212,0.6)',
    },
  ],
  bgm: { genre: 'fairy', bpm: 70, volume: 0.18 },
  clip_slots: [
    { id: 'fairy-main', start_ms: 0, end_ms: 30_000, label: '낭독 영상' },
  ],
  hashtags: ['동화책낭독', '동화', '낭독', '독서', 'FairyTale'],
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  VT_VLOG,
  VT_NEWS,
  VT_KPOP,
  VT_ENGLISH,
  VT_FAIRY,
];

/** Get a template by its id. Returns undefined if not found. */
export function getVideoTemplate(id: string): VideoTemplate | undefined {
  return VIDEO_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get the best matching VideoTemplate for a challenge genre.
 * Falls back to the first template if no match.
 */
export function getTemplateByMissionId(genre: string): VideoTemplate {
  const map: Record<string, string> = {
    daily:     'vt-vlog',
    news:      'vt-news',
    kpop:      'vt-kpop',
    english:   'vt-english',
    kids:      'vt-fairy',
    travel:    'vt-vlog',
    challenge: 'vt-kpop',
    fitness:   'vt-kpop',
    hiphop:    'vt-kpop',
    promotion: 'vt-news',
  };
  const id = map[genre] ?? 'vt-vlog';
  return getVideoTemplate(id) ?? VIDEO_TEMPLATES[0];
}
