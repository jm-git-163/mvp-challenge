// utils/videoTemplates.ts
// Pre-designed video shell templates for the challenge video compositor.
// Canvas: 720x1280. The user's clip occupies clipArea; everything else is the template shell.

export interface ClipArea {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
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
  animation?: 'fade' | 'slide_up' | 'slide_left' | 'bounce' | 'typewriter';
  bold?: boolean;
  bgColor?: string;
  outlineColor?: string;
}

export interface TemplateZone {
  text: string;
  bgColor: string;
  textColor: string;
  fontSize?: number;
  bold?: boolean;
  subtext?: string;
  scrolling?: boolean;
  logoEmoji?: string;
}

export interface BgmSpec {
  genre: 'lofi' | 'news' | 'kpop' | 'bright' | 'fairy' | 'fitness' | 'travel' | 'hiphop' | 'none';
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
  bgStyle: 'vlog' | 'news' | 'kpop' | 'english' | 'fairy' | 'fitness' | 'travel' | 'hiphop';
  decorativeElements?: 'stars' | 'circles' | 'lines' | 'sparkles' | 'stage_lights' | 'bokeh' | 'magic' | 'energy' | 'world' | 'urban';
  topZone?: TemplateZone;
  bottomZone?: TemplateZone;
  clipArea: ClipArea;
  text_overlays: TextOverlay[];
  bgm: BgmSpec;
  clip_slots: ClipSlot[];
  hashtags: string[];
  mascotEmoji?: string;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const vt_vlog: VideoTemplate = {
  id: 'vt-vlog',
  name: '✨ 데일리 브이로그',
  description: '감성적인 보케 배경의 데일리 브이로그 스타일 챌린지 영상',
  duration_ms: 30000,
  gradientColors: ['#667eea', '#764ba2'],
  accentColor: '#9b59b6',
  bgStyle: 'vlog',
  decorativeElements: 'bokeh',
  mascotEmoji: '📸',
  clipArea: {
    xPct: 0.03,
    yPct: 0.17,
    wPct: 0.94,
    hPct: 0.63,
    borderRadius: 20,
    glowColor: 'rgba(155,89,182,0.6)',
    borderColor: '#fff',
    borderWidth: 3,
  },
  topZone: {
    text: 'DAILY · CHALLENGE STUDIO',
    bgColor: 'rgba(14,11,6,0.92)',
    textColor: '#F7F3EB',
    bold: true,
    subtext: '오늘의 한 장면',
    logoEmoji: '✦',
  },
  bottomZone: {
    text: '#데일리챌린지  #일상  #vlog  #브이로그  #ChallengeStudio  #오늘의기록  ',
    bgColor: 'rgba(14,11,6,0.9)',
    textColor: '#CC785C',
    scrolling: true,
  },
  bgm: { genre: 'lofi', bpm: 115, volume: 0.55 },
  text_overlays: [
    {
      text: 'TAKE 01 · 시작',
      start_ms: 0,
      end_ms: 3500,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 26,
      color: '#F7F3EB',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(14,11,6,0.82)',
    },
    {
      text: '오늘의 한 장면',
      start_ms: 3500,
      end_ms: 9000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 20,
      color: '#F7E4D9',
      align: 'center',
      animation: 'fade',
    },
    {
      text: '천천히 · 몰입해서',
      start_ms: 9000,
      end_ms: 15000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 22,
      color: '#CC785C',
      align: 'center',
      animation: 'fade',
      bold: true,
    },
    {
      text: 'HALFWAY',
      start_ms: 15000,
      end_ms: 18500,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 22,
      color: '#F7F3EB',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(161,98,68,0.85)',
    },
    {
      text: '마무리까지 집중',
      start_ms: 18500,
      end_ms: 24000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 22,
      color: '#F7E4D9',
      align: 'center',
      animation: 'fade',
    },
    {
      text: '한 장면 · 한 호흡',
      start_ms: 24000,
      end_ms: 28000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 24,
      color: '#CC785C',
      align: 'center',
      animation: 'bounce',
      bold: true,
    },
    {
      text: 'TAKE · COMPLETE',
      start_ms: 28000,
      end_ms: 30000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 28,
      color: '#F7F3EB',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(204,120,92,0.92)',
    },
    {
      text: 'CHALLENGE · STUDIO',
      start_ms: 15000,
      end_ms: 30000,
      xPct: 0.97,
      yPct: 0.83,
      fontSize: 11,
      color: 'rgba(247,243,235,0.75)',
      align: 'right',
      animation: 'fade',
      bgColor: 'rgba(14,11,6,0.55)',
    },
  ],
  clip_slots: [
    { id: 'main', start_ms: 0, end_ms: 30000, label: '메인 챌린지' },
  ],
  hashtags: ['데일리챌린지', '일상', 'vlog', 'daily', '브이로그'],
};

const vt_news: VideoTemplate = {
  id: 'vt-news',
  name: '📺 뉴스 스튜디오',
  description: '방송 뉴스 스튜디오 스타일의 전문적인 챌린지 영상',
  duration_ms: 30000,
  gradientColors: ['#0a1628', '#1a2e4a'],
  accentColor: '#1565c0',
  bgStyle: 'news',
  decorativeElements: 'lines',
  mascotEmoji: '📰',
  clipArea: {
    xPct: 0.05,
    yPct: 0.22,
    wPct: 0.90,
    hPct: 0.55,
    borderRadius: 4,
    borderColor: 'rgba(21,101,192,0.7)',
    borderWidth: 2,
  },
  topZone: {
    text: '🔴 LIVE  속보 · BREAKING NEWS',
    bgColor: '#c62828',
    textColor: '#fff',
    bold: true,
    subtext: '뉴스 챌린지 스튜디오',
    logoEmoji: '📺',
  },
  bottomZone: {
    text: '📡 뉴스 챌린지 · 최신 뉴스 · BREAKING · 속보 · 오늘의 뉴스 · NEWS UPDATE · ',
    bgColor: 'rgba(13,71,161,0.95)',
    textColor: '#fff',
    scrolling: true,
    fontSize: 14,
  },
  bgm: { genre: 'news', bpm: 100, volume: 0.5 },
  text_overlays: [
    {
      text: '🎙️ 뉴스 챌린지 시작',
      start_ms: 0,
      end_ms: 4000,
      xPct: 0.5,
      yPct: 0.79,
      fontSize: 24,
      color: '#fff',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(13,71,161,0.9)',
    },
    {
      text: 'MC 챌린저',
      start_ms: 4000,
      end_ms: 30000,
      xPct: 0.06,
      yPct: 0.80,
      fontSize: 16,
      color: '#fff',
      align: 'left',
      animation: 'fade',
      bold: true,
    },
    {
      text: '뉴스 챌린지 도전자',
      start_ms: 4000,
      end_ms: 30000,
      xPct: 0.06,
      yPct: 0.84,
      fontSize: 13,
      color: '#93c5fd',
      align: 'left',
      animation: 'fade',
    },
    {
      text: '⚡ 속보: 챌린지 도전 중!',
      start_ms: 10000,
      end_ms: 16000,
      xPct: 0.5,
      yPct: 0.79,
      fontSize: 22,
      color: '#fff',
      align: 'center',
      animation: 'slide_left',
      bold: true,
      bgColor: 'rgba(198,40,40,0.85)',
    },
    {
      text: '🏆 챌린지 성공!',
      start_ms: 20000,
      end_ms: 26000,
      xPct: 0.5,
      yPct: 0.79,
      fontSize: 26,
      color: '#fbbf24',
      align: 'center',
      animation: 'bounce',
      bold: true,
      bgColor: 'rgba(13,71,161,0.9)',
    },
  ],
  clip_slots: [
    { id: 'news_clip', start_ms: 0, end_ms: 30000, label: '뉴스 리포트' },
  ],
  hashtags: ['뉴스챌린지', '속보', '뉴스', 'breaking', '뉴스스튜디오'],
};

const vt_kpop: VideoTemplate = {
  id: 'vt-kpop',
  name: '🎤 K-POP 스테이지',
  description: '화려한 무대 조명과 함께하는 K-POP 챌린지 영상',
  duration_ms: 30000,
  gradientColors: ['#0d0d1a', '#1a0a2e'],
  accentColor: '#e94560',
  bgStyle: 'kpop',
  decorativeElements: 'stage_lights',
  mascotEmoji: '🎤',
  clipArea: {
    xPct: 0.06,
    yPct: 0.20,
    wPct: 0.88,
    hPct: 0.60,
    borderRadius: 12,
    glowColor: 'rgba(233,69,96,0.7)',
    borderColor: 'rgba(233,69,96,0.8)',
    borderWidth: 2,
  },
  topZone: {
    text: '🎤 K-POP CHALLENGE',
    bgColor: 'rgba(233,69,96,0.92)',
    textColor: '#fff',
    bold: true,
    subtext: '🌟 STAGE · PERFORM · SHINE',
    logoEmoji: '⭐',
  },
  bottomZone: {
    text: '#KPOP #케이팝챌린지 #댄스 #스테이지 #KChallenge #케이팝 #뮤직 #챌린지 #아이돌 ',
    bgColor: 'rgba(30,0,60,0.95)',
    textColor: '#e94560',
    scrolling: true,
  },
  bgm: { genre: 'kpop', bpm: 128, volume: 0.6 },
  text_overlays: [
    {
      text: '🎤 STAGE ON!',
      start_ms: 0,
      end_ms: 2000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 36,
      color: '#e94560',
      align: 'center',
      animation: 'slide_up',
      bold: true,
    },
    {
      text: '🌟 PERFORM!',
      start_ms: 2000,
      end_ms: 8000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 28,
      color: '#fff',
      align: 'center',
      animation: 'bounce',
      bold: true,
      bgColor: 'rgba(233,69,96,0.7)',
    },
    {
      text: '💃 K-POP 도전 중',
      start_ms: 8000,
      end_ms: 14000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 24,
      color: '#fbbf24',
      align: 'center',
      animation: 'fade',
    },
    {
      text: '🔥 FIRE! 불타오르네!',
      start_ms: 14000,
      end_ms: 20000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 30,
      color: '#ef4444',
      align: 'center',
      animation: 'bounce',
      bold: true,
    },
    {
      text: '⭐ PERFECT STAGE!',
      start_ms: 20000,
      end_ms: 26000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 28,
      color: '#fbbf24',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(233,69,96,0.8)',
    },
    {
      text: '🏆 챌린지 완료! 최고!',
      start_ms: 26000,
      end_ms: 30000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 32,
      color: '#fff',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(233,69,96,0.9)',
    },
    {
      text: '🌟 x999',
      start_ms: 0,
      end_ms: 30000,
      xPct: 0.95,
      yPct: 0.18,
      fontSize: 14,
      color: '#fbbf24',
      align: 'right',
      animation: 'bounce',
    },
  ],
  clip_slots: [
    { id: 'kpop_stage', start_ms: 0, end_ms: 30000, label: 'K-POP 스테이지' },
  ],
  hashtags: ['KPOP', '케이팝챌린지', '댄스', '스테이지', 'KChallenge'],
};

const vt_english: VideoTemplate = {
  id: 'vt-english',
  name: '🌍 영어 스피킹 클래스',
  description: '깔끔한 교육 스타일의 영어 스피킹 챌린지 영상',
  duration_ms: 30000,
  gradientColors: ['#0f4c75', '#1b6ca8'],
  accentColor: '#3498db',
  bgStyle: 'english',
  decorativeElements: 'circles',
  mascotEmoji: '📚',
  clipArea: {
    xPct: 0.04,
    yPct: 0.19,
    wPct: 0.92,
    hPct: 0.62,
    borderRadius: 16,
    borderColor: 'rgba(52,152,219,0.6)',
    borderWidth: 2,
    glowColor: 'rgba(52,152,219,0.4)',
  },
  topZone: {
    text: '🌍 ENGLISH SPEAKING CHALLENGE',
    bgColor: 'rgba(15,76,117,0.95)',
    textColor: '#fff',
    bold: true,
    subtext: '📚 영어로 말해봐요! Speak English!',
    logoEmoji: '🗣️',
  },
  bottomZone: {
    text: '#영어챌린지 #영어공부 #스피킹 #English #LearnEnglish #영어 #영어회화 #챌린지',
    bgColor: 'rgba(27,108,168,0.95)',
    textColor: '#bfdbfe',
    scrolling: true,
  },
  bgm: { genre: 'bright', bpm: 110, volume: 0.5 },
  text_overlays: [
    {
      text: "🗣️ Let's Speak!",
      start_ms: 0,
      end_ms: 4000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 30,
      color: '#fff',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(15,76,117,0.85)',
    },
    {
      text: 'Say it loud! 크게 말해요!',
      start_ms: 4000,
      end_ms: 10000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 22,
      color: '#bfdbfe',
      align: 'center',
      animation: 'fade',
    },
    {
      text: '📖 Challenge in Progress...',
      start_ms: 10000,
      end_ms: 16000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 20,
      color: '#fff',
      align: 'center',
      animation: 'bounce',
    },
    {
      text: '✅ 잘하고 있어요! Great job!',
      start_ms: 16000,
      end_ms: 22000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 24,
      color: '#fbbf24',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(34,197,94,0.7)',
    },
    {
      text: '🌟 Almost there! 거의 다 왔어요!',
      start_ms: 22000,
      end_ms: 28000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 22,
      color: '#fff',
      align: 'center',
      animation: 'fade',
    },
    {
      text: '🎓 Challenge Complete!',
      start_ms: 28000,
      end_ms: 30000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 30,
      color: '#fff',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(15,76,117,0.9)',
    },
  ],
  clip_slots: [
    { id: 'speaking_clip', start_ms: 0, end_ms: 30000, label: '영어 스피킹' },
  ],
  hashtags: ['영어챌린지', '영어공부', '스피킹', 'English', 'LearnEnglish'],
};

const vt_fairy: VideoTemplate = {
  id: 'vt-fairy',
  name: '🌈 동화 나라 챌린지',
  description: '마법 같은 동화 나라 스타일의 귀여운 챌린지 영상',
  duration_ms: 30000,
  gradientColors: ['#6a0572', '#e91e8c'],
  accentColor: '#ff80ab',
  bgStyle: 'fairy',
  decorativeElements: 'magic',
  mascotEmoji: '🧚',
  clipArea: {
    xPct: 0.05,
    yPct: 0.17,
    wPct: 0.90,
    hPct: 0.63,
    borderRadius: 28,
    glowColor: 'rgba(255,128,171,0.6)',
    borderColor: 'rgba(255,255,255,0.7)',
    borderWidth: 3,
  },
  topZone: {
    text: '🌈 동화 나라 챌린지',
    bgColor: 'rgba(106,5,114,0.9)',
    textColor: '#fff',
    bold: true,
    subtext: '✨ 마법 같은 이야기 속으로!',
    logoEmoji: '🧚',
  },
  bottomZone: {
    text: '#동화챌린지 #어린이 #동화나라 #마법 #fairy #동화 #챌린지 #귀여워 #꿈 ',
    bgColor: 'rgba(233,30,140,0.9)',
    textColor: '#fff',
    scrolling: true,
  },
  bgm: { genre: 'fairy', bpm: 90, volume: 0.55 },
  text_overlays: [
    {
      text: '✨ 동화 세계로!',
      start_ms: 0,
      end_ms: 4000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 32,
      color: '#fff',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(106,5,114,0.85)',
    },
    {
      text: '🌟 마법 챌린지 시작!',
      start_ms: 4000,
      end_ms: 10000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 26,
      color: '#fce7f3',
      align: 'center',
      animation: 'bounce',
      bold: true,
    },
    {
      text: '🦋 도전 중이에요...',
      start_ms: 10000,
      end_ms: 16000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 22,
      color: '#fff',
      align: 'center',
      animation: 'fade',
    },
    {
      text: '💖 너무 잘하고 있어요!',
      start_ms: 16000,
      end_ms: 22000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 26,
      color: '#fbbf24',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(233,30,140,0.7)',
    },
    {
      text: '🌈 조금만 더요!',
      start_ms: 22000,
      end_ms: 28000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 24,
      color: '#fff',
      align: 'center',
      animation: 'bounce',
    },
    {
      text: '🎉 챌린지 성공! 최고야!',
      start_ms: 28000,
      end_ms: 30000,
      xPct: 0.5,
      yPct: 0.10,
      fontSize: 30,
      color: '#fff',
      align: 'center',
      animation: 'slide_up',
      bold: true,
      bgColor: 'rgba(106,5,114,0.9)',
    },
  ],
  clip_slots: [
    { id: 'fairy_clip', start_ms: 0, end_ms: 30000, label: '동화 챌린지' },
  ],
  hashtags: ['동화챌린지', '어린이', '동화나라', '마법', 'fairy'],
};

// ---------------------------------------------------------------------------
// FITNESS template — dark gym aesthetic, energetic HUD
// ---------------------------------------------------------------------------

const vt_fitness: VideoTemplate = {
  id: 'vt-fitness',
  name: '💪 피트니스 챌린지',
  description: '강렬한 피트니스 스튜디오 스타일 — 운동 HUD와 에너지 게이지',
  duration_ms: 40000,
  gradientColors: ['#0d1b0f', '#0f3b2e'],
  accentColor: '#14b8a6',
  bgStyle: 'fitness',
  decorativeElements: 'energy',
  mascotEmoji: '💪',
  clipArea: {
    xPct: 0.03,
    yPct: 0.14,
    wPct: 0.94,
    hPct: 0.68,
    borderRadius: 12,
    glowColor: 'rgba(20,184,166,0.5)',
    borderColor: '#14b8a6',
    borderWidth: 2,
  },
  topZone: {
    text: 'FITNESS · CHALLENGE STUDIO',
    bgColor: 'rgba(14,11,6,0.94)',
    textColor: '#F7F3EB',
    bold: true,
    subtext: 'REPS · FORM · BURN',
    logoEmoji: '🔥',
  },
  bottomZone: {
    text: '#피트니스챌린지  #홈트  #스쿼트  #Workout  #FormFirst  #ChallengeStudio  ',
    bgColor: 'rgba(14,11,6,0.96)',
    textColor: '#CC785C',
    scrolling: true,
    fontSize: 13,
  },
  bgm: { genre: 'fitness', bpm: 130, volume: 0.55 },
  text_overlays: [
    { text: 'REP 01 · START', start_ms: 0, end_ms: 3000, xPct: 0.5, yPct: 0.855, fontSize: 26, color: '#F7F3EB', align: 'center', animation: 'slide_up', bold: true, bgColor: 'rgba(14,11,6,0.85)' },
    { text: '자세부터 정확하게', start_ms: 3000, end_ms: 9000, xPct: 0.5, yPct: 0.855, fontSize: 22, color: '#F7E4D9', align: 'center', animation: 'fade' },
    { text: '호흡 · 템포 · 코어', start_ms: 9000, end_ms: 16000, xPct: 0.5, yPct: 0.855, fontSize: 22, color: '#CC785C', align: 'center', animation: 'fade', bold: true },
    { text: 'HALFWAY · KEEP FORM', start_ms: 16000, end_ms: 23000, xPct: 0.5, yPct: 0.855, fontSize: 24, color: '#F7F3EB', align: 'center', animation: 'slide_up', bold: true, bgColor: 'rgba(161,98,68,0.85)' },
    { text: '마지막 세트 · 밀어붙이자', start_ms: 23000, end_ms: 32000, xPct: 0.5, yPct: 0.855, fontSize: 24, color: '#F7E4D9', align: 'center', animation: 'bounce', bold: true },
    { text: 'SESSION COMPLETE', start_ms: 32000, end_ms: 40000, xPct: 0.5, yPct: 0.855, fontSize: 28, color: '#F7F3EB', align: 'center', animation: 'slide_up', bold: true, bgColor: 'rgba(204,120,92,0.9)' },
    { text: 'CHALLENGE · STUDIO', start_ms: 0, end_ms: 40000, xPct: 0.97, yPct: 0.855, fontSize: 11, color: 'rgba(204,120,92,0.75)', align: 'right', animation: 'fade' },
  ],
  clip_slots: [{ id: 'fitness_main', start_ms: 0, end_ms: 40000, label: '운동 챌린지' }],
  hashtags: ['피트니스챌린지', '홈트', '운동', '다이어트', 'Workout'],
};

// ---------------------------------------------------------------------------
// TRAVEL template — vibrant sunset / wanderlust vibe
// ---------------------------------------------------------------------------

const vt_travel: VideoTemplate = {
  id: 'vt-travel',
  name: '✈️ 여행 브이로그',
  description: '선셋 그라데이션과 함께하는 여행 스타일 영상 템플릿',
  duration_ms: 30000,
  gradientColors: ['#1a0533', '#4a1060'],
  accentColor: '#f97316',
  bgStyle: 'travel',
  decorativeElements: 'world',
  mascotEmoji: '✈️',
  clipArea: {
    xPct: 0.03,
    yPct: 0.16,
    wPct: 0.94,
    hPct: 0.65,
    borderRadius: 20,
    glowColor: 'rgba(249,115,22,0.5)',
    borderColor: 'rgba(249,115,22,0.8)',
    borderWidth: 2,
  },
  topZone: {
    text: '✈️ TRAVEL CHALLENGE',
    bgColor: 'rgba(249,115,22,0.95)',
    textColor: '#fff',
    bold: true,
    subtext: '🌏 EXPLORE · DISCOVER · SHARE',
    logoEmoji: '🗺️',
  },
  bottomZone: {
    text: '#여행챌린지 #여행 #travel #vlog #여행브이로그 #TravelChallenge #세계여행 #여행스타그램 ',
    bgColor: 'rgba(26,5,51,0.95)',
    textColor: '#f97316',
    scrolling: true,
    fontSize: 13,
  },
  bgm: { genre: 'travel', bpm: 115, volume: 0.55 },
  text_overlays: [
    { text: '🌏 여행 챌린지 출발!', start_ms: 0, end_ms: 4000, xPct: 0.5, yPct: 0.845, fontSize: 28, color: '#fff', align: 'center', animation: 'slide_up', bold: true, bgColor: 'rgba(249,115,22,0.85)' },
    { text: '📸 순간을 담아요!', start_ms: 4000, end_ms: 10000, xPct: 0.5, yPct: 0.845, fontSize: 22, color: '#fde68a', align: 'center', animation: 'fade' },
    { text: '🗺️ 도전 중!', start_ms: 10000, end_ms: 17000, xPct: 0.5, yPct: 0.845, fontSize: 24, color: '#fff', align: 'center', animation: 'bounce', bold: true },
    { text: '🌅 이 순간 최고!', start_ms: 17000, end_ms: 24000, xPct: 0.5, yPct: 0.845, fontSize: 26, color: '#fbbf24', align: 'center', animation: 'slide_up', bold: true, bgColor: 'rgba(249,115,22,0.7)' },
    { text: '🏆 여행 챌린지 완료!', start_ms: 24000, end_ms: 30000, xPct: 0.5, yPct: 0.845, fontSize: 30, color: '#fff', align: 'center', animation: 'slide_up', bold: true, bgColor: 'rgba(249,115,22,0.9)' },
    { text: '✈️ CHALLENGE STUDIO', start_ms: 0, end_ms: 30000, xPct: 0.97, yPct: 0.845, fontSize: 11, color: 'rgba(249,115,22,0.6)', align: 'right', animation: 'fade' },
  ],
  clip_slots: [{ id: 'travel_main', start_ms: 0, end_ms: 30000, label: '여행 챌린지' }],
  hashtags: ['여행챌린지', '여행', 'travel', 'vlog', '여행브이로그'],
};

// ---------------------------------------------------------------------------
// HIPHOP template — dark urban, gold accent
// ---------------------------------------------------------------------------

const vt_hiphop: VideoTemplate = {
  id: 'vt-hiphop',
  name: '🎧 힙합 챌린지',
  description: '어두운 도시 감성의 힙합 스타일 챌린지 영상',
  duration_ms: 30000,
  gradientColors: ['#0a0a0a', '#1a1a0a'],
  accentColor: '#f7b731',
  bgStyle: 'hiphop',
  decorativeElements: 'urban',
  mascotEmoji: '🎧',
  clipArea: {
    xPct: 0.04,
    yPct: 0.15,
    wPct: 0.92,
    hPct: 0.65,
    borderRadius: 8,
    glowColor: 'rgba(247,183,49,0.6)',
    borderColor: 'rgba(247,183,49,0.9)',
    borderWidth: 3,
  },
  topZone: {
    text: '🎧 HIPHOP CHALLENGE',
    bgColor: 'rgba(10,10,10,0.95)',
    textColor: '#f7b731',
    bold: true,
    subtext: '🔥 FLOW · BARS · CYPHER',
    logoEmoji: '🎤',
  },
  bottomZone: {
    text: '#힙합챌린지 #hiphop #랩챌린지 #cypher #랩 #힙합 #HiphopChallenge #freestyle #랩스타 ',
    bgColor: 'rgba(5,5,5,0.98)',
    textColor: '#f7b731',
    scrolling: true,
    fontSize: 13,
  },
  bgm: { genre: 'hiphop', bpm: 92, volume: 0.60 },
  text_overlays: [
    { text: '🎤 DROP THE BEAT!', start_ms: 0, end_ms: 3000, xPct: 0.5, yPct: 0.84, fontSize: 32, color: '#f7b731', align: 'center', animation: 'slide_up', bold: true },
    { text: '🔥 FIRE FLOW!', start_ms: 3000, end_ms: 8000, xPct: 0.5, yPct: 0.84, fontSize: 28, color: '#fff', align: 'center', animation: 'bounce', bold: true, bgColor: 'rgba(247,183,49,0.2)' },
    { text: '💫 GOING HARD!', start_ms: 8000, end_ms: 14000, xPct: 0.5, yPct: 0.84, fontSize: 26, color: '#fde68a', align: 'center', animation: 'fade' },
    { text: '⚡ BARS ON BARS!', start_ms: 14000, end_ms: 20000, xPct: 0.5, yPct: 0.84, fontSize: 28, color: '#f7b731', align: 'center', animation: 'slide_up', bold: true, bgColor: 'rgba(10,10,10,0.8)' },
    { text: '🏆 CHALLENGE DONE!', start_ms: 24000, end_ms: 30000, xPct: 0.5, yPct: 0.84, fontSize: 32, color: '#f7b731', align: 'center', animation: 'slide_up', bold: true },
    { text: '🎧 CHALLENGE STUDIO', start_ms: 0, end_ms: 30000, xPct: 0.97, yPct: 0.84, fontSize: 11, color: 'rgba(247,183,49,0.5)', align: 'right', animation: 'fade' },
  ],
  clip_slots: [{ id: 'hiphop_main', start_ms: 0, end_ms: 30000, label: '힙합 챌린지' }],
  hashtags: ['힙합챌린지', 'hiphop', '랩챌린지', 'cypher', '힙합'],
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  vt_vlog,
  vt_news,
  vt_kpop,
  vt_english,
  vt_fairy,
  vt_fitness,
  vt_travel,
  vt_hiphop,
];

export function getVideoTemplate(id: string): VideoTemplate | null {
  return VIDEO_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Maps a mission genre string to the most appropriate template.
 * Falls back to vt-vlog for unknown genres.
 */
export function getTemplateByMissionId(genre: string): VideoTemplate | null {
  const normalized = genre.toLowerCase().trim();
  const mapping: Record<string, string> = {
    daily:     'vt-vlog',
    vlog:      'vt-vlog',
    news:      'vt-news',
    kpop:      'vt-kpop',
    english:   'vt-english',
    kids:      'vt-fairy',
    fairy:     'vt-fairy',
    children:  'vt-fairy',
    fitness:   'vt-fitness',
    workout:   'vt-fitness',
    travel:    'vt-travel',
    hiphop:    'vt-hiphop',
    hip_hop:   'vt-hiphop',
    challenge: 'vt-kpop',
    promotion: 'vt-news',
  };
  const templateId = mapping[normalized] ?? 'vt-vlog';
  return getVideoTemplate(templateId);
}
