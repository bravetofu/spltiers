'use client'
import { useDeferredValue, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { STAT_LABELS, type StatKey } from '@/lib/splinterlands/catalogue'
import {
  SUMMONER_WEIGHTS,
  LEAGUES,
  LEAGUE_NAMES,
  type AbilityWeight,
  type RatingProfile,
} from '@/lib/ratings/types'
import RatingBadge from './RatingBadge'

type CardChoice = { id: number; name: string }
function CardPicker({
  value,
  cards,
  onChange,
  label,
}: {
  value: number
  cards: CardChoice[]
  onChange: (id: number) => void
  label: string
}) {
  const name = cards.find((card) => card.id === value)?.name ?? String(value)
  const [text, setText] = useState(name)
  return (
    <input
      aria-label={label}
      list="rating-card-options"
      value={text}
      onChange={(event) => {
        setText(event.target.value)
        const card = cards.find(
          (card) =>
            card.name === event.target.value ||
            String(card.id) === event.target.value,
        )
        if (card) onChange(card.id)
      }}
      onBlur={() => setText(name)}
    />
  )
}

type History = {
  id: string
  label: string
  notes: string
  author: string
  published_at: string
}
type Run = {
  id: string
  status: string
  message: string
  collected: number
  requests: number
  players: number
  started_at: string
  finished_at: string | null
}
type Preview = {
  cards: {
    cardId: number
    name: string
    score: number
    curated: number
    battles: number
    confidence: 'curated' | 'early' | 'moderate' | 'strong'
  }[]
  count: number
  abilities: number
  minimum: number
  median: number
  maximum: number
}
type Props = {
  initial: RatingProfile
  initialRevision: number
  profiles: History[]
  runs: Run[]
  counts: { battles: number; eligible: number; latest: string | null }
  cards: { id: number; name: string }[]
  historyConfigured: boolean
}
export default function RatingAdmin({
  initial,
  initialRevision,
  profiles,
  runs,
  counts,
  cards,
  historyConfigured,
}: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState(initial),
    [revision, setRevision] = useState(initialRevision),
    [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState('Abilities'),
    [query, setQuery] = useState(''),
    [abilityPage, setAbilityPage] = useState(1)
  const search = useDeferredValue(query.toLowerCase())
  const [busy, setBusy] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState('')
  const [label, setLabel] = useState(''),
    [notes, setNotes] = useState(''),
    [preview, setPreview] = useState<Preview | null>(null)
  const [players, setPlayers] = useState(''),
    [replayIds, setReplayIds] = useState('')
  const names = Object.keys(draft.abilities).sort(),
    filteredNames = names.filter((name) => name.toLowerCase().includes(search))
  const pages = Math.max(1, Math.ceil(filteredNames.length / 20)),
    page = Math.min(abilityPage, pages)
  const number = (value: string) =>
    Number.isFinite(Number(value)) ? Number(value) : 0
  function change(next: RatingProfile) {
    setDraft(next)
    setDirty(true)
    setPreview(null)
    setMessage('')
  }
  function ability(name: string, patch: Partial<AbilityWeight>) {
    change({
      ...draft,
      abilities: {
        ...draft.abilities,
        [name]: { ...draft.abilities[name], ...patch },
      },
    })
  }
  async function action(name: string, body: Record<string, unknown> = {}) {
    setBusy(name)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/admin/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: name, ...body }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Operation failed')
      return data
    } catch (error) {
      setError((error as Error).message)
      return null
    } finally {
      setBusy('')
    }
  }
  async function save() {
    const data = await action('save', { config: draft, revision })
    if (data) {
      setRevision(data.revision)
      setDirty(false)
      setMessage('Draft saved. Public ratings are unchanged.')
    }
  }
  async function publish() {
    const data = await action('publish', { revision, label, notes })
    if (data) {
      setRevision(data.revision)
      setMessage('Published. The new profile and score snapshot are live.')
      setLabel('')
      setNotes('')
      router.refresh()
    }
  }
  const abilitySelect = (
    value: string,
    onChange: (value: string) => void,
    aria: string,
  ) => (
    <input
      aria-label={aria}
      list="rating-ability-options"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
  return (
    <>
      <datalist id="rating-ability-options">
        {names.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <div className="rating-admin-toolbar">
        <span>
          Draft revision {revision} · {dirty ? 'Unsaved changes' : 'Saved'} ·{' '}
          {profiles.length} published version{profiles.length === 1 ? '' : 's'}
        </span>
        <div>
          <button
            className="catalogue-button"
            disabled={!!busy || !dirty}
            onClick={save}
          >
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>
          <button
            className="catalogue-button"
            disabled={!!busy}
            onClick={async () => {
              const data = await action('preview', { config: draft })
              if (data) setPreview(data)
            }}
          >
            {busy === 'preview' ? 'Computing preview…' : 'Preview draft'}
          </button>
          <Link href="/ratings/methodology">Public methodology ↗</Link>
        </div>
      </div>
      {error && (
        <p className="catalogue-notice" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="rating-admin-success" role="status">
          {message}
        </p>
      )}
      <fieldset
        className="rating-admin-fields"
        disabled={['save', 'publish', 'restore'].includes(busy)}
      >
        <nav className="rating-admin-tabs" aria-label="Rating editor sections">
          {[
            'Abilities',
            'Synergies',
            'Stats & levels',
            'Card adjustments',
            'Publish & history',
            'Collector',
          ].map((name) => (
            <button
              key={name}
              aria-current={tab === name ? 'page' : undefined}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </nav>
        {tab === 'Abilities' && (
          <section>
            <h2>Ability priors</h2>
            <p className="rating-note">
              Scores are 0–10. Standard and non-standard priors are combined,
              multiplied, and adjusted for the selected league. Mark drawbacks
              so they penalize card value rather than adding a positive ability
              bonus.
            </p>
            <label className="catalogue-filter">
              <span>Find an ability</span>
              <input
                aria-label="Find an ability"
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setAbilityPage(1)
                }}
                placeholder="Search 124 abilities…"
              />
            </label>
            <div className="catalogue-table-wrap rating-admin-table">
              <table className="price-table">
                <thead>
                  <tr>
                    <th>Ability</th>
                    <th>Standard</th>
                    <th>Non-standard</th>
                    <th>Multiplier</th>
                    <th>Drawback</th>
                    <th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNames
                    .slice((page - 1) * 20, page * 20)
                    .map((name) => (
                      <tr key={name}>
                        <th scope="row">{name}</th>
                        <td>
                          <input
                            aria-label={`${name} standard`}
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={draft.abilities[name].standard}
                            onChange={(e) =>
                              ability(name, {
                                standard: number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`${name} non-standard`}
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={draft.abilities[name].nonStandard}
                            onChange={(e) =>
                              ability(name, {
                                nonStandard: number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`${name} multiplier`}
                            type="number"
                            min="0.25"
                            max="3"
                            step="0.05"
                            value={draft.abilities[name].multiplier}
                            onChange={(e) =>
                              ability(name, {
                                multiplier: number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`${name} is a drawback`}
                            type="checkbox"
                            checked={draft.abilities[name].drawback}
                            onChange={(e) =>
                              ability(name, { drawback: e.target.checked })
                            }
                          />
                        </td>
                        <td>
                          <textarea
                            aria-label={`${name} explanation`}
                            maxLength={1500}
                            value={draft.abilities[name].notes}
                            onChange={(e) =>
                              ability(name, { notes: e.target.value })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <nav
              className="catalogue-pagination"
              aria-label="Ability editor pages"
            >
              <button
                disabled={page === 1}
                onClick={() => setAbilityPage(page - 1)}
              >
                ← Previous
              </button>
              <span>
                Page {page} of {pages}
              </span>
              <button
                disabled={page === pages}
                onClick={() => setAbilityPage(page + 1)}
              >
                Next →
              </button>
            </nav>
          </section>
        )}
        {tab === 'Synergies' && (
          <section>
            <h2>Ability pairings</h2>
            <p className="rating-note">
              Low +0.15, Medium +0.35, High +0.65, Negative −0.5 model points.
              The combined positive pairing contribution is capped at two
              points. A pair can appear only once.
            </p>
            <div className="catalogue-table-wrap rating-admin-table">
              <table className="price-table">
                <thead>
                  <tr>
                    <th>First ability</th>
                    <th>Second ability</th>
                    <th>Strength</th>
                    <th>Reason</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draft.synergies.map((rule, i) => (
                    <tr key={i}>
                      <td>
                        {abilitySelect(
                          rule.abilities[0],
                          (v) =>
                            change({
                              ...draft,
                              synergies: draft.synergies.map((r, j) =>
                                j === i
                                  ? { ...r, abilities: [v, r.abilities[1]] }
                                  : r,
                              ),
                            }),
                          `Synergy ${i + 1} first ability`,
                        )}
                      </td>
                      <td>
                        {abilitySelect(
                          rule.abilities[1],
                          (v) =>
                            change({
                              ...draft,
                              synergies: draft.synergies.map((r, j) =>
                                j === i
                                  ? { ...r, abilities: [r.abilities[0], v] }
                                  : r,
                              ),
                            }),
                          `Synergy ${i + 1} second ability`,
                        )}
                      </td>
                      <td>
                        <select
                          aria-label={`Synergy ${i + 1} strength`}
                          value={rule.strength}
                          onChange={(e) =>
                            change({
                              ...draft,
                              synergies: draft.synergies.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      strength: Number(e.target.value) as
                                        | -1
                                        | 1
                                        | 2
                                        | 3,
                                    }
                                  : r,
                              ),
                            })
                          }
                        >
                          <option value={1}>Low</option>
                          <option value={2}>Medium</option>
                          <option value={3}>High</option>
                          <option value={-1}>Negative</option>
                        </select>
                      </td>
                      <td>
                        <textarea
                          aria-label={`Synergy ${i + 1} reason`}
                          maxLength={1500}
                          value={rule.notes}
                          onChange={(e) =>
                            change({
                              ...draft,
                              synergies: draft.synergies.map((r, j) =>
                                j === i ? { ...r, notes: e.target.value } : r,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="rating-remove"
                          aria-label={`Remove synergy ${i + 1}`}
                          onClick={() =>
                            change({
                              ...draft,
                              synergies: draft.synergies.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="catalogue-button"
              onClick={() =>
                change({
                  ...draft,
                  synergies: [
                    ...draft.synergies,
                    { abilities: [names[0], names[1]], strength: 1, notes: '' },
                  ],
                })
              }
            >
              Add ability synergy
            </button>
          </section>
        )}
        {tab === 'Stats & levels' && (
          <section>
            <h2>Stat and league weights</h2>
            <p className="rating-note">
              Mana is a penalty. Summoner buffs and debuffs use absolute
              magnitudes, multiplied by a team-effect factor. These are model
              points before calibration.
            </p>
            <div className="rating-admin-weight-grid">
              {(Object.keys(STAT_LABELS) as StatKey[]).map((stat) => (
                <label className="catalogue-filter" key={stat}>
                  <span>
                    {stat === 'mana' ? 'Mana penalty' : STAT_LABELS[stat]}
                  </span>
                  <input
                    aria-label={`${STAT_LABELS[stat]} stat weight`}
                    type="number"
                    min="0"
                    max="3"
                    step="0.05"
                    value={Math.abs(draft.statWeights[stat])}
                    onChange={(e) =>
                      change({
                        ...draft,
                        statWeights: {
                          ...draft.statWeights,
                          [stat]:
                            number(e.target.value) * (stat === 'mana' ? -1 : 1),
                        },
                      })
                    }
                  />
                </label>
              ))}
              <label className="catalogue-filter">
                <span>Standard ruleset share (0–1)</span>
                <input
                  aria-label="Standard ruleset share"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={draft.standardWeight}
                  onChange={(e) =>
                    change({ ...draft, standardWeight: number(e.target.value) })
                  }
                />
              </label>
            </div>
            <div className="catalogue-table-wrap rating-admin-table">
              <table className="price-table">
                <thead>
                  <tr>
                    <th>Level cap</th>
                    <th>Stat multiplier</th>
                    <th>Mana multiplier</th>
                    <th>Ability multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  {LEAGUES.map((league) => (
                    <tr key={league}>
                      <th scope="row">{LEAGUE_NAMES[league]}</th>
                      {(['stats', 'mana', 'abilities'] as const).map((key) => (
                        <td key={key}>
                          <input
                            aria-label={`${league} ${key} multiplier`}
                            type="number"
                            min="0.25"
                            max="3"
                            step="0.05"
                            value={draft.leagueMultipliers[league][key]}
                            onChange={(e) =>
                              change({
                                ...draft,
                                leagueMultipliers: {
                                  ...draft.leagueMultipliers,
                                  [league]: {
                                    ...draft.leagueMultipliers[league],
                                    [key]: number(e.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2>Summoner team effects</h2>
            <p className="rating-note">
              Team-wide effects need different weights from a unit’s own stats.
              The calibration center aligns summoner scores with the 0–10 scale;
              a lower center raises the resulting scores.
            </p>
            <div className="rating-admin-weight-grid">
              {(
                Object.keys(
                  SUMMONER_WEIGHTS,
                ) as (keyof typeof SUMMONER_WEIGHTS)[]
              ).map((stat) => (
                <label className="catalogue-filter" key={stat}>
                  <span>Team {STAT_LABELS[stat]}</span>
                  <input
                    aria-label={`Summoner ${STAT_LABELS[stat]} weight`}
                    type="number"
                    min="0"
                    max="3"
                    step="0.05"
                    value={(draft.summonerWeights ?? SUMMONER_WEIGHTS)[stat]}
                    onChange={(e) =>
                      change({
                        ...draft,
                        summonerWeights: {
                          ...(draft.summonerWeights ?? SUMMONER_WEIGHTS),
                          [stat]: number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
              <label className="catalogue-filter">
                <span>Team ability factor</span>
                <input
                  aria-label="Summoner ability factor"
                  type="number"
                  min="0.5"
                  max="6"
                  step="0.1"
                  value={draft.summonerAbilityFactor ?? 4}
                  onChange={(e) =>
                    change({
                      ...draft,
                      summonerAbilityFactor: number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="catalogue-filter">
                <span>Summoner calibration center</span>
                <input
                  aria-label="Summoner calibration center"
                  type="number"
                  min="0"
                  max="8"
                  step="0.1"
                  value={draft.summonerCalibration ?? 2.5}
                  onChange={(e) =>
                    change({
                      ...draft,
                      summonerCalibration: number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <h2>Stat–ability synergies</h2>
            <div className="catalogue-table-wrap rating-admin-table">
              <table className="price-table">
                <thead>
                  <tr>
                    <th>Ability</th>
                    <th>Stat</th>
                    <th>Minimum stat</th>
                    <th>Bonus points</th>
                    <th>Reason</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draft.statSynergies.map((rule, i) => (
                    <tr key={i}>
                      <td>
                        {abilitySelect(
                          rule.ability,
                          (v) =>
                            change({
                              ...draft,
                              statSynergies: draft.statSynergies.map((r, j) =>
                                j === i ? { ...r, ability: v } : r,
                              ),
                            }),
                          `Stat synergy ${i + 1} ability`,
                        )}
                      </td>
                      <td>
                        <select
                          aria-label={`Stat synergy ${i + 1} stat`}
                          value={rule.stat}
                          onChange={(e) =>
                            change({
                              ...draft,
                              statSynergies: draft.statSynergies.map((r, j) =>
                                j === i
                                  ? { ...r, stat: e.target.value as StatKey }
                                  : r,
                              ),
                            })
                          }
                        >
                          {Object.entries(STAT_LABELS).map(([key, value]) => (
                            <option key={key} value={key}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`Stat synergy ${i + 1} minimum`}
                          type="number"
                          min="0"
                          max="100"
                          value={rule.minimum}
                          onChange={(e) =>
                            change({
                              ...draft,
                              statSynergies: draft.statSynergies.map((r, j) =>
                                j === i
                                  ? { ...r, minimum: number(e.target.value) }
                                  : r,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Stat synergy ${i + 1} bonus`}
                          type="number"
                          min="-2"
                          max="2"
                          step="0.05"
                          value={rule.bonus}
                          onChange={(e) =>
                            change({
                              ...draft,
                              statSynergies: draft.statSynergies.map((r, j) =>
                                j === i
                                  ? { ...r, bonus: number(e.target.value) }
                                  : r,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <textarea
                          aria-label={`Stat synergy ${i + 1} reason`}
                          value={rule.notes}
                          maxLength={1500}
                          onChange={(e) =>
                            change({
                              ...draft,
                              statSynergies: draft.statSynergies.map((r, j) =>
                                j === i ? { ...r, notes: e.target.value } : r,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="rating-remove"
                          onClick={() =>
                            change({
                              ...draft,
                              statSynergies: draft.statSynergies.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="catalogue-button"
              onClick={() =>
                change({
                  ...draft,
                  statSynergies: [
                    ...draft.statSynergies,
                    {
                      ability: names[0],
                      stat: 'health',
                      minimum: 1,
                      bonus: 0.25,
                      notes: '',
                    },
                  ],
                })
              }
            >
              Add stat synergy
            </button>
          </section>
        )}
        {tab === 'Card adjustments' && (
          <section>
            <h2>Explained meta adjustments</h2>
            <p className="rating-note">
              Adjust the final curated score by at most −2 to +2, including
              overlapping scopes. Use a reason describing the team synergy,
              matchup or meta factor the base model misses.
            </p>
            <datalist id="rating-card-options">
              {cards.map((card) => (
                <option key={card.id} value={card.name}>
                  {card.id}
                </option>
              ))}
            </datalist>
            <div className="catalogue-table-wrap rating-admin-table">
              <table className="price-table">
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Level cap</th>
                    <th>Format</th>
                    <th>Bonus / penalty</th>
                    <th>Amount</th>
                    <th>Reason</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draft.adjustments.map((rule, i) => (
                    <tr key={i}>
                      <td>
                        <CardPicker
                          label={`Adjustment ${i + 1} card`}
                          value={rule.cardId}
                          cards={cards}
                          onChange={(id) =>
                            change({
                              ...draft,
                              adjustments: draft.adjustments.map((r, j) =>
                                j === i ? { ...r, cardId: id } : r,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          aria-label={`Adjustment ${i + 1} level`}
                          value={rule.league}
                          onChange={(e) =>
                            change({
                              ...draft,
                              adjustments: draft.adjustments.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      league: e.target.value as typeof r.league,
                                    }
                                  : r,
                              ),
                            })
                          }
                        >
                          <option value="all">All levels</option>
                          {LEAGUES.map((l) => (
                            <option key={l} value={l}>
                              {LEAGUE_NAMES[l]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`Adjustment ${i + 1} format`}
                          value={rule.format}
                          onChange={(e) =>
                            change({
                              ...draft,
                              adjustments: draft.adjustments.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      format: e.target.value as typeof r.format,
                                    }
                                  : r,
                              ),
                            })
                          }
                        >
                          <option value="all">Both formats</option>
                          <option value="modern">Modern</option>
                          <option value="wild">Wild</option>
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`Adjustment ${i + 1} direction`}
                          value={rule.delta < 0 ? 'penalty' : 'bonus'}
                          onChange={(e) =>
                            change({
                              ...draft,
                              adjustments: draft.adjustments.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      delta:
                                        Math.abs(r.delta) *
                                        (e.target.value === 'penalty' ? -1 : 1),
                                    }
                                  : r,
                              ),
                            })
                          }
                        >
                          <option value="bonus">Bonus</option>
                          <option value="penalty">Penalty</option>
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`Adjustment ${i + 1} amount`}
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={Math.abs(rule.delta)}
                          onChange={(e) =>
                            change({
                              ...draft,
                              adjustments: draft.adjustments.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      delta:
                                        number(e.target.value) *
                                        (r.delta < 0 ? -1 : 1),
                                    }
                                  : r,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <textarea
                          aria-label={`Adjustment ${i + 1} reason`}
                          maxLength={1500}
                          value={rule.notes}
                          onChange={(e) =>
                            change({
                              ...draft,
                              adjustments: draft.adjustments.map((r, j) =>
                                j === i ? { ...r, notes: e.target.value } : r,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="rating-remove"
                          onClick={() =>
                            change({
                              ...draft,
                              adjustments: draft.adjustments.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!draft.adjustments.length && (
                <p className="rating-note">
                  No manual card adjustments. Every current score comes from the
                  shared model and qualifying evidence.
                </p>
              )}
            </div>
            <button
              className="catalogue-button"
              onClick={() =>
                change({
                  ...draft,
                  adjustments: [
                    ...draft.adjustments,
                    {
                      cardId: cards[0].id,
                      league: 'all',
                      format: 'all',
                      delta: 1,
                      notes: '',
                    },
                  ],
                })
              }
            >
              Add card adjustment
            </button>
          </section>
        )}
        {tab === 'Publish & history' && (
          <section>
            <h2>Publish the saved draft</h2>
            <p className="rating-note">
              Publishing creates an immutable named profile and replaces its
              complete public score snapshot in one transaction. Battle
              collection always uses the published profile.
            </p>
            <div className="rating-admin-publish">
              <label className="catalogue-filter">
                <span>Version label</span>
                <input
                  aria-label="Version label"
                  maxLength={120}
                  value={label}
                  placeholder="e.g. Healing and armor review"
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              <label className="catalogue-filter">
                <span>Why are these ratings changing?</span>
                <textarea
                  aria-label="Publication reason"
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe the balance change, evidence or curation decision."
                />
              </label>
              <button
                className="catalogue-button rating-publish"
                disabled={!!busy || dirty || !label.trim() || !notes.trim()}
                onClick={publish}
              >
                {busy === 'publish' ? 'Publishing…' : 'Publish saved draft'}
              </button>
              {dirty && (
                <p className="rating-note">Save the draft before publishing.</p>
              )}
            </div>
            <h2>Published history</h2>
            <div className="rating-admin-history">
              {profiles.map((profile) => (
                <article key={profile.id}>
                  <strong>{profile.label}</strong>
                  <p>{profile.notes}</p>
                  <span>
                    {profile.published_at.slice(0, 10)} · {profile.author}
                  </span>
                  <button
                    className="catalogue-button"
                    disabled={!!busy || dirty}
                    onClick={async () => {
                      const data = await action('restore', {
                        profileId: profile.id,
                        revision,
                      })
                      if (data) {
                        setDraft(data.config)
                        setRevision(data.revision)
                        setDirty(false)
                        setPreview(null)
                        setMessage(
                          'Previous profile copied to the draft. Public scores are unchanged.',
                        )
                      }
                    }}
                  >
                    Use as draft
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
        {tab === 'Collector' && (
          <section>
            <h2>Battle collection</h2>
            <div className="rating-metrics rating-admin-collection">
              <div>
                <span>Archived matches</span>
                <strong>{counts.battles}</strong>
              </div>
              <div>
                <span>Eligible ranked matches</span>
                <strong>{counts.eligible}</strong>
              </div>
              <div>
                <span>Bulk history credentials</span>
                <strong>
                  {historyConfigured ? 'Configured' : 'Not configured'}
                </strong>
              </div>
              <div>
                <span>Schedule</span>
                <strong>Every hour · ratings daily</strong>
              </div>
            </div>
            <p className="rating-note">
              The job samples public queues, follows known replay IDs, and
              archives publicly shared replays for research. Shared/manual
              replays are excluded from strength evidence because they are
              selected examples. Broader ranked history is attempted anonymously
              first; an upstream 401 is reported separately. Optional
              server-only data-account credentials enable authenticated history
              when available.
            </p>
            <div className="rating-admin-weight-grid">
              <label className="catalogue-filter">
                <span>Additional players to follow (optional)</span>
                <textarea
                  aria-label="Collector player seeds"
                  value={players}
                  onChange={(e) => setPlayers(e.target.value)}
                  placeholder="One account per line"
                />
              </label>
              <label className="catalogue-filter">
                <span>Replay IDs to archive for research (optional)</span>
                <textarea
                  aria-label="Research replay IDs"
                  value={replayIds}
                  onChange={(e) => setReplayIds(e.target.value)}
                  placeholder="sl_… or sm_…; one per line"
                />
              </label>
            </div>
            <div className="rating-controls">
              <button
                className="catalogue-button"
                disabled={!!busy}
                onClick={async () => {
                  const data = await action('collect', {
                    players: players.split(/[\s,]+/).filter(Boolean),
                    replayIds: replayIds.split(/[\s,]+/).filter(Boolean),
                  })
                  if (data) {
                    setMessage(data.message)
                    router.refresh()
                  }
                }}
              >
                {busy === 'collect'
                  ? 'Collecting battles…'
                  : 'Run collection now'}
              </button>
              <button
                className="catalogue-button"
                disabled={!!busy}
                onClick={async () => {
                  const data = await action('refresh')
                  if (data) {
                    setMessage(
                      'Published scores recomputed from current evidence.',
                    )
                    router.refresh()
                  }
                }}
              >
                {busy === 'refresh'
                  ? 'Recomputing…'
                  : 'Recompute published scores'}
              </button>
            </div>
            <div className="rating-admin-history">
              {runs.map((run) => (
                <article key={run.id}>
                  <strong>
                    {run.status} ·{' '}
                    {run.started_at.slice(0, 16).replace('T', ' ')} UTC
                  </strong>
                  <p>{run.message}</p>
                  <span>
                    {run.collected} new matches · {run.players} players checked
                    · {run.requests} requests
                  </span>
                </article>
              ))}
            </div>
          </section>
        )}
      </fieldset>
      {preview && (
        <section className="rating-admin-preview">
          <h2>Draft preview · Modern, Diamond / Champion</h2>
          <p className="rating-note">
            {preview.count} card scopes · {preview.abilities} ability scopes.
            Range {preview.minimum?.toFixed(1)}–{preview.maximum?.toFixed(1)},
            median {preview.median?.toFixed(1)}. Previewing does not publish or
            save.
          </p>
          <div className="catalogue-table-wrap">
            <table className="price-table">
              <thead>
                <tr>
                  <th>Card</th>
                  <th>Draft score</th>
                  <th>Curated</th>
                  <th>Qualifying matches</th>
                </tr>
              </thead>
              <tbody>
                {preview.cards.map((card) => (
                  <tr key={card.cardId}>
                    <th scope="row">{card.name}</th>
                    <td>
                      <RatingBadge
                        score={card.score}
                        confidence={card.confidence}
                      />
                    </td>
                    <td>{card.curated.toFixed(1)}</td>
                    <td>{card.battles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
