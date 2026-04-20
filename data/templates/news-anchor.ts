/**
 * data/templates/news-anchor.ts
 *
 * Phase 5i Template 2: **시네마틱 뉴스룸 낭독**.
 * docs/TEMPLATES.md §템플릿 2.
 */

import type { Template } from '../../engine/templates/schema';

export const newsAnchor: Template = {
  id: 'news-anchor',
  title: '뉴스 앵커',
  description: 'BBC/JTBC 시네마틱 뉴스룸에서 낭독 챌린지.',
  thumbnail: '/templates/news-anchor/thumb.png',
  previewVideo: '/templates/news-anchor/preview.mp4',
  duration: 20,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'cinematic_news',

  bgm: {
    src: '/bgm/news-orchestra-90.mp3',
    volume: 0.5,
    beatsJson: '/bgm/news-orchestra-90.beats.json',
    loop: true,
    duckingDb: -10,
  },

  cameraFraming: { kind: 'rounded_rect', x: 120, y: 260, w: 840, h: 1120, radius: 16 },

  layers: [
    // 배경 (1~10)
    { id: 'bg_studio',   type: 'image_bg',        zIndex: 1, opacity: 0.95, enabled: true, props: { src: '/templates/news-anchor/studio.jpg', blurPx: 12, panPxPerSec: 6 } },
    { id: 'bg_grad',     type: 'gradient_mesh',   zIndex: 2, opacity: 0.8,  enabled: true, props: { colors: ['#0B1828', '#12263F'] } },
    { id: 'bg_grain',    type: 'noise_pattern',   zIndex: 3, opacity: 0.12, enabled: true },

    // 카메라 (20~25)
    { id: 'cam_feed',    type: 'camera_feed',     zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',   type: 'camera_frame',    zIndex: 21, opacity: 1, enabled: true, props: { borderWidth: 1, borderColor: '#D4AF37', softShadow: true } },
    { id: 'live_badge',  type: 'banner_badge',    zIndex: 22, opacity: 1, enabled: true, props: { text: 'LIVE', bg: '#FF3B5C', dotColor: '#FFFFFF', position: { x: 140, y: 280 } },
      reactive: { onBeat: { every: 4, property: 'opacity', amount: 0.4, easing: 'standard', durationMs: 250 } } },

    // 뉴스 그래픽 (30~40)
    { id: 'breaking_bar',type: 'banner_badge',    zIndex: 30, opacity: 1, enabled: true, props: { text: 'BREAKING NEWS', bg: '#D4AF37', color: '#0B1828', skewDeg: 6 } },
    { id: 'ticker',      type: 'news_ticker',     zIndex: 31, opacity: 1, enabled: true, props: { text: '실시간 뉴스 · 오늘의 주요 소식 · 미션 진행 중 · 챌린지 스튜디오', bg: '#D4AF37', speedPxPerSec: 120 } },
    { id: 'title',       type: 'kinetic_text',    zIndex: 32, opacity: 1, enabled: true, props: { text: '앵커 챌린지', size: 72, color: '#FFFFFF' }, activeRange: { startSec: 0, endSec: 1.5 } },
    { id: 'title_fixed', type: 'kinetic_text',    zIndex: 33, opacity: 1, enabled: true, props: { text: '앵커 챌린지', size: 24, color: '#A0AEC0', position: 'top-left' }, activeRange: { startSec: 1.5, endSec: 20 } },
    { id: 'logo',        type: 'image_bg',        zIndex: 34, opacity: 0.9, enabled: true, props: { src: '/templates/news-anchor/logo.png', position: 'top-right', sizePx: 80 } },

    // 자막 (50)
    { id: 'caption',     type: 'karaoke_caption', zIndex: 50, opacity: 1, enabled: true, props: { color: '#D4AF37', mutedColor: '#4A5568' } },
    { id: 'script_ghost',type: 'mission_prompt',  zIndex: 51, opacity: 0.35, enabled: true, props: { text: '안녕하십니까, 오늘의 날씨를 전해드립니다. 맑은 하늘이 예상됩니다.', size: 18, position: 'top' } },

    // HUD (55~65)
    { id: 'hud_score',   type: 'score_hud',       zIndex: 55, opacity: 1, enabled: true, props: { label: '정확도', suffix: '%', color: '#0B1828', border: '#D4AF37' } },
    { id: 'hud_timer',   type: 'timer_ring',      zIndex: 56, opacity: 1, enabled: true, props: { position: 'top-left', color: '#D4AF37' } },

    // 반응형 (70)
    { id: 'audio_wave',  type: 'audio_visualizer',zIndex: 70, opacity: 0.8, enabled: true, props: { kind: 'waveform', color: '#D4AF37', showOnly: 'voiceActive' } },

    // 성공 이펙트 (80)
    { id: 'fx_gold',     type: 'particle_burst',  zIndex: 80, opacity: 1, enabled: false, props: { count: 20, colors: ['#D4AF37'] } },
    { id: 'fx_chroma',   type: 'chromatic_pulse', zIndex: 81, opacity: 1, enabled: false, props: { peakPx: 0.5 } },
  ],

  missionTimeline: [
    {
      id: 'read_news', startSec: 2, endSec: 17,
      mission: { kind: 'read_script', script: '안녕하십니까, 오늘의 날씨를 전해드립니다. 맑은 하늘이 예상됩니다.' },
      scoreWeight: 1.0,
      hudBinding: 'caption',
    },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.4 },
    { kind: 'lut', path: '/luts/warm-news.cube' },
    { kind: 'film_grain', opacity: 0.2 },
    { kind: 'vignette', intensity: 0.15 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 700, props: { colors: ['#D4AF37'] } },
    { kind: 'kinetic_text', durationMs: 1000, props: { text: '완벽한 앵커' } },
  ],
  failEffects: [
    { kind: 'lut_mono', durationMs: 300 },
  ],
};
