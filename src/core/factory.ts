import type { ItemId, Purity } from '../data/gameData';
import { ceilSafe, EPS, inputRate, machineById, outputRate, recipeById } from './db';

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

  let u = nodes.map(() => 1);
  let received = nodes.map((n) => new Map<ItemId, number>(n.need));

  /** Fraction a node could run at, judging only by its inputs other than `item`. */
  const otherLimit = (k: number, item: ItemId) => {
    let v = 1;
    nodes[k].need.forEach((need, other) => {
      if (other !== item) v = Math.min(v, (received[k].get(other) ?? 0) / need);
    });
    return v;
  };

  for (let iter = 0; iter < 500; iter++) {
    const supply = new Map<ItemId, number>(external);
    nodes.forEach((n, k) => n.out.forEach((v, item) => supply.set(item, (supply.get(item) ?? 0) + v * u[k])));

    const nextReceived = nodes.map(() => new Map<ItemId, number>());
    for (const item of allItems) {
      const consumers = nodes.map((n, k) => ({ k, need: n.need.get(item) ?? 0 })).filter((c) => c.need > 0);
      if (!consumers.length) continue;
      // each consumer only asks for what its other inputs allow it to process
      const request = consumers.map((c) => c.need * otherLimit(c.k, item));
      const alloc = waterFill(supply.get(item) ?? 0, request, consumers.map((c) => c.need));
      consumers.forEach((c, j) => nextReceived[c.k].set(item, alloc[j]));
    }

    const nextU = nodes.map((n, k) => {
      let v = 1;
      n.need.forEach((need, item) => {
        v = Math.min(v, (nextReceived[k].get(item) ?? 0) / need);
      });
      return v;
    });

    const delta = Math.max(0, ...nextU.map((v, k) => Math.abs(v - u[k])));
    u = nextU;
    received = nextReceived;
    if (delta < 1e-10) break;
  }

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
    // limiting input: lowest received/need ratio; on ties prefer the globally scarcest item
    let limitingInput: ItemId | undefined;
    if (u[k] < 1 - 1e-6) {
      const scarcity = (item: ItemId) => (supply.get(item) ?? 0) / (demand.get(item) || 1);
      const sorted = [...inputs].sort(
        (a, b) => a.received / a.need - b.received / b.need || scarcity(a.item) - scarcity(b.item),
      );
      const min = sorted[0].received / sorted[0].need;
      limitingInput = sorted.filter((i) => i.received / i.need < min + 1e-6).sort((a, b) => scarcity(a.item) - scarcity(b.item))[0]
        .item;
    }
    const outputs = [...n.out].map(([item, max]) => ({ item, max, actual: max * u[k] }));
    const messages: string[] = [];

    let status: GroupStatus = 'ok';
    if (u[k] <= 1e-6) status = 'idle';
    else if (u[k] < 1 - 1e-6) status = 'starved';
    for (const o of outputs) {
      const b = balanceByItem.get(o.item)!;
      if (b.demand > b.maxSupply + 1e-6) {
        status = 'bottleneck';
        messages.push(`Ausgabe reicht nicht: ${fmt(b.demand)}/min benötigt, max. ${fmt(b.maxSupply)}/min. +${b.missingMachines} Maschine(n) nötig.`);
      } else if (!b.isFinal && b.supply > b.consumed + 1e-6 && status === 'ok') {
        status = 'surplus';
        messages.push(`Überschuss: ${fmt(b.supply - b.consumed)}/min werden nicht verbraucht.`);
      }
    }
    if (limitingInput) {
      const i = inputs.find((x) => x.item === limitingInput)!;
      messages.unshift(`Zu wenig Input: bekommt ${fmt(i.received)}/min von ${fmt(i.need)}/min.`);
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
 * Split `supply` between consumers. Each consumer j gets at most `request[j]`;
 * shares are proportional to `weight[j]`, leftovers are redistributed.
 */
export function waterFill(supply: number, request: number[], weight: number[]): number[] {
  const alloc = request.map(() => 0);
  let remaining = supply;
  let open = request.map((_, j) => j).filter((j) => request[j] > 0);
  while (open.length && remaining > EPS) {
    const w = open.reduce((s, j) => s + weight[j], 0);
    const lambda = remaining / w;
    const capped = open.filter((j) => request[j] - alloc[j] <= lambda * weight[j] + EPS);
    if (!capped.length) {
      for (const j of open) alloc[j] += lambda * weight[j];
      remaining = 0;
      break;
    }
    for (const j of capped) {
      remaining -= request[j] - alloc[j];
      alloc[j] = request[j];
    }
    open = open.filter((j) => !capped.includes(j));
  }
  return alloc;
}

export function fmt(x: number, digits = 1): string {
  const r = Math.round(x * 10 ** digits) / 10 ** digits;
  return r.toLocaleString('de-DE', { maximumFractionDigits: digits });
}
