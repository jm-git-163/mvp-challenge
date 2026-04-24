/**
 * utils/challengeMeta.test.ts — OG 크롤러용 정적 HTML 렌더 검증.
 */
import { describe, it, expect } from 'vitest';
import {
  getChallengeMeta,
  decodeInvitePayload,
  renderOgHtml,
  escapeHtml,
} from './challengeMeta';

describe('getChallengeMeta', () => {
  it('11 공식 slug 모두 매핑', () => {
    const slugs = [
      'daily-vlog', 'news-anchor', 'english-speaking', 'storybook-reading',
      'travel-checkin', 'unboxing-promo', 'kpop-dance', 'food-review',
      'motivation-speech', 'social-viral', 'squat-master',
    ];
    for (const s of slugs) {
      const m = getChallengeMeta(s);
      expect(m.slug).toBe(s);
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.thumbUrl).toMatch(/^https:\/\//);
    }
  });

  it('알 수 없는 slug 는 기본 카드로 폴백', () => {
    const m = getChallengeMeta('unknown-xyz');
    expect(m.name).toBe('챌린지');
    expect(m.thumbUrl).toMatch(/^https:\/\//);
  });
});

describe('decodeInvitePayload', () => {
  it('base64url JSON 디코드', () => {
    const payload = { f: '지민', m: '해보자', s: 87 };
    // base64url encode (매 테스트 재현 가능)
    const raw = JSON.stringify(payload);
    const b64 = Buffer.from(raw, 'utf-8').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const decoded = decodeInvitePayload(b64);
    expect(decoded).toEqual(payload);
  });

  it('잘못된 입력은 null', () => {
    expect(decodeInvitePayload('')).toBeNull();
    expect(decodeInvitePayload('!!!notbase64')).toBeNull();
  });
});

describe('renderOgHtml', () => {
  const c = Buffer.from(JSON.stringify({ f: '지민', m: '같이 하자', s: 87 }), 'utf-8')
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  it('공식 slug + payload → og:title 에 발신자·챌린지명, og:image 에 썸네일', () => {
    const html = renderOgHtml({ slug: 'kpop-dance', c, origin: 'https://motiq.app' });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('og:title');
    expect(html).toContain('지민');
    expect(html).toContain('K-POP 댄스');
    expect(html).toContain('og:image');
    expect(html).toMatch(/og:image"[^>]*content="https:\/\/images\.unsplash\.com/);
    // Twitter card
    expect(html).toContain('twitter:card');
    expect(html).toContain('summary_large_image');
    // redirect 작동
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('/challenge/kpop-dance?c=');
  });

  it('c 없어도 기본 카드 렌더', () => {
    const html = renderOgHtml({ slug: 'squat-master', c: null, origin: 'https://motiq.app' });
    expect(html).toContain('스쿼트 마스터');
    expect(html).toContain('og:image');
  });

  it('XSS — 발신자 이름에 HTML 태그를 넣어도 이스케이프', () => {
    const evil = Buffer.from(JSON.stringify({ f: '<script>alert(1)</script>' }), 'utf-8')
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const html = renderOgHtml({ slug: 'kpop-dance', c: evil, origin: 'https://motiq.app' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('escapeHtml', () => {
  it('모든 특수문자를 entity 로 변환', () => {
    expect(escapeHtml(`<a href="x">'&"</a>`))
      .toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&quot;&lt;/a&gt;');
  });
});
