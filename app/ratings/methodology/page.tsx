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
            mechanics provide a starting point; ranked win results and observed
            card use gradually refine it.
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
        <h2>How ability strength affects cards</h2>
        <p>
          Published curated ability weights feed both the ability ratings and
          each card’s starting score. A unit’s ordinary beneficial ability adds
          its prior divided by ten, multiplied by 1.3 and the league ability
          multiplier. Drawbacks retain a negative contribution. The card model
          then accounts for whether that unit can exploit the ability. We do not
          feed battle-adjusted ability ratings back into cards, which would
          count the same battle evidence twice.
        </p>
        <h2>Conditional abilities and team partners</h2>
        <p>
          Electrified, Incendiary, Reckless and Stray Shot can turn friendly
          damage into Painforge power. Their harm penalties remain; a separate
          contribution credits compatible Painforge attackers with enough
          health. Reliable damage is worth more than random targeting or
          uncertain Burning spread. Reckless needs a successful attack and
          adjacent allies; Stray Shot needs ranged attack. Weary causes turn
          loss, not damage, so it receives no Painforge bonus.
        </p>
        <p>
          Shapeshift carries a strong prior because it qualifies for every
          bloodline. Available summoner grants, Bloodline Tribute and Bloodline
          Pact add bounded partner value. Only the best summoner package counts;
          alternative summoners are never treated as simultaneous team buffs.
        </p>
        <p>
          Bloodline Tribute models up to three compatible beneficiaries, each
          shared attack type, repeated deaths from Rebirth and a discounted
          extra trigger if compatible Resurrect support exists. Taunt improves
          trigger reliability and low mana leaves room for beneficiaries. The
          ordinary Tribute contribution is subtracted from the interaction
          estimate to avoid counting it twice. Final Rest and Dispel can counter
          the engine; unlimited resurrection loops are never assumed.
        </p>
        <p>
          Bloodlust is a strong snowball ability, but a weak attacker is less
          likely to realize it. Its card contribution scales with damage output:
          combined attacks receive more value than a small ranged attack. A
          no-attack unit can receive conditional credit for compatible Weapons
          Training, discounted for team cost and positioning. Untrainable units
          receive no such credit. Double Strike and targeting synergy bonuses
          stay separate rather than being applied twice.
        </p>
        <p>
          Card breakdowns name these conditional contributions. They use the
          selected format’s available cards and abilities unlocked at that cap;
          actual elements, mana, rulesets and lineup restrictions still apply.
          These are curated team-building estimates, not simulated battles or
          measured causal effects. Grix and Dragonlord Mancer illustrate the
          mechanics, but neither receives a special name-based score.
        </p>
        <p>
          The November 2026 review records player feedback, official mechanics,
          assumptions and counterexamples in the maintained scoring methodology.
          Future reviews should replace outdated assumptions and check for
          overlapping bonuses before publishing new weights.
        </p>
        <h2>How battle evidence changes a score</h2>
        <p>
          Completed, non-surrender ranked matches with usable lineups and
          pre-battle player ratings contribute daily statistics. Shared or
          manually selected replays are excluded. Level caps come from explicit
          match settings or conservative lineup inference. Underlevelled cards
          do not supply cap-level strength evidence. Features appearing on both
          teams are excluded from strength evidence.
        </p>
        <p>
          A draw counts as half a win. Results are compared with an Elo-style
          expectation based on pre-battle player ratings. We retain today and
          the previous 89 UTC days, applying a 30-day half-life by day. Detailed
          replays and player identities are not retained as scoring evidence. We
          do not measure distinct players or apply per-player volume caps;
          repeated sampling of the same accounts can bias results.
        </p>
        <p>
          Cards need 20 appearances, 15 effective samples and two sampled days.
          Abilities need 30 appearances, 20 effective samples and two days. Five
          percentage points above or below expected results imply one potential
          rating point. Card influence is limited to 0.8 × effective /
          (effective + 75) × min(1, days / 3). Ability influence uses 0.65, a
          denominator offset of 150 and time breadth up to seven days. No usable
          evidence leaves the curated baseline unchanged.
        </p>
        <h2>Use rate as a utility signal</h2>
        <p>
          Use rate is the fraction of qualifying matches in the same format and
          cap containing a card. Mirrors count once. Underlevelled appearances
          count for selection frequency. Both numerator and denominator use the
          same daily time decay. A bonus needs 20 card matches, 15 effective
          card matches, 50 effective scope matches and two sampled days.
        </p>
        <p>
          The bonus is at most one point before confidence weighting, reaching
          its ceiling at 20% weighted match share. Its weight is totalEffective
          / (totalEffective + 100) × cardEffective / (cardEffective + 30) ×
          min(1, days / 3). Unseen cards receive no popularity penalty. Final
          scores combine the curated baseline, win-result adjustment and usage
          bonus, bounded to 0–10.
        </p>
        <h2>Card uses and win rates</h2>
        <p>
          Lifetime counters preserve collected ranked uses, wins, losses and
          draws per card, format and cap. Each team contributes a use, including
          underlevelled cards. Mirrors contribute two uses. Win rate is wins /
          uses, with draws in the denominator. These totals describe our sample,
          not all game battles, and survive expiry of daily rating evidence.
        </p>
        <h2>Confidence and limitations</h2>
        <p>
          “Curated only” means neither evidence threshold is met. Usage alone
          can establish “Early” confidence. “Moderate” requires 150 effective
          strength samples and seven days; “Strong” requires 500 and 14 days.
          These labels measure sample size and time coverage, not causal
          certainty or player diversity. Bots, ownership, teammates and
          collection bias can affect both win results and popularity.
        </p>
        <p>
          Summaries allow changes to weights, decay and confidence thresholds.
          Changes requiring discarded replay details apply to newly collected
          matches. Historical replays cannot be reprocessed.
        </p>
        <h2>Collection status</h2>
        <p>
          {status.battles.toLocaleString('en-US')} summarized ranked battles ·{' '}
          {status.rankedBattles.toLocaleString('en-US')} ranked battles ·{' '}
          {status.eligibleBattles.toLocaleString('en-US')} eligible for strength
          {status.lastBattle
            ? ` · Latest battle ${status.lastBattle.slice(0, 10)}`
            : ''}
          .
        </p>
        <p>
          {status.lastRun
            ? `Latest run: ${status.lastRun.finishedAt?.slice(0, 10) ?? 'in progress'} · ${status.lastRun.collected} new battles summarized. ${status.lastRun.status === 'completed' ? 'Completed.' : status.lastRun.status === 'running' ? 'Collection is running.' : 'Some upstream requests were unavailable; completed ingestions are retained for the next run.'}`
            : 'The collection job has not completed a run yet.'}
        </p>
        <p>
          A job scheduled every hour at minute seven discovers players from
          public leaderboards and opponents, fetches authenticated ranked
          history when credentials are available, and samples public queues and
          replays. Account/format requests prioritize caps with fewer qualifying
          battles in the last 90 days, using each account’s recently observed
          cap. Every fifth planned request explores the longest-unchecked
          account/format so existing coverage does not prevent discovering new
          scopes. API leaderboard labels do not prove cap coverage, and missing
          scopes cannot be guaranteed each run. Ratings refresh daily;
          collection runs update daily summaries between refreshes. Scheduled
          runs may be delayed by the hosting provider. Shared or manually
          submitted replays are ignored, because players selectively share their
          results. Bulk history access depends on the upstream API’s current
          access rules. Publicly discoverable matches are a sample, not a
          complete or random game-wide archive.
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
