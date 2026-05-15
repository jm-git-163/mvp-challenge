import { describe, it, expect } from 'vitest';
import { parseTemplate, zTemplate, zCameraFraming, zReactiveBinding, zMissionEvent, zLayerType } from './schema';

function baseTemplate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'neon-arena',
    title: '네온 아레나',
    description: '',
    thumbnail: '/templates/neon-arena/thumb.png',
    duration: 20,
    aspectRatio: '9:16',
    canvasSize: { w: 1080, h: 1920 },
    mood: 'neon_cyberpunk',
    bgm: { src: '/bgm/synth.mp3', volume: 0.7, loop: true, duckingDb: -8 },
    cameraFraming: { kind: 'hexagon', centerX: 540, centerY: 960, size: 380 },
    layers: [
      { id: 'bg1', type: 'gradient_mesh', zIndex: 1, opacity: 1, enabled: true },
      { id: 'cam', type: 'camera_feed', zIndex: 20, opacity: 1, enabled: true },
      {
        id: 'flash', type: 'beat_flash', zIndex: 50, opacity: 1, enabled: true,
        reactive: {
          onBeat: { every: 1, property: 'opacity', amount: 0.3, easing: 'standard', durationMs: 150 },
        },
      },
    ],
    missionTimeline: [
      { id: 'm1', startSec: 2, endSec: 20, mission: { kind: 'squat_count', target: 10 }, scoreWeight: 1.0 },
    ],
    postProcess: [{ kind: 'bloom', intensity: 1.2 }],
    successEffects: [],
    failEffects: [],
    ...overrides,
  };
}

describe('zCameraFraming', () => {
  it('hexagon 통과', () => {
    expect(zCameraFraming.safeParse({ kind: 'hexagon', centerX: 540, centerY: 960, size: 380 }).success).toBe(true);
  });
  it('heart size>0 강제', () => {
    expect(zCameraFraming.safeParse({ kind: 'heart', centerX: 0, centerY: 0, size: -1 }).success).toBe(false);
  });
  it('모르는 kind 거부', () => {
    expect(zCameraFraming.safeParse({ kind: 'oval', x: 0 }).success).toBe(false);
  });
});

describe('zLayerType', () => {
  it('COMPOSITION §3 타입들 허용', () => {
    const samples = ['gradient_mesh', 'camera_feed', 'face_sticker', 'karaoke_caption', 'particle_burst', 'lens_flare', 'confetti'];
    for (const s of samples) expect(zLayerType.safeParse(s).success).toBe(true);
  });
  it('모르는 타입 거부', () => {
    expect(zLayerType.safeParse('xyz').success).toBe(false);
  });
});

describe('zReactiveBinding', () => {
  it('onBeat.every=1|2|4|8|16 만 허용', () => {
    expect(zReactiveBinding.safeParse({ onBeat: { every: 4, property: 'scale', amount: 0.1, easing: 'bounce', durationMs: 200 } }).success).toBe(true);
    expect(zReactiveBinding.safeParse({ onBeat: { every: 3, property: 'scale', amount: 0.1, easing: 'bounce', durationMs: 200 } }).success).toBe(false);
  });
  it('track landmark 지정', () => {
    const r = zReactiveBinding.safeParse({ track: { landmark: 'nose' } });
    expect(r.success).toBe(true);
  });
});

describe('zMissionEvent', () => {
  it('endSec > startSec 강제', () => {
    const r = zMissionEvent.safeParse({ id: 'm', startSec: 5, endSec: 3, mission: { kind: 'smile', intensity: 0.6, durationMs: 1000 }, scoreWeight: 1 });
    expect(r.success).toBe(false);
  });
  it('scoreWeight 0..1 강제', () => {
    const r = zMissionEvent.safeParse({ id: 'm', startSec: 0, endSec: 1, mission: { kind: 'smile', intensity: 0.6, durationMs: 1000 }, scoreWeight: 1.5 });
    expect(r.success).toBe(false);
  });
});

describe('zTemplate 통합', () => {
  it('정상 템플릿 통과', () => {
    expect(() => parseTemplate(baseTemplate())).not.toThrow();
  });

  it('scoreWeight 합 != 1 거부', () => {
    const bad = baseTemplate({
      missionTimeline: [
        { id: 'a', startSec: 0, endSec: 5, mission: { kind: 'smile', intensity: 0.6, durationMs: 1000 }, scoreWeight: 0.3 },
        { id: 'b', startSec: 5, endSec: 10, mission: { kind: 'loud_voice', minDb: -20, durationMs: 1000 }, scoreWeight: 0.3 },
      ],
      duration: 10,
    });
    expect(() => parseTemplate(bad)).toThrow(/scoreWeight 합/);
  });

  it('layer id 중복 거부', () => {
    const bad = baseTemplate({
      layers: [
        { id: 'dup', type: 'gradient_mesh', zIndex: 1, opacity: 1, enabled: true },
        { id: 'dup', type: 'camera_feed', zIndex: 2, opacity: 1, enabled: true },
      ],
    });
    expect(() => parseTemplate(bad)).toThrow(/중복된 layer id/);
  });

  it('mission endSec > duration 거부', () => {
    const bad = baseTemplate({
      duration: 5,
      missionTimeline: [
        { id: 'm1', startSec: 0, endSec: 10, mission: { kind: 'squat_count', target: 3 }, scoreWeight: 1 },
      ],
    });
    expect(() => parseTemplate(bad)).toThrow(/endSec/);
  });

  it('canvasSize 다른 값 거부 (1080x1920 고정)', () => {
    const bad = baseTemplate({ canvasSize: { w: 720, h: 1280 } });
    expect(zTemplate.safeParse(bad).success).toBe(false);
  });

  it('id는 소문자/숫자/하이픈만', () => {
    const bad = baseTemplate({ id: 'Neon Arena!' });
    expect(zTemplate.safeParse(bad).success).toBe(false);
  });

  it('빈 layers 거부', () => {
    const bad = baseTemplate({ layers: [] });
    expect(zTemplate.safeParse(bad).success).toBe(false);
  });

  // CAMERA-SWAP (2026-04-23)
  it('cameraPlan 정상 세그먼트 통과', () => {
    const good = baseTemplate({
      cameraPlan: {
        segments: [
          { atMs: 0, facing: 'front', label: '인트로 반응' },
          { atMs: 5000, facing: 'back', label: '음식 클로즈업' },
          { atMs: 12000, facing: 'front', label: '먹방 리액션' },
        ],
      },
    });
    expect(() => parseTemplate(good)).not.toThrow();
  });

  it('cameraPlan 없어도 통과 (optional)', () => {
    expect(() => parseTemplate(baseTemplate())).not.toThrow();
  });

  it('cameraPlan atMs 내림차순 거부', () => {
    const bad = baseTemplate({
      cameraPlan: {
        segments: [
          { atMs: 5000, facing: 'front', label: 'a' },
          { atMs: 2000, facing: 'back',  label: 'b' },
        ],
      },
    });
    expect(() => parseTemplate(bad)).toThrow(/오름차순/);
  });

  it('cameraPlan segment atMs > duration 거부', () => {
    const bad = baseTemplate({
      duration: 10,
      cameraPlan: {
        segments: [
          { atMs: 0,     facing: 'front', label: '시작' },
          { atMs: 99000, facing: 'back',  label: '너무 늦음' },
        ],
      },
    });
    expect(() => parseTemplate(bad)).toThrow(/atMs/);
  });

  it('cameraPlan label 빈 문자열 거부', () => {
    const bad = baseTemplate({
      cameraPlan: { segments: [{ atMs: 0, facing: 'front', label: '' }] },
    });
    expect(() => parseTemplate(bad)).toThrow();
  });

  it('cameraPlan facing 값 검증', () => {
    const bad = baseTemplate({
      cameraPlan: { segments: [{ atMs: 0, facing: 'side' as any, label: 'x' }] },
    });
    expect(() => parseTemplate(bad)).toThrow();
  });

  it('모든 미션 kind 허용 (6종)', () => {
    const missions = [
      { kind: 'squat_count', target: 5 },
      { kind: 'smile', intensity: 0.6, durationMs: 1000 },
      { kind: 'gesture', gesture: 'peace' },
      { kind: 'pose_hold', pose: 'hands_up', holdMs: 2000 },
      { kind: 'loud_voice', minDb: -20, durationMs: 1500 },
      { kind: 'read_script', script: '안녕하세요' },
    ];
    for (const m of missions) {
      const r = zMissionEvent.safeParse({ id: 'x', startSec: 0, endSec: 2, mission: m, scoreWeight: 1 });
      expect(r.success).toBe(true);
    }
  });
});
