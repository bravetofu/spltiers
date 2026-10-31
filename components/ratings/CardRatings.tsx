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

export default function CardRatings({
  card,
  ratings,
  version,
  scoredAt,
}: {
  card: CatalogueCard
  ratings: CardRating[]
  version?: string
  scoredAt?: string
}) {
  const [league, setLeague] = useState<League>('diamond')
  const [format, setFormat] = useState<BattleFormat>(
    card.modern ? 'modern' : 'wild',
  )
  const rating = ratings.find((r) => r.league === league && r.format === format)
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
                <span>Curated score</span>
                <strong>{rating.curated.toFixed(1)} / 10</strong>
              </div>
              <div>
                <span>Battle adjustment</span>
                <strong>
                  {rating.score >= rating.curated ? '+' : ''}
                  {(rating.score - rating.curated).toFixed(1)} pts
                </strong>
              </div>
              <div>
                <span>Qualifying matches</span>
                <strong>
                  {rating.evidence.battles.toLocaleString('en-US')}
                </strong>
              </div>
              <div>
                <span>Distinct players</span>
                <strong>{rating.evidence.players}</strong>
              </div>
            </div>
          </div>
          <p className="rating-note">
            {rating.battleWeight
              ? `Recent results adjust the curated baseline, with ${Math.round(rating.battleWeight * 100)}% of the estimated performance adjustment applied after confidence limits, time decay and account concentration limits. `
              : 'The curated model determines this rating until enough independent battle evidence is available. '}
            Battle association is not proof that a card caused a win.
          </p>
          {rating.evidence.battles > 0 && (
            <p className="rating-note">
              Observed win rate: {(rating.evidence.rawWinRate * 100).toFixed(1)}
              % · Player-adjusted:{' '}
              {(rating.evidence.adjustedWinRate * 100).toFixed(1)}% ·{' '}
              {rating.evidence.days} distinct days. Shared cards on both teams
              and underlevelled card appearances are excluded from strength
              evidence.
            </p>
          )}
          <details className="rating-breakdown">
            <summary>See the scoring breakdown</summary>
            <p>
              Stats, abilities and synergies contribute model points. A fixed
              calibration maps their subtotal to 0–10; curator adjustments then
              change the final curated rating directly.
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
