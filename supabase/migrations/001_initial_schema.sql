-- ============================================================
-- 001_initial_schema.sql
-- MVP 초기 스키마: templates, user_sessions, user_profiles
-- ============================================================

-- 확장 활성화
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. templates
-- ============================================================
create table if not exists public.templates (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  genre        text not null check (genre in ('kpop','hiphop','fitness','challenge','promotion')),
  difficulty   smallint not null check (difficulty in (1, 2, 3)),
  duration_sec integer not null,
  bpm          integer not null,
  bgm_url      text not null,
  thumbnail_url text not null default '',
  missions     jsonb not null default '[]'::jsonb,
  subtitle_timeline jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

-- 장르/난이도 필터링을 위한 인덱스
create index on public.templates (genre);
create index on public.templates (difficulty);

-- RLS
alter table public.templates enable row level security;
create policy "템플릿 공개 읽기" on public.templates
  for select using (true);

-- ============================================================
-- 2. user_sessions
-- ============================================================
create table if not exists public.user_sessions (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  template_id      uuid not null references public.templates(id),
  recorded_at      timestamptz not null default now(),
  avg_score        real not null default 0,
  success_rate     real not null default 0 check (success_rate between 0 and 1),
  tag_timeline     jsonb not null default '[]'::jsonb,
  video_url        text,
  edited_video_url text
);

create index on public.user_sessions (user_id, recorded_at desc);
create index on public.user_sessions (template_id);

alter table public.user_sessions enable row level security;
create policy "본인 세션만 접근" on public.user_sessions
  for all using (auth.uid() = user_id);

-- ============================================================
-- 3. user_profiles
-- ============================================================
create table if not exists public.user_profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  preferred_genres text[]  not null default '{}',
  success_rates    jsonb   not null default '{}'::jsonb,
  total_sessions   integer not null default 0,
  weak_joints      text[]  not null default '{}',
  updated_at       timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
create policy "본인 프로필만 접근" on public.user_profiles
  for all using (auth.uid() = user_id);

-- ============================================================
-- 4. 샘플 템플릿 데이터
-- ============================================================
insert into public.templates (name, genre, difficulty, duration_sec, bpm, bgm_url, thumbnail_url, missions, subtitle_timeline)
values (
  'K-POP 챌린지 베이직',
  'kpop',
  1,
  15,
  128,
  '',
  '',
  '[
    {
      "seq": 1,
      "start_ms": 0,
      "end_ms": 3000,
      "type": "pose",
      "target_joints": {
        "left_wrist":  [0.2, 0.1],
        "right_wrist": [0.8, 0.1]
      },
      "threshold": 0.70,
      "guide_text": "양손을 머리 위로!"
    },
    {
      "seq": 2,
      "start_ms": 3000,
      "end_ms": 6000,
      "type": "pose",
      "target_joints": {
        "left_wrist":  [0.1, 0.5],
        "right_wrist": [0.9, 0.5]
      },
      "threshold": 0.70,
      "guide_text": "양손을 옆으로 쭉!"
    },
    {
      "seq": 3,
      "start_ms": 6000,
      "end_ms": 10000,
      "type": "pose",
      "target_joints": {
        "left_wrist":  [0.4, 0.7],
        "right_wrist": [0.6, 0.7],
        "left_elbow":  [0.3, 0.55],
        "right_elbow": [0.7, 0.55]
      },
      "threshold": 0.65,
      "guide_text": "하트 만들어!"
    },
    {
      "seq": 4,
      "start_ms": 10000,
      "end_ms": 15000,
      "type": "pose",
      "target_joints": {
        "left_wrist":  [0.5, 0.0],
        "right_wrist": [0.5, 0.0]
      },
      "threshold": 0.75,
      "guide_text": "최후의 포즈!"
    }
  ]'::jsonb,
  '[
    {"start_ms": 0,    "end_ms": 3000,  "text": "손을 위로 올려요!"},
    {"start_ms": 3000, "end_ms": 6000,  "text": "좌우로 펼쳐요!"},
    {"start_ms": 6000, "end_ms": 10000, "text": "하트 만들어요!"},
    {"start_ms": 10000,"end_ms": 15000, "text": "마지막 포즈!"}
  ]'::jsonb
);
