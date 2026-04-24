/**
 * scripts/analyze-bgm.js
 *
 * Focused Session-4 Candidate Q: **essentia.js 기반 실제 BGM 비트 분석 스크립트**.
 *
 *   node scripts/analyze-bgm.js <mp3-file> [-o <out.json>] [--bpm-override <n>]
 *   node scripts/analyze-bgm.js --all           # public/bgm/*.mp3 전부 분석, 옆에 .beats.json 생성
 *
 * 출력 포맷 (engine/beat/beatClock.ts BeatData 호환):
 *   { bpm: number, beats: number[], onsets: number[], downbeats: number[] }
 *   초 단위, 소수 3자리 반올림, beats[0]=0 이면 그대로 유지.
 *
 * 구현:
 *   - audio-decode 로 mp3 → Float32Array PCM (stereo 이면 L 채널만 사용)
 *   - essentia.js RhythmExtractor2013 (multifeature) 로 bpm + beats 추출
 *   - onsets 는 essentia.OnsetDetection (complex) 로 개별 추출 — FFT frame 단위
 *   - downbeats 는 RhythmExtractor2013 결과의 confidence 위에서 4박자(4/4) 가정으로
 *     매 beat % 4 == 0 을 선택 (정밀 downbeat 전용 알고리즘은 WASM 빌드에 없음)
 *
 * 제한:
 *   - essentia.js 는 brotlipak WASM 로드 async — 반드시 `await Essentia.init()` 대기
 *   - 1곡 분석 수초 소요. CI 에는 포함 금지.
 *   - 스테레오 평균 내리지 않고 L 사용 — 대부분 팝/일렉 에서 문제 없음
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

async function decodeMp3ToMono(filePath) {
  const audioDecodeMod = require('audio-decode');
  const decode = audioDecodeMod.default || audioDecodeMod;
  const buf = fs.readFileSync(filePath);
  // audio-decode returns an AudioBuffer-like object
  const audio = await decode(buf);
  // audio-decode v2: returns { channelData: Float32Array[], sampleRate }
  // (older versions: AudioBuffer with getChannelData)
  const sampleRate = audio.sampleRate;
  const chData = Array.isArray(audio.channelData)
    ? audio.channelData
    : (typeof audio.getChannelData === 'function'
        ? Array.from({ length: audio.numberOfChannels || 1 }, (_, i) => audio.getChannelData(i))
        : null);
  if (!chData || chData.length === 0) throw new Error('decoded audio has no channel data');
  const channels = chData.length;
  let mono;
  if (channels === 1) {
    mono = chData[0];
  } else {
    const L = chData[0];
    const R = chData[1];
    mono = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) mono[i] = 0.5 * (L[i] + R[i]);
  }
  return { pcm: mono, sampleRate, durationSec: mono.length / sampleRate };
}

function ensureSampleRate(pcm, srcRate, tgtRate) {
  if (srcRate === tgtRate) return pcm;
  // linear resample. essentia default 16k/44.1k/48k 둘 다 허용 — 보통 원본 유지
  const ratio = tgtRate / srcRate;
  const outLen = Math.floor(pcm.length * ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i / ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(pcm.length - 1, i0 + 1);
    const t = srcIdx - i0;
    out[i] = pcm[i0] * (1 - t) + pcm[i1] * t;
  }
  return out;
}

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

async function analyzeFile(mp3Path, outPath, { bpmOverride } = {}) {
  console.log(`[analyze-bgm] decoding ${path.basename(mp3Path)} ...`);
  const { pcm, sampleRate, durationSec } = await decodeMp3ToMono(mp3Path);
  console.log(`  sampleRate=${sampleRate}Hz duration=${durationSec.toFixed(2)}s samples=${pcm.length}`);

  // essentia default sampleRate = 44100
  const targetSr = 44100;
  const resampled = ensureSampleRate(pcm, sampleRate, targetSr);

  const { Essentia, EssentiaWASM } = require('essentia.js');
  const essentia = new Essentia(EssentiaWASM);
  console.log(`  essentia.js version: ${essentia.version}`);

  // Float32Array → essentia VectorFloat
  const vec = essentia.arrayToVector(resampled);

  // RhythmExtractor2013 multifeature method
  const rhythm = essentia.RhythmExtractor2013(vec, 208, 'multifeature', 40);
  const bpmDetected = rhythm.bpm;
  const ticksVec = rhythm.ticks;
  const ticks = Array.from(essentia.vectorToArray(ticksVec));
  console.log(`  RhythmExtractor2013: bpm=${bpmDetected.toFixed(2)} confidence=${rhythm.confidence?.toFixed?.(2) ?? 'n/a'} beats=${ticks.length}`);

  // Onset detection (complex) — FrameGenerator + OnsetDetection
  const onsets = [];
  try {
    const onsetRes = essentia.OnsetRate(vec);
    const onsetVec = onsetRes.onsets;
    const onsetArr = Array.from(essentia.vectorToArray(onsetVec));
    for (const t of onsetArr) onsets.push(round3(t));
    console.log(`  OnsetRate: rate=${onsetRes.onsetRate?.toFixed?.(2) ?? 'n/a'} onsets=${onsetArr.length}`);
    essentia.shutdown && onsetVec.delete && onsetVec.delete();
  } catch (e) {
    console.warn(`  onset 실패 (스킵):`, e.message || e);
  }

  // downbeats: beats % 4 == 0 (4/4 가정)
  const beats = ticks.map(round3);
  const downbeats = beats.filter((_, i) => i % 4 === 0);

  // cleanup
  try { vec.delete && vec.delete(); } catch {}
  try { ticksVec.delete && ticksVec.delete(); } catch {}

  const finalBpm = bpmOverride && bpmOverride > 0 ? bpmOverride : Math.round(bpmDetected);
  const beatData = {
    bpm: finalBpm,
    beats,
    onsets,
    downbeats,
  };

  const json = JSON.stringify(beatData, null, 2) + '\n';
  fs.writeFileSync(outPath, json, 'utf8');
  console.log(`  → wrote ${path.basename(outPath)} (bpm=${finalBpm}, ${beats.length} beats, ${onsets.length} onsets, ${downbeats.length} downbeats)`);
  return beatData;
}

function parseArgs(argv) {
  const args = { files: [], out: null, all: false, bpmOverride: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '-o' || a === '--out') args.out = argv[++i];
    else if (a === '--bpm-override') args.bpmOverride = Number(argv[++i]);
    else args.files.push(a);
  }
  return args;
}

function defaultOutPath(mp3Path) {
  const dir = path.dirname(mp3Path);
  const base = path.basename(mp3Path, path.extname(mp3Path));
  return path.join(dir, `${base}.beats.json`);
}

async function main() {
  const args = parseArgs(process.argv);
  let files = args.files;
  if (args.all) {
    const dir = path.resolve('public/bgm');
    files = fs.readdirSync(dir)
      .filter((n) => /\.mp3$/i.test(n))
      .map((n) => path.join(dir, n));
  }
  if (files.length === 0) {
    console.error('Usage: node scripts/analyze-bgm.js <mp3> [-o out.json] [--bpm-override N]');
    console.error('       node scripts/analyze-bgm.js --all');
    process.exit(1);
  }

  for (const f of files) {
    const out = args.out && files.length === 1 ? args.out : defaultOutPath(f);
    try {
      await analyzeFile(f, out, { bpmOverride: args.bpmOverride });
    } catch (e) {
      console.error(`[analyze-bgm] FAILED ${f}:`, e);
    }
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { analyzeFile, decodeMp3ToMono };
