/**
 * data/templates/coherence.test.ts
 *
 * FIX-Z25 (2026-04-22) — 얼굴존 자막 겹침 회귀 방지.
 *
 * 1080×1920 캔버스 기준, 얼굴존(y 540~1200 = 28%~63%) 에 텍스트성
 * 레이어가 위치하지 않는지 검증. 인트로/아웃트로 등 activeRange 전체가
 * 카메라 비활성 구간이면 예외로 허용.
 */
import { describe, it, expect } from 'vitest';
import { neonArena } from './neon-arena';
import { newsAnchor } from './news-anchor';
import { emojiExplosion } from './emoji-explosion';
import type { BaseLayer, Template } from '../../engine/templates/schema';

const FACE_ZONE_TOP = 0.28; // 28%
const FACE_ZONE_BOT = 0.63; // 63%

/** 템플릿 컨벤션에 맞춰 position 을 y 비율(0~1)로 변환. */
function resolveYRatio(pos: any, type: string): number | null {
  if (pos == null) {
    // 타입별 기본값 (렌더러의 resolvePosition 기본과 동일해야 함)
    if (type === 'kinetic_text' || type === 'counter_hud') return 0.5; // center 기본
    if (type === 'mission_prompt') return 0.12;                        // top 기본
    return null;
  }
  if (typeof pos === 'object' && Number.isFinite(pos.y)) {
    return (pos.y as number) / 1920;
  }
  if (typeof pos === 'string') {
    switch (pos) {
      case 'top':
      case 'top-center':
      case 'top-left':
      case 'top-right':      return 0.14;
      case 'bottom':
      case 'bottom-center':
      case 'bottom-left':
      case 'bottom-right':   return 0.86;
      case 'center':         return 0.5;
      default:               return null;
    }
  }
  return null;
}

const TEXT_TYPES = new Set(['kinetic_text', 'news_ticker', 'karaoke_caption', 'mission_prompt', 'counter_hud']);

function collectOffenders(t: Template): Array<{ id: string; type: string; y: number }> {
  const out: Array<{ id: string; type: string; y: number }> = [];
  for (const l of t.layers as BaseLayer[]) {
    if (!l.enabled) continue;
    if (!TEXT_TYPES.has(l.type)) continue;
    // 인트로/아웃트로 구간은 제외 — 주로 카메라가 더 작거나 전환 중
    const ar = (l as any).activeRange;
    if (ar) {
      // intro: 0~3s 내 끝남 / outro: duration-3 이후 시작 → 제외
      if (ar.endSec <= 3) continue;
      if (ar.startSec >= t.duration - 3) continue;
    }
    const y = resolveYRatio((l.props as any)?.position, l.type);
    if (y == null) continue;
    if (y >= FACE_ZONE_TOP && y <= FACE_ZONE_BOT) {
      out.push({ id: l.id, type: l.type, y });
    }
  }
  return out;
}

describe('template coherence: 얼굴존 텍스트 회피 (FIX-Z25)', () => {
  const all: Array<[string, Template]> = [
    ['neon-arena', neonArena],
    ['news-anchor', newsAnchor],
    ['emoji-explosion', emojiExplosion],
  ];

  for (const [name, t] of all) {
    it(`${name}: 모든 텍스트 레이어가 얼굴존(28~63%) 밖에 위치`, () => {
      const offenders = collectOffenders(t);
      expect(
        offenders,
        `${name} 얼굴존 침범 레이어: ${JSON.stringify(offenders)}`,
      ).toHaveLength(0);
    });

    it(`${name}: kinetic_text 메인 구간 레이어는 position 이 명시됨`, () => {
      const missing = (t.layers as BaseLayer[]).filter((l) => {
        if (!l.enabled) return false;
        if (l.type !== 'kinetic_text') return false;
        const ar = (l as any).activeRange;
        if (!ar) return false;
        if (ar.endSec <= 3) return false;
        if (ar.startSec >= t.duration - 3) return false;
        return (l.props as any)?.position == null;
      });
      expect(missing.map((m) => m.id), `${name} position 누락`).toEqual([]);
    });

    it(`${name}: mission_prompt 은 top 또는 bottom`, () => {
      const bad = (t.layers as BaseLayer[]).filter((l) => {
        if (l.type !== 'mission_prompt') return false;
        if (!l.enabled) return false;
        const p = (l.props as any)?.position;
        if (p == null) return false; // default top OK
        if (typeof p === 'string') return !['top', 'bottom'].includes(p);
        if (typeof p === 'object' && Number.isFinite(p.y)) {
          const r = p.y / 1920;
          return r >= FACE_ZONE_TOP && r <= FACE_ZONE_BOT;
        }
        return false;
      });
      expect(bad.map((b) => b.id), `${name} mission_prompt 얼굴존`).toEqual([]);
    });

    it(`${name}: news_ticker 상·하단 배치 (y 비율 < 28% 또는 > 63%)`, () => {
      const bad = (t.layers as BaseLayer[]).filter((l) => {
        if (l.type !== 'news_ticker') return false;
        if (!l.enabled) return false;
        const p = (l.props as any)?.position;
        const y = resolveYRatio(p, l.type);
        if (y == null) return false;
        return y >= FACE_ZONE_TOP && y <= FACE_ZONE_BOT;
      });
      expect(bad.map((b) => b.id), `${name} news_ticker 얼굴존`).toEqual([]);
    });

    it(`${name}: 큰 fontSize(≥140) 는 center 금지`, () => {
      const bad = (t.layers as BaseLayer[]).filter((l) => {
        if (l.type !== 'kinetic_text') return false;
        if (!l.enabled) return false;
        const props = l.props as any;
        const fs = props?.fontSize ?? 0;
        if (fs < 140) return false;
        return props?.position === 'center' || props?.position == null;
      });
      expect(bad.map((b) => b.id), `${name} 큰 텍스트 center`).toEqual([]);
    });
  }
});
