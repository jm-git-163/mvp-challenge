import { describe, it, expect } from 'vitest';
import { extractFaceAnchor, selectPrimaryFace, anchorPointByLandmark, FaceAnchorCache, FACE_LM, type Landmark } from './faceAnchor';

function syntheticFace(overrides: Partial<Record<number, { x: number; y: number }>> = {}): Landmark[] {
  // 정면 얼굴 478점 합성. 기본 정규화 좌표에서 중앙에 위치.
  const base: Landmark[] = [];
  for (let i = 0; i < 478; i++) base.push({ x: 0.5, y: 0.5, z: 0 });
  // 주요점 셋업
  base[FACE_LM.NOSE_TIP] = { x: 0.5, y: 0.52 };
  base[FACE_LM.FOREHEAD] = { x: 0.5, y: 0.35 };
  base[FACE_LM.CHIN]     = { x: 0.5, y: 0.75 };
  base[FACE_LM.LEFT_EYE_OUTER]  = { x: 0.38, y: 0.45 };
  base[FACE_LM.LEFT_EYE_INNER]  = { x: 0.46, y: 0.45 };
  base[FACE_LM.RIGHT_EYE_OUTER] = { x: 0.62, y: 0.45 };
  base[FACE_LM.RIGHT_EYE_INNER] = { x: 0.54, y: 0.45 };
  base[FACE_LM.LEFT_CHEEK]  = { x: 0.32, y: 0.55 };
  base[FACE_LM.RIGHT_CHEEK] = { x: 0.68, y: 0.55 };
  base[FACE_LM.MOUTH_UPPER] = { x: 0.5, y: 0.64 };
  base[FACE_LM.MOUTH_LOWER] = { x: 0.5, y: 0.66 };
  for (const [k, v] of Object.entries(overrides)) base[Number(k)] = { x: v!.x, y: v!.y };
  return base;
}

describe('extractFaceAnchor', () => {
  it('정면 얼굴 → roll/yaw/pitch ≈ 0', () => {
    const a = extractFaceAnchor(syntheticFace());
    expect(a).not.toBeNull();
    expect(Math.abs(a!.roll)).toBeLessThan(0.05);
    expect(Math.abs(a!.yaw)).toBeLessThan(0.2);
    expect(Math.abs(a!.pitch)).toBeLessThan(0.3);
  });

  it('눈이 기울어지면 roll 양수', () => {
    const f = syntheticFace({
      [FACE_LM.LEFT_EYE_OUTER]: { x: 0.38, y: 0.40 },
      [FACE_LM.LEFT_EYE_INNER]: { x: 0.46, y: 0.42 },
      [FACE_LM.RIGHT_EYE_OUTER]: { x: 0.62, y: 0.50 },
      [FACE_LM.RIGHT_EYE_INNER]: { x: 0.54, y: 0.48 },
    });
    const a = extractFaceAnchor(f);
    expect(a!.roll).toBeGreaterThan(0.1);
  });

  it('코가 얼굴 중심 오른쪽으로 이동하면 yaw 양수', () => {
    const f = syntheticFace({ [FACE_LM.NOSE_TIP]: { x: 0.58, y: 0.52 } });
    const a = extractFaceAnchor(f);
    expect(a!.yaw).toBeGreaterThan(0);
  });

  it('랜드마크 부족하면 null', () => {
    expect(extractFaceAnchor(null)).toBeNull();
    expect(extractFaceAnchor([])).toBeNull();
    expect(extractFaceAnchor(new Array(100).fill({ x: 0, y: 0 }))).toBeNull();
  });

  it('faceSize가 forehead-chin 거리와 일치', () => {
    const a = extractFaceAnchor(syntheticFace());
    expect(a!.faceSize).toBeCloseTo(0.4, 2); // 0.35 → 0.75
  });
});

describe('selectPrimaryFace', () => {
  it('가장 큰 얼굴 선택', () => {
    const small = syntheticFace({ [FACE_LM.FOREHEAD]: { x: 0.5, y: 0.4 }, [FACE_LM.CHIN]: { x: 0.5, y: 0.5 } });
    const big = syntheticFace();
    const picked = selectPrimaryFace([small, big]);
    expect(picked).toBe(big);
  });
  it('빈 배열 null', () => {
    expect(selectPrimaryFace([])).toBeNull();
  });
});

describe('anchorPointByLandmark', () => {
  it('정규화 좌표를 캔버스 픽셀로', () => {
    const a = extractFaceAnchor(syntheticFace())!;
    const p = anchorPointByLandmark(a, 'nose', 1080, 1920);
    expect(p.x).toBeCloseTo(0.5 * 1080, 2);
    expect(p.y).toBeCloseTo(0.52 * 1920, 2);
  });
});

describe('FaceAnchorCache', () => {
  it('최초 update 전에는 anchor null', () => {
    const c = new FaceAnchorCache();
    expect(c.get(0).anchor).toBeNull();
  });
  it('감지 후 persistenceMs 안에선 유지, confidence 감소', () => {
    const c = new FaceAnchorCache(400);
    const a = extractFaceAnchor(syntheticFace())!;
    c.update(0, a);
    expect(c.get(0).confidence).toBe(1);
    expect(c.get(200).confidence).toBeCloseTo(0.5, 2);
    expect(c.get(500).anchor).toBeNull();
  });
});
