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
    // FIX-Z8 (2026-04-22): news-orchestra-90.mp3 에셋 부재. 실존 재즈/앰비언트 트랙으로 재매핑.
    src: '/bgm/atlasaudio-jazz-490623.mp3',
    volume: 0.5,
    beatsJson: '/bgm/atlasaudio-jazz-490623.beats.json',
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

    // ── INTRO (0 ~ 2.5s) : BREAKING NEWS 풀스크린 시퀀스 ──────────
    { id: 'intro_flash',   type: 'beat_flash',      zIndex: 28, opacity: 1, enabled: true, props: { color: '#FF3B5C', peakOpacity: 0.55 }, activeRange: { startSec: 0, endSec: 0.7 } },
    { id: 'intro_title',   type: 'kinetic_text',    zIndex: 29, opacity: 1, enabled: true, props: { text: 'BREAKING NEWS', fontSize: 120, color: '#FFFFFF', strokeColor: '#FF3B5C', strokeWidth: 10, mode: 'pop', position: 'center', startMs: 200, staggerMs: 55 }, activeRange: { startSec: 0, endSec: 2.5 } },
    { id: 'intro_sub',     type: 'kinetic_text',    zIndex: 30, opacity: 1, enabled: true, props: { text: '속보 · LIVE', fontSize: 54, color: '#D4AF37', strokeColor: '#0B1828', strokeWidth: 6, mode: 'drop', position: 'bottom-center', startMs: 900, staggerMs: 60 }, activeRange: { startSec: 0.4, endSec: 2.5 } },
    { id: 'intro_ticker',  type: 'news_ticker',     zIndex: 31, opacity: 1, enabled: true, props: { texts: ['속보 · BREAKING', '오늘의 주요 소식', '특파원 생중계', '실시간 업데이트'], speedPxPerSec: 260, fontSize: 42, bgColor: '#FF3B5C', color: '#FFFFFF', accentColor: '#D4AF37', position: 'top', labelText: 'LIVE', labelBg: '#D4AF37', labelColor: '#0B1828' }, activeRange: { startSec: 0.3, endSec: 2.5 } },

    // 뉴스 그래픽 (30~40)
    { id: 'breaking_bar',type: 'banner_badge',    zIndex: 32, opacity: 1, enabled: true, props: { text: 'BREAKING NEWS', bg: '#D4AF37', color: '#0B1828', skewDeg: 6 }, activeRange: { startSec: 2.5, endSec: 17.5 } },
    { id: 'ticker',      type: 'news_ticker',     zIndex: 33, opacity: 1, enabled: true, props: { texts: ['실시간 뉴스', '오늘의 주요 소식', '미션 진행 중', '챌린지 스튜디오', '날씨 속보'], bgColor: '#D4AF37', color: '#0B1828', accentColor: '#FF3B5C', speedPxPerSec: 120, labelText: 'NEWS', labelBg: '#FF3B5C', labelColor: '#FFFFFF', position: { y: 1780 } }, activeRange: { startSec: 2.5, endSec: 17.5 } },
    { id: 'title_fixed', type: 'kinetic_text',    zIndex: 34, opacity: 1, enabled: true, props: { text: '앵커 챌린지', fontSize: 32, color: '#A0AEC0', position: 'top-center', startMs: 2500, staggerMs: 40 }, activeRange: { startSec: 2.5, endSec: 17.5 } },
    { id: 'logo',        type: 'image_bg',        zIndex: 35, opacity: 0.9, enabled: true, props: { src: '/templates/news-anchor/logo.png', position: 'top-right', sizePx: 80 } },

    // ── 뉴스 헤드라인 로테이션 (메인 구간 자막) ────────────────
    { id: 'head_1',      type: 'kinetic_text',    zIndex: 40, opacity: 1, enabled: true, props: { text: '안녕하십니까', fontSize: 64, color: '#FFFFFF', strokeColor: '#0B1828', strokeWidth: 6, mode: 'drop', position: 'top-center', startMs: 2800, staggerMs: 55 }, activeRange: { startSec: 2.8, endSec: 5 } },
    { id: 'head_2',      type: 'kinetic_text',    zIndex: 41, opacity: 1, enabled: true, props: { text: '오늘의 날씨', fontSize: 64, color: '#D4AF37', strokeColor: '#0B1828', strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 6000, staggerMs: 55 }, activeRange: { startSec: 6, endSec: 8.5 } },
    { id: 'head_3',      type: 'kinetic_text',    zIndex: 42, opacity: 1, enabled: true, props: { text: '맑은 하늘', fontSize: 64, color: '#FFFFFF', strokeColor: '#FF3B5C', strokeWidth: 6, mode: 'drop', position: 'top-center', startMs: 10000, staggerMs: 55 }, activeRange: { startSec: 10, endSec: 12.5 } },
    { id: 'head_4',      type: 'kinetic_text',    zIndex: 43, opacity: 1, enabled: true, props: { text: '뉴스 마무리', fontSize: 64, color: '#D4AF37', strokeColor: '#0B1828', strokeWidth: 6, mode: 'drop', position: 'top-center', startMs: 14000, staggerMs: 55 }, activeRange: { startSec: 14, endSec: 16.5 } },

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

    // ── 하단 해시태그 스트립 (메인 구간) ─────────────────────────
    { id: 'hashtag_strip', type: 'news_ticker',   zIndex: 72, opacity: 0.9, enabled: true, props: { texts: ['#news', '#breaking', '#live', '#anchor', '#speed', '#motiq'], separator: '   ', speedPxPerSec: 80, fontSize: 28, bgColor: 'rgba(11,24,40,0.7)', color: '#D4AF37', accentColor: '#FF3B5C', position: { y: 1720 } }, activeRange: { startSec: 2.5, endSec: 17 } },

    // FIX-Z22: 속보 배지 반복, 시보 비트, 포인트 flash 로 시네마틱 뉴스 분위기 강화
    { id: 'pulse_breaking', type: 'beat_flash',    zIndex: 73, opacity: 1, enabled: true, props: { color: '#FF3B5C', maxAlpha: 0.18, curve: 'linear' }, reactive: { onBeat: { every: 4, property: 'opacity', amount: 0.18, easing: 'standard', durationMs: 180 } }, activeRange: { startSec: 2.5, endSec: 17 } },
    { id: 'main_mission_prompt', type: 'mission_prompt', zIndex: 52, opacity: 1, enabled: true, props: { text: '대본을 또박또박 읽어주세요', color: '#D4AF37' }, activeRange: { startSec: 2.5, endSec: 4.5 } },
    { id: 'main_counter',  type: 'counter_hud',    zIndex: 57, opacity: 1, enabled: true, props: { target: 4, format: '{n} / 4 문장', fontSize: 44, fontFamily: 'Pretendard, sans-serif' }, activeRange: { startSec: 2.5, endSec: 17 } },
    { id: 'gold_particles', type: 'particle_ambient', zIndex: 48, opacity: 0.6, enabled: true, props: { preset: 'glitter_down', count: 25 } },

    // ── OUTRO (17 ~ 20s) : 속보 종료 + 점수 + 시보 ─────────────
    { id: 'outro_flash',   type: 'beat_flash',    zIndex: 74, opacity: 1, enabled: true, props: { color: '#D4AF37', peakOpacity: 0.55 }, activeRange: { startSec: 17, endSec: 17.5 } },
    { id: 'outro_title',   type: 'kinetic_text',  zIndex: 75, opacity: 1, enabled: true, props: { text: '속보 종료', fontSize: 96, color: '#D4AF37', strokeColor: '#0B1828', strokeWidth: 8, mode: 'pop', position: 'center', startMs: 17100, staggerMs: 60 }, activeRange: { startSec: 17, endSec: 20 } },
    { id: 'outro_score',   type: 'kinetic_text',  zIndex: 76, opacity: 1, enabled: true, props: { text: '★ ★ ★ ★ ★', fontSize: 96, color: '#D4AF37', strokeColor: '#0B1828', strokeWidth: 6, mode: 'drop', position: 'top-center', startMs: 17700, staggerMs: 130 }, activeRange: { startSec: 17.5, endSec: 20 } },
    { id: 'outro_cta',     type: 'kinetic_text',  zIndex: 77, opacity: 1, enabled: true, props: { text: '시청해주셔서 감사합니다', fontSize: 44, color: '#FFFFFF', strokeColor: '#0B1828', strokeWidth: 5, mode: 'drop', position: 'bottom-center', startMs: 18500, staggerMs: 40 }, activeRange: { startSec: 18.5, endSec: 20 } },
    { id: 'outro_ticker',  type: 'news_ticker',   zIndex: 78, opacity: 1, enabled: true, props: { texts: ['다음 소식을 기대해주세요', '뉴스 앵커 챌린지 종료', 'SUBSCRIBE · LIKE'], speedPxPerSec: 180, fontSize: 36, bgColor: '#FF3B5C', color: '#FFFFFF', accentColor: '#D4AF37', position: 'top', labelText: 'END', labelBg: '#D4AF37', labelColor: '#0B1828' }, activeRange: { startSec: 17, endSec: 20 } },
  ],

  hashtags: ['news', 'breaking', 'live', 'anchor', 'speed', 'motiq'],

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
