/**
 * record/index.tsx
 *
 * 촬영 메인 화면 — Sprint 1-2 + 1-3 통합
 *
 * 레이아웃:
 *   ┌─────────────────────────┐
 *   │  [상단 20%] 판정 / 점수  │  JudgementFeedback
 *   ├─────────────────────────┤
 *   │                         │
 *   │  [중앙 60%] 카메라       │  RecordingCamera
 *   │            + 포즈 오버레이│  PoseOverlay
 *   │                         │
 *   ├─────────────────────────┤
 *   │  [하단 20%] 타이밍바     │  TimingBar
 *   │             + 버튼       │
 *   └─────────────────────────┘
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
} from 'react-native';
import { useRouter } from 'expo-router';

import RecordingCamera, {
  type RecordingCameraHandle,
} from '../../../components/camera/RecordingCamera';
import PoseOverlay      from '../../../components/overlay/PoseOverlay';
import JudgementFeedback from '../../../components/ui/JudgementFeedback';
import TimingBar         from '../../../components/ui/TimingBar';

import { usePoseDetection }  from '../../../hooks/usePoseDetection';
import { useJudgement }      from '../../../hooks/useJudgement';
import { useRecording }      from '../../../hooks/useRecording';
import { useSessionStore }   from '../../../store/sessionStore';

const { height: SCREEN_H } = Dimensions.get('window');

const TOP_HEIGHT    = SCREEN_H * 0.18;
const CAMERA_HEIGHT = SCREEN_H * 0.62;
const BOTTOM_HEIGHT = SCREEN_H * 0.20;

export default function RecordScreen() {
  const router         = useRouter();
  const cameraRef      = useRef<RecordingCameraHandle>(null);
  const { activeTemplate, frameTags } = useSessionStore();

  // ── 훅 연결 ──────────────────────────────────
  const { isReady, landmarks, detect }  = usePoseDetection();
  const { judge }                        = useJudgement();
  const {
    state, countdown, elapsed,
    videoUri, start, stop, reset,
  } = useRecording();

  // 판정 결과 상태
  const [judgement, setJudgement] = useState<{
    score: number;
    tag: 'perfect' | 'good' | 'fail';
    currentMission: ReturnType<typeof judge>['currentMission'];
  }>({ score: 0, tag: 'fail', currentMission: null });

  // ── 템플릿 없으면 뒤로 ──────────────────────
  useEffect(() => {
    if (!activeTemplate) router.back();
  }, [activeTemplate]);

  // ── 포즈 판정 (랜드마크 변경마다) ──────────
  useEffect(() => {
    if (state !== 'recording' || !landmarks.length) return;
    const result = judge(landmarks);
    setJudgement(result);
  }, [landmarks, state]);

  // ── 카메라 프레임 → 포즈 추정 ───────────────
  const handleFrame = useCallback(
    async (base64: string, w: number, h: number) => {
      if (state !== 'recording' || !isReady) return;
      await detect(base64, w, h);
    },
    [state, isReady, detect]
  );

  // ── 녹화 완료 → 결과 화면 이동 ─────────────
  useEffect(() => {
    if (state === 'done' && videoUri) {
      router.push({
        pathname: '/(main)/result',
        params: { videoUri },
      });
    }
  }, [state, videoUri]);

  if (!activeTemplate) return null;

  const isCountdown  = state === 'countdown';
  const isRecording  = state === 'recording';
  const isPaused     = state === 'idle' || state === 'processing';

  // 현재 목표 관절 (현재 미션 기준)
  const targetJoints = judgement.currentMission?.target_joints;

  return (
    <SafeAreaView style={styles.root}>

      {/* ── 상단: 판정 영역 ─────────────────── */}
      <View style={[styles.topSection, { height: TOP_HEIGHT }]}>
        {isRecording ? (
          <JudgementFeedback
            score={judgement.score}
            tag={judgement.tag}
            currentMission={judgement.currentMission}
            elapsed={elapsed}
          />
        ) : (
          <View style={styles.titleArea}>
            <Text style={styles.templateName} numberOfLines={1}>
              {activeTemplate.name}
            </Text>
            <Text style={styles.templateMeta}>
              {activeTemplate.duration_sec}초 · {activeTemplate.missions.length}개 미션 · BPM {activeTemplate.bpm}
            </Text>
            {!isReady && (
              <Text style={styles.loadingText}>포즈 AI 로딩 중...</Text>
            )}
          </View>
        )}
      </View>

      {/* ── 중앙: 카메라 + 오버레이 ─────────── */}
      <View style={[styles.cameraSection, { height: CAMERA_HEIGHT }]}>
        <RecordingCamera
          ref={cameraRef}
          onFrame={handleFrame}
          paused={isPaused}
          onPermissionDenied={() => {
            Alert.alert('카메라 권한 필요', '설정에서 카메라 권한을 허용해주세요.');
            router.back();
          }}
        >
          {/* 포즈 오버레이 */}
          <PoseOverlay
            userPose={landmarks}
            targetJoints={targetJoints}
            width={Dimensions.get('window').width}
            height={CAMERA_HEIGHT}
          />

          {/* 카운트다운 오버레이 */}
          {isCountdown && (
            <View style={styles.countdownOverlay}>
              <Text style={styles.countdownNumber}>
                {countdown > 0 ? countdown : 'GO!'}
              </Text>
            </View>
          )}

          {/* 녹화 중 REC 표시 */}
          {isRecording && (
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>REC</Text>
            </View>
          )}
        </RecordingCamera>
      </View>

      {/* ── 하단: 타이밍바 + 버튼 ───────────── */}
      <View style={[styles.bottomSection, { height: BOTTOM_HEIGHT }]}>
        {isRecording ? (
          <>
            <TimingBar template={activeTemplate} elapsedMs={elapsed} />
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={() => cameraRef.current && stop(cameraRef.current)}
            >
              <View style={styles.stopIcon} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.startArea}>
            <TouchableOpacity
              style={[styles.startBtn, !isReady && styles.startBtnDisabled]}
              onPress={() => cameraRef.current && start(cameraRef.current)}
              disabled={isCountdown || state === 'processing'}
            >
              <Text style={styles.startBtnText}>
                {isCountdown ? `${countdown}...` : '▶ 챌린지 시작'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backText}>취소</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0e17',
  },
  // ── 상단 ──
  topSection: {
    justifyContent: 'center',
  },
  titleArea: {
    paddingHorizontal: 16,
    gap: 4,
  },
  templateName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  templateMeta: {
    color: '#aaa',
    fontSize: 13,
  },
  loadingText: {
    color: '#e94560',
    fontSize: 12,
    marginTop: 4,
  },
  // ── 카메라 ──
  cameraSection: {
    overflow: 'hidden',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  countdownNumber: {
    fontSize: 96,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: '#e94560',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  recBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  // ── 하단 ──
  bottomSection: {
    justifyContent: 'center',
  },
  stopBtn: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  stopIcon: {
    width: 20,
    height: 20,
    backgroundColor: '#e94560',
    borderRadius: 3,
  },
  startArea: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  startBtn: {
    backgroundColor: '#e94560',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  startBtnDisabled: {
    backgroundColor: '#555',
  },
  startBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  backBtn: {
    paddingVertical: 8,
  },
  backText: {
    color: '#888',
    fontSize: 14,
  },
});
