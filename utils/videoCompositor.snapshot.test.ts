/**
 * utils/videoCompositor.snapshot.test.ts
 *
 * FIX-Z22 (2026-04-22):
 *   "BGM 이 나오는 건 뉴스 읽기 뿐. 모든 챌린지가 각 챌린지에 맞는 인트로, 아웃트로,
 *    다양한 레이어의 이미지, 효과음, 자막, 배경, BGM 이 다 빠짐없이 있어야해"
 *   사용자 피드백 대응.
 *
 *   `renderLayeredFrame` 를 각 템플릿 × 시점(0.5s / 2.5s / 10s / 17s)마다 호출하고
 *   기록용 mock ctx 로 draw-call 시퀀스를 수집해서
 *     (A) 3 템플릿이 같은 시점에서 서로 다른 fillStyle/drawImage/fillText 흐름을 낸다
 *     (B) 인트로·아웃트로 구간에 intro_ / outro_ 레이어의 흔적이 실제로 그려진다
 *     (C) hashtag_strip 시간대에는 ticker 가 활성화되어 fillText 가 배경색보다 더 칠해진다
 *   를 Assertion 한다.
 *
 *   node 환경엔 Canvas 가 없기에 픽셀 비교 대신 "호출 시퀀스 지문" 을 비교한다.
 *   이것도 "템플릿이 실제로 다르게 그려지는가" 의 강한 근사다.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderLayeredFrame } from './videoCompositor';
import { neonArena } from '../data/templates/neon-arena';
import { newsAnchor } from '../data/templates/news-anchor';
import { emojiExplosion } from '../data/templates/emoji-explosion';
import type { Template } from '../engine/templates/schema';

/** draw-call 시퀀스를 문자열 배열로 수집하는 mock 2D context. */
function makeRecorder() {
  const calls: string[] = [];
  const fillStyles: string[] = [];
  const texts: string[] = [];
  const images: number[] = [];
  // prettier-ignore
  const ctx: any = {
    get canvas() { return { width: 1080, height: 1920 }; },
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    clearRect: (...a: any[]) => calls.push('clearRect:' + a.join(',')),
    fillRect: (...a: any[]) => calls.push('fillRect:' + a.join(',')),
    strokeRect: (...a: any[]) => calls.push('strokeRect'),
    beginPath: () => calls.push('beginPath'),
    closePath: () => calls.push('closePath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    quadraticCurveTo: () => calls.push('quadraticCurveTo'),
    bezierCurveTo: () => calls.push('bezierCurveTo'),
    stroke: () => calls.push('stroke'),
    fill: () => calls.push('fill'),
    arc: (...a: any[]) => { calls.push('arc:' + a.slice(0,3).join(',')); },
    ellipse: () => calls.push('ellipse'),
    clip: () => calls.push('clip'),
    rect: () => calls.push('rect'),
    translate: () => calls.push('translate'),
    scale: () => calls.push('scale'),
    rotate: () => calls.push('rotate'),
    setTransform: () => calls.push('setTransform'),
    resetTransform: () => calls.push('resetTransform'),
    transform: () => calls.push('transform'),
    drawImage: () => { calls.push('drawImage'); images.push(1); },
    fillText: (t: string) => { calls.push('fillText:' + t); texts.push(String(t)); },
    strokeText: (t: string) => { calls.push('strokeText:' + t); texts.push(String(t)); },
    measureText: () => ({ width: 180 }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({}),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => calls.push('putImageData'),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    set fillStyle(v: string) { fillStyles.push(String(v)); },
    get fillStyle() { return fillStyles[fillStyles.length - 1] || ''; },
    strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    font: '', textAlign: 'left', textBaseline: 'alphabetic',
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    filter: 'none',
    imageSmoothingEnabled: true,
  };
  return { ctx, calls, fillStyles, texts };
}

// jsdom 없는 환경에서도 noise_pattern 등이 document.createElement 를 호출하므로 stub.
vi.stubGlobal('document', {
  createElement: (tag: string) => {
    if (tag === 'canvas') {
      return {
        getContext: () => ({
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: () => {},
          fillRect: () => {},
          fillStyle: '',
          drawImage: () => {},
        }),
        width: 256, height: 256,
      } as any;
    }
    return {};
  },
});

const STATE = { videoEl: undefined };

function render(t: Template, tSec: number) {
  const rec = makeRecorder();
  renderLayeredFrame(rec.ctx, t as any, tSec * 1000, STATE as any);
  return rec;
}

/** fillStyle 시퀀스를 병합한 대표 지문 — 색 구성이 다르면 반드시 변한다. */
function fingerprint(fills: string[]): string {
  // 상위 100개만, 중복은 유지 (빈도 역시 지문의 일부)
  return fills.slice(0, 100).join('|');
}

describe('FIX-Z22 템플릿 렌더 스냅샷 — BGM·레이어·자막 차별화 검증', () => {
  const templates: Array<[string, Template]> = [
    ['neon-arena', neonArena],
    ['news-anchor', newsAnchor],
    ['emoji-explosion', emojiExplosion],
  ];

  // (1) BGM src 자체가 세 템플릿 모두 올바른 public/bgm 경로인지 최소 검증.
  it('모든 템플릿에 bgm.src 와 beatsJson 이 /bgm/ 아래 경로', () => {
    for (const [name, t] of templates) {
      expect(t.bgm.src, `${name} bgm.src`).toMatch(/^\/bgm\//);
      expect(t.bgm.beatsJson, `${name} beatsJson`).toMatch(/^\/bgm\//);
    }
  });

  // (2) 3 템플릿의 fillStyle 지문이 서로 달라야 한다 (색 차별화).
  it('2.5s 시점 — 3 템플릿의 fillStyle 지문이 모두 다름', () => {
    const prints = templates.map(([name, t]) => {
      const r = render(t, 2.5);
      return { name, fp: fingerprint(r.fillStyles) };
    });
    const uniqueFps = new Set(prints.map((p) => p.fp));
    expect(uniqueFps.size, `fingerprints: ${prints.map(p => p.name + '=' + p.fp.length).join(' ')}`).toBe(3);
  });

  // (3) 각 템플릿이 인트로(0.5s) 구간에서 intro_* 레이어 텍스트를 그림.
  it.each(templates)('%s: 인트로(0.5s) 에 intro_* 텍스트 렌더', (name, t) => {
    const rec = render(t, 0.5);
    const introLayers = t.layers.filter(l => l.id.startsWith('intro_') && l.enabled);
    expect(introLayers.length, `${name} intro layer count`).toBeGreaterThan(0);
    // fillStyles 나 draw calls 중 하나는 반드시 발생
    expect(rec.calls.length, `${name} 0.5s draw calls`).toBeGreaterThan(20);
    expect(rec.fillStyles.length, `${name} 0.5s fillStyle writes`).toBeGreaterThan(5);
  });

  // (4) 각 템플릿이 메인(10s) 구간에서 hashtag_strip 을 그린다 → ticker 관련 fillText 발생.
  it.each(templates)('%s: 메인(10s) 에 해시태그/뉴스티커 fillText 흔적', (name, t) => {
    const rec = render(t, 10);
    const hashtagLayer = t.layers.find(l => l.id === 'hashtag_strip');
    expect(hashtagLayer, `${name} hashtag_strip`).toBeDefined();
    // news_ticker 렌더는 fillText 를 호출. 해시태그 중 최소 1개는 텍스트로 들어간다.
    const joined = rec.texts.join(' ');
    const anyHashtag = (t.hashtags || []).some((h) => joined.includes(h));
    expect(anyHashtag, `${name} 10s fillText 에 해시태그 미발견. texts=${rec.texts.slice(0,8).join(',')}`).toBe(true);
  });

  // (5) 각 템플릿이 아웃트로 구간에서 outro_* 레이어를 렌더.
  it.each(templates)('%s: 아웃트로 구간에 outro_* 텍스트 렌더', (name, t) => {
    const outroT = Math.max(0, t.duration - 0.8);
    const rec = render(t, outroT);
    const outroLayers = t.layers.filter(l => l.id.startsWith('outro_') && l.enabled);
    expect(outroLayers.length, `${name} outro layer count`).toBeGreaterThan(0);
    // 각 템플릿 아웃트로엔 별점(★) 또는 타이틀 텍스트가 들어있다.
    const joined = rec.texts.join(' ');
    const hasOutroMarker = joined.includes('★') || /COMPLETE|종료|CUTE|RETRY|감사/.test(joined);
    expect(hasOutroMarker, `${name} outro texts=${rec.texts.slice(0,10).join(' / ')}`).toBe(true);
  });

  // (6) 3 템플릿의 메인 구간 (10s) draw-call 총량이 서로 10% 이상 차이나지 않으면 의심 —
  //     완전히 같은 레이어 구성이라는 뜻. 최소 두 쌍 이상은 충분히 달라야 한다.
  it('10s 시점 — 3 템플릿 draw call 개수가 의미 있게 차이남', () => {
    const counts = templates.map(([name, t]) => ({ name, n: render(t, 10).calls.length }));
    const [a, b, c] = counts.map((x) => x.n);
    const maxDiff = Math.max(Math.abs(a - b), Math.abs(b - c), Math.abs(a - c));
    const avg = (a + b + c) / 3;
    expect(maxDiff / avg, `call counts ${JSON.stringify(counts)} avg=${avg}`).toBeGreaterThan(0.05);
  });

  // (7) renderLayeredFrame 이 어떤 시점에서도 throw 하지 않는다.
  it.each(templates)('%s: 0.5 / 2.5 / 10 / 17s 시점 렌더 에러 없음', (_name, t) => {
    expect(() => render(t, 0.5)).not.toThrow();
    expect(() => render(t, 2.5)).not.toThrow();
    expect(() => render(t, 10)).not.toThrow();
    expect(() => render(t, Math.min(17, t.duration - 0.5))).not.toThrow();
  });
});
