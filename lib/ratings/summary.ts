import type { ParsedBattle } from './battles'

/** Keep only sufficient statistics. Mirror appearances count once for match share. */
export function summarizeBattle(battle: ParsedBattle) {
  const evidence = battle.observations
    .filter((o) => !o.mirrored)
    .map((o) => ({
      kind: o.kind,
      subject: o.subject,
      battles: 1,
      wins: o.outcome === 1 ? 1 : 0,
      draws: o.outcome === 0.5 ? 1 : 0,
      expected: o.expected,
      standard:
        !battle.rulesets.length ||
        (battle.rulesets.length === 1 && battle.rulesets[0] === 'Standard')
          ? 1
          : 0,
    }))
  const usage = new Map<
    number,
    {
      card_id: number
      uses: number
      wins: number
      losses: number
      draws: number
    }
  >()
  for (const u of battle.cardUsage) {
    const row = usage.get(u.cardId) ?? {
      card_id: u.cardId,
      uses: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    }
    row.uses++
    if (u.outcome === 1) row.wins++
    else if (u.outcome === 0) row.losses++
    else row.draws++
    usage.set(u.cardId, row)
  }
  return { evidence, usage: Array.from(usage.values()) }
}
