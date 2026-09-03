// ── Best in Slot data · Midnight Season 2 · Patch 12.1 "Curse of Ula'tek" ──────
//
// Season 1 (12.0.x) item data was removed wholesale when Season 2 opened on
// August 18, 2026. Every item level, every source instance and every tier set
// changed, so nothing from the old lists was salvageable.
//
// ── STRUCTURE ────────────────────────────────────────────────────────────────
//   BIS_DATA[classKey][specKey] = {
//     raid:  [ { slot, item, source, location }, ... ],   // true BiS
//     mplus: [ { slot, item, source, location }, ... ],   // M+ and crafted only
//   }
//
// Two lists per spec, mirroring how Icy Veins publishes them:
//
//   raid   "True BiS": the strongest setup from every Season 2 source, mixing
//          The Venomous Abyss, crafted pieces and Mythic+ drops. Raid items are
//          preferred where they are equal, because they are easier to target.
//
//   mplus  "Mythic+ and crafted": the strongest setup reachable without
//          setting foot in the raid. For players who only run keys, and for
//          gearing up before raid night.
//
// The site's BiS picker exposes both through a mode switch. Either list may be
// empty; the picker falls back to a deep link to the matching Icy Veins page
// for that spec and mode.
//
// ── POPULATING THESE LISTS ───────────────────────────────────────────────────
// Source of truth: the Icy Veins gear pages, one per spec. Build the URL with
// icyVeinsBisUrl(classKey, specKey) below, or by hand:
//
//   https://www.icy-veins.com/wow/{spec-slug}-{class-slug}-pve-{role}-gear-best-in-slot
//     role: dps | tank | healing
//     e.g. beast-mastery-hunter-pve-dps-gear-best-in-slot
//          blood-death-knight-pve-tank-gear-best-in-slot
//          holy-priest-pve-healing-gear-best-in-slot
//
// On each page, the first gear table is the raid (true BiS) list and the
// Mythic+ table is the second. Transcribe rows in character-sheet order:
//   Head, Neck, Shoulders, Back, Chest, Wrists, Hands, Waist, Legs, Feet,
//   Ring 1, Ring 2, Trinket 1, Trinket 2, Main Hand, Off Hand
// Slot strings must match _BIS_DOLL_SLOTS in app.js exactly, and item names
// must match the keys in data-item-ids.js for icons to resolve.
//
// Season 2 landmarks, useful when sanity-checking a transcription:
//   Raid          The Venomous Abyss, 8 bosses, ending at Ula'tek
//   Lair          The Tidebound Grotto (raid-level loot, Raid Vault row)
//   M+ pool       Altar of Fangs, Murder Row, Den of Nalorakk,
//                 The Blinding Vale, Voidscar Arena, King's Rest,
//                 Temple of Sethraliss, Ruby Life Pools
//   Tier token    Slumbering Coil Curio from Ula'tek, traded to Kirana
//   Item levels   Myth track caps at 334; the last two Mythic bosses reach 344

const WOW_CLASSES = [
  { key: 'deathknight',  label: 'Death Knight',  color: '#C41E3A', icon: 'ph-fill ph-skull', armor: 'Plate',
    specs: [
      { key: 'blood',   label: 'Blood',   role: 'tank' },
      { key: 'frost',   label: 'Frost',   role: 'dps' },
      { key: 'unholy',  label: 'Unholy',  role: 'dps' },
    ]
  },
  { key: 'demonhunter',  label: 'Demon Hunter',  color: '#A330C9', icon: 'ph-fill ph-eye', armor: 'Leather',
    specs: [
      { key: 'havoc',     label: 'Havoc',     role: 'dps' },
      { key: 'vengeance', label: 'Vengeance', role: 'tank' },
      { key: 'devourer',  label: 'Devourer',  role: 'dps', tag: 'new' },
    ]
  },
  { key: 'druid',        label: 'Druid',         color: '#FF7C0A', icon: 'ph-fill ph-leaf', armor: 'Leather',
    specs: [
      { key: 'balance',     label: 'Balance',     role: 'dps' },
      { key: 'feral',       label: 'Feral',       role: 'dps' },
      { key: 'guardian',    label: 'Guardian',    role: 'tank' },
      { key: 'restoration', label: 'Restoration', role: 'heal' },
    ]
  },
  { key: 'evoker',       label: 'Evoker',         color: '#33937F', icon: 'ph-fill ph-flying-saucer', armor: 'Mail',
    specs: [
      { key: 'augmentation', label: 'Augmentation', role: 'dps' },
      { key: 'devastation',  label: 'Devastation',  role: 'dps' },
      { key: 'preservation', label: 'Preservation', role: 'heal' },
    ]
  },
  { key: 'hunter',       label: 'Hunter',         color: '#AAD372', icon: 'ph-fill ph-paw-print', armor: 'Mail',
    specs: [
      { key: 'beastmastery',    label: 'Beast Mastery',    role: 'dps' },
      { key: 'marksmanship',    label: 'Marksmanship',     role: 'dps' },
      { key: 'survival',        label: 'Survival',         role: 'dps' },
    ]
  },
  { key: 'mage',         label: 'Mage',           color: '#3FC7EB', icon: 'ph-fill ph-snowflake', armor: 'Cloth',
    specs: [
      { key: 'arcane', label: 'Arcane', role: 'dps' },
      { key: 'fire',   label: 'Fire',   role: 'dps' },
      { key: 'frost',  label: 'Frost',  role: 'dps' },
    ]
  },
  { key: 'monk',         label: 'Monk',           color: '#00FF98', icon: 'ph-fill ph-yin-yang', armor: 'Leather',
    specs: [
      { key: 'brewmaster',  label: 'Brewmaster',  role: 'tank' },
      { key: 'mistweaver',  label: 'Mistweaver',  role: 'heal' },
      { key: 'windwalker',  label: 'Windwalker',  role: 'dps' },
    ]
  },
  { key: 'paladin',      label: 'Paladin',        color: '#F48CBA', icon: 'ph-fill ph-shield-check', armor: 'Plate',
    specs: [
      { key: 'holy',        label: 'Holy',        role: 'heal' },
      { key: 'protection',  label: 'Protection',  role: 'tank' },
      { key: 'retribution', label: 'Retribution', role: 'dps' },
    ]
  },
  { key: 'priest',       label: 'Priest',         color: '#FFFFFF', icon: 'ph-fill ph-sparkle', armor: 'Cloth',
    specs: [
      { key: 'discipline', label: 'Discipline', role: 'heal' },
      { key: 'holy',       label: 'Holy',       role: 'heal' },
      { key: 'shadow',     label: 'Shadow',     role: 'dps' },
    ]
  },
  { key: 'rogue',        label: 'Rogue',          color: '#FFF468', icon: 'ph-fill ph-knife', armor: 'Leather',
    specs: [
      { key: 'assassination', label: 'Assassination', role: 'dps' },
      { key: 'outlaw',        label: 'Outlaw',        role: 'dps' },
      { key: 'subtlety',      label: 'Subtlety',      role: 'dps' },
    ]
  },
  { key: 'shaman',       label: 'Shaman',         color: '#0070DD', icon: 'ph-fill ph-lightning', armor: 'Mail',
    specs: [
      { key: 'elemental',   label: 'Elemental',   role: 'dps' },
      { key: 'enhancement', label: 'Enhancement', role: 'dps' },
      { key: 'restoration', label: 'Restoration', role: 'heal' },
    ]
  },
  { key: 'warlock',      label: 'Warlock',        color: '#8788EE', icon: 'ph-fill ph-flame', armor: 'Cloth',
    specs: [
      { key: 'affliction',  label: 'Affliction',  role: 'dps' },
      { key: 'demonology',  label: 'Demonology',  role: 'dps' },
      { key: 'destruction', label: 'Destruction', role: 'dps' },
    ]
  },
  { key: 'warrior',      label: 'Warrior',        color: '#C69B3A', icon: 'ph-fill ph-axe', armor: 'Plate',
    specs: [
      { key: 'arms',       label: 'Arms',       role: 'dps' },
      { key: 'fury',       label: 'Fury',       role: 'dps' },
      { key: 'protection', label: 'Protection', role: 'tank' },
    ]
  },
];

/* Class key to Icy Veins URL slug. Spec keys map 1:1 except where the
   published slug is hyphenated (Beast Mastery). */
const BIS_CLASS_SLUGS = {
  deathknight: 'death-knight',
  demonhunter: 'demon-hunter',
  druid: 'druid',
  evoker: 'evoker',
  hunter: 'hunter',
  mage: 'mage',
  monk: 'monk',
  paladin: 'paladin',
  priest: 'priest',
  rogue: 'rogue',
  shaman: 'shaman',
  warlock: 'warlock',
  warrior: 'warrior'
};
const BIS_SPEC_SLUGS  = { beastmastery: 'beast-mastery' };

/* Role segment in the Icy Veins URL. */
const BIS_ROLE_SLUGS = { dps: 'dps', tank: 'tank', heal: 'healing' };

/* Deep link to the Icy Veins gear page for a spec. Both BiS lists live on the
   same page, so this is the destination for either mode. */
function icyVeinsBisUrl(classKey, specKey) {
  const cls = WOW_CLASSES.find(c => c.key === classKey);
  const sp  = cls && cls.specs.find(s => s.key === specKey);
  if (!cls || !sp) return 'https://www.icy-veins.com/wow/midnight-season-2-guide';
  const clsSlug  = BIS_CLASS_SLUGS[classKey] || classKey;
  const specSlug = BIS_SPEC_SLUGS[specKey]   || specKey;
  const roleSlug = BIS_ROLE_SLUGS[sp.role]   || 'dps';
  return 'https://www.icy-veins.com/wow/' + specSlug + '-' + clsSlug
       + '-pve-' + roleSlug + '-gear-best-in-slot';
}

/* Season 2 BiS lists. Every spec carries both shapes so the mode switch never
   has to guess; an empty array means "not transcribed yet", which the picker
   surfaces as a link to the Icy Veins page rather than a blank table. */
const BIS_DATA = {

  deathknight: {
    blood:         { raid: [], mplus: [] },
    frost:         { raid: [], mplus: [] },
    unholy:        { raid: [], mplus: [] },
  },

  demonhunter: {
    havoc:         { raid: [], mplus: [] },
    vengeance:     { raid: [], mplus: [] },
    devourer:      { raid: [], mplus: [] },
  },

  druid: {
    balance:       { raid: [], mplus: [] },
    feral:         { raid: [], mplus: [] },
    guardian:      { raid: [], mplus: [] },
    restoration:   { raid: [], mplus: [] },
  },

  evoker: {
    augmentation:  { raid: [], mplus: [] },
    devastation:   { raid: [], mplus: [] },
    preservation:  { raid: [], mplus: [] },
  },

  hunter: {
    beastmastery:  { raid: [], mplus: [] },
    marksmanship:  { raid: [], mplus: [] },
    survival:      { raid: [], mplus: [] },
  },

  mage: {
    arcane:        { raid: [], mplus: [] },
    fire:          { raid: [], mplus: [] },
    frost:         { raid: [], mplus: [] },
  },

  monk: {
    brewmaster:    { raid: [], mplus: [] },
    mistweaver:    { raid: [], mplus: [] },
    windwalker:    { raid: [], mplus: [] },
  },

  paladin: {
    holy:          { raid: [], mplus: [] },
    protection:    { raid: [], mplus: [] },
    retribution:   { raid: [], mplus: [] },
  },

  priest: {
    discipline:    { raid: [], mplus: [] },
    holy:          { raid: [], mplus: [] },
    shadow:        { raid: [], mplus: [] },
  },

  rogue: {
    assassination: { raid: [], mplus: [] },
    outlaw:        { raid: [], mplus: [] },
    subtlety:      { raid: [], mplus: [] },
  },

  shaman: {
    elemental:     { raid: [], mplus: [] },
    enhancement:   { raid: [], mplus: [] },
    restoration:   { raid: [], mplus: [] },
  },

  warlock: {
    affliction:    { raid: [], mplus: [] },
    demonology:    { raid: [], mplus: [] },
    destruction:   { raid: [], mplus: [] },
  },

  warrior: {
    arms:          { raid: [], mplus: [] },
    fury:          { raid: [], mplus: [] },
    protection:    { raid: [], mplus: [] },
  },

};
