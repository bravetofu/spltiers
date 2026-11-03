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
          For cards, a minimum of 20 qualifying appearances, five distinct
          players and 15 effective samples is required before win results change
          a rating. Results above or below the player-rating expectation
          estimate an adjustment to the curated baseline: five percentage points
          correspond to one rating point before confidence limits. Results at
          expectation leave the baseline unchanged. The fraction of that
          adjustment applied grows with effective sample size, player diversity
          and days covered, up to 80% for cards. The weight is 0.8 × effective /
          (effective + 75), multiplied by player breadth (up to 15 players) and
          time breadth (up to three distinct days). Ability ratings retain the
          more conservative 30-appearance, five-player, 20-effective-sample gate
          and 65% maximum; abilities receive no popularity bonus. Scores remain
          bounded at 0–10. No data, unavailable data or weak evidence does not
          mean a zero rating.
        </p>
        <h2>Use rate as a utility signal</h2>
        <p>
          A card selected repeatedly across different players can offer
          practical utility beyond its isolated stats. Use rate is the fraction
          of recorded qualifying matches in the same format and card-level cap
          containing that card on either team. A mirror counts once, so the rate
          cannot exceed 100%. It includes underlevelled appearances as evidence
          of selection, without treating them as evidence of maxed performance.
        </p>
        <p>
          The rating uses the last 90 days. Both the numerator and denominator
          receive the same 30-day time decay and account-volume weighting. A
          match is downweighted when either player has more than ten recorded
          matches in that format and cap on the same UTC day. This limits the
          influence of prolific accounts while retaining their matches.
        </p>
        <p>
          Use rate adds a utility bonus of up to one rating point before
          confidence limits, reaching that ceiling at 20% weighted match share.
          It requires use in at least 20 matches by five players, 15 effective
          card matches and 50 effective matches in the scope. The bonus is
          multiplied by totalEffective / (totalEffective + 100), cardEffective /
          (cardEffective + 30), player breadth up to 15 players, and time
          breadth up to three days. Unseen or rarely used cards receive no
          popularity penalty. Ownership, cost and availability also affect
          usage, so this bonus is deliberately smaller than the possible
          win-rate adjustment.
        </p>
        <p>
          Final score = curated baseline + confidence-limited win-rate
          adjustment + confidence-limited use-rate bonus, bounded to 0–10. Card
          breakdowns show both effects in rating points, the use-rate numerator
          and denominator, and any adjustment needed to stay within the bounds.
        </p>
        <h2>Card uses and win rates</h2>
        <p>
          Tables and card pages show uses, wins, losses and win rate from our
          lifetime collected ranked sample, scoped to the selected format and
          league cap. These are not global game totals. Each team using a card
          contributes one use, including underlevelled cards. A mirror match
          contributes two uses: one win and one loss, or two draws. These
          buckets describe card-level caps, not a player’s ladder rank:
          unrestricted matches use the Diamond/Champion cap bucket.
        </p>
        <p>
          Win rate is wins divided by uses. Draws remain in the denominator and
          are shown separately on card pages; an empty sample displays no rate.
          Shared research replays and matches failing the eligibility checks
          above are excluded. Usage totals update after collection and do not
          use the rating model’s 90-day window, daily account limits or mirror
          exclusions. Ratings still refresh daily using their filtered evidence.
        </p>
        <h2>Confidence and limitations</h2>
        <p>
          “Curated only” means neither card evidence threshold has been met.
          Usage evidence alone can establish “Early” confidence; higher levels
          require win-result evidence. “Early,” “Moderate” and “Strong” describe
          increasing sample breadth, not certainty. Moderate requires at least
          150 effective samples, 15 players and seven days; strong requires 500
          effective samples, 30 players and 14 days.
        </p>
        <p>
          These are observational associations. Player ratings, mirrored-feature
          exclusions and sampling limits reduce some bias; they do not fully
          isolate an individual card or ability from teammates, ownership, bots,
          player preference or favorable rulesets. The bounded use-rate bonus
          measures observed selection, not universal strength. Sparse or highly
          correlated samples retain limited influence. Standard/non-standard
          match counts are available to audit context coverage.
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
          A job scheduled every hour at minute seven discovers players from
          public leaderboards and opponents, fetches authenticated ranked
          history when credentials are available, and samples public queues and
          replays. Account/format requests prioritize caps with fewer qualifying
          battles in the last 90 days, using each account’s recently observed
          cap. Every fifth planned request explores the longest-unchecked
          account/format so existing coverage does not prevent discovering new
          scopes. API leaderboard labels do not prove cap coverage, and missing
          scopes cannot be guaranteed each run. Ratings refresh daily;
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
