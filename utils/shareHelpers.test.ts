/**
 * utils/shareHelpers.test.ts — Focused Session-3 Candidate H 검증.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  extensionForBlob,
  sanitizeFilename,
  buildDownloadFilename,
  composeShareUrl,
  canUseWebShareFiles,
  normalizeHashtag,
  buildHashtagCaption,
  timestampStamp,
} from './shareHelpers';

describe('extensionForBlob', () => {
  it('mp4 MIME → mp4', () => {
    expect(extensionForBlob({ type: 'video/mp4' })).toBe('mp4');
    expect(extensionForBlob({ type: 'video/mp4; codecs=avc1' })).toBe('mp4');
  });
  it('webm MIME → webm', () => {
    expect(extensionForBlob({ type: 'video/webm; codecs=vp9,opus' })).toBe('webm');
  });
  it('quicktime → mov', () => {
    expect(extensionForBlob({ type: 'video/quicktime' })).toBe('mov');
  });
  it('null/undefined/빈 MIME → webm 폴백', () => {
    expect(extensionForBlob(null)).toBe('webm');
    expect(extensionForBlob(undefined)).toBe('webm');
    expect(extensionForBlob({ type: '' })).toBe('webm');
    expect(extensionForBlob({ type: 'application/octet-stream' })).toBe('webm');
  });
});

describe('sanitizeFilename', () => {
  it('한글/공백 유지, 금지문자 제거', () => {
    expect(sanitizeFilename('네온 아레나 / v1:test')).toBe('네온 아레나 v1test');
  });
  it('빈 문자열 → challenge', () => {
    expect(sanitizeFilename('')).toBe('challenge');
    expect(sanitizeFilename('   ')).toBe('challenge');
  });
  it('60자 컷', () => {
    const long = 'A'.repeat(100);
    expect(sanitizeFilename(long).length).toBe(60);
  });
});

describe('buildDownloadFilename', () => {
  it('파일명_스탬프.ext 포맷', () => {
    const blob = new Blob([], { type: 'video/mp4' });
    const name = buildDownloadFilename('Neon', blob);
    expect(name).toMatch(/^Neon_\d{8}_\d{4}\.mp4$/);
  });
  it('null blob → webm 폴백', () => {
    const name = buildDownloadFilename('Hex', null);
    expect(name.endsWith('.webm')).toBe(true);
  });
});

describe('timestampStamp', () => {
  it('yyyyMMdd_HHmm 포맷', () => {
    const d = new Date(2026, 3, 21, 9, 35); // month=3 → 4월
    expect(timestampStamp(d)).toBe('20260421_0935');
  });
});

describe('composeShareUrl', () => {
  it('twitter/facebook/threads: intent URL + encoded text', () => {
    const t = composeShareUrl('twitter', '안녕 #Test');
    expect(t).toContain('twitter.com/intent/tweet');
    expect(t).toContain(encodeURIComponent('안녕 #Test'));
  });
  it('instagram/tiktok/youtube_shorts: 업로드 페이지 URL', () => {
    expect(composeShareUrl('instagram', 'x')).toContain('instagram.com');
    expect(composeShareUrl('tiktok', 'x')).toContain('tiktok.com/upload');
    expect(composeShareUrl('youtube_shorts', 'x')).toContain('youtube.com/upload');
  });
  it('kakao → null (SDK 필요, 호출자가 캡션 복사 폴백)', () => {
    expect(composeShareUrl('kakao', 'x')).toBeNull();
  });
});

describe('canUseWebShareFiles', () => {
  it('nav 없음 → false', () => {
    expect(canUseWebShareFiles(null, new Blob(), 'x.webm')).toBe(false);
    expect(canUseWebShareFiles(undefined, new Blob(), 'x.webm')).toBe(false);
  });
  it('share 없음 → false', () => {
    expect(canUseWebShareFiles({}, new Blob(), 'x.webm')).toBe(false);
  });
  it('blob null → false', () => {
    expect(canUseWebShareFiles({ share: vi.fn() }, null, 'x.webm')).toBe(false);
  });
  it('canShare=true → true', () => {
    const nav = { share: vi.fn(), canShare: vi.fn(() => true), userAgent: 'Chrome' };
    const blob = new Blob([], { type: 'video/mp4' });
    expect(canUseWebShareFiles(nav, blob, 'x.mp4')).toBe(true);
  });
  it('canShare=false → false', () => {
    const nav = { share: vi.fn(), canShare: vi.fn(() => false), userAgent: 'Chrome' };
    const blob = new Blob([], { type: 'video/mp4' });
    expect(canUseWebShareFiles(nav, blob, 'x.mp4')).toBe(false);
  });
  it('iOS Safari + webm → false (early reject)', () => {
    const nav = { share: vi.fn(), canShare: vi.fn(() => true), userAgent: 'iPhone Safari' };
    const blob = new Blob([], { type: 'video/webm' });
    expect(canUseWebShareFiles(nav, blob, 'x.webm')).toBe(false);
  });
  it('iOS Safari + mp4 → true', () => {
    const nav = { share: vi.fn(), canShare: vi.fn(() => true), userAgent: 'iPhone Safari' };
    const blob = new Blob([], { type: 'video/mp4' });
    expect(canUseWebShareFiles(nav, blob, 'x.mp4')).toBe(true);
  });
});

describe('normalizeHashtag', () => {
  it("'#foo' / 'foo' 모두 '#foo' 로", () => {
    expect(normalizeHashtag('foo')).toBe('#foo');
    expect(normalizeHashtag('#foo')).toBe('#foo');
    expect(normalizeHashtag('##foo')).toBe('#foo');
  });
  it('한글/숫자/_ 허용', () => {
    expect(normalizeHashtag('챌린지_1')).toBe('#챌린지_1');
  });
  it('공백/특수문자 → null', () => {
    expect(normalizeHashtag('foo bar')).toBeNull();
    expect(normalizeHashtag('foo!')).toBeNull();
    expect(normalizeHashtag('')).toBeNull();
    expect(normalizeHashtag('#')).toBeNull();
  });
});

describe('buildHashtagCaption', () => {
  it('템플릿/점수/별/태그 조합', () => {
    const c = buildHashtagCaption({
      templateName: '네온 아레나', score: 87, stars: 4,
      hashtags: ['MotiQ', '#스쿼트'],
    });
    expect(c).toContain('네온 아레나');
    expect(c).toContain('87점');
    expect(c).toContain('★★★★');
    expect(c).toContain('#MotiQ');
    expect(c).toContain('#스쿼트');
  });
  it('기본 hashtags: MotiQ/Challenge', () => {
    const c = buildHashtagCaption({ templateName: 'X', score: 50 });
    expect(c).toContain('#MotiQ');
    expect(c).toContain('#Challenge');
  });
  it('280자 초과 시 말줄임 컷', () => {
    const c = buildHashtagCaption({
      templateName: 'T'.repeat(400), score: 99,
    });
    expect(c.length).toBeLessThanOrEqual(280);
    expect(c.endsWith('…')).toBe(true);
  });
  it('stars=0: 별표 안 붙음', () => {
    const c = buildHashtagCaption({ templateName: 'X', score: 10, stars: 0 });
    expect(c).not.toContain('★');
  });
  it('유효하지 않은 해시태그는 무시', () => {
    const c = buildHashtagCaption({ templateName: 'X', score: 50, hashtags: ['bad tag!', 'good'] });
    expect(c).toContain('#good');
    expect(c).not.toContain('bad tag');
  });
});
