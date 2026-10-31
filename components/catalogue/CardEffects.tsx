import {
  statAt,
  STAT_LABELS,
  type CatalogueCard,
  type StatKey,
} from '@/lib/splinterlands/catalogue'
import { AbilityList } from './AbilityIcon'

export function StatEffects({
  card,
  level,
}: {
  card: CatalogueCard
  level: number
}) {
  const keys: StatKey[] = [
    'attack',
    'ranged',
    'magic',
    'speed',
    'armor',
    'health',
  ]
  const effects = keys
    .map((key) => ({ key, value: statAt(card, key, level) ?? 0 }))
    .filter((stat) => stat.value !== 0)
  return (
    <div className="stat-effects">
      {effects.length ? (
        effects.map(({ key, value }) => (
          <span
            key={key}
            className={value > 0 ? 'stat-buff' : 'stat-debuff'}
            title={value > 0 ? 'Buffs allied units' : 'Debuffs enemy units'}
          >
            {value > 0 ? '+' : '−'}
            {Math.abs(value)} {STAT_LABELS[key]}{' '}
            <small>{value > 0 ? 'allies' : 'enemies'}</small>
          </span>
        ))
      ) : (
        <span className="muted">—</span>
      )}
    </div>
  )
}
export function SummonerTactics({
  card,
  full = false,
}: {
  card: CatalogueCard
  full?: boolean
}) {
  const tactics = card.stats.ptrOptions ?? []
  if (!tactics.length) return <span className="muted">—</span>
  return (
    <div className="summoner-tactics">
      {tactics.map((tactic, index) => (
        <div key={tactic.id} className="tactic">
          <div>
            <strong>
              {full
                ? `Option ${index + 1}`
                : `${tactic.max} target${tactic.max === 1 ? '' : 's'}`}
            </strong>
            {full && <p>{tactic.description}</p>}
          </div>
          <AbilityList abilities={tactic.abilities ?? []} labels={full} />
          {!!tactic.stat_buff?.some((value) => value !== 0) && (
            <div className="stat-effects">
              {tactic.stat_buff.map((value, index) =>
                value !== 0 ? (
                  <span
                    key={index}
                    className={value > 0 ? 'stat-buff' : 'stat-debuff'}
                  >
                    {value > 0 ? '+' : '−'}
                    {Math.abs(value)}{' '}
                    {
                      ['Melee', 'Ranged', 'Magic', 'Armor', 'Health', 'Speed'][
                        index
                      ]
                    }
                  </span>
                ) : null
              )}
            </div>
          )}
          {!!tactic.status_effects?.length && (
            <span className="tactic-status">
              {tactic.status_effects
                .map((effect) => effect.replace(/_/g, ' '))
                .join(', ')}
            </span>
          )}
          {!full && (
            <span className="tactic-summary">{tactic.description}</span>
          )}
          {full && (
            <small className="muted">
              Choose up to {tactic.max}{' '}
              {tactic.target_type === 'unit'
                ? 'units'
                : tactic.target_type.replace(/_/g, ' ')}{' '}
              · {tactic.target.replace(/_/g, ' ')}
            </small>
          )}
        </div>
      ))}
    </div>
  )
}
