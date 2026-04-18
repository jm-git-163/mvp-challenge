/**
 * record/index.tsx
 *
 * 촬영 메인 화면 — 풀스크린 카메라 + 미션 카드 오버레이 + 가상 배경
 *
 * 레이아웃:
 *   root (flex:1, dark bg)
 *     └── SafeAreaView (flex:1)
 *           └── cameraContainer (flex:1)
 *                 └── VirtualBackgroundFrame (flex:1 — no width/height props)
 *                       └── RecordingCamera (flex:1)
 *                             ├── TOP HUD overlay (absolute top:12)
 *                             ├── info overlay (absolute center) — pre-recording
 *                             ├── voice subtitle (absolute ~52%)
 *                             ├── mission card (absolute bottom:100)
 *                             ├── TimingBar (absolute bottom:80)
 *                             ├── JudgementBurst (absolute fill)
 *                             ├── countdown overlay (absolute fill)
 *                             └── start/stop controls (absolute bottom)
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import RecordingCamera, {
  type RecordingCameraHandle,
} from '../../../components/camera/RecordingCamera';
import TimingBar from '../../../components/ui/TimingBar';
import VirtualBackgroundFrame from '../../../components/ui/VirtualBackgroundFrame';
import JudgementBurst from '../../../components/mission/JudgementBurst';

import { usePoseDetection } from '../../../hooks/usePoseDetection';
import { useJudgement } from '../../../hooks/useJudgement';
import { useRecording } from '../../../hooks/useRecording';
import { useSessionStore } from '../../../store/sessionStore';
import { playSound, initAudio, speakJudgement } from '../../../utils/soundUtils';
import { getTemplateByMissionId } from '../../../utils/videoTemplates';
import type { JudgementTag } from '../../../types/session';
import type { RecordedClip } from '../../../utils/videoCompositor';

/** Announce a mission text via SpeechSynthesis */
function speakMission(text: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 1.05;
    u.pitch = 1.1;
    u.volume = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const koVoice = voices.find((v) => v.lang.startsWith('ko'));
    if (koVoice) u.voice = koVoice;
    window.speechSynthesis.speak(u);
  } catch {
    // silently ignore
  }
}

export default function RecordScreen() {
  const router = useRouter();
  const cameraRef = useRef<RecordingCameraHandle>(null);

  const { activeTemplate } = useSessionStore();
  const defaultFacing = activeTemplate?.camera_mode === 'selfie' ? 'front' : 'back';
  const [facing, setFacing] = useState<'front' | 'back'>(defaultFacing);

  const { isReady, landmarks, detect } = usePoseDetection();
  const { judge, voiceTranscript, resetVoice } = useJudgement();
  const { state, countdown, elapsed, videoUri, start, stop } = useRecording();

  // Judgement state
  const [currentScore, setCurrentScore] = useState(0);
  const [currentTag, setCurrentTag] = useState<JudgementTag>('fail');
  const [currentMission, setCurrentMission] = useState<ReturnType<typeof judge>['currentMission']>(null);

  // Burst effect
  const [burstVisible, setBurstVisible] = useState(false);
  const [burstTag, setBurstTag] = useState<JudgementTag | null>(null);
  const [combo, setCombo] = useState(0);

  const prevTagRef = useRef<JudgementTag>('fail');
  const prevCountdownRef = useRef<number>(3);
  const comboRef = useRef(0);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMissionSeqRef = useRef<number | null>(null);

  // Redirect if no template
  useEffect(() => {
    if (!activeTemplate) router.back();
  }, [activeTemplate]);

  useEffect(() => { return () => { resetVoice(); }; }, [resetVoice]);

  // Pose judgement loop
  useEffect(() => {
    if (state !== 'recording') return;

    const result = judge(landmarks.length > 0 ? landmarks : []);
    setCurrentScore(result.score);
    setCurrentTag(result.tag);
    setCurrentMission(result.currentMission);

    // Announce each new mission
    if (result.currentMission && result.currentMission.seq !== prevMissionSeqRef.current) {
      prevMissionSeqRef.current = result.currentMission.seq;
      const m = result.currentMission;
      const text =
        m.type === 'voice_read' && m.read_text
          ? `따라 읽어주세요: ${m.read_text}`
          : m.guide_text ?? '';
      if (text) speakMission(text);
    }

    // Handle tag transitions
    if (result.tag !== prevTagRef.current) {
      const prevTag = prevTagRef.current;
      prevTagRef.current = result.tag;

      if (result.tag === 'perfect') {
        playSound('perfect');
      } else if (result.tag === 'good') {
        playSound('good');
      } else {
        playSound('fail');
      }

      if (result.tag !== 'fail') {
        comboRef.current += 1;
        setCombo(comboRef.current);
        if (comboRef.current >= 3) {
          playSound('combo');
          speakJudgement('combo');
        } else if (result.tag === 'perfect') {
          speakJudgement('perfect');
        } else {
          speakJudgement('good');
        }
      } else {
        if (comboRef.current >= 2) {
          playSound('oops');
          speakJudgement('fail');
        }
        comboRef.current = 0;
        setCombo(0);
      }

      if (result.tag !== 'fail' || prevTag !== 'fail') {
        if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
        setBurstTag(result.tag);
        setBurstVisible(true);
        burstTimerRef.current = setTimeout(() => { setBurstVisible(false); }, 950);
      }
    }
  }, [landmarks, state, elapsed]);

  // Countdown tick sounds
  useEffect(() => {
    if (state === 'countdown' && countdown !== prevCountdownRef.current) {
      prevCountdownRef.current = countdown;
      if (countdown > 0) playSound('tick');
      else playSound('countdown_end');
    }
  }, [state, countdown]);

  // Recording-start sound + reset combo
  useEffect(() => {
    if (state === 'recording') {
      playSound('start');
      comboRef.current = 0;
      setCombo(0);
      prevMissionSeqRef.current = null;
    }
  }, [state]);

  // Navigate to result when done
  useEffect(() => {
    if (state !== 'done' || !videoUri) return;
    resetVoice();

    if (!activeTemplate) {
      router.push({ pathname: '/(main)/result', params: { videoUri } });
      return;
    }

    const vt = getTemplateByMissionId(activeTemplate.genre);
    if (!vt || vt.clip_slots.length === 0) {
      router.push({ pathname: '/(main)/result', params: { videoUri } });
      return;
    }

    fetch(videoUri)
      .then((r) => r.blob())
      .then(() => {
        const clipsJson = JSON.stringify(
          vt.clip_slots.map((slot) => ({
            slot_id: slot.id,
            duration_ms: slot.end_ms - slot.start_ms,
          })),
        );
        router.push({
          pathname: '/(main)/result',
          params: { videoUri, videoTemplateId: vt.id, clipsJson },
        });
      })
      .catch(() => {
        router.push({ pathname: '/(main)/result', params: { videoUri } });
      });
  }, [state, videoUri]);

  // Camera frame handler → pose detection
  const handleFrame = useCallback(
    async (base64: string, w: number, h: number) => {
      if (state !== 'recording' || !isReady) return;
      await detect(base64, w, h);
    },
    [state, isReady, detect],
  );

  if (!activeTemplate) return null;

  const isCountdown = state === 'countdown';
  const isRecording = state === 'recording';
  const isIdle = state === 'idle';
  const virtualBg = activeTemplate.virtual_bg;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.cameraContainer}>
          {/* VirtualBackgroundFrame — no width/height props; uses flex:1 */}
          <VirtualBackgroundFrame bg={virtualBg}>
            <RecordingCamera
              ref={cameraRef}
              facing={facing}
              onFrame={handleFrame}
              paused={isIdle || state === 'processing'}
              onPermissionDenied={() => {
                Alert.alert('카메라 권한 필요', '설정에서 카메라 권한을 허용해주세요.');
                router.back();
              }}
            >
              {/* TOP HUD — visible during recording */}
              {isRecording && (
                <View style={styles.topHud}>
                  <View style={styles.recBadge}>
                    <View style={styles.recDot} />
                    <Text style={styles.recText}>REC</Text>
                  </View>

                  <View style={[styles.scoreBadge, {
                    borderColor:
                      currentTag === 'perfect' ? '#4caf50' :
                      currentTag === 'good' ? '#ffc107' : '#ff6b6b',
                  }]}>
                    <Text style={[styles.scoreText, {
                      color:
                        currentTag === 'perfect' ? '#4caf50' :
                        currentTag === 'good' ? '#ffc107' : '#ff6b6b',
                    }]}>
                      {Math.round(currentScore * 100)}
                    </Text>
                  </View>

                  {combo >= 2 && (
                    <View style={styles.comboBadge}>
                      <Text style={styles.comboText}>🔥 {combo}x</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.flipBtn}
                    onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.flipText}>🔄</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Pre-recording info overlay */}
              {isIdle && (
                <View style={styles.infoOverlay}>
                  <Text style={styles.templateEmoji}>{activeTemplate.theme_emoji}</Text>
                  <Text style={styles.templateName}>{activeTemplate.name}</Text>
                  <Text style={styles.templateMeta}>
                    {activeTemplate.duration_sec}초 · {activeTemplate.missions.length}개 미션 · BPM {activeTemplate.bpm}
                  </Text>
                  {activeTemplate.scene ? (
                    <Text style={styles.sceneText} numberOfLines={2}>
                      {activeTemplate.scene}
                    </Text>
                  ) : null}
                  {activeTemplate.camera_mode === 'selfie' && (
                    <Text style={styles.modeHint}>📱 셀카 모드 — 전면 카메라</Text>
                  )}
                  {!isReady && (
                    <Text style={styles.loadingText}>AI 분석 초기화 중...</Text>
                  )}
                  <TouchableOpacity
                    style={styles.flipBtnIdle}
                    onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
                  >
                    <Text style={styles.flipBtnIdleText}>
                      🔄 {facing === 'front' ? '후면으로 전환' : '전면으로 전환'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Voice subtitle box */}
              {isRecording && currentMission?.type === 'voice_read' && voiceTranscript !== '' && (
                <View style={styles.voiceSubBox}>
                  <Text style={styles.voiceSubText}>💬 {voiceTranscript}</Text>
                </View>
              )}

              {/* Countdown overlay */}
              {isCountdown && (
                <View style={styles.countdownOverlay}>
                  <Text style={styles.countdownNumber}>
                    {countdown > 0 ? countdown : 'GO!'}
                  </Text>
                  <Text style={styles.countdownSub}>
                    {activeTemplate.theme_emoji} {activeTemplate.name}
                  </Text>
                </View>
              )}

              {/* Mission card (bottom overlay) */}
              {isRecording && currentMission && (
                <View style={styles.missionCard}>
                  <Text style={styles.missionEmoji}>
                    {currentMission.gesture_emoji ?? (currentMission as any).guide_emoji ?? '🎯'}
                  </Text>
                  <View style={styles.missionTextBox}>
                    <Text style={styles.missionLabel}>
                      {currentMission.type === 'voice_read' ? '🎤 따라 읽기' :
                       currentMission.type === 'gesture' ? '🤲 제스처' :
                       currentMission.type === 'timing' ? '⏱ 유지하기' : '😊 표정'}
                    </Text>
                    <Text style={styles.missionText}>
                      {currentMission.type === 'voice_read' && currentMission.read_text
                        ? currentMission.read_text
                        : currentMission.guide_text ?? ''}
                    </Text>
                  </View>
                  <View style={[styles.missionScorePill, {
                    backgroundColor:
                      currentTag === 'perfect' ? '#4caf50' :
                      currentTag === 'good' ? '#ff9800' : '#555',
                  }]}>
                    <Text style={styles.missionScoreText}>
                      {currentTag === 'perfect' ? '👌' : currentTag === 'good' ? '👍' : '...'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Timing bar */}
              {isRecording && (
                <View style={styles.timingBarWrapper}>
                  <TimingBar template={activeTemplate} elapsedMs={elapsed} />
                </View>
              )}

              {/* Judgement burst */}
              {isRecording && (
                <JudgementBurst tag={burstTag} combo={combo} visible={burstVisible} />
              )}

              {/* Stop button */}
              {isRecording && (
                <View style={styles.stopBtnWrapper}>
                  <TouchableOpacity
                    style={styles.stopBtn}
                    onPress={() => cameraRef.current && stop(cameraRef.current)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <View style={styles.stopIcon} />
                  </TouchableOpacity>
                  <Text style={styles.stopHint}>탭하여 중지</Text>
                </View>
              )}

              {/* Start / cancel buttons */}
              {isIdle && (
                <View style={styles.startArea}>
                  <TouchableOpacity
                    style={[
                      styles.startBtn,
                      // @ts-ignore web gradient
                      { background: 'linear-gradient(135deg, #6C63FF, #9b59b6)' },
                      !isReady && styles.startBtnDisabled,
                    ]}
                    onPress={() => {
                      initAudio();
                      if (cameraRef.current) start(cameraRef.current);
                    }}
                    disabled={isCountdown}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.startBtnText}>▶ 챌린지 시작</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 30, right: 30 }}
                  >
                    <Text style={styles.backText}>취소</Text>
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
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  safeArea: { flex: 1 },
  cameraContainer: { flex: 1 },

  // TOP HUD
  topHud: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e94560' },
  recText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  scoreBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  scoreText: { fontSize: 16, fontWeight: '900' },
  comboBadge: {
    backgroundColor: 'rgba(255,107,53,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  comboText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  flipBtn: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipText: { fontSize: 18 },

  // PRE-RECORDING INFO
  infoOverlay: {
    position: 'absolute',
    top: '18%',
    left: 20,
    right: 20,
    alignItems: 'center',
    gap: 8,
    zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    padding: 24,
  },
  templateEmoji: { fontSize: 52 },
  templateName: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  templateMeta: { color: '#ccc', fontSize: 13 },
  sceneText: { color: '#aaa', fontSize: 12, fontStyle: 'italic', textAlign: 'center', lineHeight: 18 },
  modeHint: { color: '#7eb3ff', fontSize: 12, fontWeight: '600' },
  loadingText: { color: '#e94560', fontSize: 12, marginTop: 4 },
  flipBtnIdle: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    minHeight: 44,
    justifyContent: 'center',
  },
  flipBtnIdleText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // VOICE SUBTITLE
  voiceSubBox: {
    position: 'absolute',
    top: '52%',
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 12,
    padding: 12,
    zIndex: 18,
    alignItems: 'center',
  },
  voiceSubText: {
    color: '#ffe082',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },

  // COUNTDOWN
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.52)',
    zIndex: 30,
    gap: 12,
  },
  countdownNumber: {
    fontSize: 96,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: '#e94560',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  countdownSub: { color: '#ddd', fontSize: 16, fontWeight: '700', letterSpacing: 1 },

  // MISSION CARD (bottom overlay pill)
  missionCard: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 22,
  },
  missionEmoji: { fontSize: 28 },
  missionTextBox: { flex: 1, gap: 2 },
  missionLabel: { color: '#aaa', fontSize: 11, fontWeight: '700' },
  missionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  missionScorePill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionScoreText: { fontSize: 16 },

  // TIMING BAR
  timingBarWrapper: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    zIndex: 9,
  },

  // STOP BUTTON
  stopBtnWrapper: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 25,
  },
  stopBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: { width: 22, height: 22, backgroundColor: '#e94560', borderRadius: 4 },
  stopHint: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },

  // START / CANCEL
  startArea: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
    alignItems: 'center',
    gap: 12,
    zIndex: 25,
  },
  startBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 32,
    width: '100%',
    alignItems: 'center',
    minHeight: 56,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  startBtnDisabled: { backgroundColor: '#555', shadowOpacity: 0 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  backBtn: { paddingVertical: 10, paddingHorizontal: 24 },
  backText: { color: '#aaa', fontSize: 14 },
});
