#!/usr/bin/env node
/**
 * scripts/generate-placeholder-bgm.js
 *
 * Focused Commit 3: neon-arena 용 플레이스홀더 synthwave BGM 생성.
 *
 * 출력:
 *   public/bgm/synthwave-128.wav      — 44.1kHz mono 16-bit PCM, 128 BPM, 20초
 *   public/bgm/synthwave-128.beats.json — BeatData (engine/beat/beatClock.ts 포맷)
 *
 * 구성 요소(전부 순수 Math 합성 — 라이선스 0):
 *   - 킥: 100→50Hz 지수 감쇠 사인 버스트, 매 비트
 *   - 서브 베이스: A2 (55Hz) 사각파, 2비트마다 리트리거
 *   - 리드 아르페지오: A minor (A3, C4, E4, G4) 16th 간격 saw + envelope
 *   - 저역 패드: A minor 3화음 합성 사인 0.08 진폭
 *
 * 모든 곡 생성은 결정적(seed=none, Math.sin 기반). 재실행 시 동일 바이너리.
 */
const fs = require('fs');
const path = require('path');

const SR       = 44100;        // sample rate
const DURATION = 20;           // seconds
const BPM      = 128;
const BEAT_S   = 60 / BPM;     // 0.46875s
const TOTAL    = SR * DURATION;

// ── Voice 합성 ──────────────────────────────────────────────────────────────
function kick(tLocal) {
  // 0..0.2s 킥 엔벨로프
  if (tLocal < 0 || tLocal > 0.2) return 0;
  const env = Math.exp(-tLocal * 22);
  const freq = 100 * Math.exp(-tLocal * 12) + 40; // 100→50Hz 스윕
  return Math.sin(2 * Math.PI * freq * tLocal) * env * 0.85;
}
function subBass(tLocal, freq) {
  if (tLocal < 0 || tLocal > 0.45) return 0;
  const env = Math.min(1, tLocal * 20) * Math.exp(-tLocal * 3.5);
  // 사각파 근사 (홀수 고조파 3개)
  const w = 2 * Math.PI * freq * tLocal;
  const sq = Math.sin(w) + Math.sin(3 * w) / 3 + Math.sin(5 * w) / 5;
  return sq * env * 0.22;
}
function leadArp(tLocal, freq) {
  if (tLocal < 0 || tLocal > 0.14) return 0;
  const env = Math.min(1, tLocal * 60) * Math.exp(-tLocal * 18);
  // 사톱파 근사
  const phase = (freq * tLocal) % 1;
  const saw = phase * 2 - 1;
  return saw * env * 0.18;
}
function pad(t, freqs) {
  let s = 0;
  for (const f of freqs) s += Math.sin(2 * Math.PI * f * t);
  return (s / freqs.length) * 0.08;
}

// 노트 주파수
const A2 = 55, A3 = 220, C4 = 261.63, E4 = 329.63, G4 = 392.0;
const A4 = 440, E3 = 164.81, C3 = 130.81;

// ── 곡 렌더 ────────────────────────────────────────────────────────────────
const samples = new Float32Array(TOTAL);

for (let i = 0; i < TOTAL; i++) {
  const t = i / SR;

  // 킥: 매 비트
  const beatIdx = Math.floor(t / BEAT_S);
  const beatStart = beatIdx * BEAT_S;
  samples[i] += kick(t - beatStart);

  // 서브 베이스: 2비트마다, A2
  const bassIdx = Math.floor(t / (BEAT_S * 2));
  const bassStart = bassIdx * BEAT_S * 2;
  samples[i] += subBass(t - bassStart, A2);

  // 16th 아르페지오 패턴: A3 C4 E4 G4 반복
  const sixteenth = BEAT_S / 4;
  const arpIdx = Math.floor(t / sixteenth);
  const arpStart = arpIdx * sixteenth;
  const pattern = [A3, C4, E4, G4, A4, G4, E4, C4];
  const note = pattern[arpIdx % pattern.length];
  samples[i] += leadArp(t - arpStart, note);

  // 패드: 전체 지속
  samples[i] += pad(t, [A3, C4, E4]);
}

// ── 정규화 + 16-bit 변환 ───────────────────────────────────────────────────
let peak = 0;
for (let i = 0; i < TOTAL; i++) peak = Math.max(peak, Math.abs(samples[i]));
const gain = peak > 0 ? 0.95 / peak : 1;

const buf16 = Buffer.alloc(TOTAL * 2);
for (let i = 0; i < TOTAL; i++) {
  const s = Math.max(-1, Math.min(1, samples[i] * gain));
  buf16.writeInt16LE(Math.round(s * 32767), i * 2);
}

// ── WAV 헤더 ───────────────────────────────────────────────────────────────
function wavHeader(dataLen, sr, channels, bits) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + dataLen, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);                     // PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * channels * bits / 8, 28);
  h.writeUInt16LE(channels * bits / 8, 32);
  h.writeUInt16LE(bits, 34);
  h.write('data', 36);
  h.writeUInt32LE(dataLen, 40);
  return h;
}
const wav = Buffer.concat([wavHeader(buf16.length, SR, 1, 16), buf16]);

// ── 디렉터리 보장 + 출력 ────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'public', 'bgm');
fs.mkdirSync(outDir, { recursive: true });

const wavPath = path.join(outDir, 'synthwave-128.wav');
fs.writeFileSync(wavPath, wav);

// Beats JSON: engine/beat/beatClock.ts 의 BeatData 포맷
const beats = [];
for (let t = 0; t < DURATION; t += BEAT_S) beats.push(Math.round(t * 1000) / 1000);
const downbeats = beats.filter((_, i) => i % 4 === 0);
const beatData = { bpm: BPM, beats, onsets: [...beats], downbeats };

const jsonPath = path.join(outDir, 'synthwave-128.beats.json');
fs.writeFileSync(jsonPath, JSON.stringify(beatData, null, 2));

console.log(`[bgm] ${wavPath} (${(wav.length / 1024).toFixed(1)} KB, ${DURATION}s @ ${BPM} BPM)`);
console.log(`[bgm] ${jsonPath} (${beats.length} beats, ${downbeats.length} downbeats)`);
