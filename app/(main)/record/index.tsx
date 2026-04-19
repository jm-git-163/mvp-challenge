/**
 * record/index.tsx — 챌린지 촬영 화면
 *
 * 🎮 최신 게임 수준 UI:
 *   - 네온 글로우 HUD
 *   - 게임식 미션 팝업 (glassmorphism)
 *   - 파티클 / 콤보 폭발 효과
 *   - 카운트다운 3D 애니메이션
 *   - 스코어 숫자 점프 애니메이션
 *
 * ✅ Bug fixes:
 *   - judge(landmarks, elapsed) — timing drift 해결
 *   - Mount cleanup useEffect — challenge reset bug 해결
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  useWindowDimensions, Alert, Pressable,
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
import { playSound, initAudio, speakJudgement, createGameBGM, type BGMSpec } from '../../../utils/soundUtils';
import { prewarmMic } from '../../../utils/speechUtils';
import { getTemplateByMissionId }    from '../../../utils/videoTemplates';
import type { JudgementTag }         from '../../../types/session';

// ─── TTS ─────────────────────────────────────────────────────────────────────

function speakMission(text: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1.05; u.pitch = 1.1; u.volume = 0.9;
    const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('ko'));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

// ─── Character config ─────────────────────────────────────────────────────────

const CHAR: Record<string, { emoji: string; color: string; glow: string }> = {
  idle:    { emoji: '🎬', color: '#7c3aed', glow: 'rgba(124,58,237,0.5)' },
  perfect: { emoji: '🌟', color: '#f59e0b', glow: 'rgba(245,158,11,0.7)' },
  good:    { emoji: '😄', color: '#22c55e', glow: 'rgba(34,197,94,0.5)' },
  fail:    { emoji: '💪', color: '#64748b', glow: 'rgba(100,116,139,0.3)' },
};

const PARTICLES = ['⭐', '✨', '🎉', '💫', '🌟', '🎊', '🔥', '💥', '⚡', '🌈'];
interface Particle { id: number; emoji: string; left: string; speed: number; }

// ─── Neon glow score display ──────────────────────────────────────────────────

function NeonScore({ score, tag }: { score: number; tag: JudgementTag }) {
  const glowAnim = useRef(new Animated.Value(0.5)).current;
  const color =
    tag === 'perfect' ? '#22c55e' :
    tag === 'good'    ? '#f59e0b' : 'rgba(255,255,255,0.35)';

  useEffect(() => {
    if (tag === 'perfect') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.5, duration: 400, useNativeDriver: false }),
        ])
      ).start();
    } else {
      Animated.timing(glowAnim, { toValue: 0.5, duration: 300, useNativeDriver: false }).start();
    }
  }, [tag]);

  return (
    <View style={[ns.wrap, { borderColor: color }]}>
      <Text style={[ns.num, { color }]}>{Math.round(score * 100)}</Text>
    </View>
  );
}

const ns = StyleSheet.create({
  wrap: {
    borderWidth: 2, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    minWidth: 52, alignItems: 'center',
  },
  num: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
});

// ─── Countdown overlay ────────────────────────────────────────────────────────

function CountdownOverlay({ count, templateName, emoji }: { count: number; templateName: string; emoji: string }) {
  const scaleAnim  = useRef(new Animated.Value(2)).current;
  const opacAnim   = useRef(new Animated.Value(0)).current;
  const ringAnim   = useRef(new Animated.Value(0)).current;
  const shakeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scaleAnim.setValue(2.5);
    opacAnim.setValue(0);
    ringAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(ringAnim,  { toValue: 1, duration: 900, useNativeDriver: true }),
    ]).start();
    // Shake on GO!
    if (count === 0) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 12,  duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -12, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8,   duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,   duration: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [count]);

  const numColor =
    count === 3 ? '#ff4757' :
    count === 2 ? '#ffa502' :
    count === 1 ? '#2ed573' : '#fff';

  const ringColor =
    count === 3 ? 'rgba(255,71,87,0.4)' :
    count === 2 ? 'rgba(255,165,2,0.4)' :
    count === 1 ? 'rgba(46,213,115,0.4)' : 'rgba(124,58,237,0.4)';

  return (
    <View style={cd.overlay}>
      <View style={[StyleSheet.absoluteFill, cd.backdrop]} />

      {/* 방사형 링 애니메이션 */}
      <Animated.View style={[
        cd.ring,
        {
          borderColor: ringColor,
          transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.5] }) }],
          opacity: ringAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.5, 0] }),
        },
      ]} />
      <Animated.View style={[
        cd.ring, cd.ring2,
        {
          borderColor: ringColor,
          transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.8] }) }],
          opacity: ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 0.3, 0] }),
        },
      ]} />

      <View style={cd.center}>
        {/* 템플릿 배지 */}
        <View style={cd.badge}>
          <Text style={cd.badgeText}>{emoji}  {templateName}</Text>
        </View>

        {count > 0 ? (
          <Animated.Text
            style={[
              cd.num,
              {
                color: numColor,
                opacity: opacAnim,
                transform: [{ scale: scaleAnim }, { translateX: shakeAnim }],
                // @ts-ignore web
                textShadow: `0 0 60px ${numColor}, 0 0 120px ${numColor}`,
              },
            ]}
          >
            {count}
          </Animated.Text>
        ) : (
          <Animated.View style={[
            cd.goWrap,
            {
              opacity: opacAnim,
              transform: [{ scale: scaleAnim }, { translateX: shakeAnim }],
            },
          ]}>
            <Text style={cd.go}>GO!</Text>
          </Animated.View>
        )}

        <Text style={cd.ready}>
          {count === 3 ? '🔴 준비...' : count === 2 ? '🟡 거의...' : count === 1 ? '🟢 시작!' : '🎬 챌린지 시작!'}
        </Text>

        {/* 하단 진행 도트 */}
        <View style={cd.dots}>
          {[3, 2, 1, 0].map(n => (
            <View
              key={n}
              style={[
                cd.dot,
                count <= n ? { backgroundColor: numColor } : { backgroundColor: 'rgba(255,255,255,0.2)' },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const cd = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.82)',
    // @ts-ignore web only
    backdropFilter: 'blur(12px)',
  },
  ring: {
    position: 'absolute',
    width: 280, height: 280,
    borderRadius: 140,
    borderWidth: 3,
    zIndex: 0,
  },
  ring2: { width: 200, height: 200, borderRadius: 100 },
  center: { alignItems: 'center', gap: 14, zIndex: 1 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  badgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  num: {
    fontSize: 140,
    fontWeight: '900',
    lineHeight: 150,
  },
  goWrap: {
    // @ts-ignore web
    background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 52,
    paddingVertical: 20,
    borderRadius: 32,
    // @ts-ignore web
    boxShadow: '0 0 40px rgba(124,58,237,0.8), 0 0 80px rgba(236,72,153,0.4)',
  },
  go: { fontSize: 80, fontWeight: '900', color: '#fff', letterSpacing: 4 },
  ready: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});

// ─── Mission Card ─────────────────────────────────────────────────────────────

function MissionCard({
  mission, progress, tag, voiceTranscript, anim, maxW,
}: {
  mission: any; progress: number; tag: JudgementTag;
  voiceTranscript: string; anim: Animated.Value; maxW: number;
}) {
  const tagColor =
    tag === 'perfect' ? '#22c55e' :
    tag === 'good'    ? '#f59e0b' : '#7c3aed';

  const missionType =
    mission.type === 'voice_read' ? '🎤 따라 읽기' :
    mission.type === 'gesture'    ? '🤲 제스처 챌린지' :
    mission.type === 'timing'     ? '⏱ 유지 챌린지' : '😊 표정 챌린지';

  return (
    <Animated.View
      style={[
        mc.wrap,
        { maxWidth: maxW, opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
      ]}
    >
      {/* Glass background */}
      <View style={[StyleSheet.absoluteFill, mc.glass]} />

      {/* Glow border */}
      <View style={[mc.glowBorder, { borderColor: tagColor + '66' }]} />

      {/* Type chip */}
      <View style={[mc.typeChip, { backgroundColor: tagColor + '22', borderColor: tagColor + '55' }]}>
        <Text style={[mc.typeText, { color: tagColor }]}>{missionType}</Text>
      </View>

      {/* Main emoji */}
      <Text style={mc.bigEmoji}>
        {mission.gesture_emoji ?? mission.guide_emoji ?? '🎯'}
      </Text>

      {/* Mission text */}
      <Text style={mc.mainText}>
        {mission.type === 'voice_read' && mission.read_text
          ? mission.read_text
          : mission.guide_text ?? ''}
      </Text>

      {/* Voice transcript — always shown during voice mission, even if empty */}
      {mission.type === 'voice_read' && (
        <View style={[mc.voiceBox, voiceTranscript ? mc.voiceBoxActive : mc.voiceBoxEmpty]}>
          <Text style={mc.voiceLabel}>🎤 내가 말한 것:</Text>
          <Text style={mc.voiceText}>
            {voiceTranscript !== '' ? `"${voiceTranscript}"` : '마이크에 대고 말해주세요...'}
          </Text>
          {mission.read_text && voiceTranscript !== '' && (
            <View style={mc.voiceScoreBar}>
              <Text style={mc.voiceScoreLabel}>정확도</Text>
              <View style={mc.voiceScoreBg}>
                <View style={[mc.voiceScoreFill, {
                  width: `${Math.min(100, Math.max(10, (voiceTranscript.length / Math.max(1, mission.read_text.length)) * 100))}%` as any,
                  backgroundColor: voiceTranscript.length >= mission.read_text.length * 0.7 ? '#22c55e' : '#f59e0b',
                }]} />
              </View>
            </View>
          )}
        </View>
      )}

      {/* Progress bar */}
      <View style={mc.progBg}>
        <Animated.View
          style={[
            mc.progFill,
            {
              width: `${progress * 100}%` as any,
              backgroundColor: tagColor,
              // @ts-ignore web
              boxShadow: `0 0 6px ${tagColor}`,
            },
          ]}
        />
      </View>

      {/* Status pill */}
      <View style={[mc.statusPill, { backgroundColor: tagColor }]}>
        <Text style={mc.statusText}>
          {tag === 'perfect' ? '🌟 PERFECT!' : tag === 'good' ? '👍 GOOD!' : '⏳ 도전 중...'}
        </Text>
      </View>
    </Animated.View>
  );
}

const mc = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    width: '90%',
    zIndex: 22,
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  glass: {
    backgroundColor: 'rgba(0,0,0,0.78)',
    // @ts-ignore web
    backdropFilter: 'blur(20px)',
    borderRadius: 28,
  },
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1.5,
  },
  typeChip: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 6,
  },
  typeText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  bigEmoji: { fontSize: 80, lineHeight: 90 },
  mainText: {
    color: '#fff', fontSize: 24, fontWeight: '900',
    textAlign: 'center', lineHeight: 32,
    paddingHorizontal: 8,
    // @ts-ignore web
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
  voiceBox: {
    backgroundColor: 'rgba(253,230,138,0.12)',
    borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: 'rgba(253,230,138,0.4)',
    width: '100%', alignItems: 'center', gap: 6,
  },
  voiceBoxActive: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.5)' },
  voiceBoxEmpty:  { backgroundColor: 'rgba(100,116,139,0.15)', borderColor: 'rgba(100,116,139,0.3)' },
  voiceLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  voiceText: { color: '#fde68a', fontSize: 17, fontWeight: '700', textAlign: 'center', lineHeight: 24 },
  voiceScoreBar: { width: '100%', gap: 4 },
  voiceScoreLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' },
  voiceScoreBg: { width: '100%', height: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  voiceScoreFill: { height: '100%', borderRadius: 3 },
  progBg: {
    width: '100%', height: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3, overflow: 'hidden',
  },
  progFill: { height: '100%', borderRadius: 3 },
  statusPill: { paddingHorizontal: 22, paddingVertical: 8, borderRadius: 20 },
  statusText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});

// ─── Template Overlay (붕어빵 껍질 — 녹화 중 실시간 템플릿 레이어) ──────────────

interface SubtitleEntry {
  start_ms: number; end_ms: number; text: string; style?: string;
}

const GENRE_STYLES: Record<string, { headerBg: string; accentColor: string; textGlow: string; borderColor: string }> = {
  news:       { headerBg: 'rgba(13,28,53,0.95)',   accentColor: '#1565c0', textGlow: '#64b5f6', borderColor: '#1565c0' },
  kpop:       { headerBg: 'rgba(10,10,30,0.95)',   accentColor: '#e94560', textGlow: '#ff80ab', borderColor: '#e94560' },
  english:    { headerBg: 'rgba(15,30,70,0.95)',   accentColor: '#2196f3', textGlow: '#90caf9', borderColor: '#2196f3' },
  kids:       { headerBg: 'rgba(80,20,100,0.95)',  accentColor: '#a855f7', textGlow: '#d8b4fe', borderColor: '#ec4899' },
  travel:     { headerBg: 'rgba(0,60,80,0.95)',    accentColor: '#00bcd4', textGlow: '#80deea', borderColor: '#00bcd4' },
  fitness:    { headerBg: 'rgba(10,50,40,0.95)',   accentColor: '#14b8a6', textGlow: '#5eead4', borderColor: '#14b8a6' },
  hiphop:     { headerBg: 'rgba(20,20,20,0.95)',   accentColor: '#f7b731', textGlow: '#fde68a', borderColor: '#f7b731' },
  daily:      { headerBg: 'rgba(40,20,80,0.95)',   accentColor: '#9b59b6', textGlow: '#d8b4fe', borderColor: '#9b59b6' },
  promotion:  { headerBg: 'rgba(80,10,60,0.95)',   accentColor: '#e91e63', textGlow: '#f48fb1', borderColor: '#e91e63' },
};

function TemplateOverlay({
  template, elapsed, isRecording,
}: {
  template: any; elapsed: number; isRecording: boolean;
}) {
  if (!isRecording || !template) return null;

  const genre = template.genre ?? 'daily';
  const gs    = GENRE_STYLES[genre] ?? GENRE_STYLES.daily;

  const subtitles: SubtitleEntry[] = template.subtitle_timeline ?? [];
  const currentSub = subtitles.find(s => elapsed >= s.start_ms && elapsed < s.end_ms);
  const totalMs    = (template.duration_sec ?? 30) * 1000;
  const progress   = Math.min(1, elapsed / totalMs);
  const elapsedSec = Math.floor(elapsed / 1000);
  const totalSec   = template.duration_sec ?? 30;
  const remainSec  = Math.max(0, totalSec - elapsedSec);

  const bg         = template.virtual_bg ?? {};
  const overlayTop: string | undefined    = bg.overlayTop;
  const overlayBottom: string | undefined = bg.overlayBottom;

  const isHighlight = currentSub?.style === 'highlight';
  const isBold      = currentSub?.style === 'bold';

  return (
    <>
      {/* ── 상단 브랜드 바 ─────────────────────────── */}
      <View style={[tov.topBar, { backgroundColor: gs.headerBg, borderBottomColor: gs.borderColor + '88' }]}>
        {/* Live 버튼 */}
        <View style={[tov.livePill, { backgroundColor: '#ef4444' }]}>
          <View style={tov.liveDot} />
          <Text style={tov.liveText}>LIVE</Text>
        </View>
        {/* 템플릿 이름 */}
        <Text style={[tov.topTitle, { color: gs.textGlow }]} numberOfLines={1}>
          {template.theme_emoji}  {template.name}
        </Text>
        {/* 남은 시간 */}
        <View style={[tov.timerPill, { backgroundColor: gs.accentColor + '33', borderColor: gs.accentColor + '55' }]}>
          <Text style={[tov.timerText, { color: gs.textGlow }]}>
            {String(Math.floor(remainSec / 60)).padStart(2,'0')}:{String(remainSec % 60).padStart(2,'0')}
          </Text>
        </View>
      </View>

      {/* ── 장르별 장식 요소 — 뉴스 ─────────────────── */}
      {genre === 'news' && (
        <>
          <View style={[tov.newsTickerBar, { backgroundColor: gs.accentColor }]}>
            <Text style={tov.newsTickerText} numberOfLines={1}>
              📺 속보 · BREAKING NEWS · 오늘의 챌린지 뉴스 · LIVE BROADCAST · 속보 · BREAKING NEWS · 오늘의 챌린지 뉴스
            </Text>
          </View>
          <View style={[tov.newsBorderLeft,  { backgroundColor: gs.accentColor }]} />
          <View style={[tov.newsBorderRight, { backgroundColor: gs.accentColor }]} />
        </>
      )}

      {/* ── 장르별 장식 요소 — K-POP ─────────────────── */}
      {(genre === 'kpop' || genre === 'hiphop') && (
        <>
          <View style={[tov.stageLight, tov.stageLightLeft,  { backgroundColor: gs.accentColor }]} />
          <View style={[tov.stageLight, tov.stageLightRight, { backgroundColor: gs.accentColor }]} />
        </>
      )}

      {/* ── 장르별 장식 요소 — 피트니스 ─────────────── */}
      {genre === 'fitness' && (
        <View style={[tov.fitnessBorder, { borderColor: gs.borderColor + '66' }]} />
      )}

      {/* ── 현재 자막 (subtitle_timeline) ─────────── */}
      {currentSub && (
        <View style={[
          tov.subtitleWrap,
          isHighlight ? { backgroundColor: gs.accentColor + 'dd', borderColor: '#fff5' }
            : isBold  ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: gs.borderColor + '99' }
            :           { backgroundColor: 'rgba(0,0,0,0.72)', borderColor: 'rgba(255,255,255,0.15)' },
        ]}>
          {isHighlight && (
            <View style={[tov.subtitleAccent, { backgroundColor: '#fff4' }]} />
          )}
          <Text style={[
            tov.subtitleText,
            isHighlight
              ? { color: '#fff', fontSize: 22, fontWeight: '900' }
              : isBold
              ? { color: gs.textGlow, fontSize: 20, fontWeight: '800' }
              : { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
          ]} numberOfLines={3}>
            {currentSub.text}
          </Text>
        </View>
      )}

      {/* ── 하단 해시태그 바 ─────────────────────────── */}
      <View style={[tov.bottomBar, { backgroundColor: gs.headerBg, borderTopColor: gs.borderColor + '66' }]}>
        <Text style={[tov.bottomText, { color: gs.textGlow + 'cc' }]} numberOfLines={1}>
          {overlayBottom ?? (template.sns_template?.hashtags ?? []).slice(0,5).map((h: string) => '#' + h).join('  ')}
        </Text>
      </View>

      {/* ── 하단 진행 바 ─────────────────────────────── */}
      <View style={tov.progressTrack}>
        <View style={[tov.progressFill, { width: `${progress * 100}%` as any, backgroundColor: gs.accentColor }]} />
      </View>
    </>
  );
}

const tov = StyleSheet.create({
  // 상단 바
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12, gap: 10,
    borderBottomWidth: 1,
  },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  topTitle: { flex: 1, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  timerPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  timerText: { fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] as any },

  // 뉴스 장식
  newsTickerBar: {
    position: 'absolute', top: 46, left: 0, right: 0, zIndex: 18,
    paddingVertical: 5, paddingHorizontal: 12,
  },
  newsTickerText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  newsBorderLeft: {
    position: 'absolute', left: 0, top: 46, bottom: 44, width: 4, zIndex: 18,
    opacity: 0.8,
  },
  newsBorderRight: {
    position: 'absolute', right: 0, top: 46, bottom: 44, width: 4, zIndex: 18,
    opacity: 0.8,
  },

  // K-POP 무대 조명
  stageLight: {
    position: 'absolute', top: 46, width: 3, height: '60%', zIndex: 18,
    opacity: 0.6,
  },
  stageLightLeft:  { left: 12,  transform: [{ skewX: '8deg' }] as any },
  stageLightRight: { right: 12, transform: [{ skewX: '-8deg' }] as any },

  // 피트니스 테두리
  fitnessBorder: {
    position: 'absolute', top: 46, left: 6, right: 6, bottom: 44,
    borderWidth: 2, borderRadius: 8, zIndex: 18,
    // @ts-ignore web
    boxShadow: '0 0 12px rgba(20,184,166,0.3)',
  },

  // 자막
  subtitleWrap: {
    position: 'absolute',
    bottom: 120,
    left: 12, right: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14, paddingHorizontal: 18,
    alignItems: 'center', zIndex: 22,
    overflow: 'hidden',
    // @ts-ignore web
    backdropFilter: 'blur(16px)',
  },
  subtitleAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: 2,
  },
  subtitleText: {
    textAlign: 'center', lineHeight: 30,
    // @ts-ignore web
    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
  },

  // 하단 바
  bottomBar: {
    position: 'absolute', bottom: 44, left: 0, right: 0, zIndex: 20,
    paddingVertical: 7, paddingHorizontal: 14,
    borderTopWidth: 1, alignItems: 'center',
  },
  bottomText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  // 진행 바
  progressTrack: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
    backgroundColor: 'rgba(255,255,255,0.12)', zIndex: 30,
  },
  progressFill: { height: '100%' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecordScreen() {
  const router    = useRouter();
  const cameraRef = useRef<RecordingCameraHandle>(null);
  const { width } = useWindowDimensions();

  const activeTemplate = useSessionStore(s => s.activeTemplate);
  const sessionKey     = useSessionStore(s => s.sessionKey);
  const defaultFacing = activeTemplate?.camera_mode === 'selfie' ? 'front' : 'back';
  const [facing, setFacing] = useState<'front' | 'back'>(defaultFacing);

  const { isReady, landmarks } = usePoseDetection();
  const { judge, voiceTranscript, resetVoice } = useJudgement();
  const { state, countdown, elapsed, videoUri, start, stop, reset: resetRecording } = useRecording();

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
  const hudOpacity  = useRef(new Animated.Value(0)).current;

  // Refs
  const prevTagRef        = useRef<JudgementTag>('fail');
  const prevCountdownRef  = useRef<number>(3);
  const comboRef          = useRef(0);
  const burstTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMissionSeqRef = useRef<number | null>(null);
  const bgmStopRef        = useRef<(() => void) | null>(null);

  const maxW = Math.min(width - 32, 500);

  // ── sessionKey 변경 감지 → 새 챌린지 선택 시 항상 리셋 ──────────────────
  // sessionKey는 홈에서 챌린지 선택할 때마다 증가 (같은 챌린지 재선택도 감지)
  // Tabs 레이아웃에서 화면이 영구 마운트되므로 useFocusEffect 대신 data-driven 리셋 사용
  const prevSessionKeyRef = useRef<number>(-1);
  useEffect(() => {
    if (!activeTemplate) return;
    if (sessionKey === prevSessionKeyRef.current) return;
    prevSessionKeyRef.current = sessionKey;

    // 마이크 권한 한 번에 미리 확보 (SpeechRecognition 별도 팝업 방지)
    prewarmMic();

    resetRecording();
    resetVoice();
    comboRef.current = 0;
    setCombo(0);
    prevMissionSeqRef.current = null;
    prevTagRef.current        = 'fail';
    setCharState('idle');
    setCurrentScore(0);
    setCurrentTag('fail');
    setCurrentMission(null);
    setParticles([]);
    setBurstVisible(false);
    hudOpacity.setValue(0);
  }, [sessionKey]); // eslint-disable-line

  useEffect(() => { if (!activeTemplate) router.back(); }, [activeTemplate]);
  useEffect(() => () => {
    resetVoice();
    if (bgmStopRef.current) { bgmStopRef.current(); bgmStopRef.current = null; }
  }, [resetVoice]);

  // HUD fade in when recording starts
  useEffect(() => {
    if (state === 'recording') {
      Animated.timing(hudOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } else {
      hudOpacity.setValue(0);
    }
  }, [state]);

  const bounceChar = useCallback(() => {
    Animated.sequence([
      Animated.spring(charScale, { toValue: 1.5, tension: 120, friction: 5, useNativeDriver: true }),
      Animated.spring(charScale, { toValue: 1.0, tension: 80,  friction: 6, useNativeDriver: true }),
    ]).start();
  }, [charScale]);

  const addParticles = useCallback(() => {
    const pts: Particle[] = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      emoji: PARTICLES[Math.floor(Math.random() * PARTICLES.length)],
      left: `${3 + Math.random() * 94}%`,
      speed: 0.8 + Math.random() * 0.8,
    }));
    setParticles(pts);
    setTimeout(() => setParticles([]), 1600);
  }, []);

  const animateMissionIn = useCallback(() => {
    missionAnim.setValue(0);
    Animated.spring(missionAnim, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }).start();
  }, [missionAnim]);

  // ── Core judgement loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'recording') return;

    const result = judge(landmarks, elapsed);
    setCurrentScore(result.score);
    setCurrentTag(result.tag);
    setCurrentMission(result.currentMission);

    // New mission
    if (result.currentMission && result.currentMission.seq !== prevMissionSeqRef.current) {
      prevMissionSeqRef.current = result.currentMission.seq;
      animateMissionIn();
      const m = result.currentMission;
      const text = m.type === 'voice_read' && m.read_text
        ? `따라 읽어주세요: ${m.read_text}`
        : m.guide_text ?? '';
      if (text) speakMission(text);
    }

    // Tag transitions
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
        burstTimerRef.current = setTimeout(() => setBurstVisible(false), 900);
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

  // Recording start reset + BGM 시작
  useEffect(() => {
    if (state === 'recording') {
      playSound('start');
      setCharState('idle');
      comboRef.current = 0;
      setCombo(0);
      prevMissionSeqRef.current = null;

      // 장르별 BGM 매핑
      const genreBGM: Record<string, BGMSpec['genre']> = {
        kpop:      'kpop',
        hiphop:    'kpop',
        news:      'news',
        english:   'bright',
        kids:      'fairy',
        daily:     'lofi',
        travel:    'bright',
        fitness:   'kpop',
        challenge: 'kpop',
        promotion: 'news',
      };
      const bgmGenre = genreBGM[activeTemplate?.genre ?? ''] ?? 'lofi';
      const audioCtx = initAudio();
      if (bgmStopRef.current) bgmStopRef.current();
      bgmStopRef.current = createGameBGM(audioCtx, { genre: bgmGenre, bpm: 120, volume: 0.35 }, audioCtx.destination);
    } else {
      // 녹화 종료 시 BGM 정지
      if (bgmStopRef.current) {
        bgmStopRef.current();
        bgmStopRef.current = null;
      }
    }
  }, [state]);

  // Navigate to result
  useEffect(() => {
    if (state !== 'done' || !videoUri) return;
    resetVoice();
    if (!activeTemplate) {
      router.push({ pathname: '/(main)/result', params: { videoUri } });
      return;
    }
    const vt = getTemplateByMissionId(activeTemplate.genre);
    if (!vt) {
      router.push({ pathname: '/(main)/result', params: { videoUri } });
      return;
    }
    router.push({
      pathname: '/(main)/result',
      params: { videoUri, videoTemplateId: vt.id },
    });
  }, [state, videoUri]);

  const handleFrame = useCallback(async () => {}, []);

  if (!activeTemplate) return null;

  const isCountdown = state === 'countdown';
  const isRecording = state === 'recording';
  const isIdle      = state === 'idle';
  const virtualBg   = activeTemplate.virtual_bg;

  const missionProg = currentMission
    ? Math.min(1, Math.max(0, (elapsed - currentMission.start_ms) / Math.max(1, currentMission.end_ms - currentMission.start_ms)))
    : 0;

  const tagColor =
    currentTag === 'perfect' ? '#22c55e' :
    currentTag === 'good'    ? '#f59e0b' : 'rgba(255,255,255,0.2)';

  const char = CHAR[charState];

  return (
    <View style={r.root}>
      <SafeAreaView style={r.safe} edges={['top', 'bottom']}>
        <View style={r.camWrap}>
          <VirtualBackgroundFrame bg={virtualBg}>
            <RecordingCamera
              ref={cameraRef}
              facing={facing}
              onFrame={handleFrame}
              paused={isIdle || state === 'processing'}
              onPermissionDenied={() => {
                Alert.alert('카메라 권한 필요', '브라우저에서 카메라를 허용해주세요.');
                router.back();
              }}
            >
              {/* ── PARTICLES ─────────────────────── */}
              {particles.map(p => (
                <Text key={p.id} style={[r.particle, { left: p.left as any }]}>{p.emoji}</Text>
              ))}

              {/* ── HUD — top row ─────────────────── */}
              <Animated.View style={[r.topHud, { opacity: hudOpacity }]}>
                {/* REC badge */}
                <View style={r.recBadge}>
                  <View style={r.recDot} />
                  <Text style={r.recText}>REC</Text>
                </View>

                {/* Score */}
                <NeonScore score={currentScore} tag={currentTag} />

                {/* Combo */}
                {combo >= 2 && (
                  <View style={[r.comboPill, combo >= 5 && r.comboPillHot]}>
                    <Text style={r.comboText}>🔥 {combo}x</Text>
                  </View>
                )}

                {/* Spacer + flip */}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={r.flipBtn}
                  onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={r.flipText}>🔄</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* ── CHARACTER (recording) ─────────── */}
              {isRecording && (
                <Animated.View style={[r.charArea, { transform: [{ scale: charScale }] }]}>
                  <View
                    style={[
                      r.charBubble,
                      {
                        backgroundColor: char.color + '2a',
                        // @ts-ignore web
                        boxShadow: `0 0 20px ${char.glow}, 0 0 40px ${char.glow}`,
                        borderColor: char.color + '55',
                      },
                    ]}
                  >
                    <Text style={r.charEmoji}>{char.emoji}</Text>
                  </View>
                </Animated.View>
              )}

              {/* ── MISSION CARD ──────────────────── */}
              {isRecording && currentMission && (
                <MissionCard
                  mission={currentMission}
                  progress={missionProg}
                  tag={currentTag}
                  voiceTranscript={voiceTranscript}
                  anim={missionAnim}
                  maxW={maxW}
                />
              )}

              {/* ── PRE-RECORD INFO ───────────────── */}
              {isIdle && (
                <View style={[r.infoOverlay, { maxWidth: maxW }]}>
                  <Text style={r.infoEmoji}>{activeTemplate.theme_emoji}</Text>
                  <Text style={r.infoTitle}>{activeTemplate.name}</Text>
                  <Text style={r.infoMeta}>{activeTemplate.duration_sec}초 · {activeTemplate.missions.length}개 미션</Text>
                  {activeTemplate.scene ? (
                    <Text style={r.infoScene} numberOfLines={3}>{activeTemplate.scene}</Text>
                  ) : null}
                  {activeTemplate.camera_mode === 'selfie' && (
                    <View style={r.selfieChip}>
                      <Text style={r.selfieText}>📱 전면 카메라 모드</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={r.flipBtnIdle}
                    onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}
                  >
                    <Text style={r.flipBtnIdleText}>
                      🔄 {facing === 'front' ? '후면으로' : '전면으로'} 전환
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── COUNTDOWN ─────────────────────── */}
              {isCountdown && (
                <CountdownOverlay
                  count={countdown}
                  templateName={activeTemplate.name}
                  emoji={activeTemplate.theme_emoji}
                />
              )}

              {/* ── TEMPLATE OVERLAY (붕어빵 껍질) ─────────── */}
              <TemplateOverlay
                template={activeTemplate}
                elapsed={elapsed}
                isRecording={isRecording}
              />

              {/* ── TIMING BAR ────────────────────── */}
              {isRecording && (
                <View style={r.timingBarWrap}>
                  <TimingBar template={activeTemplate} elapsedMs={elapsed} />
                </View>
              )}

              {/* ── JUDGEMENT BURST ───────────────── */}
              {isRecording && <JudgementBurst tag={burstTag} combo={combo} visible={burstVisible} />}

              {/* ── STOP BUTTON ───────────────────── */}
              {isRecording && (
                <View style={r.stopArea}>
                  <TouchableOpacity
                    style={r.stopBtn}
                    onPress={() => cameraRef.current && stop(cameraRef.current)}
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  >
                    <View style={r.stopIcon} />
                  </TouchableOpacity>
                  <Text style={r.stopHint}>탭하여 중지</Text>
                </View>
              )}

              {/* ── START BUTTON ──────────────────── */}
              {isIdle && (
                <View style={[r.startArea, { maxWidth: maxW }]}>
                  <Pressable
                    style={r.startBtn}
                    onPress={() => { initAudio(); if (cameraRef.current) start(cameraRef.current); }}
                  >
                    {/* Glow behind button */}
                    <View style={r.startGlow} />
                    <Text style={r.startBtnText}>▶  챌린지 시작</Text>
                  </Pressable>
                  <TouchableOpacity
                    style={r.cancelBtn}
                    onPress={() => router.back()}
                    hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
                  >
                    <Text style={r.cancelText}>← 취소</Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const r = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },
  camWrap: { flex: 1 },

  // Particles
  particle: {
    position: 'absolute', top: '10%',
    fontSize: 30, zIndex: 50,
    // @ts-ignore web
    animation: 'float 1.6s ease-out forwards',
  },

  // HUD
  topHud: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 30,
  },
  recBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  recText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  comboPill: {
    backgroundColor: 'rgba(239,68,68,0.85)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  comboPillHot: { backgroundColor: 'rgba(234,179,8,0.9)' },
  comboText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  flipBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  flipText: { fontSize: 18 },

  // Character
  charArea: {
    position: 'absolute', top: 60, alignSelf: 'center',
    alignItems: 'center', zIndex: 20,
  },
  charBubble: {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  charEmoji: { fontSize: 42 },

  // Pre-record info
  infoOverlay: {
    position: 'absolute', top: '18%', alignSelf: 'center', width: '90%',
    backgroundColor: 'rgba(0,0,0,0.85)',
    // @ts-ignore web
    backdropFilter: 'blur(20px)',
    borderRadius: 28, padding: 28, alignItems: 'center', gap: 10, zIndex: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  infoEmoji: { fontSize: 60 },
  infoTitle: {
    color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center',
    // @ts-ignore web
    textShadow: '0 2px 12px rgba(124,58,237,0.6)',
  },
  infoMeta: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  infoScene: { color: '#cbd5e1', fontSize: 13, textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },
  selfieChip: {
    backgroundColor: 'rgba(124,58,237,0.2)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)',
  },
  selfieText: { color: '#a78bfa', fontSize: 12, fontWeight: '700' },
  flipBtnIdle: {
    marginTop: 4, backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    minHeight: 46, justifyContent: 'center',
  },
  flipBtnIdleText: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },

  // Timing bar
  timingBarWrap: { position: 'absolute', bottom: 100, left: 0, right: 0, zIndex: 10 },

  // Stop button
  stopArea: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    alignItems: 'center', gap: 8, zIndex: 35,
  },
  stopBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 3.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    // @ts-ignore web
    boxShadow: '0 0 20px rgba(255,255,255,0.3)',
  },
  stopIcon: { width: 26, height: 26, backgroundColor: '#ef4444', borderRadius: 6 },
  stopHint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '500' },

  // Start button
  startArea: {
    position: 'absolute', bottom: 28, alignSelf: 'center',
    width: '90%', alignItems: 'center', gap: 14, zIndex: 35,
  },
  startBtn: {
    width: '100%', paddingVertical: 20, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', minHeight: 64,
    // @ts-ignore web
    background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
    backgroundColor: '#7c3aed',
    overflow: 'hidden', position: 'relative',
  },
  startGlow: {
    position: 'absolute', inset: 0 as any,
    // @ts-ignore web
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
  },
  startBtnText: {
    color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1,
    // @ts-ignore web
    textShadow: '0 2px 8px rgba(0,0,0,0.3)',
    zIndex: 1,
  },
  cancelBtn: { paddingVertical: 10 },
  cancelText: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '500' },
});
