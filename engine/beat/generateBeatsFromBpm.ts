/**
 * engine/beat/generateBeatsFromBpm.ts
 *
 * Focused Session-3 Candidate K: **BPM 기반 결정적 Beats JSON 생성**.
 *
 * 실제 BGM 오디오 분석(essentia.js / web-audio-beat-detector) 이 가능할 때까지
 * BPM/박자/길이만으로 `BeatData` 를 생성하는 순수 함수.
 *
 * 출력 포맷은 `engine/beat/beatClock.ts` 의 BeatData 와 동일:
 *   { bpm, beats: number[], onsets: number[], downbeats: number[] }
 *
 * 모든 타임스탬프는 **초 단위, 소수점 3자리 반올림**. 재실행 시 동일 바이너리.
 * BGM 교체 전까지 KPOP/news/emoji 템플릿의 onBeat 바인딩을 작동시키는 최소 데이터.
 */

export interface BeatData {
  /** BPM (beats per minute). */
  bpm: number;
  /** 모든 비트 타임스탬프 (sec). */
  beats: number[];
  /**
   * onset 후보 (sec). 기본 = beats 와 동일 (킥/스네어 구분 없음).
   * 실제 오디오 분석 가능할 때 스네어/하이햇 추가.
   */
  onsets: number[];
  /** 다운비트 (마디 첫 비트) 타임스탬프 (sec). */
  downbeats: number[];
}

export interface GenerateBeatsOptions {
  /** 곡 길이 (sec). */
  durationSec: number;
  /** 분당 비트 수. */
  bpm: number;
  /**
   * 박자: 4/4 기본 → beatsPerBar=4. 6/8 은 6 등.
   * downbeats = beats 중 i % beatsPerBar === 0 인 것.
   */
  beatsPerBar?: number;
  /**
   * 시작 오프셋 (sec). 인트로가 비박자인 곡에서 첫 비트를 뒤로 미룸.
   * 기본 0.
   */
  startOffsetSec?: number;
}

/** 숫자를 소수점 N자리로 결정적으로 반올림. */
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/**
 * BPM + 길이 → BeatData 생성.
 *
 * 불변식:
 *   - beats 는 오름차순
 *   - downbeats ⊆ beats
 *   - 모든 타임스탬프 ∈ [0, durationSec]
 *   - beats.length ≈ durationSec * bpm / 60  (경계 반올림으로 ±1)
 */
export function generateBeatsFromBpm(opts: GenerateBeatsOptions): BeatData {
  const bpm = Math.max(1, Math.floor(opts.bpm));
  const duration = Math.max(0, opts.durationSec);
  const beatsPerBar = Math.max(1, Math.floor(opts.beatsPerBar ?? 4));
  const offset = Math.max(0, opts.startOffsetSec ?? 0);
  const interval = 60 / bpm;

  const beats: number[] = [];
  for (let t = offset; t <= duration + 1e-9; t += interval) {
    if (t > duration) break;
    beats.push(round3(t));
  }
  const downbeats: number[] = [];
  for (let i = 0; i < beats.length; i += beatsPerBar) {
    downbeats.push(beats[i]);
  }

  return {
    bpm,
    beats,
    onsets: [...beats],
    downbeats,
  };
}

/**
 * BeatData 직렬화 (JSON.stringify 래퍼, 2-space indent).
 * 재현 가능한 diff 를 위해 키 순서 고정.
 */
export function serializeBeatData(data: BeatData): string {
  const ordered = {
    bpm: data.bpm,
    beats: data.beats,
    onsets: data.onsets,
    downbeats: data.downbeats,
  };
  return JSON.stringify(ordered, null, 2);
}
