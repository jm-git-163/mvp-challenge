/**
 * app/selftest/index.tsx — 실기기 30초 자가진단.
 *
 * 사용자 피드백 대응: "개선이 안 되면 토큰만 나가고 힘들다" → 매 세션 테스트 한 번에
 * 1~8 항목 각각이 실제로 되는지 스마트폰에서 직접 보이게 한다. 헤드리스 브라우저로
 * 닿지 못하는 카메라·마이크·MediaPipe·STT 경로를 스마트폰 브라우저 화면에 실시간
 * 수치로 노출.
 *
 * 화면 구성:
 *   [허용] 버튼  — getUserMedia(video+audio) 실행, __permissionGranted 세팅
 *   🎥 카메라  → readyState, videoWidth×H, 실시간 미니 프리뷰
 *   🧠 포즈     → MediaPipe 로드 상태, 탐지 프레임/초, landmark 가시 개수, nose/shoulder 가시도
 *   🏋 스쿼트   → HSS d / d0 / phase / count (이 페이지에서 직접 동작)
 *   🎤 자막     → webkitSpeechRecognition 실시간 transcript + getDiagnostic 전체
 *   🔈 BGM     → 9개 mp3/wav 파일 각각 재생 버튼 (파일 존재·디코딩 확인)
 *   ♻ 리셋      — 모든 상태 해제 후 다시 시작 (2회 연속 시뮬레이션)
 *
 * 목표: 사용자가 "STT 이벤트 0", "landmark 17개 다 보이는데 카운트 0" 같이 구체
 *       지점을 지적하면 해당 파일을 직접 고칠 수 있게 함.
 *
 * 순수 웹 전용 (Platform.OS === 'web'). 네이티브에서는 안내만.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { HeadShoulderSquatDetector } from '../../engine/missions/headShoulderSquat';
import { getGlobalSpeechRecognizer, disposeGlobalSpeechRecognizer } from '../../utils/speechUtils';

interface State {
  // 환경
  ua: string;
  secure: boolean;
  // 권한
  permStatus: 'idle' | 'requesting' | 'ok' | 'denied' | 'err';
  permMsg: string;
  // 카메라
  camReady: boolean;
  camW: number;
  camH: number;
  // MediaPipe
  mpStatus: 'idle' | 'loading' | 'ready' | 'err';
  mpDelegate: 'GPU' | 'CPU' | '';
  mpMsg: string;
  mpFps: number;
  lmVisCount: number;
  noseVis: number;
  lShVis: number;
  rShVis: number;
  // HSS
  hssD: number;
  hssD0: number;
  hssPhase: string;
  hssMode: string;
  hssCount: number;
  hssCal: string;
  // STT
  sttSupported: boolean;
  sttListening: boolean;
  sttInterim: string;
  sttFinal: string;
  sttStarts: number;
  sttEnds: number;
  sttResults: number;
  sttRetry: number;
  sttLastEvent: string;
  sttLastError: string;
  sttMsSince: number | null;
  // Audio
  micRms: number;
  // BGM
  bgmNow: string;
  bgmErr: string;
}

// FIX-BGM (2026-04-22): wav 제거, 현재 public/bgm/ 12개 mp3 1:1.
const BGM_FILES = [
  '/bgm/alexzavesa-dance-playful-night-510786.mp3',
  '/bgm/anomy5-aggressive-sport-phonk-464391.mp3',
  '/bgm/anomy5-dark-electronic-464393.mp3',
  '/bgm/anomy5-neon-night-phonk-house-by-anomy5-178380.mp3',
  '/bgm/anomy5-phonk-phonk-music-467523.mp3',
  '/bgm/anomy5-sad-chill-phonk-464392.mp3',
  '/bgm/anomy5-time-trigger-phonk-house-by-anomy5-180413.mp3',
  '/bgm/atlasaudio-jazz-490623.mp3',
  '/bgm/backgroundmusicforvideos-no-copyright-music-334863.mp3',
  '/bgm/diamond_tunes-no-copyright-intro-music-18457.mp3',
  '/bgm/pulsebox-a-background-jazz-no-copyright-448459.mp3',
  '/bgm/pulsebox-a-no-copyright-jazz-background-448471.mp3',
];

function initState(): State {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '-';
  const secure = typeof window !== 'undefined' ? Boolean((window as any).isSecureContext) : false;
  return {
    ua, secure,
    permStatus: 'idle', permMsg: '',
    camReady: false, camW: 0, camH: 0,
    mpStatus: 'idle', mpDelegate: '', mpMsg: '', mpFps: 0,
    lmVisCount: 0, noseVis: 0, lShVis: 0, rShVis: 0,
    hssD: 0, hssD0: 0, hssPhase: '-', hssMode: '-', hssCount: 0, hssCal: 'idle',
    sttSupported: false, sttListening: false, sttInterim: '', sttFinal: '',
    sttStarts: 0, sttEnds: 0, sttResults: 0, sttRetry: 0, sttLastEvent: '-', sttLastError: '-', sttMsSince: null,
    micRms: 0,
    bgmNow: '-', bgmErr: '',
  };
}

export default function SelfTest() {
  const [st, setSt] = useState<State>(initState);
  const stRef = useRef(st);
  stRef.current = st;
  const patch = (p: Partial<State>) => setSt((s) => ({ ...s, ...p }));

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mpRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const hssRef = useRef<HeadShoulderSquatDetector>(new HeadShoulderSquatDetector());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const sttStopRef = useRef<(() => void) | null>(null);
  const fpsRef = useRef<{ t: number; n: number }>({ t: 0, n: 0 });

  if (Platform.OS !== 'web') {
    return (
      <View style={s.nonweb}>
        <Text style={s.title}>자가진단 (웹 전용)</Text>
        <Text style={s.p}>스마트폰 브라우저 (Chrome / Safari) 로 접속하세요.</Text>
      </View>
    );
  }

  const grantAndRun = async () => {
    patch({ permStatus: 'requesting' });

    // 1) getUserMedia — 유저 제스처 안에서 호출
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err: any) {
      patch({
        permStatus: err?.name === 'NotAllowedError' ? 'denied' : 'err',
        permMsg: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}`,
      });
      return;
    }
    streamRef.current = stream;
    (window as any).__permissionStream = stream;
    (window as any).__permissionGranted = true;
    patch({ permStatus: 'ok', permMsg: `video=${stream.getVideoTracks().length} audio=${stream.getAudioTracks().length}` });

    // 2) video element
    let v = videoRef.current;
    if (!v) {
      v = document.createElement('video');
      v.autoplay = true; (v as any).playsInline = true; v.muted = true;
      v.style.position = 'fixed'; v.style.top = '70px'; v.style.right = '10px';
      v.style.width = '120px'; v.style.height = '160px';
      v.style.objectFit = 'cover';
      v.style.borderRadius = '8px';
      v.style.border = '2px solid #4ade80';
      v.style.zIndex = '9999';
      document.body.appendChild(v);
      videoRef.current = v;
    }
    v.srcObject = stream;
    try { await v.play(); } catch {}
    for (let i = 0; i < 40; i++) {
      if (v.readyState >= 2 && v.videoWidth > 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    patch({ camReady: v.readyState >= 2, camW: v.videoWidth, camH: v.videoHeight });
    (window as any).__poseVideoEl = v;

    // 3) Audio analyser
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      analyserRef.current = an;
    } catch {}

    // 4) MediaPipe
    patch({ mpStatus: 'loading' });
    try {
      const mod: any = await import('@mediapipe/tasks-vision');
      const base = (process.env as any)?.EXPO_PUBLIC_MEDIAPIPE_BASE
        ?? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision';
      const modelPath = (process.env as any)?.EXPO_PUBLIC_MEDIAPIPE_MODEL_URL
        ?? 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
      const vision = await mod.FilesetResolver.forVisionTasks(`${base}/wasm`);
      const make = (d: 'GPU' | 'CPU') => mod.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelPath, delegate: d },
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      let handle: any; let delegate: 'GPU' | 'CPU' = 'GPU';
      try { handle = await make('GPU'); }
      catch (e: any) {
        delegate = 'CPU';
        patch({ mpMsg: `GPU 실패 → CPU: ${e?.message ?? e}` });
        handle = await make('CPU');
      }
      mpRef.current = handle;
      patch({ mpStatus: 'ready', mpDelegate: delegate, mpMsg: '' });
    } catch (err: any) {
      patch({ mpStatus: 'err', mpMsg: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}` });
    }

    // 5) STT 지원 여부만 체크. 실제 listen() 은 별도 버튼(startStt)에서 호출 —
    //   FIX-STT-GESTURE (2026-04-22): Android Chrome 에서 webkitSpeechRecognition.start() 는
    //   반드시 user gesture 스택 내부에서 호출되어야 함 (getUserMedia 허용과는 별개 권한).
    //   이 async 함수 흐름(await getUserMedia → await MediaPipe 로드)이 끝난 뒤엔 이미
    //   gesture 스택 밖 → Chrome 이 조용히 'not-allowed' 로 거부.
    //   따라서 listen() 은 별도 버튼의 onPress(= fresh gesture)에서 호출해야 한다.
    const rec = getGlobalSpeechRecognizer();
    patch({ sttSupported: rec.isSupported() });

    // 6) Main loop — MediaPipe detect + HSS + audio RMS + STT diag
    fpsRef.current = { t: performance.now(), n: 0 };
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const vid = videoRef.current;
      const handle = mpRef.current;

      if (handle && vid && vid.readyState >= 2 && vid.videoWidth > 0) {
        try {
          const now = performance.now();
          const res = handle.detectForVideo(vid, now);
          fpsRef.current.n += 1;
          if (now - fpsRef.current.t >= 1000) {
            patch({ mpFps: fpsRef.current.n });
            fpsRef.current = { t: now, n: 0 };
          }
          if (res?.landmarks?.length > 0) {
            const bp = res.landmarks[0];
            // MediaPipe BlazePose 33 → MoveNet 17 remap (HSS 는 MoveNet 기준).
            const BP_TO_MN = [0,2,5,7,8,11,12,13,14,15,16,23,24,25,26,27,28];
            const mn = BP_TO_MN.map((i) => {
              const lm = bp[i] ?? { x: 0, y: 0, visibility: 0 };
              return { x: lm.x, y: lm.y, score: lm.visibility ?? 0, visibility: lm.visibility ?? 0 };
            });
            const visCount = mn.filter((p) => (p.visibility ?? 0) > 0.3).length;
            patch({
              lmVisCount: visCount,
              noseVis: bp[0]?.visibility ?? 0,
              lShVis: bp[11]?.visibility ?? 0,
              rShVis: bp[12]?.visibility ?? 0,
            });
            const up = hssRef.current.update(mn as any, now);
            patch({
              hssD: Number(up.d.toFixed(3)),
              hssD0: Number(up.d0.toFixed(3)),
              hssPhase: up.phase,
              hssMode: up.mode,
              hssCount: up.count,
              hssCal: up.calibration.state === 'pending'
                ? `calibrating ${Math.round(up.calibration.progress * 100)}%`
                : up.calibration.state === 'ready' ? 'ready'
                : `unstable σ=${(up.calibration.sigmaRatio * 100).toFixed(1)}% (너무 움직임 — 정지하거나 "건너뛰기" 버튼)`,
            });
          }
        } catch (e: any) {
          patch({ mpMsg: `detect 에러: ${e?.message ?? e}` });
        }
      }

      // Audio RMS
      const an = analyserRef.current;
      if (an) {
        const arr = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(arr);
        let sum = 0;
        for (const v of arr) sum += v;
        patch({ micRms: sum / arr.length / 255 });
      }

      // STT diag
      try {
        const rec2 = getGlobalSpeechRecognizer();
        const d = rec2.getDiagnostic();
        const curErr = rec2.lastError ?? '-';
        if (d.starts !== stRef.current.sttStarts || d.ends !== stRef.current.sttEnds ||
            d.results !== stRef.current.sttResults || d.retryCount !== stRef.current.sttRetry ||
            curErr !== stRef.current.sttLastError || d.listening !== stRef.current.sttListening) {
          patch({
            sttListening: d.listening,
            sttStarts: d.starts,
            sttEnds: d.ends,
            sttResults: d.results,
            sttRetry: d.retryCount,
            sttLastEvent: rec2.getLastEvent(),
            sttLastError: curErr,
            sttMsSince: d.msSinceLastResult,
          });
        }
      } catch {}
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const reset = () => {
    // 2-in-a-row 시뮬레이션: 전체 상태 해제 후 initState 로 복귀.
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (sttStopRef.current) { try { sttStopRef.current(); } catch {} sttStopRef.current = null; }
    try { disposeGlobalSpeechRecognizer(); } catch {}
    if (mpRef.current) { try { mpRef.current.close(); } catch {} mpRef.current = null; }
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    analyserRef.current = null;
    if (videoRef.current?.parentNode) videoRef.current.parentNode.removeChild(videoRef.current);
    videoRef.current = null;
    hssRef.current.reset();
    if (bgmAudioRef.current) { try { bgmAudioRef.current.pause(); } catch {} bgmAudioRef.current = null; }
    (window as any).__poseVideoEl = undefined;
    (window as any).__permissionStream = undefined;
    (window as any).__permissionGranted = false;
    setSt(initState());
  };

  const calibrateSkip = () => {
    hssRef.current.injectBaseline(0.15);
    patch({ hssCal: 'ready (skip, d0=0.15)', hssD0: 0.15 });
  };

  // FIX-STT-GESTURE (2026-04-22): 반드시 이 함수는 버튼 클릭 핸들러 안에서 호출 —
  //   user gesture 스택 안에서 rec.start() 되어야 Android Chrome 이 mic 허용.
  // FIX-STT-BTN (2026-04-22): lastEvent 에 즉시 'btn-pressed' 찍어서 버튼 tap 이
  //   실제로 핸들러 진입하는지 시각 확인. 진입 안 되면 Pressable/onPress 문제,
  //   진입했는데 rec.listen() 에서 에러면 engine/권한 문제.
  const startStt = () => {
    patch({ sttLastEvent: 'btn-pressed @ ' + new Date().toLocaleTimeString() });
    try {
      // FIX-STT-AUDIO-CONFLICT (2026-04-22): Android Chrome 에서 getUserMedia 가
      //   audio track 을 잡고 있으면 webkitSpeechRecognition 이 onresult 를 못 받음.
      //   STT 테스트 동안 audio track 만 잠시 stop (video 는 유지).
      const pre = streamRef.current ?? (window as any).__permissionStream;
      if (pre && typeof pre.getAudioTracks === 'function') {
        pre.getAudioTracks().forEach((t: MediaStreamTrack) => {
          try { t.stop(); } catch {}
          try { pre.removeTrack(t); } catch {}
        });
      }
      const rec = getGlobalSpeechRecognizer();
      if (!rec.isSupported()) {
        patch({ sttSupported: false, sttLastEvent: 'unsupported' });
        return;
      }
      if (sttStopRef.current) { try { sttStopRef.current(); } catch {} sttStopRef.current = null; }
      const stop = rec.listen(
        'ko',
        (interim) => patch({ sttInterim: interim }),
        (fin) => patch({ sttFinal: fin }),
        600_000,
      );
      sttStopRef.current = stop;
      patch({ sttSupported: true, sttLastEvent: 'listen() called OK (audio-track released)' });
    } catch (err: any) {
      patch({ sttLastEvent: 'btn-error: ' + (err?.message ?? String(err)) });
    }
  };

  const playBgm = (src: string) => {
    if (bgmAudioRef.current) { try { bgmAudioRef.current.pause(); } catch {} }
    const a = new Audio(src);
    a.volume = 0.7;
    bgmAudioRef.current = a;
    patch({ bgmNow: src.split('/').pop() ?? src, bgmErr: '' });
    a.play().catch((e) => patch({ bgmErr: `${e?.name ?? 'Error'}: ${e?.message ?? e}` }));
  };

  useEffect(() => {
    return () => { reset(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIX-STT-FIXED-OVERLAY (2026-04-22): ScrollView 안에서 Pressable/button 둘 다
  //   안 눌린다는 제보 → ScrollView 바깥 position:fixed DOM 에 버튼을 렌더. React
  //   Fragment 최상단에 둬서 RN-web ScrollView wrapper 의 event 가로채기를 우회.
  const FixedSttButton = Platform.OS === 'web' ? React.createElement('button', {
    key: 'stt-fixed-btn',
    onClick: startStt,
    onTouchEnd: (e: any) => { e.preventDefault?.(); e.stopPropagation?.(); startStt(); },
    style: {
      position: 'fixed',
      bottom: 16,
      left: 16,
      right: 16,
      zIndex: 99999,
      background: '#16a34a',
      color: '#fff',
      fontSize: 15,
      fontWeight: 800,
      padding: '18px 16px',
      border: '3px solid #fde047',
      borderRadius: 14,
      cursor: 'pointer',
      touchAction: 'manipulation',
      WebkitTapHighlightColor: 'rgba(253,224,71,0.5)',
      fontFamily: 'inherit',
      boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
    },
  }, '🎤 FIXED: 음성 인식 시작 (탭)') : null;

  // FIX-STT-PURE-ISOLATE (2026-04-22): 앱 코드 전체를 배제한 pure webkitSpeechRecognition
  //   테스트. getGlobalSpeechRecognizer / 오디오 트랙 / 전역 스트림 등 일체 미사용.
  //   버튼 탭하면 alert 로 onstart/onresult/onerror/onend 직접 표시 → 기기+브라우저
  //   레벨에서 STT 가 작동하는지 100% 격리 확인.
  const pureSttRun = (lang: string, continuous: boolean) => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { window.alert('PURE: webkitSpeechRecognition 없음'); return; }
    // FIX-PURE-AUDIO-RELEASE (2026-04-22): 허용 버튼이 먼저 눌려서 getUserMedia 가
    //   audio track 을 점유 중이면 webkitSpeechRecognition 이 silent fail.
    //   모든 __permissionStream / streamRef 의 audio track 을 stop.
    try {
      const pre = streamRef.current ?? (window as any).__permissionStream;
      if (pre && typeof pre.getAudioTracks === 'function') {
        pre.getAudioTracks().forEach((t: MediaStreamTrack) => {
          try { t.stop(); } catch {}
          try { pre.removeTrack(t); } catch {}
        });
      }
      // 혹시 이전 PURE 세션이 남아있으면 abort
      const prev = (window as any).__pureRec;
      if (prev) { try { prev.abort?.(); } catch {} try { prev.stop?.(); } catch {} }
    } catch {}
    try {
      const r = new SR();
      r.lang = lang;
      r.continuous = continuous;
      r.interimResults = true;
      r.maxAlternatives = 1;
      let gotResult = false;
      (window as any).__pureRec = r; // 디버그용 전역 노출
      r.onstart = () => window.alert(`PURE onstart (lang=${lang}, cont=${continuous})`);
      r.onresult = (e: any) => {
        gotResult = true;
        const t = e.results?.[e.results.length - 1]?.[0]?.transcript ?? '(empty)';
        window.alert('PURE onresult: ' + t);
      };
      r.onerror = (e: any) => window.alert('PURE onerror: ' + (e?.error ?? e));
      r.onend = () => window.alert(`PURE onend (${lang}), gotResult=${gotResult}`);
      r.start();
    } catch (err: any) {
      window.alert('PURE start threw: ' + (err?.message ?? String(err)));
    }
  };
  const pureSttKo  = () => pureSttRun('ko-KR', false);
  const pureSttEn  = () => pureSttRun('en-US', false);
  const pureSttCont = () => pureSttRun('ko-KR', true);

  // FIX-LOOPBACK-STT (2026-04-22): 핵심 실험.
  //   1) 3초 마이크 녹음 (MediaRecorder) — 사용자가 대본 말함
  //   2) 마이크 완전 해제 → 스피커로 방금 녹음본 재생 (최대 볼륨)
  //   3) 동시에 webkitSpeechRecognition 시작 — 스피커 → 마이크 루프백으로 SR 이 전사
  //   4) 전사 결과 alert 로 표시
  // 에코 캔슬러 가 스피커 되울림을 지우면 SR 이 무음 → 실패. 실기기에서 검증 필수.
  const loopbackSttTest = async () => {
    try {
      // 0) 기존 getUserMedia/SR 리소스 완전 정리
      const pre = streamRef.current ?? (window as any).__permissionStream;
      if (pre && typeof pre.getTracks === 'function') {
        pre.getTracks().forEach((t: MediaStreamTrack) => { try { t.stop(); } catch {} });
      }
      const prevRec = (window as any).__pureRec;
      if (prevRec) { try { prevRec.abort?.(); } catch {} try { prevRec.stop?.(); } catch {} }
      if (sttStopRef.current) { try { sttStopRef.current(); } catch {} sttStopRef.current = null; }

      // 1) 3초 녹음
      window.alert('[1/4] 3초간 "한국어 테스트 일 이 삼" 이라고 또렷하게 말하세요. 확인 누르면 녹음 시작.');
      const audioOnly = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as any,
      });
      const mimeCand = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''];
      let mime = '';
      for (const m of mimeCand) { if (!m || (window as any).MediaRecorder?.isTypeSupported?.(m)) { mime = m; break; } }
      const mr = new MediaRecorder(audioOnly, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e: any) => { if (e.data?.size > 0) chunks.push(e.data); };
      const recDone: Promise<Blob> = new Promise((resolve) => {
        mr.onstop = () => resolve(new Blob(chunks, { type: mime || 'audio/webm' }));
      });
      mr.start();
      await new Promise((r) => setTimeout(r, 3000));
      mr.stop();
      const blob = await recDone;
      audioOnly.getTracks().forEach((t) => { try { t.stop(); } catch {} });

      // 2) 마이크가 정말 해제됐는지 잠시 대기
      await new Promise((r) => setTimeout(r, 400));
      window.alert(`[2/4] 녹음 완료 (${(blob.size / 1024).toFixed(1)} KB). 확인 누르면 스피커로 재생 + SR 시작.`);

      // 3) Web Audio API 로 볼륨 5배 증폭 재생 + SR 동시 시작
      //    <audio>.volume 은 1.0 상한 → Google 앱 에코 캔슬러를 뚫기 어려움.
      //    AudioContext + GainNode 로 clip 감수하고 amplify.
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      const arrayBuf = await blob.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
      const gain = ctx.createGain();
      gain.gain.value = 5.0; // 5배 증폭 (클리핑 발생하지만 SR 감지율이 중요)
      gain.connect(ctx.destination);

      const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) { window.alert('SR 없음'); try { ctx.close(); } catch {} return; }
      const r = new SR();
      r.lang = 'ko-KR';
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 3; // 대안 늘림 — 왜곡된 신호에 가장 가까운 후보 선택 기회
      let transcript = '';
      let errLog = '';
      let eventLog = '';
      r.onstart = () => { eventLog += 'start '; };
      r.onresult = (e: any) => {
        eventLog += `res(${e.results.length}) `;
        let t = '';
        for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + ' ';
        transcript = t.trim();
      };
      r.onerror = (e: any) => { errLog += (e?.error ?? e) + ';'; eventLog += `err(${e?.error}) `; };
      r.onend = () => { eventLog += 'end '; };
      r.start();

      // SR 이 세션 열 시간 부여 (1초)
      await new Promise((r2) => setTimeout(r2, 1000));

      // 증폭된 오디오 재생
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(gain);
      src.start(0);
      const playDur = audioBuf.duration * 1000;

      // 재생 끝날 때까지 + 여유 1.5초
      await new Promise((r2) => setTimeout(r2, playDur + 1500));
      try { src.stop(); } catch {}
      try { r.stop(); } catch {}
      await new Promise((r2) => setTimeout(r2, 400));
      try { ctx.close(); } catch {}

      window.alert(`[3/4] 전사: "${transcript || '(empty)'}"\n이벤트: ${eventLog}${errLog ? '\n에러: ' + errLog : ''}`);

      // 4) 유사도 계산
      const { textSimilarity } = require('../../utils/speechUtils');
      const sim = textSimilarity('한국어 테스트 일 이 삼', transcript);
      window.alert(`[4/4] 유사도: ${(sim * 100).toFixed(1)}%  (성공 = 이 접근법이 작동)`);
    } catch (err: any) {
      window.alert('LOOPBACK 에러: ' + (err?.message ?? String(err)));
    }
  };
  // FIX-WHISPER-AB (2026-04-22): A/B 테스트 — Whisper (OSS, 클라이언트 WASM) vs 템플릿 전용.
  //   getUserMedia 로 3초 녹음 → Blob → @xenova/transformers Whisper-tiny (~75MB) 로컬 전사.
  //   네트워크 API 호출 없음 (법적 가드레일 §12 준수). 첫 실행시 모델 다운로드 시간 표시.
  //   성공시: Android Chrome 마이크 충돌 문제 완전 우회 (SR 미사용). 오프라인 동작.
  //   실패/느림시: 템플릿 전용 모드 (자막 미평가, 영상만 멋지게) 로 확정.
  const whisperTest = async () => {
    try {
      const pre = streamRef.current ?? (window as any).__permissionStream;
      if (pre && typeof pre.getTracks === 'function') {
        pre.getTracks().forEach((t: MediaStreamTrack) => { try { t.stop(); } catch {} });
      }
      await new Promise((r) => setTimeout(r, 200));

      // 1) Transformers.js 로드 (CDN, 영구 설치 X — A/B 결과 보고 결정)
      const w: any = window as any;
      if (!w.__xenovaPipeline) {
        window.alert('[1/5] Whisper 모델 첫 로드 시작 (~75MB, 1~3분 소요). 대역 확인 후 확인.');
        const t0 = performance.now();
        // Metro/Expo 번들러가 URL import 를 해석하려 드는 것을 막기 위해 Function 래퍼로 우회.
        const loader = new Function('return import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2")');
        const mod: any = await loader();
        const { pipeline, env } = mod;
        env.allowLocalModels = false;
        env.useBrowserCache = true; // IndexedDB 캐시 → 두 번째부터 즉시
        w.__xenovaPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
          quantized: true,
          progress_callback: (p: any) => {
            if (p.status === 'progress' && p.file) {
              // noop — alert 폭발 방지
            }
          },
        });
        const t1 = performance.now();
        window.alert(`[1/5] Whisper 로드 완료: ${((t1 - t0) / 1000).toFixed(1)}초`);
      } else {
        window.alert('[1/5] Whisper 이미 로드됨 (캐시 사용).');
      }
      const asr = w.__xenovaPipeline;

      // 2) 3초 녹음
      window.alert('[2/5] 3초간 "한국어 테스트 일 이 삼" 이라고 또렷하게 말하세요. 확인 누르면 녹음.');
      const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeCand = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''];
      let mime = '';
      for (const m of mimeCand) { if (!m || (window as any).MediaRecorder?.isTypeSupported?.(m)) { mime = m; break; } }
      const mr = new MediaRecorder(audioOnly, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e: any) => { if (e.data?.size > 0) chunks.push(e.data); };
      const recDone: Promise<Blob> = new Promise((resolve) => {
        mr.onstop = () => resolve(new Blob(chunks, { type: mime || 'audio/webm' }));
      });
      mr.start();
      await new Promise((r) => setTimeout(r, 3000));
      mr.stop();
      const blob = await recDone;
      audioOnly.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      window.alert(`[3/5] 녹음 완료 (${(blob.size / 1024).toFixed(1)} KB). 전사 시작.`);

      // 3) Blob → Float32Array 16kHz 변환 (Whisper 요구사항)
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC({ sampleRate: 16000 });
      const arrayBuf = await blob.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
      const f32 = audioBuf.numberOfChannels === 1
        ? audioBuf.getChannelData(0)
        : (() => {
            const a = audioBuf.getChannelData(0);
            const b = audioBuf.getChannelData(1);
            const out = new Float32Array(a.length);
            for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) * 0.5;
            return out;
          })();
      try { ctx.close(); } catch {}

      // 4) Whisper 전사
      const t2 = performance.now();
      const result: any = await asr(f32, { language: 'korean', task: 'transcribe' });
      const t3 = performance.now();
      const transcript = (result?.text ?? '').trim();
      window.alert(`[4/5] 전사 (${((t3 - t2) / 1000).toFixed(2)}초): "${transcript || '(empty)'}"`);

      // 5) 유사도
      const { textSimilarity } = require('../../utils/speechUtils');
      const sim = textSimilarity('한국어 테스트 일 이 삼', transcript);
      window.alert(`[5/5] 유사도: ${(sim * 100).toFixed(1)}%  · 전사지연 ${((t3 - t2) / 1000).toFixed(2)}s\n(80%+ & 지연 3s 이하 = Whisper 채택 가치 있음)`);
    } catch (err: any) {
      window.alert('WHISPER 에러: ' + (err?.message ?? String(err)));
    }
  };

  const mkPureBtn = (key: string, label: string, bg: string, border: string, bottom: number, handler: () => void) =>
    React.createElement('button', {
      key,
      onClick: handler,
      style: {
        position: 'fixed',
        bottom,
        left: 16,
        right: 16,
        zIndex: 99999,
        background: bg,
        color: '#fff',
        fontSize: 13,
        fontWeight: 800,
        padding: '12px 16px',
        border: `3px solid ${border}`,
        borderRadius: 14,
        cursor: 'pointer',
        touchAction: 'manipulation',
        fontFamily: 'inherit',
        boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
      },
    }, label);
  const PureSttButton = Platform.OS === 'web' ? mkPureBtn('stt-pure-ko',   '🧪 PURE KO (ko-KR, cont=false)',  '#ea580c', '#fdba74', 80,  pureSttKo)  : null;
  const PureSttButtonEn = Platform.OS === 'web' ? mkPureBtn('stt-pure-en', '🧪 PURE EN (en-US, cont=false)',  '#2563eb', '#93c5fd', 140, pureSttEn)  : null;
  const PureSttButtonCont = Platform.OS === 'web' ? mkPureBtn('stt-pure-cont','🧪 PURE KO-CONT (continuous)', '#7c3aed', '#c4b5fd', 200, pureSttCont): null;
  const LoopbackSttButton = Platform.OS === 'web' ? mkPureBtn('stt-loopback', '🔁 LOOPBACK: 녹음→스피커재생→SR전사 (핵심 실험)', '#be123c', '#fda4af', 260, loopbackSttTest) : null;
  const WhisperButton = Platform.OS === 'web' ? mkPureBtn('stt-whisper', '🎙 WHISPER A/B: 녹음 3초 → 로컬 전사 (OSS WASM)', '#0f766e', '#5eead4', 320, whisperTest) : null;

  return (
    <>
    {FixedSttButton}
    {PureSttButton}
    {PureSttButtonEn}
    {PureSttButtonCont}
    {LoopbackSttButton}
    {WhisperButton}
    <ScrollView style={s.root} contentContainerStyle={s.inner}>
      <Text style={s.title}>🩺 MotiQ 실기기 자가진단</Text>
      <Text style={s.sub}>아래 버튼 한 번 눌러서 1분 안에 1~8 항목 실제 동작 확인.</Text>
      {/* FIX-CACHE-VERIFY (2026-04-22): 사용자가 최신 빌드를 보고 있는지 확인하는 버전 스탬프.
          이 문자열이 화면에 뜨면 커밋 92fba7e 이후 빌드. 뜨지 않거나 다르면 아직 캐시. */}
      <Text style={s.version}>build: STT-whisper-ab-v12 · HSS-v2 · 2026-04-22</Text>

      {st.permStatus === 'idle' && (
        <Pressable style={s.btnHero} onPress={grantAndRun}>
          <Text style={s.btnHeroT}>▶ 카메라·마이크 허용하고 시작</Text>
        </Pressable>
      )}
      <View style={s.btnRow}>
        <Pressable style={s.btnMini} onPress={reset}>
          <Text style={s.btnMiniT}>♻ 리셋 (2회 연속 시뮬)</Text>
        </Pressable>
        <Pressable style={s.btnMini} onPress={calibrateSkip}>
          <Text style={s.btnMiniT}>⏭ 스쿼트 캘리브 건너뛰기</Text>
        </Pressable>
      </View>
      {/* FIX-STT-NATIVE-BTN (2026-04-22): RN-web Pressable.onPress 가 fire 되지
          않는다는 사용자 제보. Scroll ancestor 가 pointerEvents 를 가로채거나
          responder system 이 tap 을 consume 하는 것으로 추정. 순수 HTML <button>
          으로 교체해서 브라우저 기본 click 이벤트 직접 수신. */}
      {Platform.OS === 'web' ? (
        React.createElement('button', {
          onClick: startStt,
          onTouchEnd: (e: any) => { e.preventDefault?.(); startStt(); },
          style: {
            width: '100%',
            background: '#16a34a',
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            padding: '16px',
            border: '2px solid #22c55e',
            borderRadius: 12,
            marginBottom: 14,
            cursor: 'pointer',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'rgba(34,197,94,0.3)',
            fontFamily: 'inherit',
          },
        }, '🎤 음성 인식 시작 (반드시 이 버튼을 탭)')
      ) : (
        <Pressable style={s.sttBtn} onPress={startStt} accessibilityRole="button">
          <Text style={s.sttBtnT}>🎤 음성 인식 시작 (반드시 이 버튼을 탭)</Text>
        </Pressable>
      )}

      <Section title="0. 환경">
        <Row k="User Agent" v={st.ua} mono />
        <Row k="HTTPS (secure)" v={st.secure ? '✅' : '❌'} />
        <Row k="권한" v={st.permStatus + (st.permMsg ? ` — ${st.permMsg}` : '')} danger={st.permStatus === 'denied' || st.permStatus === 'err'} />
      </Section>

      <Section title="① 카메라">
        <Row k="ready" v={st.camReady ? '✅' : '⏳'} />
        <Row k="video W×H" v={`${st.camW}×${st.camH}`} />
        <Text style={s.hint}>우상단 녹색 박스에 실시간 프리뷰가 보여야 정상.</Text>
      </Section>

      <Section title="② 포즈 인식 (MediaPipe)">
        <Row k="상태" v={st.mpStatus} danger={st.mpStatus === 'err'} />
        <Row k="delegate" v={st.mpDelegate || '-'} />
        {!!st.mpMsg && <Row k="메시지" v={st.mpMsg} danger />}
        <Row k="탐지 FPS" v={`${st.mpFps} /s`} />
        <Row k="가시 랜드마크 (17중)" v={String(st.lmVisCount)} />
        <Row k="nose/lSh/rSh 가시도" v={`${st.noseVis.toFixed(2)} / ${st.lShVis.toFixed(2)} / ${st.rShVis.toFixed(2)}`} mono />
        <Text style={s.hint}>FPS가 10 이상, 랜드마크 10개 이상 보여야 정상. 가시도 0.3 이상이 HSS 게이트 통과.</Text>
      </Section>

      <Section title="③ 스쿼트 카운트 (HSS)">
        <Row k="캘리브" v={st.hssCal} />
        <Row k="d (현재)" v={String(st.hssD)} mono />
        <Row k="d0 (기준)" v={String(st.hssD0)} mono />
        <Row k="phase" v={st.hssPhase} />
        <Row k="mode" v={st.hssMode} />
        <Row k="count" v={String(st.hssCount)} accent />
        <Text style={s.hint}>정면을 응시한 채 3초 캘리브 → 천천히 앉았다 일어나면 count 증가. d 가 d0 보다 0.04 이상 작아져야 DOWN.</Text>
      </Section>

      <Section title="④ 음성 자막 (webkitSpeechRecognition)">
        <Row k="지원" v={st.sttSupported ? '✅' : '❌ iOS Safari 미지원'} />
        <Row k="listening" v={st.sttListening ? '🟢' : '⚪'} />
        <Row k="starts / ends / results" v={`${st.sttStarts} / ${st.sttEnds} / ${st.sttResults}`} mono />
        <Row k="retryCount" v={String(st.sttRetry)} />
        <Row k="lastEvent" v={st.sttLastEvent} mono />
        <Row k="lastError" v={st.sttLastError} mono />
        <Row k="msSinceLastResult" v={st.sttMsSince === null ? '-' : `${Math.round(st.sttMsSince)} ms`} />
        <Row k="interim" v={st.sttInterim || '-'} mono />
        <Row k="final" v={st.sttFinal || '-'} mono />
        <Text style={s.hint}>말하면 interim/final 에 즉시 글자가 찍혀야 정상. results=0 이면 한 번도 인식 못 한 것.</Text>
      </Section>

      <Section title="⑤ 마이크 레벨">
        <Row k="RMS" v={st.micRms.toFixed(3)} mono />
        <View style={s.meter}>
          <View style={[s.meterFill, { width: `${Math.min(100, st.micRms * 300)}%` }]} />
        </View>
      </Section>

      <Section title="⑥ BGM 파일 재생">
        <Row k="재생 중" v={st.bgmNow} mono />
        {!!st.bgmErr && <Row k="에러" v={st.bgmErr} danger />}
        <View style={s.bgmGrid}>
          {BGM_FILES.map((f) => (
            <Pressable key={f} style={s.bgmBtn} onPress={() => playBgm(f)}>
              <Text style={s.bgmBtnT}>{f.split('/').pop()}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={s.bgmStop} onPress={() => { bgmAudioRef.current?.pause(); patch({ bgmNow: '(정지)' }); }}>
          <Text style={s.bgmBtnT}>⏹ 정지</Text>
        </Pressable>
        <Text style={s.hint}>각 버튼 누르면 1~2초 안에 소리가 나야 정상. 에러 메시지가 뜨면 해당 파일이 없거나 코덱 미지원.</Text>
      </Section>

      <View style={{ height: 340 }} />
    </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionT}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ k, v, mono, danger, accent }: { k: string; v: string; mono?: boolean; danger?: boolean; accent?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={[s.rowV, mono ? s.mono : null, danger ? s.danger : null, accent ? s.accent : null]} selectable>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0d12' },
  inner: { padding: 16, paddingBottom: 48 },
  nonweb: { flex: 1, padding: 24, backgroundColor: '#0b0d12', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  sub: { color: '#aab', fontSize: 13, marginBottom: 4 },
  version: { color: '#7fe57a', fontSize: 11, marginBottom: 14, fontFamily: 'monospace' },
  p: { color: '#ccc', fontSize: 14, textAlign: 'center' },
  btnHero: { backgroundColor: '#FF2D95', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  btnHeroT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  btnRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  btnMini: { flex: 1, backgroundColor: '#232838', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  btnMiniT: { color: '#e8edf5', fontSize: 13, fontWeight: '600' },
  sttBtn: {
    width: '100%', backgroundColor: '#16a34a', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center',
    marginBottom: 14, borderWidth: 2, borderColor: '#22c55e',
    // @ts-ignore web-only cursor
    cursor: 'pointer',
  },
  sttBtnT: { color: '#fff', fontSize: 15, fontWeight: '800' },
  section: { backgroundColor: '#161a22', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#232838' },
  sectionT: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  rowK: { color: '#9aa4b2', width: 160, fontSize: 12 },
  rowV: { color: '#e8edf5', flex: 1, fontSize: 12 },
  mono: { fontFamily: Platform.OS === 'web' ? ('ui-monospace, Menlo, monospace' as any) : 'monospace' },
  danger: { color: '#ff5577' },
  accent: { color: '#4ade80', fontWeight: '800', fontSize: 18 },
  hint: { color: '#6b7280', fontSize: 11, marginTop: 6 },
  meter: { height: 10, backgroundColor: '#222', borderRadius: 6, overflow: 'hidden', marginTop: 4 },
  meterFill: { height: '100%', backgroundColor: '#4ade80' },
  bgmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  bgmBtn: { backgroundColor: '#2a3140', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, marginBottom: 4 },
  bgmBtnT: { color: '#cbd5e1', fontSize: 11 },
  bgmStop: { backgroundColor: '#7f1d1d', paddingVertical: 10, alignItems: 'center', borderRadius: 8, marginTop: 6 },
});
