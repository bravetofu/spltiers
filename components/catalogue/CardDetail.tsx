'use client'

import Link from 'next/link'
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'
import { useSearchParams } from 'next/navigation'
import {
  abilitiesAt,
  editionName,
  FOILS,
  landAbilitiesAt,
  RARITIES,
  statAt,
  STAT_LABELS,
  type CatalogueCard,
  type StatKey,
} from '@/lib/splinterlands/catalogue'
import type { FoilPrice } from '@/lib/splinterlands/card-prices'
import { AbilityList } from './AbilityIcon'
import { StatEffects, SummonerTactics } from './CardEffects'
import CardArt from './CardArt'
import PriceHistoryChart from './PriceHistoryChart'
import AbilityTooltipProvider from './AbilityTooltipProvider'
import CardRatings from '@/components/ratings/CardRatings'
import type { CardRating } from '@/lib/ratings/types'
import type { CardBattleStats } from '@/lib/ratings/battle-stats'

type Prices = {
  source: string
  prices: FoilPrice[]
  floorUsd?: number
  fetchedAt: string
}
const STATS: StatKey[] = [
  'mana',
  'speed',
  'attack',
  'ranged',
  'magic',
  'armor',
  'health',
]
const money = (value: number | null) =>
  value === null ? '—' : usd.format(value)
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 6,
})

export default function CardDetail({
  card,
  ratingData,
}: {
  card: CatalogueCard
  ratingData: {
    ratings: CardRating[]
    version?: string
    scoredAt?: string
    battleStats?: CardBattleStats[] | null
  }
}) {
  const [edition, setEdition] = useState(card.editions[0])
  const [editionReady, setEditionReady] = useState(false)
  const syncEdition = useCallback((value: number) => {
    setEdition(value)
    setEditionReady(true)
  }, [])
  const [foil, setFoil] = useState(0)
  const [prices, setPrices] = useState<Prices | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const mintedFoils = card.foils[edition] ?? [0]
  const availableFoils = FOILS.filter(
    (entry) => mintedFoils.includes(entry.id) || entry.id === 0,
  )
  const displayedFoil = availableFoils.some((entry) => entry.id === foil)
    ? foil
    : 0
  useEffect(() => {
    if (!editionReady) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setPrices(null)
    fetch(
      `/api/cards/${card.id}/prices?edition=${edition}${refresh ? `&refresh=${refresh}` : ''}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Could not load prices')
        if (!controller.signal.aborted) setPrices(data)
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [card.id, edition, editionReady, refresh])
  const allAbilities = abilitiesAt(card, card.maxLevel)
  const landAbilities = landAbilitiesAt(card, card.maxLevel)
  return (
    <AbilityTooltipProvider>
      <Suspense fallback={null}>
        <EditionFromUrl editions={card.editions} onChange={syncEdition} />
      </Suspense>
      <Link href={`/cards?kind=${card.kind}`} className="catalogue-back">
        ← All{' '}
        {card.kind === 'unit'
          ? 'units'
          : card.kind === 'land'
            ? 'land cards'
            : 'summoners'}
      </Link>
      <header className="card-overview">
        <div className="card-heading-copy">
          <p className="catalogue-eyebrow">
            {card.kind === 'unit'
              ? 'Unit'
              : card.kind === 'land'
                ? 'Land Card'
                : 'Summoner'}{' '}
            <span>·</span> {RARITIES[card.rarity - 1]}
            {card.preview ? ' · Preview' : ''}
          </p>
          <h1>{card.name}</h1>
          <div className="card-meta">
            <span>{card.splinters.join(' / ')}</span>
            <span>{card.bloodline}</span>
            <span>
              {card.kind === 'land'
                ? 'Land only'
                : card.modern
                  ? 'Modern'
                  : 'Wild-exclusive'}
            </span>
          </div>
        </div>
        <div className="detail-edition">
          <span className="detail-edition-label">Edition</span>
          {card.editions.length === 1 ? (
            <p>{editionName(edition)}</p>
          ) : (
            <div className="edition-options" role="group" aria-label="Edition">
              {card.editions.map((id) => (
                <button
                  key={id}
                  aria-pressed={edition === id}
                  onClick={() => {
                    setEdition(id)
                    window.history.replaceState(
                      null,
                      '',
                      `/card/${card.slug}?edition=${id}`,
                    )
                  }}
                >
                  {editionName(id)}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      <div className="card-detail-hero">
        <section className="card-art-panel" aria-label="Card artwork">
          <CardArt
            key={`${edition}-${displayedFoil}`}
            card={card}
            edition={edition}
            foil={displayedFoil}
          />
          <div className="foil-options" role="group" aria-label="Artwork foil">
            {availableFoils.map((entry) => (
              <button
                key={entry.id}
                aria-pressed={displayedFoil === entry.id}
                onClick={() => setFoil(entry.id)}
                style={{ '--foil-color': entry.color } as React.CSSProperties}
              >
                {entry.name}
              </button>
            ))}
          </div>
        </section>
        <PriceHistoryChart
          cardId={card.id}
          edition={edition}
          foil={displayedFoil}
          ready={editionReady}
        />
      </div>
      <div className="card-mechanics">
        {card.kind === 'summoner' && (
          <section className="card-detail-section">
            <h2>Stat effects</h2>
            <StatEffects card={card} level={card.maxLevel} />
          </section>
        )}
        <section className="card-detail-section">
          <h2>
            {card.kind === 'land'
              ? 'Land abilities at maximum level'
              : 'Abilities at maximum level'}
          </h2>
          <AbilityList
            abilities={card.kind === 'land' ? landAbilities : allAbilities}
            labels
          />
          {!!card.stats.racialSynergy?.length && (
            <div className="bloodline-detail">
              {card.stats.racialSynergy.map((synergy) => (
                <div key={synergy.race}>
                  <h3>Bloodline Dominion · {synergy.race}</h3>
                  <AbilityList abilities={synergy.abilities ?? []} labels />
                </div>
              ))}
            </div>
          )}
        </section>
        {card.kind !== 'land' && !!landAbilities.length && (
          <section className="card-detail-section">
            <h2>Land abilities</h2>
            <AbilityList abilities={landAbilities} labels />
          </section>
        )}
        {card.kind === 'summoner' && !!card.stats.ptrOptions?.length && (
          <section className="card-detail-section">
            <h2>Tactics</h2>
            <p className="muted">Choose one option before battle.</p>
            <SummonerTactics card={card} full />
          </section>
        )}
      </div>
      <section className="card-section" aria-label="Live market prices">
        <div className="card-section-heading">
          <div>
            <p className="catalogue-eyebrow">Live market</p>
            <h2>{editionName(edition)} prices</h2>
          </div>
          <button
            className="catalogue-button"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            {loading ? 'Loading prices…' : 'Refresh prices'}
          </button>
        </div>
        {error ? (
          <div className="catalogue-notice" role="alert">
            {error}{' '}
            <button onClick={() => setRefresh((value) => value + 1)}>
              Retry
            </button>
          </div>
        ) : prices?.source === 'OpenSea' ? (
          <div className="runi-price">
            <strong>{money(prices.floorUsd ?? null)}</strong>
            <p>
              Collection floor on OpenSea. Runi is an individual Ethereum NFT;
              BCX and foil-specific listings do not apply.
            </p>
          </div>
        ) : (
          <div className="catalogue-table-wrap">
            <table className="price-table">
              <thead>
                <tr>
                  <th scope="col">Foil</th>
                  <th scope="col">Lowest / BCX</th>
                  <th scope="col">Single 1-BCX copy</th>
                  <th scope="col">Listings</th>
                </tr>
              </thead>
              <tbody>
                {FOILS.map((entry) => {
                  const price = prices?.prices.find(
                    (row) => row.foil === entry.id,
                  )
                  return (
                    <tr key={entry.id}>
                      <th scope="row" style={{ color: entry.color }}>
                        {entry.name}
                      </th>
                      <td>{loading ? '…' : money(price?.perBcx ?? null)}</td>
                      <td>{loading ? '…' : money(price?.singleBcx ?? null)}</td>
                      <td>{loading ? '…' : (price?.listings ?? 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="market-explainer">
          USD asking prices for this edition. Lowest / BCX includes combined
          listings; single-copy price requires exactly 1 BCX. A dash means no
          qualifying listing. Special foils may only exist as max-level copies.
        </p>
        {prices && (
          <p className="market-updated">
            Source: {prices.source} · Updated{' '}
            {new Date(prices.fetchedAt).toLocaleTimeString()} ·{' '}
            <a
              href={
                card.id === 505
                  ? 'https://opensea.io/collection/runi'
                  : `https://splinterlands.com/?p=card_details&id=${card.id}&edition=${edition}&tab=market`
              }
              target="_blank"
              rel="noreferrer"
            >
              View market ↗
            </a>
          </p>
        )}
      </section>
      <CardRatings card={card} {...ratingData} />
      <section className="card-section">
        <div className="card-section-heading">
          <div>
            <p className="catalogue-eyebrow">Progression</p>
            <h2>
              {card.kind === 'land' ? 'Land abilities' : 'Stats'} at every level
            </h2>
          </div>
          <span className="muted">Level 1–{card.maxLevel}</span>
        </div>
        <div className="catalogue-table-wrap">
          <table className="level-table">
            <thead>
              <tr>
                <th scope="col">Level</th>
                {card.kind !== 'land' &&
                  STATS.map((key) => (
                    <th scope="col" key={key}>
                      {STAT_LABELS[key]}
                    </th>
                  ))}
                <th scope="col">
                  {card.kind === 'land'
                    ? 'Land abilities'
                    : 'Unlocked abilities'}
                </th>
                {card.kind !== 'land' && !!landAbilities.length && (
                  <th scope="col">Land abilities</th>
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from(
                { length: card.maxLevel },
                (_, index) => index + 1,
              ).map((level) => (
                <tr key={level}>
                  <th scope="row">{level}</th>
                  {card.kind !== 'land' &&
                    STATS.map((key) => (
                      <td key={key} className={`stat-${key}`}>
                        {statAt(card, key, level) ?? '—'}
                      </td>
                    ))}
                  <td>
                    <AbilityList
                      abilities={
                        card.kind === 'land'
                          ? landAbilitiesAt(card, level)
                          : abilitiesAt(card, level)
                      }
                      labels
                    />
                  </td>
                  {card.kind !== 'land' && !!landAbilities.length && (
                    <td>
                      <AbilityList
                        abilities={landAbilitiesAt(card, level)}
                        labels
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {card.kind === 'summoner' && (
          <p className="market-explainer">
            Summoner values are signed effects on units, rather than the
            summoner’s own combat stats. Its abilities and tactics apply at
            every level.
          </p>
        )}
      </section>
      <p className="catalogue-credit">
        Card artwork and game data © Splinterlands. Ability summaries link to
        the official support guides.
      </p>
    </AbilityTooltipProvider>
  )
}

// Keep query-string personalization in this small boundary so the full card
// page can be pre-rendered and cached, including its artwork and level table.
function EditionFromUrl({
  editions,
  onChange,
}: {
  editions: number[]
  onChange: (edition: number) => void
}) {
  const params = useSearchParams()
  const value = params.get('edition')
  const edition =
    value !== null && editions.includes(Number(value))
      ? Number(value)
      : editions[0]
  useLayoutEffect(() => onChange(edition), [edition, onChange])
  return null
}
