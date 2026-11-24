import {
  items,
  machines,
  recipes,
  purityFactor,
  type Item,
  type ItemId,
  type Machine,
  type Purity,
  type Recipe,
  type Stack,
} from '../data/gameData';
import { itemNamesDe, machineNamesDe, type NameMode } from '../data/i18n';

export const itemById = new Map<ItemId, Item>(items.map((i) => [i.id, i]));
export const machineById = new Map<string, Machine>(machines.map((m) => [m.id, m]));
export const recipeById = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));

/** Recipes producing an item, default (non-alternate) first. */
export const recipesFor = new Map<ItemId, Recipe[]>();
/** Recipes consuming an item. */
export const usagesOf = new Map<ItemId, Recipe[]>();

for (const r of recipes) {
  for (const o of r.outputs) {
    const list = recipesFor.get(o.item) ?? [];
    list.push(r);
    recipesFor.set(o.item, list);
  }
  for (const i of r.inputs) {
    const list = usagesOf.get(i.item) ?? [];
    if (!list.includes(r)) list.push(r);
    usagesOf.set(i.item, list);
  }
}
for (const list of recipesFor.values()) {
  list.sort((a, b) => Number(!!a.alternate) - Number(!!b.alternate));
}

let nameMode: NameMode = 'de';
/** Language used for item/machine names (set by the UI). */
export function setNameMode(mode: NameMode) {
  nameMode = mode;
}

function localized(en: string, de: string | undefined): string {
  if (nameMode === 'en' || !de) return en;
  if (nameMode === 'both' && de !== en) return `${de} (${en})`;
  return de;
}

export function itemName(id: ItemId): string {
  const en = itemById.get(id)?.name ?? id;
  return localized(en, itemNamesDe[id]);
}

/** English in-game name of an item. */
export function itemNameEn(id: ItemId): string {
  return itemById.get(id)?.name ?? id;
}

/** Lower-case text matching German and English names, for searching. */
export function itemSearchText(id: ItemId): string {
  return `${itemNamesDe[id] ?? ''} ${itemById.get(id)?.name ?? id}`.toLowerCase();
}

export function machineName(id: string): string {
  const en = machineById.get(id)?.name ?? id;
  return localized(en, machineNamesDe[id]);
}

/** Display name of a recipe: its output, plus a marker for alternates. */
export function recipeName(r: Recipe): string {
  return itemName(r.outputs[0].item) + (r.alternate ? ' (Alternative)' : '');
}

/** Default recipe for an item, or undefined if it can only be imported. */
export function defaultRecipe(item: ItemId): Recipe | undefined {
  return recipesFor.get(item)?.[0];
}

/** Items per minute of one stack for ONE machine running at 100 %. */
export function stackRate(recipe: Recipe, stack: Stack, purity: Purity = 'normal'): number {
  const factor = recipe.purityDependent ? purityFactor[purity] : 1;
  return (stack.amount * 60 * factor) / recipe.time;
}

/** Items per minute of `item` produced by one machine running `recipe`. */
export function outputRate(recipe: Recipe, item: ItemId, purity: Purity = 'normal'): number {
  const st = recipe.outputs.find((o) => o.item === item);
  return st ? stackRate(recipe, st, purity) : 0;
}

/** Items per minute of `item` consumed by one machine running `recipe`. */
export function inputRate(recipe: Recipe, item: ItemId): number {
  const st = recipe.inputs.find((i) => i.item === item);
  return st ? stackRate(recipe, st) : 0;
}

export function primaryOutput(recipe: Recipe): ItemId {
  return recipe.outputs[0].item;
}

export const EPS = 1e-9;

/** Round up, tolerating floating point noise (2.0000000001 -> 2). */
export function ceilSafe(x: number): number {
  return Math.ceil(x - 1e-7);
}
