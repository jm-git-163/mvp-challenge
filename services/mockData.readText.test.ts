/**
 * mockData.readText.test.ts — voice_read 미션 대본 풀 크기·품질 검증.
 *
 * FIX-SCRIPT-POOL (2026-04-23): 템플릿 반복 실행 시 다양한 문장을 읽도록 풀을
 *   충분히 두었는지 정량 검증. 기준값은 CLAUDE.md 작업 명세의 숫자.
 */
import { describe, it, expect } from 'vitest';
import { MOCK_TEMPLATES } from './mockData';

// 각 템플릿 ID 별 voice_read 미션 풀 최소 크기 기준.
//   (전체 미션의 read_text 배열 합산 — 같은 풀을 공유해도 문장 수 자체가 기준 충족이면 OK.)
const MIN_POOL_SIZES: Record<string, number> = {
  'daily-vlog-001':       12,
  'news-anchor-002':      18,
  'english-lesson-003':   12,
  'fairy-tale-004':       15,
  'travel-cert-005':      12,
  'product-unbox-006':    12,
  'english-speak-009':    12,
  'kids-story-010':       15,
  'hiphop-cypher-012':     8,
};

describe('voice_read 미션 풀 크기', () => {
  for (const [tmplId, minSize] of Object.entries(MIN_POOL_SIZES)) {
    it(`${tmplId}: voice_read 풀 총합 ≥ ${minSize}`, () => {
      const t = MOCK_TEMPLATES.find((x) => x.id === tmplId);
      expect(t, `템플릿 ${tmplId} 존재`).toBeTruthy();
      const voiceReads = t!.missions.filter((m) => m.type === 'voice_read');
      expect(voiceReads.length).toBeGreaterThan(0);
      // 모든 voice_read 미션의 풀을 Set 으로 모아 고유 문장 수 검증.
      const unique = new Set<string>();
      for (const m of voiceReads) {
        const rt = m.read_text;
        if (!rt) continue;
        if (Array.isArray(rt)) rt.forEach((s) => unique.add(typeof s === 'string' ? s : s.text));
        else unique.add(rt);
      }
      expect(unique.size, `고유 문장 수`).toBeGreaterThanOrEqual(minSize);
    });
  }

  it('모든 voice_read read_text 는 string | string[]', () => {
    for (const t of MOCK_TEMPLATES) {
      for (const m of t.missions) {
        if (m.type !== 'voice_read') continue;
        if (m.read_text === undefined) continue;
        const ok = typeof m.read_text === 'string' || Array.isArray(m.read_text);
        expect(ok, `${t.id} seq=${m.seq}`).toBe(true);
        if (Array.isArray(m.read_text)) {
          expect(m.read_text.length).toBeGreaterThan(0);
          m.read_text.forEach((s) => {
            const text = typeof s === 'string' ? s : s.text;
            expect(typeof text).toBe('string');
            expect(text.length).toBeGreaterThan(0);
          });
        }
      }
    }
  });
});
