#!/usr/bin/env node
/**
 * scripts/generate-beats.js
 *
 * Focused Session-3 Candidate K: BPM 기반 beats JSON 생성 CLI.
 *
 * 사용법:
 *   node scripts/generate-beats.js <outputPath> <bpm> <durationSec> [beatsPerBar] [startOffsetSec]
 *
 * 예:
 *   node scripts/generate-beats.js public/bgm/kpop-upbeat-124.beats.json 124 30
 *   node scripts/generate-beats.js public/bgm/news-orchestra-90.beats.json 90 30
 *
 * 출력 포맷은 engine/beat/beatClock.ts BeatData 와 동일.
 * 실제 오디오 분석(essentia.js) 도입 전까지 플레이스홀더 역할.
 */
const fs = require('fs');
const path = require('path');

function round3(x) { return Math.round(x * 1000) / 1000; }

function generate({ bpm, durationSec, beatsPerBar = 4, startOffsetSec = 0 }) {
  bpm = Math.max(1, Math.floor(bpm));
  const duration = Math.max(0, durationSec);
  const bars = Math.max(1, Math.floor(beatsPerBar));
  const offset = Math.max(0, startOffsetSec);
  const interval = 60 / bpm;
  const beats = [];
  for (let t = offset; t <= duration + 1e-9; t += interval) {
    if (t > duration) break;
    beats.push(round3(t));
  }
  const downbeats = [];
  for (let i = 0; i < beats.length; i += bars) downbeats.push(beats[i]);
  return { bpm, beats, onsets: [...beats], downbeats };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: node scripts/generate-beats.js <outputPath> <bpm> <durationSec> [beatsPerBar] [startOffsetSec]');
    process.exit(1);
  }
  const [outRel, bpmArg, durArg, barsArg, offsetArg] = args;
  const bpm = parseInt(bpmArg, 10);
  const durationSec = parseFloat(durArg);
  const beatsPerBar = barsArg ? parseInt(barsArg, 10) : 4;
  const startOffsetSec = offsetArg ? parseFloat(offsetArg) : 0;
  if (!Number.isFinite(bpm) || !Number.isFinite(durationSec)) {
    console.error('[generate-beats] bpm/duration 은 숫자여야 합니다.');
    process.exit(1);
  }
  const data = generate({ bpm, durationSec, beatsPerBar, startOffsetSec });
  const ordered = { bpm: data.bpm, beats: data.beats, onsets: data.onsets, downbeats: data.downbeats };
  const json = JSON.stringify(ordered, null, 2);
  const outPath = path.resolve(process.cwd(), outRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json);
  console.log(`[generate-beats] ${outPath} (${data.beats.length} beats, ${data.downbeats.length} downbeats @ ${bpm} BPM × ${durationSec}s)`);
}

if (require.main === module) main();

module.exports = { generate };
