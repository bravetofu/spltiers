import dictionary from '../../data/score-note-dictionary.json'
import type { ScorePart } from './types'

// Shared wire dictionary only: snapshots retain their original complete notes.
// Unknown/custom explanations travel inline, so profile edits remain lossless.
export const SCORE_NOTES: Readonly<Record<string, string>> = dictionary
export const SCORE_NOTES_JSON = JSON.stringify(SCORE_NOTES)
export type WireScorePart = ScorePart & { noteRef?: string }
export function expandScoreParts(parts: WireScorePart[]): ScorePart[] {
  return parts.map(({ noteRef, ...part }) => {
    if (noteRef === undefined) return part
    const note = SCORE_NOTES[noteRef]
    if (note === undefined)
      throw new Error('Unknown score explanation reference')
    return { ...part, note }
  })
}
