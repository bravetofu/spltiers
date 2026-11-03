# Scoring methodology

Current model: **hybrid-1.3**. This is the maintained design reference for curated
card/ability strength. [Collection, persistence and operations](card-ratings.md)
are documented separately. The public explanation is `/ratings/methodology`.

## Scope and score composition

Scores run from 0 to 10 for combat units and summoners, separately in Modern and
Wild at Bronze, Silver, Gold and Diamond/Champion card caps. Use only unlocked
abilities and cap-level stats. Land has no combat rating. Wild ratings include
Modern cards; the library's Wild filter means Wild-exclusive cards.

1. **Shared curated ability priors:** blend Standard/non-standard weights using
   the profile's mix (currently 20%/80%), apply the ability multiplier, clamp to
   0–10. These editable, published priors feed BOTH ability pages and card baselines.
2. **Card raw subtotal:** baseline 1.6, mana cost, offense, speed/durability,
   abilities, synergies, conditional team interactions and flexibility. A unit's
   ordinary beneficial ability contributes `prior / 10 × 1.3 × leagueAbilityMultiplier`.
   A drawback contributes `−(10 − prior) / 10 × 1.3 × leagueAbilityMultiplier`.
   Higher drawback scores mean more useful/less harmful, not a guaranteed benefit.
   Summoners use their configurable team ability factor (default 4), signed
   team stat effects, best tactical alternative and discounted bloodline grants.
3. **Card calibration:** `10 / (1 + exp(−(raw − center) / 2))`, center 5 for units,
   2.5 for summoners. Explained curator adjustments follow, capped at ±2 per scope.
4. **Evidence:** confidence-limited win adjustment and a small use-rate bonus
   refine the curated baseline, with the result clamped to 0–10. Ability pages
   have their own shrunken win evidence but no usage bonus. The evidence gates,
   formulas and sampling limitations are in [the operations reference](card-ratings.md).

The battle-adjusted ability score is **not** fed back into a card: that would
count the same match evidence twice. Contextual card deltas are raw points before
calibration; they are not directly additive to the displayed final 0–10 score.
The card breakdown exposes each delta and its assumptions. Generic ability
strength is not a promise that every carrier realizes its full value.

## Contextual ability valuation

Partner availability is checked in the selected format and at the selected cap.
Shared/Neutral/Dragon access and Bloodline Dominion access are considered.
This is a team-building approximation, not a lineup simulator: active elements,
modifiers, mana, positioning, Gladiator restrictions and team slots still matter.
Unavailable or locked partner abilities never earn an interaction bonus.
Alternative partners are not automatically summed into an impossible team.

### Drawbacks and Painforge

Electrified, Incendiary, Reckless and Stray Shot retain friendly-damage penalties,
but can have strategic value when converted into attack power by Painforge.
Weary is turn loss, not damage, so it earns no Painforge conversion bonus.

The additional `Painforge damage conversion` component uses attack-type count
and health to bound the receiver's payoff. Receiver capacity is
`min(1.5, attackTypes × 0.75) × min(1, health / 6)`. It uses these provisional
activation factors, chosen as modeling discounts rather than measured odds:

| Source | Factor | Requirement / limitation |
| --- | ---: | --- |
| Electrified | 0.8 | Reliable damage from round two; includes the source itself |
| Incendiary | 0.7 self, 0.35 ally | Burning damages its carrier; ally spread is uncertain |
| Reckless | 0.65 | Source must have an attack; a successful hit damages adjacent allies, not itself |
| Stray Shot | 0.25 | Source needs ranged attack; random friendly target, damage even on misses |

Use at most two recipients for Electrified and one for other sources. Sum those
receiver capacities × activation factors, then take the best source. If the card
is itself a receiver with an external source, compare that value with its enabling
role and take the larger, not both. Cap at 1.2, then multiply by the unit ability
scale and `Painforge prior / 10`. Keep the original harm penalty. Health cost,
random targeting, Cleansing, Dispel and team cost prevent an unconditional upgrade.
No-attack Painforge trainees and Poison rulesets are not yet simulated here.

### Shapeshift

Shapeshift makes a unit eligible for every bloodline effect, including summoner
grants, Bloodline Tribute and Bloodline Pact. Its higher generic prior reflects
that broad flexibility; `Shapeshift bloodline access` adds bounded, available
partner value at the selected cap:

- For each compatible summoner, sum the unique racial-grant priors divided by 10.
  Use the best summoner package, multiplied by 0.6 and capped at 1 raw point.
- Add `0.6 × Tribute prior / 10` if a compatible Tribute source exists.
- Add `0.35 × Pact prior / 10` if a compatible unit with Pact exists. Pact's
  downside remains part of its generic valuation; this is access value only.
- Multiply that sum by the unit ability scale and `Shapeshift prior / 10`.

Different summoners are alternatives, not simultaneous buffs. Multiple identical
racial grants within one package are deduplicated. Bloodline effects from other
mechanics remain represented by the broad prior until explicitly modeled.

### Bloodline Tribute and resurrection

Tribute's team-wide gain needs compatible matching-bloodline or Shapeshift allies.
Model up to three beneficiaries, with +1 health/speed/armor and the profile weight
of **each** shared attack type (sum, not just the strongest type). Average shared
attack value across available compatible recipients. Repeated death triggers use
`1 + (Rebirth ? 1 : 0) + (compatible external Resurrect ? 0.5 : 0)`.

The half-trigger external allowance represents uncertain timing/target selection,
not half a game resurrection. Count only one external allowance regardless of how
many alternative revivers are available. Multiply by trigger reliability (0.9
with Taunt, otherwise 0.55), mana affordability `min(1.5, 6 / (3 + mana))`,
beneficiary count and the league stat multiplier. Add only the surplus above the
ordinary Tribute ability contribution, preventing baseline double-counting.

Bloodline Dominion can broaden available allies, and its best Tribute partner
adds a bounded summoner interaction. Scavenger can benefit from the extra deaths.
Final Rest and Dispel can counter the engine; infinite resurrection loops and
perfect five-beneficiary teams are never assumed. Grix + Dragonlord Mancer is a
regression example, not a name/ID override. Other cards with the same mechanics
receive the same treatment.

### Bloodlust

Bloodlust's generic strength rises, but its contribution depends on the carrier's
ability to secure kills. Define cap-level attack pressure as
`melee + 0.85 × ranged + 1.1 × magic`. Its card contribution uses
`factor = clamp(pressure / 3.5, 0.15, 1.6)`. The breakdown shows
`Bloodlust trigger potential = ordinary Bloodlust contribution × (factor − 1)`.
The floor leaves limited room for indirect kills; this is not a kill probability.

For a no-attack, trainable unit, use the best compatible Weapons Training donor's
weighted attack pressure, capped at 3 and discounted by 0.7 for adjacency and team
cost. No donor, a locked donor ability, or Untrainable means no training credit.
Only one donor is modeled; dual training is a future refinement. This component
values the Bloodlust payoff, not the trained attack itself; the separate generic
no-attack utility allowance remains a modest team-flexibility prior.

Combined attack types naturally raise pressure. Double Strike, Opportunity,
Sneak and Trample keep their existing pair-rule bonuses; the trigger multiplier
does not also apply those ability multipliers. Pair bonuses have a combined
2-point overlap cap, as do stat/ability synergies. Survivability and access to
attack positions matter but are not yet fully modeled in the kill estimate.

## Curated feedback ledger

Player feedback is evidence for a modeling hypothesis, not a measured win effect.
Retain its source/date, applicability, implementation and counterexample here.

| Date / source | Feedback | Implemented rule and guardrail |
| --- | --- | --- |
| 2026-11-03 · owner/player | Some debilitations enable Painforge; Weary offers little upside | Four damage sources get conditional conversion credit, penalties retained; Weary excluded |
| 2026-11-03 · owner/player | Shapeshift is among the strongest abilities | Prior 8 → 9.5; capped summoner/Tribute/Pact access, no stacking alternative summoners |
| 2026-11-03 · owner/player | Tribute is exceptionally powerful, especially through repeated resurrection | Prior 7 → 9.5; all shared attack types and one discounted external revive allowance, baseline subtracted |
| 2026-11-03 · owner/player | Bloodlust is powerful only if its carrier can get kills | Prior 8 → 9; attack-sensitive contribution and conditional training, weak ranged counterexample |
| Earlier owner/player feedback, retained 2026-11-03 | Grix's cheap Taunt + Tribute + Rebirth works especially well with Mancer | General affordability, trigger, recipient-access and Scavenger rules; anonymized-card regression |

Drawback priors become Electrified 3, Incendiary 3, Reckless 2.5, Stray Shot 2.5;
Weary remains 1. These are provisional general-use strengths, not net values in
an optimized Painforge team. Standard and non-standard priors currently match
for this review: there is insufficient ruleset-frequency evidence to justify a
precise split. Admin weights and notes remain editable and versioned.

## Consistency and change process

For each update: verify mechanics against official guides and live catalogue
fields, record player feedback here, identify where the effect already enters
the score, add counterexamples, compare representative scope deltas, and publish
a named profile/engine revision. Review this document as a whole; replace obsolete
rules instead of accumulating contradictory addenda. Do not turn sample size,
usage or a named favorite card into a second implicit bonus.

This review corrects the previous strongest-shared-attack-only Tribute estimate,
and the assumption that only self-Rebirth can repeat it. Official sources can
also disagree: the older Bloodlust guide says no summoner grants it, while the
current catalogue includes Mancer's Bloodlust tactic. Use current card fields
for grants and ability-specific current mechanics for triggers. The older reward
FAQ's claim that Dispel removes Weapons Training conflicts with the current
Weapons Training/Dispel guides; do not adopt it.

The one-time `ability-review-2026-11-03.json` migration compares each previous
provisional weight before replacing it. Custom published weights win; private
draft changes are merged separately and are never published. A named profile,
engine snapshot and revision check make the review auditable and idempotent.
Subsequent deployments refresh evidence without resetting curation.

Remaining work: evaluate conditional effects against lineup/ruleset-stratified
holdouts; estimate actual Painforge activations, kill conversion and resurrection
counts from round logs; model trained Painforge receivers, dual training and
legal lineup costs. The coefficients above remain explicit priors until that
validation is possible. Correlation of ability and card results is not causality.

## Mechanic references (reviewed 2026-11-03)

- [Painforge](https://support.splinterlands.com/hc/en-us/articles/36780755709460-Painforge)
- [Electrified](https://support.splinterlands.com/hc/en-us/articles/29108697459988-Electrified)
- [Incendiary](https://support.splinterlands.com/hc/en-us/articles/29109259338900-Incendiary)
- [Reckless](https://support.splinterlands.com/hc/en-us/articles/36781010724116-Reckless)
- [Stray Shot](https://support.splinterlands.com/hc/en-us/articles/43935917059220-Stray-Shot)
- [Shapeshift](https://support.splinterlands.com/hc/en-us/articles/36779558246292-Shapeshift)
- [Bloodline Tribute](https://support.splinterlands.com/hc/en-us/articles/36781718737428-Bloodline-Tribute)
- [Bloodlust](https://support.splinterlands.com/hc/en-us/articles/12098803257236-Bloodlust)
- [Weapons Training](https://support.splinterlands.com/hc/en-us/articles/13681184306964-Weapons-Training)
