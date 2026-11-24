/**
 * StarRupture game data.
 *
 * Source: https://starrupture.wiki.gg (scraped Nov 2026, Early Access).
 * Where wiki pages contradicted each other, the value stated on the majority
 * of pages was used; such recipes carry `uncertain: true` and a `note`.
 *
 * Every recipe is defined per crafting cycle: `time` seconds for one cycle,
 * consuming `inputs` and producing `outputs`.
 */

export type MachineId = string;
export type ItemId = string;

export interface Machine {
  id: MachineId;
  name: string;
  /** Power usage in MW, null if unknown. */
  power: number | null;
  kind: 'extractor' | 'production';
  /** Tier for sorting / grouping. */
  tier: number;
}

export interface Item {
  id: ItemId;
  name: string;
  /** Raw resource gathered by an extractor (or not craftable at all). */
  raw?: boolean;
}

export interface Stack {
  item: ItemId;
  amount: number;
}

export interface Recipe {
  id: string;
  name: string;
  machine: MachineId;
  /** Cycle time in seconds. */
  time: number;
  inputs: Stack[];
  outputs: Stack[];
  /** Alternate recipe (e.g. v.2 machines); never chosen by default. */
  alternate?: boolean;
  /** Extractors only: output scales with node purity. */
  purityDependent?: boolean;
  uncertain?: boolean;
  note?: string;
}

export const machines: Machine[] = [
  { id: 'ore-excavator', name: 'Ore Excavator', power: 5, kind: 'extractor', tier: 0 },
  { id: 'helium-extractor', name: 'Helium-3 Extractor', power: 15, kind: 'extractor', tier: 0 },
  { id: 'sulfur-extractor', name: 'Sulfur Extractor', power: 40, kind: 'extractor', tier: 0 },
  { id: 'smelter', name: 'Smelter', power: 5, kind: 'production', tier: 1 },
  { id: 'fabricator', name: 'Fabricator', power: 10, kind: 'production', tier: 1 },
  { id: 'fabricator-v2', name: 'Fabricator v.2', power: 25, kind: 'production', tier: 2 },
  { id: 'furnace', name: 'Furnace', power: 20, kind: 'production', tier: 2 },
  { id: 'furnace-v2', name: 'Furnace v.2', power: 50, kind: 'production', tier: 3 },
  { id: 'refinery', name: 'Refinery', power: 40, kind: 'production', tier: 3 },
  { id: 'mega-press', name: 'Mega Press', power: 30, kind: 'production', tier: 3 },
  { id: 'pyro-forge', name: 'Pyro Forge', power: null, kind: 'production', tier: 4 },
  { id: 'assembler', name: 'Assembler', power: 60, kind: 'production', tier: 4 },
  { id: 'compounder', name: 'Compounder', power: null, kind: 'production', tier: 4 },
  { id: 'constructorizer', name: 'Constructorizer', power: null, kind: 'production', tier: 5 },
];

const itemNames: [ItemId, string, boolean?][] = [
  // raw resources
  ['titanium-ore', 'Titanium Ore', true],
  ['wolfram-ore', 'Wolfram Ore', true],
  ['calcium-ore', 'Calcium Ore', true],
  ['helium-3', 'Helium-3', true],
  ['sulfur-ore', 'Sulfur Ore', true],
  ['goethite-ore', 'Goethite Ore', true],
  ['quartz-ore', 'Quartz Ore', true],
  // no known recipe on the wiki yet -> treated as external input
  ['goethite-ingot', 'Goethite Ingot', true],
  ['generator', 'Generator', true],
  ['reinforced-frame', 'Reinforced Frame', true],
  ['plastic-dust', 'Plastic Dust', true],
  // smelter
  ['titanium-bar', 'Titanium Bar'],
  ['wolfram-bar', 'Wolfram Bar'],
  ['calcium-block', 'Calcium Block'],
  // fabricator
  ['basic-building-material', 'Basic Building Material'],
  ['titanium-rod', 'Titanium Rod'],
  ['titanium-beam', 'Titanium Beam'],
  ['titanium-sheet', 'Titanium Sheet'],
  ['wolfram-plate', 'Wolfram Plate'],
  ['wolfram-wire', 'Wolfram Wire'],
  ['calcite-sheets', 'Calcite Sheets'],
  ['rotor', 'Rotor'],
  ['tube', 'Tube'],
  ['stabilizer', 'Stabilizer'],
  ['stator', 'Stator'],
  ['applicator', 'Applicator'],
  ['pistol-ammo', 'Pistol Ammo'],
  // furnace
  ['titanium-housing', 'Titanium Housing'],
  ['calcium-powder', 'Calcium Powder'],
  ['wolfram-powder', 'Wolfram Powder'],
  ['ceramics', 'Ceramics'],
  ['glass', 'Glass'],
  ['synthetic-silicon', 'Synthetic Silicon'],
  ['chemicals', 'Chemicals'],
  ['electronics', 'Electronics'],
  ['inductor', 'Inductor'],
  ['heat-resistant-sheet', 'Heat Resistant Sheet'],
  ['hardening-agent', 'Hardening Agent'],
  ['supermagnet', 'Supermagnet'],
  // refinery
  ['sulfuric-acid', 'Sulfuric Acid'],
  ['pressurized-helium', 'Pressurized Helium'],
  // mega press
  ['intermediate-building-material', 'Intermediate Building Material'],
  ['standard-ammo', 'Standard Ammo'],
  ['shotgun-ammo', 'Shotgun Ammo'],
  ['heavy-ammo', 'Heavy Ammo'],
  ['impeller', 'Impeller'],
  ['nozzle', 'Nozzle'],
  ['battery', 'Battery'],
  ['turbine', 'Turbine'],
  ['valve', 'Valve'],
  ['electromagnetic-coil', 'Electromagnetic Coil'],
  ['pump', 'Pump'],
  // pyro forge
  ['titanoferrite-ingot', 'Titanoferrite Ingot'],
  ['wolfram-steel-ingot', 'Wolfram Steel Ingot'],
  // assembler
  ['accumulator', 'Accumulator'],
  ['pressure-tank', 'Pressure Tank'],
  ['electromagnet', 'Electromagnet'],
  ['resonator', 'Resonator'],
  ['laser-emitter', 'Laser Emitter'],
  ['condenser', 'Condenser'],
  // compounder
  ['synthetic-resin', 'Synthetic Resin'],
  ['liquid-helium', 'Liquid Helium'],
  ['nanofibre', 'Nanofibre'],
  ['lens', 'Lens'],
  ['superconductor', 'Superconductor'],
  ['ion-injector', 'Ion Injector'],
  // constructorizer
  ['scaffolding', 'Scaffolding'],
];

export const items: Item[] = itemNames.map(([id, name, raw]) => ({ id, name, raw: raw || undefined }));

/** Shorthand: "2 titanium-ore" style stacks. */
const s = (amount: number, item: ItemId): Stack => ({ item, amount });

export const recipes: Recipe[] = [
  // ---- extractors (base rate = impure node for ore excavator) ----
  { id: 'x-titanium-ore', name: 'Titanium Ore', machine: 'ore-excavator', time: 2, inputs: [], outputs: [s(2, 'titanium-ore')], purityDependent: true },
  { id: 'x-wolfram-ore', name: 'Wolfram Ore', machine: 'ore-excavator', time: 2, inputs: [], outputs: [s(2, 'wolfram-ore')], purityDependent: true },
  { id: 'x-calcium-ore', name: 'Calcium Ore', machine: 'ore-excavator', time: 2, inputs: [], outputs: [s(2, 'calcium-ore')], purityDependent: true },
  { id: 'x-helium-3', name: 'Helium-3', machine: 'helium-extractor', time: 2, inputs: [], outputs: [s(8, 'helium-3')] },
  { id: 'x-sulfur-ore', name: 'Sulfur Ore', machine: 'sulfur-extractor', time: 2, inputs: [], outputs: [s(8, 'sulfur-ore')] },

  // ---- smelter ----
  { id: 'titanium-bar', name: 'Titanium Bar', machine: 'smelter', time: 2, inputs: [s(2, 'titanium-ore')], outputs: [s(2, 'titanium-bar')] },
  { id: 'wolfram-bar', name: 'Wolfram Bar', machine: 'smelter', time: 2, inputs: [s(2, 'wolfram-ore')], outputs: [s(2, 'wolfram-bar')] },
  { id: 'calcium-block', name: 'Calcium Block', machine: 'smelter', time: 2, inputs: [s(2, 'calcium-ore')], outputs: [s(2, 'calcium-block')] },

  // ---- fabricator ----
  { id: 'basic-building-material', name: 'Basic Building Material', machine: 'fabricator', time: 2, inputs: [s(1, 'titanium-ore'), s(1, 'wolfram-ore')], outputs: [s(10, 'basic-building-material')] },
  { id: 'titanium-rod', name: 'Titanium Rod', machine: 'fabricator', time: 2, inputs: [s(1, 'titanium-bar')], outputs: [s(1, 'titanium-rod')] },
  { id: 'titanium-beam', name: 'Titanium Beam', machine: 'fabricator', time: 3, inputs: [s(1, 'titanium-bar')], outputs: [s(1, 'titanium-beam')], uncertain: true, note: 'Wiki uneinheitlich (auch 2 Bar → 3 Beam).' },
  { id: 'titanium-sheet', name: 'Titanium Sheet', machine: 'fabricator', time: 2, inputs: [s(1, 'titanium-bar')], outputs: [s(2, 'titanium-sheet')] },
  { id: 'wolfram-plate', name: 'Wolfram Plate', machine: 'fabricator', time: 1, inputs: [s(1, 'wolfram-bar')], outputs: [s(1, 'wolfram-plate')] },
  { id: 'wolfram-wire', name: 'Wolfram Wire', machine: 'fabricator', time: 4, inputs: [s(1, 'wolfram-bar')], outputs: [s(2, 'wolfram-wire')] },
  { id: 'calcite-sheets', name: 'Calcite Sheets', machine: 'fabricator', time: 2, inputs: [s(1, 'calcium-block')], outputs: [s(2, 'calcite-sheets')] },
  { id: 'rotor', name: 'Rotor', machine: 'fabricator', time: 6, inputs: [s(2, 'titanium-rod'), s(2, 'wolfram-wire')], outputs: [s(1, 'rotor')] },
  { id: 'tube', name: 'Tube', machine: 'fabricator', time: 2, inputs: [s(1, 'titanium-rod'), s(1, 'titanium-sheet')], outputs: [s(2, 'tube')] },
  { id: 'stabilizer', name: 'Stabilizer', machine: 'fabricator', time: 3, inputs: [s(1, 'rotor'), s(2, 'titanium-rod')], outputs: [s(1, 'stabilizer')], uncertain: true, note: 'Wiki nennt teils 6 s.' },
  { id: 'stator', name: 'Stator', machine: 'fabricator', time: 3, inputs: [s(2, 'titanium-housing'), s(1, 'wolfram-wire')], outputs: [s(1, 'stator')] },
  { id: 'applicator', name: 'Applicator', machine: 'fabricator', time: 4, inputs: [s(8, 'tube'), s(2, 'glass')], outputs: [s(1, 'applicator')] },
  { id: 'pistol-ammo', name: 'Pistol Ammo', machine: 'fabricator', time: 6, inputs: [s(14, 'basic-building-material')], outputs: [s(25, 'pistol-ammo')] },

  // ---- fabricator v.2 (alternates) ----
  { id: 'v2-titanium-rod', name: 'Titanium Rod (v.2)', machine: 'fabricator-v2', time: 2, inputs: [s(2, 'titanium-bar')], outputs: [s(4, 'titanium-rod')], alternate: true },
  { id: 'v2-titanium-sheet', name: 'Titanium Sheet (v.2)', machine: 'fabricator-v2', time: 2, inputs: [s(2, 'titanium-bar')], outputs: [s(6, 'titanium-sheet')], alternate: true },
  { id: 'v2-wolfram-plate', name: 'Wolfram Plate (v.2)', machine: 'fabricator-v2', time: 2, inputs: [s(2, 'wolfram-bar'), s(1, 'wolfram-powder')], outputs: [s(5, 'wolfram-plate')], alternate: true },
  { id: 'v2-wolfram-wire', name: 'Wolfram Wire (v.2)', machine: 'fabricator-v2', time: 4, inputs: [s(2, 'wolfram-bar')], outputs: [s(8, 'wolfram-wire')], alternate: true },
  { id: 'v2-rotor', name: 'Rotor (v.2)', machine: 'fabricator-v2', time: 6, inputs: [s(1, 'titanium-rod'), s(2, 'wolfram-wire'), s(1, 'wolfram-plate')], outputs: [s(6, 'rotor')], alternate: true },
  { id: 'v2-stator', name: 'Stator (v.2)', machine: 'fabricator-v2', time: 3, inputs: [s(1, 'titanium-housing'), s(1, 'wolfram-wire'), s(1, 'titanium-sheet')], outputs: [s(3, 'stator')], alternate: true },
  { id: 'v2-tube', name: 'Tube (v.2)', machine: 'fabricator-v2', time: 2, inputs: [s(1, 'goethite-ingot'), s(1, 'titanium-sheet'), s(1, 'wolfram-powder')], outputs: [s(8, 'tube')], alternate: true },

  // ---- furnace ----
  { id: 'titanium-housing', name: 'Titanium Housing', machine: 'furnace', time: 2, inputs: [s(1, 'titanium-beam'), s(2, 'titanium-sheet')], outputs: [s(1, 'titanium-housing')], uncertain: true, note: 'Wiki nennt teils Fabricator als Maschine.' },
  { id: 'calcium-powder', name: 'Calcium Powder', machine: 'furnace', time: 3, inputs: [s(1, 'calcium-block')], outputs: [s(3, 'calcium-powder')] },
  { id: 'wolfram-powder', name: 'Wolfram Powder', machine: 'furnace', time: 2, inputs: [s(1, 'wolfram-bar')], outputs: [s(3, 'wolfram-powder')] },
  { id: 'ceramics', name: 'Ceramics', machine: 'furnace', time: 2, inputs: [s(1, 'calcite-sheets'), s(1, 'wolfram-powder')], outputs: [s(2, 'ceramics')] },
  { id: 'glass', name: 'Glass', machine: 'furnace', time: 3, inputs: [s(1, 'helium-3'), s(2, 'calcium-powder')], outputs: [s(1, 'glass')] },
  { id: 'synthetic-silicon', name: 'Synthetic Silicon', machine: 'furnace', time: 2, inputs: [s(2, 'calcium-powder'), s(1, 'helium-3'), s(2, 'ceramics')], outputs: [s(2, 'synthetic-silicon')] },
  { id: 'chemicals', name: 'Chemicals', machine: 'furnace', time: 2, inputs: [s(1, 'synthetic-silicon'), s(3, 'wolfram-powder'), s(1, 'helium-3')], outputs: [s(2, 'chemicals')], uncertain: true, note: 'Wiki nennt teils Refinery als Maschine.' },
  { id: 'electronics', name: 'Electronics', machine: 'furnace', time: 5, inputs: [s(2, 'synthetic-silicon'), s(1, 'inductor'), s(1, 'stator')], outputs: [s(1, 'electronics')] },
  { id: 'inductor', name: 'Inductor', machine: 'furnace', time: 4, inputs: [s(2, 'tube'), s(1, 'wolfram-wire'), s(2, 'ceramics')], outputs: [s(2, 'inductor')], uncertain: true, note: 'Wiki nennt teils 1 Inductor in 3 s.' },
  { id: 'heat-resistant-sheet', name: 'Heat Resistant Sheet', machine: 'furnace', time: 4, inputs: [s(1, 'wolfram-plate'), s(2, 'titanium-sheet'), s(1, 'glass')], outputs: [s(1, 'heat-resistant-sheet')] },
  { id: 'hardening-agent', name: 'Hardening Agent', machine: 'furnace', time: 4, inputs: [s(5, 'sulfuric-acid'), s(1, 'synthetic-silicon'), s(1, 'applicator')], outputs: [s(2, 'hardening-agent')] },
  { id: 'supermagnet', name: 'Supermagnet', machine: 'furnace', time: 3, inputs: [s(5, 'sulfuric-acid'), s(5, 'wolfram-plate'), s(2, 'chemicals')], outputs: [s(1, 'supermagnet')], uncertain: true, note: 'Wiki nennt teils 4 Acid + 4 Plate + 1 Chemicals.' },

  // ---- furnace v.2 (alternates) ----
  { id: 'v2-calcium-powder', name: 'Calcium Powder (v.2)', machine: 'furnace-v2', time: 3, inputs: [s(2, 'calcium-block')], outputs: [s(10, 'calcium-powder')], alternate: true, uncertain: true, note: 'Wiki nennt teils 3 Calcium Block.' },
  { id: 'v2-wolfram-powder', name: 'Wolfram Powder (v.2)', machine: 'furnace-v2', time: 2, inputs: [s(2, 'wolfram-bar')], outputs: [s(10, 'wolfram-powder')], alternate: true },
  { id: 'v2-ceramics', name: 'Ceramics (v.2)', machine: 'furnace-v2', time: 2, inputs: [s(1, 'calcite-sheets'), s(2, 'helium-3'), s(1, 'wolfram-powder')], outputs: [s(4, 'ceramics')], alternate: true },
  { id: 'v2-chemicals', name: 'Chemicals (v.2)', machine: 'furnace-v2', time: 2, inputs: [s(1, 'calcium-powder'), s(2, 'wolfram-powder'), s(4, 'helium-3'), s(1, 'goethite-ingot')], outputs: [s(4, 'chemicals')], alternate: true },
  { id: 'v2-glass', name: 'Glass (v.2)', machine: 'furnace-v2', time: 3, inputs: [s(1, 'pressurized-helium'), s(1, 'calcite-sheets'), s(1, 'goethite-ingot')], outputs: [s(1, 'glass')], alternate: true },
  { id: 'v2-hardening-agent', name: 'Hardening Agent (v.2)', machine: 'furnace-v2', time: 4, inputs: [s(2, 'sulfuric-acid'), s(1, 'synthetic-silicon'), s(1, 'applicator'), s(1, 'pressurized-helium')], outputs: [s(5, 'hardening-agent')], alternate: true },
  { id: 'v2-heat-resistant-sheet', name: 'Heat Resistant Sheet (v.2)', machine: 'furnace-v2', time: 4, inputs: [s(1, 'titanoferrite-ingot'), s(1, 'wolfram-steel-ingot'), s(3, 'helium-3')], outputs: [s(5, 'heat-resistant-sheet')], alternate: true },

  // ---- refinery ----
  { id: 'sulfuric-acid', name: 'Sulfuric Acid', machine: 'refinery', time: 0.5, inputs: [s(2, 'sulfur-ore'), s(1, 'chemicals')], outputs: [s(1, 'sulfuric-acid')], uncertain: true, note: 'Wiki nennt teils 1 Sulfur Ore statt 2.' },
  { id: 'pressurized-helium', name: 'Pressurized Helium', machine: 'refinery', time: 2, inputs: [s(1, 'helium-3'), s(1, 'sulfur-ore')], outputs: [s(1, 'pressurized-helium')] },

  // ---- mega press ----
  { id: 'intermediate-building-material', name: 'Intermediate Building Material', machine: 'mega-press', time: 6, inputs: [s(40, 'basic-building-material'), s(2, 'inductor'), s(2, 'glass'), s(2, 'titanium-housing')], outputs: [s(25, 'intermediate-building-material')] },
  { id: 'standard-ammo', name: 'Standard Ammo', machine: 'mega-press', time: 6, inputs: [s(18, 'basic-building-material'), s(4, 'wolfram-powder')], outputs: [s(20, 'standard-ammo')] },
  { id: 'shotgun-ammo', name: 'Shotgun Ammo', machine: 'mega-press', time: 6, inputs: [s(20, 'basic-building-material'), s(6, 'calcium-powder')], outputs: [s(15, 'shotgun-ammo')] },
  { id: 'heavy-ammo', name: 'Heavy Ammo', machine: 'mega-press', time: 6, inputs: [s(24, 'basic-building-material'), s(6, 'titanium-rod')], outputs: [s(15, 'heavy-ammo')] },
  { id: 'impeller', name: 'Impeller', machine: 'mega-press', time: 4, inputs: [s(2, 'titanium-rod'), s(2, 'heat-resistant-sheet'), s(1, 'wolfram-plate'), s(1, 'stabilizer')], outputs: [s(1, 'impeller')] },
  { id: 'nozzle', name: 'Nozzle', machine: 'mega-press', time: 5, inputs: [s(2, 'heat-resistant-sheet'), s(1, 'helium-3'), s(2, 'stabilizer')], outputs: [s(1, 'nozzle')] },
  { id: 'battery', name: 'Battery', machine: 'mega-press', time: 4, inputs: [s(2, 'inductor'), s(2, 'electronics'), s(1, 'sulfuric-acid')], outputs: [s(1, 'battery')] },
  { id: 'turbine', name: 'Turbine', machine: 'mega-press', time: 6, inputs: [s(1, 'impeller'), s(1, 'stator'), s(2, 'rotor'), s(2, 'sulfuric-acid')], outputs: [s(1, 'turbine')] },
  { id: 'valve', name: 'Valve', machine: 'mega-press', time: 10, inputs: [s(1, 'titanium-housing'), s(3, 'titanium-beam'), s(2, 'titanium-rod'), s(1, 'nozzle')], outputs: [s(1, 'valve')] },
  { id: 'electromagnetic-coil', name: 'Electromagnetic Coil', machine: 'mega-press', time: 4, inputs: [s(1, 'inductor'), s(1, 'pressurized-helium'), s(6, 'wolfram-plate'), s(1, 'supermagnet')], outputs: [s(1, 'electromagnetic-coil')] },
  { id: 'pump', name: 'Pump', machine: 'mega-press', time: 10, inputs: [s(1, 'valve'), s(1, 'turbine'), s(1, 'impeller'), s(3, 'sulfuric-acid')], outputs: [s(1, 'pump')] },

  // ---- pyro forge ----
  { id: 'titanoferrite-ingot', name: 'Titanoferrite Ingot', machine: 'pyro-forge', time: 1, inputs: [s(2, 'titanium-bar'), s(2, 'goethite-ore')], outputs: [s(2, 'titanoferrite-ingot')] },
  { id: 'wolfram-steel-ingot', name: 'Wolfram Steel Ingot', machine: 'pyro-forge', time: 1, inputs: [s(2, 'wolfram-bar'), s(2, 'goethite-ore')], outputs: [s(1, 'wolfram-steel-ingot')] },

  // ---- assembler ----
  { id: 'accumulator', name: 'Accumulator', machine: 'assembler', time: 6, inputs: [s(2, 'electronics'), s(1, 'stator'), s(2, 'battery')], outputs: [s(1, 'accumulator')] },
  { id: 'pressure-tank', name: 'Pressure Tank', machine: 'assembler', time: 12, inputs: [s(5, 'heat-resistant-sheet'), s(3, 'titanium-housing'), s(3, 'pump'), s(2, 'valve')], outputs: [s(1, 'pressure-tank')] },
  { id: 'electromagnet', name: 'Electromagnet', machine: 'assembler', time: 5, inputs: [s(3, 'electromagnetic-coil'), s(3, 'synthetic-resin'), s(2, 'accumulator')], outputs: [s(1, 'electromagnet')] },
  { id: 'resonator', name: 'Resonator', machine: 'assembler', time: 12, inputs: [s(1, 'accumulator'), s(2, 'generator'), s(2, 'liquid-helium')], outputs: [s(1, 'resonator')] },
  { id: 'laser-emitter', name: 'Laser Emitter', machine: 'assembler', time: 6, inputs: [s(2, 'lens'), s(1, 'resonator'), s(6, 'electromagnetic-coil')], outputs: [s(1, 'laser-emitter')] },
  { id: 'condenser', name: 'Condenser', machine: 'assembler', time: 15, inputs: [s(1, 'resonator'), s(3, 'synthetic-resin'), s(8, 'nanofibre'), s(3, 'pump')], outputs: [s(1, 'condenser')] },

  // ---- compounder ----
  { id: 'synthetic-resin', name: 'Synthetic Resin', machine: 'compounder', time: 3, inputs: [s(2, 'hardening-agent'), s(4, 'sulfuric-acid'), s(10, 'calcite-sheets')], outputs: [s(1, 'synthetic-resin')] },
  { id: 'liquid-helium', name: 'Liquid Helium', machine: 'compounder', time: 3, inputs: [s(1, 'pressurized-helium'), s(1, 'hardening-agent')], outputs: [s(1, 'liquid-helium')] },
  { id: 'nanofibre', name: 'Nanofibre', machine: 'compounder', time: 5, inputs: [s(20, 'tube'), s(5, 'liquid-helium')], outputs: [s(1, 'nanofibre')] },
  { id: 'lens', name: 'Lens', machine: 'compounder', time: 12, inputs: [s(10, 'glass'), s(8, 'hardening-agent'), s(8, 'synthetic-resin')], outputs: [s(1, 'lens')] },
  { id: 'superconductor', name: 'Superconductor', machine: 'compounder', time: 5, inputs: [s(7, 'ceramics'), s(2, 'electromagnet'), s(8, 'supermagnet')], outputs: [s(1, 'superconductor')] },
  { id: 'ion-injector', name: 'Ion Injector', machine: 'compounder', time: 12, inputs: [s(10, 'applicator'), s(4, 'electromagnet'), s(2, 'pressure-tank')], outputs: [s(1, 'ion-injector')] },

  // ---- constructorizer ----
  { id: 'scaffolding', name: 'Scaffolding', machine: 'constructorizer', time: 12, inputs: [s(2, 'calcite-sheets'), s(2, 'reinforced-frame'), s(1, 'plastic-dust'), s(1, 'nanofibre')], outputs: [s(1, 'scaffolding')] },
];

export type Purity = 'impure' | 'normal' | 'pure';
export const purityFactor: Record<Purity, number> = { impure: 1, normal: 2, pure: 4 };
export const purityLabel: Record<Purity, string> = { impure: 'Unrein', normal: 'Normal', pure: 'Rein' };

export interface RailTier {
  id: string;
  name: string;
  /** Items per minute. */
  capacity: number;
}

/** Rail throughput (community sources; v2 value unverified). */
export const railTiers: RailTier[] = [
  { id: 'rail-v1', name: 'Rail v1', capacity: 120 },
  { id: 'rail-v2', name: 'Rail v2', capacity: 240 },
  { id: 'rail-v3', name: 'Rail v3', capacity: 480 },
];
