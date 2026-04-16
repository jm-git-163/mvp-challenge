export type JointName =
  | 'nose' | 'left_eye' | 'right_eye'
  | 'left_ear' | 'right_ear'
  | 'left_shoulder' | 'right_shoulder'
  | 'left_elbow' | 'right_elbow'
  | 'left_wrist' | 'right_wrist'
  | 'left_hip' | 'right_hip'
  | 'left_knee' | 'right_knee'
  | 'left_ankle' | 'right_ankle';

export type GestureId =
  | 'hands_up'    // 양손 머리 위
  | 'v_sign'      // 브이 (손 얼굴 옆)
  | 'heart'       // 하트 (양손 모으기)
  | 'arms_spread' // 양팔 벌리기
  | 'thumbs_up'   // 엄지척
  | 'wave'        // 손 흔들기
  | 'point_cam'   // 카메라 가리키기
  | 'arms_cross'  // 팔짱
  | 'lean_left'   // 왼쪽으로 기울기
  | 'lean_right'; // 오른쪽으로 기울기

export interface Mission {
  seq: number;
  start_ms: number;
  end_ms: number;
  type: 'gesture' | 'timing' | 'expression' | 'pose';
  gesture_id?: GestureId;           // type=gesture 일 때
  target_joints?: Partial<Record<JointName, [number, number]>>; // type=pose 일 때
  threshold: number;
  guide_text: string;
  guide_emoji?: string;             // 미션 아이콘 이모지
}

export interface SubtitleCue {
  start_ms: number;
  end_ms: number;
  text: string;
  style?: 'normal' | 'bold' | 'highlight'; // 자막 스타일
}

export interface Template {
  id: string;
  name: string;
  genre: 'kpop' | 'hiphop' | 'fitness' | 'challenge' | 'promotion' | 'travel' | 'daily';
  difficulty: 1 | 2 | 3;
  duration_sec: number;
  bpm: number;
  bgm_url: string;
  thumbnail_url: string;
  theme_emoji: string;              // 템플릿 대표 이모지
  scene: string;                    // 촬영 상황 설명
  missions: Mission[];
  subtitle_timeline: SubtitleCue[];
  created_at: string;
}
