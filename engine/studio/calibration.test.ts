import { describe, it, expect } from 'vitest';
import { evaluateCalibration, isCalibrationReady, DEFAULT_THRESHOLDS } from './calibration';

const baseInput = {
  canvasW: 1080,
  canvasH: 1920,
};

describe('evaluateCalibration: face_in_frame', () => {
  it('얼굴 미검출 → fail', () => {
    const r = evaluateCalibration({ ...baseInput, face: null, requires: ['face_in_frame'] });
    expect(r[0].status).toBe('fail');
  });
  it('얼굴 중앙 → ok', () => {
    const r = evaluateCalibration({
      ...baseInput,
      face: { detected: true, centerX: 540, centerY: 960, sizePx: 200 },
      requires: ['face_in_frame'],
    });
    expect(r[0].status).toBe('ok');
  });
  it('얼굴 모서리 → fail', () => {
    const r = evaluateCalibration({
      ...baseInput,
      face: { detected: true, centerX: 50, centerY: 960, sizePx: 200 },
      requires: ['face_in_frame'],
    });
    expect(r[0].status).toBe('fail');
  });
});

describe('evaluateCalibration: body_in_frame', () => {
  it('어깨 미검출 → fail', () => {
    const r = evaluateCalibration({
      ...baseInput,
      body: { shouldersVisible: false, hipVisible: false, shoulderWidthPx: 0 },
      requires: ['body_in_frame'],
    });
    expect(r[0].status).toBe('fail');
  });
  it('어깨만 보이고 엉덩이 없음 → fail (허리까지 안내)', () => {
    const r = evaluateCalibration({
      ...baseInput,
      body: { shouldersVisible: true, hipVisible: false, shoulderWidthPx: 300 },
      requires: ['body_in_frame'],
    });
    expect(r[0].status).toBe('fail');
    expect(r[0].message).toMatch(/허리/);
  });
  it('전신 → ok', () => {
    const r = evaluateCalibration({
      ...baseInput,
      body: { shouldersVisible: true, hipVisible: true, shoulderWidthPx: 300 },
      requires: ['body_in_frame'],
    });
    expect(r[0].status).toBe('ok');
  });
});

describe('evaluateCalibration: distance_ok', () => {
  it('얼굴 너무 작음 → 가까이', () => {
    const r = evaluateCalibration({
      ...baseInput,
      face: { detected: true, centerX: 540, centerY: 960, sizePx: 80 },
      requires: ['distance_ok'],
    });
    expect(r[0].status).toBe('fail');
    expect(r[0].message).toMatch(/가까이/);
  });
  it('얼굴 너무 큼 → 떨어져', () => {
    const r = evaluateCalibration({
      ...baseInput,
      face: { detected: true, centerX: 540, centerY: 960, sizePx: 600 },
      requires: ['distance_ok'],
    });
    expect(r[0].status).toBe('fail');
    expect(r[0].message).toMatch(/떨어져/);
  });
  it('적정 → ok', () => {
    const r = evaluateCalibration({
      ...baseInput,
      face: { detected: true, centerX: 540, centerY: 960, sizePx: 280 },
      requires: ['distance_ok'],
    });
    expect(r[0].status).toBe('ok');
  });
});

describe('evaluateCalibration: lighting', () => {
  it('어두움 → fail', () => {
    const r = evaluateCalibration({ ...baseInput, avgBrightness: 0.08, requires: ['lighting_ok'] });
    expect(r[0].status).toBe('fail');
  });
  it('측정 전 → pending', () => {
    const r = evaluateCalibration({ ...baseInput, requires: ['lighting_ok'] });
    expect(r[0].status).toBe('pending');
  });
  it('밝음 → ok', () => {
    const r = evaluateCalibration({ ...baseInput, avgBrightness: 0.45, requires: ['lighting_ok'] });
    expect(r[0].status).toBe('ok');
  });
});

describe('evaluateCalibration: microphone', () => {
  it('음소거 수준 → fail', () => {
    const r = evaluateCalibration({ ...baseInput, micDbfs: -70, requires: ['microphone_live'] });
    expect(r[0].status).toBe('fail');
  });
  it('정상 → ok', () => {
    const r = evaluateCalibration({ ...baseInput, micDbfs: -30, requires: ['microphone_live'] });
    expect(r[0].status).toBe('ok');
  });
});

describe('isCalibrationReady', () => {
  it('빈 배열 → false', () => {
    expect(isCalibrationReady([])).toBe(false);
  });
  it('전부 ok → true', () => {
    expect(isCalibrationReady([
      { kind: 'face_in_frame', status: 'ok', message: '' },
      { kind: 'lighting_ok', status: 'ok', message: '' },
    ])).toBe(true);
  });
  it('하나라도 fail → false', () => {
    expect(isCalibrationReady([
      { kind: 'face_in_frame', status: 'ok', message: '' },
      { kind: 'lighting_ok', status: 'fail', message: '' },
    ])).toBe(false);
  });
  it('pending 포함 → false', () => {
    expect(isCalibrationReady([
      { kind: 'face_in_frame', status: 'ok', message: '' },
      { kind: 'lighting_ok', status: 'pending', message: '' },
    ])).toBe(false);
  });
});

describe('DEFAULT_THRESHOLDS', () => {
  it('합리적 범위', () => {
    expect(DEFAULT_THRESHOLDS.faceMinRatio).toBeLessThan(DEFAULT_THRESHOLDS.faceMaxRatio);
    expect(DEFAULT_THRESHOLDS.bodyMinShoulderRatio).toBeLessThan(DEFAULT_THRESHOLDS.bodyMaxShoulderRatio);
    expect(DEFAULT_THRESHOLDS.minBrightness).toBeGreaterThan(0);
    expect(DEFAULT_THRESHOLDS.minMicDbfs).toBeLessThan(0);
  });
});
