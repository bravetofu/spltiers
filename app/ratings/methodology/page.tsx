import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { getCollectorStatus, getPublishedProfile } from '@/lib/ratings/server'
import { ENGINE_VERSION } from '@/lib/ratings/types'
import '../../cards/catalogue.css'
export const revalidate = 300
export const metadata: Metadata = {
  title: 'How Card & Ability Ratings Work — Splintiers',
  description:
    'An open explanation of Splintiers curated card models, battle sampling, evidence thresholds, confidence and publishing.',
}
export default async function Methodology() {
  const [status, profile] = await Promise.all([
    getCollectorStatus(),
    getPublishedProfile(),
  ])
  return (
    <>
      <Nav />
      <main className="catalogue-page rating-methodology">
        <header className="catalogue-header">
          <p className="catalogue-eyebrow">Ratings methodology · beta</p>
          <h1>Strength, with the reasoning attached.</h1>
          <p>
            Every combat card and ability can receive a 0–10 rating. Curated
            mechanics provide a starting point; independent ranked results
            gradually refine it.
          </p>
          <div className="catalogue-header-links">
            <Link href="/cards">Card library ↗</Link>
            <Link href="/abilities">Ability ratings ↗</Link>
          </div>
        </header>
        <h2>What a rating means</h2>
        <p>
          Zero represents very poor combat value; ten represents an exceptional,
          near-perfect result in the evaluated context. A score is not a win
          probability or a promise that a card fits every team. Units and
          summoners use different stat treatment. Land cards have no combat
          score.
        </p>
        <p>
          Ratings are separate for Modern and Wild, at Bronze, Silver, Gold and
          Diamond/Champion card-level caps. Wild battle context includes
          Modern-eligible cards too. This differs from the catalogue’s
          Wild-exclusive filter, which only shows cards outside Modern.
        </p>
        <h2>The curated model</h2>
        <p>
          Each card uses the stats and abilities unlocked at the selected cap.
          Mana has a cost; damage, speed and durability contribute value.
          Summoner effects are evaluated as team buffs or debuffs, not as
          personal combat stats. Tactical alternatives contribute the strongest
          available option rather than all options at once. Bloodline grants are
          discounted for their team restriction.
        </p>
        <p>
          Ability priors combine Standard and non-standard strength, currently
          weighted {Math.round((profile?.config.standardWeight ?? 0.2) * 100)}%
          and {Math.round((1 - (profile?.config.standardWeight ?? 0.2)) * 100)}
          %. Multipliers and separate league multipliers reflect context.
          Synergies include positive and negative pairings, plus stat-dependent
          bonuses. Overlapping synergy bonuses are capped to prevent explosive
          totals.
        </p>
        <p>
          Multiple attacks, no-attack utility, low-mana flexibility and splinter
          versatility receive explicit contributions. A fixed smooth calibration
          maps the raw total onto 0–10. Adding a new card does not automatically
          change every existing card’s rating. Curator adjustments then apply
          directly to the rating, with a combined limit of −2 to +2 per card and
          scope and a required explanation.
        </p>
        <p>
          The initial profile is provisional, inspired by SplinterGuide’s
          methodology. Historical card-specific fudge factors and extreme
          constants were not copied. Current starting weights are open to review
          in the publishing workflow.
        </p>
        <h2>Team engines and partnerships</h2>
        <p>
          Bloodline Tribute is valued as a conditional team buff: up to three
          matching-bloodline or Shapeshift allies, shared attack types, and
          additional death triggers from Rebirth. Taunt improves trigger
          reliability, and low mana leaves room for the beneficiaries.
          Compatible Bloodline Dominion summoners expand the available team;
          Scavenger can benefit from repeated deaths. These are team-building
          assumptions, not measured causal contributions. Only abilities
          unlocked at the selected level count, and alternative partners are not
          added together.
        </p>
        <h2>How battle evidence changes a score</h2>
        <p>
          The collector retains replay data, source, time, format and parser
          version so matches can be reprocessed as the methodology improves.
          Only completed, non-surrender ranked matches with usable lineups,
          context and pre-battle player ratings contribute to strength evidence.
          Practice and tournament data may be archived, but do not affect ranked
          ratings.
        </p>
        <p>
          The level cap comes from explicit match settings where available.
          Otherwise a conservative lineup-based inference requires complete
          teams, no cards above the cap and at least two cards reaching it.
          Unmapped matches remain archived. Underlevelled card appearances do
          not stand in for cap-level strength. Identical cards or abilities on
          both teams are excluded from the respective strength estimate; one
          shared card cannot explain which team won.
        </p>
        <p>
          Results are adjusted against a pre-battle player-rating baseline using
          an Elo-style 400-point scale. Current player profiles are never used
          as historical pre-battle ratings. A draw counts as half a win. Only
          the last 90 days contribute, with a 30-day half-life; older raw
          matches remain available for research. A player contributes at most
          ten recent appearances per feature, scope and day.
        </p>
        <p>
          A minimum of 30 qualifying matches, five distinct players and 20
          effective samples is required before battle evidence changes a rating.
          Results above or below the player-rating expectation estimate an
          adjustment to the curated baseline: five percentage points correspond
          to one rating point before confidence limits. Results at expectation
          leave the baseline unchanged. The fraction of that adjustment applied
          grows with effective sample size, player diversity and days covered,
          up to 65%. Scores remain bounded at 0–10. No data, unavailable data or
          weak evidence does not mean a zero rating.
        </p>
        <h2>Confidence and limitations</h2>
        <p>
          “Curated only” means the battle threshold has not been met. “Early,”
          “Moderate” and “Strong” describe increasing sample breadth, not
          certainty. Moderate requires at least 150 effective samples, 15
          players and seven days; strong requires 500 effective samples, 30
          players and 14 days.
        </p>
        <p>
          These are observational associations. Player ratings, mirrored-feature
          exclusions and sampling limits reduce some bias; they do not fully
          isolate an individual card or ability from teammates, ownership, bots,
          player preference or favorable rulesets. Popularity is not directly
          rewarded. Sparse or highly correlated samples retain limited
          influence. Standard/non-standard match counts are available to audit
          context coverage.
        </p>
        <h2>Collection status</h2>
        <p>
          {status.battles.toLocaleString('en-US')} archived battles ·{' '}
          {status.rankedBattles.toLocaleString('en-US')} ranked battles ·{' '}
          {status.eligibleBattles.toLocaleString('en-US')} eligible for strength
          {status.lastBattle
            ? ` · Latest battle ${status.lastBattle.slice(0, 10)}`
            : ''}
          .
        </p>
        <p>
          {status.lastRun
            ? `Latest run: ${status.lastRun.finishedAt?.slice(0, 10) ?? 'in progress'} · ${status.lastRun.collected} new battles archived. ${status.lastRun.status === 'completed' ? 'Completed.' : status.lastRun.status === 'running' ? 'Collection is running.' : 'Some upstream requests were unavailable; completed ingestions are retained for the next run.'}`
            : 'The collection job has not completed a run yet.'}
        </p>
        <p>
          A job scheduled every 15 minutes discovers players from public
          leaderboards and opponents, samples their active ranked queues, and
          resolves full replays without an access token. Ratings refresh daily;
          collection runs retain new replays between refreshes. Scheduled runs
          may be delayed by the hosting provider. Shared or manually submitted
          replays are archived for research only, because players selectively
          share their results. Bulk history access depends on the upstream API’s
          current access rules. Publicly discoverable matches are a sample, not
          a complete or random game-wide archive.
        </p>
        <h2>Publishing and accountability</h2>
        <p>
          Authorized curators edit a draft, preview its results, then publish a
          named version with a reason. Draft changes do not alter public scores.
          Publishing atomically replaces the score snapshot, records the profile
          and author, and refreshes cached ratings. Battle collection refreshes
          the published profile’s evidence without publishing draft weights.
        </p>
        <p>
          Current engine: {ENGINE_VERSION}. Profile:{' '}
          {profile ? profile.id : 'not initialized'}. Every card’s breakdown
          exposes its components and current evidence.
        </p>
        <h2>Sources</h2>
        <ul>
          <li>
            <a
              href="https://support.splinterlands.com/hc/en-us/articles/10038260640916-Available-APIs"
              target="_blank"
              rel="noreferrer"
            >
              Official API directory
            </a>
          </li>
          <li>
            <a
              href="https://api2.splinterlands.com/doc/"
              target="_blank"
              rel="noreferrer"
            >
              Game API Swagger
            </a>{' '}
            ·{' '}
            <a
              href="https://vapi.splinterlands.com/swagger/"
              target="_blank"
              rel="noreferrer"
            >
              VAPI Swagger
            </a>
          </li>
          <li>
            <a
              href="https://support.splinterlands.com/hc/en-us/articles/12821703483156-List-of-Splinterlands-Abilities-and-Debilitations"
              target="_blank"
              rel="noreferrer"
            >
              Official ability mechanics
            </a>
          </li>
        </ul>
      </main>
    </>
  )
}
