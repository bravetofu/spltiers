# Practical scoring review — 2026-11-04

Compared **5,560 card/league/format scopes** using the same captured
production profile and evidence for both engines. Manual tier reference:
**852 cards**, compared using the existing all-scope mean, with individual
levels examined when discrepancies were large. No card-specific adjustments were
added and no manual tier entries were changed.

- Mean absolute movement: **0.73 / 10**.
- Scopes moving at least two points: **311**.
- Mean ordinal distance from manual tiers: **1.03 → 0.87 tiers**.
- Full recomputation took roughly **12–16 seconds** in this workspace, depending
  on concurrent checks. No new database queries occur inside the scoring loop.

Tier agreement is a diagnostic, not evidence of predictive accuracy. Manual tiers
are not league-specific, while ability unlocks can legitimately make a card much
weaker at lower caps. Fresh evidence can move the following frozen comparison.

## Representative movements and drill-down

| Card / scope | Before | After | Finding |
| --- | ---: | ---: | --- |
| Grix · Diamond/Modern | 10.00 | 9.75 | Remains exceptional; repeatable Tribute is bounded and its partners must fit a legal mana budget. |
| Daarg Deadblast · Diamond/Modern | 8.80 | 9.30 | Training recipients and team support add value beyond personal damage. |
| Queen Mycelia · Diamond/Wild | 6.43 | 8.66 | Protect and Triage gain appropriate team-recipient value. |
| Khmer Princess · Diamond/Wild | 6.43 | 8.81 | Cheap, fully unlocked double healing support; low caps remain weaker. |
| Truthspeaker · Diamond/Wild | 6.03 | 9.01 | Cheap support, training potential and team effects were underrepresented. |
| Zeddica · Diamond/Modern | 2.45 | 5.22 | Team access and dual-element flexibility have value despite no printed buffs; negative battle evidence still applies. |
| Drybone Raider · Diamond/Wild | 7.81 | 7.13 | Initial draft was too punitive: added discounted legal Flank/Close Range enablers. Both attack types still need help to operate together. |
| Djinn Oshannus · Diamond/Wild | 8.74 | 7.78 | Initial tank calculation compressed mitigation too much; corrected effective durability. Still a manual-tier discrepancy. |
| Molten Elemental · Bronze/Modern | 8.37 | 5.55 | Large drop retained: melee/ranged access is restricted before Close Range unlocks; expensive at low cap. |
| Molten Elemental · Diamond/Modern | 9.13 | 8.41 | Unlocked Close Range and stronger stats recover much of the low-cap gap. |
| Mantaroth · Diamond/Modern | 9.09 | 9.09 | Armor-based attacks and Repair are evaluated together; remains close to the prior. |
| Withered Old Sage · Diamond/Modern | 7.63 | 7.56 | Top-level score is similar; missing Spite/Resurgence at lower caps explains much of the all-scope manual S discrepancy. |

## Remaining discrepancies

Pallus remains above its manual D reference: substantial cap-level stats and
second-position access have mechanical value, although real team opportunity cost
may be higher than this approximation. Linked Kindred grants now require a
complementary legal partner and Reach no longer earns duplicate flat credit.

Brave the Bull, Loving the Moo and Gorgug the Endless remain above their manual C
references. The review reduced generic Bloodline Dominion credit according to
eligible pool size and discounted Last Stand/Enrage grants. Their access and
available tactical packages still produce optimistic scores. Broader battle
evidence should inform further calibration rather than forcing manual tiers into
the formula.

Drybone Raider, Supply Runner, Acid Shooter and Nalara Geinek remain below their
manual S references in the all-scope mean. Their best setups, role competition,
level unlocks and support interactions warrant further feedback. Their tiers were
not copied into hidden bonuses. Component values make these disagreements visible.

## Validation and operational impact

Regression checks cover damage/healing breakpoints, attack multipliers,
armor-dependent offense, training, legal and affordable partners, cap/format
exclusions, Gladiator restrictions, Weary mitigation, and ability removal.
Existing usage/win-rate, ingestion and catalogue tests remain in place. Type
checking, lint, production compilation and rendered card breakdown checks passed.

No schema migration or raw-history expansion. A small situation panel is stored
with each unit's current score; replacement of the active snapshot remains bounded.
Daily collection and price collection are unchanged. The engine version triggers
the existing deployment-time score refresh while preserving published curation
and private draft settings. The local build used the older development database,
so its missing-summary-table fallback was exercised; production deployment must
also verify the migrated production database and regenerated snapshot.
