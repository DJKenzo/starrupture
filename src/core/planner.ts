import type { ItemId, Purity, Recipe } from '../data/gameData';
import { ceilSafe, defaultRecipe, inputRate, machineById, outputRate, recipeById, EPS } from './db';

export interface Target {
  item: ItemId;
  /** Items per minute. */
  rate: number;
}

export interface PlanOptions {
  /**
   * Chosen recipe id per item. `null` = do not produce, treat as external
   * input. Missing = default recipe.
   */
  recipeChoice?: Record<ItemId, string | null>;
  purity?: Purity;
  /** Rail throughput in items/min used for rail warnings. */
  railCapacity?: number;
}

export interface Flow {
  item: ItemId;
  rate: number;
}

export interface PlanLine {
  item: ItemId;
  recipe: Recipe;
  /** Total items/min of `item` this line must produce. */
  rate: number;
  machinesExact: number;
  machines: number;
  /** Utilisation of the machines when `machines` (rounded up) are built, 0..1. */
  utilization: number;
  /** Power in MW for the rounded-up machine count (null if unknown). */
  power: number | null;
  inputs: Flow[];
  /** Production depth: 0 = target, higher = further upstream. */
  depth: number;
  /** Rails needed to carry the output with the given rail capacity. */
  railsOut: number;
  /** Items/min one machine produces at 100 %. */
  perMachine: number;
}

export interface Plan {
  targets: Target[];
  lines: PlanLine[];
  /** Items not produced in the plan (raw resources without extractor recipe or user choice). */
  imports: Flow[];
  /** Total demand per item (including targets). */
  demand: Map<ItemId, number>;
  totalPower: number;
  unknownPower: boolean;
  totalMachines: Map<string, number>;
  cycle?: ItemId[];
}

export function chosenRecipe(item: ItemId, opts: PlanOptions): Recipe | undefined {
  const choice = opts.recipeChoice?.[item];
  if (choice === null) return undefined;
  if (choice !== undefined) return recipeById.get(choice) ?? defaultRecipe(item);
  return defaultRecipe(item);
}

/** Topological order (consumers before producers) of all items reachable from the targets. */
function orderItems(targets: Target[], opts: PlanOptions): { order: ItemId[]; depth: Map<ItemId, number>; cycle?: ItemId[] } {
  const state = new Map<ItemId, 1 | 2>();
  const post: ItemId[] = [];
  let cycle: ItemId[] | undefined;
  const stack: ItemId[] = [];

  const visit = (item: ItemId) => {
    const st = state.get(item);
    if (st === 2) return;
    if (st === 1) {
      cycle ??= [...stack.slice(stack.indexOf(item)), item];
      return;
    }
    state.set(item, 1);
    stack.push(item);
    const r = chosenRecipe(item, opts);
    if (r) for (const i of r.inputs) visit(i.item);
    stack.pop();
    state.set(item, 2);
    post.push(item);
  };
  for (const t of targets) visit(t.item);
  const order = post.reverse();

  // longest distance from any target
  const depth = new Map<ItemId, number>();
  for (const t of targets) depth.set(t.item, 0);
  for (const item of order) {
    const d = depth.get(item) ?? 0;
    const r = chosenRecipe(item, opts);
    if (!r) continue;
    for (const i of r.inputs) depth.set(i.item, Math.max(depth.get(i.item) ?? 0, d + 1));
  }
  return { order, depth, cycle };
}

export function plan(targets: Target[], opts: PlanOptions = {}): Plan {
  const purity = opts.purity ?? 'normal';
  const railCapacity = opts.railCapacity ?? 120;
  const valid = targets.filter((t) => t.rate > 0);
  const { order, depth, cycle } = orderItems(valid, opts);

  const demand = new Map<ItemId, number>();
  for (const t of valid) demand.set(t.item, (demand.get(t.item) ?? 0) + t.rate);

  const lines: PlanLine[] = [];
  const imports: Flow[] = [];
  const totalMachines = new Map<string, number>();
  let totalPower = 0;
  let unknownPower = false;

  for (const item of order) {
    const rate = demand.get(item) ?? 0;
    if (rate <= EPS) continue;
    const recipe = chosenRecipe(item, opts);
    if (!recipe) {
      imports.push({ item, rate });
      continue;
    }
    const perMachine = outputRate(recipe, item, purity);
    const machinesExact = rate / perMachine;
    const machines = Math.max(1, ceilSafe(machinesExact));
    const inputs = recipe.inputs.map((i) => ({ item: i.item, rate: inputRate(recipe, i.item) * machinesExact }));
    for (const f of inputs) demand.set(f.item, (demand.get(f.item) ?? 0) + f.rate);

    const m = machineById.get(recipe.machine);
    const power = m?.power == null ? null : m.power * machines;
    if (power == null) unknownPower = true;
    else totalPower += power;
    totalMachines.set(recipe.machine, (totalMachines.get(recipe.machine) ?? 0) + machines);

    lines.push({
      item,
      recipe,
      rate,
      machinesExact,
      machines,
      utilization: machinesExact / machines,
      power,
      inputs,
      depth: depth.get(item) ?? 0,
      railsOut: ceilSafe(rate / railCapacity),
      perMachine,
    });
  }

  lines.sort((a, b) => a.depth - b.depth);
  return { targets: valid, lines, imports, demand, totalPower, unknownPower, totalMachines, cycle };
}

/** Items/min of `item` one machine produces at 100 % with the chosen recipe (undefined if imported). */
export function perMachineRate(item: ItemId, opts: PlanOptions = {}): number | undefined {
  const r = chosenRecipe(item, opts);
  return r ? outputRate(r, item, opts.purity ?? 'normal') : undefined;
}

export interface TreeNode {
  item: ItemId;
  rate: number;
  recipe?: Recipe;
  machinesExact: number;
  children: TreeNode[];
}

/** Expanded production tree for display (shared sub-chains appear multiple times). */
export function buildTree(item: ItemId, rate: number, opts: PlanOptions = {}, seen: ItemId[] = []): TreeNode {
  const recipe = seen.includes(item) ? undefined : chosenRecipe(item, opts);
  if (!recipe) return { item, rate, machinesExact: 0, children: [] };
  const perMachine = outputRate(recipe, item, opts.purity ?? 'normal');
  const machinesExact = rate / perMachine;
  return {
    item,
    rate,
    recipe,
    machinesExact,
    children: recipe.inputs.map((i) => buildTree(i.item, inputRate(recipe, i.item) * machinesExact, opts, [...seen, item])),
  };
}
