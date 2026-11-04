'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { CatalogueCard } from '@/lib/splinterlands/catalogue'
import {
  LEAGUES,
  LEAGUE_NAMES,
  type BattleFormat,
  type CardRating,
  type League,
} from '@/lib/ratings/types'
import RatingBadge, { CONFIDENCE_LABELS } from './RatingBadge'
import {
  EMPTY_BATTLE_STATS,
  formatWinRate,
  type CardBattleStats,
} from '@/lib/ratings/battle-stats'

export default function CardRatings({
  card,
  ratings,
  version,
  scoredAt,
  battleStats,
}: {
  card: CatalogueCard
  ratings: CardRating[]
  version?: string
  scoredAt?: string
  battleStats?: CardBattleStats[] | null
}) {
  const [league, setLeague] = useState<League>('diamond')
  const [format, setFormat] = useState<BattleFormat>(
    card.modern ? 'modern' : 'wild',
  )
  const rating = ratings.find((r) => r.league === league && r.format === format)
  const ratingUsage = rating?.evidence.usage
  const signed = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(3)}`
  const usage = battleStats
    ? (battleStats.find((s) => s.league === league && s.format === format) ??
      EMPTY_BATTLE_STATS)
    : null
  if (card.kind === 'land')
    return (
      <section className="card-section rating-panel">
        <h2>Combat rating</h2>
        <p className="muted">
          Not applicable. Land productivity is separate from combat strength.
        </p>
      </section>
    )
  return (
    <section
      className="card-section rating-panel"
      aria-label="Card strength rating"
    >
      <div className="card-section-heading">
        <div>
          <p className="catalogue-eyebrow">Card strength · beta</p>
          <h2>How strong is {card.name}?</h2>
        </div>
        <Link href="/ratings/methodology" className="rating-method-link">
          How ratings work ↗
        </Link>
      </div>
      <div className="rating-controls">
        <div
          className="edition-options"
          role="group"
          aria-label="Rating format"
        >
          {(['modern', 'wild'] as const).map((f) => (
            <button
              key={f}
              disabled={f === 'modern' && !card.modern}
              aria-pressed={format === f}
              onClick={() => setFormat(f)}
            >
              {f === 'modern' ? 'Modern' : 'Wild'}
            </button>
          ))}
        </div>
        <div className="edition-options" role="group" aria-label="Rating level">
          {LEAGUES.map((l) => (
            <button
              key={l}
              aria-pressed={league === l}
              onClick={() => setLeague(l)}
            >
              {LEAGUE_NAMES[l]}
            </button>
          ))}
        </div>
      </div>
      <section
        className="card-battle-stats"
        aria-label="Collected battle results"
      >
        <h3>Collected battle results</h3>
        {usage ? (
          <>
            <dl className="battle-metrics">
              <div>
                <dt>Uses</dt>
                <dd>{usage.uses.toLocaleString('en-US')}</dd>
              </div>
              <div>
                <dt>Wins</dt>
                <dd>{usage.wins.toLocaleString('en-US')}</dd>
              </div>
              <div>
                <dt>Losses</dt>
                <dd>{usage.losses.toLocaleString('en-US')}</dd>
              </div>
              <div>
                <dt>Draws</dt>
                <dd>{usage.draws.toLocaleString('en-US')}</dd>
              </div>
              <div>
                <dt>Win rate</dt>
                <dd>{formatWinRate(usage)}</dd>
              </div>
            </dl>
            {!usage.uses && (
              <p className="rating-note">
                No collected battles for this card in this format and league
                yet.
              </p>
            )}
          </>
        ) : (
          <p className="rating-note">
            Battle results are temporarily unavailable.
          </p>
        )}
        <p className="rating-note">
          Lifetime collected ranked sample for{' '}
          {format === 'modern' ? 'Modern' : 'Wild'}, {LEAGUE_NAMES[league]}{' '}
          caps. One use per team, including underlevelled cards; mirror matches
          count once for each team. Win rate = wins ÷ uses; draws are not wins.
          Shared research replays and incomplete matches are excluded. Totals
          update after collection and may differ from the filtered evidence used
          for ratings.
        </p>
      </section>
      {rating ? (
        <>
          <div className="rating-summary">
            <div className="rating-score">
              <RatingBadge
                score={rating.score}
                confidence={rating.confidence}
                battles={rating.evidence.battles}
              />
              <strong>{CONFIDENCE_LABELS[rating.confidence]}</strong>
              <span>
                Level {rating.level} · {format === 'modern' ? 'Modern' : 'Wild'}
              </span>
            </div>
            <div className="rating-metrics">
              <div>
                <span>Practical baseline</span>
                <strong>{rating.curated.toFixed(1)} / 10</strong>
              </div>
              <div>
                <span>Win-rate effect</span>
                <strong>
                  {signed(
                    rating.winRateAdjustment ?? rating.score - rating.curated,
                  )}{' '}
                  pts
                </strong>
              </div>
              <div>
                <span>Use-rate effect</span>
                <strong>{signed(rating.usageAdjustment ?? 0)} pts</strong>
              </div>
              <div>
                <span>Win-result samples</span>
                <strong>
                  {rating.evidence.battles.toLocaleString('en-US')}
                </strong>
              </div>
              <div>
                <span>Sample days</span>
                <strong>{rating.evidence.days}</strong>
              </div>
            </div>
          </div>
          <p className="rating-note">
            {rating.battleWeight || rating.usageWeight
              ? 'Recent win results and selection frequency adjust the curated baseline separately, after sample-size and time weighting. '
              : 'The practical model determines this rating until enough battle evidence is available. '}
            Battle association is not proof that a card caused a win.
          </p>
          {rating.practical && (
            <p className="rating-note">
              Usually evaluated as{' '}
              <strong>{rating.practical.role.toLowerCase()}</strong>. The
              baseline considers usable attacks, survival and support across
              mana budgets and selected matchups. Support has diminishing
              returns; armor waste, incoming pressure and partner setup limit
              theoretical value. These are explicit model
              assumptions; the best position still depends on your actual team.
            </p>
          )}
          {rating.evidence.battles > 0 && (
            <p className="rating-note">
              Rating evidence outcome rate (draws count as half):{' '}
              {(rating.evidence.rawWinRate * 100).toFixed(1)}% ·
              Player-adjusted:{' '}
              {(rating.evidence.adjustedWinRate * 100).toFixed(1)}% ·{' '}
              {rating.evidence.days} distinct days ·{' '}
              {rating.evidence.effective.toFixed(1)} effective samples. Shared
              cards on both teams and underlevelled card appearances are
              excluded from strength evidence.
            </p>
          )}
          <p className="rating-note">
            {ratingUsage
              ? `Use rate: ${(ratingUsage.rate * 100).toFixed(1)}% — used in ${ratingUsage.battles.toLocaleString('en-US')} of ${ratingUsage.totalBattles.toLocaleString('en-US')} recorded matches in this format and cap over the last 90 days, across ${ratingUsage.days} days. After daily time decay: ${(ratingUsage.weightedRate * 100).toFixed(1)}% (${ratingUsage.effective.toFixed(1)} effective card matches). `
              : 'No recent qualifying usage sample for this card and scope. '}
            A mirror counts as one match for use rate. Selection frequency
            includes underlevelled appearances; win-rate strength evidence
            requires the card at the selected cap. These rating inputs are
            captured at the last daily refresh.
          </p>
          <details className="rating-breakdown">
            <summary>See the scoring breakdown</summary>
            <div className="catalogue-table-wrap">
              <table className="price-table">
                <caption>Final rating calculation (0–10 rating points)</caption>
                <thead>
                  <tr>
                    <th>Contribution</th>
                    <th>Points</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Practical baseline</th>
                    <td>{rating.curated.toFixed(3)}</td>
                    <td>
                      Role, usable attacks, survival, support, affordable
                      partners and curator adjustments.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Win-rate adjustment</th>
                    <td>
                      {signed(
                        rating.winRateAdjustment ??
                          rating.score - rating.curated,
                      )}
                    </td>
                    <td>
                      {rating.battleWeight
                        ? `${(rating.evidence.adjustedWinRate * 100).toFixed(1)}% player-adjusted outcome rate; ${(rating.battleWeight * 100).toFixed(1)}% of the estimated score change applied.`
                        : 'Needs 20 non-mirrored cap-level appearances, two days and 15 effective samples. No win-rate adjustment yet.'}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Use-rate utility bonus</th>
                    <td>{signed(rating.usageAdjustment ?? 0)}</td>
                    <td>
                      {rating.usageWeight
                        ? `${((ratingUsage?.weightedRate ?? 0) * 100).toFixed(1)}% weighted match share; ${(rating.usageWeight * 100).toFixed(1)}% confidence weight. At most +1 point before confidence limits; reaches that cap at 20% match share.`
                        : 'Needs use in 20 matches, two days, 15 effective card matches and 50 effective matches in this scope. Unseen or rare cards receive no penalty.'}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">0–10 bounds</th>
                    <td>{signed(rating.boundsAdjustment ?? 0)}</td>
                    <td>Keep the final score between zero and ten.</td>
                  </tr>
                  <tr>
                    <th scope="row">Final rating</th>
                    <td>
                      <strong>{rating.score.toFixed(3)}</strong>
                    </td>
                    <td>
                      Practical baseline + win-rate adjustment + use-rate bonus
                      + bounds.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              The contributions below are model points, not direct additions to
              the 0–10 score. A fixed curve converts their total to the
              practical baseline; curator adjustments then apply in rating
              points. Effects already included in attack output or durability
              have no duplicate flat bonus.
            </p>
            <div className="catalogue-table-wrap">
              <table className="price-table">
                <thead>
                  <tr>
                    <th>Contribution</th>
                    <th>Points</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rating.parts.map((part, i) => (
                    <tr key={i}>
                      <th scope="row">{part.label}</th>
                      <td
                        className={part.value < 0 ? 'stat-debuff' : 'stat-buff'}
                      >
                        {part.value > 0 ? '+' : ''}
                        {part.value.toFixed(2)}
                      </td>
                      <td>{part.note ?? 'Model baseline'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {rating.practical && (
            <details className="rating-breakdown">
              <summary>Where this card gains or loses value</summary>
              <p>
                Changes below compare the card’s own contribution with mixed
                opposition. They are model points before shared partner bonuses,
                calibration and battle evidence—not separate 0–10 ratings.
                Scenario weights are design assumptions, not observed
                frequencies.
              </p>
              <div className="catalogue-table-wrap">
                <table className="price-table">
                  <thead>
                    <tr>
                      <th>Situation</th>
                      <th>Model change</th>
                      <th>Evaluated position</th>
                      <th>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rating.practical.scenarios.map((s) => (
                      <tr key={s.name}>
                        <th scope="row">{s.name}</th>
                        <td>
                          {signed(
                            s.value -
                              (rating.practical?.scenarios.find(
                                (x) => x.name === 'Mixed opposition',
                              )?.value ?? 0),
                          )}
                        </td>
                        <td>{s.role}</td>
                        <td>{Math.round(s.weight * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <p className="rating-note">
            {version}
            {scoredAt ? ` · Updated ${scoredAt.slice(0, 10)}` : ''} ·{' '}
            <Link href="/abilities">Explore ability strength</Link>
          </p>
        </>
      ) : (
        <p className="rating-note">
          Ratings are temporarily unavailable for this scope. Stats and artwork
          remain available.
        </p>
      )}
    </section>
  )
}
