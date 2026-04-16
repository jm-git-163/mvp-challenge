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
  read_text?: string;        // text to read aloud
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
}
