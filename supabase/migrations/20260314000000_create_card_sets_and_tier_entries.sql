-- Card sets / editions
create table card_sets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Tier entries per card per set
create table tier_entries (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references card_sets(id) on delete cascade,
  card_id int not null,
  card_name text not null,
  edition text not null,
  cdn_slug text not null,
  rarity int not null,
  tier text check (tier in ('S','A','B','C','D')),
  role text,
  notes text,
  is_soulbound boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(set_id, card_id)
);

-- RLS policies
alter table card_sets enable row level security;
alter table tier_entries enable row level security;

-- Public read
create policy "public read card_sets" on card_sets for select using (true);
create policy "public read tier_entries" on tier_entries for select using (true);

-- Authenticated write (backoffice uses service role key — bypasses RLS)
-- Service role key is used server-side in admin routes only
