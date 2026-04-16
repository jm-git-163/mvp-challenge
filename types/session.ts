export type JudgementTag = 'perfect' | 'good' | 'fail';

export interface FrameTag {
  timestamp_ms: number;
  score: number;       // 포즈 유사도 0~1
  tag: JudgementTag;
  mission_seq: number;
}

export interface UserSession {
  id: string;
  user_id: string;
  template_id: string;
  recorded_at: string;
  avg_score: number;
  success_rate: number; // 0~1
  tag_timeline: FrameTag[];
  video_url: string | null;
  edited_video_url: string | null;
}

export interface UserProfile {
  user_id: string;
  preferred_genres: string[];
  success_rates: Record<string, number>; // mission_type → avg success rate
  total_sessions: number;
  weak_joints: string[];
}
