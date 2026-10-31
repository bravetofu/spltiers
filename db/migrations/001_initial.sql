CREATE TABLE IF NOT EXISTS card_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tier_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES card_sets(id) ON DELETE CASCADE,
  card_id integer NOT NULL,
  card_name text NOT NULL,
  edition text NOT NULL,
  cdn_slug text NOT NULL,
  rarity integer NOT NULL,
  tier text CHECK (tier IN ('S', 'A', 'B', 'C', 'D')),
  role text,
  notes text,
  is_soulbound boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (set_id, card_id)
);

-- All access is through server code. Do not grant browser-facing database roles.
REVOKE ALL ON card_sets, tier_entries FROM PUBLIC;
