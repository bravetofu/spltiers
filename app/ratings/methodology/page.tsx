import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { getCollectorStatus, getPublicRatingSettings } from '@/lib/ratings/server'
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
    getPublicRatingSettings(),
  ])
  return (
    <>
      <Nav />
      <main className="catalogue-page rating-methodology">
        <header className="catalogue-header">
          <p className="catalogue-eyebrow">Ratings methodology · beta</p>
          <h1>Strength, with the reasoning attached.</h1>
          <p>
            Every combat card and ability can receive a 0–10 rating. Practical
            team contribution provides a starting point; ranked win results and
            observed card use gradually refine it.
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
        <h2>Practical contribution to a team</h2>
        <p>
          Each card uses only the stats and abilities unlocked at the selected
          league cap. Those caps are retained, including restored archon caps.
          The model estimates what a card can contribute in a useful role:
          attacking, absorbing damage, supporting allies or enabling a team.
          Editorial tiers remain an independent reference and are
          never used as an automatic scoring input.
        </p>
        <p>
          Units are evaluated in frontline, backline and, when Reach is
          available, second-position roles. Attacks depend on position and
          accuracy. Survival limits useful attack time; Double Strike and
          Armored Strike contribute through attack output. A mixed melee/ranged
          card cannot automatically use both attacks from every position. A
          small allowance for backline melee represents later movement to the
          front.
        </p>
        <p>
          Durability considers physical and magic pressure, armor absorbing a
          whole hit, Shield and Void damage breakpoints, speed, evasion and
          Forcefield. Heal scales with maximum health; Repair can sustain armor
          and armor-based attacks. Damage and survival estimates are discounted
          by curated ability priors and bounded to avoid idealized infinite
          survival. These are practical estimates, not a full battle simulator.
        </p>
        <h2>Mana, matchups and team roles</h2>
        <p>
          The model averages ten situations: low mana (15%), mixed opposition
          (25%), high mana (15%), armored opposition (10%), magic opposition
          (10%), and Reverse Speed, Noxious Fumes, Melee Mayhem, Close Range and
          Back to Basics (5% each). Low, mixed and high budgets use 22, 32 and
          50 mana. These weights are explicit design assumptions, not measured
          ruleset frequencies. Matchup estimates also use the selected format’s
          cap-level catalogue to represent typical speed and attack pressure.
        </p>
        <p>
          Reverse Speed changes speed’s direction; Noxious Fumes adds poison
          pressure; Melee Mayhem and Close Range enable attacks from additional
          positions. Unit abilities are removed in the Back to Basics component.
          Card pages show each situation’s effect on the card’s own
          contribution. Multiple simultaneous modifiers and exact active-element
          combinations are not simulated.
        </p>
        <p>
          Taunt attracts more incoming pressure, so high health alone does not
          guarantee sustained attacks. Large physical hits lose overflow against
          armor without Piercing. Deflect receives more credit for attacking or
          covering second position than for sheltered support. Retaliate needs
          melee attackers, and Enrage offers less without melee offense. Fast,
          fragile attackers still receive an allowance for acting before dying.
        </p>
        <h2>Support and affordable partners</h2>
        <p>
          Healing, armor repair, team buffs and debuffs scale with relevant
          recipients and available team space. Stacked support has diminishing
          returns: several abilities cannot each assume ideal targets. Headwinds
          counters ranged pressure; Demoralize counters melee pressure. A heal
          targets one injured ally rather than multiplying with team size.
          Low-mana cards receive credit for
          leaving room for allies. Weapons Training needs an eligible,
          affordable trainer or trainee, with an allowance for adjacency and
          setup cost, combined mana investment and recipient initiative.
          Available partners must share a legal archon and element
          choice; Dragon is not permission to combine arbitrary elements.
          Gladiator partners require Conscript in ordinary ranked packages.
        </p>
        <p>
          Bloodlust scales with usable damage and survival. Painforge considers
          poison and compatible friendly-damage sources, including intermittent
          resurrection damage; friendly damage still carries a cost. Weary
          reduces attack and active support availability unless Invigorate is
          available. Shapeshift receives bounded credit for available bloodline
          grants. Partner assumptions describe potential teams, not guaranteed
          buffs in every battle.
        </p>
        <p>
          Tribute evaluates up to three beneficiaries in a legal 32-mana
          package, shared attack types and discounted repeat deaths. Its
          interaction value has diminishing returns and is discounted for narrow
          bloodlines and dependence on Shapeshift partners. Resurrect support must fit
          alongside the beneficiaries before an extra repeat is credited. Dispel
          can remove Tribute buffs; current Final Rest can block an enemy
          resurrection, rather than suppressing every death-triggered effect.
          Death Has No Power and other special modifiers may have different
          behavior.
        </p>
        <h2>Archons and calibration</h2>
        <p>
          Archons receive credit for team access, including dual-element and
          Dragon flexibility. Team stat effects account for relevant recipients
          and have diminishing returns. Tactics use the strongest alternative,
          recipient count and effect size; alternatives are not added together.
          Bloodline grants and partnerships remain conditional.
        </p>
        <p>
          Published ability priors remain editable. Their Standard/non-standard
          blend is currently{' '}
          {Math.round((profile?.standardWeight ?? 0.2) * 100)}% /
          {Math.round((1 - (profile?.standardWeight ?? 0.2)) * 100)}%.
          Quantitatively modeled effects replace their former flat bonuses.
          Other abilities retain prior-based contributions. Overlapping pair and
          stat bonuses are suppressed for modeled effects. Battle-adjusted
          ability ratings are not fed back into card ratings.
        </p>
        <p>
          A fixed smooth curve maps model points to 0–10, with a unit center of
          four and an archon center of 2.5 by default. Explained curator
          adjustments then apply directly, limited to −2 to +2 per card and
          scope. Adding cards can change partner access and matchup estimates,
          but does not force ratings into a percentile distribution.
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
          evidence leaves the practical baseline unchanged.
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
          scores combine the practical baseline, win-result adjustment and usage
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
