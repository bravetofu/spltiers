import nextEnv from '@next/env'
import { readFile } from 'node:fs/promises'
import { runCollector } from '../lib/ratings/collector'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
nextEnv.loadEnvConfig(process.cwd())
const cards = JSON.parse(
  await readFile(
    new URL('../data/card-catalogue.json', import.meta.url),
    'utf8',
  ),
) as CatalogueCard[]
const result = await runCollector(cards)
console.log(JSON.stringify(result))
