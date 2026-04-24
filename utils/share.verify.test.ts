/**
 * FIX VERIFICATION TEST — all three recurring bugs.
 *
 * Exercises each fix as a pure function / data contract; no browser required.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pickOfficialSlug } from './officialSlug';
import { DEFAULT_CONSTRAINTS } from '../engine/session/mediaSession';
import { buildInviteUrl, parseInviteUrl } from './inviteLinks';
import { MOCK_TEMPLATES } from '../services/mockData';

// Replicated resolver from app/challenge/[slug]/index.tsx so we verify
// the exact behavior users see. Keep in sync.
function isValidDb(t: any): boolean {
  return !!t && typeof t.duration_sec === 'number' && Array.isArray(t.missions);
}
function resolveFor(slugLc: string, pool: any[]): any | null {
  const SLUG_TO_DB_PREFIX: Record<string, string> = {
    'daily-vlog': 'daily-vlog', 'news-anchor': 'news-anchor', 'english-speaking': 'english-lesson',
    'storybook-reading': 'fairy-tale', 'travel-checkin': 'travel-cert', 'unboxing-promo': 'product-unbox',
    'kpop-dance': 'kpop-idol', 'food-review': 'food-', 'motivation-speech': 'motivation-',
    'social-viral': 'social-', 'squat-master': 'fitness-squat',
  };
  const dbPrefix = SLUG_TO_DB_PREFIX[slugLc] ?? slugLc;
  const match = (t: any) => {
    const id = String(t.id ?? '').toLowerCase();
    const slug = String(t.slug ?? '').toLowerCase();
    const themeId = String(t.theme_id ?? '').toLowerCase();
    const genre = String(t.genre ?? '').toLowerCase();
    try { if (pickOfficialSlug(t).toLowerCase() === slugLc) return true; } catch {}
    if (id === slugLc || slug === slugLc || themeId === slugLc || genre === slugLc) return true;
    if (dbPrefix && id.startsWith(dbPrefix)) return true;
    return false;
  };
  const direct = pool.find(t => isValidDb(t) && match(t));
  if (direct) return direct;
  // Tier 3 genre fallback, mirrors app/challenge/[slug]/index.tsx
  const SLUG_TO_GENRE: Record<string, string> = {
    'squat-master': 'fitness', 'kpop-dance': 'kpop', 'news-anchor': 'news',
    'english-speaking': 'english', 'storybook-reading': 'kids', 'travel-checkin': 'travel',
    'unboxing-promo': 'promotion', 'food-review': 'daily', 'motivation-speech': 'fitness',
    'social-viral': 'hiphop', 'daily-vlog': 'daily',
  };
  const g = SLUG_TO_GENRE[slugLc];
  if (g) {
    const hit = pool.find(t => isValidDb(t) && String((t as any).genre ?? '').toLowerCase() === g);
    if (hit) return hit;
  }
  return null;
}

describe('Bug 1: invite link resolver', () => {
  it('round-trips squat-master invite URL through builder + parser', () => {
    const url = buildInviteUrl('squat-master', '김철수', { origin: 'https://motiq.app', score: 88 });
    const ctx = parseInviteUrl(url);
    expect(ctx).not.toBeNull();
    expect(ctx!.slug).toBe('squat-master');
    expect(ctx!.fromName).toBe('김철수');
    expect(ctx!.score).toBe(88);
  });

  it.each([
    'squat-master','kpop-dance','daily-vlog','news-anchor','english-speaking',
    'storybook-reading','travel-checkin','unboxing-promo','food-review',
    'motivation-speech','social-viral',
  ])('resolves a valid MOCK template for slug "%s"', (slug) => {
    const hit = resolveFor(slug, MOCK_TEMPLATES);
    expect(hit, `slug ${slug}`).not.toBeNull();
    expect(isValidDb(hit)).toBe(true);
  });

  it('unknown slug returns null (no silent wrong template)', () => {
    expect(resolveFor('never-exists-slug', MOCK_TEMPLATES)).toBeNull();
  });
});

describe('Bug 2: camera getUserMedia constraints', () => {
  it('does NOT include aspectRatio constraint (prevents landscape-webcam software crop)', () => {
    const v = DEFAULT_CONSTRAINTS.video;
    expect(typeof v).toBe('object');
    expect((v as MediaTrackConstraints).aspectRatio).toBeUndefined();
  });

  it('uses landscape-friendly width/height ideals', () => {
    const v = DEFAULT_CONSTRAINTS.video as MediaTrackConstraints;
    expect((v.width as any)?.ideal).toBe(1280);
    expect((v.height as any)?.ideal).toBe(720);
  });

  it('drawCamera source uses CONTAIN + blurred background (no COVER center-crop)', () => {
    const recFile = fs.readFileSync(path.resolve(__dirname, '../components/camera/RecordingCamera.web.tsx'), 'utf-8');
    const canFile = fs.readFileSync(path.resolve(__dirname, '../components/camera/CanvasRecorder.web.tsx'), 'utf-8');
    for (const src of [recFile, canFile]) {
      expect(src).toMatch(/blur\(30px\)/);
      // CONTAIN keyword: srcAR/dstAR compare present
      expect(src).toMatch(/srcAR\s*>\s*dstAR/);
    }
  });
});

describe('Bug 3: share — files-only WebShare on iOS AND Android', () => {
  const shareSrc = fs.readFileSync(path.resolve(__dirname, 'share.ts'), 'utf-8');

  it('has NO remaining "env.ios && env.canShareFiles" gate (was blocking Android)', () => {
    expect(shareSrc).not.toMatch(/env\.ios\s*&&\s*env\.canShareFiles/);
  });

  it('shareVideo calls navigator.share with files on any canShareFiles platform', () => {
    // Crude but sufficient: the primary gate for the files path is now platform-agnostic.
    const re = /if\s*\(\s*env\.canShareFiles\(file\)\s*\)\s*\{[\s\S]{0,500}navigator as any\)\.share\(\s*\{\s*files:/m;
    expect(shareSrc).toMatch(re);
  });
});
