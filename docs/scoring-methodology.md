# Scoring methodology

Engine **practical-3.1** (2026-11-04). Collection, bounded daily storage and the
unchanged evidence formulas are documented in [card-ratings.md](card-ratings.md).
Public explanations live at `/ratings/methodology` and on each card page.

## Scope and evidence

Preserve Bronze, Silver, Gold and Diamond/Champion rarity-level caps. The owner
confirmed that archon league caps have been reinstated; older support statements
about their removal do not override this. Use only cap-level stats and unlocked
abilities. Modern and Wild have separate pools; land has no combat score.

Final score = practical baseline + confidence-weighted win adjustment +
confidence-weighted usage bonus + 0–10 bounds. The existing 90-day summaries,
30-day half-life, player-rating adjustment, mirror exclusion and sample gates
remain unchanged. Usage remains a positive, bounded utility signal as requested:
up to one point before confidence, reaching its ceiling at 20% weighted match
share. Usage includes underlevelled selections; win evidence requires the card
at the evaluated cap. Both are associations, not estimates of causal impact.

Manual tiers are independent, non-league-specific review references. They are
never read by the scoring engine, used as targets, or modified by this review.

## Unit contribution model

`practical-value.ts` evaluates the card against ten small, weighted situations:

| Situation | Weight | Mana budget |
| --- | ---: | ---: |
| Low mana | 15% | 22 |
| Mixed opposition | 25% | 32 |
| High mana | 15% | 50 |
| Armored opposition | 10% | 32 |
| Magic opposition | 10% | 32 |
| Reverse Speed | 5% | 32 |
| Noxious Fumes | 5% | 32 |
| Melee Mayhem | 5% | 32 |
| Close Range | 5% | 32 |
| Back to Basics | 5% | 32 |

These are sensitivity assumptions, not measured frequencies or a battle
simulator. Multiple simultaneous modifiers and exact active-element restrictions
are not enumerated. Format/cap catalogue averages supply representative speed,
power and physical/magic mix. New cards can therefore change matchup estimates
and legal partner availability; scores are not pool percentile ranks.

For each situation, choose the highest-valued plausible frontline, backline or
Reach-enabled second-position role. Both output and durability inform that choice.
A backline melee allowance of 10% represents later advancement to the front.
Melee Mayhem/Close Range enable their respective attacks. Compatible affordable
Flank and archon Close Range offer discounted access (55% and 45%); an own ability
receives full access. These are possible setups, not guaranteed grants.

Attack output uses unlocked attack power, physical accuracy, a small allowance
for enemy Phase, armor pressure, productive turns (bounded between 0.5 and 3),
Double Strike and remaining-armor attacks. Double Strike's additional output and
Armored Strike's armor contribution are weighted by their curated priors. Recharge
gets a conservative 1.1 output factor for delayed burst. Weary reduces productive
attacks and active support to 80% without available Invigorate. Timing estimates
are priors, not measured survival or exhaustion probabilities.

Incoming-hit probes use powers 1, rounded representative power, and 5. Shield/Void
use their actual rounded damage breakpoints, including blocking power-one attacks;
Forcefield responds to power five. The modeled benefits are discounted by the
curated ability prior. Evasion, Phase, armor absorbing a whole physical hit and
Void Armor affect durability. A bounded mitigation factor avoids unbounded tank
scores. Heal follows `min(health, max(2, floor(health / 3)))`, then discounts for
interruption and wasted healing. Repair can sustain armor. This is a compact
expected-value approximation, not an exact attack sequence.

Support abilities scale with relevant recipients, team space, health, attack
pressure or survival. Martyr accounts for adjacent recipients and Rebirth; Volley
of Arrows accounts for available ranged allies. No-attack cards only gain attack
output when an affordable unlocked Weapons Trainer exists; Untrainable blocks it.
Training is capped at three power and discounted to at most 55% for setup/adjacency, then reduced for combined recipient/trainer mana and recipient initiative (reversed under Reverse Speed).
Trainers select at most two eligible trainees that jointly fit a legal package.

Mana's raw cost is multiplied by 1.15 at low mana, 0.75 at high mana and 1 otherwise.
Cards below six mana receive `(6 - mana) × 0.18` for preserved team budget;
zero/one-mana flexibility remains. These are transparent calibration choices.

## Support, exposure and conditional triggers (3.1 refinement)

Team support receives diminishing returns: positive support total `s` keeps its
first raw point, then becomes `1 + 2.5 × log(1 + (s - 1) / 2.5)`. The separate
**Support overlap** line exposes the deduction. Negative effects, including
speed buffs in Reverse Speed, are not discounted. This is a shared opportunity
allowance, not a claim that these abilities cancel one another.

Inspire/Focus scale by affordable melee/ranged recipient shares. Headwinds and
Demoralize use the corresponding opposing attack share instead of both receiving
credit for all physical pressure. Tank Heal/Triage target one injured ally per
action; adding team slots cannot multiply the heal. Triage gains opportunity in
Noxious Fumes. Protect, Strengthen and Swiftness also affect their own carrier.

Incoming pressure uses 1.8 representative attacks, or 2.3 for Taunt, multiplied
by exposure (front/Taunt 1, ordinary backline 0.4, Camouflage 0.25). Productive
turns remain bounded at 0.5–3. Output availability is `0.35 + 0.65 × turns / 3`,
plus up to `0.2 × (1 - turns / 3)` for initiative. This preserves some first-hit
value for fast glass cannons without assuming sustained output. These are model
assumptions rather than measured attack counts or survival rates.

Physical attacks lose expected overflow against a representative armor plate:
`1 - armorFrequency × max(0, power - armor) / power`. Armor presence and typical
positive armor come from the cap/format pool, with a bounded ordinary frequency
and an 85% armored-opposition probe. Piercing recovers overflow in proportion to
its ability prior; Shatter receives partial recovery for later hits. Small hits
do not lose fictitious overflow. Piercing's old flat bonus is removed.

Deflect is worth more for active attackers and second-position coverage. Enrage
gets less value without melee offense; Retaliate only responds to melee pressure;
Trample needs usable killing pressure; Knock Out is discounted without Stun access.
Return Fire/Magic Reflect/Thorns depend on the relevant incoming attack type and
exposure. Reckless's damage penalty and possible Painforge payoff are both reduced
when the source is unlikely to survive to act repeatedly. Full attack order and
trigger chains remain outside this compact model.

## Abilities, overlap and partners

Generic abilities retain the editable profile's Standard/non-standard prior blend.
Quantitatively modeled effects have zero duplicate flat bonus; the breakdown says
where their value is included. Old stat bonuses for modeled effects, and pair
bonuses where both effects are modeled, are suppressed. Other pair/stat bonuses
retain their existing overlap caps. Ability-page battle scores are not fed back
into cards. Curated priors still scale the modeled benefits; they do not rewrite
underlying rules such as attack permissions.

Partner access enumerates one archon and legal element choice. A Dragon archon
selects one additional element, dual archons expose their own two elements, and
Bloodline Dominion exposes matching bloodlines/Shapeshift. Six unit slots and
archon/unit mana count. Ordinary ranked packages allow one Gladiator only with
Conscript. Special Gladiator-enabling modifiers are not fully modeled.

Bloodline Tribute selects up to three inexpensive eligible beneficiaries in a
legal 32-mana package. Count every shared attack type. Rebirth adds 0.85 modeled
repeat triggers. External Resurrect adds 0.35 only if the reviver fits with those
beneficiaries; this is a timing discount, not a fractional game resurrection.
Narrow eligible pools and dependence on Shapeshift recipients further discount the package; legal availability is not a guaranteed lineup. The estimate uses `4.5 × tanh(value / 4.5)` to bound repeated team gains. Subtract
its already-credited ability baseline. Archon partnership contributions are
bounded; additional partner combinations are not exhaustively optimized.

Painforge credits poison pressure in its scenario and affordable compatible
Electrified, Incendiary, Reckless, Stray Shot, Resurgence and Soul Siphon sources.
Friendly-damage penalties remain. A trainable no-attack recipient receives only
discounted conversion potential. Damage sources, trained damage and granted
attacks are not fully simulated in temporal order. Shapeshift's base allowance is
reduced while available bloodline grants supply conditional value.

Final Rest follows the current dedicated article: one enemy resurrection block,
not blanket suppression of death effects. Some general official pages still show
the previous implementation. Death Has No Power may retain the older behavior.

## Archons and calibration

Archons have a team-access baseline (1.5 raw points), plus dual-element (1.5) or
Dragon (0.6) access. Team stat effects scale with feasible team size and relevant
attack recipients, then use `4 × log(1 + effects / 4)` for diminishing returns.
Tactics use the best alternative, recipient count and effect magnitude. Conditional
Bloodline Dominion and Close Range grants require an eligible pool. Curated
bloodline grants and bounded team-engine partnerships remain separate.

The unit baseline starts at 1.6 raw points. After all contributions:
`10 / (1 + exp(-(raw - center) / 2))`, with center 4 for units and the profile's
archon center (default 2.5). The unit center was recalibrated after replacing flat
ability bonuses with practical calculations. Explained curator adjustments follow,
bounded at ±2 per card/scope. No named card or manual tier receives an override.

Card breakdowns show model contributions separately from final rating-point
adjustments. Matchup sensitivity shows a unit's own subtotal relative to mixed
opposition, before shared partner contributions, calibration and evidence.

## Review and validation

`scripts/review-ratings.mts` reads a captured published profile, frozen evidence,
previous engine output and manual tier entries. It writes local comparison data
under ignored `work/`, reporting all 5,560 card scopes, large movements and tier
discrepancies. It performs no database writes. Compare like-for-like evidence so
collection timing cannot masquerade as an engine change. Manual tiers are compared
with the existing all-scope mean; individual cap differences are reviewed too.

Regression checks cover damage/healing breakpoints, speed reversal, attack scaling,
armor-dependent attacks, conditional training, locked/illegal/unaffordable partners,
Dragon/dual-element legality, Gladiator access, Weary mitigation, Back to Basics,
unchanged evidence signals and all-catalogue finite bounds. See the dated score
review for calibration findings and remaining discrepancies.

No new historical tables or collectors are required. Scenario summaries are small
fields in the single replaceable score snapshot. Runtime partner indexes are cached
per format/cap and discarded after recomputation.

## Sources and precedence

Reviewed official support mechanics on 2026-11-04; current card fields and explicit
owner corrections take precedence over stale guides. Coefficients above are model
judgments, not values supplied by Splinterlands.

- [Card stats and positions](https://support.splinterlands.com/hc/en-us/articles/14364449285268-Intro-to-Stats-Anatomy-of-a-Card)
- [Attack order and accuracy](https://support.splinterlands.com/hc/en-us/articles/4414334269460-Attack-Order-Accuracy)
- [Shield](https://support.splinterlands.com/hc/en-us/articles/12431536947732-Shield)
- [Heal](https://support.splinterlands.com/hc/en-us/articles/12308154407188-Heal)
- [Armored Strike](https://support.splinterlands.com/hc/en-us/articles/21011376874260-Armored-Strike)
- [Weapons Training](https://support.splinterlands.com/hc/en-us/articles/13681184306964-Weapons-Training)
- [Bloodline Dominion](https://support.splinterlands.com/hc/en-us/articles/36784661689108-Bloodline-Dominion)
- [Bloodline Tribute](https://support.splinterlands.com/hc/en-us/articles/36781718737428-Bloodline-Tribute)
- [Painforge](https://support.splinterlands.com/hc/en-us/articles/36780755709460-Painforge)
- [Final Rest, current and previous implementations](https://support.splinterlands.com/hc/en-us/articles/36779459616660-Final-Rest)
- [Modifiers](https://support.splinterlands.com/hc/en-us/articles/9123215350548-List-of-Splinterlands-Modifiers)
