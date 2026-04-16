/**
 * record/index.tsx
 *
 * 촬영 메인 화면 — 풀스크린 카메라 + 미션 카드 오버레이 + 가상 배경
 *
 * 레이아웃:
 *   ┌──────────────────────────────┐
 *   │  [풀스크린] VirtualBg + Camera │
 *   │    └ 상단 HUD (score, REC)    │
 *   │    └ 음성 자막 (voice_read)   │
 *   │    └ 카운트다운 오버레이       │
 *   │    └ AnimatedMissionCard (하단)│
 *   │    └ TimingBar               │
 *   │    └ JudgementBurst          │
 *   └──────────────────────────────┘
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import RecordingCamera, {
  type RecordingCameraHandle,
} from '../../../components/camera/RecordingCamera';
import TimingBar          from '../../../components/ui/TimingBar';
import VirtualBackgroundFrame from '../../../components/ui/VirtualBackgroundFrame';
import AnimatedMissionCard   from '../../../components/mission/AnimatedMissionCard';
import JudgementBurst        from '../../../components/mission/JudgementBurst';

import { usePoseDetection }          from '../../../hooks/usePoseDetection';
import { useJudgement, scoreToTag }  from '../../../hooks/useJudgement';
import { useRecording }              from '../../../hooks/useRecording';
import { useSessionStore }           from '../../../store/sessionStore';
import { playSound, initAudio, speakJudgement } from '../../../utils/soundUtils';
import type { JudgementTag } from '../../../types/session';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function RecordScreen() {
  const router    = useRouter();
  const cameraRef = useRef<RecordingCameraHandle>(null);

  const { activeTemplate } = useSessionStore();

  // Camera facing — selfie or environment
  const defaultFacing = activeTemplate?.camera_mode === 'selfie' ? 'front' : 'back';
  const [facing, setFacing] = useState<'front' | 'back'>(defaultFacing);

  const { isReady, landmarks, detect } = usePoseDetection();
  const { judge, voiceTranscript, resetVoice } = useJudgement();
  const {
    state, countdown, elapsed,
    videoUri, start, stop, reset,
  } = useRecording();

  // Judgement state
  const [currentScore,   setCurrentScore]   = useState(0);
  const [currentTag,     setCurrentTag]     = useState<JudgementTag>('fail');
  const [currentMission, setCurrentMission] = useState<ReturnType<typeof judge>['currentMission']>(null);

  // Burst effect state
  const [burstVisible, setBurstVisible] = useState(false);
  const [burstTag,     setBurstTag]     = useState<JudgementTag | null>(null);
  const [combo,        setCombo]        = useState(0);

  // Sound tracking refs
  const prevTagRef       = useRef<JudgementTag>('fail');
  const prevCountdownRef = useRef<number>(3);
  const comboRef         = useRef(0);
  const burstTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect if no template
  useEffect(() => {
    if (!activeTemplate) router.back();
  }, [activeTemplate]);

  // Reset voice on unmount
  useEffect(() => {
    return () => {
      resetVoice();
    };
  }, [resetVoice]);

  // Pose judgement loop
  useEffect(() => {
    if (state !== 'recording') return;
    const result = judge(landmarks.length > 0 ? landmarks : []);
    setCurrentScore(result.score);
    setCurrentTag(result.tag);
    setCurrentMission(result.currentMission);

    if (result.tag !== prevTagRef.current) {
      const prevTag = prevTagRef.current;
      prevTagRef.current = result.tag;

      // Sound
      if (result.tag === 'perfect') {
        playSound('perfect');
      } else if (result.tag === 'good') {
        playSound('good');
      } else {
        playSound('fail');
      }

      // Combo tracking
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
          // Lost combo
          playSound('oops');
          speakJudgement('fail');
        }
        comboRef.current = 0;
        setCombo(0);
      }

      // Burst (only on tag transitions to perfect or good)
      if (result.tag !== 'fail' || prevTag !== 'fail') {
        if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
        setBurstTag(result.tag);
        setBurstVisible(true);
        burstTimerRef.current = setTimeout(() => {
          setBurstVisible(false);
        }, 950);
      }
    }
  }, [landmarks, state, elapsed]);

  // Countdown tick sound
  useEffect(() => {
    if (state === 'countdown' && countdown !== prevCountdownRef.current) {
      prevCountdownRef.current = countdown;
      if (countdown > 0) playSound('tick');
      else playSound('countdown_end');
    }
  }, [state, countdown]);

  // Recording start sound
  useEffect(() => {
    if (state === 'recording') {
      playSound('start');
      comboRef.current = 0;
      setCombo(0);
    }
  }, [state]);

  // Navigate to result when done
  useEffect(() => {
    if (state === 'done' && videoUri) {
      resetVoice();
      router.push({
        pathname: '/(main)/result',
        params: { videoUri },
      });
    }
  }, [state, videoUri]);

  // Camera frame → pose detection
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
  const isPaused    = state === 'idle' || state === 'processing';

  const virtualBg = activeTemplate.virtual_bg;

  return (
    <SafeAreaView style={styles.root}>
      {/* ── 풀스크린 가상 배경 + 카메라 ──────── */}
      <VirtualBackgroundFrame bg={virtualBg} width={SCREEN_W} height={SCREEN_H}>

        <RecordingCamera
          ref={cameraRef}
          facing={facing}
          onFrame={handleFrame}
          paused={isPaused}
          onPermissionDenied={() => {
            Alert.alert('카메라 권한 필요', '설정에서 카메라 권한을 허용해주세요.');
            router.back();
          }}
        >

          {/* ── 상단 HUD ─────────────────────── */}
          {isRecording && (
            <View style={styles.topHud}>
              <View style={styles.recBadge}>
                <View style={styles.recDot} />
                <Text style={styles.recText}>REC</Text>
              </View>

              <View style={[styles.scoreBadge, { borderColor: currentTag === 'perfect' ? '#4caf50' : currentTag === 'good' ? '#ffc107' : '#ff6b6b' }]}>
                <Text style={[
                  styles.scoreText,
                  { color: currentTag === 'perfect' ? '#4caf50' : currentTag === 'good' ? '#ffc107' : '#ff6b6b' },
                ]}>
                  {Math.round(currentScore * 100)}
                </Text>
              </View>

              {combo >= 2 && (
                <View style={styles.comboBadge}>
                  <Text style={styles.comboText}>🔥 {combo}x</Text>
                </View>
              )}

              {/* 카메라 전환 버튼 */}
              <TouchableOpacity
                style={styles.flipBtn}
                onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
              >
                <Text style={styles.flipText}>🔄</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── 대기 중 템플릿 정보 ──────────── */}
          {!isRecording && !isCountdown && (
            <View style={styles.infoOverlay}>
              <Text style={styles.templateEmoji}>{activeTemplate.theme_emoji}</Text>
              <Text style={styles.templateName}>{activeTemplate.name}</Text>
              <Text style={styles.templateMeta}>
                {activeTemplate.duration_sec}초 · {activeTemplate.missions.length}개 미션 · BPM {activeTemplate.bpm}
              </Text>
              <Text style={styles.sceneText} numberOfLines={2}>
                {activeTemplate.scene}
              </Text>
              {activeTemplate.camera_mode === 'selfie' && (
                <Text style={styles.modeHint}>📱 셀카 모드 — 전면 카메라</Text>
              )}
              {!isReady && (
                <Text style={styles.loadingText}>포즈 AI 로딩 중...</Text>
              )}
            </View>
          )}

          {/* ── 음성 자막 (voice_read 미션 중) ── */}
          {isRecording && currentMission?.type === 'voice_read' && voiceTranscript !== '' && (
            <View style={styles.voiceSubtitleBox}>
              <Text style={styles.voiceSubtitleText}>{voiceTranscript}</Text>
            </View>
          )}

          {/* ── 카운트다운 오버레이 ───────────── */}
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

          {/* ── 미션 카드 (하단) ─────────────── */}
          {isRecording && (
            <AnimatedMissionCard
              mission={currentMission}
              elapsedMs={elapsed}
              score={currentScore}
              tag={currentTag}
            />
          )}

          {/* ── 타이밍바 (미션 카드 아래) ─────── */}
          {isRecording && (
            <View style={styles.timingBarWrapper}>
              <TimingBar template={activeTemplate} elapsedMs={elapsed} />
            </View>
          )}

          {/* ── 판정 버스트 효과 ─────────────── */}
          {isRecording && (
            <JudgementBurst tag={burstTag} combo={combo} visible={burstVisible} />
          )}

          {/* ── 정지 버튼 (녹화 중) ──────────── */}
          {isRecording && (
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={() => cameraRef.current && stop(cameraRef.current)}
            >
              <View style={styles.stopIcon} />
            </TouchableOpacity>
          )}

          {/* ── 시작 버튼 (대기 중) ──────────── */}
          {!isRecording && !isCountdown && (
            <View style={styles.startArea}>
              <TouchableOpacity
                style={[styles.startBtn, !isReady && styles.startBtnDisabled]}
                onPress={() => {
                  initAudio();
                  if (cameraRef.current) start(cameraRef.current);
                }}
                disabled={isCountdown || state === 'processing'}
              >
                <Text style={styles.startBtnText}>
                  ▶ 챌린지 시작
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <Text style={styles.backText}>취소</Text>
              </TouchableOpacity>
            </View>
          )}

        </RecordingCamera>
      </VirtualBackgroundFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0e17',
  },

  // ── 상단 HUD ──
  topHud: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e94560',
  },
  recText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  scoreBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1.5,
    borderColor: '#4caf50',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4caf50',
  },
  comboBadge: {
    backgroundColor: 'rgba(255,107,53,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  comboText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  flipBtn: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 6,
    borderRadius: 20,
  },
  flipText: {
    fontSize: 18,
  },

  // ── 대기 정보 오버레이 ──
  infoOverlay: {
    position: 'absolute',
    top: '25%',
    left: 20,
    right: 20,
    alignItems: 'center',
    gap: 6,
    zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    padding: 20,
  },
  templateEmoji: {
    fontSize: 48,
  },
  templateName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  templateMeta: {
    color: '#ccc',
    fontSize: 13,
  },
  sceneText: {
    color: '#aaa',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  modeHint: {
    color: '#7eb3ff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingText: {
    color: '#e94560',
    fontSize: 12,
    marginTop: 4,
  },

  // ── 음성 자막 ──
  voiceSubtitleBox: {
    position: 'absolute',
    top: '55%',
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    padding: 10,
    zIndex: 18,
    alignItems: 'center',
  },
  voiceSubtitleText: {
    color: '#ffe082',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── 카운트다운 ──
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  countdownSub: {
    color: '#ddd',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ── 타이밍바 래퍼 ──
  timingBarWrapper: {
    position: 'absolute',
    bottom: 72,
    left: 0,
    right: 0,
    zIndex: 9,
  },

  // ── 정지 버튼 ──
  stopBtn: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
  stopIcon: {
    width: 20,
    height: 20,
    backgroundColor: '#e94560',
    borderRadius: 3,
  },

  // ── 시작 버튼 영역 ──
  startArea: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 12,
    zIndex: 25,
  },
  startBtn: {
    backgroundColor: '#e94560',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  startBtnDisabled: {
    backgroundColor: '#555',
    shadowOpacity: 0,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  backBtn: {
    paddingVertical: 8,
  },
  backText: {
    color: '#aaa',
    fontSize: 14,
  },
});
