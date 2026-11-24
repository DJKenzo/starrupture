import type { ItemId, Purity } from '../data/gameData';
import { ceilSafe, EPS, inputRate, itemName, machineById, outputRate, recipeById } from './db';

/** A set of identical machines running the same recipe. */
export interface FactoryGroup {
  id: string;
  recipeId: string;
  count: number;
  /** Node purity, extractors only. */
  purity?: Purity;
}

/** Items entering the factory from outside (storage, other base, ...). */
export interface FactorySource {
  id: string;
  item: ItemId;
  rate: number;
}

export interface Factory {
  name: string;
  groups: FactoryGroup[];
  sources: FactorySource[];
}

export type GroupStatus = 'ok' | 'starved' | 'bottleneck' | 'surplus' | 'idle';

export interface InputState {
  item: ItemId;
  /** Items/min needed at 100 %. */
  need: number;
  /** Items/min actually received. */
  received: number;
}

export interface GroupResult {
  group: FactoryGroup;
  /** 0..1 — how much of the time the machines are running. */
  utilization: number;
  status: GroupStatus;
  /** Input that limits the machines (if starved). */
  limitingInput?: ItemId;
  inputs: InputState[];
  outputs: { item: ItemId; max: number; actual: number }[];
  power: number | null;
  /** Rails needed per input/output flow at full speed. */
  railsNeeded: { item: ItemId; dir: 'in' | 'out'; rate: number; rails: number }[];
  messages: string[];
}

export interface ItemBalance {
  item: ItemId;
  /** Max production if every producer runs at 100 %. */
  maxSupply: number;
  /** Actual production (producers may be throttled). */
  supply: number;
  /** Demand if every consumer runs at 100 %. */
  demand: number;
  /** Actually consumed. */
  consumed: number;
  /** Producers' machine count suggestion to cover full demand. */
  missingMachines: number;
  producerRecipe?: string;
  isFinal: boolean;
}

export interface FactoryResult {
  groups: GroupResult[];
  balance: ItemBalance[];
  totalPower: number;
  unknownPower: boolean;
}

interface Node {
  g: FactoryGroup;
  need: Map<ItemId, number>; // full-speed input need, whole group
  out: Map<ItemId, number>; // full-speed output, whole group
}

/**
 * Simulate a factory where every item is shared through a common pool
 * (all producers of an item feed all consumers of that item).
 *
 * Machines that do not get enough input slow down; scarce items are split
 * between consumers in proportion to their need (max-min fair), and
 * consumers that are limited by another input release their share.
 */
export function simulate(factory: Factory, railCapacity = 120): FactoryResult {
  const nodes: Node[] = [];
  for (const g of factory.groups) {
    const r = recipeById.get(g.recipeId);
    if (!r || g.count <= 0) continue;
    const need = new Map<ItemId, number>();
    const out = new Map<ItemId, number>();
    for (const i of r.inputs) need.set(i.item, (need.get(i.item) ?? 0) + inputRate(r, i.item) * g.count);
    for (const o of r.outputs) out.set(o.item, (out.get(o.item) ?? 0) + outputRate(r, o.item, g.purity ?? 'normal') * g.count);
    nodes.push({ g, need, out });
  }

  const external = new Map<ItemId, number>();
  for (const s of factory.sources) if (s.rate > 0) external.set(s.item, (external.get(s.item) ?? 0) + s.rate);

  const allItems = new Set<ItemId>(external.keys());
  for (const n of nodes) {
    n.need.forEach((_, k) => allItems.add(k));
    n.out.forEach((_, k) => allItems.add(k));
  }

  // Every node runs at u <= min(inLimit, outLimit):
  //  inLimit  – what its inputs allow (supply side)
  //  outLimit – what downstream consumers actually take (rails back up otherwise)
  // Final products (no consumer in this factory) are never throttled.
  let inLimit = nodes.map(() => 1);
  let outLimit = nodes.map(() => 1);
  let u = nodes.map(() => 1);
  let limitedBy: (ItemId | undefined)[] = nodes.map(() => undefined);
  const consumersOf = new Map<ItemId, number[]>();
  nodes.forEach((n, k) => n.need.forEach((_, item) => consumersOf.set(item, [...(consumersOf.get(item) ?? []), k])));

  for (let iter = 0; iter < 1000; iter++) {
    // potential supply: producers run as fast as their inputs allow
    const potential = new Map<ItemId, number>(external);
    nodes.forEach((n, k) => n.out.forEach((v, item) => potential.set(item, (potential.get(item) ?? 0) + v * inLimit[k])));

    const fill = progressiveFill(nodes, potential, outLimit);
    const nextU = fill.u;

    const nextIn = nodes.map((_, k) => (fill.limitedBy[k] ? nextU[k] : 1));
    const nextOut = nodes.map((n) => {
      let v = 1;
      n.out.forEach((_, item) => {
        const cons = consumersOf.get(item);
        if (!cons) return; // final product
        const pot = potential.get(item) ?? 0;
        const used = cons.reduce((a, c) => a + (nodes[c].need.get(item) ?? 0) * nextU[c], 0);
        if (pot > EPS) v = Math.min(v, used / pot);
      });
      return Math.min(1, v);
    });

    const delta = Math.max(
      0,
      ...nextIn.map((v, k) => Math.abs(v - inLimit[k])),
      ...nextOut.map((v, k) => Math.abs(v - outLimit[k])),
      ...nextU.map((v, k) => Math.abs(v - u[k])),
    );
    // light damping avoids ping-pong between up- and downstream limits
    const damp = iter > 50 ? 0.5 : 1;
    inLimit = nextIn.map((v, k) => inLimit[k] + (v - inLimit[k]) * damp);
    outLimit = nextOut.map((v, k) => outLimit[k] + (v - outLimit[k]) * damp);
    u = nextU;
    limitedBy = fill.limitedBy;
    if (delta < 1e-10) break;
  }
  const received = nodes.map((n, k) => new Map<ItemId, number>([...n.need].map(([item, need]) => [item, need * u[k]])));

  // --- results ---
  const supply = new Map<ItemId, number>(external);
  const maxSupply = new Map<ItemId, number>(external);
  const demand = new Map<ItemId, number>();
  const consumed = new Map<ItemId, number>();
  nodes.forEach((n, k) => {
    n.out.forEach((v, item) => {
      supply.set(item, (supply.get(item) ?? 0) + v * u[k]);
      maxSupply.set(item, (maxSupply.get(item) ?? 0) + v);
    });
    n.need.forEach((v, item) => {
      demand.set(item, (demand.get(item) ?? 0) + v);
      consumed.set(item, (consumed.get(item) ?? 0) + v * u[k]);
    });
  });

  const balance: ItemBalance[] = [...allItems].map((item) => {
    const producer = nodes.find((n) => n.out.has(item));
    const perMachine = producer ? (producer.out.get(item) ?? 0) / producer.g.count : 0;
    const dem = demand.get(item) ?? 0;
    const max = maxSupply.get(item) ?? 0;
    return {
      item,
      maxSupply: max,
      supply: supply.get(item) ?? 0,
      demand: dem,
      consumed: consumed.get(item) ?? 0,
      missingMachines: dem > max + EPS && perMachine > 0 ? ceilSafe((dem - max) / perMachine) : 0,
      producerRecipe: producer?.g.recipeId,
      isFinal: dem <= EPS,
    };
  });
  const balanceByItem = new Map(balance.map((b) => [b.item, b]));

  let totalPower = 0;
  let unknownPower = false;
  const groups: GroupResult[] = nodes.map((n, k) => {
    const r = recipeById.get(n.g.recipeId)!;
    const m = machineById.get(r.machine);
    const power = m?.power == null ? null : m.power * n.g.count;
    if (power == null) unknownPower = true;
    else totalPower += power * (u[k] > EPS ? 1 : 0);

    const inputs: InputState[] = [...n.need].map(([item, need]) => ({ item, need, received: received[k].get(item) ?? 0 }));
    const limitingInput = limitedBy[k];
    const starved = !!limitingInput && u[k] < 1 - 1e-6;
    const outputs = [...n.out].map(([item, max]) => ({ item, max, actual: max * u[k] }));
    const messages: string[] = [];

    let status: GroupStatus = 'ok';
    if (u[k] <= 1e-6) status = 'idle';
    else if (starved) status = 'starved';
    else if (u[k] < 1 - 1e-6) {
      status = 'surplus';
      const o = outputs[0];
      messages.push(
        `Überkapazität: nachgelagert werden nur ${fmt(o.actual, 2)}/min von max. ${fmt(o.max, 2)}/min abgenommen – Maschinen pausieren zeitweise.`,
      );
    }
    for (const o of outputs) {
      const b = balanceByItem.get(o.item)!;
      if (b.demand > b.maxSupply + 1e-6) {
        status = 'bottleneck';
        messages.push(`Ausgabe reicht nicht: ${fmt(b.demand, 2)}/min benötigt, max. ${fmt(b.maxSupply, 2)}/min. +${b.missingMachines} Maschine(n) nötig.`);
      }
    }
    if (limitingInput) {
      const i = inputs.find((x) => x.item === limitingInput)!;
      messages.unshift(`Zu wenig ${itemName(limitingInput)}: bekommt ${fmt(i.received, 2)}/min, braucht ${fmt(i.need, 2)}/min.`);
    }

    const railsNeeded = [
      ...[...n.need].map(([item, rate]) => ({ item, dir: 'in' as const, rate, rails: ceilSafe(rate / railCapacity) })),
      ...[...n.out].map(([item, rate]) => ({ item, dir: 'out' as const, rate, rails: ceilSafe(rate / railCapacity) })),
    ];

    return { group: n.g, utilization: u[k], status, limitingInput, inputs, outputs, power, railsNeeded, messages };
  });

  return { groups, balance, totalPower, unknownPower };
}

/**
 * Max-min fair allocation for one round: all nodes raise their utilisation
 * together; when an item runs out, its consumers freeze at that level.
 * `cap[k]` is the most node k may run at (downstream limit).
 */
function progressiveFill(nodes: Node[], supply: Map<ItemId, number>, cap: number[]) {
  const u = nodes.map(() => 0);
  const limitedBy: (ItemId | undefined)[] = nodes.map(() => undefined);
  const active = new Set(nodes.map((_, k) => k));
  // nodes without inputs only depend on their cap
  nodes.forEach((n, k) => {
    if (n.need.size === 0) {
      u[k] = cap[k];
      active.delete(k);
    }
  });
  const items = new Set<ItemId>();
  nodes.forEach((n) => n.need.forEach((_, i) => items.add(i)));

  const consumption = (item: ItemId, t: number) => {
    let c = 0;
    nodes.forEach((n, k) => {
      const need = n.need.get(item);
      if (need) c += need * (active.has(k) ? Math.min(t, cap[k]) : u[k]);
    });
    return c;
  };
  const tight = (t: number) => [...items].filter((i) => consumption(i, t) > (supply.get(i) ?? 0) + 1e-9);

  let level = 0;
  while (active.size) {
    if (!tight(1).length) {
      for (const k of active) u[k] = cap[k];
      break;
    }
    // smallest level where some item runs out
    let lo = level;
    let hi = 1;
    for (let j = 0; j < 60; j++) {
      const mid = (lo + hi) / 2;
      if (tight(mid).length) hi = mid;
      else lo = mid;
    }
    level = lo;
    const exhausted = tight(hi);
    let froze = false;
    for (const k of [...active]) {
      const hit = exhausted.find((i) => nodes[k].need.has(i));
      if (hit && cap[k] > level) {
        u[k] = level;
        limitedBy[k] = hit;
        active.delete(k);
        froze = true;
      } else if (cap[k] <= level) {
        u[k] = cap[k];
        active.delete(k);
        froze = true;
      }
    }
    if (!froze) break; // numerical safety
  }
  return { u, limitedBy };
}

export function fmt(x: number, digits = 1): string {
  const r = Math.round(x * 10 ** digits) / 10 ** digits;
  return r.toLocaleString('de-DE', { maximumFractionDigits: digits });
}
