/**
 * engine/missions/scriptPrompterMission.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — STT 없는 대본 낭독 미션.
 *
 * 배경: 실기기 A/B 테스트 결과 (사용자 2026-04-22)
 *   - webkitSpeechRecognition: Android Chrome getUserMedia 충돌로 신뢰 불가
 *   - Whisper-tiny WASM: 유사도 23.7% / 전사지연 5초 → 실시간 자막 불가
 *   → STT 기반 평가 포기. "사용자 목소리는 녹화 mp4 에 그대로 박히고,
 *      화면에는 멋진 프롬프터 + 카라오케 타이밍. 점수는 완주율 기반."
 *
 * 점수 공식 (0~100):
 *   completion(60) + reading_pace(25) + presence(15)
 *
 *   - completion  = min(1, elapsedMs / expectedMs)
 *     목표 낭독 시간에 가까울수록 만점. 스크립트를 끝까지 봤는지의 프록시.
 *   - reading_pace = 1 − |elapsedMs − expectedMs| / expectedMs, clamped [0.3, 1.0]
 *     너무 빠르지도 느리지도 않을수록 만점. 하한 0.3.
 *   - presence    = 얼굴(또는 pose) visibility 샘플 평균 (optional; 주입 없으면 1.0).
 *
 * 완전 결정론. STT·네트워크·랜덤 0.
 *
 * 사용:
 *   const m = new ScriptPrompterMission({ script: '…', expectedReadMs: 10_000 });
 *   m.begin(now);
 *   // 매 프레임: m.tick(now, { faceVisible: true });
 *   m.finish(now);
 *   const s = m.totalScore(); // 0..100
 */

export interface ScriptPrompterParams {
  /** 낭독할 스크립트. 표시 전용 (글자 수로 기대시간 파생 가능). */
  script: string;
  /** 기대 낭독 시간 (ms). 미지정시 script 글자수 × 180ms 로 자동 산출. */
  expectedReadMs?: number;
  /** pace 하한 (0..1). 기본 0.3. */
  paceFloor?: number;
}

export interface ScriptPrompterState {
  started: boolean;
  startedAt: number | null;
  endedAt: number | null;
  presenceSamples: number;
  presenceSum: number;
  /** TEAM-ACCURACY (2026-04-23): 음성 활동 증거 샘플 수. */
  voiceSamples: number;
  /** voiceActive === true 로 기록된 프레임 수. */
  voiceActiveSum: number;
}

export interface ScriptPrompterTickInfo {
  /** 이 프레임에서 얼굴/상체가 보였는가. */
  visible?: boolean;
  /**
   * TEAM-ACCURACY (2026-04-23): 이 프레임에서 마이크에 목소리가 있었는가.
   *   호출 측이 AnalyserNode 등으로 판정 (dB 임계치 등). undefined 면 음성 게이트 비활성.
   */
  voiceActive?: boolean;
}

export class ScriptPrompterMission {
  private readonly p: Required<ScriptPrompterParams>;
  private s: ScriptPrompterState = {
    started: false, startedAt: null, endedAt: null,
    presenceSamples: 0, presenceSum: 0,
    voiceSamples: 0, voiceActiveSum: 0,
  };

  constructor(params: ScriptPrompterParams) {
    const expected = params.expectedReadMs ?? Math.max(3_000, params.script.length * 180);
    this.p = {
      expectedReadMs: expected,
      paceFloor: params.paceFloor ?? 0.3,
      ...params,
    };
  }

  begin(t: number): void {
    this.s = {
      started: true, startedAt: t, endedAt: null,
      presenceSamples: 0, presenceSum: 0,
      voiceSamples: 0, voiceActiveSum: 0,
    };
  }

  tick(_t: number, info: ScriptPrompterTickInfo = {}): void {
    if (!this.s.started || this.s.endedAt !== null) return;
    this.s.presenceSamples += 1;
    this.s.presenceSum += info.visible === false ? 0 : 1;
    if (info.voiceActive !== undefined) {
      this.s.voiceSamples += 1;
      this.s.voiceActiveSum += info.voiceActive ? 1 : 0;
    }
  }

  finish(t: number): void {
    if (!this.s.started) return;
    this.s.endedAt = t;
  }

  getState(): Readonly<ScriptPrompterState> { return this.s; }

  private elapsedMs(): number {
    if (this.s.startedAt === null) return 0;
    const end = this.s.endedAt ?? this.s.startedAt;
    return Math.max(0, end - this.s.startedAt);
  }

  completion(): number {
    const e = this.elapsedMs();
    if (this.p.expectedReadMs <= 0) return 1;
    return Math.min(1, e / this.p.expectedReadMs);
  }

  readingPace(): number {
    const e = this.elapsedMs();
    if (this.p.expectedReadMs <= 0) return 1;
    const dev = Math.abs(e - this.p.expectedReadMs) / this.p.expectedReadMs;
    const raw = 1 - dev;
    return Math.max(this.p.paceFloor, Math.min(1, raw));
  }

  presence(): number {
    if (this.s.presenceSamples === 0) return 1;
    return this.s.presenceSum / this.s.presenceSamples;
  }

  /**
   * TEAM-ACCURACY (2026-04-23): 음성 활동 비율 (0..1). 게이트 미사용 시 1.
   *   사용자 "말 안했는데도 100점" 피드백 대응 — totalScore 에서 cap 으로 사용.
   */
  voiceEvidence(): number {
    if (this.s.voiceSamples === 0) return 1;
    return this.s.voiceActiveSum / this.s.voiceSamples;
  }

  /**
   * 0..100 결정론적 총점.
   * 음성 게이트: voiceSamples>0 이면 voiceEvidence 비율로 상한. 0% 목소리 → 0점.
   */
  totalScore(): number {
    const raw = this.completion() * 60 + this.readingPace() * 25 + this.presence() * 15;
    const ev = this.voiceEvidence();
    // 음성이 거의 없으면 (<5%) 0. 5~30% 는 선형. 30%+ 통과.
    const gate = ev < 0.05 ? 0 : ev >= 0.30 ? 1 : (ev - 0.05) / 0.25;
    return Math.round(raw * gate);
  }

  reset(): void {
    this.s = {
      started: false, startedAt: null, endedAt: null,
      presenceSamples: 0, presenceSum: 0,
      voiceSamples: 0, voiceActiveSum: 0,
    };
  }
}

/**
 * 세션별 스크립트 선택 (재시도마다 다른 대본).
 * pool 이 string 배열이면 랜덤 선택. 단일 string 이면 그대로.
 * FIX-SCRIPT-POOL (2026-04-22) 연결 유틸.
 */
export function pickScript(pool: string | readonly string[], rng: () => number = Math.random): string {
  if (typeof pool === 'string') return pool;
  if (!pool || pool.length === 0) return '';
  const idx = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)));
  return pool[idx];
}

/**
 * FIX-SCRIPT-POOL (2026-04-23): localStorage 기반 최근 N개 제외 로테이션.
 *
 * 동일 템플릿+미션 조합을 반복 실행할 때 같은 대본이 연속해서 나오지 않도록
 * `motiq_script_history_<templateId>_<missionId>` 키로 최근 선택된 인덱스를 저장,
 * 그 집합을 제외한 후보 중 랜덤 선택. 풀 크기가 historySize+1 이하이면 제외 없이
 * 전체 풀에서 랜덤 (폴백).
 *
 * SSR 안전: typeof window === 'undefined' 이면 히스토리 없이 pickScript 동작.
 *
 * @param pool 스크립트 후보 배열
 * @param templateId localStorage 키 네임스페이스용
 * @param missionId  미션 식별자 (seq 등)
 * @param opts.historySize 최근 제외 개수 (기본 3)
 * @param opts.rng 테스트용 결정론적 난수 소스 (기본 Math.random)
 */
export function pickScriptWithHistory(
  pool: readonly string[],
  templateId: string,
  missionId: string,
  opts?: { historySize?: number; rng?: () => number },
): string {
  if (!pool || pool.length === 0) return '';
  const rng = opts?.rng ?? Math.random;
  if (pool.length === 1) return pool[0];

  const historySize = Math.max(0, opts?.historySize ?? 3);
  const storageKey = `motiq_script_history_${templateId}_${missionId}`;

  // ── localStorage 히스토리 로드 (SSR 안전) ─────────────────────────
  let history: number[] = [];
  const hasWindow = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  if (hasWindow) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          history = parsed.filter((n: unknown): n is number => typeof n === 'number' && Number.isInteger(n));
        }
      }
    } catch { /* corrupt storage → 무시 */ }
  }

  // 제외 집합 — 풀 크기가 너무 작으면 비워버려 전체에서 선택.
  const excluded = new Set<number>(pool.length > historySize ? history.slice(0, historySize) : []);
  const candidates: number[] = [];
  for (let i = 0; i < pool.length; i++) if (!excluded.has(i)) candidates.push(i);
  const chosen = candidates.length > 0
    ? candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(rng() * candidates.length)))]
    : Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)));

  // ── 히스토리 업데이트 (맨 앞에 push, historySize 로 truncate) ────
  if (hasWindow) {
    try {
      const next = [chosen, ...history.filter((i) => i !== chosen)].slice(0, historySize);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch { /* 용량/권한 에러 무시 */ }
  }

  return pool[chosen];
}
