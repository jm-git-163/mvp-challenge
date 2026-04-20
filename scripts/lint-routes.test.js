/**
 * scripts/lint-routes.test.js
 *
 * Vitest 에서 node 스크립트의 순수 함수들을 검증.
 * CLI 종단 검증은 package.json scripts.test 에서 prelint 로 실제 실행.
 */
import { describe, it, expect } from 'vitest';
import { extractNames, checkName } from './lint-routes.js';

describe('extractNames', () => {
  it('단일 선언 추출', () => {
    expect(extractNames(`<Stack.Screen name="record" options={{}} />`)).toEqual(['record']);
  });

  it('여러 선언 + 그룹 + 중첩', () => {
    const src = `
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="record" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="result" options={{ headerShown: false }} />
    `;
    expect(extractNames(src)).toEqual(['(main)', 'record', 'result']);
  });

  it('name 없는 선언 무시', () => {
    expect(extractNames(`<Stack.Screen options={{}} />`)).toEqual([]);
  });

  it('single-quote 문자열도 지원', () => {
    expect(extractNames(`<Stack.Screen name='profile' />`)).toEqual(['profile']);
  });
});

describe('checkName', () => {
  it('존재하는 그룹 "(main)" → null', () => {
    expect(checkName('(main)')).toBeNull();
  });

  it('존재하는 라우트 "record" → null', () => {
    expect(checkName('record')).toBeNull();
  });

  it('존재하는 라우트 "result" → null', () => {
    expect(checkName('result')).toBeNull();
  });

  it('"record/index" 같은 /index 접미사 → 안내 메시지', () => {
    const err = checkName('record/index');
    expect(err).not.toBeNull();
    expect(err).toMatch(/\/index/);
  });

  it('없는 그룹 "(auth)" (빈 디렉터리) → 에러', () => {
    // app/(auth)/ 가 있지만 내부에 route 파일 없음
    const err = checkName('(auth)');
    expect(err).not.toBeNull();
    expect(err).toMatch(/route 파일/);
  });

  it('전혀 존재하지 않는 라우트 → 에러', () => {
    const err = checkName('this-does-not-exist');
    expect(err).not.toBeNull();
    expect(err).toMatch(/찾을 수 없/);
  });
});
