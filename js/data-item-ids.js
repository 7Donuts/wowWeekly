// Maps BiS item names (must match BIS_DATA `item` field exactly) to Blizzard item IDs.
// Used by _fetchMissingBisIcons for direct media API lookup instead of name search.
const BIS_ITEM_IDS = {

  // ── Shared accessories ─────────────────────────────────────────────────────
  "Eye of Midnight":                            249920,
  "Occlusion of Void":                          251217,
  "Sin'dorei Band of Hope":                     249919,
  "Platinum Star Band":                         193708,
  "Ribbon of Coiled Malice":                    249337,
  "Amulet of the Abyssal Hymn":                 250247,
  "Eternal Voidsong Chain":                     249368,
  "Bond of Light":                              249369,
  "Omission of Light":                          251093,
  "Signet of the Starved Beast":                249336,
  "Purloined Wedding Ring":                     49812,
  "Barbed Ymirheim Choker":                     50228,
  "Pendant of Aching Grief":                    251096,
  "Loa Worshiper's Band":                       251513,
  "Masterwork Sin'dorei Amulet":                240950,
  "Imperator's Banner":                         249335,

  // ── Cloaks ─────────────────────────────────────────────────────────────────
  "Adherent's Silken Shroud":                   239656,
  "Rigid Scale Greatcloak":                     258575,
  "Draconic Nullcape":                          249370,
  "Potionstained Cloak":                        193712,
  "Defiant Defender's Drape":                   260312,
  "Shroud of the Soulhunter":                   251161,
  "Fluxweave Cloak":                            251206,
  "Arcanoweave Cloak":                          239661,
  "Guardian of the Primal Core":                249974,

  // ── Trinkets ───────────────────────────────────────────────────────────────
  "Gaze of the Alnseer":                        249343,
  "Heart of Ancient Hunger":                    249342,
  "Locus-Walker's Ribbon":                      249809,
  "Algeth'ar Puzzle Box":                       193701,
  "Vaelgor's Final Stare":                      249346,
  "Umbral Plume":                               260235,
  "Light Company Guidon":                       249344,
  "Shadow of the Empyrean Requiem":             249810,
  "Soulcatcher's Charm":                        250223,
  "Litany of Lightblind Wrath":                 249808,
  "Radiant Plume":                              249806,
  "Emberwing Feather":                          250144,
  "Ranger-Captain's Iridescent Insignia":       249345,
  "Sigil of the Restless Heart":                251094,
  "Reflux Reflector":                           251202,

  // ── Head ───────────────────────────────────────────────────────────────────
  "Oblivion Guise":                             249914,
  "Mask of Darkest Intent":                     249913,
  "Spellsnap Shadowmask":                       251109,
  "Horns of the Spurned Valkyr":                49824,
  "Voidlashed Hood":                            151336,

  // ── Shoulders ──────────────────────────────────────────────────────────────
  "Shoulderplates of Frozen Blood":             50234,
  "Blooming Barklight Spaulders":               249333,
  "Nullwalker's Dread Epaulettes":              249318,
  "Mantle of Dark Devotion":                    251085,
  "Pauldrons of the Void Hunter":               151323,
  "Fallen Grunt's Mantle":                      251092,
  "Echoing Void Mantle":                        249328,

  // ── Chest ──────────────────────────────────────────────────────────────────
  "Robes of Endless Oblivion":                  249912,
  "Vest of the Void's Embrace":                 151313,

  // ── Wrists ─────────────────────────────────────────────────────────────────
  "Martyr's Bindings":                          239648,
  "Arcanoweave Bracers":                        239660,
  "Farstrider's Plated Bracers":                244584,
  "Frenzyroot Cuffs":                           193714,
  "Voidskinned Bracers":                        249327,
  "Void-Skinned Bracers":                       249327,
  "Voracious Wristwraps":                       249315,
  "Amberfrond Bracers":                         251079,
  "Fallen King's Cuffs":                        249304,
  "Corewarden Cuffs":                           251209,
  "Wraps of Watchful Wrath":                    251108,

  // ── Hands ──────────────────────────────────────────────────────────────────
  "Gloves of Viscous Goo":                      251113,
  "Vaelgor's Fearsome Grasp":                   249321,
  "Untethered Berserker's Grips":               249325,
  "Voidclaw Gauntlets":                         151332,
  "Embergrove Grasps":                          251081,

  // ── Waist ──────────────────────────────────────────────────────────────────
  "Hate-Tied Waistchain":                       249380,
  "Snapvine Cinch":                             251082,
  "Scornscarred Shul'ka's Belt":                249374,
  "Shadowsplit Girdle":                         251112,
  "Scornbane Waistguard":                       249371,
  "Waistcord of the Judged":                    249303,
  "Arcanoweave Cord":                           239664,
  "World Tender's Barkclasp":                   244611,
  "Silvermoon Agent's Utility Belt":            244573,
  "Azure Belt of Competition":                  193722,
  "Scabrous Zombie Belt":                       49810,
  "Scabrous Zombie Leather Belt":               133494,
  "Clasp of Compliance":                        251102,
  "Bloodfeather Girdle":                        109830,
  "Ezzorak's Gloombind":                        249331,

  // ── Legs ───────────────────────────────────────────────────────────────────
  "Extinction Guards":                          249915,
  "Shaggy Wyrmleather Leggings":                49817,
  "Shifting Stalker Hide Pants":                151314,
  "Power Stance Breeches":                      260373,
  "Legwraps of Lingering Legacies":             251087,
  "Greaves of the Divine Guile":                251215,
  "Commander's Faded Breeches":                 251090,

  // ── Feet ───────────────────────────────────────────────────────────────────
  "Greaves of the Unformed":                    249381,
  "Parasite Stompers":                          249332,
  "Dream-Scorched Striders":                    249373,
  "Canopy Walker's Footwraps":                  249382,
  "World Tender's Rootslippers":                244610,
  "Silvermoon Agent's Sneakers":                244569,
  "Eclipse Espadrilles":                        251210,
  "Aetherlume Stompers":                        244774,
  "Voidclaimed Shinkickers":                    249334,
  "Sabatons of Obscurement":                    249320,
  "Slippers of the Midnight Flame":             249305,
  "Whipcoil Sabatons":                          251084,
  "Footpads of Seeping Dread":                  151317,
  "Lightbinder Treads":                         258584,
  "Eternal Flame Scaleguards":                  249324,

  // ── Other drops / crafted ──────────────────────────────────────────────────
  "Spellbreaker's Bracers":                     237834,
  "Blood Knight's Impetus":                     237847,
  "Trollhunter's Bands":                        263193,
  "Ward of the Spellbreaker":                   251105,
  "Viryx's Indomitable Bulwark":                110034,
  "Bulwark of Noble Resolve":                   249339,
  "Silvermoon Agent's Deflectors":              244576,

  // ── Weapons ────────────────────────────────────────────────────────────────
  "Alah'endal, the Dawnsong":                   249296,
  "Bellamy's Final Judgement":                  249277,
  "Turalyon's False Echo":                      249295,
  "Spellboon Saber":                            193710,
  "Belo'melorn, the Shattered Talon":           249283,
  "Belo'ren's Swift Talon":                     249284,
  "Blade of the Final Twilight":                249281,
  "Aln'hara Lantern":                           245769,
  "Grimoire of the Eternal Light":              249276,
  "Umbral Spire of Zuraal":                     258514,
  "Splitshroud Stinger":                        251111,
  "Ceremonial Hexblade":                        251178,
  "Lightless Lament":                           260408,
  "Soulblight Cleaver":                         251175,
  "Dawncrazed Beast Cleaver":                   250451,
  "Spellbreaker's Warglaive":                   237840,
  "Traitor's Talon":                            251162,
  "Weight of Command":                          249293,
  "Roostwarden's Bough":                        251077,
  "Ranger-Captain's Lethal Recurve":            249288,
  "Deceiver's Rotbow":                          251174,
  "Skybreaker's Blade":                         258218,
  "Hungering Victory":                          249925,
  "Arator's Swift Remembrance":                 260423,
  "Krick's Beetle Stabber":                     49807,
  "Spellbreaker's Blade":                       237839,
  "Spellbreaker's Rebuke":                      237831,
  "Farstrider's Mercy":                         237837,
  "Farstrider's Chopper":                       237850,
  "Inescapable Reach":                          249302,
  "Arcanic of the High Sage":                   258050,
  "Clutchmate's Caress":                        249287,

  // ── Warrior — Rage of the Night Ender ────────────────────────────────────
  "Night Ender's Tusks":                        249952,
  "Night Ender's Pauldrons":                    249950,
  "Night Ender's Breastplate":                  249955,
  "Night Ender's Warbands":                     249948,
  "Night Ender's Fists":                        249953,
  "Night Ender's Girdle":                       249949,
  "Night Ender's Chausses":                     249951,
  "Night Ender's Greatboots":                   249954,

  // ── Paladin — Luminant Verdict's Vestments ───────────────────────────────
  "Luminant Verdict's Unwavering Gaze":         249961,
  "Luminant Verdict's Providence Watch":        249959,
  "Luminant Verdict's Divine Warplate":         249964,
  "Luminant Verdict's Gauntlets":               249962,
  "Luminant Verdict's Greaves":                 249960,

  // ── Death Knight — Relentless Rider's Lament ─────────────────────────────
  "Relentless Rider's Crown":                   249970,
  "Relentless Rider's Dreadthorns":             249968,
  "Relentless Rider's Cuirass":                 249973,
  "Relentless Rider's Bonegrasps":              249971,
  "Relentless Rider's Chain":                   249967,
  "Relentless Rider's Legguards":               249969,

  // ── Demon Hunter — Devouring Reaver's Sheathe ────────────────────────────
  "Devouring Reaver's Intake":                  250033,
  "Devouring Reaver's Exhaustplates":           250031,
  "Devouring Reaver's Engine":                  250036,
  "Devouring Reaver's Essence Grips":           250034,
  "Devouring Reaver's Pistons":                 250032,

  // ── Druid — Sprouts of the Luminous Bloom ────────────────────────────────
  "Branches of the Luminous Bloom":             250024,
  "Seedpods of the Luminous Bloom":             250022,
  "Trunk of the Luminous Bloom":                250027,
  "Arbortenders of the Luminous Bloom":         250025,
  "Phloemwraps of the Luminous Bloom":          250023,

  // ── Evoker — Wings of the Black Talon ────────────────────────────────────
  "Hornhelm of the Black Talon":                249997,
  "Beacons of the Black Talon":                 249995,
  "Frenzyward of the Black Talon":              250000,
  "Enforcer's Grips of the Black Talon":        249998,
  "Greaves of the Black Talon":                 249996,
  "Spelltreads of the Black Talon":             249999,

  // ── Hunter — Primal Sentry's Vigilance ───────────────────────────────────
  "Primal Sentry's Maw":                        249988,
  "Primal Sentry's Scaleplate":                 249991,
  "Primal Sentry's Wound Stanchers":            249984,
  "Primal Sentry's Talonguards":                249989,
  "Primal Sentry's Legguards":                  249987,

  // ── Mage — Void Communion ─────────────────────────────────────────────────
  "Voidbreaker's Veil":                         250060,
  "Voidbreaker's Leyline Nexi":                 250058,
  "Voidbreaker's Robe":                         257183,
  "Voidbreaker's Gloves":                       250061,
  "Voidbreaker's Sage Cord":                    250057,
  "Voidbreaker's Britches":                     250059,

  // ── Monk — Vestments of Ra-den's Chosen ──────────────────────────────────
  "Fearsome Visage of Ra-den's Chosen":         250015,
  "Aurastones of Ra-den's Chosen":              250013,
  "Battle Garb of Ra-den's Chosen":             250018,
  "Strikeguards of Ra-den's Chosen":            250011,
  "Thunderfists of Ra-den's Chosen":            250016,
  "Swiftsweepers of Ra-den's Chosen":           250014,
  "Storm Crashers of Ra-den's Chosen":          250017,
  "Windwrap of Ra-den's Chosen":                250010,

  // ── Priest — Blind Oath's Raiment ────────────────────────────────────────
  "Blind Oath's Winged Crest":                  250051,
  "Blind Oath's Seraphguards":                  250049,
  "Blind Oath's Raiment":                       250054,
  "Blind Oath's Touch":                         250052,
  "Blind Oath's Leggings":                      250050,
  "Blind Oath's Wraps":                         250047,

  // ── Rogue — Garb of the Grim Jest ────────────────────────────────────────
  "Masquerade of the Grim Jest":                250006,
  "Venom Casks of the Grim Jest":               250004,
  "Fantastic Finery of the Grim Jest":          250009,
  "Sleight of Hand of the Grim Jest":           250007,
  "Blade Holsters of the Grim Jest":            250005,
  "Balancing Boots of the Grim Jest":           250008,

  // ── Shaman — Regalia of the Primal Core ──────────────────────────────────
  "Locus of the Primal Core":                   249979,
  "Tempests of the Primal Core":                249977,
  "Embrace of the Primal Core":                 249982,
  "Cuffs of the Primal Core":                   249975,
  "Earthgrips of the Primal Core":              249980,
  "Ceinture of the Primal Core":                249976,
  "Leggings of the Primal Core":                249978,

  // ── Warlock — Vestments of the Abyssal Immolator ─────────────────────────
  "Abyssal Immolator's Smoldering Flames":      250042,
  "Abyssal Immolator's Dreadrobe":              250045,
  "Abyssal Immolator's Grasps":                 250043,
  "Abyssal Immolator's Blazing Core":           250039,
  "Abyssal Immolator's Pillars":                250041,

};
