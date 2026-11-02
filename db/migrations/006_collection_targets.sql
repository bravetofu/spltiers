CREATE TABLE rating_collection_targets (
  player text NOT NULL REFERENCES rating_collection_accounts(player) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('modern', 'wild')),
  league text CHECK (league IN ('bronze', 'silver', 'gold', 'diamond')),
  last_seen timestamptz,
  last_checked timestamptz,
  PRIMARY KEY (player, format)
);
CREATE INDEX rating_collection_targets_scope ON rating_collection_targets (format, league, last_checked);
REVOKE ALL ON rating_collection_targets FROM PUBLIC;
INSERT INTO rating_collection_targets (player, format, league, last_seen)
SELECT DISTINCT ON (player, format) player, format, league, played_at
FROM (
  SELECT raw->>'player_1' AS player, format, league, played_at FROM rating_battles WHERE eligible AND league IS NOT NULL
  UNION ALL
  SELECT raw->>'player_2', format, league, played_at FROM rating_battles WHERE eligible AND league IS NOT NULL
) samples
WHERE player IN (SELECT player FROM rating_collection_accounts)
ORDER BY player, format, played_at DESC;
