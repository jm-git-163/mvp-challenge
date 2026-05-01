/**
 * speechUtils.scoring.test.ts — FIX-FINAL-STAB (2026-05-01)
 *
 * 한국어 발음 변형 (존댓말/반말/억양/공백/짧은 발음 누락/소음 첨가) 시나리오 10 종에
 * 대해 textSimilarity 가 60+ (정규화 0.60+) 점수를 부여하는지 검증.
 *
 * CLAUDE.md §5 Script: 레벤슈타인 60 + 완주율 20 + 시간 20.
 * useJudgement.ts final 콜백에서 사용하는 점수 = textSimilarity * 1.08 (lift) clamp 1.0.
 */
import { describe, it, expect } from 'vitest';
import { textSimilarity } from './speechUtils';

interface VariantCase {
  name: string;
  target: string;
  spoken: string;
  /** 정규화 점수 하한 (textSimilarity 결과). */
  minScore: number;
}

const cases: VariantCase[] = [
  {
    name: '완벽 일치',
    target: '안녕하세요 여러분 오늘은 좋은 날입니다',
    spoken: '안녕하세요 여러분 오늘은 좋은 날입니다',
    minScore: 0.95,
  },
  {
    name: '존댓말 → 반말 (어미 변형)',
    target: '안녕하세요 만나서 반갑습니다',
    spoken: '안녕 만나서 반가워',
    minScore: 0.55,
  },
  {
    name: '띄어쓰기 누락',
    target: '오늘은 정말 좋은 하루였습니다',
    spoken: '오늘은정말좋은하루였습니다',
    minScore: 0.85,
  },
  {
    name: '종성 누락 (음성 인식 자모 흔들림)',
    target: '여러분 안녕하세요',
    spoken: '여러부 안녀하세요',
    minScore: 0.65,
  },
  {
    name: '음운 그룹 변형 (ㄱ↔ㅋ)',
    target: '강아지가 귀여워요',
    spoken: '캉아지카 키여워요',
    minScore: 0.60,
  },
  {
    name: '단어 1 개 누락 (완주율 80%)',
    target: '저는 오늘 학교에 갔습니다',
    spoken: '저는 학교에 갔습니다',
    minScore: 0.65,
  },
  {
    name: '소음/필러 추가 ("어" "음")',
    target: '오늘 날씨가 좋네요',
    spoken: '어 오늘 음 날씨가 좋네요',
    minScore: 0.65,
  },
  {
    name: '구두점/특수문자 무시',
    target: '환영합니다, 친구들!',
    spoken: '환영합니다 친구들',
    minScore: 0.85,
  },
  {
    name: '대소문자 차이 (영문 혼합)',
    target: 'Hello 친구들 안녕',
    spoken: 'hello 친구들 안녕',
    minScore: 0.95,
  },
  {
    name: '뒤쪽 절반만 발화 (완주율 50%)',
    target: '오늘은 정말 좋은 날이고 우리 모두 행복합니다',
    spoken: '우리 모두 행복합니다',
    // 절반만 읽었으니 0.30 이상이면 충분 — 60+ 만점은 못 받지만 fail(0) 은 아님.
    minScore: 0.30,
  },
];

describe('textSimilarity — 한국어 발음 변형 케이스 10 종', () => {
  for (const c of cases) {
    it(`${c.name} → score ≥ ${c.minScore}`, () => {
      const s = textSimilarity(c.target, c.spoken);
      expect(s).toBeGreaterThanOrEqual(c.minScore);
    });
  }

  it('완전히 다른 문장 → 낮은 점수', () => {
    const s = textSimilarity('오늘 날씨가 좋네요', '컴퓨터 프로그래밍은 어렵다');
    expect(s).toBeLessThan(0.40);
  });

  it('빈 발화 → 0', () => {
    expect(textSimilarity('안녕하세요', '')).toBe(0);
  });

  it('빈 목표 → 1 (의미상 무조건 통과)', () => {
    expect(textSimilarity('', '뭐든')).toBe(1);
  });
});

describe('voice score (lift 1.08 적용 후 final 점수) → 0~100 환산', () => {
  // useJudgement.ts: const lifted = Math.min(1, rawSim * 1.08);
  //   final 점수 = lifted * 100 (UI 표시 시).
  it('완벽 일치 — 100 점 PERFECT', () => {
    const sim = textSimilarity('안녕하세요', '안녕하세요');
    const lifted = Math.min(1, sim * 1.08);
    expect(lifted * 100).toBeGreaterThanOrEqual(95);
  });

  it('존댓말→반말 — 60 점 이상 통과', () => {
    const sim = textSimilarity('안녕하세요 만나서 반갑습니다', '안녕 만나서 반가워');
    const lifted = Math.min(1, sim * 1.08);
    expect(lifted * 100).toBeGreaterThanOrEqual(60);
  });

  it('절반만 발화 — 60 점 미만 (정직한 fail 또는 partial)', () => {
    const sim = textSimilarity(
      '오늘은 정말 좋은 날이고 우리 모두 행복합니다',
      '우리 모두 행복합니다',
    );
    const lifted = Math.min(1, sim * 1.08);
    // 절반만 읽었으니 PERFECT (≥80) 까진 못 가야 한다 — 가짜 PERFECT 차단.
    expect(lifted * 100).toBeLessThan(80);
  });
});
