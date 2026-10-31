'use client'

import { memo, useState } from 'react'
import { abilityInfo } from '@/lib/splinterlands/abilities'
import type { LandAbility } from '@/lib/splinterlands/catalogue'

// The surrounding provider delegates interaction to one shared tooltip. Hundreds
// of table icons don't each need popup state, layout effects or document listeners.
const AbilityIcon = memo(function AbilityIcon({
  ability,
  label = false,
}: {
  ability: string | LandAbility
  label?: boolean
}) {
  const info = abilityInfo(ability)
  const [failed, setFailed] = useState(false)
  return (
    <button
      className={`ability-icon ${label ? 'ability-labeled' : ''}`}
      type="button"
      aria-label={info.label}
      data-ability={JSON.stringify(ability)}
    >
      {failed ? (
        <span className="ability-fallback" aria-hidden>
          {info.name.slice(0, 2)}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={info.icon}
          width={28}
          height={28}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      {label && <span>{info.label}</span>}
    </button>
  )
})
export default AbilityIcon

export function AbilityList({
  abilities,
  labels = false,
}: {
  abilities: (string | LandAbility)[]
  labels?: boolean
}) {
  return (
    <div className="ability-list">
      {abilities.length ? (
        abilities.map((ability, index) => (
          <AbilityIcon
            key={`${Array.isArray(ability) ? ability.join(':') : ability}-${index}`}
            ability={ability}
            label={labels}
          />
        ))
      ) : (
        <span className="muted">—</span>
      )}
    </div>
  )
}
