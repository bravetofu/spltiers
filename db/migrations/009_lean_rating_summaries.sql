-- Convert existing evidence before discarding detailed replays. All statements run atomically.
SET LOCAL lock_timeout = '10s';
LOCK TABLE rating_workspace IN ACCESS EXCLUSIVE MODE;
LOCK TABLE rating_battles, rating_observations, rating_card_usage IN ACCESS EXCLUSIVE MODE;
CREATE TABLE rating_daily_evidence (
  day date NOT NULL, kind text NOT NULL CHECK (kind IN ('card','ability')), subject text NOT NULL,
  league text NOT NULL, format text NOT NULL, battles integer NOT NULL, wins integer NOT NULL,
  draws integer NOT NULL, expected double precision NOT NULL, standard_battles integer NOT NULL,
  PRIMARY KEY(day,kind,subject,league,format)
);
CREATE TABLE rating_daily_usage (
  day date NOT NULL, card_id integer NOT NULL, league text NOT NULL, format text NOT NULL,
  matches integer NOT NULL, PRIMARY KEY(day,card_id,league,format)
);
CREATE TABLE rating_daily_totals (
  day date NOT NULL, league text NOT NULL, format text NOT NULL, battles integer NOT NULL,
  PRIMARY KEY(day,league,format)
);
CREATE TABLE rating_lifetime_usage (
  card_id integer NOT NULL, league text NOT NULL, format text NOT NULL,
  uses bigint NOT NULL, wins bigint NOT NULL, losses bigint NOT NULL, draws bigint NOT NULL,
  PRIMARY KEY(card_id,league,format)
);
CREATE TABLE rating_totals (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), battles bigint NOT NULL DEFAULT 0,
  latest timestamptz, maintained_on date
);
CREATE TABLE rating_seen (
  id uuid PRIMARY KEY, day date NOT NULL, queue_ids text[] NOT NULL
);
CREATE INDEX rating_seen_queues ON rating_seen USING gin(queue_ids);
INSERT INTO rating_daily_evidence
SELECT (b.played_at AT TIME ZONE 'UTC')::date,o.kind,o.subject,b.league,b.format,count(*),
 count(*) FILTER(WHERE o.outcome=1), count(*) FILTER(WHERE o.outcome=0.5),sum(o.expected),
 count(*) FILTER(WHERE cardinality(b.rulesets)=0 OR b.rulesets=ARRAY['Standard'])
FROM rating_observations o JOIN rating_battles b ON b.id=o.battle_id
WHERE b.eligible AND b.league IS NOT NULL AND NOT o.mirrored
 AND (b.played_at AT TIME ZONE 'UTC')::date >= (now() AT TIME ZONE 'UTC')::date-89
GROUP BY 1,2,3,4,5;
INSERT INTO rating_daily_usage
SELECT (b.played_at AT TIME ZONE 'UTC')::date,u.card_id,b.league,b.format,count(DISTINCT b.id)
FROM rating_card_usage u JOIN rating_battles b ON b.id=u.battle_id
WHERE b.eligible AND b.league IS NOT NULL
 AND (b.played_at AT TIME ZONE 'UTC')::date >= (now() AT TIME ZONE 'UTC')::date-89
GROUP BY 1,2,3,4;
INSERT INTO rating_daily_totals
SELECT (played_at AT TIME ZONE 'UTC')::date,league,format,count(*) FROM rating_battles
WHERE eligible AND league IS NOT NULL AND (played_at AT TIME ZONE 'UTC')::date >= (now() AT TIME ZONE 'UTC')::date-89
GROUP BY 1,2,3;
INSERT INTO rating_lifetime_usage
SELECT u.card_id,b.league,b.format,count(*),count(*) FILTER(WHERE u.outcome=1),
 count(*) FILTER(WHERE u.outcome=0),count(*) FILTER(WHERE u.outcome=0.5)
FROM rating_card_usage u JOIN rating_battles b ON b.id=u.battle_id
WHERE b.eligible AND b.league IS NOT NULL GROUP BY 1,2,3;
INSERT INTO rating_totals(singleton,battles,latest)
SELECT true,count(*),max(played_at) FROM rating_battles WHERE eligible AND league IS NOT NULL;
INSERT INTO rating_seen SELECT md5(id)::uuid,(played_at AT TIME ZONE 'UTC')::date,queue_ids
FROM rating_battles WHERE eligible AND league IS NOT NULL
AND (played_at AT TIME ZONE 'UTC')::date >= (now() AT TIME ZONE 'UTC')::date-89;
DROP TABLE rating_observations;
DROP TABLE rating_card_usage;
DROP TABLE rating_battles;
DELETE FROM rating_snapshots WHERE id IS DISTINCT FROM (SELECT active_snapshot_id FROM rating_workspace WHERE singleton);
REVOKE ALL ON rating_daily_evidence,rating_daily_usage,rating_daily_totals,rating_lifetime_usage,rating_totals,rating_seen FROM PUBLIC;
-- Rebuild the score table once so discarded snapshots release their allocated space.
CREATE TABLE rating_scores_compact (LIKE rating_scores INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING STORAGE);
ALTER TABLE rating_scores_compact ADD PRIMARY KEY(snapshot_id,kind,subject,league,format);
ALTER TABLE rating_scores_compact ADD FOREIGN KEY(snapshot_id) REFERENCES rating_snapshots(id) ON DELETE CASCADE;
INSERT INTO rating_scores_compact SELECT * FROM rating_scores;
DROP TABLE rating_scores;
ALTER TABLE rating_scores_compact RENAME TO rating_scores;
REVOKE ALL ON rating_scores FROM PUBLIC;
