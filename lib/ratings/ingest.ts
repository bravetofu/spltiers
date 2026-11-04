import type { ParsedBattle } from './battles'
import { ratingDatabase } from './store'
import { summarizeBattle } from './summary'

/** One statement gates every increment on the deduplication INSERT RETURNING.
 * Concurrent requests and retries can never count the same match twice.
 * Accepted matches are immutable: future parsers affect future samples only.
 */
export async function saveCollectedBattle(
  battle: ParsedBattle,
  source: string,
) {
  const sql = ratingDatabase()
  if (
    !battle.eligible ||
    !battle.league ||
    ['shared-replay', 'manual-replay'].includes(source)
  ) {
    await sql`DELETE FROM rating_pending_battles WHERE queue_id=ANY(${battle.queueIds}::text[])`
    return { inserted: false, changedEvidence: false }
  }
  const { evidence, usage } = summarizeBattle(battle)
  const rows = await sql`
    WITH accepted AS (
      INSERT INTO rating_seen(id,day,queue_ids)
      SELECT md5(${battle.id})::uuid,(${battle.playedAt}::timestamptz AT TIME ZONE 'UTC')::date,${battle.queueIds}::text[]
      WHERE (${battle.playedAt}::timestamptz AT TIME ZONE 'UTC')::date
        BETWEEN (now() AT TIME ZONE 'UTC')::date-89 AND (now() AT TIME ZONE 'UTC')::date
      ON CONFLICT DO NOTHING RETURNING day
    ), evidence AS (
      INSERT INTO rating_daily_evidence(day,kind,subject,league,format,battles,wins,draws,expected,standard_battles)
      SELECT a.day,e.kind,e.subject,${battle.league},${battle.format},sum(e.battles),sum(e.wins),sum(e.draws),sum(e.expected),sum(e.standard)
      FROM accepted a CROSS JOIN jsonb_to_recordset(${JSON.stringify(evidence)}::jsonb)
        AS e(kind text,subject text,battles integer,wins integer,draws integer,expected double precision,standard integer)
      GROUP BY a.day,e.kind,e.subject ORDER BY a.day,e.kind,e.subject
      ON CONFLICT(day,kind,subject,league,format) DO UPDATE SET
        battles=rating_daily_evidence.battles+excluded.battles,wins=rating_daily_evidence.wins+excluded.wins,
        draws=rating_daily_evidence.draws+excluded.draws,expected=rating_daily_evidence.expected+excluded.expected,
        standard_battles=rating_daily_evidence.standard_battles+excluded.standard_battles
    ), usage AS (
      INSERT INTO rating_daily_usage(day,card_id,league,format,matches)
      SELECT a.day,u.card_id,${battle.league},${battle.format},1
      FROM accepted a CROSS JOIN jsonb_to_recordset(${JSON.stringify(usage)}::jsonb) AS u(card_id integer) ORDER BY u.card_id
      ON CONFLICT(day,card_id,league,format) DO UPDATE SET matches=rating_daily_usage.matches+1
    ), lifetime AS (
      INSERT INTO rating_lifetime_usage(card_id,league,format,uses,wins,losses,draws)
      SELECT u.card_id,${battle.league},${battle.format},u.uses,u.wins,u.losses,u.draws
      FROM accepted a CROSS JOIN jsonb_to_recordset(${JSON.stringify(usage)}::jsonb)
        AS u(card_id integer,uses integer,wins integer,losses integer,draws integer) ORDER BY u.card_id
      ON CONFLICT(card_id,league,format) DO UPDATE SET uses=rating_lifetime_usage.uses+excluded.uses,
        wins=rating_lifetime_usage.wins+excluded.wins,losses=rating_lifetime_usage.losses+excluded.losses,
        draws=rating_lifetime_usage.draws+excluded.draws
    ), scope AS (
      INSERT INTO rating_daily_totals(day,league,format,battles)
      SELECT day,${battle.league},${battle.format},1 FROM accepted
      ON CONFLICT(day,league,format) DO UPDATE SET battles=rating_daily_totals.battles+1
    ), totals AS (
      UPDATE rating_totals SET battles=battles+1,latest=greatest(latest,${battle.playedAt}::timestamptz)
      WHERE singleton AND EXISTS(SELECT 1 FROM accepted)
    ), accounts AS (
      INSERT INTO rating_collection_accounts(player,discovered_from)
      SELECT p,'opponent' FROM accepted CROSS JOIN unnest(${battle.players}::text[]) p ORDER BY p
      ON CONFLICT DO NOTHING RETURNING player
    ), targets AS (
      INSERT INTO rating_collection_targets(player,format,league,last_seen)
      SELECT p,${battle.format},${battle.league},${battle.playedAt}::timestamptz
      FROM accepted CROSS JOIN unnest(${battle.players}::text[]) p
      LEFT JOIN accounts a ON a.player=p ORDER BY p
      ON CONFLICT(player,format) DO UPDATE SET league=excluded.league,last_seen=excluded.last_seen
      WHERE rating_collection_targets.last_seen IS NULL OR rating_collection_targets.last_seen<excluded.last_seen
    ), pending AS (
      DELETE FROM rating_pending_battles WHERE queue_id=ANY(${battle.queueIds}::text[])
    ) SELECT EXISTS(SELECT 1 FROM accepted) AS inserted
  `
  return {
    inserted: rows[0].inserted as boolean,
    changedEvidence: rows[0].inserted as boolean,
  }
}

export async function maintainRatingHistory() {
  const sql = ratingDatabase()
  // Run pruning once per UTC day. The same cutoff gates ingestion and evidence reads.
  await sql`WITH due AS (
    UPDATE rating_totals SET maintained_on=(now() AT TIME ZONE 'UTC')::date
    WHERE singleton AND maintained_on IS DISTINCT FROM (now() AT TIME ZONE 'UTC')::date RETURNING singleton
  ), evidence AS (
    DELETE FROM rating_daily_evidence WHERE day<(now() AT TIME ZONE 'UTC')::date-89 AND EXISTS(SELECT 1 FROM due)
  ), usage AS (
    DELETE FROM rating_daily_usage WHERE day<(now() AT TIME ZONE 'UTC')::date-89 AND EXISTS(SELECT 1 FROM due)
  ), totals AS (
    DELETE FROM rating_daily_totals WHERE day<(now() AT TIME ZONE 'UTC')::date-89 AND EXISTS(SELECT 1 FROM due)
  ), seen AS (
    DELETE FROM rating_seen WHERE day<(now() AT TIME ZONE 'UTC')::date-89 AND EXISTS(SELECT 1 FROM due)
  ), pending AS (
    DELETE FROM rating_pending_battles WHERE (discovered_at<now()-interval '2 days' OR attempts>=12 OR source IN ('shared-replay','manual-replay')) AND EXISTS(SELECT 1 FROM due)
  ), accounts AS (
    DELETE FROM rating_collection_accounts
    WHERE created_at<now()-interval '90 days' AND (last_checked IS NULL OR last_checked<now()-interval '90 days')
      AND discovered_from NOT IN ('curator seed','site account') AND EXISTS(SELECT 1 FROM due)
  ) DELETE FROM rating_job_runs WHERE started_at<now()-interval '30 days' AND EXISTS(SELECT 1 FROM due)`
}
