CREATE TABLE rating_profiles (
  id uuid PRIMARY KEY,
  label text NOT NULL,
  notes text NOT NULL,
  config jsonb NOT NULL,
  author text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rating_snapshots (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES rating_profiles(id),
  engine_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  battle_count integer NOT NULL DEFAULT 0
);
CREATE TABLE rating_workspace (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  draft jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  active_profile_id uuid REFERENCES rating_profiles(id),
  active_snapshot_id uuid REFERENCES rating_snapshots(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rating_scores (
  snapshot_id uuid NOT NULL REFERENCES rating_snapshots(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('card', 'ability')),
  subject text NOT NULL,
  league text NOT NULL CHECK (league IN ('bronze', 'silver', 'gold', 'diamond')),
  format text NOT NULL CHECK (format IN ('modern', 'wild')),
  data jsonb NOT NULL,
  PRIMARY KEY (snapshot_id, kind, subject, league, format)
);
CREATE TABLE rating_battles (
  id text PRIMARY KEY,
  queue_ids text[] NOT NULL,
  played_at timestamptz NOT NULL,
  format text NOT NULL CHECK (format IN ('modern', 'wild')),
  match_type text NOT NULL,
  league text,
  league_method text NOT NULL,
  mana integer,
  rulesets text[] NOT NULL,
  winner text,
  eligible boolean NOT NULL,
  exclusion text,
  parser_version integer NOT NULL,
  source text NOT NULL,
  raw jsonb NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rating_battles_time_format ON rating_battles (played_at DESC, format);
CREATE TABLE rating_observations (
  battle_id text NOT NULL REFERENCES rating_battles(id) ON DELETE CASCADE,
  side smallint NOT NULL CHECK (side IN (1, 2)),
  kind text NOT NULL CHECK (kind IN ('card', 'ability')),
  subject text NOT NULL,
  level smallint,
  player text NOT NULL,
  outcome real NOT NULL CHECK (outcome >= 0 AND outcome <= 1),
  expected real NOT NULL CHECK (expected >= 0 AND expected <= 1),
  mirrored boolean NOT NULL DEFAULT false,
  PRIMARY KEY (battle_id, side, kind, subject)
);
CREATE INDEX rating_observations_subject ON rating_observations (kind, subject, battle_id);
CREATE TABLE rating_collection_accounts (
  player text PRIMARY KEY,
  discovered_from text NOT NULL,
  last_checked timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rating_pending_battles (
  queue_id text PRIMARY KEY,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  next_check timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0
);
CREATE TABLE rating_job_runs (
  id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  message text NOT NULL DEFAULT '',
  collected integer NOT NULL DEFAULT 0,
  requests integer NOT NULL DEFAULT 0,
  players integer NOT NULL DEFAULT 0
);
CREATE TABLE rating_job_lease (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  owner uuid,
  expires_at timestamptz
);
INSERT INTO rating_job_lease (singleton) VALUES (true);
REVOKE ALL ON rating_profiles, rating_snapshots, rating_workspace, rating_scores, rating_battles, rating_observations, rating_collection_accounts, rating_pending_battles, rating_job_runs, rating_job_lease FROM PUBLIC;
