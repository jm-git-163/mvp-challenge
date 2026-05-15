export type GestureId =
  | 'hands_up' | 'v_sign' | 'heart' | 'arms_spread'
  | 'thumbs_up' | 'wave' | 'point_cam' | 'arms_cross'
  | 'lean_left' | 'lean_right' | 'smile_big' | 'surprise';

export type MissionType = 'gesture' | 'voice_read' | 'timing' | 'expression';
export type CameraMode = 'selfie' | 'normal';
export type ThemeId =
  | 'daily' | 'news' | 'english' | 'fairy_tale' | 'travel'
  | 'product' | 'kpop' | 'food' | 'motivation' | 'kids';

export interface VirtualBackground {
  type: 'gradient' | 'pattern' | 'frame';
  css: string;             // CSS string for background
  overlayTop?: string;     // text for top overlay (e.g. news ticker)
  overlayBottom?: string;  // text for bottom overlay
  frameColor?: string;     // frame border color
}

export interface Mission {
  seq: number;
  start_ms: number;
  end_ms: number;
  type: MissionType;
  // gesture type
  gesture_id?: GestureId;
  gesture_emoji?: string;    // e.g. "✌️"
  // voice_read type
  // FIX-SCRIPT-POOL (2026-04-23): 단일 문자열(고정) 또는 배열(세션마다 로테이션) 허용.
  //   배열인 경우 useJudgement 가 pickScriptWithHistory 로 localStorage 기반 최근
  //   3개 제외 랜덤 선택 → 사용자가 동일 템플릿을 반복 실행해도 다른 대본을 읽게 됨.
  //   기존 단일 string 은 하위호환 유지.
  // FIX-SCRIPT-I18N (2026-04-23 v4): 영어 챌린지는 { text, translation } 객체로도
  //   풀을 제공해 프롬프터가 한글 번역을 함께 표시할 수 있게 함. 기존 string/string[]
  //   은 하위호환 그대로 유지.
  read_text?: string | Array<string | { text: string; translation?: string }>;
  read_lang?: 'ko' | 'en';  // language for speech recognition
  // common
  threshold: number;         // 0~1 pass threshold
  guide_text: string;        // shown in mission card
  guide_emoji?: string;
  anim_type?: 'bounce' | 'pulse' | 'shake' | 'spin' | 'float'; // animation style
}

export interface SubtitleCue {
  start_ms: number;
  end_ms: number;
  text: string;
  style?: 'normal' | 'bold' | 'highlight' | 'news' | 'story';
  highlight_color?: string;
}

// ─── New: Intro / Outro / Layer system ───────────────────────────────────────

export interface TemplateIntro {
  duration_ms: number;        // e.g. 4000
  title: string;              // big dramatic text shown
  subtitle?: string;          // secondary line
  bgColor: string;            // gradient start color
  bgColor2: string;           // gradient end color
  animation: 'zoom_in' | 'slide_up' | 'particle_burst' | 'glitch';
  soundEffect?: 'whoosh' | 'impact' | 'fanfare';
  accentColor?: string;       // neon accent / glow color
}

export interface TemplateOutro {
  duration_ms: number;        // e.g. 3000
  title: string;              // celebration title
  subtitle?: string;
  animation: 'score_explosion' | 'confetti' | 'crown';
  accentColor?: string;
}

export type TemplateLayerType =
  | 'spotlight'     // sweeping stage spotlight beam
  | 'ticker'        // scrolling news ticker
  | 'lower_third'   // TV lower-third name bar
  | 'vignette'      // dark edge vignette
  | 'scanlines'     // CRT scanline effect
  | 'star_rain'     // star particles falling
  | 'beat_flash';   // color flash on beat

export interface TemplateLayer {
  type: TemplateLayerType;
  color?: string;
  opacity?: number;
  text?: string;    // for ticker / lower_third
  speed?: number;   // animation speed multiplier
}

export interface Template {
  id: string;
  name: string;
  genre: 'kpop' | 'hiphop' | 'fitness' | 'challenge' | 'promotion' | 'travel' | 'daily' | 'news' | 'english' | 'kids';
  theme_id: ThemeId;
  camera_mode: CameraMode;
  difficulty: 1 | 2 | 3;
  duration_sec: number;
  bpm: number;
  bgm_url: string;
  thumbnail_url: string;
  theme_emoji: string;
  scene: string;
  virtual_bg: VirtualBackground;
  missions: Mission[];
  subtitle_timeline: SubtitleCue[];
  sns_template: {
    hashtags: string[];
    caption_template: string;  // e.g. "나 오늘 {template_name} 챌린지 성공! 🎉"
    video_frame_css: string;   // CSS for video frame in result screen
  };
  created_at: string;

  // ── Rich production fields (optional, backward-compatible) ──────────────
  intro?: TemplateIntro;
  outro?: TemplateOutro;
  layers?: TemplateLayer[];   // always-on visual layers during recording
  ticker?: string;            // news ticker scrolling text (shorthand)
  spotlights?: boolean;       // kpop stage spotlights
}
