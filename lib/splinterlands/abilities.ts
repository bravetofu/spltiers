import type { LandAbility } from './catalogue'

export const ABILITY_GUIDE =
  'https://support.splinterlands.com/hc/en-us/articles/12821703483156-List-of-Splinterlands-Abilities-and-Debilitations'
export const LAND_GUIDE =
  'https://support.splinterlands.com/hc/en-us/articles/44050892625940-Land-Cards-FAQ'
// Concise gameplay summaries checked against Splinterlands' official support glossary.
// Keep these local: tooltips should work without a request to the support site.
const descriptions: Record<string, string> = {
  Affliction:
    'A successful attack has a 50% chance to prevent the target from receiving healing.',
  Ambush: 'Takes a bonus turn before the first battle round.',
  Amplify:
    'Adds 1 damage to allied retaliatory damage effects. Multiple copies do not stack.',
  'Apex Strike': 'Targets the opposing unit with the highest attack power.',
  'Armored Strike':
    'While armored, makes an additional melee attack using remaining armor as its damage.',
  Backfire: 'An attacker that misses this unit takes 2 physical damage.',
  'Blasphemy of Uul': 'Gains 1 ranged power for every allied Divine Construct.',
  Blast: 'The units beside the target take half the attack damage, rounded up.',
  Blind:
    'Enemy physical attacks gain a 15% miss chance; magic is affected when the defender has Phase.',
  'Bloodline Dominion':
    'May summon units of the matching bloodline from active elements and grants them the linked ability.',
  'Bloodline Pact':
    'Matching-bloodline allies gain power on allied kills but take true damage on allied deaths. Losing the pact unit removes the gained power and deals 2 damage.',
  'Bloodline Tribute':
    'On defeat, grants matching-bloodline allies health, speed, armor, and power for shared attack types.',
  Bloodlust: 'Each killing blow increases all of this unit’s stats by 1.',
  Bulwark: 'In the front position, trades 2 power for 8 health and 8 armor.',
  Camouflage:
    'Cannot be directly targeted from the backline. Indirect attacks and Wingbreak can still hit it.',
  Charge: 'Can make melee attacks from any team position.',
  Cleanse: 'Clears magic debuffs from the allied frontline unit.',
  'Cleanse Rearguard':
    'Clears magic debuffs from the last affected allied backline unit.',
  'Close Range': 'Can make ranged attacks while in the front position.',
  Conscript: 'Allows one additional Gladiator in the battle lineup.',
  'Corrosive Ward':
    'A melee attacker loses 2 maximum armor after hitting this unit.',
  'Corrupted Healing':
    'Heals other allies for 70% of maximum health each round, rounded down; each heal also lowers their maximum health by 1.',
  Cripple:
    'Successful attacks reduce the target’s maximum health by 1; Immunity prevents this effect.',
  Deathblow: 'Deals double damage to the last surviving opposing unit.',
  Decoy:
    'Draws backline Snipe, Opportunity, and Apex Strike attacks unless an allied Taunt takes precedence.',
  Deflect:
    'Prevents damage from Blast splash and retaliatory effects such as Thorns, Return Fire, Magic Reflect, and Corrosive Ward.',
  'Deflection Shroud': 'Grants Deflect to adjacent allies when battle begins.',
  Demoralize: 'Reduces the melee power of every opposing unit by 1.',
  Determined:
    'Once each round, retries an attack against the same target after missing.',
  Dispel: 'A successful attack strips magic buffs from its target.',
  'Divine Shield': 'Absorbs one damaging hit before the shield breaks.',
  Dodge: 'Adds a 25% chance to evade physical attacks.',
  'Double Strike': 'Makes two attacks during its turn.',
  Echo: 'Activates healing, cleansing, and Repair abilities twice per round.',
  Electrified: 'Deals 1 damage to all allies, including itself, at the beginning of round 2 and each following round.',
  Empower: 'While not Revealed, grants 1 power to itself and adjacent allies.',
  Enfeeble: 'Successful attacks lower the target’s melee power by 1.',
  Enrage:
    'When below full health, melee power and speed increase by 50%, rounded up.',
  Execute:
    'Attacks the same target again if a successful hit leaves it with at most 2 health.',
  Expose:
    'Successful hits have an 80% chance to remove a defensive ability, prioritizing Immunity.',
  'Final Rest':
    'Once per battle, prevents an opposing resurrection effect unless its target has Last Word.',
  'Flame Fed':
    'Burning restores 1 health and maximum health per round instead of causing health loss.',
  Flank: 'When starting in front, grants Reach to the ally in second position.',
  Flying:
    'Adds 25% evasion against non-Flying physical attackers and prevents Earthquake damage.',
  Focus: 'Grants 1 ranged power to each allied unit.',
  Forcefield: 'An attack with at least 5 base damage deals only 1 damage.',
  'Force Reduction': 'Reduces the maximum number of units in the team by 1.',
  Fury: 'Deals double damage against a target with Taunt.',
  'Giant Killer':
    'Deals double damage against targets costing at least 10 mana.',
  Halving: 'A successful hit halves the target’s power, rounded down.',
  Headwinds: 'Reduces the ranged power of each opposing unit by 1.',
  Heal: 'Each round, heals itself for one third of maximum health, rounded down.',
  Immunity: 'Prevents magic debuffs and Cripple.',
  Impede: 'Each successful attack lowers the target’s speed by 1.',
  Incendiary:
    'Applies Burning from round two onward. Burning causes 2 damage per round and may spread to adjacent units; it can be cleansed.',
  Inspire: 'Grants 1 melee power to every allied unit.',
  Invigorate: 'Prevents allied units from becoming Exhausted.',
  'Kindred Spirit':
    'At battle start, grants its linked ability to adjacent units with Kindred Will.',
  'Kindred Will':
    'At battle start, grants its linked ability to adjacent units with Kindred Spirit.',
  'Knock Out': 'Deals double damage against Stunned targets.',
  'Last Stand':
    'When alone on its team, increases all stats and current health by 50%, rounded up.',
  'Last Word':
    'Protects this unit from Final Rest, allowing its defeat-triggered effects to resolve.',
  'Life Leech':
    'Gains health and maximum health equal to half the damage it deals, rounded up.',
  Lookout:
    'Adjacent allies take 1 less damage from Sneak, Snipe, and Opportunity; opposing Ambush damage is halved.',
  'Magic Reflect':
    'Returns half of incoming magic damage to the attacker, rounded up.',
  Martyr: 'When defeated, increases all stats of adjacent allies by 1.',
  Mimic:
    'From round two, copies a random eligible opposing ability each round. Dispel removes copied abilities in acquisition order.',
  Opportunity: 'Targets the opposing unit with the lowest health.',
  Oppress:
    'Deals double damage to units without an attack, including Weapons Training recipients.',
  Painforge: 'Gains 1 power when damaged by poison, Burning, or an ally.',
  Phase:
    'Allows this unit to evade magic attacks using the normal accuracy rules.',
  'Phase Ward':
    'Gives Phase to the ally immediately in front at the start of battle.',
  Piercing:
    'Damage beyond the target’s remaining armor carries through to health.',
  Pinpoint: 'Allied Sneak attacks always hit.',
  Poison:
    'Successful attacks have a 50% chance to apply poison, causing 2 health loss each round.',
  'Poison Burst':
    'On defeat, poisons its attacker and has a 50% chance to poison the attacker’s neighbors.',
  Protect: 'Grants 2 armor to every allied unit.',
  Reach: 'Allows melee attacks from second position.',
  Rebirth:
    'Once per battle, revives itself with 1 health and restored armor; clears debuffs and skips its turn.',
  Recharge: 'Attacks every second round for triple damage.',
  Reckless: 'Every successful attack also damages adjacent allied units for 1.',
  Redemption: 'On defeat, deals 1 physical damage to all opposing units.',
  Reflexes:
    'After an attacker’s first successful hit in a round, its further attacks against this unit miss that round.',
  'Relentless Strike':
    'Against Shield, Void, or Forcefield, deals true damage with 1 additional damage instead of the reduced hit.',
  Repair: 'Restores up to 2 armor to the ally with the most armor damage.',
  Reprisal:
    'An enemy dealing more than 5 damage in a round gains Taunt and loses Camouflage through Revealed.',
  Resurgence:
    'Once per battle, revives itself with full health and armor, skips its turn, and deals 1 physical damage to all units.',
  Resurrect:
    'Once per battle, revives a defeated ally with 1 health and full armor. The revived ally skips its turn.',
  Retaliate:
    'Has a 50% chance to counterattack a successful melee hit, even when that hit defeats it.',
  'Return Fire':
    'Returns half the damage from a ranged hit to its attacker, rounded up.',
  Reveal:
    'Each round, marks a Camouflaged opponent as Revealed so direct attacks can target it.',
  Rust: 'Reduces the armor of all opposing units by 2.',
  Scattershot: 'Ranged and magic attacks choose a random opposing target.',
  Scavenger:
    'Whenever any unit is defeated, gains 1 health and maximum health.',
  'Shadow Focus':
    'In the last position, gains Camouflage and stops attacking, while granting allies 1 power and Determined.',
  Shapeshift: 'Counts as every bloodline for bloodline-based mechanics.',
  Shatter: 'A successful hit removes all remaining armor from the target.',
  Shield:
    'Halves physical damage, rounded up; physical hits of 1 damage are prevented.',
  'Shield Ward':
    'Gives Shield to the ally immediately in front at battle start.',
  Silence: 'Reduces the magic power of every opposing unit by 1.',
  Slow: 'Reduces the speed of every opposing unit by 1.',
  Snare: 'Always hits Flying targets and removes their Flying bonuses.',
  Sneak: 'Targets the opponent in the last position.',
  Snipe:
    'Ranged and magic attacks target the first eligible non-melee backline opponent.',
  'Soul Siphon':
    'Revives using a non-Weary ally: that ally gains Weary and loses half its health, while this unit returns with half maximum health and full armor.',
  Spite: 'Always counterattacks when defeated.',
  'Stray Shot':
    'Whenever it makes a ranged attack, a random ally takes 2 true damage, even if the attack misses.',
  Strengthen: 'Grants 1 maximum health to every allied unit.',
  Stun: 'Successful attacks have a 50% chance to make the target skip its turn and prevent Retaliate for one round.',
  Swiftness: 'Grants 1 speed to every allied unit.',
  'Tank Heal':
    'Each round, heals the allied frontline unit for one third of its maximum health, rounded down.',
  Taunt:
    'Draws eligible enemy attacks; positional attacks, Scattershot, and Wingbreak can override it.',
  Thorns: 'A melee attacker takes 2 physical damage after hitting this unit.',
  Trample:
    'After a melee killing blow, immediately attacks the next opposing unit.',
  Triage:
    'Each round, heals the most damaged allied backline unit for one third of its maximum health, rounded down.',
  'True Strike': 'Its attacks cannot miss.',
  Untrainable: 'Cannot gain attacks through Weapons Training.',
  Void: 'Halves magic damage, rounded up; magic hits of 1 damage are prevented.',
  'Void Armor': 'Magic damage must pass through armor before health.',
  'Volley of Arrows':
    'Its attack triggers an unavoidable ranged attack on the same target from other allied ranged attackers, regardless of their positions.',
  Weaken: 'Reduces maximum health of every opposing unit by 1.',
  'Weapons Training':
    'Gives adjacent allies without an attack its attack type and up to 3 power.',
  Weary:
    'May become Exhausted and skip its turn. The chance starts at 10% and grows by 10% per round, up to 80%.',
  Wingbreak:
    'Prioritizes the first Flying opponent and deals 2 extra damage to Flying targets.',
}
const land: Record<string, [string, string, string]> = {
  GRAIN: [
    'Bountiful Grain',
    'Increases production on grain-producing worksites.',
    'bountiful-grain',
  ],
  WOOD: [
    'Bountiful Wood',
    'Increases production on wood-producing worksites.',
    'bountiful-wood',
  ],
  STONE: [
    'Bountiful Stone',
    'Increases production on stone-producing worksites.',
    'bountiful-stone',
  ],
  IRON: [
    'Bountiful Iron',
    'Increases production on iron-producing worksites.',
    'bountiful-iron',
  ],
  AURA: [
    'Bountiful Aura',
    'Increases production on aura-producing worksites.',
    'bountiful-aura',
  ],
  DD: [
    'Dark Discount',
    'Reduces the Dark Energy required by the plot where this card works.',
    'dark-discount',
  ],
  ENERGIZED: [
    'Energized',
    'Acts as a Power Core for the land plot where this card works.',
    'energized',
  ],
  LL: [
    'Labor’s Luck',
    'Manual harvests have a chance to discover a special-foil Land card.',
    'labors-luck',
  ],
  RATIONING: [
    'Rationing',
    'Reduces workers’ grain consumption when harvesting; does not apply to Castles or Keeps.',
    'rationing',
  ],
  RATIONING_LITE: [
    'Light Rationing',
    'Reduces grain consumption on eligible plots; excludes Castles, Keeps, and plots over 20,000 base Production Power.',
    'light-rationing',
  ],
  BLOODLINE: [
    'Toil and Kin',
    'Increases production when another worker on the same plot has the matching bloodline.',
    'toil-and-kin',
  ],
  ALTERATION: [
    'Alteration',
    'Qualifying staked cards provide a monthly skin airdrop while the event is active.',
    'alteration',
  ],
  GLINT_RECOVERY: [
    'Glint Recovery',
    'Qualifying staked cards provide a chance at daily Glint while the event is active.',
    'glint-recovery',
  ],
  FORTUNE_SEEKER: [
    'Fortune Seeker',
    'Qualifying staked cards provide a weekly chance at a special-foil Verico card during the event.',
    'fortune-seeker',
  ],
  STATIC_CHARGE: [
    'Static Charge',
    'Accrues EVP while staked as a land worker; the highest active level on the account determines accrual.',
    'static-charge',
  ],
}
export function abilityInfo(value: string | LandAbility) {
  if (Array.isArray(value)) {
    const [code, amount, bloodline] = value
    const [name, description, icon] = land[code] ?? [
      code,
      'See the official land guide for this effect.',
      code.toLowerCase().replace(/_/g, '-'),
    ]
    const modifier =
      amount === undefined
        ? ''
        : ` ${amount > 0 ? '+' : ''}${Number((amount * 100).toFixed(2))}%`
    return {
      name,
      label: `${name}${modifier}${bloodline ? ` · ${bloodline}` : ''}`,
      description,
      icon: `/images/abilities/ability_${icon}.webp`,
      source: LAND_GUIDE,
    }
  }
  const [name, linked] = value.split(':')
  return {
    name,
    label: linked ? `${name} · ${linked}` : name,
    description: `${descriptions[name] ?? 'See the official ability guide for rules and interactions.'}${linked ? ` Linked ability: ${linked}. ${descriptions[linked] ?? ''}` : ''}`,
    icon: `/images/abilities/ability_${name.toLowerCase().replace(/ /g, '-')}.webp`,
    source:
      name === 'Stray Shot'
        ? 'https://support.splinterlands.com/hc/en-us/articles/43935917059220-Stray-Shot'
        : `${ABILITY_GUIDE}#:~:text=${encodeURIComponent(name)}`,
  }
}
export function hasAbilityDescription(name: string) {
  return !!descriptions[name.split(':')[0]]
}
export const abilityNames = Object.keys(descriptions)
