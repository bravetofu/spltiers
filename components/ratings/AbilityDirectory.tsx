'use client'
import Link from 'next/link'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { cardSlug } from '@/lib/splinterlands/catalogue'
import { abilityInfo } from '@/lib/splinterlands/abilities'
import {
  LEAGUES,
  LEAGUE_NAMES,
  type AbilitySummary,
  type AbilityWeight,
  type BattleFormat,
  type League,
} from '@/lib/ratings/types'
import AbilityIcon from '@/components/catalogue/AbilityIcon'
import RatingBadge, { CONFIDENCE_LABELS } from './RatingBadge'

type Weights = Record<
  string,
  Pick<AbilityWeight, 'standard' | 'nonStandard' | 'multiplier' | 'drawback'>
>
export default function AbilityDirectory({
  initial,
  weights,
}: {
  initial: AbilitySummary[]
  weights: Weights
}) {
  const params = useSearchParams()
  const league = LEAGUES.includes(params.get('league') as League)
    ? (params.get('league') as League)
    : 'diamond'
  const format: BattleFormat =
    params.get('format') === 'wild' ? 'wild' : 'modern'
  const key = `${league}:${format}`
  const [result, setResult] = useState<{
    key: string
    items: AbilitySummary[]
    error?: string
  }>({ key: 'diamond:modern', items: initial })
  const [q, setQ] = useState(''),
    [page, setPage] = useState(1)
  const [order, setOrder] = useState<'score' | 'name'>('score')
  const query = useDeferredValue(q.toLowerCase().trim())
  useEffect(() => {
    if (key === 'diamond:modern') {
      setResult({ key, items: initial })
      return
    }
    const abort = new AbortController()
    fetch(`/api/ratings?kind=ability&view=summary&league=${league}&format=${format}`, {
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Ability ratings temporarily unavailable')
        return response.json()
      })
      .then((data) => {
        if (!abort.signal.aborted) setResult({ key, items: data.items })
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setResult({ key, items: [], error: error.message })
      })
    return () => abort.abort()
  }, [key, league, format, initial])
  const rows = useMemo(
    () =>
      result.key === key
        ? result.items
            .filter(
              (row) =>
                !query ||
                row.name.toLowerCase().includes(query) ||
                abilityInfo(row.name).description.toLowerCase().includes(query),
            )
            .sort((a, b) =>
              order === 'name'
                ? a.name.localeCompare(b.name)
                : b.score - a.score || a.name.localeCompare(b.name),
            )
        : [],
    [result, key, query, order],
  )
  const pages = Math.max(1, Math.ceil(rows.length / 50)),
    current = Math.min(page, pages)
  function scope(field: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(field, value)
    window.history.replaceState(null, '', `/abilities?${next}`)
    setPage(1)
  }
  return (
    <>
      <div className="ability-directory-filters">
        <label className="catalogue-filter catalogue-search">
          <span>Search abilities</span>
          <input
            aria-label="Search abilities"
            type="search"
            placeholder="Name or mechanic…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
        </label>
        <label className="catalogue-filter">
          <span>Rating format</span>
          <select
            aria-label="Ability rating format"
            value={format}
            onChange={(e) => scope('format', e.target.value)}
          >
            <option value="modern">Modern</option>
            <option value="wild">Wild</option>
          </select>
        </label>
        <label className="catalogue-filter">
          <span>Level</span>
          <select
            aria-label="Ability rating level"
            value={league}
            onChange={(e) => scope('league', e.target.value)}
          >
            {LEAGUES.map((l) => (
              <option key={l} value={l}>
                {LEAGUE_NAMES[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="catalogue-filter">
          <span>Sort</span>
          <select
            aria-label="Sort abilities"
            value={order}
            onChange={(e) => {
              setOrder(e.target.value as 'score' | 'name')
              setPage(1)
            }}
          >
            <option value="score">Strongest first</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>
      <p className="rating-note" role="status">
        {result.key !== key
          ? 'Loading ability ratings…'
          : (result.error ??
            `${rows.length} abilities · ${LEAGUE_NAMES[league]} · ${format === 'modern' ? 'Modern' : 'Wild'}. Published priors remain visible when battle evidence is limited.`)}
      </p>
      <div className="catalogue-table-wrap" aria-busy={result.key !== key}>
        <table className="price-table ability-rating-table">
          <thead>
            <tr>
              <th scope="col">Ability</th>
              <th scope="col">Rating</th>
              <th scope="col">Standard prior</th>
              <th scope="col">Non-standard prior</th>
              <th scope="col">Matches</th>
              <th scope="col">Confidence</th>
              <th scope="col">Mechanic</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((current - 1) * 50, current * 50).map((row) => (
              <tr key={row.name}>
                <th scope="row">
                  <div className="ability-name-link">
                    <AbilityIcon ability={row.name} />
                    <Link
                      prefetch={false}
                      href={`/ability/${cardSlug(row.name)}`}
                    >
                      {row.name}
                    </Link>
                  </div>
                  {weights[row.name]?.drawback && (
                    <span className="ability-status">Drawback</span>
                  )}
                </th>
                <td>
                  <RatingBadge
                    score={row.score}
                    confidence={row.confidence}
                    battles={row.evidence.battles}
                  />
                </td>
                <td>{weights[row.name]?.standard.toFixed(1)} / 10</td>
                <td>{weights[row.name]?.nonStandard.toFixed(1)} / 10</td>
                <td>{row.evidence.battles}</td>
                <td>{CONFIDENCE_LABELS[row.confidence]}</td>
                <td className="ability-description">
                  {abilityInfo(row.name).description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.key === key && !rows.length && !result.error && (
          <div className="catalogue-empty">No abilities match your search.</div>
        )}
      </div>
      {pages > 1 && (
        <nav className="catalogue-pagination" aria-label="Ability table pages">
          <button disabled={current === 1} onClick={() => setPage(current - 1)}>
            ← Previous
          </button>
          <span>
            Page {current} of {pages}
          </span>
          <button
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Next →
          </button>
        </nav>
      )}
    </>
  )
}
