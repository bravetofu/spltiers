export default function AbilityTableSkeleton() {
  return (
    <div className="catalogue-table-wrap catalogue-skeleton" aria-busy="true">
      <table className="price-table">
        <thead>
          <tr>
            {[
              'Ability',
              'Rating',
              'Standard',
              'Non-standard',
              'Matches',
              'Confidence',
            ].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }, (_, i) => (
            <tr key={i}>
              {Array.from({ length: 6 }, (_, j) => (
                <td key={j}>
                  <div className="skeleton-block skeleton-cell" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rating-note" role="status">
        Loading ability ratings…
      </p>
    </div>
  )
}
