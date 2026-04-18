/**
 * videoTemplates.ts — CapCut 스타일 비디오 템플릿 정의
 */

export interface TextOverlay {
  text: string;
  start_ms: number;
  end_ms: number;
  yPct: number;       // 0.0 - 1.0, vertical position
  fontSize: number;
  color: string;
  align?: 'left' | 'center' | 'right';
  animation?: 'fade' | 'slide_up' | 'bounce';
}

export interface ClipSlot {
  id: string;
  start_ms: number;
  end_ms: number;
  label: string;
}

export interface TopBar {
  text: string;
  bg: string;
  color: string;
}

export interface BottomBar {
  text: string;
  bg: string;
  color: string;
}

export interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  duration_ms: number;
  gradientColors: [string, string];
  accentColor: string;
  topBar?: TopBar;
  bottomBar?: BottomBar;
  clip_slots: ClipSlot[];
  text_overlays: TextOverlay[];
  hashtags: string[];
}

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  // vt-vlog: 일상 브이로그
  {
    id: 'vt-vlog',
    name: '일상 브이로그',
    description: '오늘 하루 일상을 감성적으로 담아보세요',
    duration_ms: 60_000,
    gradientColors: ['#667eea', '#764ba2'],
    accentColor: '#a78bfa',
    topBar: { text: '📱 오늘의 브이로그', bg: 'rgba(102,126,234,0.85)', color: '#ffffff' },
    bottomBar: { text: '#일상브이로그 #오늘하루 #dailyvlog', bg: 'rgba(118,75,162,0.85)', color: '#e9d5ff' },
    clip_slots: [
      { id: 'intro', start_ms: 0, end_ms: 15_000, label: '인트로' },
      { id: 'main', start_ms: 15_000, end_ms: 45_000, label: '메인' },
      { id: 'outro', start_ms: 45_000, end_ms: 60_000, label: '아웃트로' },
    ],
    text_overlays: [
      { text: '✨ 오늘도 행복한 하루', start_ms: 2_000, end_ms: 7_000, yPct: 0.10, fontSize: 40, color: '#ffffff', animation: 'slide_up' },
      { text: '📱 일상 브이로그', start_ms: 8_000, end_ms: 13_000, yPct: 0.88, fontSize: 28, color: '#e9d5ff' },
      { text: '오늘 하루도 감사해요 💜', start_ms: 48_000, end_ms: 58_000, yPct: 0.10, fontSize: 36, color: '#fbbf24', animation: 'slide_up' },
    ],
    hashtags: ['일상브이로그', '오늘하루', 'dailyvlog', '브이로그', '일상'],
  },

  // vt-news: 뉴스 앵커
  {
    id: 'vt-news',
    name: '뉴스 앵커',
    description: '프로 뉴스 앵커처럼 완성도 높은 뉴스 영상',
    duration_ms: 90_000,
    gradientColors: ['#0a1628', '#0d2137'],
    accentColor: '#3b82f6',
    topBar: { text: '📺 LIVE NEWS · 속보', bg: 'rgba(21,101,192,0.95)', color: '#ffffff' },
    bottomBar: { text: '🔴 속보 · Breaking News · 오늘의 뉴스 · 최신 뉴스 · 속보 ·', bg: '#1565c0', color: '#bbdefb' },
    clip_slots: [
      { id: 'opening', start_ms: 0, end_ms: 20_000, label: '오프닝' },
      { id: 'main_news', start_ms: 20_000, end_ms: 60_000, label: '주요뉴스' },
      { id: 'closing', start_ms: 60_000, end_ms: 90_000, label: '클로징' },
    ],
    text_overlays: [
      { text: '📺 오늘의 주요 뉴스', start_ms: 1_000, end_ms: 7_000, yPct: 0.88, fontSize: 32, color: '#93c5fd', animation: 'slide_up' },
      { text: '전국 날씨 · 오늘 맑음 최고 25°', start_ms: 25_000, end_ms: 35_000, yPct: 0.88, fontSize: 26, color: '#bfdbfe' },
      { text: '시청해주셔서 감사합니다', start_ms: 80_000, end_ms: 88_000, yPct: 0.10, fontSize: 34, color: '#ffffff', animation: 'fade' },
    ],
    hashtags: ['뉴스앵커', '챌린지', '앵커도전', 'newsanchor', '뉴스스타'],
  },

  // vt-kpop: K-POP 챌린지
  {
    id: 'vt-kpop',
    name: 'K-POP 챌린지',
    description: 'K-POP 스타처럼 퍼포먼스 완성 영상',
    duration_ms: 60_000,
    gradientColors: ['#1a1a2e', '#0f3460'],
    accentColor: '#e94560',
    topBar: { text: '🎤 K-POP CHALLENGE', bg: 'rgba(233,69,96,0.9)', color: '#ffffff' },
    bottomBar: { text: '#kpop #챌린지 #케이팝 #kpopchallenge', bg: 'rgba(15,52,96,0.9)', color: '#fca5a5' },
    clip_slots: [
      { id: 'intro', start_ms: 0, end_ms: 10_000, label: '인트로' },
      { id: 'chorus', start_ms: 10_000, end_ms: 45_000, label: '퍼포먼스' },
      { id: 'outro', start_ms: 45_000, end_ms: 60_000, label: '아웃트로' },
    ],
    text_overlays: [
      { text: '🎤 K-POP CHALLENGE', start_ms: 1_000, end_ms: 8_000, yPct: 0.10, fontSize: 44, color: '#e94560', animation: 'slide_up' },
      { text: '준비됐나요? 🔥', start_ms: 3_000, end_ms: 9_000, yPct: 0.88, fontSize: 30, color: '#fca5a5' },
      { text: '💃 최고의 퍼포먼스!', start_ms: 20_000, end_ms: 28_000, yPct: 0.88, fontSize: 32, color: '#fb923c', animation: 'bounce' },
      { text: '완벽해! 🌟', start_ms: 50_000, end_ms: 58_000, yPct: 0.10, fontSize: 48, color: '#fbbf24', animation: 'slide_up' },
    ],
    hashtags: ['kpop', '케이팝챌린지', 'kpopchallenge', '댄스챌린지', '한류'],
  },

  // vt-english: 영어 스피킹
  {
    id: 'vt-english',
    name: '영어 스피킹',
    description: '영어 말하기 실력을 영상으로 남겨보세요',
    duration_ms: 75_000,
    gradientColors: ['#1e3a5f', '#0f2240'],
    accentColor: '#60a5fa',
    topBar: { text: '🌍 English Speaking Challenge', bg: 'rgba(37,99,235,0.9)', color: '#ffffff' },
    bottomBar: { text: '#영어챌린지 #EnglishChallenge #영어공부 #speakenglish', bg: 'rgba(30,58,95,0.9)', color: '#bfdbfe' },
    clip_slots: [
      { id: 'greeting', start_ms: 0, end_ms: 15_000, label: '인사' },
      { id: 'speaking', start_ms: 15_000, end_ms: 60_000, label: '스피킹' },
      { id: 'bye', start_ms: 60_000, end_ms: 75_000, label: '마무리' },
    ],
    text_overlays: [
      { text: '🌍 English Speaking Challenge', start_ms: 1_000, end_ms: 8_000, yPct: 0.10, fontSize: 34, color: '#ffffff', animation: 'slide_up' },
      { text: "Let's speak English! 💬", start_ms: 2_000, end_ms: 9_000, yPct: 0.88, fontSize: 28, color: '#93c5fd' },
      { text: '🎓 Level Up!', start_ms: 65_000, end_ms: 73_000, yPct: 0.10, fontSize: 42, color: '#fbbf24', animation: 'slide_up' },
    ],
    hashtags: ['영어챌린지', 'englishchallenge', '영어말하기', '영어공부', 'speakenglish'],
  },

  // vt-fairy: 동화책 낭독
  {
    id: 'vt-fairy',
    name: '동화책 낭독',
    description: '감성적인 동화 낭독 완성 영상',
    duration_ms: 80_000,
    gradientColors: ['#7c3aed', '#db2777'],
    accentColor: '#f9a8d4',
    topBar: { text: '📖 동화책 낭독 · Storytelling', bg: 'rgba(124,58,237,0.85)', color: '#fdf2f8' },
    bottomBar: { text: '#동화낭독 #storytelling #동화책 #낭독챌린지', bg: 'rgba(219,39,119,0.85)', color: '#fce7f3' },
    clip_slots: [
      { id: 'once_upon', start_ms: 0, end_ms: 20_000, label: '옛날 옛날에' },
      { id: 'story', start_ms: 20_000, end_ms: 65_000, label: '이야기' },
      { id: 'end', start_ms: 65_000, end_ms: 80_000, label: '해피엔딩' },
    ],
    text_overlays: [
      { text: '📖 옛날 옛날에...', start_ms: 1_000, end_ms: 8_000, yPct: 0.10, fontSize: 40, color: '#fdf2f8', animation: 'slide_up' },
      { text: '🌙 동화 세계로 초대합니다', start_ms: 3_000, end_ms: 10_000, yPct: 0.88, fontSize: 26, color: '#f9a8d4' },
      { text: '그리고 행복하게 살았대요 ✨', start_ms: 70_000, end_ms: 79_000, yPct: 0.10, fontSize: 32, color: '#fbbf24', animation: 'fade' },
    ],
    hashtags: ['동화낭독', '동화챌린지', 'storytelling', '낭독챌린지', '동화책'],
  },
];

export function getVideoTemplate(id: string): VideoTemplate | undefined {
  return VIDEO_TEMPLATES.find((t) => t.id === id);
}

export function getTemplateByMissionId(genre: string): VideoTemplate | undefined {
  const map: Record<string, string> = {
    daily: 'vt-vlog',
    news: 'vt-news',
    kpop: 'vt-kpop',
    english: 'vt-english',
    kids: 'vt-fairy',
  };
  const id = map[genre];
  return id ? getVideoTemplate(id) : VIDEO_TEMPLATES[0];
}
