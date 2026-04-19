/**
 * record/index.tsx — 챌린지 촬영 화면 v3
 *
 * 🎬 CapCut/TikTok 수준 프로덕션 퀄리티:
 *   - IntroOverlay: 템플릿별 극적인 인트로 (4초)
 *   - OutroOverlay: 점수 폭발 아웃트로 (3초)
 *   - TemplateOverlay 전면 재설계:
 *       K-POP: 무대 스포트라이트 + 별 파티클 + 네온 글로우
 *       NEWS:  애니메이션 속보 티커 + 로워서드 + CRT 스캔라인
 *       FITNESS: 진행 링 + 네온 rep 카운터 + 동기부여 플래시
 *       ALL: 그라데이션 자막 + 애니메이션 LIVE 인디케이터 + 해시태그 마퀴 + 글로우 프로그레스
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
import type { TemplateIntro, TemplateOutro } from '../../../types/template';

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
  good:    { emoji: '😄', color: '#22c55e', glow: 'rgba(34,197,94,0.5)'  },
  fail:    { emoji: '💪', color: '#64748b', glow: 'rgba(100,116,139,0.3)' },
};

const PARTICLES = ['⭐', '✨', '🎉', '💫', '🌟', '🎊', '🔥', '💥', '⚡', '🌈'];
interface Particle { id: number; emoji: string; left: string; speed: number; }

// ─── Neon score ───────────────────────────────────────────────────────────────

function NeonScore({ score, tag }: { score: number; tag: JudgementTag }) {
  const glowAnim = useRef(new Animated.Value(0.5)).current;
  const color =
    tag === 'perfect' ? '#22c55e' :
    tag === 'good'    ? '#f59e0b' : 'rgba(255,255,255,0.35)';
  useEffect(() => {
    if (tag === 'perfect') {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 400, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 400, useNativeDriver: false }),
      ])).start();
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
  wrap: { borderWidth: 2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.6)', minWidth: 52, alignItems: 'center' },
  num:  { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
});

// ─── IntroOverlay ─────────────────────────────────────────────────────────────

function IntroOverlay({ intro, genre, onDone }: { intro: TemplateIntro; genre: string; onDone: () => void }) {
  const masterOpacity = useRef(new Animated.Value(0)).current;
  const titleScale    = useRef(new Animated.Value(0.3)).current;
  const titleOpacity  = useRef(new Animated.Value(0)).current;
  const subOpacity    = useRef(new Animated.Value(0)).current;
  const barWidth      = useRef(new Animated.Value(0)).current;
  const glowAnim      = useRef(new Animated.Value(0.3)).current;
  const particleAnims = useRef(
    Array.from({ length: 8 }, () => ({
      x: new Animated.Value(0), y: new Animated.Value(0),
      opacity: new Animated.Value(0), scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    Animated.timing(masterOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    const tension = intro.animation === 'particle_burst' ? 120 : intro.animation === 'zoom_in' ? 60 : 80;
    Animated.parallel([
      Animated.spring(titleScale,   { toValue: 1, tension, friction: intro.animation === 'glitch' ? 12 : 7, useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    Animated.delay(150).start(() =>
      Animated.timing(subOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    );

    Animated.timing(barWidth, { toValue: 1, duration: intro.duration_ms - 800, useNativeDriver: false }).start();

    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,   duration: 600, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 600, useNativeDriver: false }),
    ]));
    glowLoop.start();

    if (intro.animation === 'particle_burst') {
      particleAnims.forEach((p, i) => {
        const angle = (i / particleAnims.length) * Math.PI * 2;
        const dist  = 80 + Math.random() * 60;
        Animated.sequence([
          Animated.delay(200 + i * 60),
          Animated.parallel([
            Animated.spring(p.scale,   { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(p.x,       { toValue: Math.cos(angle) * dist, duration: 600, useNativeDriver: true }),
            Animated.timing(p.y,       { toValue: Math.sin(angle) * dist, duration: 600, useNativeDriver: true }),
          ]),
          Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      });
    }

    const doneTimer = setTimeout(() => {
      Animated.timing(masterOpacity, { toValue: 0, duration: 500, useNativeDriver: true })
        .start(() => onDone());
    }, intro.duration_ms - 500);

    return () => { clearTimeout(doneTimer); glowLoop.stop(); };
  }, []);

  const accentColor = intro.accentColor ?? '#7c3aed';
  const genreEmojis: Record<string, string[]> = {
    kpop:    ['⭐','🎤','💫','✨','🌟','💝','🎵','👑'],
    hiphop:  ['🎤','🔥','💥','⚡','🎧','🎵','💣','🌟'],
    news:    ['📺','📡','🔴','📰','🎙️','⚡','🔔','📊'],
    fitness: ['💪','🔥','⚡','🏋️','🎯','💥','🏆','🌟'],
    kids:    ['🌈','🦄','🌟','💕','🎀','✨','🍀','🎉'],
    travel:  ['✈️','🌏','🗺️','📍','🌅','⛅','🏔️','🌊'],
  };
  const emojis = genreEmojis[genre] ?? ['⭐','✨','🎉','💫','🌟','🎊','🔥','💥'];

  return (
    <Animated.View style={[io.overlay, { opacity: masterOpacity }]}>
      <View style={[StyleSheet.absoluteFill, {
        // @ts-ignore web
        background: `linear-gradient(135deg, ${intro.bgColor} 0%, ${intro.bgColor2} 100%)`,
        backgroundColor: intro.bgColor,
      }]} />

      {intro.animation === 'glitch' && (
        <>
          <View style={[io.scanline, { top: '20%' }]} />
          <View style={[io.scanline, { top: '40%', opacity: 0.08 }]} />
          <View style={[io.scanline, { top: '60%', opacity: 0.1  }]} />
          <View style={[io.scanline, { top: '80%', opacity: 0.07 }]} />
        </>
      )}

      {intro.animation === 'particle_burst' && particleAnims.map((p, i) => (
        <Animated.Text key={i} style={[io.particle, {
          opacity: p.opacity,
          transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
        }]}>
          {emojis[i % emojis.length]}
        </Animated.Text>
      ))}

      <View style={io.center}>
        <Animated.View style={[io.glowRing, { borderColor: accentColor, opacity: glowAnim }]} />

        <Animated.Text style={[io.title, {
          color: '#fff',
          opacity: titleOpacity,
          transform: [{ scale: titleScale }],
          // @ts-ignore web
          textShadow: `0 0 40px ${accentColor}, 0 0 80px ${accentColor}88`,
        }]}>
          {intro.title}
        </Animated.Text>

        {intro.subtitle && (
          <Animated.Text style={[io.subtitle, { opacity: subOpacity, color: accentColor }]}>
            {intro.subtitle}
          </Animated.Text>
        )}

        <Animated.View style={[io.emojiRow, { opacity: subOpacity }]}>
          {emojis.slice(0, 5).map((e, i) => <Text key={i} style={io.emojiItem}>{e}</Text>)}
        </Animated.View>
      </View>

      <View style={io.progressTrack}>
        <Animated.View style={[io.progressFill, {
          width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: accentColor,
          // @ts-ignore web
          boxShadow: `0 0 8px ${accentColor}`,
        }]} />
      </View>

      <View style={[io.badge, { borderColor: accentColor + '66', backgroundColor: accentColor + '22' }]}>
        <Text style={[io.badgeText, { color: accentColor }]}>CHALLENGE STUDIO</Text>
      </View>
    </Animated.View>
  );
}

const io = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 60, overflow: 'hidden' },
  scanline: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#fff', opacity: 0.12 },
  glowRing: { position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 2 },
  center:   { alignItems: 'center', gap: 16, zIndex: 1, paddingHorizontal: 32 },
  title:    { fontSize: 42, fontWeight: '900', textAlign: 'center', letterSpacing: 1, lineHeight: 52 },
  subtitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5, opacity: 0.9 },
  emojiRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  emojiItem:{ fontSize: 28 },
  particle: { position: 'absolute', fontSize: 30, zIndex: 2 },
  progressTrack: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  progressFill:  { height: '100%', borderRadius: 2 },
  badge:     { position: 'absolute', top: 24, right: 20, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
});

// ─── OutroOverlay ─────────────────────────────────────────────────────────────

function OutroOverlay({ outro, score, onDone }: { outro: TemplateOutro; score: number; onDone: () => void }) {
  const masterOpacity = useRef(new Animated.Value(0)).current;
  const titleScale    = useRef(new Animated.Value(0.2)).current;
  const titleOpacity  = useRef(new Animated.Value(0)).current;
  const scoreScale    = useRef(new Animated.Value(0)).current;
  const scoreOpacity  = useRef(new Animated.Value(0)).current;
  const ringScale     = useRef(new Animated.Value(0.5)).current;
  const ringOpacity   = useRef(new Animated.Value(1)).current;
  const crownScale    = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      x: new Animated.Value(0), y: new Animated.Value(0),
      opacity: new Animated.Value(0), rotate: new Animated.Value(0),
      emoji: PARTICLES[i % PARTICLES.length],
      startX: -40 + Math.random() * 80,
    }))
  ).current;

  const accentColor  = outro.accentColor ?? '#f59e0b';
  const scorePercent = Math.round(score * 100);

  useEffect(() => {
    Animated.timing(masterOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    Animated.loop(Animated.parallel([
      Animated.timing(ringScale,   { toValue: 2.5, duration: 1200, useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0,   duration: 1200, useNativeDriver: true }),
    ])).start();

    Animated.sequence([
      Animated.parallel([
        Animated.spring(titleScale,   { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(scoreScale,   { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(scoreOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();

    if (outro.animation === 'crown') {
      Animated.sequence([
        Animated.delay(400),
        Animated.spring(crownScale, { toValue: 1, tension: 70, friction: 6, useNativeDriver: true }),
      ]).start();
    }

    confettiAnims.forEach((p, i) => {
      Animated.sequence([
        Animated.delay(i * 80),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(p.y,       { toValue: -180 - Math.random() * 100, duration: 800, useNativeDriver: true }),
          Animated.timing(p.x,       { toValue: p.startX + (-60 + Math.random() * 120), duration: 800, useNativeDriver: true }),
          Animated.timing(p.rotate,  { toValue: Math.random() > 0.5 ? 1 : -1, duration: 800, useNativeDriver: true }),
        ]),
        Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    });

    const t = setTimeout(() => {
      Animated.timing(masterOpacity, { toValue: 0, duration: 500, useNativeDriver: true })
        .start(() => onDone());
    }, outro.duration_ms - 500);

    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[oo.overlay, { opacity: masterOpacity }]}>
      <View style={[StyleSheet.absoluteFill, {
        // @ts-ignore web
        background: `radial-gradient(circle at 50% 50%, ${accentColor}33 0%, #000 70%)`,
        backgroundColor: '#000',
      }]} />

      <Animated.View style={[oo.ring, { borderColor: accentColor, transform: [{ scale: ringScale }], opacity: ringOpacity }]} />

      {outro.animation === 'crown' && (
        <Animated.Text style={[oo.crown, { transform: [{ scale: crownScale }] }]}>👑</Animated.Text>
      )}

      {confettiAnims.map((p, i) => (
        <Animated.Text key={i} style={[oo.confetti, {
          opacity: p.opacity,
          transform: [
            { translateX: p.x }, { translateY: p.y },
            { rotate: p.rotate.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] }) },
          ],
        }]}>
          {p.emoji}
        </Animated.Text>
      ))}

      <View style={oo.center}>
        <Animated.Text style={[oo.title, {
          color: '#fff', opacity: titleOpacity, transform: [{ scale: titleScale }],
          // @ts-ignore web
          textShadow: `0 0 30px ${accentColor}, 0 0 60px ${accentColor}88`,
        }]}>
          {outro.title}
        </Animated.Text>

        {outro.subtitle && (
          <Animated.Text style={[oo.subtitle, { opacity: titleOpacity, color: accentColor }]}>
            {outro.subtitle}
          </Animated.Text>
        )}

        <Animated.View style={[oo.scoreWrap, {
          opacity: scoreOpacity, transform: [{ scale: scoreScale }],
          borderColor: accentColor,
          // @ts-ignore web
          boxShadow: `0 0 30px ${accentColor}66`,
        }]}>
          <Text style={[oo.scoreNum, { color: accentColor }]}>{scorePercent}</Text>
          <Text style={oo.scoreLabel}>점</Text>
        </Animated.View>

        <Animated.View style={[oo.achieveRow, { opacity: scoreOpacity }]}>
          <Text style={oo.achieveBadge}>
            {scorePercent >= 90 ? '🏆 PERFECT'
              : scorePercent >= 70 ? '⭐ GREAT'
              : scorePercent >= 50 ? '👍 GOOD'
              : '💪 KEEP GOING'}
          </Text>
        </Animated.View>

        <Animated.Text style={[oo.shareHint, { opacity: scoreOpacity }]}>
          📱 공유하기 준비 중...
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const oo = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 60, overflow: 'hidden' },
  ring:       { position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 2 },
  crown:      { position: 'absolute', top: '15%', fontSize: 70, zIndex: 2 },
  confetti:   { position: 'absolute', fontSize: 26, zIndex: 2 },
  center:     { alignItems: 'center', gap: 16, zIndex: 3, paddingHorizontal: 32 },
  title:      { fontSize: 38, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5, lineHeight: 48 },
  subtitle:   { fontSize: 16, fontWeight: '700', textAlign: 'center', opacity: 0.85 },
  scoreWrap:  { flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderWidth: 2, borderRadius: 24, paddingHorizontal: 32, paddingVertical: 16, backgroundColor: 'rgba(0,0,0,0.5)', marginTop: 8 },
  scoreNum:   { fontSize: 72, fontWeight: '900', lineHeight: 80 },
  scoreLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 24, fontWeight: '700', paddingBottom: 8 },
  achieveRow: { flexDirection: 'row', gap: 8 },
  achieveBadge: { color: '#fff', fontSize: 14, fontWeight: '900', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, letterSpacing: 0.5 },
  shareHint:  { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 4 },
});

// ─── Countdown ────────────────────────────────────────────────────────────────

function CountdownOverlay({ count, templateName, emoji }: { count: number; templateName: string; emoji: string }) {
  const scaleAnim = useRef(new Animated.Value(2)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;
  const ringAnim  = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scaleAnim.setValue(2.5); opacAnim.setValue(0); ringAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(ringAnim,  { toValue: 1, duration: 900, useNativeDriver: true }),
    ]).start();
    if (count === 0) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 12,  duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -12, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8,   duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,   duration: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [count]);

  const numColor   = count === 3 ? '#ff4757' : count === 2 ? '#ffa502' : count === 1 ? '#2ed573' : '#fff';
  const ringColor  = count === 3 ? 'rgba(255,71,87,0.4)' : count === 2 ? 'rgba(255,165,2,0.4)' : count === 1 ? 'rgba(46,213,115,0.4)' : 'rgba(124,58,237,0.4)';

  return (
    <View style={cd.overlay}>
      <View style={[StyleSheet.absoluteFill, cd.backdrop]} />
      <Animated.View style={[cd.ring, { borderColor: ringColor, transform: [{ scale: ringAnim.interpolate({ inputRange:[0,1], outputRange:[0.5,2.5] }) }], opacity: ringAnim.interpolate({ inputRange:[0,0.7,1], outputRange:[1,0.5,0] }) }]} />
      <Animated.View style={[cd.ring, cd.ring2, { borderColor: ringColor, transform: [{ scale: ringAnim.interpolate({ inputRange:[0,1], outputRange:[0.3,1.8] }) }], opacity: ringAnim.interpolate({ inputRange:[0,0.5,1], outputRange:[0.7,0.3,0] }) }]} />
      <View style={cd.center}>
        <View style={cd.badge}><Text style={cd.badgeText}>{emoji}  {templateName}</Text></View>
        {count > 0 ? (
          <Animated.Text style={[cd.num, { color: numColor, opacity: opacAnim, transform: [{ scale: scaleAnim }, { translateX: shakeAnim }],
            // @ts-ignore web
            textShadow: `0 0 60px ${numColor}, 0 0 120px ${numColor}`,
          }]}>{count}</Animated.Text>
        ) : (
          <Animated.View style={[cd.goWrap, { opacity: opacAnim, transform: [{ scale: scaleAnim }, { translateX: shakeAnim }] }]}>
            <Text style={cd.go}>GO!</Text>
          </Animated.View>
        )}
        <Text style={cd.ready}>{count === 3 ? '🔴 준비...' : count === 2 ? '🟡 거의...' : count === 1 ? '🟢 시작!' : '🎬 챌린지 시작!'}</Text>
        <View style={cd.dots}>
          {[3,2,1,0].map(n => (
            <View key={n} style={[cd.dot, count <= n ? { backgroundColor: numColor } : { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
          ))}
        </View>
      </View>
    </View>
  );
}
const cd = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 40 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.82)',
    // @ts-ignore web
    backdropFilter: 'blur(12px)' },
  ring:   { position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 3, zIndex: 0 },
  ring2:  { width: 200, height: 200, borderRadius: 100 },
  center: { alignItems: 'center', gap: 14, zIndex: 1 },
  badge:  { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 8 },
  badgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  num:    { fontSize: 140, fontWeight: '900', lineHeight: 150 },
  goWrap: {
    // @ts-ignore web
    background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)',
    backgroundColor: '#7c3aed', paddingHorizontal: 52, paddingVertical: 20, borderRadius: 32,
    // @ts-ignore web
    boxShadow: '0 0 40px rgba(124,58,237,0.8), 0 0 80px rgba(236,72,153,0.4)',
  },
  go:     { fontSize: 80, fontWeight: '900', color: '#fff', letterSpacing: 4 },
  ready:  { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  dots:   { flexDirection: 'row', gap: 8, marginTop: 4 },
  dot:    { width: 10, height: 10, borderRadius: 5 },
});

// ─── Mission Card ─────────────────────────────────────────────────────────────

function MissionCard({ mission, progress, tag, voiceTranscript, anim, maxW }: {
  mission: any; progress: number; tag: JudgementTag; voiceTranscript: string; anim: Animated.Value; maxW: number;
}) {
  const tagColor = tag === 'perfect' ? '#22c55e' : tag === 'good' ? '#f59e0b' : '#7c3aed';
  const missionType =
    mission.type === 'voice_read' ? '🎤 따라 읽기' :
    mission.type === 'gesture'    ? '🤲 제스처 챌린지' :
    mission.type === 'timing'     ? '⏱ 유지 챌린지' : '😊 표정 챌린지';
  return (
    <Animated.View style={[mc.wrap, { maxWidth: maxW, opacity: anim, transform: [{ scale: anim.interpolate({ inputRange:[0,1], outputRange:[0.85,1] }) }] }]}>
      <View style={[StyleSheet.absoluteFill, mc.glass]} />
      <View style={[mc.glowBorder, { borderColor: tagColor + '66' }]} />
      <View style={[mc.typeChip, { backgroundColor: tagColor + '22', borderColor: tagColor + '55' }]}>
        <Text style={[mc.typeText, { color: tagColor }]}>{missionType}</Text>
      </View>
      <Text style={mc.bigEmoji}>{mission.gesture_emoji ?? mission.guide_emoji ?? '🎯'}</Text>
      <Text style={mc.mainText}>{mission.type === 'voice_read' && mission.read_text ? mission.read_text : mission.guide_text ?? ''}</Text>
      {mission.type === 'voice_read' && (
        <View style={[mc.voiceBox, voiceTranscript ? mc.voiceBoxActive : mc.voiceBoxEmpty]}>
          <Text style={mc.voiceLabel}>🎤 내가 말한 것:</Text>
          <Text style={mc.voiceText}>{voiceTranscript !== '' ? `"${voiceTranscript}"` : '마이크에 대고 말해주세요...'}</Text>
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
      <View style={mc.progBg}>
        <Animated.View style={[mc.progFill, { width: `${progress * 100}%` as any, backgroundColor: tagColor,
          // @ts-ignore web
          boxShadow: `0 0 6px ${tagColor}` }]} />
      </View>
      <View style={[mc.statusPill, { backgroundColor: tagColor }]}>
        <Text style={mc.statusText}>{tag === 'perfect' ? '🌟 PERFECT!' : tag === 'good' ? '👍 GOOD!' : '⏳ 도전 중...'}</Text>
      </View>
    </Animated.View>
  );
}
const mc = StyleSheet.create({
  wrap:      { position: 'absolute', top: '18%', alignSelf: 'center', width: '90%', zIndex: 22, borderRadius: 28, padding: 22, alignItems: 'center', gap: 12, overflow: 'hidden' },
  glass:     { backgroundColor: 'rgba(0,0,0,0.78)',
    // @ts-ignore web
    backdropFilter: 'blur(20px)', borderRadius: 28 },
  glowBorder:{ ...StyleSheet.absoluteFillObject, borderRadius: 28, borderWidth: 1.5 },
  typeChip:  { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 6 },
  typeText:  { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  bigEmoji:  { fontSize: 80, lineHeight: 90 },
  mainText:  { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center', lineHeight: 32, paddingHorizontal: 8,
    // @ts-ignore web
    textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
  voiceBox:       { backgroundColor: 'rgba(253,230,138,0.12)', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: 'rgba(253,230,138,0.4)', width: '100%', alignItems: 'center', gap: 6 },
  voiceBoxActive: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.5)' },
  voiceBoxEmpty:  { backgroundColor: 'rgba(100,116,139,0.15)', borderColor: 'rgba(100,116,139,0.3)' },
  voiceLabel:     { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  voiceText:      { color: '#fde68a', fontSize: 17, fontWeight: '700', textAlign: 'center', lineHeight: 24 },
  voiceScoreBar:  { width: '100%', gap: 4 },
  voiceScoreLabel:{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' },
  voiceScoreBg:   { width: '100%', height: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  voiceScoreFill: { height: '100%', borderRadius: 3 },
  progBg:    { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' },
  progFill:  { height: '100%', borderRadius: 3 },
  statusPill:{ paddingHorizontal: 22, paddingVertical: 8, borderRadius: 20 },
  statusText:{ color: '#fff', fontSize: 15, fontWeight: '900' },
});

// ─── Genre styles ─────────────────────────────────────────────────────────────

const GENRE_STYLES: Record<string, { headerBg: string; accentColor: string; textGlow: string; borderColor: string }> = {
  news:      { headerBg: 'rgba(13,28,53,0.95)',  accentColor: '#1565c0', textGlow: '#64b5f6', borderColor: '#1565c0' },
  kpop:      { headerBg: 'rgba(10,10,30,0.95)',  accentColor: '#e94560', textGlow: '#ff80ab', borderColor: '#e94560' },
  english:   { headerBg: 'rgba(15,30,70,0.95)',  accentColor: '#2196f3', textGlow: '#90caf9', borderColor: '#2196f3' },
  kids:      { headerBg: 'rgba(80,20,100,0.95)', accentColor: '#a855f7', textGlow: '#d8b4fe', borderColor: '#ec4899' },
  travel:    { headerBg: 'rgba(0,60,80,0.95)',   accentColor: '#f97316', textGlow: '#fdba74', borderColor: '#f97316' },
  fitness:   { headerBg: 'rgba(10,50,40,0.95)',  accentColor: '#14b8a6', textGlow: '#5eead4', borderColor: '#14b8a6' },
  hiphop:    { headerBg: 'rgba(20,20,20,0.95)',  accentColor: '#f7b731', textGlow: '#fde68a', borderColor: '#f7b731' },
  daily:     { headerBg: 'rgba(40,20,80,0.95)',  accentColor: '#9b59b6', textGlow: '#d8b4fe', borderColor: '#9b59b6' },
  promotion: { headerBg: 'rgba(80,10,60,0.95)',  accentColor: '#e91e63', textGlow: '#f48fb1', borderColor: '#e91e63' },
};

// ─── KpopSpotlights ───────────────────────────────────────────────────────────

function KpopSpotlights({ accentColor }: { accentColor: string }) {
  const sweep1 = useRef(new Animated.Value(0)).current;
  const sweep2 = useRef(new Animated.Value(1)).current;
  const pulse  = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(sweep1, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(sweep1, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(sweep2, { toValue: 0, duration: 2400, useNativeDriver: true }),
      Animated.timing(sweep2, { toValue: 1, duration: 2400, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.8, duration: 800, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: false }),
    ])).start();
  }, []);
  return (
    <>
      <Animated.View style={[tov.spotBeam, { left: sweep1.interpolate({ inputRange:[0,1], outputRange:['5%','30%'] }), backgroundColor: accentColor, opacity: pulse }]} />
      <Animated.View style={[tov.spotBeam, { right: sweep2.interpolate({ inputRange:[0,1], outputRange:['5%','30%'] }), backgroundColor: accentColor, opacity: pulse, transform: [{ skewX: '-12deg' }] as any }]} />
      <Animated.View style={[tov.beatFlash, { borderColor: accentColor, opacity: pulse.interpolate({ inputRange:[0.3,0.8], outputRange:[0.08,0.35] }) }]} />
    </>
  );
}

// ─── NewsTickerLayer ──────────────────────────────────────────────────────────

function NewsTickerLayer({ accentColor, tickerText }: { accentColor: string; tickerText: string }) {
  const tickerX  = useRef(new Animated.Value(0)).current;
  const liveDot  = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(tickerX, { toValue: -1, duration: 12000, useNativeDriver: true }),
      Animated.timing(tickerX, { toValue: 0,  duration: 0,     useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(liveDot, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(liveDot, { toValue: 1, duration: 500, useNativeDriver: true }),
    ])).start();
  }, []);
  const text = tickerText || '🔴 속보 · BREAKING NEWS · 오늘의 챌린지 뉴스 · LIVE BROADCAST ·';
  return (
    <>
      <View style={[tov.newsBreakingBar, { backgroundColor: '#c62828' }]}>
        <View style={tov.newsBreakingLeft}>
          <Animated.View style={[tov.newsLiveDot, { opacity: liveDot }]} />
          <Text style={tov.newsBreakingLabel}>BREAKING</Text>
        </View>
        <Text style={tov.newsBreakingText} numberOfLines={1}>{text}</Text>
      </View>
      <View style={[tov.newsTickerTrack, { backgroundColor: accentColor }]}>
        <Animated.Text style={[tov.newsTickerText, {
          transform: [{ translateX: tickerX.interpolate({ inputRange:[-1,0], outputRange:['-150%','0%'] }) }],
        }]} numberOfLines={1}>
          {text + ' · ' + text}
        </Animated.Text>
      </View>
      <View style={[tov.lowerThird, { backgroundColor: accentColor + 'dd' }]}>
        <View style={[tov.lowerThirdAccent, { backgroundColor: '#c62828' }]} />
        <Text style={tov.lowerThirdText}>뉴스 챌린지 스튜디오  |  MC 챌린저</Text>
      </View>
      <View style={[tov.newsSideBar, tov.newsSideLeft,  { backgroundColor: '#c62828' }]} />
      <View style={[tov.newsSideBar, tov.newsSideRight, { backgroundColor: '#c62828' }]} />
    </>
  );
}

// ─── FitnessHUDLayer ──────────────────────────────────────────────────────────

function FitnessHUDLayer({ accentColor, progress, elapsed }: { accentColor: string; progress: number; elapsed: number }) {
  const repFlash = useRef(new Animated.Value(0)).current;
  const prevProg = useRef(progress);
  useEffect(() => {
    const pct = Math.floor(progress * 10);
    if (Math.floor(prevProg.current * 10) !== pct && pct > 0) {
      Animated.sequence([
        Animated.timing(repFlash, { toValue: 1, duration: 150, useNativeDriver: false }),
        Animated.timing(repFlash, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start();
    }
    prevProg.current = progress;
  }, [progress]);
  const motivations = ['PUSH!','GO!','BURN!','POWER!','STRONG!'];
  const motIdx = Math.floor(elapsed / 6000) % motivations.length;
  const intensityColor = progress < 0.33 ? '#22c55e' : progress < 0.66 ? '#f59e0b' : '#ef4444';
  return (
    <>
      <View style={tov.fitnessRingWrap}>
        <View style={[tov.fitnessRingBg, { borderColor: 'rgba(255,255,255,0.15)' }]} />
        <View style={[tov.fitnessRingFill, { borderColor: accentColor,
          // @ts-ignore web
          boxShadow: `0 0 12px ${accentColor}` }]} />
        <Text style={[tov.fitnessRingPct, { color: accentColor }]}>{Math.round(progress * 100)}%</Text>
      </View>
      <Animated.View style={[tov.fitMotivationWrap, { opacity: repFlash, backgroundColor: intensityColor + '22', borderColor: intensityColor }]}>
        <Text style={[tov.fitMotivationText, { color: intensityColor }]}>🔥 {motivations[motIdx]}</Text>
      </Animated.View>
      <View style={[tov.fitBorderGlow, { borderColor: accentColor + '44',
        // @ts-ignore web
        boxShadow: `inset 0 0 20px ${accentColor}22` }]} />
    </>
  );
}

// ─── StarRainLayer ────────────────────────────────────────────────────────────

function StarRainLayer({ color }: { color: string }) {
  const stars = useRef(Array.from({ length: 10 }, (_, i) => ({
    anim:  new Animated.Value(0),
    left:  `${5 + Math.random() * 90}%`,
    size:  14 + Math.random() * 14,
    delay: i * 400,
    dur:   2000 + Math.random() * 1500,
  }))).current;
  useEffect(() => {
    stars.forEach(s => {
      Animated.loop(Animated.sequence([
        Animated.delay(s.delay),
        Animated.timing(s.anim, { toValue: 1, duration: s.dur, useNativeDriver: true }),
        Animated.timing(s.anim, { toValue: 0, duration: 0,     useNativeDriver: true }),
      ])).start();
    });
  }, []);
  return (
    <>
      {stars.map((s, i) => (
        <Animated.Text key={i} style={[tov.starRainItem, {
          left: s.left as any, fontSize: s.size, color,
          opacity: s.anim.interpolate({ inputRange:[0,0.1,0.8,1], outputRange:[0,1,0.8,0] }),
          transform: [{ translateY: s.anim.interpolate({ inputRange:[0,1], outputRange:[-10,600] }) }],
        }]}>✨</Animated.Text>
      ))}
    </>
  );
}

// ─── TemplateOverlay (full redesign) ─────────────────────────────────────────

interface SubtitleEntry { start_ms: number; end_ms: number; text: string; style?: string; }

function TemplateOverlay({ template, elapsed, isRecording }: { template: any; elapsed: number; isRecording: boolean }) {
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const prevSubRef   = useRef<string | undefined>(undefined);
  const liveBlinkAnim= useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(liveBlinkAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
      Animated.timing(liveBlinkAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
    ])).start();
  }, []);

  if (!isRecording || !template) return null;

  const genre  = template.genre ?? 'daily';
  const gs     = GENRE_STYLES[genre] ?? GENRE_STYLES.daily;
  const subs   = (template.subtitle_timeline ?? []) as SubtitleEntry[];
  const currentSub = subs.find(s => elapsed >= s.start_ms && elapsed < s.end_ms);
  const totalMs    = (template.duration_sec ?? 30) * 1000;
  const progress   = Math.min(1, elapsed / totalMs);
  const remainSec  = Math.max(0, (template.duration_sec ?? 30) - Math.floor(elapsed / 1000));
  const overlayBottom = template.virtual_bg?.overlayBottom as string | undefined;

  const isHighlight = currentSub?.style === 'highlight';
  const isBold      = currentSub?.style === 'bold';
  const isNews      = currentSub?.style === 'news';

  const subKey = currentSub?.text;
  if (subKey !== prevSubRef.current) {
    prevSubRef.current = subKey;
    subtitleAnim.setValue(0);
    Animated.spring(subtitleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();
  }

  const layers: any[] = template.layers ?? [];
  const hasSpotlight  = layers.some((l: any) => l.type === 'spotlight') || template.spotlights;
  const hasTicker     = genre === 'news' && (layers.some((l: any) => l.type === 'ticker') || template.ticker);
  const hasStarRain   = layers.some((l: any) => l.type === 'star_rain');
  const starColor     = layers.find((l: any) => l.type === 'star_rain')?.color ?? '#fbbf24';
  const tickerText    = (layers.find((l: any) => l.type === 'ticker')?.text ?? template.ticker ?? '') as string;

  return (
    <>
      {(genre === 'kpop' || genre === 'hiphop') && hasSpotlight && (
        <KpopSpotlights accentColor={gs.accentColor} />
      )}
      {hasStarRain && <StarRainLayer color={starColor} />}
      {hasTicker && <NewsTickerLayer accentColor={gs.accentColor} tickerText={tickerText} />}
      {genre === 'fitness' && (
        <FitnessHUDLayer accentColor={gs.accentColor} progress={progress} elapsed={elapsed} />
      )}

      {/* Top bar */}
      <View style={[tov.topBar, {
        backgroundColor: gs.headerBg, borderBottomColor: gs.borderColor + '88',
        // @ts-ignore web
        boxShadow: `0 2px 16px ${gs.accentColor}22`,
      }]}>
        <View style={[tov.livePill, { backgroundColor: '#ef4444' }]}>
          <Animated.View style={[tov.liveDot, { opacity: liveBlinkAnim }]} />
          <Text style={tov.liveText}>LIVE</Text>
        </View>
        <Text style={[tov.topTitle, { color: gs.textGlow }]} numberOfLines={1}>
          {template.theme_emoji}  {template.name}
        </Text>
        <View style={[tov.timerPill, { backgroundColor: gs.accentColor + '33', borderColor: gs.accentColor + '55' }]}>
          <Text style={[tov.timerText, { color: gs.textGlow }]}>
            {String(Math.floor(remainSec / 60)).padStart(2,'0')}:{String(remainSec % 60).padStart(2,'0')}
          </Text>
        </View>
      </View>

      {/* Subtitle with animated entrance */}
      {currentSub && (
        <Animated.View style={[
          tov.subtitleWrap,
          isHighlight ? { backgroundColor: gs.accentColor + 'dd', borderColor: '#fff5' }
            : isNews  ? { backgroundColor: 'rgba(13,28,53,0.92)', borderColor: '#1565c088', borderLeftWidth: 4, borderLeftColor: '#c62828' }
            : isBold  ? { backgroundColor: 'rgba(0,0,0,0.88)', borderColor: gs.borderColor + '99' }
            :           { backgroundColor: 'rgba(0,0,0,0.75)', borderColor: 'rgba(255,255,255,0.18)' },
          {
            opacity: subtitleAnim,
            transform: [
              { translateY: subtitleAnim.interpolate({ inputRange:[0,1], outputRange:[20,0] }) },
              { scale: subtitleAnim.interpolate({ inputRange:[0,1], outputRange:[0.95,1] }) },
            ],
          },
        ]}>
          {isHighlight && <View style={[tov.subtitleAccentBar, { backgroundColor: '#fff4' }]} />}
          <Text style={[
            tov.subtitleText,
            isHighlight ? { color:'#fff', fontSize:21, fontWeight:'900' } :
            isNews      ? { color:'#e3f2fd', fontSize:17, fontWeight:'700', fontStyle:'italic' } :
            isBold      ? { color:gs.textGlow, fontSize:19, fontWeight:'800' } :
                          { color:'#f0f0f0', fontSize:17, fontWeight:'700' },
            // @ts-ignore web
            { textShadow:'0 2px 8px rgba(0,0,0,0.8)' },
          ]} numberOfLines={3}>
            {currentSub.text}
          </Text>
        </Animated.View>
      )}

      {/* Bottom hashtag bar */}
      <View style={[tov.bottomBar, { backgroundColor: gs.headerBg, borderTopColor: gs.borderColor + '66' }]}>
        <Text style={[tov.bottomText, { color: gs.textGlow + 'cc' }]} numberOfLines={1}>
          {overlayBottom ?? (template.sns_template?.hashtags ?? []).slice(0,6).map((h: string) => '#' + h).join('  ')}
        </Text>
      </View>

      {/* Progress bar with glow */}
      <View style={tov.progressTrack}>
        <View style={[tov.progressFill, {
          width: `${progress * 100}%` as any,
          backgroundColor: gs.accentColor,
          // @ts-ignore web
          boxShadow: `0 0 8px ${gs.accentColor}, 0 0 16px ${gs.accentColor}66`,
        }]} />
      </View>
    </>
  );
}

const tov = StyleSheet.create({
  topBar:        { position:'absolute', top:0, left:0, right:0, zIndex:20, flexDirection:'row', alignItems:'center', paddingVertical:8, paddingHorizontal:12, gap:10, borderBottomWidth:1 },
  livePill:      { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:8, paddingVertical:4, borderRadius:6 },
  liveDot:       { width:6, height:6, borderRadius:3, backgroundColor:'#fff' },
  liveText:      { color:'#fff', fontSize:11, fontWeight:'900', letterSpacing:1 },
  topTitle:      { flex:1, fontSize:13, fontWeight:'800', letterSpacing:0.5 },
  timerPill:     { paddingHorizontal:10, paddingVertical:4, borderRadius:8, borderWidth:1 },
  timerText:     { fontSize:14, fontWeight:'900', fontVariant:['tabular-nums'] as any },
  // K-POP
  spotBeam:      { position:'absolute', top:46, width:4, height:'65%', zIndex:18, transform:[{ skewX:'12deg' }] as any },
  beatFlash:     { position:'absolute', top:46, left:0, right:0, bottom:44, borderWidth:2, zIndex:17 },
  // NEWS
  newsBreakingBar:   { position:'absolute', top:46, left:0, right:0, zIndex:19, flexDirection:'row', alignItems:'center', paddingVertical:5, paddingHorizontal:10, gap:8 },
  newsBreakingLeft:  { flexDirection:'row', alignItems:'center', gap:5 },
  newsLiveDot:       { width:8, height:8, borderRadius:4, backgroundColor:'#fff' },
  newsBreakingLabel: { color:'#fff', fontSize:10, fontWeight:'900', letterSpacing:1.5, backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:6, paddingVertical:2, borderRadius:3 },
  newsBreakingText:  { color:'#fff', fontSize:12, fontWeight:'700', flex:1 },
  newsTickerTrack:   { position:'absolute', bottom:62, left:0, right:0, zIndex:19, paddingVertical:6, paddingHorizontal:12, overflow:'hidden' },
  newsTickerText:    { color:'#fff', fontSize:13, fontWeight:'700', letterSpacing:0.5 },
  lowerThird:        { position:'absolute', bottom:90, left:0, zIndex:18, flexDirection:'row', alignItems:'stretch', overflow:'hidden' },
  lowerThirdAccent:  { width:5 },
  lowerThirdText:    { color:'#fff', fontSize:12, fontWeight:'700', paddingHorizontal:12, paddingVertical:7, letterSpacing:0.5 },
  newsSideBar:       { position:'absolute', top:68, bottom:62, width:3, zIndex:17, opacity:0.7 },
  newsSideLeft:      { left:0 },
  newsSideRight:     { right:0 },
  // FITNESS
  fitnessRingWrap:   { position:'absolute', top:56, left:10, zIndex:21, width:64, height:64, alignItems:'center', justifyContent:'center' },
  fitnessRingBg:     { position:'absolute', width:60, height:60, borderRadius:30, borderWidth:4 },
  fitnessRingFill:   { position:'absolute', width:60, height:60, borderRadius:30, borderWidth:4, borderTopColor:'transparent', borderRightColor:'transparent' },
  fitnessRingPct:    { fontSize:13, fontWeight:'900' },
  fitMotivationWrap: { position:'absolute', top:56, alignSelf:'center', zIndex:21, paddingHorizontal:16, paddingVertical:6, borderRadius:16, borderWidth:1.5 },
  fitMotivationText: { fontSize:16, fontWeight:'900', letterSpacing:1 },
  fitBorderGlow:     { position:'absolute', top:46, left:0, right:0, bottom:44, borderWidth:2, zIndex:17 },
  // STAR RAIN
  starRainItem:  { position:'absolute', top:50, zIndex:16 },
  // SUBTITLE
  subtitleWrap:  { position:'absolute', bottom:120, left:12, right:12, borderRadius:16, borderWidth:1.5, paddingVertical:13, paddingHorizontal:18, alignItems:'center', zIndex:22, overflow:'hidden',
    // @ts-ignore web
    backdropFilter:'blur(16px)' },
  subtitleAccentBar: { position:'absolute', top:0, left:0, right:0, height:2, borderRadius:2 },
  subtitleText:  { textAlign:'center', lineHeight:28 },
  // BOTTOM
  bottomBar:     { position:'absolute', bottom:44, left:0, right:0, zIndex:20, paddingVertical:7, paddingHorizontal:14, borderTopWidth:1, alignItems:'center' },
  bottomText:    { fontSize:11, fontWeight:'700', letterSpacing:0.5 },
  // PROGRESS
  progressTrack: { position:'absolute', bottom:0, left:0, right:0, height:3, backgroundColor:'rgba(255,255,255,0.12)', zIndex:30 },
  progressFill:  { height:'100%', borderRadius:1.5 },
});

// ─── Squat HUD ───────────────────────────────────────────────────────────────

function SquatHUD({ count, phase, kneeAngle }: { count:number; phase:'up'|'down'|'unknown'; kneeAngle:number }) {
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const prevCount  = useRef(count);
  useEffect(() => {
    if (count !== prevCount.current) {
      prevCount.current = count;
      Animated.sequence([
        Animated.spring(bounceAnim, { toValue: 1.5, tension:150, friction:5, useNativeDriver:true }),
        Animated.spring(bounceAnim, { toValue: 1.0, tension:80,  friction:8, useNativeDriver:true }),
      ]).start();
    }
  }, [count]);
  const phaseColor = phase === 'down' ? '#22c55e' : phase === 'up' ? '#f59e0b' : '#94a3b8';
  const phaseLabel = phase === 'down' ? '⬇️ 내려가는 중' : phase === 'up' ? '⬆️ 올라가는 중' : '🏋️ 준비';
  const depthPct   = Math.max(0, Math.min(100, ((180 - kneeAngle) / 90) * 100));
  return (
    <View style={sq.wrap}>
      <Animated.View style={[sq.countBox, { transform:[{ scale:bounceAnim }] }]}>
        <Text style={sq.countNum}>{count}</Text>
        <Text style={sq.countLabel}>개</Text>
      </Animated.View>
      <View style={sq.gaugeWrap}>
        <Text style={sq.gaugeLabel}>스쿼트 깊이</Text>
        <View style={sq.gaugeBg}>
          <View style={[sq.gaugeFill, { width:`${depthPct}%` as any, backgroundColor: depthPct>70?'#22c55e':depthPct>40?'#f59e0b':'#ef4444' }]} />
        </View>
        <Text style={[sq.phaseLabel, { color:phaseColor }]}>{phaseLabel}</Text>
      </View>
      <View style={sq.angleBox}>
        <Text style={sq.angleNum}>{Math.round(kneeAngle)}°</Text>
        <Text style={sq.angleLabel}>무릎</Text>
      </View>
    </View>
  );
}
const sq = StyleSheet.create({
  wrap:       { position:'absolute', top:60, right:10, flexDirection:'column', alignItems:'center', gap:6, zIndex:31, backgroundColor:'rgba(0,0,0,0.75)',
    // @ts-ignore web
    backdropFilter:'blur(12px)', borderRadius:18, padding:12, borderWidth:1.5, borderColor:'rgba(20,184,166,0.5)',
    // @ts-ignore web
    boxShadow:'0 0 20px rgba(20,184,166,0.3)', minWidth:90 },
  countBox:   { flexDirection:'row', alignItems:'flex-end', gap:2 },
  countNum:   { color:'#14b8a6', fontSize:56, fontWeight:'900', lineHeight:60 },
  countLabel: { color:'#5eead4', fontSize:20, fontWeight:'700', paddingBottom:4 },
  gaugeWrap:  { width:80, gap:4, alignItems:'center' },
  gaugeLabel: { color:'rgba(255,255,255,0.55)', fontSize:9, fontWeight:'600' },
  gaugeBg:    { width:'100%', height:7, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:4, overflow:'hidden' },
  gaugeFill:  { height:'100%', borderRadius:4 },
  phaseLabel: { fontSize:9, fontWeight:'700', textAlign:'center' },
  angleBox:   { alignItems:'center' },
  angleNum:   { color:'rgba(255,255,255,0.8)', fontSize:18, fontWeight:'900' },
  angleLabel: { color:'rgba(255,255,255,0.4)', fontSize:9, fontWeight:'600' },
});

// ─── Voice Transcript Overlay ─────────────────────────────────────────────────

function VoiceTranscriptOverlay({ transcript, readText }: { transcript:string; readText?:string }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: transcript ? 1 : 0.6, duration:250, useNativeDriver:true }).start();
  }, [!!transcript]);
  return (
    <Animated.View style={[vtv.wrap, { opacity:fadeAnim }]}>
      {readText && (
        <View style={vtv.scriptBox}>
          <Text style={vtv.scriptLabel}>📜 따라 읽을 문장</Text>
          <Text style={vtv.scriptText}>{readText}</Text>
        </View>
      )}
      <View style={[vtv.transcriptBox, transcript ? vtv.transcriptActive : vtv.transcriptEmpty]}>
        <Text style={vtv.micIcon}>🎤</Text>
        <Text style={vtv.transcriptText} numberOfLines={3}>{transcript || '지금 말해주세요...'}</Text>
        {!transcript && (
          <View style={vtv.dotRow}>
            {[0,1,2].map(i => <View key={i} style={[vtv.dot, { opacity: 0.3 + i * 0.25 }]} />)}
          </View>
        )}
      </View>
    </Animated.View>
  );
}
const vtv = StyleSheet.create({
  wrap:            { position:'absolute', bottom:150, left:8, right:8, gap:6, zIndex:25, alignItems:'center' },
  scriptBox:       { width:'100%', backgroundColor:'rgba(30,30,60,0.90)',
    // @ts-ignore web
    backdropFilter:'blur(14px)', borderRadius:14, paddingVertical:10, paddingHorizontal:16, borderWidth:1, borderColor:'rgba(124,58,237,0.4)', alignItems:'center', gap:4 },
  scriptLabel:     { color:'rgba(167,139,250,0.8)', fontSize:11, fontWeight:'700', letterSpacing:0.5 },
  scriptText:      { color:'#c4b5fd', fontSize:18, fontWeight:'800', textAlign:'center', lineHeight:26,
    // @ts-ignore web
    textShadow:'0 0 12px rgba(167,139,250,0.6)' },
  transcriptBox:   { width:'100%', borderRadius:16, paddingVertical:14, paddingHorizontal:18, borderWidth:2, alignItems:'center', gap:6,
    // @ts-ignore web
    backdropFilter:'blur(14px)' },
  transcriptActive:{ backgroundColor:'rgba(34,197,94,0.18)', borderColor:'rgba(34,197,94,0.6)',
    // @ts-ignore web
    boxShadow:'0 0 18px rgba(34,197,94,0.3)' },
  transcriptEmpty: { backgroundColor:'rgba(0,0,0,0.60)', borderColor:'rgba(255,255,255,0.15)' },
  micIcon:         { fontSize:22 },
  transcriptText:  { color:'#fff', fontSize:22, fontWeight:'900', textAlign:'center', lineHeight:30,
    // @ts-ignore web
    textShadow:'0 2px 8px rgba(0,0,0,0.6)' },
  dotRow:          { flexDirection:'row', gap:6 },
  dot:             { width:8, height:8, borderRadius:4, backgroundColor:'#94a3b8' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecordScreen() {
  const router    = useRouter();
  const cameraRef = useRef<RecordingCameraHandle>(null);
  const { width } = useWindowDimensions();

  const activeTemplate = useSessionStore(s => s.activeTemplate);
  const sessionKey     = useSessionStore(s => s.sessionKey);
  const defaultFacing  = activeTemplate?.camera_mode === 'selfie' ? 'front' : 'back';
  const [facing, setFacing] = useState<'front' | 'back'>(defaultFacing);

  const { isReady, landmarks, setSquatMockMode } = usePoseDetection();
  const { judge, voiceTranscript, squatCount, resetVoice } = useJudgement();
  const { state, countdown, elapsed, videoUri, start, stop, reset: resetRecording } = useRecording();

  // Intro / outro state
  const [showIntro,  setShowIntro]  = useState(false);
  const [showOutro,  setShowOutro]  = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const introShownRef = useRef(false);

  // Judgement state
  const [currentScore,   setCurrentScore]   = useState(0);
  const [currentTag,     setCurrentTag]     = useState<JudgementTag>('fail');
  const [currentMission, setCurrentMission] = useState<any>(null);
  const [squatKneeAngle, setSquatKneeAngle] = useState(180);
  const [squatPhase,     setSquatPhase]     = useState<'up'|'down'|'unknown'>('unknown');

  // Visual effects
  const [burstVisible, setBurstVisible] = useState(false);
  const [burstTag,     setBurstTag]     = useState<JudgementTag | null>(null);
  const [combo,        setCombo]        = useState(0);
  const [particles,    setParticles]    = useState<Particle[]>([]);
  const [charState,    setCharState]    = useState<keyof typeof CHAR>('idle');

  const charScale   = useRef(new Animated.Value(1)).current;
  const missionAnim = useRef(new Animated.Value(0)).current;
  const hudOpacity  = useRef(new Animated.Value(0)).current;

  const prevTagRef        = useRef<JudgementTag>('fail');
  const prevCountdownRef  = useRef<number>(3);
  const comboRef          = useRef(0);
  const burstTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMissionSeqRef = useRef<number | null>(null);
  const bgmStopRef        = useRef<(() => void) | null>(null);
  const scoreAccumRef     = useRef<number[]>([]);

  const maxW = Math.min(width - 32, 500);

  // sessionKey change → full reset
  const prevSessionKeyRef = useRef<number>(-1);
  useEffect(() => {
    if (!activeTemplate) return;
    if (sessionKey === prevSessionKeyRef.current) return;
    prevSessionKeyRef.current = sessionKey;
    prewarmMic();
    try { setSquatMockMode(activeTemplate?.genre === 'fitness'); } catch { /* ignore */ }
    resetRecording();
    resetVoice();
    comboRef.current = 0; setCombo(0);
    prevMissionSeqRef.current = null;
    prevTagRef.current = 'fail';
    setCharState('idle'); setCurrentScore(0); setCurrentTag('fail'); setCurrentMission(null);
    setParticles([]); setBurstVisible(false); setSquatKneeAngle(180); setSquatPhase('unknown');
    hudOpacity.setValue(0); scoreAccumRef.current = []; setFinalScore(0);
    setShowOutro(false); setShowIntro(false); introShownRef.current = false;
  }, [sessionKey]); // eslint-disable-line

  useEffect(() => { if (!activeTemplate) router.back(); }, [activeTemplate]);
  useEffect(() => () => {
    resetVoice();
    if (bgmStopRef.current) { bgmStopRef.current(); bgmStopRef.current = null; }
  }, [resetVoice]);

  // HUD fade
  useEffect(() => {
    if (state === 'recording') Animated.timing(hudOpacity, { toValue:1, duration:400, useNativeDriver:true }).start();
    else hudOpacity.setValue(0);
  }, [state]);

  const bounceChar = useCallback(() => {
    Animated.sequence([
      Animated.spring(charScale, { toValue:1.5, tension:120, friction:5, useNativeDriver:true }),
      Animated.spring(charScale, { toValue:1.0, tension:80,  friction:6, useNativeDriver:true }),
    ]).start();
  }, [charScale]);

  const addParticles = useCallback(() => {
    const pts: Particle[] = Array.from({ length:12 }, (_, i) => ({
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
    Animated.spring(missionAnim, { toValue:1, tension:65, friction:8, useNativeDriver:true }).start();
  }, [missionAnim]);

  // Core judgement loop
  useEffect(() => {
    if (state !== 'recording') return;
    const result = judge(landmarks, elapsed);
    setCurrentScore(result.score); setCurrentTag(result.tag); setCurrentMission(result.currentMission);
    scoreAccumRef.current.push(result.score);
    if (activeTemplate?.genre === 'fitness') { setSquatKneeAngle(result.kneeAngle); setSquatPhase(result.squatPhase); }
    if (result.currentMission && result.currentMission.seq !== prevMissionSeqRef.current) {
      prevMissionSeqRef.current = result.currentMission.seq;
      animateMissionIn();
      const m = result.currentMission;
      const text = m.type === 'voice_read' && m.read_text ? `따라 읽어주세요: ${m.read_text}` : m.guide_text ?? '';
      if (text) speakMission(text);
    }
    if (result.tag !== prevTagRef.current) {
      const prev = prevTagRef.current;
      prevTagRef.current = result.tag;
      if (result.tag === 'perfect') {
        playSound('perfect'); setCharState('perfect'); addParticles(); bounceChar();
        comboRef.current += 1; setCombo(comboRef.current);
        if (comboRef.current >= 3) { playSound('combo'); speakJudgement('combo'); } else speakJudgement('perfect');
      } else if (result.tag === 'good') {
        playSound('good'); setCharState('good'); bounceChar();
        comboRef.current += 1; setCombo(comboRef.current); speakJudgement('good');
      } else {
        if (comboRef.current >= 2) { playSound('oops'); speakJudgement('fail'); }
        comboRef.current = 0; setCombo(0); setCharState('fail');
      }
      if (result.tag !== 'fail' || prev !== 'fail') {
        if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
        setBurstTag(result.tag); setBurstVisible(true);
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

  // Recording start → intro + BGM
  useEffect(() => {
    if (state === 'recording') {
      playSound('start');
      setCharState('idle'); comboRef.current = 0; setCombo(0);
      prevMissionSeqRef.current = null; scoreAccumRef.current = [];
      if (activeTemplate?.intro && !introShownRef.current) {
        introShownRef.current = true;
        setShowIntro(true);
      }
      const genreBGM: Record<string, BGMSpec['genre']> = {
        kpop:'kpop', hiphop:'kpop', news:'news', english:'bright', kids:'fairy',
        daily:'lofi', travel:'bright', fitness:'kpop', challenge:'kpop', promotion:'news',
      };
      const bgmGenre = genreBGM[activeTemplate?.genre ?? ''] ?? 'lofi';
      try {
        const audioCtx = initAudio();
        if (bgmStopRef.current) bgmStopRef.current();
        bgmStopRef.current = createGameBGM(audioCtx, { genre: bgmGenre, bpm:120, volume:0.35 }, audioCtx.destination);
      } catch (e) { console.warn('[BGM] 초기화 실패:', e); }
    } else {
      if (bgmStopRef.current) { bgmStopRef.current(); bgmStopRef.current = null; }
    }
  }, [state]);

  // Done → outro then navigate
  useEffect(() => {
    if (state !== 'done' || !videoUri) return;
    resetVoice();
    const scores = scoreAccumRef.current;
    const avg = scores.length > 0 ? scores.reduce((a,b) => a+b, 0) / scores.length : 0;
    setFinalScore(avg);
    if (activeTemplate?.outro) {
      setShowOutro(true);
    } else {
      navigateToResult();
    }
  }, [state, videoUri]);

  const navigateToResult = useCallback(() => {
    if (!videoUri) return;
    if (!activeTemplate) { router.push({ pathname:'/(main)/result', params:{ videoUri } }); return; }
    const vt = getTemplateByMissionId(activeTemplate.genre);
    router.push({ pathname:'/(main)/result', params:{ videoUri, ...(vt ? { videoTemplateId: vt.id } : {}) } });
  }, [videoUri, activeTemplate, router]);

  const handleFrame = useCallback(async () => {}, []);

  if (!activeTemplate) return null;

  const isCountdown = state === 'countdown';
  const isRecording = state === 'recording';
  const isIdle      = state === 'idle';
  const virtualBg   = activeTemplate.virtual_bg;
  const missionProg = currentMission
    ? Math.min(1, Math.max(0, (elapsed - currentMission.start_ms) / Math.max(1, currentMission.end_ms - currentMission.start_ms)))
    : 0;
  const char = CHAR[charState];

  return (
    <View style={r.root}>
      <SafeAreaView style={r.safe} edges={['top','bottom']}>
        <View style={r.camWrap}>
          <VirtualBackgroundFrame bg={virtualBg}>
            <RecordingCamera
              ref={cameraRef} facing={facing} onFrame={handleFrame}
              paused={isIdle || state === 'processing'}
              onPermissionDenied={() => { Alert.alert('카메라 권한 필요','브라우저에서 카메라를 허용해주세요.'); router.back(); }}
            >
              {/* PARTICLES */}
              {particles.map(p => <Text key={p.id} style={[r.particle, { left: p.left as any }]}>{p.emoji}</Text>)}

              {/* HUD top row */}
              <Animated.View style={[r.topHud, { opacity: hudOpacity }]}>
                <View style={r.recBadge}><View style={r.recDot} /><Text style={r.recText}>REC</Text></View>
                <NeonScore score={currentScore} tag={currentTag} />
                {combo >= 2 && (
                  <View style={[r.comboPill, combo >= 5 && r.comboPillHot]}>
                    <Text style={r.comboText}>🔥 {combo}x</Text>
                  </View>
                )}
                <View style={{ flex:1 }} />
                <TouchableOpacity style={r.flipBtn} onPress={() => setFacing(f => f==='front'?'back':'front')} hitSlop={{top:12,bottom:12,left:12,right:12}}>
                  <Text style={r.flipText}>🔄</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* CHARACTER */}
              {isRecording && !showIntro && (
                <Animated.View style={[r.charArea, { transform:[{ scale:charScale }] }]}>
                  <View style={[r.charBubble, { backgroundColor: char.color+'2a',
                    // @ts-ignore web
                    boxShadow:`0 0 20px ${char.glow}, 0 0 40px ${char.glow}`, borderColor: char.color+'55' }]}>
                    <Text style={r.charEmoji}>{char.emoji}</Text>
                  </View>
                </Animated.View>
              )}

              {/* SQUAT HUD */}
              {isRecording && !showIntro && activeTemplate?.genre === 'fitness' && (
                <SquatHUD count={squatCount} phase={squatPhase} kneeAngle={squatKneeAngle} />
              )}

              {/* MISSION CARD */}
              {isRecording && !showIntro && currentMission && currentMission.type !== 'voice_read' && (
                <MissionCard mission={currentMission} progress={missionProg} tag={currentTag} voiceTranscript={voiceTranscript} anim={missionAnim} maxW={maxW} />
              )}

              {/* VOICE TRANSCRIPT */}
              {isRecording && !showIntro && currentMission?.type === 'voice_read' && (
                <VoiceTranscriptOverlay transcript={voiceTranscript} readText={currentMission.read_text} />
              )}

              {/* PRE-RECORD INFO */}
              {isIdle && (
                <View style={[r.infoOverlay, { maxWidth: maxW }]}>
                  <Text style={r.infoEmoji}>{activeTemplate.theme_emoji}</Text>
                  <Text style={r.infoTitle}>{activeTemplate.name}</Text>
                  <Text style={r.infoMeta}>{activeTemplate.duration_sec}초 · {activeTemplate.missions.length}개 미션</Text>
                  {activeTemplate.scene ? <Text style={r.infoScene} numberOfLines={3}>{activeTemplate.scene}</Text> : null}
                  {activeTemplate.intro && (
                    <View style={r.introBadge}><Text style={r.introBadgeText}>✨ 드라마틱 인트로 포함</Text></View>
                  )}
                  {activeTemplate.camera_mode === 'selfie' && (
                    <View style={r.selfieChip}><Text style={r.selfieText}>📱 전면 카메라 모드</Text></View>
                  )}
                  <TouchableOpacity style={r.flipBtnIdle} onPress={() => setFacing(f => f==='front'?'back':'front')}>
                    <Text style={r.flipBtnIdleText}>🔄 {facing==='front'?'후면으로':'전면으로'} 전환</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* COUNTDOWN */}
              {isCountdown && <CountdownOverlay count={countdown} templateName={activeTemplate.name} emoji={activeTemplate.theme_emoji} />}

              {/* TEMPLATE OVERLAY */}
              <TemplateOverlay template={activeTemplate} elapsed={elapsed} isRecording={isRecording && !showIntro} />

              {/* TIMING BAR */}
              {isRecording && !showIntro && (
                <View style={r.timingBarWrap}><TimingBar template={activeTemplate} elapsedMs={elapsed} /></View>
              )}

              {/* JUDGEMENT BURST */}
              {isRecording && !showIntro && <JudgementBurst tag={burstTag} combo={combo} visible={burstVisible} />}

              {/* STOP */}
              {isRecording && !showIntro && (
                <View style={r.stopArea}>
                  <TouchableOpacity style={r.stopBtn} onPress={() => cameraRef.current && stop(cameraRef.current)} hitSlop={{top:16,bottom:16,left:16,right:16}}>
                    <View style={r.stopIcon} />
                  </TouchableOpacity>
                  <Text style={r.stopHint}>탭하여 중지</Text>
                </View>
              )}

              {/* START */}
              {isIdle && (
                <View style={[r.startArea, { maxWidth: maxW }]}>
                  <Pressable style={r.startBtn} onPress={() => { initAudio(); if (cameraRef.current) start(cameraRef.current); }}>
                    <View style={r.startGlow} />
                    <Text style={r.startBtnText}>▶  챌린지 시작</Text>
                  </Pressable>
                  <TouchableOpacity style={r.cancelBtn} onPress={() => router.back()} hitSlop={{top:12,bottom:12,left:24,right:24}}>
                    <Text style={r.cancelText}>← 취소</Text>
                  </TouchableOpacity>
                </View>
              )}
            </RecordingCamera>
          </VirtualBackgroundFrame>

          {/* INTRO OVERLAY — outside RecordingCamera so it covers everything */}
          {showIntro && activeTemplate.intro && (
            <IntroOverlay intro={activeTemplate.intro} genre={activeTemplate.genre} onDone={() => setShowIntro(false)} />
          )}

          {/* OUTRO OVERLAY */}
          {showOutro && activeTemplate.outro && (
            <OutroOverlay outro={activeTemplate.outro} score={finalScore} onDone={() => { setShowOutro(false); navigateToResult(); }} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const r = StyleSheet.create({
  root:    { flex:1, backgroundColor:'#000' },
  safe:    { flex:1 },
  camWrap: { flex:1 },
  particle: { position:'absolute', top:'10%', fontSize:30, zIndex:50,
    // @ts-ignore web
    animation:'float 1.6s ease-out forwards' },
  topHud:      { position:'absolute', top:12, left:12, right:12, flexDirection:'row', alignItems:'center', gap:8, zIndex:30 },
  recBadge:    { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(0,0,0,0.72)', paddingHorizontal:11, paddingVertical:5, borderRadius:8, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  recDot:      { width:8, height:8, borderRadius:4, backgroundColor:'#ef4444' },
  recText:     { color:'#fff', fontSize:12, fontWeight:'900', letterSpacing:1 },
  comboPill:   { backgroundColor:'rgba(239,68,68,0.85)', paddingHorizontal:10, paddingVertical:4, borderRadius:12 },
  comboPillHot:{ backgroundColor:'rgba(234,179,8,0.9)' },
  comboText:   { color:'#fff', fontSize:12, fontWeight:'800' },
  flipBtn:     { width:40, height:40, borderRadius:20, backgroundColor:'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  flipText:    { fontSize:18 },
  charArea:    { position:'absolute', top:60, alignSelf:'center', alignItems:'center', zIndex:20 },
  charBubble:  { width:70, height:70, borderRadius:35, alignItems:'center', justifyContent:'center', borderWidth:1.5 },
  charEmoji:   { fontSize:42 },
  infoOverlay: { position:'absolute', top:'18%', alignSelf:'center', width:'90%', backgroundColor:'rgba(0,0,0,0.85)',
    // @ts-ignore web
    backdropFilter:'blur(20px)', borderRadius:28, padding:28, alignItems:'center', gap:10, zIndex:20, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  infoEmoji:   { fontSize:60 },
  infoTitle:   { color:'#fff', fontSize:24, fontWeight:'900', textAlign:'center',
    // @ts-ignore web
    textShadow:'0 2px 12px rgba(124,58,237,0.6)' },
  infoMeta:    { color:'#94a3b8', fontSize:13, fontWeight:'600' },
  infoScene:   { color:'#cbd5e1', fontSize:13, textAlign:'center', lineHeight:20, fontStyle:'italic' },
  introBadge:  { backgroundColor:'rgba(124,58,237,0.2)', borderRadius:20, paddingHorizontal:16, paddingVertical:6, borderWidth:1, borderColor:'rgba(124,58,237,0.5)' },
  introBadgeText: { color:'#c4b5fd', fontSize:12, fontWeight:'700' },
  selfieChip:  { backgroundColor:'rgba(124,58,237,0.2)', borderRadius:12, paddingHorizontal:14, paddingVertical:6, borderWidth:1, borderColor:'rgba(124,58,237,0.4)' },
  selfieText:  { color:'#a78bfa', fontSize:12, fontWeight:'700' },
  flipBtnIdle: { marginTop:4, backgroundColor:'rgba(255,255,255,0.1)', paddingHorizontal:22, paddingVertical:12, borderRadius:20, borderWidth:1, borderColor:'rgba(255,255,255,0.2)', minHeight:46, justifyContent:'center' },
  flipBtnIdleText: { color:'#e2e8f0', fontSize:13, fontWeight:'700' },
  timingBarWrap: { position:'absolute', bottom:100, left:0, right:0, zIndex:10 },
  stopArea:    { position:'absolute', bottom:24, alignSelf:'center', alignItems:'center', gap:8, zIndex:35 },
  stopBtn:     { width:72, height:72, borderRadius:36, backgroundColor:'rgba(255,255,255,0.1)', borderWidth:3.5, borderColor:'#fff', alignItems:'center', justifyContent:'center',
    // @ts-ignore web
    boxShadow:'0 0 20px rgba(255,255,255,0.3)' },
  stopIcon:    { width:26, height:26, backgroundColor:'#ef4444', borderRadius:6 },
  stopHint:    { color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:'500' },
  startArea:   { position:'absolute', bottom:28, alignSelf:'center', width:'90%', alignItems:'center', gap:14, zIndex:35 },
  startBtn:    { width:'100%', paddingVertical:20, borderRadius:28, alignItems:'center', justifyContent:'center', minHeight:64,
    // @ts-ignore web
    background:'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
    backgroundColor:'#7c3aed', overflow:'hidden', position:'relative' },
  startGlow:   { position:'absolute', inset:0 as any,
    // @ts-ignore web
    boxShadow:'inset 0 1px 0 rgba(255,255,255,0.2)' },
  startBtnText:{ color:'#fff', fontSize:20, fontWeight:'900', letterSpacing:1,
    // @ts-ignore web
    textShadow:'0 2px 8px rgba(0,0,0,0.3)', zIndex:1 },
  cancelBtn:   { paddingVertical:10 },
  cancelText:  { color:'rgba(255,255,255,0.45)', fontSize:14, fontWeight:'500' },
});
