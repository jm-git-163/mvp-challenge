/**
 * utils/inviteLinks.test.ts — 챌린지 초대-답장 딥링크 파서/빌더 검증.
 *
 * v2 컴팩트 포맷 (?c=<base64url>) + v1 레거시 (?from=&msg=&score=) 둘 다 검증.
 */
import { describe, it, expect } from 'vitest';
import {
  buildInviteUrl,
  parseInviteUrl,
  buildInviteBannerText,
  buildInviteShareCaption,
  buildInviteShortCaption,
  buildReplyCaption,
} from './inviteLinks';

describe('buildInviteUrl (v2 compact)', () => {
  it('기본 slug + from 만으로 URL 생성 — 단일 c 파라미터, /share/ prefix', () => {
    const url = buildInviteUrl('squat-master', '지민', { origin: 'https://motiq.app' });
    // FIX-OG-CRAWLER: /share/challenge/ prefix (Vercel serverless OG 함수 경로)
    expect(url.startsWith('https://motiq.app/share/challenge/squat-master?c=')).toBe(true);
    // 레거시 파라미터 없음
    expect(url).not.toContain('from=');
    expect(url).not.toContain('msg=');
    expect(url).not.toContain('score=');
  });

  it('message + score 도 c 하나에 압축', () => {
    const url = buildInviteUrl('kpop-dance', '민수', {
      origin: 'https://motiq.app',
      message: '너도 해봐!',
      score: 87,
    });
    expect(url).toMatch(/\?c=[A-Za-z0-9_-]+$/);
    const ctx = parseInviteUrl(url);
    expect(ctx).toEqual({ slug: 'kpop-dance', fromName: '민수', message: '너도 해봐!', score: 87 });
  });

  it('score 범위 클램프 (음수 → 0, 초과 → 100)', () => {
    const c1 = parseInviteUrl(buildInviteUrl('squat-master', 'a', { origin: 'https://x', score: -10 }));
    expect(c1?.score).toBe(0);
    const c2 = parseInviteUrl(buildInviteUrl('squat-master', 'a', { origin: 'https://x', score: 999 }));
    expect(c2?.score).toBe(100);
  });

  it('빈 이름은 "친구" 로 폴백', () => {
    const ctx = parseInviteUrl(buildInviteUrl('squat-master', '', { origin: 'https://x' }));
    expect(ctx?.fromName).toBe('친구');
  });

  it('잘못된 slug 는 throw', () => {
    expect(() => buildInviteUrl('../evil', 'a')).toThrow();
    expect(() => buildInviteUrl('', 'a')).toThrow();
    expect(() => buildInviteUrl('has space', 'a')).toThrow();
  });

  it('UUID 도 slug 로 허용 (DB template id 호환)', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const url = buildInviteUrl(uuid, 'a', { origin: 'https://x' });
    expect(url).toContain(`/share/challenge/${uuid}`);
  });

  it('trailing slash origin 도 정규화', () => {
    const url = buildInviteUrl('squat-master', 'a', { origin: 'https://motiq.app/' });
    expect(url.startsWith('https://motiq.app/share/challenge/')).toBe(true);
  });
});

describe('parseInviteUrl (v2)', () => {
  it('빌더 출력을 round-trip', () => {
    const url = buildInviteUrl('squat-master', '지민', {
      origin: 'https://motiq.app',
      message: '해보자',
      score: 75,
    });
    const ctx = parseInviteUrl(url);
    expect(ctx).toEqual({ slug: 'squat-master', fromName: '지민', message: '해보자', score: 75 });
  });

  it('빈/비문자 입력은 null', () => {
    expect(parseInviteUrl('')).toBeNull();
    // @ts-expect-error
    expect(parseInviteUrl(null)).toBeNull();
  });

  it('invalid slug → null', () => {
    expect(parseInviteUrl('https://motiq.app/challenge/..%2Fevil?c=eyJmIjoiYSJ9')).toBeNull();
  });

  it('슬러그만 있고 쿼리 없으면 null', () => {
    expect(parseInviteUrl('https://motiq.app/challenge/squat-master')).toBeNull();
  });

  it('/share/challenge/ prefix 경로도 파싱 (OG 크롤러용 URL)', () => {
    const url = buildInviteUrl('kpop-dance', '민수', {
      origin: 'https://motiq.app', score: 77,
    });
    expect(url).toContain('/share/challenge/');
    const ctx = parseInviteUrl(url);
    expect(ctx?.slug).toBe('kpop-dance');
    expect(ctx?.fromName).toBe('민수');
    expect(ctx?.score).toBe(77);
  });

  it('레거시 /challenge/ prefix 경로도 계속 파싱 (backward compat)', () => {
    const ctx = parseInviteUrl('https://motiq.app/challenge/squat-master?from=지민&score=50');
    expect(ctx?.slug).toBe('squat-master');
    expect(ctx?.fromName).toBe('지민');
    expect(ctx?.score).toBe(50);
  });
});

describe('parseInviteUrl (v1 legacy backward compat)', () => {
  it('레거시 from/msg/score 포맷 파싱', () => {
    const ctx = parseInviteUrl('https://motiq.app/challenge/squat-master?from=%EC%A7%80%EB%AF%BC&msg=%ED%95%B4%EB%B3%B4%EC%9E%90&score=75');
    expect(ctx).toEqual({ slug: 'squat-master', fromName: '지민', message: '해보자', score: 75 });
  });

  it('레거시 from 만 있어도 파싱', () => {
    const ctx = parseInviteUrl('https://motiq.app/challenge/kpop-dance?from=민수');
    expect(ctx?.slug).toBe('kpop-dance');
    expect(ctx?.fromName).toBe('민수');
    expect(ctx?.message).toBeUndefined();
  });

  it('레거시 score=abc 는 무시', () => {
    const ctx = parseInviteUrl('https://motiq.app/challenge/squat-master?from=a&score=abc');
    expect(ctx?.score).toBeUndefined();
  });

  it('레거시 from 누락 → null', () => {
    expect(parseInviteUrl('https://motiq.app/challenge/squat-master?score=10')).toBeNull();
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
    const txt = buildInviteBannerText({ slug: 's', fromName: '지민' }, '스쿼트 마스터');
    expect(txt).toContain('도전장');
  });
});

describe('buildInviteShareCaption', () => {
  it('점수 포함 시 점수 언급 + 짧은 URL 포함', () => {
    const url = buildInviteUrl('squat-master', '지민', { origin: 'https://motiq.app', score: 87 });
    const cap = buildInviteShareCaption({
      templateName: '스쿼트 마스터',
      fromName: '지민',
      score: 87,
      inviteUrl: url,
    });
    expect(cap).toContain('87점');
    expect(cap).toContain('도전장');
    expect(cap).toContain('https://motiq.app/share/challenge/squat-master?c=');
  });
});

describe('buildInviteShortCaption', () => {
  it('이름 + 템플릿명 포함 짧은 카드 캡션', () => {
    const cap = buildInviteShortCaption({ templateName: '스쿼트', fromName: '지민', score: 87 });
    expect(cap).toContain('지민');
    expect(cap).toContain('스쿼트');
    expect(cap).toContain('87');
  });
});

describe('buildReplyCaption', () => {
  it('원본 초대 URL 을 꼬리에 붙임', () => {
    const cap = buildReplyCaption({
      toName: '지민',
      templateName: '스쿼트',
      score: 92,
      originalInviteUrl: 'https://motiq.app/challenge/squat-master?c=xyz',
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
