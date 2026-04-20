import { describe, it, expect } from 'vitest';
import { probeDevice, DEFAULT_PROBE } from './deviceProbe';

const portraitDims = { innerWidth: () => 390, innerHeight: () => 844 };

describe('probeDevice', () => {
  it('충분한 스토리지+배터리+세로 → blockers/warnings 없음', async () => {
    const r = await probeDevice({}, {
      ...portraitDims,
      estimateStorage: async () => ({ quota: 10 * 1024 ** 3, usage: 1 * 1024 ** 3 }),
      getBattery: async () => ({ level: 0.8, charging: false }),
    });
    expect(r.blockers).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.freeBytes).toBe(9 * 1024 ** 3);
    expect(r.batteryPct).toBe(80);
  });

  it('가로 모드 → blocker', async () => {
    const r = await probeDevice({}, {
      innerWidth: () => 844,
      innerHeight: () => 390,
    });
    expect(r.landscape).toBe(true);
    expect(r.blockers.some((b) => b.includes('세로'))).toBe(true);
  });

  it('화면 좁음 → blocker', async () => {
    const r = await probeDevice({}, {
      innerWidth: () => 300,
      innerHeight: () => 800,
    });
    expect(r.tooSmall).toBe(true);
    expect(r.blockers.some((b) => b.includes('작습니다'))).toBe(true);
  });

  it('배터리 4% + 미충전 → critical warning', async () => {
    const r = await probeDevice({}, {
      ...portraitDims,
      getBattery: async () => ({ level: 0.04, charging: false }),
    });
    expect(r.batteryCritical).toBe(true);
    expect(r.warnings.some((w) => w.includes('배터리'))).toBe(true);
  });

  it('배터리 4% 이지만 충전 중 → 경고 없음', async () => {
    const r = await probeDevice({}, {
      ...portraitDims,
      getBattery: async () => ({ level: 0.04, charging: true }),
    });
    expect(r.batteryCritical).toBe(false);
  });

  it('스토리지 부족 → warning', async () => {
    const r = await probeDevice({ expectedRecordingBytes: 60 * 1024 * 1024 }, {
      ...portraitDims,
      estimateStorage: async () => ({ quota: 100 * 1024 * 1024, usage: 50 * 1024 * 1024 }),
    });
    expect(r.storageLow).toBe(true);
    expect(r.warnings.some((w) => w.includes('저장 공간'))).toBe(true);
  });

  it('Battery/Storage API 미지원 → null 값, 경고 없음', async () => {
    const r = await probeDevice({}, {
      ...portraitDims,
      getBattery: async () => null,
      estimateStorage: async () => null,
    });
    expect(r.batteryPct).toBeNull();
    expect(r.freeBytes).toBeNull();
    expect(r.blockers).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('API 예외 발생 → 삼켜지고 null', async () => {
    const r = await probeDevice({}, {
      ...portraitDims,
      getBattery: async () => { throw new Error('denied'); },
      estimateStorage: async () => { throw new Error('denied'); },
    });
    expect(r.batteryPct).toBeNull();
    expect(r.freeBytes).toBeNull();
  });

  it('DEFAULT_PROBE 값', () => {
    expect(DEFAULT_PROBE.expectedRecordingBytes).toBe(60 * 1024 * 1024);
    expect(DEFAULT_PROBE.minInnerWidth).toBe(320);
  });
});
