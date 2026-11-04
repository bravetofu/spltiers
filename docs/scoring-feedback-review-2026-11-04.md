# Support and conditional-value review — 2026-11-04

Engine `practical-3.1`, compared with `practical-3.0` using the same captured
production profile and evidence for both engines. The five user examples are
review cases; no card IDs, names or target ratings were added to the engine.
League/archon caps, evidence formulas, profile adjustments and manual tiers are
unchanged. No schema migration, collector query or historical table was added.

## Champion examples

Diamond/Champion shares the maximum-level scope. Other than Songale, these cards
are Wild-only in the current catalogue.

| Card | Format | Before | After | Model baseline | Win effect | Usage effect |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Thane Newsong | wild | 9.67 | 7.02 | 6.77 | +0.01 | +0.24 |
| Thunderhoof Nomad | wild | 9.57 | 8.53 | 7.51 | +0.82 | +0.19 |
| Magnor | wild | 9.36 | 8.20 | 8.20 | +0.00 | +0.00 |
| Songale | modern | 9.33 | 8.53 | 8.53 | +0.00 | +0.00 |
| Songale | wild | 9.14 | 8.36 | 8.36 | +0.00 | +0.00 |
| Drybone Barbarian | wild | 9.14 | 8.15 | 7.37 | +0.47 | +0.31 |

- **Thane Newsong:** independent support stacking was the main source of inflation.
  Inspire now needs relevant melee recipients, Headwinds only counters ranged
  pressure, support has diminishing returns, and slow/costly training setups get
  less attack credit. Strengthen and Swiftness still help his own body.
- **Thunderhoof Nomad:** Triage heals one injured ally, not an amount proportional
  to every team slot. Sheltered Deflect receives less credit. Her 7.52 baseline
  is within the suggested range; the frozen sample's 61.19% player-adjusted result
  over 66 qualifying appearances and 5.38% weighted use add about one point.
  Retaining the existing evidence model therefore leaves her at 8.53, below S.
- **Magnor:** focused Taunt pressure, armor overflow, conditional Trample and
  ranged-only Return Fire reduce idealized output. His attack and health still
  make him a strong card, without assuming armor or Piercing he does not have.
- **Songale:** discounts apply to narrow bloodline packages, Shapeshift-dependent
  recipients and Reckless/Painforge uptime. Enrage is worth less on a magic-only
  body. Reckless's drawback also shrinks when the source dies early, rather than
  only reducing its benefits.
- **Drybone Barbarian:** expensive physical burst loses armor overflow and useful
  turns to incoming pressure. Retaliate responds only to melee; Knock Out needs
  Stun access. Positive usage/win evidence still adds about 0.79 points.

## Broader review

All 5,560 scopes were recomputed. Mean absolute change is
**0.31/10**; **48** scopes move at least two points.
Against 852 non-league-specific manual tier references, mean ordinal tier
distance moves from **0.87 to 0.93**.
That diagnostic worsens slightly: this correction reduces support optimism,
including for some manually high-tier cards. It is not a measure of prediction
accuracy, and the engine was not forced to reproduce those tiers.

The largest movements were inspected. Exploding Dwarf's 8.49 → 5.89 is a fragile,
one-health burst specialist losing assumed sustained retaliation/Trample output.
The first draft undervalued fast first attacks, so a general initiative allowance
was added before accepting the remaining reduction. It can still be excellent in
specific rulesets the compact panel does not simulate (for example Equalizer).
Angel of Light's 8.92 → 6.49 and lower-cap Merdaali Guardian/Mermaid Healer declines
reflect expensive/slow training and less automatic healing/support credit; these
remain useful future review cases rather than proof the new scores are correct.

Reviewing Queen Mycelia and other supports exposed missing self-Protect and
self-Strengthen durability. Crediting those effects generally moderated the first
draft's excessive reductions: Queen Mycelia finishes around 7.82, Truthspeaker
7.91 and Daarg Deadblast 8.72 Modern. Venari Wavesmith increases from 7.45 to 7.93,
and Grix remains around 9.62 Modern. Strong armor and mitigation continue to
protect Mantaroth's value. No global downward rescaling was introduced.

## Validation and limits

Regression cases cover armor overflow, relevant debuff families, support overlap,
Triage saturation, training investment/initiative, self-buffs, Deflect roles and
Tribute breadth. Existing tests cover cap/format gates and unchanged evidence
components. Tests, typecheck and lint pass. Public card breakdowns expose support
overlap and the revised ability-specific explanations.

The local configured database lacks the earlier `rating_totals` migration; local
build compilation succeeds but DB-backed prerendering against that stale database
fails. Production build and post-release score/page checks are verified separately.
No production schema change is needed for this release.

Scenario weights, survival, opportunity and setup coefficients are transparent
heuristics. They do not replace a battle simulator or causal performance study.
Storage remains the existing bounded score snapshot and daily evidence system.
