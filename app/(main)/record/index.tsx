/**
 * record/index.tsx — 챌린지 촬영 화면
 *
 * 핵심 수정:
 *   - judge(landmarks, elapsed) — elapsed를 직접 전달 (timing drift 해결)
 *   - 미션 중앙 크게 표시 (64px 이모지, 26px 텍스트)
 *   - 캐릭터 이모지 반응 애니메이션
 *   - 퍼펙트 시 파티클 효과
 *   - 모바일/노트북 반응형
 *   - Mount cleanup useEffect — fixes challenge reset bug
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import RecordingCamera, { type RecordingCameraHandle } from '../../../components/camera/RecordingCamera';
import TimingBar              from '../../../components/ui/TimingBar';
import VirtualBackgroundFrame from '../../../components/ui/VirtualBackgroundFrame';
import JudgementBurst         from '../../../components/mission/JudgementBurst';

import { usePoseDetection }          from '../../../hooks/usePoseDetection';
import { useJudgement }              from '../../../hooks/useJudgement';
import { useRecording }              from '../../../hooks/useRecording';
import { useSessionStore }           from '../../../store/sessionStore';
import { playSound, initAudio, speakJudgement } from '../../../utils/soundUtils';
import { getTemplateByMissionId }    from '../../../utils/videoTemplates';
import type { JudgementTag }         from '../../../types/session';
import type { RecordedClip }         from '../../../utils/videoCompositor';

// Speak mission text via TTS
function speakMission(text: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1.05; u.pitch = 1.1; u.volume = 0.9;
    const koVoice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('ko'));
    if (koVoice) u.voice = koVoice;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

// Animated character states
const CHAR = {
  idle:    { emoji: '🎬', color: '#7c3aed' },
  perfect: { emoji: '🌟', color: '#f59e0b' },
  good:    { emoji: '😄', color: '#22c55e' },
  fail:    { emoji: '💪', color: '#94a3b8' },
};

// Particle emojis for PERFECT
const PARTICLE_EMOJIS = ['⭐', '✨', '🎉', '💫', '🌟', '🎊', '🔥', '💥'];

interface Particle { id: number; emoji: string; left: string; }

export default function RecordScreen() {
  const router    = useRouter();
  const cameraRef = useRef<RecordingCameraHandle>(null);
  const { width: W } = Dimensions.get('window');

  const { activeTemplate } = useSessionStore();
  const defaultFacing = activeTemplate?.camera_mode === 'selfie' ? 'front' : 'back';
  const [facing, setFacing] = useState<'front' | 'back'>(defaultFacing);

  const { isReady, landmarks } = usePoseDetection();
  const { judge, voiceTranscript, resetVoice } = useJudgement();
  const { state, countdown, elapsed, videoUri, start, stop } = useRecording();

  // Judgement state
  const [currentScore,   setCurrentScore]   = useState(0);
  const [currentTag,     setCurrentTag]     = useState<JudgementTag>('fail');
  const [currentMission, setCurrentMission] = useState<any>(null);

  // Visual effects state
  const [burstVisible, setBurstVisible] = useState(false);
  const [burstTag,     setBurstTag]     = useState<JudgementTag | null>(null);
  const [combo,        setCombo]        = useState(0);
  const [particles,    setParticles]    = useState<Particle[]>([]);
  const [charState,    setCharState]    = useState<keyof typeof CHAR>('idle');

  // Animated values
  const charScale   = useRef(new Animated.Value(1)).current;
  const missionAnim = useRef(new Animated.Value(0)).current;

  const prevTagRef        = useRef<JudgementTag>('fail');
  const prevCountdownRef  = useRef<number>(3);
  const comboRef          = useRef(0);
  const burstTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMissionSeqRef = useRef<number | null>(null);

  // Clean state on every mount — fixes challenge reset bug
  useEffect(() => {
    resetVoice();
    comboRef.current = 0;
    setCombo(0);
    prevMissionSeqRef.current = null;
    prevTagRef.current = 'fail';
    setCharState('idle');
    setCurrentScore(0);
    setCurrentTag('fail');
    setCurrentMission(null);
    setParticles([]);
    setBurstVisible(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!activeTemplate) router.back(); }, [activeTemplate]);
  useEffect(() => () => { resetVoice(); }, [resetVoice]);

  // Animate character bounce
  const bounceChar = useCallback(() => {
    Animated.sequence([
      Animated.spring(charScale, { toValue: 1.4, useNativeDriver: true }),
      Animated.spring(charScale, { toValue: 1.0, useNativeDriver: true }),
    ]).start();
  }, [charScale]);

  // Add particles for PERFECT
  const addParticles = useCallback(() => {
    const pts: Particle[] = Array.from({ length: 10 }, (_, i) => ({
      id: Date.now() + i,
      emoji: PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)],
      left: `${5 + Math.random() * 90}%`,
    }));
    setParticles(pts);
    setTimeout(() => setParticles([]), 1800);
  }, []);

  // Mission changed animation
  const animateMissionIn = useCallback(() => {
    missionAnim.setValue(0);
    Animated.spring(missionAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  }, [missionAnim]);

  // ── Core judgement loop (runs when elapsed or landmarks change) ─────
  useEffect(() => {
    if (state !== 'recording') return;

    // KEY FIX: pass elapsed directly from useRecording
    const result = judge(landmarks, elapsed);
    setCurrentScore(result.score);
    setCurrentTag(result.tag);
    setCurrentMission(result.currentMission);

    // Announce new missions
    if (result.currentMission && result.currentMission.seq !== prevMissionSeqRef.current) {
      prevMissionSeqRef.current = result.currentMission.seq;
      animateMissionIn();
      const m = result.currentMission;
      const text = m.type === 'voice_read' && m.read_text
        ? `따라 읽어주세요: ${m.read_text}`
        : m.guide_text ?? '';
      if (text) speakMission(text);
    }

    // Tag transition effects
    if (result.tag !== prevTagRef.current) {
      const prev = prevTagRef.current;
      prevTagRef.current = result.tag;

      if (result.tag === 'perfect') {
        playSound('perfect');
        setCharState('perfect');
        addParticles();
        bounceChar();
        comboRef.current += 1;
        setCombo(comboRef.current);
        if (comboRef.current >= 3) { playSound('combo'); speakJudgement('combo'); }
        else speakJudgement('perfect');
      } else if (result.tag === 'good') {
        playSound('good');
        setCharState('good');
        bounceChar();
        comboRef.current += 1;
        setCombo(comboRef.current);
        speakJudgement('good');
      } else {
        if (comboRef.current >= 2) { playSound('oops'); speakJudgement('fail'); }
        comboRef.current = 0;
        setCombo(0);
        setCharState('fail');
      }

      if (result.tag !== 'fail' || prev !== 'fail') {
        if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
        setBurstTag(result.tag);
        setBurstVisible(true);
        burstTimerRef.current = setTimeout(() => setBurstVisible(false), 950);
      }
    }
  }, [landmarks, state, elapsed]);

  // Countdown sounds
  useEffect(() => {
    if (state === 'countdown' && countdown !== prevCountdownRef.current) {
      prevCountdownRef.current = countdown;
      if (countdown > 0) playSound('tick'); else playSound('countdown_end');
    }
  }, [state, countdown]);

  // Recording start
  useEffect(() => {
    if (state === 'recording') {
      playSound('start');
      setCharState('idle');
      comboRef.current = 0;
      setCombo(0);
      prevMissionSeqRef.current = null;
    }
  }, [state]);

  // Navigate to result
  useEffect(() => {
    if (state !== 'done' || !videoUri) return;
    resetVoice();
    if (!activeTemplate) { router.push({ pathname: '/(main)/result', params: { videoUri } }); return; }

    const vt = getTemplateByMissionId(activeTemplate.genre);
    if (!vt) { router.push({ pathname: '/(main)/result', params: { videoUri } }); return; }

    fetch(videoUri).then(r => r.blob()).then(() => {
      const clipsJson = JSON.stringify(vt.clip_slots.map(s => ({ slot_id: s.id, duration_ms: s.end_ms - s.start_ms })));
      router.push({ pathname: '/(main)/result', params: { videoUri, videoTemplateId: vt.id, clipsJson } });
    }).catch(() => { router.push({ pathname: '/(main)/result', params: { videoUri } }); });
  }, [state, videoUri]);

  const handleFrame = useCallback(async (_b64: string, _w: number, _h: number) => {
    // frame detection handled by usePoseDetection hook itself
  }, []);

  if (!activeTemplate) return null;

  const isCountdown = state === 'countdown';
  const isRecording = state === 'recording';
  const isIdle      = state === 'idle';
  const virtualBg   = activeTemplate.virtual_bg;

  // Mission progress (0→1 within mission window)
  const missionProg = currentMission
    ? Math.min(1, Math.max(0, (elapsed - currentMission.start_ms) / Math.max(1, currentMission.end_ms - currentMission.start_ms)))
    : 0;

  const tagColor = currentTag === 'perfect' ? '#22c55e' : currentTag === 'good' ? '#f59e0b' : 'rgba(255,255,255,0.2)';
  const char = CHAR[charState];
  const maxW = Math.min(W - 32, 520); // responsive max width

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.cameraContainer}>
          <VirtualBackgroundFrame bg={virtualBg}>
            <RecordingCamera
              ref={cameraRef}
              facing={facing}
              onFrame={handleFrame}
              paused={isIdle || state === 'processing'}
              onPermissionDenied={() => { Alert.alert('카메라 권한 필요', '브라우저에서 카메라를 허용해주세요.'); router.back(); }}
            >

              {/* ── TOP HUD ─────────────────────────── */}
              {isRecording && (
                <View style={styles.topHud}>
                  <View style={styles.recBadge}>
                    <View style={styles.recDot} />
                    <Text style={styles.recText}>REC</Text>
                  </View>
                  <View style={[styles.scorePill, { borderColor: tagColor }]}>
                    <Text style={[styles.scoreText, { color: tagColor }]}>{Math.round(currentScore * 100)}</Text>
                  </View>
                  {combo >= 2 && (
                    <View style={styles.comboPill}>
                      <Text style={styles.comboText}>🔥 {combo}x COMBO</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.flipBtn}
                    onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.flipText}>🔄</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── PARTICLES ─────────────────────── */}
              {particles.map(p => (
                <Text key={p.id} style={[styles.particle, { left: p.left as any }]}>{p.emoji}</Text>
              ))}

              {/* ── CHARACTER ─────────────────────── */}
              {isRecording && (
                <View style={[styles.charArea, { maxWidth: maxW }]}>
                  <Animated.View style={[styles.charBubble, { backgroundColor: char.color + '33', transform: [{ scale: charScale }] }]}>
                    <Text style={styles.charEmoji}>{char.emoji}</Text>
                  </Animated.View>
                </View>
              )}

              {/* ── MISSION CARD ──────────────────── */}
              {isRecording && currentMission && (
                <Animated.View
                  style={[
                    styles.missionOverlay,
                    {
                      maxWidth: maxW,
                      opacity: missionAnim,
                      transform: [{ scale: missionAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
                    },
                  ]}
                >
                  {/* Type tag */}
                  <View style={styles.missionTypeTag}>
                    <Text style={styles.missionTypeText}>
                      {currentMission.type === 'voice_read' ? '🎤 따라 읽기' :
                       currentMission.type === 'gesture'    ? '🤲 제스처' :
                       currentMission.type === 'timing'     ? '⏱ 유지하기' : '😊 표정'}
                    </Text>
                  </View>

                  {/* Big emoji */}
                  <Text style={styles.missionBigEmoji}>
                    {currentMission.gesture_emoji ?? currentMission.guide_emoji ?? '🎯'}
                  </Text>

                  {/* Mission text */}
                  <Text style={styles.missionMainText}>
                    {currentMission.type === 'voice_read' && currentMission.read_text
                      ? currentMission.read_text
                      : currentMission.guide_text ?? ''}
                  </Text>

                  {/* Progress bar */}
                  <View style={styles.missionProgBg}>
                    <View style={[styles.missionProgFill, { width: `${missionProg * 100}%` as any, backgroundColor: tagColor }]} />
                  </View>

                  {/* Score status */}
                  <View style={[styles.missionStatusPill, { backgroundColor: tagColor }]}>
                    <Text style={styles.missionStatusText}>
                      {currentTag === 'perfect' ? '🌟 PERFECT!' : currentTag === 'good' ? '👍 GOOD!' : '⏳ 도전 중...'}
                    </Text>
                  </View>
                </Animated.View>
              )}

              {/* ── VOICE SUBTITLE ────────────────── */}
              {isRecording && currentMission?.type === 'voice_read' && voiceTranscript !== '' && (
                <View style={[styles.voiceSubBox, { maxWidth: maxW }]}>
                  <Text style={styles.voiceSubText}>💬 "{voiceTranscript}"</Text>
                </View>
              )}

              {/* ── PRE-RECORD INFO ───────────────── */}
              {isIdle && (
                <View style={[styles.infoOverlay, { maxWidth: maxW }]}>
                  <Text style={styles.infoEmoji}>{activeTemplate.theme_emoji}</Text>
                  <Text style={styles.infoTitle}>{activeTemplate.name}</Text>
                  <Text style={styles.infoMeta}>{activeTemplate.duration_sec}초 · {activeTemplate.missions.length}개 미션</Text>
                  {activeTemplate.scene ? <Text style={styles.infoScene} numberOfLines={3}>{activeTemplate.scene}</Text> : null}
                  {activeTemplate.camera_mode === 'selfie' && <Text style={styles.selfieHint}>📱 전면 카메라 모드</Text>}
                  <TouchableOpacity
                    style={styles.flipBtnIdle}
                    onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}
                  >
                    <Text style={styles.flipBtnIdleText}>🔄 {facing === 'front' ? '후면으로' : '전면으로'} 전환</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── COUNTDOWN ─────────────────────── */}
              {isCountdown && (
                <View style={styles.countdownOverlay}>
                  <Text style={styles.countdownNumber}>{countdown > 0 ? countdown : 'GO!'}</Text>
                  <Text style={styles.countdownSub}>{activeTemplate.theme_emoji} {activeTemplate.name}</Text>
                </View>
              )}

              {/* ── TIMING BAR ────────────────────── */}
              {isRecording && (
                <View style={styles.timingBarWrap}>
                  <TimingBar template={activeTemplate} elapsedMs={elapsed} />
                </View>
              )}

              {/* ── JUDGEMENT BURST ───────────────── */}
              {isRecording && <JudgementBurst tag={burstTag} combo={combo} visible={burstVisible} />}

              {/* ── STOP BUTTON ───────────────────── */}
              {isRecording && (
                <View style={styles.stopArea}>
                  <TouchableOpacity
                    style={styles.stopBtn}
                    onPress={() => cameraRef.current && stop(cameraRef.current)}
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  >
                    <View style={styles.stopIcon} />
                  </TouchableOpacity>
                  <Text style={styles.stopHint}>탭하여 중지</Text>
                </View>
              )}

              {/* ── START / CANCEL ────────────────── */}
              {isIdle && (
                <View style={[styles.startArea, { maxWidth: maxW }]}>
                  <TouchableOpacity
                    style={styles.startBtn}
                    onPress={() => { initAudio(); if (cameraRef.current) start(cameraRef.current); }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.startBtnText}>▶ 챌린지 시작</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => router.back()}
                    hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
                  >
                    <Text style={styles.cancelText}>← 취소</Text>
                  </TouchableOpacity>
                </View>
              )}

            </RecordingCamera>
          </VirtualBackgroundFrame>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  safeArea: { flex: 1 },
  cameraContainer: { flex: 1 },

  // TOP HUD
  topHud: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 30,
  },
  recBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  recText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  scorePill: {
    backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1.5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  scoreText: { fontSize: 16, fontWeight: '900' },
  comboPill: {
    backgroundColor: 'rgba(239,68,68,0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  comboText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  flipBtn: {
    marginLeft: 'auto', width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  flipText: { fontSize: 18 },

  // PARTICLES
  particle: { position: 'absolute', top: '15%', fontSize: 28, zIndex: 50 },

  // CHARACTER
  charArea: {
    position: 'absolute', top: 56, alignSelf: 'center',
    width: '100%', alignItems: 'center', zIndex: 20,
  },
  charBubble: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
  },
  charEmoji: { fontSize: 40 },

  // MISSION CARD
  missionOverlay: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
    width: '92%',
    zIndex: 22,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  missionTypeTag: {
    backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
  },
  missionTypeText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
  missionBigEmoji: { fontSize: 72, lineHeight: 82 },
  missionMainText: {
    color: '#ffffff', fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 32, paddingHorizontal: 8,
  },
  missionProgBg: {
    width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden',
  },
  missionProgFill: { height: '100%', borderRadius: 3 },
  missionStatusPill: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20 },
  missionStatusText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // VOICE SUBTITLE
  voiceSubBox: {
    position: 'absolute', top: '65%', alignSelf: 'center', width: '88%',
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 14, padding: 14, zIndex: 22, alignItems: 'center',
  },
  voiceSubText: { color: '#fde68a', fontSize: 16, fontWeight: '600', textAlign: 'center' },

  // PRE-RECORD INFO
  infoOverlay: {
    position: 'absolute', top: '20%', alignSelf: 'center', width: '88%',
    backgroundColor: 'rgba(0,0,0,0.82)', borderRadius: 24, padding: 24, alignItems: 'center', gap: 10, zIndex: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  infoEmoji: { fontSize: 56 },
  infoTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  infoMeta: { color: '#9ca3af', fontSize: 13 },
  infoScene: { color: '#d1d5db', fontSize: 13, textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },
  selfieHint: { color: '#818cf8', fontSize: 12, fontWeight: '600' },
  flipBtnIdle: {
    marginTop: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', minHeight: 44, justifyContent: 'center',
  },
  flipBtnIdleText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // COUNTDOWN
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40, gap: 16,
  },
  countdownNumber: {
    fontSize: 112, fontWeight: '900', color: '#fff',
    textShadowColor: '#7c3aed', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 30,
  },
  countdownSub: { color: '#e2e8f0', fontSize: 18, fontWeight: '700', letterSpacing: 1 },

  // TIMING BAR
  timingBarWrap: { position: 'absolute', bottom: 90, left: 0, right: 0, zIndex: 10 },

  // STOP BUTTON
  stopArea: {
    position: 'absolute', bottom: 20, alignSelf: 'center', alignItems: 'center', gap: 8, zIndex: 35,
  },
  stopBtn: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  stopIcon: { width: 24, height: 24, backgroundColor: '#ef4444', borderRadius: 5 },
  stopHint: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },

  // START / CANCEL
  startArea: {
    position: 'absolute', bottom: 28, alignSelf: 'center', width: '88%', alignItems: 'center', gap: 14, zIndex: 35,
  },
  startBtn: {
    width: '100%', paddingVertical: 18, borderRadius: 28, alignItems: 'center', minHeight: 60,
    backgroundColor: '#7c3aed',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },
  startBtnText: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  cancelBtn: { paddingVertical: 10 },
  cancelText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
});
