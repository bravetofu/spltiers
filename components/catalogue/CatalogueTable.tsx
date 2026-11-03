'use client'

import Link from 'next/link'
import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  abilitiesAt,
  cardInTab,
  editionName,
  filterCards,
  landAbilitiesAt,
  levelForLeague,
  parseCatalogueFilters,
  RARITIES,
  SPLINTERS,
  statAt,
  STAT_LABELS,
  type CardKind,
  type CatalogueCard,
  type CatalogueFilters,
  type StatKey,
} from '@/lib/splinterlands/catalogue'
import { AbilityList } from './AbilityIcon'
import CardArt from './CardArt'
import { StatEffects, SummonerTactics } from './CardEffects'
import RatingBadge from '@/components/ratings/RatingBadge'
import { useRatingIndex } from '@/components/ratings/useRatingIndex'
import type { ScoreIndex } from '@/lib/ratings/server'
import {
  LEAGUE_NAMES,
  type BattleFormat,
  type League,
} from '@/lib/ratings/types'
import { cardWinRate, formatWinRate } from '@/lib/ratings/battle-stats'

const TABS: { kind: CardKind; label: string }[] = [
  { kind: 'unit', label: 'Units' },
  { kind: 'summoner', label: 'Summoners' },
  { kind: 'land', label: 'Land Cards' },
]
const STATS: StatKey[] = [
  'mana',
  'speed',
  'attack',
  'ranged',
  'magic',
  'armor',
  'health',
]
const BATTLE_COLUMNS = [
  ['uses', 'Uses'],
  ['wins', 'Wins'],
  ['losses', 'Losses'],
  ['winRate', 'Win rate'],
] as const
const PAGE_SIZE = 50
const DEFAULTS: CatalogueFilters = {
  kind: 'unit',
  q: '',
  splinter: '',
  rarity: '',
  format: '',
  edition: '',
  league: 'diamond',
  bloodline: '',
}

export default function CatalogueTable({
  cards,
  initialRatings,
}: {
  cards: CatalogueCard[]
  initialRatings: ScoreIndex
}) {
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const [filters, setFilters] = useState<CatalogueFilters>(() =>
    parseCatalogueFilters(Object.fromEntries(searchParams)),
  )
  const deferredFilters = useDeferredValue(filters)
  const ratings = useRatingIndex(
    initialRatings,
    deferredFilters.league as League,
    (deferredFilters.format || 'auto') as BattleFormat | 'auto',
  )
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState(filters.kind === 'land' ? 'name' : 'uses')
  const [direction, setDirection] = useState(filters.kind === 'land' ? 1 : -1)
  useEffect(() => {
    const next = parseCatalogueFilters(
      Object.fromEntries(new URLSearchParams(query)),
    )
    setFilters((current) =>
      Object.keys(next).every(
        (key) =>
          current[key as keyof CatalogueFilters] ===
          next[key as keyof CatalogueFilters],
      )
        ? current
        : next,
    )
    setPage(1)
  }, [query])
  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map(({ kind }) => [
          kind,
          cards.filter((card) => cardInTab(card, kind)).length,
        ]),
      ),
    [cards],
  )
  const bloodlines = useMemo(
    () => Array.from(new Set(cards.map((card) => card.bloodline))).sort(),
    [cards],
  )
  const editions = useMemo(
    () =>
      Array.from(new Set(cards.flatMap((card) => card.editions))).sort(
        (a, b) => a - b,
      ),
    [cards],
  )
  const rows = useMemo(() => {
    const value = (card: CatalogueCard) => {
      const rating = ratings.scores[card.id]
      const usage = rating?.[4]
      if (sort === 'rating') return rating?.[0] ?? -1
      if (sort === 'winRate') return usage ? (cardWinRate(usage) ?? -1) : -1
      if (sort === 'uses' || sort === 'wins' || sort === 'losses')
        return usage?.[sort] ?? -1
      if (sort === 'name') return card.name
      if (sort === 'rarity') return card.rarity
      return (
        statAt(
          card,
          sort as StatKey,
          levelForLeague(card, deferredFilters.league),
        ) ?? 0
      )
    }
    return filterCards(cards, deferredFilters).sort((a, b) => {
      const av = value(a),
        bv = value(b)
      return (
        direction *
          (typeof av === 'string' && typeof bv === 'string'
            ? av.localeCompare(bv)
            : Number(av) - Number(bv)) || a.name.localeCompare(b.name)
      )
    })
  }, [cards, deferredFilters, sort, direction, ratings.scores])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const cardsWithUses = rows.filter(
    (card) => (ratings.scores[card.id]?.[4]?.uses ?? 0) > 0,
  ).length
  const currentPage = Math.min(page, pages)
  function update(changes: Partial<CatalogueFilters>) {
    const next = { ...filters, ...changes }
    setFilters(next)
    setPage(1)
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(next))
      if (value && value !== DEFAULTS[key as keyof CatalogueFilters])
        params.set(key, value)
    window.history.replaceState(
      null,
      '',
      `/cards${params.size ? `?${params}` : ''}`,
    )
  }
  function sortBy(key: string) {
    setSort(key)
    setDirection(
      sort === key
        ? -direction
        : key === 'rating' || BATTLE_COLUMNS.some(([column]) => column === key)
          ? -1
          : 1,
    )
    setPage(1)
  }
  const select = (
    label: string,
    key: keyof CatalogueFilters,
    options: { value: string; label: string }[],
    disabled = false,
  ) => (
    <label className="catalogue-filter" key={key}>
      <span>{label}</span>
      <select
        aria-label={label}
        value={filters[key]}
        disabled={disabled}
        onChange={(event) => update({ [key]: event.target.value })}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
  const heading = (key: string, label: string) => (
    <th
      scope="col"
      key={key}
      aria-sort={
        sort === key ? (direction === 1 ? 'ascending' : 'descending') : 'none'
      }
    >
      <button onClick={() => sortBy(key)}>
        {label}{' '}
        <span aria-hidden>
          {sort === key ? (direction === 1 ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
  return (
    <>
      <div className="catalogue-tabs" role="tablist" aria-label="Card type">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            role="tab"
            aria-selected={filters.kind === tab.kind}
            id={`tab-${tab.kind}`}
            aria-controls="catalogue-panel"
            tabIndex={filters.kind === tab.kind ? 0 : -1}
            onKeyDown={(event) => {
              if (
                !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
              )
                return
              event.preventDefault()
              const index = TABS.findIndex((item) => item.kind === tab.kind)
              const next =
                TABS[
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? 2
                      : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3
                ]
              setSort(next.kind === 'land' ? 'name' : 'uses')
              setDirection(next.kind === 'land' ? 1 : -1)
              update({
                kind: next.kind,
                ...(next.kind === 'land' ? { format: '' } : {}),
              })
              document.getElementById(`tab-${next.kind}`)?.focus()
            }}
            onClick={() => {
              setSort(tab.kind === 'land' ? 'name' : 'uses')
              setDirection(tab.kind === 'land' ? 1 : -1)
              update({
                kind: tab.kind,
                ...(tab.kind === 'land' ? { format: '' } : {}),
              })
            }}
          >
            {tab.label}
            <span>{tabCounts[tab.kind]}</span>
          </button>
        ))}
      </div>
      <div className="catalogue-filters">
        <label className="catalogue-filter catalogue-search">
          <span>Search cards</span>
          <input
            type="search"
            placeholder="Find a card by name…"
            value={filters.q}
            onChange={(event) => update({ q: event.target.value })}
          />
        </label>
        {select('Splinter', 'splinter', [
          { value: '', label: 'All splinters' },
          ...Object.values(SPLINTERS).map((name) => ({
            value: name,
            label: name,
          })),
        ])}
        {select('Rarity', 'rarity', [
          { value: '', label: 'All rarities' },
          ...RARITIES.map((name, index) => ({
            value: String(index + 1),
            label: name,
          })),
        ])}
        {select(
          'Format',
          'format',
          [
            {
              value: '',
              label:
                filters.kind === 'land' ? 'Not a battle card' : 'All formats',
            },
            { value: 'modern', label: 'Modern' },
            { value: 'wild', label: 'Wild-exclusive' },
          ],
          filters.kind === 'land',
        )}
        {select('Edition', 'edition', [
          { value: '', label: 'All editions' },
          ...editions.map((id) => ({
            value: String(id),
            label: editionName(id),
          })),
        ])}
        {select('Level', 'league', [
          { value: 'bronze', label: 'Bronze' },
          { value: 'silver', label: 'Silver' },
          { value: 'gold', label: 'Gold' },
          { value: 'diamond', label: 'Diamond / Champion' },
        ])}
        {select('Bloodline', 'bloodline', [
          { value: '', label: 'All bloodlines' },
          ...bloodlines.map((name) => ({ value: name, label: name })),
        ])}
        <button
          className="catalogue-reset"
          onClick={() => {
            update({ ...DEFAULTS, kind: filters.kind })
            setSort(filters.kind === 'land' ? 'name' : 'uses')
            setDirection(filters.kind === 'land' ? 1 : -1)
          }}
        >
          Reset filters
        </button>
      </div>
      <div className="catalogue-results">
        <p aria-live="polite">
          <strong>{rows.length}</strong>{' '}
          {deferredFilters.kind === 'unit'
            ? 'units'
            : deferredFilters.kind === 'land'
              ? 'land cards'
              : 'summoners'}
          {rows.length > PAGE_SIZE
            ? ` · showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, rows.length)}`
            : ''}
        </p>
        <span className="muted">
          {deferredFilters.kind === 'land'
            ? 'Land abilities at the selected level'
            : 'Stats and unlocked abilities at each rarity’s league cap'}
        </span>
      </div>
      {deferredFilters.kind !== 'land' &&
        !ratings.loading &&
        !ratings.error && (
          <div className="catalogue-battle-coverage" role="status">
            <p>
              {cardsWithUses
                ? `${cardsWithUses.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')} matching cards have recorded uses at ${LEAGUE_NAMES[deferredFilters.league as League]} caps.`
                : `No collected battle uses match these filters at ${LEAGUE_NAMES[deferredFilters.league as League]} caps yet. Zero uses means no recorded sample.`}
            </p>
            {cardsWithUses > 0 && (
              <button
                type="button"
                className="catalogue-button"
                onClick={() => {
                  setSort('uses')
                  setDirection(-1)
                  setPage(1)
                }}
              >
                Show most-used cards
              </button>
            )}
          </div>
        )}
      <div
        role="tabpanel"
        id="catalogue-panel"
        aria-labelledby={`tab-${deferredFilters.kind}`}
        className="catalogue-table-wrap"
        aria-busy={filters !== deferredFilters || ratings.loading}
        tabIndex={0}
      >
        <table className={`catalogue-table table-${deferredFilters.kind}`}>
          <caption className="sr-only">
            {deferredFilters.kind === 'unit'
              ? 'Unit combat statistics'
              : deferredFilters.kind === 'summoner'
                ? 'Summoner effects and tactics'
                : 'Land card abilities'}
          </caption>
          <thead>
            <tr>
              {heading('name', 'Card')}
              {deferredFilters.kind !== 'land' && (
                <>
                  {heading('rating', 'Rating')}
                  {BATTLE_COLUMNS.map(([key, label]) => heading(key, label))}
                </>
              )}
              <th scope="col">Splinter</th>
              {heading('rarity', 'Rarity')}
              <th scope="col">Edition</th>
              <th scope="col">Bloodline</th>
              <th scope="col">Level</th>
              {deferredFilters.kind === 'unit' &&
                STATS.map((key) => heading(key, STAT_LABELS[key]))}
              {deferredFilters.kind === 'summoner' && (
                <>
                  {heading('mana', 'Mana')}
                  <th scope="col">Stat effects</th>
                </>
              )}
              <th scope="col">
                {deferredFilters.kind === 'land'
                  ? 'Land abilities'
                  : 'Abilities'}
              </th>
              {deferredFilters.kind === 'summoner' && (
                <th scope="col">Tactics</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
              .map((card) => (
                <CatalogueRow
                  key={card.id}
                  card={card}
                  kind={deferredFilters.kind}
                  league={deferredFilters.league}
                  editionFilter={deferredFilters.edition}
                  rating={ratings.scores[card.id]}
                />
              ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="catalogue-empty">
            <h2>No cards match these filters</h2>
            <p>Try another combination or reset the filters.</p>
            <button
              className="catalogue-button"
              onClick={() =>
                update({ ...DEFAULTS, kind: deferredFilters.kind })
              }
            >
              Reset filters
            </button>
          </div>
        )}
      </div>
      {deferredFilters.kind !== 'land' && (
        <p className="rating-note">
          {ratings.error ??
            (ratings.loading
              ? 'Loading ratings…'
              : 'Beta ratings at the selected level. ')}
          {!ratings.error &&
            !ratings.loading &&
            (deferredFilters.format
              ? `${deferredFilters.format === 'modern' ? 'Modern' : 'Wild'} battle context. `
              : 'Modern context for Modern cards; Wild context for Wild-exclusive cards. ')}
          Uses, wins and losses cover the lifetime collected ranked sample at
          the selected league cap, including underlevelled cards. One use per
          team; mirror matches count twice. Win rate = wins ÷ uses, with draws
          included in uses. These totals update after collection; rating
          evidence is filtered separately.{' '}
          <Link href="/ratings/methodology">
            Scores and confidence explained ↗
          </Link>
        </p>
      )}
      {pages > 1 && (
        <nav className="catalogue-pagination" aria-label="Card table pages">
          <button
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            ← Previous
          </button>
          <span>
            Page {currentPage} of {pages}
          </span>
          <button
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next →
          </button>
        </nav>
      )}
    </>
  )
}

const CatalogueRow = memo(function CatalogueRow({
  card,
  kind,
  league,
  editionFilter,
  rating,
}: {
  card: CatalogueCard
  kind: CardKind
  league: string
  editionFilter: string
  rating?: ScoreIndex[string]
}) {
  const level = levelForLeague(card, league)
  const edition = editionFilter ? Number(editionFilter) : card.editions[0]
  return (
    <tr>
      <th scope="row">
        <Link
          prefetch={false}
          href={`/card/${card.slug}${editionFilter ? `?edition=${editionFilter}` : ''}`}
          className="catalogue-card-name"
        >
          <CardArt
            key={`${card.id}-${edition}`}
            card={card}
            edition={edition}
            compact
          />
          <span>
            {card.name}
            {card.preview && <small className="preview-badge">Preview</small>}
          </span>
        </Link>
      </th>
      {kind !== 'land' && (
        <>
          <td>
            {rating ? (
              <RatingBadge
                score={rating[0]}
                confidence={rating[1]}
                battles={rating[2]}
              />
            ) : (
              <span className="muted">—</span>
            )}
          </td>
          {(['uses', 'wins', 'losses'] as const).map((key) => (
            <td className="number-cell" key={key}>
              {rating?.[4] ? rating[4][key].toLocaleString('en-US') : '—'}
            </td>
          ))}
          <td
            className="number-cell battle-win-rate"
            title={
              rating?.[4]
                ? `${rating[4].wins} wins, ${rating[4].losses} losses, ${rating[4].draws} draws in ${rating[4].uses} uses`
                : 'Battle results unavailable'
            }
          >
            {rating?.[4] ? formatWinRate(rating[4]) : '—'}
          </td>
        </>
      )}
      <td>
        <div className="splinter-badges">
          {card.splinters.map((name) => (
            <span key={name} className={`splinter-${name.toLowerCase()}`}>
              {name}
            </span>
          ))}
        </div>
      </td>
      <td>
        <span className={`rarity rarity-${card.rarity}`}>
          {RARITIES[card.rarity - 1]}
        </span>
      </td>
      <td className="edition-cell">
        {card.editions.map(editionName).join(' / ')}
      </td>
      <td>{card.bloodline}</td>
      <td className="number-cell">{level}</td>
      {kind === 'unit' &&
        STATS.map((key) => (
          <td key={key} className={`number-cell stat-${key}`}>
            {statAt(card, key, level) ?? '—'}
          </td>
        ))}
      {kind === 'summoner' && (
        <>
          <td className="number-cell">{statAt(card, 'mana', level)}</td>
          <td>
            <StatEffects card={card} level={level} />
          </td>
        </>
      )}
      <td>
        <AbilityList
          abilities={
            kind === 'land'
              ? landAbilitiesAt(card, level)
              : abilitiesAt(card, level)
          }
          labels={kind === 'land'}
        />
        {!!card.stats.racialSynergy?.length && (
          <div className="bloodline-synergy">
            {card.stats.racialSynergy.map((synergy) => (
              <div key={synergy.race}>
                {synergy.race}
                <AbilityList abilities={synergy.abilities ?? []} />
              </div>
            ))}
          </div>
        )}
      </td>
      {kind === 'summoner' && (
        <td>
          <SummonerTactics card={card} />
        </td>
      )}
    </tr>
  )
})
