/**
 * data/templates/squat-master-chain.ts
 *
 * Phase 5 wave2 (2026-05-01) — **미션 체이닝 적용 템플릿**.
 *
 * 시퀀스: 스쿼트 5회 → 짧은 응원 자막 읽기 → 양손 V 제스처.
 *   각 미션 종료 → 1초 글로우 페이드 → 다음 미션.
 *   연속 성공 시 +10% 보너스 (최대 +50%).
 *
 * squat-master 의 비주얼 레이어를 그대로 재사용하되 missionTimeline 은 단일
 * placeholder 로 두고 missionSequence 가 실제 진행을 주도한다.
 */
import type { Template } from '../../engine/templates/schema';
import { squatMaster } from './squat-master';

const YELLOW = '#FFD23F';
const RED    = '#FF3B3B';

export const squatMasterChain: Template = {
  ...squatMaster,
  id: 'squat-master-chain',
  title: '스쿼트 마스터 — 챌린지 체인',
  description: '스쿼트 5회 → 응원 자막 → 양손 V — 연속 성공 시 보너스.',
  duration: 30,

  missionTimeline: [
    // 시퀀서가 실제 진행을 주도. timeline 은 zod 검증 (≥1, scoreWeight 합=1) 충족용 placeholder.
    { id: 'chain_root', startSec: 2, endSec: 30, mission: { kind: 'squat_count', target: 5 }, scoreWeight: 1.0, hudBinding: 'hud_counter' },
  ],

  missionSequence: {
    steps: [
      { id: 'sq5',    label: '스쿼트 5회',     spec: { kind: 'squat_count', target: 5 },                weight: 1, hudBinding: 'hud_counter' },
      { id: 'cheer',  label: '응원 자막 읽기', spec: { kind: 'read_script', script: '나는 할 수 있다' }, weight: 1, hudBinding: 'hud_prompt' },
      { id: 'v_sign', label: '양손 V 제스처',  spec: { kind: 'gesture', gesture: 'Victory' },           weight: 1 },
    ],
    transitions: [
      { durationMs: 1000, kind: 'glow_fade' },
    ],
    comboBonusPct: 10,
    comboBonusMaxPct: 50,
    passingScore: 60,
  },
};
