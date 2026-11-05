// A successful observation only changes one card edition's history.
export function priceHistoryTag(cardId: number, edition: number) {
  return `card-price-history:${cardId}:${edition}`
}
