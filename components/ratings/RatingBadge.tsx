import type { Confidence } from '@/lib/ratings/types'
export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  curated: 'Curated only',
  early: 'Early evidence',
  moderate: 'Moderate evidence',
  strong: 'Strong evidence',
}
export default function RatingBadge({
  score,
  confidence,
  battles = 0,
}: {
  score: number
  confidence: Confidence
  battles?: number
}) {
  return (
    <span
      className={`rating-badge rating-${score >= 8 ? 'excellent' : score >= 6 ? 'good' : score >= 4 ? 'mixed' : 'weak'}`}
      aria-label={`${score.toFixed(1)} out of 10. ${CONFIDENCE_LABELS[confidence]}. ${battles} qualifying matches.`}
    >
      {score.toFixed(1)}
      <small>/10</small>
      <span
        className={`rating-confidence confidence-${confidence}`}
        aria-hidden="true"
      />
    </span>
  )
}
