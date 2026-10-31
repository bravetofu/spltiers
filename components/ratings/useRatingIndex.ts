'use client'
import { useEffect, useState } from 'react'
import type { ScoreIndex } from '@/lib/ratings/server'
import type { BattleFormat, League } from '@/lib/ratings/types'
const cache = new Map<string, { at: number; scores: ScoreIndex }>()
const EMPTY_INDEX: ScoreIndex = {}
export function useRatingIndex(
  initial: ScoreIndex,
  league: League,
  format: BattleFormat | 'auto',
) {
  const key = `${league}:${format}`
  const [remote, setRemote] = useState<{
    key: string
    scores: ScoreIndex
    error?: string
  } | null>(null)
  useEffect(() => {
    if (key === 'diamond:auto') return
    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < 60000) {
      setRemote({ key, scores: cached.scores })
      return
    }
    const abort = new AbortController()
    fetch(`/api/ratings?league=${league}&format=${format}`, {
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Ratings temporarily unavailable')
        return response.json() as Promise<ScoreIndex>
      })
      .then((scores) => {
        if (!abort.signal.aborted) {
          cache.set(key, { at: Date.now(), scores })
          setRemote({ key, scores })
        }
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setRemote({ key, scores: {}, error: error.message })
      })
    return () => abort.abort()
  }, [key, league, format])
  return key === 'diamond:auto'
    ? {
        scores: initial,
        loading: false,
        error: Object.keys(initial).length
          ? undefined
          : 'Ratings temporarily unavailable. ',
      }
    : {
        scores: remote?.key === key ? remote.scores : EMPTY_INDEX,
        loading: remote?.key !== key,
        error: remote?.key === key ? remote.error : undefined,
      }
}
