'use client'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import HoverDetails from '@/components/HoverDetails'
import {
  dailyPoints,
  lineSegments,
  type PriceHistory,
} from '@/lib/market/history'
import { editionName, FOILS } from '@/lib/splinterlands/catalogue'

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 6,
})
const money = (v: number | null) => (v === null ? '—' : usd.format(v))
const dateLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
export default function PriceHistoryChart({
  cardId,
  edition,
  foil,
  ready,
}: {
  cardId: number
  edition: number
  foil: number
  ready: boolean
}) {
  const [history, setHistory] = useState<PriceHistory | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [days, setDays] = useState(90)
  const [selected, setSelected] = useState<number | null>(null)
  const [loadedEdition, setLoadedEdition] = useState<number | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const readoutId = useId()
  const svg = useRef<SVGSVGElement>(null)
  const [plotWidth, setPlotWidth] = useState(640)
  useEffect(() => {
    if (!ready || cardId === 505) return
    const controller = new AbortController()
    setHistory(null)
    setError(false)
    setLoadedEdition(null)
    fetch(`/api/cards/${cardId}/price-history?edition=${edition}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error()
        return r.json() as Promise<PriceHistory>
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setHistory(data)
          setLoadedEdition(edition)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [cardId, edition, ready, retry])
  useEffect(() => setSelected(null), [foil, edition, days])
  const points = useMemo(
    () =>
      dailyPoints(
        loadedEdition === edition ? (history?.points ?? []) : [],
        foil,
        days,
      ),
    [history, loadedEdition, edition, foil, days],
  )
  const active = points.length
    ? Math.min(selected ?? points.length - 1, points.length - 1)
    : 0
  const point = points[active]
  useLayoutEffect(() => {
    if (!svg.current) return
    const observer = new ResizeObserver(([entry]) =>
      setPlotWidth(Math.max(280, Math.round(entry.contentRect.width))),
    )
    observer.observe(svg.current)
    return () => observer.disconnect()
  }, [points.length])
  const priceValues = points
    .flatMap((p) => [p.perBcx, p.singleBcx])
    .filter((v): v is number => v !== null)
  const maxPrice = priceValues.length ? Math.max(...priceValues) * 1.12 : 1
  const maxListings = Math.max(1, ...points.map((p) => p.listings ?? 0))
  const plotLeft = Math.max(50, money(maxPrice).length * 6 + 12)
  const plotRight = plotWidth - 20
  // Keep endpoint bars inside the plot, clear of the vertical-axis labels.
  const dataLeft = plotLeft + 12
  const dataRight = plotRight - 12
  const x = (i: number) =>
    points.length <= 1
      ? (plotLeft + plotRight) / 2
      : dataLeft + (i * (dataRight - dataLeft)) / (points.length - 1)
  const y = (v: number) => 180 - (v / maxPrice) * 155
  const barWidth = Math.min(22, 350 / Math.max(1, points.length))
  const loading = !error && (!ready || loadedEdition !== edition || !history)
  return (
    <section className="price-history-panel" aria-label="Daily price history">
      <div className="price-history-heading">
        <div>
          <div className="history-title">
            <h2>Daily prices</h2>
            <HoverDetails
              label="About price history"
              interactive
              content={
                <>
                  <strong>About this chart</strong>
                  <p>
                    Daily USD asking prices, not completed sales. Lowest / BCX
                    includes combined copies; the second line requires an actual
                    1-BCX listing.
                  </p>
                  <p>
                    Missing prices stay as gaps. Listing counts are captured
                    once per UTC day. Hover the chart or focus it and use the
                    arrow keys to inspect a date.
                  </p>
                  {points.filter((p) => p.observedAt).length === 1 && (
                    <p>
                      First daily snapshot. A trend will appear as more days are
                      collected.
                    </p>
                  )}
                  {!!points.length && (
                    <details className="history-data">
                      <summary>View daily data</summary>
                      <div>
                        <table>
                          <thead>
                            <tr>
                              <th>Date (UTC)</th>
                              <th>Lowest / BCX</th>
                              <th>1-BCX</th>
                              <th>Listings</th>
                            </tr>
                          </thead>
                          <tbody>
                            {points.map((p) => (
                              <tr key={p.day}>
                                <th scope="row">{p.day}</th>
                                <td>{money(p.perBcx)}</td>
                                <td>{money(p.singleBcx)}</td>
                                <td>{p.listings ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </>
              }
            >
              <button
                type="button"
                className="history-info-button"
                aria-haspopup="dialog"
                aria-label="About price history"
              >
                i
              </button>
            </HoverDetails>
          </div>
        </div>
        <div className="history-ranges" role="group" aria-label="Chart period">
          {([30, 90, 365] as const).map((n) => (
            <button
              key={n}
              aria-pressed={days === n}
              onClick={() => setDays(n)}
            >
              {n === 365 ? '1Y' : `${n}D`}
            </button>
          ))}
        </div>
      </div>
      <p className="history-context">
        {FOILS.find((f) => f.id === foil)?.name} · {editionName(edition)} · USD
      </p>
      {cardId === 505 ? (
        <div className="history-empty">
          Runi is an Ethereum NFT. BCX and foil-specific price history do not
          apply; its live collection floor is shown below.
        </div>
      ) : error ? (
        <div className="history-empty" role="alert">
          Price history is temporarily unavailable.
          <button
            className="catalogue-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry history
          </button>
        </div>
      ) : loading ? (
        <div className="history-empty history-loading" role="status">
          Loading price history…
          <div />
          <div />
        </div>
      ) : !points.length ? (
        <div className="history-empty">
          No daily snapshots in this period yet. History begins with the first
          successful collection.
        </div>
      ) : (
        <>
          <div className="history-legend">
            <span>
              <i className="history-low" />
              Lowest / BCX
            </span>
            <span>
              <i className="history-single" />
              Single 1-BCX copy
            </span>
          </div>
          <div
            className="history-plot"
            tabIndex={0}
            role="group"
            aria-label="Inspect daily prices with left and right arrow keys"
            aria-describedby={inspecting ? readoutId : undefined}
            onFocus={() => setInspecting(true)}
            onBlur={() => setInspecting(false)}
            onPointerEnter={() => setInspecting(true)}
            onPointerLeave={(e) => {
              if (document.activeElement !== e.currentTarget)
                setInspecting(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setInspecting(false)
                return
              }
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                e.preventDefault()
                setInspecting(true)
                setSelected(
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? points.length - 1
                      : Math.max(
                          0,
                          Math.min(
                            points.length - 1,
                            active + (e.key === 'ArrowLeft' ? -1 : 1),
                          ),
                        ),
                )
              }
            }}
          >
            <svg
              ref={svg}
              className="price-history-chart"
              viewBox={`0 0 ${plotWidth} 300`}
              role="img"
              aria-label="Daily USD asking prices with available listing counts below. Missing values are gaps."
              onPointerMove={(e) => {
                const transform = e.currentTarget.getScreenCTM()
                if (!transform) return
                const at = new DOMPoint(e.clientX, e.clientY).matrixTransform(
                  transform.inverse(),
                ).x
                setInspecting(true)
                setSelected(
                  points.length <= 1
                    ? 0
                    : Math.max(
                        0,
                        Math.min(
                          points.length - 1,
                          Math.round(
                            ((at - dataLeft) / (dataRight - dataLeft)) *
                              (points.length - 1),
                          ),
                        ),
                      ),
                )
              }}
            >
              {[0, 0.5, 1].map((f) => (
                <g key={f}>
                  <line
                    x1={plotLeft}
                    x2={plotRight}
                    y1={y(maxPrice * f)}
                    y2={y(maxPrice * f)}
                    className="history-grid"
                  />
                  <text
                    x={plotLeft - 7}
                    y={y(maxPrice * f) + 4}
                    textAnchor="end"
                  >
                    {money(maxPrice * f)}
                  </text>
                </g>
              ))}
              {!priceValues.length && (
                <text
                  x={(plotLeft + plotRight) / 2}
                  y="105"
                  textAnchor="middle"
                >
                  No listed prices in this period
                </text>
              )}
              {(['perBcx', 'singleBcx'] as const).map((field, series) => (
                <g
                  key={field}
                  className={
                    series ? 'history-single-series' : 'history-low-series'
                  }
                >
                  {lineSegments(points, field, x, y).map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      fill="none"
                      strokeWidth="2"
                      strokeDasharray={series ? '5 3' : undefined}
                    />
                  ))}
                  {points.map((p, i) =>
                    p[field] === null ? null : (
                      <circle
                        key={p.day}
                        cx={x(i)}
                        cy={y(p[field]!)}
                        r={series ? 4 : 2.5}
                        fill={series ? 'none' : undefined}
                        strokeWidth="2"
                      />
                    ),
                  )}
                </g>
              ))}
              <text x={plotLeft} y="212">
                Available listings
              </text>
              <text x={plotLeft - 7} y="232" textAnchor="end">
                {maxListings}
              </text>
              <text x={plotLeft - 7} y="269" textAnchor="end">
                0
              </text>
              <line
                x1={plotLeft}
                x2={plotRight}
                y1="265"
                y2="265"
                className="history-grid"
              />
              {points.map((p, i) =>
                p.listings === null ? null : (
                  <rect
                    key={p.day}
                    x={x(i) - barWidth / 2}
                    y={265 - Math.max(1, (p.listings / maxListings) * 40)}
                    width={barWidth}
                    height={Math.max(1, (p.listings / maxListings) * 40)}
                    className={
                      i === active ? 'history-bar active' : 'history-bar'
                    }
                  />
                ),
              )}
              <line
                x1={x(active)}
                x2={x(active)}
                y1="20"
                y2="270"
                className="history-cursor"
              />
              <text
                x={points.length === 1 ? (plotLeft + plotRight) / 2 : plotLeft}
                y="292"
                textAnchor={points.length === 1 ? 'middle' : 'start'}
              >
                {dateLabel(points[0].day)}
              </text>
              {points.length > 1 && (
                <text x={plotRight} y="292" textAnchor="end">
                  {dateLabel(points[points.length - 1].day)}
                </text>
              )}
            </svg>
            {inspecting && (
              <div className="history-readout" id={readoutId} role="tooltip">
                <strong>
                  {point.day} <span>UTC</span>
                </strong>
                {point.observedAt ? (
                  <dl>
                    <div>
                      <dt>Lowest / BCX</dt>
                      <dd>{money(point.perBcx)}</dd>
                    </div>
                    <div>
                      <dt>Single 1-BCX</dt>
                      <dd>{money(point.singleBcx)}</dd>
                    </div>
                    <div>
                      <dt>Listings</dt>
                      <dd>{point.listings?.toLocaleString('en-US') ?? '—'}</dd>
                    </div>
                  </dl>
                ) : (
                  <p>
                    No snapshot recorded. Prices and listing count are unknown.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
