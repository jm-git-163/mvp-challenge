/**
 * utils/inviteLinks.test.ts — 챌린지 초대-답장 딥링크 파서/빌더 검증.
 */
import { describe, it, expect } from 'vitest';
import {
  buildInviteUrl,
  parseInviteUrl,
  buildInviteBannerText,
  buildInviteShareCaption,
  buildReplyCaption,
} from './inviteLinks';

describe('buildInviteUrl', () => {
  it('기본 slug + from 만으로 URL 생성', () => {
    const url = buildInviteUrl('squat-master', '지민', { origin: 'https://motiq.app' });
    expect(url).toBe('https://motiq.app/challenge/squat-master?from=%EC%A7%80%EB%AF%BC');
  });

  it('message + score 쿼리 포함', () => {
    const url = buildInviteUrl('kpop-dance', '민수', {
      origin: 'https://motiq.app',
      message: '너도 해봐!',
      score: 87,
    });
    expect(url).toContain('from=%EB%AF%BC%EC%88%98');
    expect(url).toContain('msg=');
    expect(url).toContain('score=87');
  });

  it('score 범위 클램프 (음수 → 0, 초과 → 100)', () => {
    const u1 = buildInviteUrl('squat-master', 'a', { origin: 'https://x', score: -10 });
    expect(u1).toContain('score=0');
    const u2 = buildInviteUrl('squat-master', 'a', { origin: 'https://x', score: 999 });
    expect(u2).toContain('score=100');
  });

  it('빈 이름은 "친구" 로 폴백', () => {
    const url = buildInviteUrl('squat-master', '', { origin: 'https://x' });
    expect(url).toContain('from=%EC%B9%9C%EA%B5%AC');
  });

  it('잘못된 slug 는 throw', () => {
    expect(() => buildInviteUrl('../evil', 'a')).toThrow();
    expect(() => buildInviteUrl('', 'a')).toThrow();
    expect(() => buildInviteUrl('has space', 'a')).toThrow();
  });

  it('trailing slash origin 도 정규화', () => {
    const url = buildInviteUrl('squat-master', 'a', { origin: 'https://motiq.app/' });
    expect(url.startsWith('https://motiq.app/challenge/')).toBe(true);
  });
});

describe('parseInviteUrl', () => {
  it('빌더 출력을 round-trip', () => {
    const url = buildInviteUrl('squat-master', '지민', {
      origin: 'https://motiq.app',
      message: '해보자',
      score: 75,
    });
    const ctx = parseInviteUrl(url);
    expect(ctx).toEqual({
      slug: 'squat-master',
      fromName: '지민',
      message: '해보자',
      score: 75,
    });
  });

  it('쿼리스트링 단독은 slug 없음 → null', () => {
    expect(parseInviteUrl('?from=ab')).toBeNull();
  });

  it('from 누락 → null', () => {
    expect(parseInviteUrl('https://motiq.app/challenge/squat-master?score=10')).toBeNull();
  });

  it('invalid slug → null', () => {
    expect(parseInviteUrl('https://motiq.app/challenge/..%2Fevil?from=a')).toBeNull();
  });

  it('message 없어도 파싱 성공', () => {
    const ctx = parseInviteUrl('https://motiq.app/challenge/kpop-dance?from=민수');
    expect(ctx?.slug).toBe('kpop-dance');
    expect(ctx?.fromName).toBe('민수');
    expect(ctx?.message).toBeUndefined();
  });

  it('score 가 NaN 이면 무시', () => {
    const ctx = parseInviteUrl('https://motiq.app/challenge/squat-master?from=a&score=abc');
    expect(ctx?.score).toBeUndefined();
  });

  it('빈/비문자 입력은 null', () => {
    expect(parseInviteUrl('')).toBeNull();
    // @ts-expect-error
    expect(parseInviteUrl(null)).toBeNull();
  });
});

describe('buildInviteBannerText', () => {
  it('message 가 있으면 인용', () => {
    const txt = buildInviteBannerText(
      { slug: 's', fromName: '지민', message: '해보자' },
      '스쿼트 마스터',
    );
    expect(txt).toContain('지민');
    expect(txt).toContain('해보자');
  });

  it('점수만 있으면 점수 기반 카피', () => {
    const txt = buildInviteBannerText(
      { slug: 's', fromName: '지민', score: 87 },
      '스쿼트 마스터',
    );
    expect(txt).toContain('87점');
    expect(txt).toContain('스쿼트 마스터');
  });

  it('message/score 둘 다 없으면 일반 카피', () => {
    const txt = buildInviteBannerText(
      { slug: 's', fromName: '지민' },
      '스쿼트 마스터',
    );
    expect(txt).toContain('도전장');
  });
});

describe('buildInviteShareCaption', () => {
  it('점수 포함 시 점수 언급', () => {
    const cap = buildInviteShareCaption({
      templateName: '스쿼트 마스터',
      fromName: '지민',
      score: 87,
      inviteUrl: 'https://motiq.app/challenge/squat-master?from=%EC%A7%80%EB%AF%BC',
    });
    expect(cap).toContain('87점');
    expect(cap).toContain('너도 해볼래?');
    expect(cap).toContain('https://motiq.app/challenge/squat-master');
  });
});

describe('buildReplyCaption', () => {
  it('원본 초대 URL 을 꼬리에 붙임', () => {
    const cap = buildReplyCaption({
      toName: '지민',
      templateName: '스쿼트',
      score: 92,
      originalInviteUrl: 'https://motiq.app/challenge/squat-master?from=%EC%A7%80%EB%AF%BC',
    });
    expect(cap).toContain('@지민');
    expect(cap).toContain('92점');
    expect(cap).toContain('https://motiq.app/challenge/squat-master');
  });

  it('원본 URL 없으면 생략', () => {
    const cap = buildReplyCaption({ toName: '지민', templateName: '스쿼트', score: 80 });
    expect(cap).toContain('@지민');
    expect(cap.endsWith('🎯')).toBe(true);
  });
});
