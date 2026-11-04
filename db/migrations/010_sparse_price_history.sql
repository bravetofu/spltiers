-- Completed targets record a successful observation, including all-empty markets.
-- Missing foil rows on those targets mean zero listings, not failed collection.
DELETE FROM card_price_history WHERE listings=0;
CREATE INDEX card_price_targets_card ON card_price_targets(card_id,edition,day DESC) WHERE completed_at IS NOT NULL;
