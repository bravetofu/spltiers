import CatalogueShell from '@/components/catalogue/CatalogueShell'
import CatalogueTableSkeleton from '@/components/catalogue/CatalogueTableSkeleton'
export default function Loading() {
  return (
    <CatalogueShell>
      <CatalogueTableSkeleton />
    </CatalogueShell>
  )
}
