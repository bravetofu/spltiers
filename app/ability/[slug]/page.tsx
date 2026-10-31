import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import AbilityTooltipProvider from '@/components/catalogue/AbilityTooltipProvider'
import { abilityInfo, abilityNames } from '@/lib/splinterlands/abilities'
import { abilitiesAt, cardSlug } from '@/lib/splinterlands/catalogue'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
import { getAbilityDetails } from '@/lib/ratings/server'
import { LEAGUES, LEAGUE_NAMES } from '@/lib/ratings/types'
import RatingBadge, {
  CONFIDENCE_LABELS,
} from '@/components/ratings/RatingBadge'
import '../../cards/catalogue.css'
export const revalidate = 300
export function generateStaticParams() {
  return [{ slug: 'heal' }]
}
const abilityName = (slug: string) =>
  abilityNames.find((name) => cardSlug(name) === slug)
export function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Metadata {
  const name = abilityName(params.slug)
  return {
    title: name
      ? `${name} — Ability Strength & Synergies`
      : 'Ability not found',
    alternates: { canonical: `/ability/${params.slug}` },
  }
}
export default async function AbilityPage({
  params,
}: {
  params: { slug: string }
}) {
  const name = abilityName(params.slug)
  if (!name) notFound()
  const [details, cards] = await Promise.all([
    getAbilityDetails(name),
    getCatalogue(),
  ])
  const info = abilityInfo(name)
  const { weight, ratings, synergies, standardWeight } = details
  const related = cards.filter(
    (card) =>
      card.kind !== 'land' &&
      (abilitiesAt(card, card.maxLevel).some((a) => a.split(':')[0] === name) ||
        card.stats.ptrOptions?.some((t) =>
          t.abilities?.some((a) => a.split(':')[0] === name),
        ) ||
        card.stats.racialSynergy?.some((s) =>
          s.abilities?.some((a) => a.split(':')[0] === name),
        )),
  )
  return (
    <>
      <Nav />
      <main className="catalogue-page">
        <Link href="/abilities" className="catalogue-back">
          ← All ability ratings
        </Link>
        <AbilityTooltipProvider>
          <header className="catalogue-header">
            <p className="catalogue-eyebrow">Ability strength · beta</p>
            <div className="ability-detail-title">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={info.icon} alt="" width={70} height={70} />
              <h1>{name}</h1>
            </div>
            <p>{info.description}</p>
            <div className="catalogue-header-links">
              <a href={info.source} target="_blank" rel="noreferrer">
                Official mechanic guide ↗
              </a>
              <Link href="/ratings/methodology">Rating methodology ↗</Link>
            </div>
          </header>
          <section className="card-section">
            <div className="card-section-heading">
              <h2>Published strength</h2>
              <span className="muted">
                {weight?.drawback ? 'Drawback' : 'Benefit'}
              </span>
            </div>
            <div className="catalogue-table-wrap">
              <table className="price-table">
                <thead>
                  <tr>
                    <th>Level cap</th>
                    <th>Modern</th>
                    <th>Wild</th>
                    <th>Matches (Modern / Wild)</th>
                    <th>Confidence (Modern / Wild)</th>
                  </tr>
                </thead>
                <tbody>
                  {LEAGUES.map((league) => {
                    const modern = ratings.find(
                        (r) => r.league === league && r.format === 'modern',
                      ),
                      wild = ratings.find(
                        (r) => r.league === league && r.format === 'wild',
                      )
                    return (
                      <tr key={league}>
                        <th scope="row">{LEAGUE_NAMES[league]}</th>
                        {[modern, wild].map((r, i) => (
                          <td key={i}>
                            {r ? (
                              <RatingBadge
                                score={r.score}
                                confidence={r.confidence}
                                battles={r.evidence.battles}
                              />
                            ) : (
                              '—'
                            )}
                          </td>
                        ))}
                        <td>
                          {modern?.evidence.battles ?? 0} /{' '}
                          {wild?.evidence.battles ?? 0}
                        </td>
                        <td>
                          {CONFIDENCE_LABELS[modern?.confidence ?? 'curated']} /{' '}
                          {CONFIDENCE_LABELS[wild?.confidence ?? 'curated']}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
          {weight && (
            <section className="card-section">
              <h2>Curated prior</h2>
              <p className="rating-note">
                Standard: {weight.standard.toFixed(1)} / 10 · Non-standard:{' '}
                {weight.nonStandard.toFixed(1)} / 10 · Multiplier:{' '}
                {weight.multiplier.toFixed(2)}× · Standard weight:{' '}
                {Math.round(standardWeight * 100)}%
              </p>
              <p className="rating-note">{weight.notes}</p>
              <p className="rating-note">
                These are published starting weights, not measured win rates.
                Sparse observations do not lower an ability to zero.
              </p>
            </section>
          )}
          <section className="card-section">
            <h2>Ability synergies</h2>
            {synergies.length ? (
              <div className="catalogue-table-wrap">
                <table className="price-table">
                  <thead>
                    <tr>
                      <th>Pairing</th>
                      <th>Strength</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {synergies.map((s) => {
                      const other = s.abilities.find((a) => a !== name)!
                      return (
                        <tr key={other}>
                          <th scope="row">
                            <Link href={`/ability/${cardSlug(other)}`}>
                              {other}
                            </Link>
                          </th>
                          <td>
                            {s.strength === -1
                              ? 'Negative'
                              : ['', 'Low', 'Medium', 'High'][s.strength]}
                          </td>
                          <td className="ability-description">{s.notes}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rating-note">
                No pairing is currently curated for this ability. This does not
                imply that no synergy exists.
              </p>
            )}
          </section>
          <section className="card-section">
            <h2>Cards with {name}</h2>
            <p className="rating-note">
              Intrinsic abilities, summoner tactics and bloodline grants at
              maximum level. Conditional grants may require a particular team.
            </p>
            <div className="ability-related-cards">
              {related.map((card) => (
                <Link
                  key={card.id}
                  prefetch={false}
                  href={`/card/${card.slug}`}
                >
                  {card.name}
                  <span className="muted">
                    {' '}
                    · {card.kind === 'summoner' ? 'Summoner' : 'Unit'}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </AbilityTooltipProvider>
      </main>
    </>
  )
}
