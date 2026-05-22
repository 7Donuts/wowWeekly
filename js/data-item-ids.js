// Maps BiS item names (must match BIS_DATA `item` field exactly) to Blizzard item IDs.
// Used by _fetchMissingBisIcons for direct media API lookup instead of name search.
const BIS_ITEM_IDS = {
  // ── Shared accessories ─────────────────────────────────────────────────────
  "Eye of Midnight":                        249920,
  "Occlusion of Void":                      251217,
  "Sin'dorei Band of Hope":                 249919,
  "Platinum Star Band":                     193708,
  "Ribbon of Coiled Malice":                249337,
  "Amulet of the Abyssal Hymn":             250247,
  "Eternal Voidsong Chain":                 249368,
  "Adherent's Silken Shroud":               239656,
  "Rigid Scale Greatcloak":                 258575,

  // ── Trinkets ───────────────────────────────────────────────────────────────
  "Gaze of the Alnseer":                    249343,
  "Heart of Ancient Hunger":                249342,
  "Locus-Walker's Ribbon":                  249809,
  "Algeth'ar Puzzle Box":                   193701,

  // ── Crafted / Cross-spec ───────────────────────────────────────────────────
  "Spellbreaker's Bracers":                 237834,
  "Blood Knight's Impetus":                 237847,

  // ── Dungeon drops (cross-spec) ────────────────────────────────────────────
  "Voidclaw Gauntlets":                     151332,
  "Greaves of the Unformed":                249381,
  "Embergrove Grasps":                      251081,
  "Parasite Stompers":                      249332,
  "Ezzorak's Gloombind":                    249331,
  "Trollhunter's Bands":                    263193,
  "Extinction Guards":                      249915,
  "Ward of the Spellbreaker":               251105,
  "Viryx's Indomitable Bulwark":            110034,

  // ── Weapons ────────────────────────────────────────────────────────────────
  "Alah'endal, the Dawnsong":               249296,
  "Bellamy's Final Judgement":              249277,
  "Turalyon's False Echo":                  249295,
  "Spellboon Saber":                        193710,

  // ── Warrior — Rage of the Night Ender ────────────────────────────────────
  "Night Ender's Tusks":                    249952,
  "Night Ender's Pauldrons":                249950,
  "Night Ender's Breastplate":              249955,
  "Night Ender's Warbands":                 249948,
  "Night Ender's Fists":                    249953,
  "Night Ender's Girdle":                   249949,
  "Night Ender's Chausses":                 249951,
  "Night Ender's Greatboots":               249954,

  // ── Paladin — Luminant Verdict's Vestments ───────────────────────────────
  "Luminant Verdict's Unwavering Gaze":     249961,
  "Luminant Verdict's Providence Watch":    249959,
  "Luminant Verdict's Divine Warplate":     249964,
  "Luminant Verdict's Gauntlets":           249962,

  // ── Death Knight — Relentless Rider's Lament ─────────────────────────────
  "Relentless Rider's Crown":               249970,
  "Relentless Rider's Dreadthorns":         249968,
  "Relentless Rider's Cuirass":             249973,
  "Relentless Rider's Bonegrasps":          249971,
  "Relentless Rider's Chain":               249967,
  "Relentless Rider's Legguards":           249969,

  // ── Demon Hunter — Devouring Reaver's Sheathe ────────────────────────────
  "Devouring Reaver's Intake":              250033,
  "Devouring Reaver's Exhaustplates":       250031,
  "Devouring Reaver's Engine":              250036,
  "Devouring Reaver's Pistons":             250032,

  // ── Druid — Sprouts of the Luminous Bloom ────────────────────────────────
  "Branches of the Luminous Bloom":         250024,
  "Arbortenders of the Luminous Bloom":     250025,
  "Phloemwraps of the Luminous Bloom":      250023,

  // ── Hunter — Primal Sentry's Vigilance ───────────────────────────────────
  "Primal Sentry's Maw":                    249988,
  "Primal Sentry's Scaleplate":             249991,
  "Primal Sentry's Talonguards":            249989,
  "Primal Sentry's Legguards":              249987,

  // ── Mage — Void Communion ─────────────────────────────────────────────────
  "Voidbreaker's Veil":                     250060,
  "Voidbreaker's Robe":                     257183,
  "Voidbreaker's Gloves":                   250061,
  "Voidbreaker's Britches":                 250059,
};
