/**
 * engine/result/recordSummary.ts
 *
 * Phase 7 — 결과 페이지에 표시할 세션 요약 생성.
 *
 * 입력: 미션 결과들 + 세션 메타 → ResultSummary.
 * 공유 텍스트·요약 한글 문구 결정론적으로 생성.
 */

import type { SessionScore, MissionResult } from '../scoring/scorer';

export interface SessionMeta {
  templateId: string;
  templateTitle: string;
  durationSec: number;
  recordedAtMs: number;
  blobBytes: number;
}

export interface ResultSummary {
  session: SessionScore;
  meta: SessionMeta;
  /** UI 상단에 보여줄 한줄 문구. */
  headline: string;
  /** 각 미션 한줄 설명. */
  missionLines: string[];
  /** 공유용 텍스트 (navigator.share 의 text). */
  shareText: string;
  /** 별점 이모지 시각화 (⭐ × stars + ☆ × 나머지). */
  starEmoji: string;
}

const MISSION_KO: Record<MissionResult['kind'], string> = {
  squat: '스쿼트',
  smile: '미소',
  gesture: '제스처',
  pose_hold: '포즈 유지',
  loud_voice: '크게 외치기',
  script: '스크립트 낭독',
};

export function summarizeResult(session: SessionScore, meta: SessionMeta): ResultSummary {
  const headline = computeHeadline(session);
  const missionLines = session.missions.map((m) => {
    const label = MISSION_KO[m.kind] ?? m.kind;
    return `${label} · ${m.score}점 (가중 ${(m.weight * 100).toFixed(0)}%)`;
  });
  const stars = '⭐'.repeat(session.stars) + '☆'.repeat(Math.max(0, 5 - session.stars));
  const shareText = [
    `MotiQ "${meta.templateTitle}" ${session.total}점 ${stars}`,
    session.passed ? '통과! 🎉' : '다시 도전해보세요 💪',
  ].join('\n');
  return {
    session,
    meta,
    headline,
    missionLines,
    shareText,
    starEmoji: stars,
  };
}

function computeHeadline(s: SessionScore): string {
  if (s.total >= 95) return '완벽해요! 🏆';
  if (s.total >= 85) return '훌륭해요! ✨';
  if (s.total >= 70) return '잘했어요 👏';
  if (s.total >= 60) return '통과! 다음엔 더 잘할 수 있어요.';
  if (s.total >= 40) return '조금만 더 집중해볼까요?';
  return '다시 도전해보세요 💪';
}

/** 바이트 → 사람이 읽을 수 있는 크기. */
export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
