import Link from 'next/link'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import RatingAdmin from '@/components/ratings/RatingAdmin'
import { requireAdmin } from '@/lib/admin'
import { readWorkspace } from '@/lib/ratings/store'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
import type { RatingProfile } from '@/lib/ratings/types'
import '../../cards/catalogue.css'
export default async function RatingsAdminPage() {
  if (!(await requireAdmin())) redirect('/admin')
  const [data, cards] = await Promise.all([readWorkspace(), getCatalogue()])
  if (!data.workspace)
    return (
      <>
        <Nav />
        <main className="catalogue-page">
          <h1>Ratings setup is pending</h1>
          <p>Run the ratings initialization before using the curator tools.</p>
        </main>
      </>
    )
  return (
    <>
      <Nav />
      <main className="catalogue-page rating-admin">
        <Link className="catalogue-back" href="/admin">
          ← Backoffice
        </Link>
        <header className="catalogue-header">
          <p className="catalogue-eyebrow">Curation studio</p>
          <h1>Card & ability ratings</h1>
          <p>
            Edit shared weights, inspect their effect, and publish a version
            with an explanation. Draft edits stay private.
          </p>
        </header>
        <RatingAdmin
          initial={data.workspace.draft as RatingProfile}
          initialRevision={data.workspace.revision}
          profiles={
            data.profiles as Parameters<typeof RatingAdmin>[0]['profiles']
          }
          runs={data.runs as Parameters<typeof RatingAdmin>[0]['runs']}
          counts={data.counts as Parameters<typeof RatingAdmin>[0]['counts']}
          cards={cards
            .filter((c) => c.kind !== 'land')
            .map((c) => ({ id: c.id, name: c.name }))}
          historyConfigured={
            !!(
              process.env.SPLINTERLANDS_API_USERNAME &&
              process.env.SPLINTERLANDS_ACCESS_TOKEN
            )
          }
        />
      </main>
    </>
  )
}
