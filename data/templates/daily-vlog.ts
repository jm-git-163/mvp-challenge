/**
 * data/templates/daily-vlog.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — 데일리 브이로그 독립 템플릿.
 *
 * 팔레트: 로파이 — 크림(#FFF4E0) + 더스티블루(#8EA8C3) + 머스타드(#E3B04B).
 * BGM: pulsebox-a-background-jazz (로파이 재즈).
 */
import type { Template } from '../../engine/templates/schema';

const CREAM   = '#FFF4E0';
const BLUE    = '#8EA8C3';
const MUSTARD = '#E3B04B';
const BROWN   = '#5B4636';

export const dailyVlog: Template = {
  id: 'daily-vlog',
  title: '데일리 브이로그',
  description: '로파이 브이로그. 크림 톤 일상.',
  thumbnail: '/templates/daily-vlog/thumb.png',
  duration: 18,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'warm_asmr',

  bgm: {
    src: '/bgm/pulsebox-a-background-jazz-no-copyright-448459.mp3',
    volume: 0.55,
    beatsJson: '/bgm/pulsebox-a-background-jazz-no-copyright-448459.beats.json',
    loop: true,
    duckingDb: -10,
  },

  cameraFraming: { kind: 'fullscreen' },

  layers: [
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [CREAM, '#FFE5B4', BLUE], hueCyclePeriodSec: 90 } },
    { id: 'bg_grain',      type: 'noise_pattern',    zIndex: 2, opacity: 0.1, enabled: true },
    { id: 'bg_dust',       type: 'particle_ambient', zIndex: 3, opacity: 0.4, enabled: true, props: { preset: 'glitter_down', count: 18 } },

    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.2, enabled: true, props: { borderColor: MUSTARD, borderWidth: 2, softShadow: true } },

    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', color: BROWN, border: MUSTARD } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: MUSTARD } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '오늘 하루 얘기해주세요', color: BROWN, position: 'top' }, activeRange: { startSec: 2, endSec: 5 } },

    { id: 'caption',       type: 'karaoke_caption',  zIndex: 50, opacity: 1, enabled: true, props: { color: BROWN, mutedColor: '#A08D77', position: 'bottom', y: 1500 } },

    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: '📔 DAILY VLOG', fontSize: 72, color: BROWN, strokeColor: CREAM, strokeWidth: 6, mode: 'drop', position: 'top-center', startMs: 200, staggerMs: 60 }, activeRange: { startSec: 0, endSec: 2 } },
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: 'SEE YOU TOMORROW', fontSize: 56, color: MUSTARD, strokeColor: BROWN, strokeWidth: 5, mode: 'drop', position: 'top-center', startMs: 15500, staggerMs: 45 }, activeRange: { startSec: 15.5, endSec: 18 } },

    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.8, enabled: true, props: { texts: ['#daily', '#vlog', '#lofi', '#life', '#diary', '#motiq'], speedPxPerSec: 70, fontSize: 26, bgColor: 'rgba(91,70,54,0.6)', color: CREAM, accentColor: MUSTARD, position: 'bottom' }, activeRange: { startSec: 2, endSec: 15.5 } },
  ],

  hashtags: ['daily', 'vlog', 'lofi', 'life', 'diary', 'motiq'],

  missionTimeline: [
    { id: 'vlog_read', startSec: 2, endSec: 16, mission: { kind: 'read_script', script: '오늘은 특별한 하루였어요. 좋은 일들이 많이 있었습니다.' }, scoreWeight: 1.0, hudBinding: 'caption' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.3 },
    { kind: 'film_grain', opacity: 0.15 },
    { kind: 'vignette', intensity: 0.2 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 600, props: { colors: [MUSTARD, CREAM] } },
  ],
  failEffects: [],
};
