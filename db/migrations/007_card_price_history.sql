CREATE TABLE card_price_days (
  day date PRIMARY KEY,
  initialized_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE card_price_targets (
  day date NOT NULL REFERENCES card_price_days(day),
  card_id integer NOT NULL,
  edition integer NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  last_error text,
  PRIMARY KEY (day, card_id, edition)
);
CREATE TABLE card_price_history (
  day date NOT NULL,
  card_id integer NOT NULL,
  edition integer NOT NULL,
  foil smallint NOT NULL CHECK (foil BETWEEN 0 AND 4),
  per_bcx numeric CHECK (per_bcx > 0),
  single_bcx numeric CHECK (single_bcx > 0),
  listings integer NOT NULL CHECK (listings >= 0),
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (day, card_id, edition, foil),
  FOREIGN KEY (day, card_id, edition) REFERENCES card_price_targets(day, card_id, edition),
  CHECK ((observed_at AT TIME ZONE 'UTC')::date = day),
  CHECK ((listings = 0 AND per_bcx IS NULL AND single_bcx IS NULL) OR (listings > 0 AND per_bcx IS NOT NULL))
);
CREATE INDEX card_price_history_card ON card_price_history (card_id, edition, day DESC);
CREATE TABLE card_price_lease (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  owner uuid,
  expires_at timestamptz
);
INSERT INTO card_price_lease (singleton) VALUES (true);
REVOKE ALL ON card_price_days, card_price_targets, card_price_history, card_price_lease FROM PUBLIC;
