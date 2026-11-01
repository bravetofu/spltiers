CREATE TABLE rating_card_usage (
  battle_id text NOT NULL REFERENCES rating_battles(id) ON DELETE CASCADE,
  side smallint NOT NULL CHECK (side IN (1, 2)),
  card_id integer NOT NULL,
  level smallint NOT NULL,
  outcome real NOT NULL CHECK (outcome IN (0, 0.5, 1)),
  PRIMARY KEY (battle_id, side, card_id)
);
CREATE INDEX rating_card_usage_card ON rating_card_usage (card_id, battle_id);
REVOKE ALL ON rating_card_usage FROM PUBLIC;
