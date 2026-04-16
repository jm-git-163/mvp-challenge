export type JointName =
  | 'nose' | 'left_eye' | 'right_eye'
  | 'left_ear' | 'right_ear'
  | 'left_shoulder' | 'right_shoulder'
  | 'left_elbow' | 'right_elbow'
  | 'left_wrist' | 'right_wrist'
  | 'left_hip' | 'right_hip'
  | 'left_knee' | 'right_knee'
  | 'left_ankle' | 'right_ankle';

export interface Mission {
  seq: number;
  start_ms: number;
  end_ms: number;
  type: 'pose' | 'voice' | 'expression';
  target_joints: Partial<Record<JointName, [number, number]>>; // [x, y] 0~1 정규화
  threshold: number; // 0~1, 최소 유사도 기준
  guide_text: string;
}

export interface SubtitleCue {
  start_ms: number;
  end_ms: number;
  text: string;
}

export interface Template {
  id: string;
  name: string;
  genre: 'kpop' | 'hiphop' | 'fitness' | 'challenge' | 'promotion';
  difficulty: 1 | 2 | 3; // 1=쉬움, 2=보통, 3=어려움
  duration_sec: number;
  bpm: number;
  bgm_url: string;
  thumbnail_url: string;
  missions: Mission[];
  subtitle_timeline: SubtitleCue[];
  created_at: string;
}
