-- One row per question and answer. The secret key bypasses RLS; no policies means browsers cannot read this.
-- game_id is one play of a case: room codes get reused, so it is the code plus the start time.

create table if not exists public.interrogations (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  room_code text not null,
  case_id uuid references public.cases (id) on delete set null,
  suspect_id text not null,
  asker text not null,
  question text not null,
  answer text,
  provider text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

alter table public.interrogations enable row level security;

create index if not exists interrogations_game_suspect_created_idx
  on public.interrogations (game_id, suspect_id, created_at);
