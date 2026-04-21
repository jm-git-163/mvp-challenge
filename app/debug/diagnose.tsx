/**
 * app/debug/diagnose.tsx
 *
 * 모바일/데스크톱 인식 진단 페이지.
 * 유저가 /debug/diagnose 로 접속하면 실시간으로 4개 서브시스템 상태 표시:
 *   1. getUserMedia (카메라/마이크 권한 + 스트림)
 *   2. MediaPipe PoseLandmarker (GPU→CPU 폴백 포함, 실시간 detect)
 *   3. webkitSpeechRecognition (지원 여부 + 실시간 transcript)
 *   4. Web Audio 마이크 레벨 (실시간 RMS)
 *
 * 목적: "인식이 안 된다" 의 원인을 유저 디바이스에서 정확히 특정.
 * 화면은 React Native View 로 조합 (네이티브는 웹 한정 메시지 표시).
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Platform, Pressable } from 'react-native';

// ---------------------------------------------------------------------------
// 웹 전용 진단 훅
// ---------------------------------------------------------------------------
interface Diag {
  userAgent: string;
  secureContext: boolean;
  // 카메라/마이크
  gumStatus: 'idle' | 'requesting' | 'ok' | 'denied' | 'error';
  gumError: string;
  videoTracks: number;
  audioTracks: number;
  videoDim: string;
  // MediaPipe
  mpStatus: 'idle' | 'loading' | 'ready' | 'error';
  mpDelegate: 'GPU' | 'CPU' | '';
  mpError: string;
  mpLandmarksSeen: number;
  mpLastDetectionMs: number;
  // SpeechRecognition
  srSupported: boolean;
  srActive: boolean;
  srLang: string;
  srError: string;
  srInterim: string;
  srFinal: string;
  // Audio level
  audioLevel: number;
  // Timestamps
  tStart: number;
}

function initDiag(): Diag {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '-';
  const secure = typeof window !== 'undefined' ? Boolean((window as any).isSecureContext) : false;
  return {
    userAgent: ua, secureContext: secure,
    gumStatus: 'idle', gumError: '', videoTracks: 0, audioTracks: 0, videoDim: '-',
    mpStatus: 'idle', mpDelegate: '', mpError: '', mpLandmarksSeen: 0, mpLastDetectionMs: 0,
    srSupported: false, srActive: false, srLang: 'ko-KR', srError: '', srInterim: '', srFinal: '',
    audioLevel: 0, tStart: Date.now(),
  };
}

export default function Diagnose() {
  const [diag, setDiag] = useState<Diag>(initDiag());
  const diagRef = useRef(diag);
  diagRef.current = diag;
  const update = (p: Partial<Diag>) => setDiag((d) => ({ ...d, ...p }));

  const [running, setRunning] = useState(false);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mpHandleRef = useRef<any>(null);
  const srRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // -------------------------------------------------------------------------
  // 비웹: 안내만 표시
  // -------------------------------------------------------------------------
  if (Platform.OS !== 'web') {
    return (
      <View style={s.rootNative}>
        <Text style={s.title}>진단 페이지</Text>
        <Text style={s.p}>이 페이지는 웹 브라우저에서만 동작합니다.{'\n'}Chrome/Edge 에서 /debug/diagnose 로 접속하세요.</Text>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // 진단 시작 (유저 제스처 필수 — iOS 외 모바일도 안정적)
  // -------------------------------------------------------------------------
  const start = async () => {
    if (running) return;
    setRunning(true);

    // 1) getUserMedia
    update({ gumStatus: 'requesting' });
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const vt = stream.getVideoTracks()[0];
      const at = stream.getAudioTracks()[0];
      const settings = vt?.getSettings ? vt.getSettings() : {};
      update({
        gumStatus: 'ok',
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoDim: `${settings.width ?? '?'}x${settings.height ?? '?'}`,
      });
    } catch (err: any) {
      update({
        gumStatus: err?.name === 'NotAllowedError' ? 'denied' : 'error',
        gumError: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}`,
      });
      return;
    }

    // video element 를 DOM 에 부착 (숨김)
    const v = document.createElement('video');
    v.autoplay = true;
    (v as any).playsInline = true;
    v.muted = true;
    v.srcObject = stream;
    v.style.position = 'absolute';
    v.style.left = '-9999px';
    v.width = 160; v.height = 120;
    document.body.appendChild(v);
    videoElRef.current = v;
    try { await v.play(); } catch (e) { /* 유저 제스처 후 재시도 */ }
    for (let i = 0; i < 40; i++) {
      if (v.readyState >= 2 && v.videoWidth > 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    // 2) Audio analyser
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      analyserRef.current = an;
    } catch (e) { /* ignore */ }

    // 3) MediaPipe load
    update({ mpStatus: 'loading' });
    try {
      const mod: any = await import('@mediapipe/tasks-vision');
      const base = (process.env as any)?.EXPO_PUBLIC_MEDIAPIPE_BASE
        ?? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision';
      const modelPath = (process.env as any)?.EXPO_PUBLIC_MEDIAPIPE_MODEL_URL
        ?? 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
      const vision = await mod.FilesetResolver.forVisionTasks(`${base}/wasm`);
      let handle: any = null;
      let delegate: 'GPU' | 'CPU' = 'GPU';
      const make = (d: 'GPU' | 'CPU') => mod.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelPath, delegate: d },
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      try {
        handle = await make('GPU');
      } catch (gpuErr: any) {
        delegate = 'CPU';
        update({ mpError: `GPU 실패 → CPU 재시도: ${gpuErr?.message ?? gpuErr}` });
        handle = await make('CPU');
      }
      mpHandleRef.current = handle;
      update({ mpStatus: 'ready', mpDelegate: delegate });
    } catch (err: any) {
      update({ mpStatus: 'error', mpError: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}` });
    }

    // 4) SpeechRecognition
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      update({ srSupported: false, srError: '브라우저 미지원 (webkitSpeechRecognition 없음)' });
    } else {
      update({ srSupported: true });
      try {
        const sr = new SR();
        sr.lang = 'ko-KR';
        sr.continuous = true;
        sr.interimResults = true;
        sr.onstart = () => update({ srActive: true, srError: '' });
        sr.onend = () => {
          update({ srActive: false });
          // 자동 재시작 (Chrome 침묵 타임아웃 대응)
          try { sr.start(); } catch {}
        };
        sr.onerror = (e: any) => update({ srError: `${e?.error ?? 'error'}: ${e?.message ?? ''}` });
        sr.onresult = (e: any) => {
          let interim = ''; let finalT = diagRef.current.srFinal;
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalT += r[0].transcript;
            else interim += r[0].transcript;
          }
          update({ srInterim: interim, srFinal: finalT });
        };
        sr.start();
        srRef.current = sr;
      } catch (err: any) {
        update({ srError: `start 실패: ${err?.message ?? err}` });
      }
    }

    // Detect + audio loop
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);

      // MediaPipe detect
      const handle = mpHandleRef.current;
      const v = videoElRef.current;
      if (handle && v && v.readyState >= 2 && v.videoWidth > 0) {
        try {
          const now = performance.now();
          const result = handle.detectForVideo(v, now);
          if (result?.landmarks?.length > 0) {
            const n = result.landmarks[0]?.length ?? 0;
            update({ mpLandmarksSeen: n, mpLastDetectionMs: Math.round(now) });
          }
        } catch (e: any) {
          update({ mpError: `detect 에러: ${e?.message ?? e}` });
        }
      }

      // Audio level
      const an = analyserRef.current;
      if (an) {
        const arr = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(arr);
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length / 255;
        update({ audioLevel: avg });
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (srRef.current) { try { srRef.current.stop(); } catch {} srRef.current = null; }
      if (mpHandleRef.current) { try { mpHandleRef.current.close(); } catch {} mpHandleRef.current = null; }
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} }
      if (videoElRef.current && videoElRef.current.parentNode) {
        videoElRef.current.parentNode.removeChild(videoElRef.current);
      }
    };
  }, []);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.inner}>
      <Text style={s.title}>📡 인식 진단</Text>
      <Text style={s.sub}>
        이 페이지는 카메라·마이크·MediaPipe·SpeechRecognition 이 각각 살아있는지 확인합니다.
      </Text>

      {!running && (
        <Pressable style={s.btn} onPress={start}>
          <Text style={s.btnT}>진단 시작 (권한 팝업이 뜹니다)</Text>
        </Pressable>
      )}

      <Section title="환경">
        <Row k="User Agent" v={diag.userAgent} mono />
        <Row k="Secure context (HTTPS)" v={diag.secureContext ? '✅ 예' : '❌ 아니오'} />
      </Section>

      <Section title="1. 카메라/마이크 (getUserMedia)">
        <Row k="상태" v={
          diag.gumStatus === 'ok' ? '✅ OK' :
          diag.gumStatus === 'denied' ? '❌ 권한 거부' :
          diag.gumStatus === 'error' ? '❌ 에러' :
          diag.gumStatus === 'requesting' ? '⏳ 요청 중' : '⚪ 대기'
        } />
        {diag.gumError ? <Row k="에러" v={diag.gumError} danger /> : null}
        <Row k="비디오 트랙" v={String(diag.videoTracks)} />
        <Row k="오디오 트랙" v={String(diag.audioTracks)} />
        <Row k="해상도" v={diag.videoDim} />
      </Section>

      <Section title="2. MediaPipe PoseLandmarker">
        <Row k="상태" v={
          diag.mpStatus === 'ready' ? '✅ Ready' :
          diag.mpStatus === 'error' ? '❌ 에러' :
          diag.mpStatus === 'loading' ? '⏳ 로딩 중' : '⚪ 대기'
        } />
        <Row k="Delegate" v={diag.mpDelegate || '-'} />
        {diag.mpError ? <Row k="메시지" v={diag.mpError} danger /> : null}
        <Row k="감지된 랜드마크 수" v={String(diag.mpLandmarksSeen)} />
        <Row k="마지막 감지 시각(ms)" v={String(diag.mpLastDetectionMs)} />
      </Section>

      <Section title="3. SpeechRecognition (webkit)">
        <Row k="브라우저 지원" v={diag.srSupported ? '✅ 지원' : '❌ 미지원'} />
        <Row k="listening" v={diag.srActive ? '🟢 활성' : '⚪ 비활성'} />
        <Row k="언어" v={diag.srLang} />
        {diag.srError ? <Row k="에러" v={diag.srError} danger /> : null}
        <Row k="interim" v={diag.srInterim || '-'} mono />
        <Row k="final" v={diag.srFinal || '-'} mono />
      </Section>

      <Section title="4. 마이크 레벨 (Web Audio)">
        <Row k="RMS (0~1)" v={diag.audioLevel.toFixed(3)} />
        <View style={s.meterOuter}>
          <View style={[s.meterInner, { width: `${Math.min(100, diag.audioLevel * 100 * 3)}%` }]} />
        </View>
        <Text style={s.hint}>말을 하면 게이지가 움직여야 정상입니다.</Text>
      </Section>

      <Text style={s.footer}>
        경과: {Math.round((Date.now() - diag.tStart) / 1000)}s
      </Text>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionT}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ k, v, mono, danger }: { k: string; v: string; mono?: boolean; danger?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={[s.rowV, mono ? s.mono : null, danger ? s.danger : null]} selectable>
        {v}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#0b0d12' },
  rootNative:  { flex: 1, padding: 24, backgroundColor: '#0b0d12', justifyContent: 'center' },
  inner:       { padding: 16, paddingBottom: 48 },
  title:       { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  sub:         { color: '#aab', fontSize: 13, marginBottom: 16 },
  btn:         { backgroundColor: '#FF2D95', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  btnT:        { color: '#fff', fontWeight: '700', fontSize: 16 },
  section:     { backgroundColor: '#161a22', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#232838' },
  sectionT:    { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  row:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  rowK:        { color: '#9aa4b2', width: 150, fontSize: 12 },
  rowV:        { color: '#e8edf5', flex: 1, fontSize: 12 },
  mono:        { fontFamily: Platform.OS === 'web' ? 'ui-monospace, monospace' as any : 'monospace' },
  danger:      { color: '#ff5577' },
  meterOuter:  { height: 10, backgroundColor: '#222', borderRadius: 6, overflow: 'hidden', marginTop: 4 },
  meterInner:  { height: '100%', backgroundColor: '#4ade80' },
  hint:        { color: '#6b7280', fontSize: 11, marginTop: 4 },
  footer:      { color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: 8 },
  p:           { color: '#ccc', fontSize: 14, textAlign: 'center' },
});

// note: Diagnose 는 default export 로 expo-router 가 /debug/diagnose 로 자동 라우팅.
