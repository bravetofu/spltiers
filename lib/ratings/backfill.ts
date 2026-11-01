import type { CatalogueCard } from '../splinterlands/catalogue'
import { parseBattle } from './battles'
import { saveCollectedBattle } from './collector'
import { ratingDatabase } from './store'
import { PARSER_VERSION } from './types'

/** Resume safely across deploys; each replay and its derived rows update atomically. */
export async function backfillBattleUsage(
  cards: CatalogueCard[],
  limit = Infinity,
) {
  const sql = ratingDatabase()
  let processed = 0
  for (;;) {
    if (processed >= limit) return processed
    const rows = await sql`
      SELECT id, raw, source, format FROM rating_battles
      WHERE parser_version < ${PARSER_VERSION} ORDER BY id LIMIT ${Math.min(100, limit - processed)}
    `
    if (!rows.length) return processed
    for (const row of rows) {
      const battle = parseBattle(
        row.raw,
        cards,
        Date.now(),
        row.source === 'history' ? row.format : undefined,
      )
      if (!battle || battle.id !== row.id)
        throw new Error(`Cannot reprocess stored battle ${row.id}`)
      await saveCollectedBattle(battle, row.source)
      processed++
    }
  }
}
