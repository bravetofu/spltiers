import { LEAGUES, LEAGUE_NAMES } from '@/lib/ratings/types'
import type { TierKey, TierRatingSummary } from '@/lib/ratings/tier-reference'
export default function TierRatingDetails({
  name,
  summary,
  tier,
}: {
  name: string
  summary?: TierRatingSummary
  tier: TierKey | null
}) {
  return (
    <div className="tier-score-details">
      <strong>{name}</strong>
      {summary ? (
        <>
          <p>
            <strong>Average {summary.average.toFixed(4)} / 10</strong> ·
            Suggested {summary.tier}
          </p>
          {tier && (
            <p>
              Placed in {tier}
              {tier === summary.tier
                ? ' · Matches rating'
                : ' · Outside the suggested rating band'}
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Level cap</th>
                <th>Modern</th>
                <th>Wild</th>
              </tr>
            </thead>
            <tbody>
              {LEAGUES.map((league) => (
                <tr key={league}>
                  <th scope="row">{LEAGUE_NAMES[league]}</th>
                  {(['modern', 'wild'] as const).map((format) => (
                    <td key={format}>
                      {summary.scopes
                        .find((s) => s.league === league && s.format === format)
                        ?.score.toFixed(3) ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Equal average of {summary.scopes.length} available published scores.
            Missing or inapplicable scopes are excluded.
          </p>
          <p>S ≥9 · A ≥8 · B ≥6.5 · C ≥5 · D &lt;5</p>
        </>
      ) : (
        <p>Published unit ratings are unavailable. No mismatch is inferred.</p>
      )}
    </div>
  )
}
