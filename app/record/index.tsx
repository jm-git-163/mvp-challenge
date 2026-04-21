/**
 * record/index.tsx — 챌린지 촬영 화면 v4
 * Top mobile game HUD quality — all 8 tasks implemented
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  useWindowDimensions, Alert, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import RecordingCamera, { type RecordingCameraHandle } from '../../components/camera/RecordingCamera';
import TimingBar              from '../../components/ui/TimingBar';
import JudgementBurst         from '../../components/mission/JudgementBurst';

import { usePoseDetection }          from '../../hooks/usePoseDetection';
import { useJudgement, prewarmSpeech } from '../../hooks/useJudgement';
import { useRecording }              from '../../hooks/useRecording';
import { useSessionStore }           from '../../store/sessionStore';
import { playSound, initAudio, speakJudgement, createGameBGM, type BGMSpec } from '../../utils/soundUtils';
import { getBgmPlayer, getBgmTrackUrl } from '../../utils/bgmLibrary';
// prewarmMic 제거 — 별도 오디오 getUserMedia가 마이크 팝업 유발
import { getTemplateByMissionId }    from '../../utils/videoTemplates';
import type { JudgementTag }         from '../../types/session';
import { Claude } from '../../constants/claudeTheme';
import type { TemplateIntro, TemplateOutro } from '../../types/template';
import { UnloadGuard } from '../../engine/studio/unloadGuard';

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

// ─── Genre colors ─────────────────────────────────────────────────────────────

const GENRE_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
  kpop:    { primary: '#e94560', secondary: '#c2185b', glow: 'rgba(233,69,96,0.5)' },
  fitness: { primary: '#14b8a6', secondary: '#0d9488', glow: 'rgba(20,184,166,0.5)' },
  news:    { primary: '#1565c0', secondary: '#0d47a1', glow: 'rgba(21,101,192,0.5)' },
  daily:   { primary: '#7c3aed', secondary: '#5b21b6', glow: 'rgba(124,58,237,0.5)' },
  kids:    { primary: '#a855f7', secondary: '#ec4899', glow: 'rgba(168,85,247,0.5)' },
  travel:  { primary: '#f59e0b', secondary: '#d97706', glow: 'rgba(245,158,11,0.5)' },
  hiphop:  { primary: '#f7b731', secondary: '#f0a500', glow: 'rgba(247,183,49,0.5)' },
  english: { primary: '#2563eb', secondary: '#1e3a8a', glow: 'rgba(37,99,235,0.5)' },
};
function genreColor(genre: string) { return GENRE_COLORS[genre] ?? GENRE_COLORS.daily; }

// ─── Character config ─────────────────────────────────────────────────────────

const CHAR: Record<string, { emoji: string; color: string; glow: string }> = {
  idle:    { emoji: '🎬', color: '#7c3aed', glow: 'rgba(124,58,237,0.5)' },
  perfect: { emoji: '🌟', color: '#f59e0b', glow: 'rgba(245,158,11,0.7)' },
  good:    { emoji: '😄', color: '#22c55e', glow: 'rgba(34,197,94,0.5)'  },
  fail:    { emoji: '💪', color: '#64748b', glow: 'rgba(100,116,139,0.3)' },
};

const PARTICLES = ['⭐', '✨', '🎉', '💫', '🌟', '🎊', '🔥', '💥', '⚡', '🌈'];
interface Particle { id: number; emoji: string; left: string; speed: number; }

// ─── NeonScore ────────────────────────────────────────────────────────────────

function NeonScore({ score, tag }: { score: number; tag: JudgementTag }) {
  const glowAnim = useRef(new Animated.Value(0.5)).current;
  const color =
    tag === 'perfect' ? '#22c55e' :
    tag === 'good'    ? '#f59e0b' : 'rgba(255,255,255,0.35)';
  const glowColor =
    tag === 'perfect' ? 'rgba(34,197,94,0.7)' :
    tag === 'good'    ? 'rgba(245,158,11,0.6)' : 'transparent';

  useEffect(() => {
    if (tag === 'perfect') {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 400, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 400, useNativeDriver: false }),
      ])).start();
    } else {
      glowAnim.setValue(0.5);
    }
  }, [tag]);

  return (
    <Animated.View style={[ns.wrap, {
      borderColor: color,
      // @ts-ignore web
      boxShadow: tag !== 'fail' ? `0 0 12px ${glowColor}, 0 0 24px ${glowColor}` : 'none',
    }]}>
      <Text style={[ns.num, { color }]}>{Math.round(score * 100)}</Text>
      <Text style={[ns.label, { color: color + 'aa' }]}>점수</Text>
    </Animated.View>
  );
}
const ns = StyleSheet.create({
  wrap:  { borderWidth: 2, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(0,0,0,0.7)', minWidth: 56, alignItems: 'center', gap: 0 },
  num:   { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, lineHeight: 24 },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, lineHeight: 12 },
});

// ─── IntroOverlay ─────────────────────────────────────────────────────────────

function IntroOverlay({ intro, genre, onDone }: { intro: TemplateIntro; genre: string; onDone: () => void }) {
  const masterOpacity  = useRef(new Animated.Value(0)).current;
  const titleScale     = useRef(new Animated.Value(intro.animation === 'zoom_in' ? 3 : 0.3)).current;
  const titleOpacity   = useRef(new Animated.Value(0)).current;
  const subOpacity     = useRef(new Animated.Value(0)).current;
  const barWidth       = useRef(new Animated.Value(0)).current;
  const glowAnim       = useRef(new Animated.Value(0.3)).current;
  const bgmBadgeOpac   = useRef(new Animated.Value(0)).current;
  const challengeOpac  = useRef(new Animated.Value(0)).current;
  const emojiScale     = useRef(new Animated.Value(0)).current;

  const particleAnims  = useRef(
    Array.from({ length: 8 }, () => ({
      x: new Animated.Value(0), y: new Animated.Value(0),
      opacity: new Animated.Value(0), scale: new Animated.Value(0),
    }))
  ).current;

  const slideAnims = useRef(
    Array.from({ length: 4 }, () => new Animated.Value(80))
  ).current;

  useEffect(() => {
    Animated.timing(masterOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();

    Animated.sequence([
      Animated.delay(100),
      Animated.timing(bgmBadgeOpac, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(200),
      Animated.spring(emojiScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();

    const tension = intro.animation === 'particle_burst' ? 120 : intro.animation === 'zoom_in' ? 50 : 80;
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(titleScale,   { toValue: 1, tension, friction: intro.animation === 'glitch' ? 10 : 7, useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(500),
      Animated.timing(subOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(intro.duration_ms - 1600),
      Animated.timing(challengeOpac, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.timing(barWidth, { toValue: 1, duration: intro.duration_ms - 600, useNativeDriver: false }).start();

    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,   duration: 700, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0.2, duration: 700, useNativeDriver: false }),
    ]));
    glowLoop.start();

    if (intro.animation === 'slide_up') {
      slideAnims.forEach((anim, i) => {
        Animated.sequence([
          Animated.delay(200 + i * 120),
          Animated.spring(anim, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
        ]).start();
      });
    }

    if (intro.animation === 'particle_burst') {
      particleAnims.forEach((p, i) => {
        const angle = (i / particleAnims.length) * Math.PI * 2;
        const dist  = 90 + Math.random() * 70;
        Animated.sequence([
          Animated.delay(300 + i * 60),
          Animated.parallel([
            Animated.spring(p.scale,   { toValue: 1,   tension: 100, friction: 6, useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 1,   duration: 200, useNativeDriver: true }),
            Animated.timing(p.x,       { toValue: Math.cos(angle) * dist, duration: 700, useNativeDriver: true }),
            Animated.timing(p.y,       { toValue: Math.sin(angle) * dist, duration: 700, useNativeDriver: true }),
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

  const accentColor = intro.accentColor ?? genreColor(genre).primary;

  const genreEmojis: Record<string, string[]> = {
    kpop:    ['⭐','🎤','💫','✨','🌟','💝','🎵','👑'],
    hiphop:  ['🎤','🔥','💥','⚡','🎧','🎵','💣','🌟'],
    news:    ['📺','📡','🔴','📰','🎙️','⚡','🔔','📊'],
    fitness: ['💪','🔥','⚡','🏋️','🎯','💥','🏆','🌟'],
    kids:    ['🌈','🦄','🌟','💕','🎀','✨','🍀','🎉'],
    travel:  ['✈️','🌏','🗺️','📍','🌅','⛅','🏔️','🌊'],
  };
  const emojis = genreEmojis[genre] ?? ['⭐','✨','🎉','💫','🌟','🎊','🔥','💥'];
  const genreEmoji = emojis[0];
  const scanlines = intro.animation === 'glitch' ? [0.18, 0.35, 0.52, 0.68, 0.84] : [];
  const contentTransform = intro.animation === 'slide_up' ? [{ translateY: slideAnims[0] }] : [];

  return (
    <Animated.View style={[io.overlay, { opacity: masterOpacity }]}>
      <View style={[StyleSheet.absoluteFill, {
        // @ts-ignore web
        background: `linear-gradient(160deg, ${intro.bgColor} 0%, ${intro.bgColor2} 100%)`,
        backgroundColor: '#000',
      }]} />
      <View style={[StyleSheet.absoluteFill, {
        // @ts-ignore web
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
      }]} />

      {scanlines.map((top, i) => (
        <View key={i} style={[io.scanline, { top: `${top * 100}%` as any, opacity: 0.06 + i * 0.02 }]} />
      ))}

      {intro.animation === 'particle_burst' && particleAnims.map((p, i) => (
        <Animated.Text key={i} style={[io.particle, {
          opacity: p.opacity,
          transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
        }]}>
          {emojis[i % emojis.length]}
        </Animated.Text>
      ))}

      <Animated.View style={[io.bgmBadge, { opacity: bgmBadgeOpac, borderColor: accentColor + '66', backgroundColor: accentColor + '22' }]}>
        <Text style={[io.bgmBadgeText, { color: accentColor }]}>🎵 BGM 시작</Text>
      </Animated.View>

      <Animated.View style={[io.center, { transform: contentTransform }]}>
        <Animated.View style={[io.glowRing, {
          borderColor: accentColor,
          opacity: glowAnim,
          // @ts-ignore web
          boxShadow: `0 0 40px ${accentColor}88, 0 0 80px ${accentColor}44`,
        }]} />
        <Animated.View style={[io.glowRingInner, { borderColor: accentColor + '55', opacity: glowAnim }]} />

        <Animated.Text style={[io.genreEmoji, { transform: [{ scale: emojiScale }] }]}>
          {genreEmoji}
        </Animated.Text>

        <Animated.Text style={[io.title, {
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
          {emojis.slice(1, 6).map((e, i) => (
            <Animated.Text key={i} style={[io.emojiItem, {
              transform: intro.animation === 'slide_up' ? [{ translateY: slideAnims[Math.min(i + 1, 3)] }] : [],
            }]}>{e}</Animated.Text>
          ))}
        </Animated.View>

        <Animated.Text style={[io.challengeStart, {
          opacity: challengeOpac,
          color: '#fff',
          // @ts-ignore web
          textShadow: `0 0 20px ${accentColor}, 0 0 40px ${accentColor}`,
        }]}>
          CHALLENGE START
        </Animated.Text>
      </Animated.View>

      <View style={io.progressTrack}>
        <Animated.View style={[io.progressFill, {
          width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: accentColor,
          // @ts-ignore web
          boxShadow: `0 0 10px ${accentColor}, 0 0 20px ${accentColor}88`,
        }]} />
      </View>

      <View style={[io.studioBadge, { borderColor: accentColor + '55', backgroundColor: accentColor + '18' }]}>
        <Text style={[io.studioBadgeText, { color: accentColor }]}>CHALLENGE STUDIO</Text>
      </View>
    </Animated.View>
  );
}

const io = StyleSheet.create({
  overlay:        { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 60, overflow: 'hidden' },
  scanline:       { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#fff' },
  glowRing:       { position: 'absolute', width: 320, height: 320, borderRadius: 160, borderWidth: 2 },
  glowRingInner:  { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1 },
  center:         { alignItems: 'center', gap: 14, zIndex: 1, paddingHorizontal: 32 },
  genreEmoji:     { fontSize: 80, lineHeight: 90 },
  title:          { fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: 1, color: '#fff', lineHeight: 40, maxWidth: 320 },
  subtitle:       { fontSize: 17, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5, opacity: 0.9 },
  emojiRow:       { flexDirection: 'row', gap: 12, marginTop: 4 },
  emojiItem:      { fontSize: 28 },
  particle:       { position: 'absolute', fontSize: 32, zIndex: 2 },
  challengeStart: { fontSize: 13, fontWeight: '900', letterSpacing: 3, marginTop: 8 },
  bgmBadge:       { position: 'absolute', top: 80, left: 20, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  bgmBadgeText:   { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  progressTrack:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.12)' },
  progressFill:   { height: '100%', borderRadius: 2 },
  studioBadge:    { position: 'absolute', top: 24, right: 20, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  studioBadgeText:{ fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
});

// ─── OutroOverlay ─────────────────────────────────────────────────────────────

function OutroOverlay({ outro, score, onDone }: { outro: TemplateOutro; score: number; onDone: () => void }) {
  const masterOpacity = useRef(new Animated.Value(0)).current;
  const titleScale    = useRef(new Animated.Value(0.2)).current;
  const titleOpacity  = useRef(new Animated.Value(0)).current;
  const scoreScale    = useRef(new Animated.Value(0)).current;
  const scoreOpacity  = useRef(new Animated.Value(0)).current;
  const achieveOpac   = useRef(new Animated.Value(0)).current;
  const btnOpacity    = useRef(new Animated.Value(0)).current;
  const btnTranslate  = useRef(new Animated.Value(20)).current;

  const ring1Scale   = useRef(new Animated.Value(0.5)).current;
  const ring1Opacity = useRef(new Animated.Value(1)).current;
  const ring2Scale   = useRef(new Animated.Value(0.3)).current;
  const ring2Opacity = useRef(new Animated.Value(0.8)).current;
  const ring3Scale   = useRef(new Animated.Value(0.1)).current;
  const ring3Opacity = useRef(new Animated.Value(0.6)).current;

  const confettiAnims = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      x: new Animated.Value(-150 + (i / 11) * 300),
      y: new Animated.Value(-30),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
      emoji: PARTICLES[i % PARTICLES.length],
    }))
  ).current;

  const accentColor  = outro.accentColor ?? '#f59e0b';
  const scorePercent = Math.round(score * 100);
  const achievement =
    scorePercent >= 90 ? { emoji: '👑', label: 'PERFECT!',    color: '#f59e0b' } :
    scorePercent >= 75 ? { emoji: '🌟', label: 'GREAT!',      color: '#eab308' } :
    scorePercent >= 60 ? { emoji: '👍', label: 'GOOD!',       color: '#22c55e' } :
                         { emoji: '💪', label: 'KEEP GOING!', color: '#3b82f6' };

  useEffect(() => {
    Animated.timing(masterOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    const ringLoop = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 2.8, duration: 1400, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 1400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 0.5, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ]));
    ringLoop(ring1Scale, ring1Opacity, 0).start();
    ringLoop(ring2Scale, ring2Opacity, 400).start();
    ringLoop(ring3Scale, ring3Opacity, 800).start();

    Animated.parallel([
      Animated.spring(titleScale,   { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.spring(scoreScale,   { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(scoreOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(450),
      Animated.timing(achieveOpac, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Button animates in after 1.5s
    Animated.sequence([
      Animated.delay(1500),
      Animated.parallel([
        Animated.timing(btnOpacity,   { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(btnTranslate, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();

    confettiAnims.forEach((p, i) => {
      Animated.sequence([
        Animated.delay(i * 100),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1,   duration: 200, useNativeDriver: true }),
          Animated.timing(p.y,       { toValue: 600, duration: 1800, useNativeDriver: true }),
          Animated.timing(p.rotate,  { toValue: Math.random() > 0.5 ? 3 : -3, duration: 1800, useNativeDriver: true }),
        ]),
        Animated.timing(p.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
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
        background: `radial-gradient(circle at 50% 40%, ${accentColor}22 0%, #000 65%)`,
        backgroundColor: '#000',
      }]} />

      {[{ s: ring1Scale, o: ring1Opacity }, { s: ring2Scale, o: ring2Opacity }, { s: ring3Scale, o: ring3Opacity }].map((ring, i) => (
        <Animated.View key={i} style={[oo.ring, {
          borderColor: accentColor,
          transform: [{ scale: ring.s }],
          opacity: ring.o,
        }]} />
      ))}

      {confettiAnims.map((p, i) => (
        <Animated.Text key={i} style={[oo.confetti, {
          opacity: p.opacity,
          transform: [
            { translateX: p.x },
            { translateY: p.y },
            { rotate: p.rotate.interpolate({ inputRange: [-3, 3], outputRange: ['-540deg', '540deg'] }) },
          ],
        }]}>
          {p.emoji}
        </Animated.Text>
      ))}

      <View style={oo.center}>
        <Animated.Text style={[oo.title, {
          opacity: titleOpacity,
          transform: [{ scale: titleScale }],
          // @ts-ignore web
          textShadow: `0 0 30px ${accentColor}, 0 0 60px ${accentColor}88`,
        }]}>
          {outro.title}
        </Animated.Text>

        <Animated.View style={[oo.scoreWrap, {
          opacity: scoreOpacity,
          transform: [{ scale: scoreScale }],
          borderColor: accentColor,
          // @ts-ignore web
          boxShadow: `0 0 30px ${accentColor}88, 0 0 60px ${accentColor}44`,
        }]}>
          <Text style={[oo.scoreNum, {
            color: accentColor,
            // @ts-ignore web
            textShadow: `0 0 20px ${accentColor}`,
          }]}>{scorePercent}</Text>
          <Text style={oo.scoreUnit}>%</Text>
        </Animated.View>

        <Animated.View style={[oo.achieveWrap, { opacity: achieveOpac }]}>
          <View style={[oo.achieveBadge, {
            borderColor: achievement.color + '88',
            backgroundColor: achievement.color + '1a',
            // @ts-ignore web
            boxShadow: `0 0 16px ${achievement.color}44`,
          }]}>
            <Text style={oo.achieveEmoji}>{achievement.emoji}</Text>
            <Text style={[oo.achieveLabel, { color: achievement.color }]}>{achievement.label}</Text>
          </View>
        </Animated.View>

        {outro.subtitle && (
          <Animated.Text style={[oo.subtitle, { opacity: scoreOpacity, color: accentColor }]}>
            {outro.subtitle}
          </Animated.Text>
        )}

        <Animated.View style={[oo.resultBtnWrap, {
          opacity: btnOpacity,
          transform: [{ translateY: btnTranslate }],
        }]}>
          <TouchableOpacity style={[oo.resultBtn, {
            borderColor: accentColor + '88',
            // @ts-ignore web
            background: `linear-gradient(135deg, ${accentColor}33 0%, ${accentColor}11 100%)`,
            backgroundColor: accentColor + '22',
          }]} onPress={onDone}>
            <Text style={oo.resultBtnText}>결과 확인하기 →</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const oo = StyleSheet.create({
  overlay:      { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 60, overflow: 'hidden' },
  ring:         { position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 2 },
  confetti:     { position: 'absolute', top: 0, fontSize: 26, zIndex: 2 },
  center:       { alignItems: 'center', gap: 18, zIndex: 3, paddingHorizontal: 32 },
  title:        { fontSize: 36, fontWeight: '900', textAlign: 'center', color: '#fff', letterSpacing: 0.5, lineHeight: 46 },
  subtitle:     { fontSize: 15, fontWeight: '700', textAlign: 'center', opacity: 0.85 },
  scoreWrap:    { flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderWidth: 2, borderRadius: 28, paddingHorizontal: 36, paddingVertical: 18, backgroundColor: 'rgba(0,0,0,0.6)', marginTop: 4 },
  scoreNum:     { fontSize: 76, fontWeight: '900', lineHeight: 84 },
  scoreUnit:    { color: 'rgba(255,255,255,0.6)', fontSize: 26, fontWeight: '700', paddingBottom: 10 },
  achieveWrap:  { alignItems: 'center' },
  achieveBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 22, paddingVertical: 10 },
  achieveEmoji: { fontSize: 22 },
  achieveLabel: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  resultBtnWrap:{ marginTop: 8 },
  resultBtn:    { paddingHorizontal: 36, paddingVertical: 16, borderRadius: 28, borderWidth: 1.5, alignItems: 'center' },
  resultBtnText:{ fontSize: 17, fontWeight: '900', letterSpacing: 0.5, color: '#fff' },
});

// ─── CountdownOverlay ─────────────────────────────────────────────────────────

function CountdownOverlay({ count, templateName, emoji }: { count: number; templateName: string; emoji: string }) {
  const scaleAnim = useRef(new Animated.Value(2.5)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const ring3Anim = useRef(new Animated.Value(0)).current;
  const goExpand  = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scaleAnim.setValue(count === 0 ? 3 : 2.5);
    opacAnim.setValue(0);
    ring1Anim.setValue(0); ring2Anim.setValue(0); ring3Anim.setValue(0);

    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    [ring1Anim, ring2Anim, ring3Anim].forEach((r, i) => {
      Animated.sequence([
        Animated.delay(i * 120),
        Animated.timing(r, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]).start();
    });

    if (count === 0) {
      Animated.sequence([
        Animated.spring(goExpand, { toValue: 1.3, tension: 200, friction: 5, useNativeDriver: true }),
        Animated.spring(goExpand, { toValue: 1,   tension: 80,  friction: 8, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 14,  duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -14, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8,   duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,   duration: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [count]);

  const numColor  = count === 3 ? '#ff3030' : count === 2 ? '#ff9000' : count === 1 ? '#00ff44' : '#fff';
  const ringColor =
    count === 3 ? 'rgba(255,48,48,0.55)'  :
    count === 2 ? 'rgba(255,144,0,0.55)'  :
    count === 1 ? 'rgba(0,255,68,0.55)'   : 'rgba(124,58,237,0.65)';

  const ringInterp = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange:[0,1], outputRange:[0.4, 3] }) }],
    opacity:   anim.interpolate({ inputRange:[0, 0.6, 1], outputRange:[0.9, 0.4, 0] }),
  });

  return (
    <View style={cd.overlay}>
      <View style={[StyleSheet.absoluteFill, cd.backdrop]} />
      {/* Grid pattern */}
      <View style={[StyleSheet.absoluteFill, {
        // @ts-ignore web
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        // @ts-ignore web
        backgroundSize: '40px 40px',
      }]} />

      {[ring1Anim, ring2Anim, ring3Anim].map((r, i) => (
        <Animated.View key={i} style={[cd.ring, { borderColor: ringColor }, ringInterp(r)]} />
      ))}

      <View style={cd.center}>
        <View style={[cd.badge, { borderColor: numColor + '55', backgroundColor: numColor + '18' }]}>
          <Text style={[cd.badgeText, { color: numColor }]}>{emoji}  {templateName}</Text>
        </View>

        {count > 0 ? (
          <Animated.Text style={[cd.num, {
            color: numColor,
            opacity: opacAnim,
            transform: [{ scale: scaleAnim }, { translateX: shakeAnim }],
            // @ts-ignore web
            textShadow: `0 0 60px ${numColor}, 0 0 120px ${numColor}88`,
          }]}>{count}</Animated.Text>
        ) : (
          <Animated.View style={[cd.goWrap, { transform: [{ scale: goExpand }, { translateX: shakeAnim }], opacity: opacAnim }]}>
            <Text style={cd.go}>GO!</Text>
          </Animated.View>
        )}

        <Text style={[cd.readyText, { color: numColor + 'cc' }]}>
          {count === 3 ? '🔴 준비...' : count === 2 ? '🟡 거의...' : count === 1 ? '🟢 시작!' : '🎬 챌린지 시작!'}
        </Text>

        <View style={cd.dots}>
          {[3,2,1,0].map(n => (
            <View key={n} style={[cd.dot, count <= n
              ? { backgroundColor: numColor } as any
              : { backgroundColor: 'rgba(255,255,255,0.15)' }
            ]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const cd = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 40 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.88)',
    // @ts-ignore web
    backdropFilter: 'blur(12px)' },
  ring:     { position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 2.5, zIndex: 0 },
  center:   { alignItems: 'center', gap: 16, zIndex: 1 },
  badge:    { borderRadius: 26, borderWidth: 1.5, paddingHorizontal: 22, paddingVertical: 9 },
  badgeText:{ fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  num:      { fontSize: 160, fontWeight: '900', lineHeight: 172 },
  goWrap:   {
    // @ts-ignore web
    background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)',
    backgroundColor: '#7c3aed', paddingHorizontal: 56, paddingVertical: 22, borderRadius: 36,
    // @ts-ignore web
    boxShadow: '0 0 50px rgba(124,58,237,0.9), 0 0 100px rgba(236,72,153,0.5)',
  },
  go:       { fontSize: 86, fontWeight: '900', color: '#fff', letterSpacing: 5 },
  readyText:{ fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  dots:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  dot:      { width: 11, height: 11, borderRadius: 5.5 },
});

// ─── MissionCard ──────────────────────────────────────────────────────────────

function MissionCard({ mission, progress, tag, voiceTranscript, anim, maxW }: {
  mission: any; progress: number; tag: JudgementTag; voiceTranscript: string; anim: Animated.Value; maxW: number;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopRef   = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (tag === 'perfect') {
      loopRef.current = Animated.loop(Animated.sequence([
        Animated.spring(pulseAnim, { toValue: 1.12, tension: 180, friction: 6, useNativeDriver: true }),
        Animated.spring(pulseAnim, { toValue: 1.0,  tension: 120, friction: 8, useNativeDriver: true }),
      ]));
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => loopRef.current?.stop();
  }, [tag]);

  const tagColor =
    tag === 'perfect' ? '#22c55e' :
    tag === 'good'    ? '#f59e0b' : '#7c3aed';
  const borderGlow =
    tag === 'perfect' ? 'rgba(34,197,94,0.6)'  :
    tag === 'good'    ? 'rgba(245,158,11,0.5)'  : 'rgba(124,58,237,0.4)';

  const missionType =
    mission.type === 'voice_read' ? '🎤 따라 읽기' :
    mission.type === 'gesture'    ? '🤲 제스처 챌린지' :
    mission.type === 'timing'     ? '⏱ 유지 챌린지' : '😊 표정 챌린지';

  const statusText =
    tag === 'perfect' ? '🌟 PERFECT!' :
    tag === 'good'    ? '👍 GOOD!' : '⏳ 도전 중...';

  return (
    <Animated.View style={[mc.wrap, {
      maxWidth: maxW,
      opacity: anim,
      transform: [{ scale: anim.interpolate({ inputRange:[0,1], outputRange:[0.8,1] }) }],
      borderColor: tagColor + '55',
      // @ts-ignore web
      boxShadow: `0 0 20px ${borderGlow}, 0 0 40px ${borderGlow}55`,
    }]}>
      <View style={[StyleSheet.absoluteFill, mc.glass]} />

      <View style={[mc.typeChip, { backgroundColor: tagColor + '22', borderColor: tagColor + '66' }]}>
        <Text style={[mc.typeText, { color: tagColor }]}>{missionType}</Text>
      </View>

      <Animated.Text style={[mc.bigEmoji, { transform: [{ scale: pulseAnim }] }]}>
        {mission.gesture_emoji ?? mission.guide_emoji ?? '🎯'}
      </Animated.Text>

      <Text style={mc.mainText}>
        {mission.type === 'voice_read' && mission.read_text ? mission.read_text : mission.guide_text ?? ''}
      </Text>

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
        <Animated.View style={[mc.progFill, {
          width: `${progress * 100}%` as any,
          backgroundColor: tagColor,
          // @ts-ignore web
          boxShadow: `0 0 8px ${tagColor}, 0 0 16px ${tagColor}88`,
        }]} />
      </View>

      <View style={[mc.statusPill, { backgroundColor: tagColor }]}>
        <Text style={mc.statusText}>{statusText}</Text>
      </View>
    </Animated.View>
  );
}

const mc = StyleSheet.create({
  wrap:       { position:'absolute', top:'18%', alignSelf:'center', width:'90%', zIndex:22, borderRadius:28, padding:22, alignItems:'center', gap:12, overflow:'hidden', borderWidth:1.5 },
  glass:      { backgroundColor:'rgba(0,0,0,0.85)',
    // @ts-ignore web
    backdropFilter:'blur(24px)', borderRadius:28 },
  typeChip:   { borderRadius:20, borderWidth:1, paddingHorizontal:16, paddingVertical:6 },
  typeText:   { fontSize:13, fontWeight:'800', letterSpacing:0.5 },
  bigEmoji:   { fontSize:90, lineHeight:100 },
  mainText:   { color:'#fff', fontSize:22, fontWeight:'900', textAlign:'center', lineHeight:30, paddingHorizontal:8,
    // @ts-ignore web
    textShadow:'0 2px 10px rgba(0,0,0,0.6)' },
  voiceBox:       { backgroundColor:'rgba(253,230,138,0.12)', borderRadius:14, padding:14, borderWidth:1.5, borderColor:'rgba(253,230,138,0.4)', width:'100%', alignItems:'center', gap:6 },
  voiceBoxActive: { backgroundColor:'rgba(34,197,94,0.15)', borderColor:'rgba(34,197,94,0.5)' },
  voiceBoxEmpty:  { backgroundColor:'rgba(100,116,139,0.15)', borderColor:'rgba(100,116,139,0.3)' },
  voiceLabel:     { color:'rgba(255,255,255,0.6)', fontSize:11, fontWeight:'600', letterSpacing:0.5 },
  voiceText:      { color:'#fde68a', fontSize:17, fontWeight:'700', textAlign:'center', lineHeight:24 },
  voiceScoreBar:  { width:'100%', gap:4 },
  voiceScoreLabel:{ color:'rgba(255,255,255,0.6)', fontSize:10, fontWeight:'600' },
  voiceScoreBg:   { width:'100%', height:5, backgroundColor:'rgba(255,255,255,0.1)', borderRadius:3, overflow:'hidden' },
  voiceScoreFill: { height:'100%', borderRadius:3 },
  progBg:     { width:'100%', height:7, backgroundColor:'rgba(255,255,255,0.1)', borderRadius:4, overflow:'hidden' },
  progFill:   { height:'100%', borderRadius:4 },
  statusPill: { paddingHorizontal:22, paddingVertical:8, borderRadius:20 },
  statusText: { color:'#fff', fontSize:15, fontWeight:'900' },
});

// ─── Genre styles ─────────────────────────────────────────────────────────────

const GENRE_STYLES: Record<string, { headerBg:string; accentColor:string; textGlow:string; borderColor:string }> = {
  news:      { headerBg:'rgba(13,28,53,0.95)',  accentColor:'#1565c0', textGlow:'#64b5f6', borderColor:'#1565c0' },
  kpop:      { headerBg:'rgba(10,10,30,0.95)',  accentColor:'#e94560', textGlow:'#ff80ab', borderColor:'#e94560' },
  english:   { headerBg:'rgba(15,30,70,0.95)',  accentColor:'#2196f3', textGlow:'#90caf9', borderColor:'#2196f3' },
  kids:      { headerBg:'rgba(80,20,100,0.95)', accentColor:'#a855f7', textGlow:'#d8b4fe', borderColor:'#ec4899' },
  travel:    { headerBg:'rgba(0,60,80,0.95)',   accentColor:'#f97316', textGlow:'#fdba74', borderColor:'#f97316' },
  fitness:   { headerBg:'rgba(10,50,40,0.95)',  accentColor:'#14b8a6', textGlow:'#5eead4', borderColor:'#14b8a6' },
  hiphop:    { headerBg:'rgba(20,20,20,0.95)',  accentColor:'#f7b731', textGlow:'#fde68a', borderColor:'#f7b731' },
  daily:     { headerBg:'rgba(40,20,80,0.95)',  accentColor:'#9b59b6', textGlow:'#d8b4fe', borderColor:'#9b59b6' },
  promotion: { headerBg:'rgba(80,10,60,0.95)',  accentColor:'#e91e63', textGlow:'#f48fb1', borderColor:'#e91e63' },
};

// ─── KpopSpotlights ───────────────────────────────────────────────────────────

function KpopSpotlights({ accentColor }: { accentColor: string }) {
  const sweep1    = useRef(new Animated.Value(0)).current;
  const sweep2    = useRef(new Animated.Value(1)).current;
  const beatFlash = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(sweep1, { toValue: 1, duration: 2200, useNativeDriver: true }),
      Animated.timing(sweep1, { toValue: 0, duration: 2200, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(sweep2, { toValue: 0, duration: 2600, useNativeDriver: true }),
      Animated.timing(sweep2, { toValue: 1, duration: 2600, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(beatFlash, { toValue: 1,   duration: 80,  useNativeDriver: false }),
      Animated.timing(beatFlash, { toValue: 0.1, duration: 420, useNativeDriver: false }),
    ])).start();
  }, []);

  return (
    <>
      <Animated.View style={[tov.spotBeam, {
        left: sweep1.interpolate({ inputRange:[0,1], outputRange:['4%','28%'] }),
        backgroundColor: accentColor,
        opacity: 0.5,
      }]} />
      <Animated.View style={[tov.spotBeam, {
        right: sweep2.interpolate({ inputRange:[0,1], outputRange:['4%','28%'] }),
        backgroundColor: accentColor,
        opacity: 0.5,
        transform: [{ skewX: '-12deg' }] as any,
      }]} />
      <Animated.View style={[tov.beatFlash, {
        borderColor: '#fff',
        opacity: beatFlash.interpolate({ inputRange:[0.1,1], outputRange:[0.04,0.3] }),
      }]} />
    </>
  );
}

// ─── NewsTickerLayer ──────────────────────────────────────────────────────────

function NewsTickerLayer({ accentColor, tickerText }: { accentColor: string; tickerText: string }) {
  const tickerX       = useRef(new Animated.Value(0)).current;
  const liveDot       = useRef(new Animated.Value(1)).current;
  const breakingPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(tickerX,       { toValue: -1,  duration: 14000, useNativeDriver: true }),
      Animated.timing(tickerX,       { toValue: 0,   duration: 0,     useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(liveDot,       { toValue: 0,   duration: 500,   useNativeDriver: true }),
      Animated.timing(liveDot,       { toValue: 1,   duration: 500,   useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(breakingPulse, { toValue: 0.5, duration: 700,   useNativeDriver: true }),
      Animated.timing(breakingPulse, { toValue: 1,   duration: 700,   useNativeDriver: true }),
    ])).start();
  }, []);

  const text = tickerText || '🔴 속보 · BREAKING NEWS · 오늘의 챌린지 뉴스 · LIVE BROADCAST · ';
  return (
    <>
      <Animated.View style={[tov.newsBreakingBar, { opacity: breakingPulse }]}>
        <View style={tov.newsBreakingLeft}>
          <Animated.View style={[tov.newsLiveDot, { opacity: liveDot }]} />
          <Text style={tov.newsBreakingLabel}>속보</Text>
        </View>
        <Text style={tov.newsBreakingText} numberOfLines={1}>{text}</Text>
      </Animated.View>
      <View style={[tov.newsTickerTrack, { backgroundColor: accentColor }]}>
        <Animated.Text style={[tov.newsTickerText, {
          transform: [{ translateX: tickerX.interpolate({ inputRange:[-1,0], outputRange:['-150%','0%'] }) }],
        }]} numberOfLines={1}>
          {text + ' · ' + text}
        </Animated.Text>
      </View>
      <View style={[tov.lowerThird, { backgroundColor: accentColor + 'ee' }]}>
        <View style={[tov.lowerThirdAccent, { backgroundColor: '#c62828' }]} />
        <Text style={tov.lowerThirdText}>챌린지 스튜디오 LIVE  |  MC 챌린저</Text>
      </View>
      <View style={[tov.newsSideBar, tov.newsSideLeft,  { backgroundColor: '#c62828' }]} />
      <View style={[tov.newsSideBar, tov.newsSideRight, { backgroundColor: '#c62828' }]} />
    </>
  );
}

// ─── FitnessHUDLayer ──────────────────────────────────────────────────────────

function FitnessHUDLayer({ accentColor, progress, elapsed }: { accentColor:string; progress:number; elapsed:number }) {
  const motFlash   = useRef(new Animated.Value(0)).current;
  const borderGlow = useRef(new Animated.Value(0.3)).current;
  const prevProg   = useRef(progress);

  useEffect(() => {
    if (Math.floor(prevProg.current * 10) !== Math.floor(progress * 10) && progress > 0) {
      Animated.sequence([
        Animated.timing(motFlash, { toValue: 1, duration: 150, useNativeDriver: false }),
        Animated.timing(motFlash, { toValue: 0, duration: 500, useNativeDriver: false }),
      ]).start();
    }
    prevProg.current = progress;
  }, [progress]);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(borderGlow, { toValue: 1,   duration: 1500, useNativeDriver: false }),
      Animated.timing(borderGlow, { toValue: 0.2, duration: 1500, useNativeDriver: false }),
    ])).start();
  }, []);

  const motivations    = ['BURN!','PUSH!','GO!','POWER!','STRONG!'];
  const motIdx         = Math.floor(elapsed / 8000) % motivations.length;
  const intensityColor = progress < 0.33 ? '#22c55e' : progress < 0.66 ? '#f59e0b' : '#ef4444';

  return (
    <>
      <View style={tov.fitnessRingWrap}>
        <View style={[tov.fitnessRingBg, { borderColor:'rgba(255,255,255,0.12)' }]} />
        <View style={[tov.fitnessRingFill, { borderColor: accentColor,
          // @ts-ignore web
          boxShadow:`0 0 14px ${accentColor}` }]} />
        <Text style={[tov.fitnessRingPct, { color: accentColor }]}>{Math.round(progress*100)}%</Text>
      </View>
      <Animated.View style={[tov.fitMotivationWrap, { opacity: motFlash, backgroundColor: intensityColor+'22', borderColor: intensityColor }]}>
        <Text style={[tov.fitMotivationText, { color: intensityColor }]}>🔥 {motivations[motIdx]}</Text>
      </Animated.View>
      <Animated.View style={[tov.fitBorderGlow, {
        borderColor: accentColor,
        opacity: borderGlow.interpolate({ inputRange:[0.2,1], outputRange:[0.1 + progress*0.3, 0.4 + progress*0.4] }),
        // @ts-ignore web
        boxShadow: `inset 0 0 ${20 + progress*40}px ${accentColor}44`,
      }]} />
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

// ─── TemplateOverlay ──────────────────────────────────────────────────────────

interface SubtitleEntry { start_ms:number; end_ms:number; text:string; style?:string; }

function TemplateOverlay({ template, elapsed, isRecording }: { template: any; elapsed:number; isRecording:boolean }) {
  const subtitleAnim  = useRef(new Animated.Value(0)).current;
  const liveBlinkAnim = useRef(new Animated.Value(1)).current;
  const hashtagX      = useRef(new Animated.Value(0)).current;
  const prevSubRef    = useRef<string|undefined>(undefined);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(liveBlinkAnim, { toValue:0.2, duration:600, useNativeDriver:true }),
      Animated.timing(liveBlinkAnim, { toValue:1,   duration:600, useNativeDriver:true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(hashtagX, { toValue:-1, duration:18000, useNativeDriver:true }),
      Animated.timing(hashtagX, { toValue: 0, duration:0,     useNativeDriver:true }),
    ])).start();
  }, []);

  if (!isRecording || !template) return null;

  const genre      = template.genre ?? 'daily';
  const gs         = GENRE_STYLES[genre] ?? GENRE_STYLES.daily;
  const subs       = (template.subtitle_timeline ?? []) as SubtitleEntry[];
  const currentSub = subs.find(s => elapsed >= s.start_ms && elapsed < s.end_ms);
  const totalMs    = (template.duration_sec ?? 30) * 1000;
  const progress   = Math.min(1, elapsed / totalMs);
  const remainSec  = Math.max(0, (template.duration_sec ?? 30) - Math.floor(elapsed / 1000));

  const isHighlight = currentSub?.style === 'highlight';
  const isBold      = currentSub?.style === 'bold';
  const isNews      = currentSub?.style === 'news';

  const subKey = currentSub?.text;
  if (subKey !== prevSubRef.current) {
    prevSubRef.current = subKey;
    subtitleAnim.setValue(0);
    Animated.spring(subtitleAnim, { toValue:1, tension:80, friction:8, useNativeDriver:true }).start();
  }

  const layers: any[] = template.layers ?? [];
  const hasSpotlight  = layers.some((l:any) => l.type==='spotlight') || template.spotlights;
  const hasTicker     = genre === 'news' && (layers.some((l:any) => l.type==='ticker') || template.ticker);
  const hasStarRain   = layers.some((l:any) => l.type==='star_rain');
  const starColor     = layers.find((l:any) => l.type==='star_rain')?.color ?? '#fbbf24';
  const tickerText    = (layers.find((l:any) => l.type==='ticker')?.text ?? template.ticker ?? '') as string;
  const hashtags      = (template.sns_template?.hashtags ?? []) as string[];
  const hashtagLine   = hashtags.slice(0,8).map((h:string) => '#'+h).join('  ') + '  ';

  const mm = String(Math.floor(remainSec/60)).padStart(2,'0');
  const ss = String(remainSec%60).padStart(2,'0');

  return (
    <>
      {/* ── 보편 시네마틱 프레임 (모든 템플릿 공통) ─────────────── */}
      <View pointerEvents="none" style={[tov.cineTopScrim, {
        // @ts-ignore web gradient
        backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.10) 70%, transparent 100%)',
      }]} />
      <View pointerEvents="none" style={[tov.cineBottomScrim, {
        // @ts-ignore web gradient
        backgroundImage: 'linear-gradient(0deg, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.10) 70%, transparent 100%)',
      }]} />
      <View pointerEvents="none" style={[tov.cineVignette, {
        // @ts-ignore web radial vignette
        backgroundImage: 'radial-gradient(120% 85% at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)',
      }]} />
      {/* 4 코너 crop marks */}
      <View pointerEvents="none" style={[tov.cornerMark, tov.cornerTL, { borderColor: gs.accentColor }]} />
      <View pointerEvents="none" style={[tov.cornerMark, tov.cornerTR, { borderColor: gs.accentColor }]} />
      <View pointerEvents="none" style={[tov.cornerMark, tov.cornerBL, { borderColor: gs.accentColor }]} />
      <View pointerEvents="none" style={[tov.cornerMark, tov.cornerBR, { borderColor: gs.accentColor }]} />

      {(genre==='kpop'||genre==='hiphop') && hasSpotlight && <KpopSpotlights accentColor={gs.accentColor} />}
      {hasStarRain && <StarRainLayer color={starColor} />}
      {hasTicker   && <NewsTickerLayer accentColor={gs.accentColor} tickerText={tickerText} />}
      {genre==='fitness' && <FitnessHUDLayer accentColor={gs.accentColor} progress={progress} elapsed={elapsed} />}

      <View style={[tov.topBar, {
        backgroundColor: gs.headerBg,
        borderBottomColor: gs.borderColor + '88',
        // @ts-ignore web
        boxShadow: `0 2px 20px ${gs.accentColor}22`,
      }]}>
        <View style={[tov.livePill, { backgroundColor:'#ef4444' }]}>
          <Animated.View style={[tov.liveDot, { opacity:liveBlinkAnim }]} />
          <Text style={tov.liveText}>LIVE</Text>
        </View>
        <Text style={[tov.topTitle, { color:gs.textGlow }]} numberOfLines={1}>
          {template.theme_emoji}  {template.name}
        </Text>
        <View style={[tov.timerPill, { backgroundColor:gs.accentColor+'2a', borderColor:gs.accentColor+'66' }]}>
          <Text style={[tov.timerText, { color:gs.textGlow }]}>{mm}:{ss}</Text>
        </View>
      </View>

      {currentSub && (
        <Animated.View style={[
          tov.subtitleWrap,
          isHighlight ? { backgroundColor:gs.accentColor+'dd', borderColor:'#fff4' }
            : isNews  ? { backgroundColor:'rgba(13,28,53,0.92)', borderColor:'#1565c088', borderLeftWidth:4, borderLeftColor:'#c62828' }
            : isBold  ? { backgroundColor:'rgba(0,0,0,0.88)', borderColor:gs.borderColor+'99' }
            :           { backgroundColor:'rgba(0,0,0,0.75)', borderColor:'rgba(255,255,255,0.18)' },
          {
            opacity: subtitleAnim,
            transform: [
              { translateY: subtitleAnim.interpolate({ inputRange:[0,1], outputRange:[20,0] }) },
              { scale:      subtitleAnim.interpolate({ inputRange:[0,1], outputRange:[0.95,1] }) },
            ],
          },
        ]}>
          {isHighlight && <View style={[tov.subtitleAccentBar, { backgroundColor:'#fff4' }]} />}
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

      {/* Hashtag marquee */}
      <View style={[tov.bottomBar, { backgroundColor:gs.headerBg, borderTopColor:gs.borderColor+'66', overflow:'hidden' }]}>
        <Animated.Text style={[tov.bottomText, {
          color: gs.textGlow+'cc',
          transform: [{ translateX: hashtagX.interpolate({ inputRange:[-1,0], outputRange:['-100%','0%'] }) }],
        }]} numberOfLines={1}>
          {hashtagLine + hashtagLine}
        </Animated.Text>
      </View>

      <View style={tov.progressTrack}>
        <View style={[tov.progressFill, {
          width: `${progress*100}%` as any,
          backgroundColor: gs.accentColor,
          // @ts-ignore web
          boxShadow: `0 0 8px ${gs.accentColor}, 0 0 16px ${gs.accentColor}66`,
        }]} />
      </View>
    </>
  );
}

const tov = StyleSheet.create({
  // 시네마틱 프레임
  cineTopScrim:    { position:'absolute', top:0, left:0, right:0, height:140, zIndex:15 },
  cineBottomScrim: { position:'absolute', bottom:0, left:0, right:0, height:160, zIndex:15 },
  cineVignette:    { position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:14 },
  cornerMark:      { position:'absolute', width:20, height:20, borderWidth:2, zIndex:16 },
  cornerTL:        { top:56, left:10, borderRightWidth:0, borderBottomWidth:0 },
  cornerTR:        { top:56, right:10, borderLeftWidth:0, borderBottomWidth:0 },
  cornerBL:        { bottom:70, left:10, borderRightWidth:0, borderTopWidth:0 },
  cornerBR:        { bottom:70, right:10, borderLeftWidth:0, borderTopWidth:0 },
  topBar:            { position:'absolute', top:0, left:0, right:0, zIndex:20, flexDirection:'row', alignItems:'center', paddingVertical:8, paddingHorizontal:12, gap:10, borderBottomWidth:1 },
  livePill:          { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:8, paddingVertical:4, borderRadius:6 },
  liveDot:           { width:6, height:6, borderRadius:3, backgroundColor:'#fff' },
  liveText:          { color:'#fff', fontSize:11, fontWeight:'900', letterSpacing:1 },
  topTitle:          { flex:1, fontSize:13, fontWeight:'800', letterSpacing:0.5 },
  timerPill:         { paddingHorizontal:10, paddingVertical:4, borderRadius:8, borderWidth:1 },
  timerText:         { fontSize:14, fontWeight:'900', fontVariant:['tabular-nums'] as any },
  spotBeam:          { position:'absolute', top:46, width:4, height:'65%', zIndex:18, transform:[{ skewX:'12deg' }] as any },
  beatFlash:         { position:'absolute', top:46, left:0, right:0, bottom:44, borderWidth:2, zIndex:17 },
  newsBreakingBar:   { position:'absolute', top:46, left:0, right:0, zIndex:19, flexDirection:'row', alignItems:'center', paddingVertical:5, paddingHorizontal:10, gap:8, backgroundColor:'#c62828' },
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
  fitnessRingWrap:   { position:'absolute', top:56, right:14, zIndex:21, width:64, height:64, alignItems:'center', justifyContent:'center' },
  fitnessRingBg:     { position:'absolute', width:60, height:60, borderRadius:30, borderWidth:4 },
  fitnessRingFill:   { position:'absolute', width:60, height:60, borderRadius:30, borderWidth:4, borderTopColor:'transparent', borderRightColor:'transparent' },
  fitnessRingPct:    { fontSize:12, fontWeight:'900' },
  fitMotivationWrap: { position:'absolute', top:60, alignSelf:'center', zIndex:21, paddingHorizontal:18, paddingVertical:7, borderRadius:18, borderWidth:1.5 },
  fitMotivationText: { fontSize:17, fontWeight:'900', letterSpacing:1.5 },
  fitBorderGlow:     { position:'absolute', top:46, left:0, right:0, bottom:44, borderWidth:2, zIndex:17 },
  starRainItem:      { position:'absolute', top:50, zIndex:16 },
  subtitleWrap:      { position:'absolute', bottom:120, left:12, right:12, borderRadius:16, borderWidth:1.5, paddingVertical:13, paddingHorizontal:18, alignItems:'center', zIndex:22, overflow:'hidden',
    // @ts-ignore web
    backdropFilter:'blur(16px)' },
  subtitleAccentBar: { position:'absolute', top:0, left:0, right:0, height:2, borderRadius:2 },
  subtitleText:      { textAlign:'center', lineHeight:28 },
  bottomBar:         { position:'absolute', bottom:44, left:0, right:0, zIndex:20, paddingVertical:7, paddingHorizontal:14, borderTopWidth:1, alignItems:'center' },
  bottomText:        { fontSize:11, fontWeight:'700', letterSpacing:0.5 },
  progressTrack:     { position:'absolute', bottom:0, left:0, right:0, height:3, backgroundColor:'rgba(255,255,255,0.12)', zIndex:30 },
  progressFill:      { height:'100%', borderRadius:1.5 },
});

// ─── SquatHUD (left panel) ────────────────────────────────────────────────────

function SquatHUD({ count, phase, kneeAngle }: { count:number; phase:'up'|'down'|'unknown'; kneeAngle:number }) {
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const prevCount  = useRef(count);

  useEffect(() => {
    if (count !== prevCount.current) {
      prevCount.current = count;
      Animated.sequence([
        Animated.spring(bounceAnim, { toValue:1.5, tension:200, friction:5, useNativeDriver:true }),
        Animated.spring(bounceAnim, { toValue:1.0, tension:80,  friction:8, useNativeDriver:true }),
      ]).start();
    }
  }, [count]);

  const phaseColor = phase==='down' ? '#22c55e' : phase==='up' ? '#f59e0b' : '#94a3b8';
  const depthPct   = Math.max(0, Math.min(100, ((180-kneeAngle)/90)*100));
  const depthColor = depthPct>70 ? '#22c55e' : depthPct>40 ? '#f59e0b' : '#ef4444';

  return (
    <View style={sq.panel}>
      <Text style={sq.panelLabel}>🏋️ SQUAT</Text>

      <Animated.View style={[sq.repWrap, { transform:[{ scale:bounceAnim }] }]}>
        <Text style={sq.repNum}>{count}</Text>
        <Text style={sq.repUnit}>회</Text>
      </Animated.View>

      <View style={sq.phaseRow}>
        <View style={[sq.phaseDot, { backgroundColor:phaseColor,
          // @ts-ignore web
          boxShadow:`0 0 8px ${phaseColor}` }]} />
        <Text style={[sq.phaseLabel, { color:phaseColor }]}>
          {phase==='down' ? '내려가기' : phase==='up' ? '올라가기' : '준비'}
        </Text>
      </View>

      <View style={sq.gaugeSection}>
        <Text style={sq.gaugeTitle}>깊이</Text>
        <View style={sq.gaugeBg}>
          <View style={[sq.gaugeFill, {
            width: `${depthPct}%` as any,
            backgroundColor: depthColor,
            // @ts-ignore web
            boxShadow:`0 0 6px ${depthColor}`,
          }]} />
        </View>
      </View>

      <View style={sq.angleRow}>
        <Text style={sq.angleNum}>{Math.round(kneeAngle)}°</Text>
        <Text style={sq.angleLabel}>무릎</Text>
      </View>
    </View>
  );
}

const sq = StyleSheet.create({
  panel:       { position:'absolute', left:10, top:60, zIndex:31, backgroundColor:'rgba(0,0,0,0.8)',
    // @ts-ignore web
    backdropFilter:'blur(16px)', borderRadius:20, padding:14, borderWidth:1.5, borderColor:'rgba(20,184,166,0.5)',
    // @ts-ignore web
    boxShadow:'0 0 24px rgba(20,184,166,0.35)', minWidth:88, alignItems:'center', gap:8 },
  panelLabel:  { color:'#5eead4', fontSize:9, fontWeight:'900', letterSpacing:2 },
  repWrap:     { flexDirection:'row', alignItems:'flex-end', gap:2 },
  repNum:      { color:'#14b8a6', fontSize:56, fontWeight:'900', lineHeight:60,
    // @ts-ignore web
    textShadow:'0 0 20px rgba(20,184,166,0.7)' },
  repUnit:     { color:'#5eead4', fontSize:18, fontWeight:'700', paddingBottom:5 },
  phaseRow:    { flexDirection:'row', alignItems:'center', gap:6 },
  phaseDot:    { width:8, height:8, borderRadius:4 },
  phaseLabel:  { fontSize:10, fontWeight:'800' },
  gaugeSection:{ width:72, gap:4 },
  gaugeTitle:  { color:'rgba(255,255,255,0.4)', fontSize:8, fontWeight:'700', letterSpacing:0.5, textAlign:'center' },
  gaugeBg:     { width:'100%', height:5, backgroundColor:'rgba(255,255,255,0.1)', borderRadius:3, overflow:'hidden' },
  gaugeFill:   { height:'100%', borderRadius:3 },
  angleRow:    { alignItems:'center' },
  angleNum:    { color:'rgba(255,255,255,0.85)', fontSize:16, fontWeight:'900' },
  angleLabel:  { color:'rgba(255,255,255,0.35)', fontSize:8, fontWeight:'600' },
});

// ─── VoiceTranscriptOverlay ───────────────────────────────────────────────────

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
            {[0,1,2].map(i => <View key={i} style={[vtv.dot, { opacity:0.3+i*0.25 }]} />)}
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
  const [facing, setFacing] = useState<'front'|'back'>(defaultFacing);

  const { isReady, isRealPose, landmarks, error: poseError, status: poseStatus, retry: retryPose, setSquatMockMode } = usePoseDetection();
  const { judge, voiceTranscript, squatCount, resetVoice } = useJudgement();
  const { state, countdown, elapsed, videoUri, start, stop, reset:resetRecording } = useRecording();

  const [showIntro,  setShowIntro]  = useState(false);
  const [showOutro,  setShowOutro]  = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const introShownRef = useRef(false);

  const [currentScore,   setCurrentScore]   = useState(0);
  const [currentTag,     setCurrentTag]     = useState<JudgementTag>('fail');
  const [currentMission, setCurrentMission] = useState<any>(null);
  const [squatKneeAngle, setSquatKneeAngle] = useState(180);
  const [squatPhase,     setSquatPhase]     = useState<'up'|'down'|'unknown'>('unknown');

  const [burstVisible, setBurstVisible] = useState(false);
  const [burstTag,     setBurstTag]     = useState<JudgementTag|null>(null);
  const [combo,        setCombo]        = useState(0);
  const [tagStampTs,   setTagStampTs]   = useState(0);
  const [particles,    setParticles]    = useState<Particle[]>([]);
  const [charState,    setCharState]    = useState<keyof typeof CHAR>('idle');

  const charScale   = useRef(new Animated.Value(1)).current;
  const missionAnim = useRef(new Animated.Value(0)).current;
  const hudOpacity  = useRef(new Animated.Value(0)).current;

  const prevTagRef        = useRef<JudgementTag>('fail');
  const prevCountdownRef  = useRef<number>(3);
  const comboRef          = useRef(0);
  const burstTimerRef     = useRef<ReturnType<typeof setTimeout>|null>(null);
  const prevMissionSeqRef = useRef<number|null>(null);
  const bgmStopRef        = useRef<(()=>void)|null>(null);
  const scoreAccumRef     = useRef<number[]>([]);

  const maxW = Math.min(width - 32, 500);

  const prevSessionKeyRef = useRef<number>(-1);
  useEffect(() => {
    if (!activeTemplate) return;
    if (sessionKey === prevSessionKeyRef.current) return;
    prevSessionKeyRef.current = sessionKey;
    // prewarmMic() 제거: 카메라 스트림에 이미 오디오 포함, 별도 getUserMedia 호출은 마이크 팝업 유발
    // Cycle 30 — 실제 카메라 감지만 사용, 자동 스쿼트 목(Mock) 모드 끔.
    // 기존 setSquatMockMode(fitness)는 MediaPipe 실패 fallback 시 사용자가 움직이지 않아도
    // 스쿼트 카운트가 자동 증가하는 치명적 버그의 원인 → 비활성화.
    try { setSquatMockMode(false); } catch { /* ignore */ }
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

  // 화면 진입 시 음성 인식 권한 미리 요청 (녹화 중 팝업 방지)
  useEffect(() => {
    const t = setTimeout(prewarmSpeech, 800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // Focused Commit C-4: activeTemplate 없이 진입 시 router.back() 은 이력 없을 때 실패.
  // router.replace 로 홈 리다이렉트 (Edge/새 탭 직접 링크 대응).
  useEffect(() => {
    if (!activeTemplate) {
      // FIX-E3: debug 모드에서는 리다이렉트 스킵 → record 페이지 붙잡고 진단 표시.
      if (typeof window !== 'undefined') {
        const q = window.location.search;
        const sticky = (() => { try { return window.localStorage.getItem('motiq_debug') === '1'; } catch { return false; } })();
        if (/[?&]debug=1\b/.test(q) || sticky) {
          if (/[?&]debug=1\b/.test(q)) { try { window.localStorage.setItem('motiq_debug','1'); } catch {} }
          return;
        }
      }
      try { router.replace('/(main)/home'); }
      catch { if (typeof window !== 'undefined') window.location.href = '/'; }
    }
  }, [activeTemplate]);
  // Focused Commit C-1: route unmount 종합 cleanup
  //   - voice/BGM 정지
  //   - __permissionStream track 정지 (프리워밍 세션 회수)
  //   - window global (__poseVideoEl / __compositorCanvas / __permissionStream) 해제
  //   - errorClassifier 의 'navigation-cleanup-failed' 카테고리로 실패 로깅
  useEffect(() => () => {
    try { resetVoice(); } catch (e) { console.warn('[record] unmount cleanup: resetVoice', e); }
    try {
      if (bgmStopRef.current) { bgmStopRef.current(); bgmStopRef.current = null; }
    } catch (e) { console.warn('[record] unmount cleanup: bgmStop', e); }
    if (typeof window !== 'undefined') {
      const w = window as any;
      try {
        const pre = w.__permissionStream as MediaStream | undefined;
        if (pre && pre.getTracks) pre.getTracks().forEach((t: MediaStreamTrack) => { try { t.stop(); } catch {} });
      } catch (e) { console.warn('[record] unmount cleanup: __permissionStream stop', e); }
      try { w.__poseVideoEl = undefined; } catch {}
      try { w.__permissionStream = undefined; } catch {}
      try { w.__compositorCanvas = undefined; } catch {}
    }
  }, [resetVoice]);

  useEffect(() => {
    if (state === 'recording') Animated.timing(hudOpacity, { toValue:1, duration:400, useNativeDriver:true }).start();
    else hudOpacity.setValue(0);
  }, [state]);

  // Focused Commit C-2: UnloadGuard 자동 arm/disarm
  //   - recording 상태 진입 시 arm (beforeunload 확인 다이얼로그)
  //   - 그 외 상태(idle/complete) 진입 시 자동 disarm
  //   - 라우트 언마운트 시 반드시 disarm (메모리 누수·유령 다이얼로그 방지)
  const unloadGuardRef = useRef<UnloadGuard | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!unloadGuardRef.current) unloadGuardRef.current = new UnloadGuard();
    const g = unloadGuardRef.current;
    if (state === 'recording') g.arm(); else g.disarm();
  }, [state]);
  useEffect(() => () => {
    try { unloadGuardRef.current?.disarm(); } catch {}
    unloadGuardRef.current = null;
  }, []);

  // Cycle 29 — 데스크톱 키보드 단축키: Space = 시작/중지, Esc = 취소
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing into a form field
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (state === 'idle' && isReady && cameraRef.current) {
          initAudio();
          try { prewarmSpeech(); } catch {}
          start(cameraRef.current);
        } else if (state === 'recording' && cameraRef.current) {
          stop(cameraRef.current);
        }
      } else if (e.code === 'Escape') {
        if (state === 'idle') router.back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, isReady, start, stop, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const bounceChar = useCallback(() => {
    Animated.sequence([
      Animated.spring(charScale, { toValue:1.5, tension:120, friction:5, useNativeDriver:true }),
      Animated.spring(charScale, { toValue:1.0, tension:80,  friction:6, useNativeDriver:true }),
    ]).start();
  }, [charScale]);

  const addParticles = useCallback(() => {
    const pts: Particle[] = Array.from({ length:12 }, (_, i) => ({
      id: Date.now() + i,
      emoji: PARTICLES[Math.floor(Math.random()*PARTICLES.length)],
      left: `${3+Math.random()*94}%`,
      speed: 0.8+Math.random()*0.8,
    }));
    setParticles(pts);
    setTimeout(() => setParticles([]), 1600);
  }, []);

  const animateMissionIn = useCallback(() => {
    missionAnim.setValue(0);
    Animated.spring(missionAnim, { toValue:1, tension:65, friction:8, useNativeDriver:true }).start();
  }, [missionAnim]);

  useEffect(() => {
    if (state !== 'recording') return;
    // FIX-A (2026-04-21): `isRealPose` 게이트 제거.
    //   기존에는 MediaPipe 포즈 검출 실패 시 judge() 가 아예 호출되지 않아
    //   음성 인식(sr.listen)·미션 타임라인·TTS 가이드까지 전부 죽었다.
    //   → 포즈 없어도 시간 진행·음성·미션 전환은 돌아야 한다.
    //   가짜 스쿼트 카운트 방지는 useJudgement 내부에서 이미
    //   hasRealLandmarks 체크로 처리 중 (points>=17 & visible>=6~8).
    //   포즈 없는 landmarks=[] 를 넘겨도 score=0 으로 안전하게 종료됨.
    const poseLandmarks = isRealPose ? landmarks : [];
    const result = judge(poseLandmarks, elapsed);
    setCurrentScore(result.score); setCurrentTag(result.tag); setCurrentMission(result.currentMission);
    scoreAccumRef.current.push(result.score);
    if (activeTemplate?.genre === 'fitness') { setSquatKneeAngle(result.kneeAngle); setSquatPhase(result.squatPhase); }
    if (result.currentMission && result.currentMission.seq !== prevMissionSeqRef.current) {
      prevMissionSeqRef.current = result.currentMission.seq;
      animateMissionIn();
      const m = result.currentMission;
      // voice_read 미션에서는 TTS가 대본을 읽지 않음 (사용자가 읽어야 함).
      // 대신 짧은 안내만 — 자막 화면에 텍스트가 크게 표시되므로 TTS 음성이 마이크 입력을 오염시키지 않도록 차단.
      if (m.type === 'voice_read') {
        // no speakMission — 가이드는 자막 렌더로만 처리
        // BGM 덕킹: 사용자 음성이 잘 들리도록 배경음 볼륨 저하
        try { getBgmPlayer().duck(0.22); } catch {}
      } else {
        try { getBgmPlayer().unduck(); } catch {}
        if (m.guide_text) speakMission(m.guide_text);
      }
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
        setTagStampTs(performance.now());
        burstTimerRef.current = setTimeout(() => setBurstVisible(false), 900);
      }
    }
  }, [landmarks, state, elapsed]);

  useEffect(() => {
    if (state==='countdown' && countdown !== prevCountdownRef.current) {
      prevCountdownRef.current = countdown;
      if (countdown > 0) playSound('tick'); else playSound('countdown_end');
    }
  }, [state, countdown]);

  useEffect(() => {
    if (state === 'recording') {
      playSound('start');
      setCharState('idle'); comboRef.current = 0; setCombo(0);
      prevMissionSeqRef.current = null; scoreAccumRef.current = [];
      if (activeTemplate?.intro && !introShownRef.current) {
        introShownRef.current = true;
        setShowIntro(true);
      }
      // Real MP3 BGM — SoundHelix curated per-genre track
      try {
        const url = getBgmTrackUrl(activeTemplate?.genre ?? 'daily');
        const player = getBgmPlayer();
        player.play({ url, volume: 0.32, loop: true, fadeInMs: 1500 }).catch((e) => {
          console.warn('[BGM] MP3 play failed, fallback to synth:', e);
          try {
            const audioCtx = initAudio();
            if (bgmStopRef.current) bgmStopRef.current();
            bgmStopRef.current = createGameBGM(audioCtx, { genre: 'lofi', bpm: 120, volume: 0.35 }, audioCtx.destination);
          } catch {}
        });
        // Provide a stop handle
        if (bgmStopRef.current) bgmStopRef.current();
        bgmStopRef.current = () => player.stop();
      } catch (e) {
        console.warn('[BGM] 초기화 실패:', e);
      }
    } else {
      if (bgmStopRef.current) { bgmStopRef.current(); bgmStopRef.current = null; }
      try { getBgmPlayer().stop(); } catch {}
    }
  }, [state]);

  useEffect(() => {
    if (state !== 'done' || !videoUri) return;
    resetVoice();
    const scores = scoreAccumRef.current;
    const avg = scores.length > 0 ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
    setFinalScore(avg);
    if (activeTemplate?.outro) {
      setShowOutro(true);
    } else {
      navigateToResult();
    }
  }, [state, videoUri]);

  const navigateToResult = useCallback(() => {
    if (!videoUri) return;
    if (!activeTemplate) { router.push({ pathname:'/result', params:{ videoUri } }); return; }
    const vt = getTemplateByMissionId(activeTemplate.genre);
    router.push({ pathname:'/result', params:{ videoUri, ...(vt ? { videoTemplateId:vt.id } : {}) } });
  }, [videoUri, activeTemplate, router]);

  const handleFrame = useCallback(async () => {}, []);

  // FIX-E2 (2026-04-21): localStorage sticky debug.
  //   ?debug=1 한번 접속하면 이후 템플릿 선택 경유해도 계속 표시.
  //   ?debug=0 으로 해제.
  const debugOn = (() => {
    if (typeof window === 'undefined') return false;
    try {
      const q = window.location.search;
      if (/[?&]debug=1\b/.test(q)) { window.localStorage.setItem('motiq_debug', '1'); return true; }
      if (/[?&]debug=0\b/.test(q)) { window.localStorage.removeItem('motiq_debug'); return false; }
      return window.localStorage.getItem('motiq_debug') === '1';
    } catch { return false; }
  })();

  if (!activeTemplate) {
    return debugOn ? (
      <View style={{ flex:1, backgroundColor:'#000', padding:16, paddingTop:60 }}>
        <Text style={{ color:'#0f0', fontFamily:'monospace', fontSize:12 }}>
          [DEBUG] activeTemplate = null{'\n'}
          → 템플릿을 먼저 선택해야 record 가 뜹니다.{'\n'}
          홈으로 돌아가서 템플릿 하나 누르고 오세요.{'\n\n'}
          (debug 플래그는 localStorage 에 저장됨 — 계속 유지)
        </Text>
      </View>
    ) : null;
  }

  const isCountdown = state === 'countdown';
  const isRecording = state === 'recording';
  const isIdle      = state === 'idle';
  const missionProg = currentMission
    ? Math.min(1, Math.max(0, (elapsed-currentMission.start_ms)/Math.max(1,currentMission.end_ms-currentMission.start_ms)))
    : 0;
  const char = CHAR[charState];

  const elapsedSec = Math.floor(elapsed / 1000);
  const hudMM = String(Math.floor(elapsedSec/60)).padStart(2,'0');
  const hudSS = String(elapsedSec%60).padStart(2,'0');

  return (
    <View style={r.root}>
      <SafeAreaView style={r.safe} edges={['top','bottom']}>
        {debugOn && (
          <View pointerEvents="none" style={{
            position:'absolute', top:4, left:4, right:4, zIndex:9999,
            backgroundColor:'rgba(0,0,0,0.85)', padding:6, borderRadius:4,
          }}>
            <Text style={{ color:'#0f0', fontSize:10, fontFamily:'monospace' }}>
              state={state} elapsed={elapsed}ms {'\n'}
              poseStatus={poseStatus} isRealPose={String(isRealPose)} lm={landmarks.length}{'\n'}
              mission={currentMission?.type ?? '-'} seq={currentMission?.seq ?? '-'} {'\n'}
              voice="{(voiceTranscript||'').slice(0,50)}" squat={squatCount}{'\n'}
              poseErr={poseError?.slice(0,60) ?? '-'}
            </Text>
          </View>
        )}
        <View style={r.camWrap}>
          {/* VirtualBackgroundFrame removed — canvas handles all background compositing on web */}
            <RecordingCamera
              ref={cameraRef} facing={facing} onFrame={handleFrame}
              paused={isIdle || state==='processing'}
              onPermissionDenied={() => { Alert.alert('카메라 권한 필요','브라우저에서 카메라를 허용해주세요.'); router.back(); }}
              template={activeTemplate}
              elapsed={elapsed}
              currentMission={currentMission}
              missionScore={currentScore}
              isRecording={isRecording}
              landmarks={landmarks}
              currentTag={currentTag}
              tagTimestamp={tagStampTs}
              combo={combo}
              squatCount={squatCount}
              voiceTranscript={voiceTranscript}
            >
              {particles.map(p => <Text key={p.id} style={[r.particle, { left:p.left as any }]}>{p.emoji}</Text>)}

              {/* 상태 뱃지: 포즈/음성 감지 실제 작동 여부를 정직하게 표시 */}
              {isRecording && !showIntro && (
                <View style={r.statusBadgeRow} pointerEvents="none">
                  {/* 포즈 미션이 필요한 장르에서만 표시 */}
                  {(activeTemplate?.genre === 'fitness' ||
                    activeTemplate?.missions.some(m => m.type === 'gesture' || m.type === 'timing' || m.type === 'expression')) && (
                    <View style={[r.statusChip,
                      poseStatus === 'ready-real' && isRealPose ? r.statusChipOk :
                      poseStatus === 'ready-mock' ? r.statusChipWarn :
                      poseStatus === 'error' ? r.statusChipWarn :
                      r.statusChipWarn]}>
                      <Text style={r.statusChipText}>
                        {poseStatus === 'ready-real' && isRealPose ? '🟢 포즈 감지 중'
                          : poseStatus === 'ready-mock' ? '🟡 개발 모드 (모의 포즈)'
                          : poseStatus === 'error' ? '🔴 포즈 엔진 실패'
                          : poseStatus === 'loading' ? '⏳ 포즈 모델 다운로드 중'
                          : '⏳ 대기 중'}
                      </Text>
                    </View>
                  )}
                  {/* 음성 미션이 있으면 표시 */}
                  {activeTemplate?.missions.some(m => m.type === 'voice_read') && (
                    <View style={[r.statusChip, voiceTranscript ? r.statusChipOk : r.statusChipWarn]}>
                      <Text style={r.statusChipText}>
                        {voiceTranscript ? '🟢 음성 인식 중' : '🎤 말해주세요'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* TOP HUD: [● REC 00:23]  [score]  [🔥3x] [🔄] */}
              <Animated.View style={[r.topHud, { opacity:hudOpacity }]}>
                <View style={r.recBadge}>
                  <View style={r.recDot} />
                  <Text style={r.recText}>REC</Text>
                  <Text style={r.recTimer}>{hudMM}:{hudSS}</Text>
                </View>
                <View style={{ flex:1 }} />
                <NeonScore score={currentScore} tag={currentTag} />
                <View style={{ flex:1 }} />
                {combo >= 2 && (
                  <View style={[r.comboPill, combo >= 5 && r.comboPillHot]}>
                    <Text style={r.comboText}>🔥 {combo}x</Text>
                  </View>
                )}
                <TouchableOpacity style={r.flipBtn} onPress={() => setFacing(f => f==='front'?'back':'front')} hitSlop={{top:12,bottom:12,left:12,right:12}}>
                  <Text style={r.flipText}>🔄</Text>
                </TouchableOpacity>
              </Animated.View>

              {isRecording && !showIntro && (
                <Animated.View style={[r.charArea, { transform:[{ scale:charScale }] }]}>
                  <View style={[r.charBubble, { backgroundColor:char.color+'2a', borderColor:char.color+'55',
                    // @ts-ignore web
                    boxShadow:`0 0 20px ${char.glow}, 0 0 40px ${char.glow}` }]}>
                    <Text style={r.charEmoji}>{char.emoji}</Text>
                  </View>
                </Animated.View>
              )}

              {isRecording && !showIntro && activeTemplate?.genre==='fitness' && (
                <SquatHUD count={squatCount} phase={squatPhase} kneeAngle={squatKneeAngle} />
              )}

              {isRecording && !showIntro && currentMission && currentMission.type!=='voice_read' && (
                <MissionCard mission={currentMission} progress={missionProg} tag={currentTag} voiceTranscript={voiceTranscript} anim={missionAnim} maxW={maxW} />
              )}

              {isRecording && !showIntro && currentMission?.type==='voice_read' && (
                <VoiceTranscriptOverlay transcript={voiceTranscript} readText={currentMission.read_text} />
              )}

              {isIdle && (
                <View style={[r.infoOverlay, { maxWidth:maxW }]}>
                  <Text style={r.infoEmoji}>{activeTemplate.theme_emoji}</Text>
                  <Text style={r.infoTitle}>{activeTemplate.name}</Text>
                  <Text style={r.infoMeta}>{activeTemplate.duration_sec}초 · {activeTemplate.missions.length}개 미션</Text>
                  {activeTemplate.scene ? <Text style={r.infoScene} numberOfLines={3}>{activeTemplate.scene}</Text> : null}
                  {activeTemplate.intro && (
                    <View style={r.introBadge}><Text style={r.introBadgeText}>✨ 드라마틱 인트로 포함</Text></View>
                  )}
                  {activeTemplate.camera_mode==='selfie' && (
                    <View style={r.selfieChip}><Text style={r.selfieText}>📱 전면 카메라 모드</Text></View>
                  )}
                  <TouchableOpacity style={r.flipBtnIdle} onPress={() => setFacing(f => f==='front'?'back':'front')}>
                    <Text style={r.flipBtnIdleText}>🔄 {facing==='front'?'후면으로':'전면으로'} 전환</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isCountdown && <CountdownOverlay count={countdown} templateName={activeTemplate.name} emoji={activeTemplate.theme_emoji} />}

              <TemplateOverlay template={activeTemplate} elapsed={elapsed} isRecording={isRecording && !showIntro} />

              {isRecording && !showIntro && (
                <View style={r.timingBarWrap}><TimingBar template={activeTemplate} elapsedMs={elapsed} /></View>
              )}

              {isRecording && !showIntro && <JudgementBurst tag={burstTag} combo={combo} visible={burstVisible} />}

              {isRecording && !showIntro && (
                <View style={r.stopArea}>
                  <TouchableOpacity style={r.stopBtn} onPress={() => cameraRef.current && stop(cameraRef.current)} hitSlop={{top:16,bottom:16,left:16,right:16}}>
                    <View style={r.stopIcon} />
                  </TouchableOpacity>
                  <Text style={r.stopHint}>탭하여 중지</Text>
                </View>
              )}

              {isIdle && (
                <View style={[r.startArea, { maxWidth:maxW }]}>
                  <Pressable
                    style={[r.startBtn, !isReady && { opacity: 0.55 }]}
                    disabled={!isReady}
                    onPress={() => {
                      if (!isReady) return;
                      initAudio();
                      // FIX-F: 모바일 Chrome 은 user gesture 스택 안에서 바로
                      // SpeechRecognition.start() 호출해야 함. useEffect 경로는 거부됨.
                      try { prewarmSpeech(); } catch {}
                      if (cameraRef.current) start(cameraRef.current);
                    }}
                  >
                    <View style={r.startGlow} />
                    <Text style={r.startBtnText}>
                      {isReady ? '▶  챌린지 시작' : '⏳  포즈 모델 로딩 중...'}
                    </Text>
                  </Pressable>
                  {typeof window !== 'undefined' && (
                    <Text style={r.kbdHint}>Space = 시작 · Esc = 취소</Text>
                  )}
                  <TouchableOpacity style={r.cancelBtn} onPress={() => router.back()} hitSlop={{top:12,bottom:12,left:24,right:24}}>
                    <Text style={r.cancelText}>← 취소</Text>
                  </TouchableOpacity>
                </View>
              )}
            </RecordingCamera>

          {showIntro && activeTemplate.intro && (
            <IntroOverlay intro={activeTemplate.intro} genre={activeTemplate.genre} onDone={() => setShowIntro(false)} />
          )}

          {showOutro && activeTemplate.outro && (
            <OutroOverlay outro={activeTemplate.outro} score={finalScore} onDone={() => { setShowOutro(false); navigateToResult(); }} />
          )}

          {/* 포즈 엔진 로드 실패 오버레이 — 녹화 시작 전에만 노출, 프로덕션에서는 조용히 mock 으로 넘어가지 않음 */}
          {poseStatus === 'error' && isIdle && (
            <View style={r.poseErrorOverlay} pointerEvents="auto">
              <View style={r.poseErrorCard}>
                <Text style={r.poseErrorTitle}>포즈 엔진을 불러오지 못했습니다</Text>
                <Text style={r.poseErrorDetail}>{poseError ?? '네트워크 연결을 확인하고 다시 시도해주세요.'}</Text>
                <View style={r.poseErrorRow}>
                  <TouchableOpacity style={r.poseErrorBtnPrimary} onPress={retryPose}>
                    <Text style={r.poseErrorBtnPrimaryText}>다시 시도</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={r.poseErrorBtnGhost} onPress={() => router.back()}>
                    <Text style={r.poseErrorBtnGhostText}>취소</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Root styles ──────────────────────────────────────────────────────────────

const r = StyleSheet.create({
  root:    { flex:1, backgroundColor:'#000' },
  safe:    { flex:1 },
  camWrap: { flex:1 },
  statusBadgeRow: { position:'absolute', top:70, left:0, right:0, flexDirection:'row', justifyContent:'center', gap:6, zIndex:25 },
  statusChip: { paddingHorizontal:10, paddingVertical:4, borderRadius:12, borderWidth:1 },
  statusChipOk: { backgroundColor:'rgba(34,197,94,0.2)', borderColor:'rgba(34,197,94,0.6)' },
  statusChipWarn: { backgroundColor:'rgba(239,68,68,0.2)', borderColor:'rgba(239,68,68,0.6)' },
  statusChipText: { color:'#fff', fontSize:11, fontWeight:'700' },
  poseErrorOverlay: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.88)', alignItems:'center', justifyContent:'center', zIndex:200, padding:24 },
  poseErrorCard:    { width:'100%', maxWidth:360, backgroundColor:'#111', borderRadius:18, borderWidth:1, borderColor:'rgba(239,68,68,0.4)', padding:22, gap:14 },
  poseErrorTitle:   { color:'#fff', fontSize:17, fontWeight:'900', textAlign:'center' },
  poseErrorDetail:  { color:'rgba(255,255,255,0.72)', fontSize:13, lineHeight:18, textAlign:'center' },
  poseErrorRow:     { flexDirection:'row', gap:10, marginTop:4 },
  poseErrorBtnPrimary:      { flex:1, paddingVertical:12, borderRadius:12, backgroundColor:'#ef4444', alignItems:'center' },
  poseErrorBtnPrimaryText:  { color:'#fff', fontSize:14, fontWeight:'900' },
  poseErrorBtnGhost:        { flex:1, paddingVertical:12, borderRadius:12, backgroundColor:'transparent', borderWidth:1, borderColor:'rgba(255,255,255,0.24)', alignItems:'center' },
  poseErrorBtnGhostText:    { color:'#fff', fontSize:14, fontWeight:'700' },
  particle:{ position:'absolute', top:'10%', fontSize:30, zIndex:50,
    // @ts-ignore web
    animation:'float 1.6s ease-out forwards' },
  topHud:       { position:'absolute', top:12, left:12, right:12, flexDirection:'row', alignItems:'center', gap:8, zIndex:30 },
  recBadge:     { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(0,0,0,0.72)', paddingHorizontal:12, paddingVertical:6, borderRadius:10, borderWidth:1, borderColor:'rgba(255,255,255,0.12)',
    // @ts-ignore web
    backdropFilter:'blur(8px)', boxShadow:'0 0 8px rgba(239,68,68,0.25)' },
  recDot:       { width:8, height:8, borderRadius:4, backgroundColor:'#ef4444',
    // @ts-ignore web
    boxShadow:'0 0 6px #ef4444' },
  recText:      { color:'#fff', fontSize:11, fontWeight:'900', letterSpacing:1.5 },
  recTimer:     { color:'rgba(255,255,255,0.85)', fontSize:13, fontWeight:'900', letterSpacing:1, fontVariant:['tabular-nums'] as any },
  comboPill:    { backgroundColor:'rgba(239,68,68,0.85)', paddingHorizontal:10, paddingVertical:5, borderRadius:14, borderWidth:1, borderColor:'rgba(255,255,255,0.2)' },
  comboPillHot: { backgroundColor:'rgba(234,179,8,0.9)',
    // @ts-ignore web
    boxShadow:'0 0 12px rgba(234,179,8,0.6)' },
  comboText:    { color:'#fff', fontSize:12, fontWeight:'900' },
  flipBtn:      { width:40, height:40, borderRadius:20, backgroundColor:'rgba(0,0,0,0.65)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.18)',
    // @ts-ignore web
    backdropFilter:'blur(8px)' },
  flipText:     { fontSize:18 },
  charArea:     { position:'absolute', top:60, alignSelf:'center', alignItems:'center', zIndex:20 },
  charBubble:   { width:70, height:70, borderRadius:35, alignItems:'center', justifyContent:'center', borderWidth:1.5 },
  charEmoji:    { fontSize:42 },
  infoOverlay:  { position:'absolute', top:'18%', alignSelf:'center', width:'90%', backgroundColor:'rgba(0,0,0,0.85)',
    // @ts-ignore web
    backdropFilter:'blur(20px)', borderRadius:28, padding:28, alignItems:'center', gap:10, zIndex:20, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  infoEmoji:    { fontSize:60 },
  infoTitle:    { color:'#fff', fontSize:24, fontWeight:'800', textAlign:'center', letterSpacing:-0.3,
    // @ts-ignore web
    textShadow:'0 2px 12px rgba(204,120,92,0.55)' },
  infoMeta:     { color:'#94a3b8', fontSize:13, fontWeight:'600' },
  infoScene:    { color:'#cbd5e1', fontSize:13, textAlign:'center', lineHeight:20, fontStyle:'italic' },
  introBadge:   { backgroundColor:'rgba(204,120,92,0.25)', borderRadius:999, paddingHorizontal:16, paddingVertical:6, borderWidth:1, borderColor:Claude.amber },
  introBadgeText:{ color:'#F7E4D9', fontSize:11, fontWeight:'800', letterSpacing:1.2 },
  selfieChip:   { backgroundColor:'rgba(204,120,92,0.22)', borderRadius:999, paddingHorizontal:14, paddingVertical:6, borderWidth:1, borderColor:Claude.amber },
  selfieText:   { color:'#F7E4D9', fontSize:12, fontWeight:'800', letterSpacing:0.4 },
  flipBtnIdle:  { marginTop:4, backgroundColor:'rgba(255,255,255,0.1)', paddingHorizontal:22, paddingVertical:12, borderRadius:20, borderWidth:1, borderColor:'rgba(255,255,255,0.2)', minHeight:46, justifyContent:'center' },
  flipBtnIdleText:{ color:'#e2e8f0', fontSize:13, fontWeight:'700' },
  timingBarWrap:{ position:'absolute', bottom:100, left:0, right:0, zIndex:10 },
  stopArea:     { position:'absolute', bottom:24, alignSelf:'center', alignItems:'center', gap:8, zIndex:35 },
  stopBtn:      { width:72, height:72, borderRadius:36, backgroundColor:'rgba(255,255,255,0.1)', borderWidth:3.5, borderColor:'#fff', alignItems:'center', justifyContent:'center',
    // @ts-ignore web
    boxShadow:'0 0 20px rgba(255,255,255,0.3)' },
  stopIcon:     { width:26, height:26, backgroundColor:'#ef4444', borderRadius:6 },
  stopHint:     { color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:'500' },
  startArea:    { position:'absolute', bottom:28, alignSelf:'center', width:'90%', alignItems:'center', gap:14, zIndex:35 },
  startBtn:     { width:'100%', paddingVertical:20, borderRadius:999, alignItems:'center', justifyContent:'center', minHeight:64,
    backgroundColor:Claude.ink, borderWidth:1, borderColor:Claude.amber,
    // @ts-ignore web
    boxShadow:'0 14px 30px -10px rgba(204,120,92,0.7), inset 0 1px 0 rgba(255,255,255,0.15)',
    overflow:'hidden', position:'relative' },
  startGlow:    { position:'absolute', inset:0 as any,
    // @ts-ignore web
    boxShadow:'inset 0 1px 0 rgba(247,228,217,0.25)' },
  startBtnText: { color:Claude.paper, fontSize:17, fontWeight:'800', letterSpacing:1.8, zIndex:1 },
  cancelBtn:    { paddingVertical:10 },
  cancelText:   { color:'rgba(255,255,255,0.45)', fontSize:14, fontWeight:'500' },
  kbdHint:      { color:'rgba(255,255,255,0.35)', fontSize:11, fontWeight:'600', letterSpacing:0.5, marginTop:-2 },
});
