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

export function itemName(id: ItemId): string {
  return itemById.get(id)?.name ?? id;
}

export function machineName(id: string): string {
  return machineById.get(id)?.name ?? id;
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
