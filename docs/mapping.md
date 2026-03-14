# EDITION MAPPING

Retrieve "editions" and "tier" values from https://api.splinterlands.io/cards/get_details

- "editions" = "0" or "1" or "0,1":
  - Map edition to "Alpha/Beta"
  - Map image URL slug to "/beta/"
- "editions" = "2" AND "tier" = "0" or "1":
  - Map edition to "Alpha/Beta"
  - Map image URL slug to "/promo/"
- "editions" = "3" AND "tier" = "0" or "1":
  - Map edition to "Alpha/Beta"
  - Map image URL slug to "/reward/"

- "editions" = "4":
  - Map edition to "Untamed"
  - Map image URL slug to "/untamed/"
- "editions" = "2" AND "tier" = "4":
  - Map edition to "Untamed"
  - Map image URL slug to "/promo/"
- "editions" = "3" AND "tier" = "4":
  - Map edition to "Untamed"
  - Map image URL slug to "/reward/"
- "editions" = "5"
  - Map editions to "Dice"
  - Map image URL slug to "/dice/"

- "editions" = "7":
  - Map editions to "Chaos Legion"
  - Map image URL slug to "/chaos/"
- "editions" = "2" AND "tier" = "7":
  - Map editions to "Chaos Legion"
  - Map image URL slug to "/promo/"
- "editions" = "3" AND "tier" = "7":
  - Map editions to "Chaos Legion"
  - Map image URL slug to "/reward/"
- "editions" = "10" AND "tier" = "7":
  - Map editions to "Chaos Legion"
  - Map image URL slug to "/soulbound/"
- "editions" = "8":
  - Map edition to "Riftwatchers"
  - Map image URL slug to "/rift/"

- "editions" = "12":
  - Map edition to "Rebellion"
  - Map image URL slug to "/rebellion/"
- "editions" = "2" AND "tier" = "12":
  - Map edition to "Rebellion"
  - Map image URL slug to "/promo/"
- "editions" = "13":
  - Map edition to "Rebellion"
  - Map image URL slug to "/soulboundrb/"

- "editions" = "14":
  - Map edition to "Conclave Arcana"
  - Map image URL slug to "/conclave/"
- "editions" = "17" AND tier = "14":
  - Map edition to "Conclave Arcana"
  - Map image URL slug to "/conclave/"
- "editions" = "17" AND tier = "15":
  - DO NOT MAP (exclude these cards)
- "editions" = "2" AND "tier" = "14":
  - Map edition to "Conclave Arcana"
  - Map image URL slug to "/promo/"
- "editions" = "18":
  - Map edition to "Conclave Arcana"
  - Map image URL slug to "/reward/"

- "editions" = "20"
  - Map edition to "Escalation"
  - Map image URL slug to "/escalation/"
 
# RARITY MAPPING

Get "rarity" value from https://api.splinterlands.io/cards/get_details

- "1" = "Common"
- "2" = "Rare"
- "3" = "Epic"
- "4" = "Legendary"

Max level (for URL slug, which requires "lvX" where "X" is the max level of the card):
- Common = 10
- Rare = 8
- Epic = 6
- Legendary = 4
