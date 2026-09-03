// Maps BiS item names (must match the BIS_DATA `item` field exactly) to Blizzard
// item IDs. Used by _fetchMissingBisIcons for a direct media API lookup instead
// of a slower name search.
//
// Emptied for Midnight Season 2: every entry here pointed at a Season 1 (12.0.x)
// item, and none of those appear on a Season 2 list. Repopulate alongside
// BIS_DATA in data-bis.js.
//
// Adding an entry:
//   1. Find the item on Wowhead; the numeric part of the URL is the item ID.
//   2. Add "Exact Item Name": <id>, with the name matching BIS_DATA verbatim,
//      apostrophes and capitalisation included.
//
// Items missing from this map still resolve, just via a name search that is
// slower and occasionally picks the wrong item when names collide across
// expansions. Prefer an explicit ID for anything ambiguous.
const BIS_ITEM_IDS = {

  // ── Season 2 · The Venomous Abyss / Coiled Isle / Season 2 Mythic+ ─────────
  // (populate as BiS lists are transcribed)

};
