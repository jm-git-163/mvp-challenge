import { describe, it, expect } from 'vitest';
import { parseTemplate } from '../../engine/templates/schema';
import { squatMasterChain } from './squat-master-chain';

describe('squat-master-chain template', () => {
  it('parses against zod schema', () => {
    const t = parseTemplate(squatMasterChain);
    expect(t.id).toBe('squat-master-chain');
    expect(t.missionSequence).toBeDefined();
    expect(t.missionSequence!.steps).toHaveLength(3);
    expect(t.missionSequence!.steps[0].spec.kind).toBe('squat_count');
    expect(t.missionSequence!.steps[2].spec.kind).toBe('gesture');
  });
});
