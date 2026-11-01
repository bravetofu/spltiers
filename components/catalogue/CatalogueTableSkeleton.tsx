const columns = [
  'Card',
  'Rating',
  'Uses',
  'Wins',
  'Losses',
  'Win rate',
  'Splinter',
  'Rarity',
  'Edition',
  'Bloodline',
  'Level',
  'Mana',
  'Speed',
  'Melee',
  'Ranged',
  'Magic',
  'Armor',
  'Health',
  'Abilities',
]

/** Keep the real table's layout while its interactive filters are hydrating. */
export default function CatalogueTableSkeleton() {
  return (
    <div
      className="catalogue-skeleton"
      aria-busy="true"
      aria-label="Loading card library"
    >
      <p className="sr-only" role="status">
        Loading card library…
      </p>
      <div className="catalogue-tabs" aria-hidden="true">
        {['Units', 'Summoners', 'Land Cards'].map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <div className="catalogue-filters" aria-hidden="true">
        {[
          'Search cards',
          'Splinter',
          'Rarity',
          'Format',
          'Edition',
          'Level',
          'Bloodline',
        ].map((label, index) => (
          <div
            key={label}
            className={`catalogue-filter ${index === 0 ? 'catalogue-search' : ''}`}
          >
            <span>{label}</span>
            <div className="skeleton-block skeleton-control" />
          </div>
        ))}
        <div className="skeleton-block skeleton-reset" />
      </div>
      <div className="catalogue-results" aria-hidden="true">
        <div className="skeleton-block skeleton-count" />
        <span className="muted">Loading cards…</span>
      </div>
      <div className="catalogue-table-wrap" aria-hidden="true">
        <table className="catalogue-table">
          <thead>
            <tr>
              {columns.map((name) => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, row) => (
              <tr key={row}>
                <th>
                  <div className="catalogue-card-name">
                    <div className="skeleton-block skeleton-art" />
                    <div className="skeleton-block skeleton-name" />
                  </div>
                </th>
                {columns.slice(1).map((column) => (
                  <td key={column}>
                    <div className="skeleton-block skeleton-cell" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
