/** Refresh the official catalogue and its locally served artwork. Run npm run sync:cards. */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  normalizeCatalogue,
  cardImageCandidates,
  artEdition,
  cardSlug,
  CDN,
  type RawCard,
  type GameSettings,
} from '../lib/splinterlands/catalogue'
import { abilityInfo, abilityNames } from '../lib/splinterlands/abilities'

const root = process.cwd()
const json = async (file: string, fallback: any) => {
  try {
    return JSON.parse(await readFile(path.join(root, file), 'utf8'))
  } catch {
    return fallback
  }
}
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`${response.status}: ${url}`)
  return response.json() as Promise<T>
}
const [raw, settings] = await Promise.all([
  fetchJson<RawCard[]>(`${'https://api.splinterlands.io'}/cards/get_details`),
  fetchJson<GameSettings>('https://api.splinterlands.io/settings'),
])
const cards = normalizeCatalogue(raw, settings)
const previous = await json('data/card-images.json', {})
const sources = await json('data/image-sources.json', {})
const index: Record<string, [string, number, number]> = {}
const missing: string[] = []
const jobs = new Map<string, { candidates: string[]; icon?: boolean }>()
for (const card of cards) {
  for (const edition of card.editions) {
    const foils = new Set(
      (card.foils[edition] ?? [0]).map((foil) =>
        foil >= 3 ? 3 : foil > 0 ? 1 : 0
      )
    )
    for (const foil of foils) {
      const key = `${artEdition(card, edition)}/${cardSlug(card.name)}-${foil}`
      if (!jobs.has(key))
        jobs.set(key, {
          candidates: Array.from(
            new Set(cardImageCandidates(card, edition, foil))
          ),
        })
    }
  }
}
const icons = new Set(abilityNames.map((name) => abilityInfo(name).icon))
for (const card of cards) {
  for (const abilities of card.stats.land_abilities ?? [])
    for (const ability of abilities) icons.add(abilityInfo(ability).icon)
}
for (const icon of icons) {
  const filename = path.basename(icon, '.webp')
  jobs.set(`abilities/${filename}`, {
    icon: true,
    candidates: [`${CDN}/website/abilities/${filename}.png`],
  })
}
let completed = 0
let downloaded = 0
let originalBytes = 0
let localBytes = 0
const queue = Array.from(jobs.entries())
await mkdir(path.join(root, 'data'), { recursive: true })
async function worker() {
  while (queue.length) {
    const [key, job] = queue.shift()!
    const directory = job.icon
      ? 'public/images/abilities'
      : `public/images/cards/${path.dirname(key)}`
    await mkdir(path.join(root, directory), { recursive: true })
    const old = previous[key] as [string, number, number] | undefined
    const stem = path.basename(key)
    const oldFilename = job.icon ? `${stem}.webp` : `${stem}-${old?.[0]}.webp`
    if (old) {
      try {
        await access(path.join(root, directory, oldFilename))
        if (!job.icon)
          await access(
            path.join(
              root,
              directory,
              oldFilename.replace('.webp', '.thumb.webp')
            )
          )
        index[key] = old
        completed++
        continue
      } catch {
        /* Download an absent asset. */
      }
    }
    let buffer: Buffer | undefined
    let source = ''
    for (const candidate of job.candidates) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(candidate, {
            signal: AbortSignal.timeout(20000),
          })
          if (response.status === 404 || response.status === 403) break
          if (!response.ok) throw new Error(`${response.status}: ${candidate}`)
          const data = Buffer.from(await response.arrayBuffer())
          await sharp(data).metadata()
          buffer = data
          source = candidate
          break
        } catch (error) {
          if (attempt === 2) throw error
        }
      }
      if (buffer) break
    }
    if (!buffer) missing.push(key)
    else {
      const pipeline = sharp(buffer)
      const full = await (
        job.icon
          ? pipeline.resize({ width: 84, withoutEnlargement: true })
          : pipeline
              .trim({ threshold: 10 })
              .resize({ width: 640, withoutEnlargement: true })
      )
        .webp({ quality: job.icon ? 92 : 85 })
        .toBuffer({ resolveWithObject: true })
      const hash = createHash('sha256')
        .update(full.data)
        .digest('hex')
        .slice(0, 10)
      const filename = job.icon ? `${stem}.webp` : `${stem}-${hash}.webp`
      await writeFile(path.join(root, directory, filename), full.data)
      let bytes = full.data.length
      if (!job.icon) {
        const thumbnail = await sharp(full.data)
          .resize({ width: 96 })
          .webp({ quality: 80 })
          .toBuffer()
        await writeFile(
          path.join(root, directory, filename.replace('.webp', '.thumb.webp')),
          thumbnail
        )
        bytes += thumbnail.length
      }
      index[key] = [hash, full.info.width, full.info.height]
      sources[key] = {
        source,
        originalBytes: buffer.length,
        localBytes: bytes,
      }
      originalBytes += buffer.length
      localBytes += bytes
      downloaded++
    }
    completed++
    if (completed % 100 === 0)
      console.log(
        `${completed}/${jobs.size} assets checked (${missing.length} unpublished)`
      )
  }
}
await Promise.all(Array.from({ length: 12 }, worker))
const sorted = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
  )
await writeFile(
  path.join(root, 'data/card-catalogue.json'),
  JSON.stringify(cards)
)
await writeFile(
  path.join(root, 'data/card-images.json'),
  JSON.stringify(sorted(index))
)
await writeFile(
  path.join(root, 'data/image-sources.json'),
  JSON.stringify(sorted(sources), null, 2) + '\n'
)
await writeFile(
  path.join(root, 'data/unpublished-images.json'),
  JSON.stringify(missing.sort(), null, 2) + '\n'
)
console.log(
  JSON.stringify({
    cards: cards.length,
    available: Object.keys(index).length,
    downloaded,
    originalBytes,
    localBytes,
    unpublished: missing.length,
  })
)
