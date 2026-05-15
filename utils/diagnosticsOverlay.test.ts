/**
 * diagnosticsOverlay.test.ts — FIX-Z22 (2026-04-22)
 *
 * 녹화 캔버스 위에 박히는 라이브 진단 오버레이는 유저가 실기기에서
 * "인식 3종(음성/포즈/스쿼트) 이 진짜 작동하는지" 검증하는 마지막 방어선.
 * fillText 호출 횟수·텍스트·상태 분기를 엄격히 고정한다.
 */
import { describe, it, expect } from 'vitest';
import { drawDiagnosticsOverlay, type DiagOverlayState } from './diagnosticsOverlay';

function mockCtx() {
  const calls: Array<{ fn: string; args: any[] }> = [];
  const rec = (name: string) => (...args: any[]) => { calls.push({ fn: name, args }); };
  const ctx: any = {
    save: rec('save'),
    restore: rec('restore'),
    fillRect: rec('fillRect'),
    fillText: rec('fillText'),
    set fillStyle(v: string) { calls.push({ fn: 'fillStyle=', args: [v] }); },
    set font(v: string) { calls.push({ fn: 'font=', args: [v] }); },
    set textAlign(v: string) { calls.push({ fn: 'textAlign=', args: [v] }); },
    set textBaseline(v: string) { calls.push({ fn: 'textBaseline=', args: [v] }); },
  };
  return { ctx, calls };
}

const base: DiagOverlayState = {
  show: true,
  vListen: false, vText: '', vErr: null, vPre: null, vSup: true,
  pStat: 'idle', pLm: 0, pReal: false,
  sCnt: 0, sTgt: 10, sPh: 'idle', sRdy: false, sFace: false, sBody: false,
};

describe('drawDiagnosticsOverlay', () => {
  it('show=false 면 아무 것도 안 그린다', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(ctx, { ...base, show: false }, { elapsedSec: 0, isRecording: false });
    expect(calls.filter(c => c.fn === 'fillText')).toHaveLength(0);
  });

  it('정확히 4 줄 (MIC/POSE/SQT/REC) 을 그린다', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(ctx, base, { elapsedSec: 3, isRecording: true });
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
    expect(texts).toHaveLength(4);
    expect(texts[0].startsWith('MIC ')).toBe(true);
    expect(texts[1].startsWith('POSE ')).toBe(true);
    expect(texts[2].startsWith('SQT ')).toBe(true);
    expect(texts[3].startsWith('REC ') || texts[3].startsWith('---')).toBe(true);
  });

  it('iOS Safari 미지원 → MIC 라인에 "iOS 미지원"', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(ctx, { ...base, vSup: false }, { elapsedSec: 0, isRecording: false });
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
    expect(texts[0]).toContain('iOS 미지원');
  });

  it('권한 프리체크 실패 → "권한필요"', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(ctx, { ...base, vPre: false }, { elapsedSec: 0, isRecording: false });
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
    expect(texts[0]).toContain('권한필요');
  });

  it('듣는중 + transcript(30자 clip)', () => {
    const { ctx, calls } = mockCtx();
    const long = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234' + '##TAIL##';
    drawDiagnosticsOverlay(
      ctx,
      { ...base, vSup: true, vPre: true, vListen: true, vText: long },
      { elapsedSec: 0, isRecording: false },
    );
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
    expect(texts[0]).toContain('듣는중');
    expect(texts[0]).toContain(long.slice(0, 30));
    // 30자 이후는 잘려야 함
    expect(texts[0]).not.toContain('##TAIL##');
  });

  it('SR 에러 → ERR:{code}', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(
      ctx,
      { ...base, vSup: true, vPre: true, vErr: 'audio-capture' },
      { elapsedSec: 0, isRecording: false },
    );
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
    expect(texts[0]).toContain('ERR:audio-capture');
  });

  it('POSE ready-real + lm>0 + real=true → ready-real / lm=17 / real=Y', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(
      ctx,
      { ...base, pStat: 'ready-real', pLm: 17, pReal: true },
      { elapsedSec: 0, isRecording: false },
    );
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
    expect(texts[1]).toContain('ready-real');
    expect(texts[1]).toContain('lm=17');
    expect(texts[1]).toContain('real=Y');
  });

  it('POSE ready-mock 분기', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(
      ctx,
      { ...base, pStat: 'ready-mock', pLm: 17, pReal: false },
      { elapsedSec: 0, isRecording: false },
    );
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
    expect(texts[1]).toContain('ready-mock');
    expect(texts[1]).toContain('real=N');
  });

  it('SQT 카운트/phase/armed/body-ok', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(
      ctx,
      { ...base, sCnt: 3, sTgt: 10, sPh: 'down', sRdy: true, sBody: true, sFace: true },
      { elapsedSec: 0, isRecording: false },
    );
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
    expect(texts[2]).toContain('3/10');
    expect(texts[2]).toContain('ph:down');
    expect(texts[2]).toContain('armed');
    expect(texts[2]).toContain('body-ok');
  });

  it('SQT face-only (얼굴만 보임 → 근접 모드)', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(
      ctx,
      { ...base, sCnt: 1, sFace: true, sBody: false },
      { elapsedSec: 0, isRecording: false },
    );
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
    expect(texts[2]).toContain('face-only');
  });

  it('SQT no-pose (아무것도 안보임)', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(ctx, base, { elapsedSec: 0, isRecording: false });
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
    expect(texts[2]).toContain('no-pose');
  });

  it('REC 라인: 녹화 중 = REC Ns / 대기 = --- 0s', () => {
    {
      const { ctx, calls } = mockCtx();
      drawDiagnosticsOverlay(ctx, base, { elapsedSec: 12.7, isRecording: true });
      const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
      expect(texts[3]).toBe('REC  12s');
    }
    {
      const { ctx, calls } = mockCtx();
      drawDiagnosticsOverlay(ctx, base, { elapsedSec: 0, isRecording: false });
      const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0] as string);
      expect(texts[3]).toBe('---  0s');
    }
  });

  it('fillRect 는 배경+컬러스트립 = 8 회', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(ctx, base, { elapsedSec: 0, isRecording: false });
    expect(calls.filter(c => c.fn === 'fillRect')).toHaveLength(8);
  });

  it('save/restore 짝이 맞음', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(ctx, base, { elapsedSec: 0, isRecording: false });
    expect(calls.filter(c => c.fn === 'save')).toHaveLength(1);
    expect(calls.filter(c => c.fn === 'restore')).toHaveLength(1);
  });

  it('좌표 옵션 반영 (x0/y0)', () => {
    const { ctx, calls } = mockCtx();
    drawDiagnosticsOverlay(ctx, base, { elapsedSec: 0, isRecording: false, x0: 100, y0: 200 });
    const rect = calls.find(c => c.fn === 'fillRect');
    expect(rect?.args[0]).toBe(100);
    expect(rect?.args[1]).toBe(200);
  });
});
