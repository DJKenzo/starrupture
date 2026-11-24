import { describe, expect, it } from 'vitest';
import { recipes, items } from '../data/gameData';
import { itemById, machineById, recipeById } from './db';
import { plan, buildTree } from './planner';
import { simulate, waterFill } from './factory';

const line = (p: ReturnType<typeof plan>, item: string) => p.lines.find((l) => l.item === item)!;

describe('game data', () => {
  it('references only known items and machines', () => {
    for (const r of recipes) {
      expect(machineById.has(r.machine), r.id).toBe(true);
      for (const s of [...r.inputs, ...r.outputs]) expect(itemById.has(s.item), `${r.id}: ${s.item}`).toBe(true);
      expect(r.time).toBeGreaterThan(0);
    }
  });
  it('has unique ids', () => {
    expect(new Set(recipes.map((r) => r.id)).size).toBe(recipes.length);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
  it('every non-raw item has a recipe', () => {
    for (const i of items) {
      if (!i.raw) expect(recipes.some((r) => r.outputs.some((o) => o.item === i.id)), i.id).toBe(true);
    }
  });
});

describe('planner', () => {
  it('computes a simple smelter chain', () => {
    const p = plan([{ item: 'titanium-bar', rate: 90 }], { purity: 'normal' });
    const bar = line(p, 'titanium-bar');
    expect(bar.machinesExact).toBeCloseTo(1.5);
    expect(bar.machines).toBe(2);
    expect(bar.utilization).toBeCloseTo(0.75);
    const ore = line(p, 'titanium-ore');
    expect(ore.rate).toBeCloseTo(90);
    // normal node: 120/min per excavator
    expect(ore.machinesExact).toBeCloseTo(0.75);
    expect(ore.machines).toBe(1);
  });

  it('respects purity for extractors', () => {
    const p = plan([{ item: 'wolfram-ore', rate: 240 }], { purity: 'impure' });
    expect(line(p, 'wolfram-ore').machines).toBe(4);
  });

  it('sums shared intermediates (titanium bar for rod + sheet in tube)', () => {
    // tube: 1 rod + 1 sheet -> 2 tube in 2s => 60 tube/min needs 30 rod + 30 sheet
    const p = plan([{ item: 'tube', rate: 60 }]);
    expect(line(p, 'tube').machinesExact).toBeCloseTo(1);
    expect(line(p, 'titanium-rod').rate).toBeCloseTo(30);
    expect(line(p, 'titanium-sheet').rate).toBeCloseTo(30);
    // rod 1:1, sheet 1:2 -> 30 + 15 bars
    expect(line(p, 'titanium-bar').rate).toBeCloseTo(45);
    expect(line(p, 'titanium-ore').rate).toBeCloseTo(45);
  });

  it('can treat an item as import', () => {
    const p = plan([{ item: 'tube', rate: 60 }], { recipeChoice: { 'titanium-bar': null } });
    expect(p.lines.find((l) => l.item === 'titanium-bar')).toBeUndefined();
    expect(p.imports.find((i) => i.item === 'titanium-bar')?.rate).toBeCloseTo(45);
  });

  it('uses alternate recipes when chosen', () => {
    const p = plan([{ item: 'titanium-rod', rate: 120 }], { recipeChoice: { 'titanium-rod': 'v2-titanium-rod' } });
    expect(line(p, 'titanium-rod').machinesExact).toBeCloseTo(1);
    expect(line(p, 'titanium-bar').rate).toBeCloseTo(60);
  });

  it('plans every craftable item without cycles', () => {
    for (const i of items) {
      const p = plan([{ item: i.id, rate: 10 }]);
      expect(p.cycle, i.id).toBeUndefined();
    }
  });

  it('builds a tree whose leaves are raw', () => {
    const t = buildTree('rotor', 10);
    const leaves: string[] = [];
    const walk = (n: typeof t) => (n.children.length ? n.children.forEach(walk) : leaves.push(n.item));
    walk(t);
    expect(leaves.every((l) => recipeById.get('x-' + l) || itemById.get(l)?.raw)).toBe(true);
  });
});

describe('waterFill', () => {
  it('splits proportionally when scarce', () => {
    expect(waterFill(60, [60, 60], [60, 60])).toEqual([30, 30]);
  });
  it('redistributes leftovers of capped consumers', () => {
    const a = waterFill(60, [10, 60], [60, 60]);
    expect(a[0]).toBeCloseTo(10);
    expect(a[1]).toBeCloseTo(50);
  });
});

describe('factory simulation', () => {
  it('detects a balanced chain', () => {
    const r = simulate({
      name: 't',
      groups: [
        { id: 'a', recipeId: 'x-titanium-ore', count: 1, purity: 'normal' }, // 120/min
        { id: 'b', recipeId: 'titanium-bar', count: 2 }, // needs 120 ore
      ],
      sources: [],
    });
    expect(r.groups.every((g) => Math.abs(g.utilization - 1) < 1e-6)).toBe(true);
    expect(r.groups.find((g) => g.group.id === 'b')!.status).toBe('ok');
  });

  it('flags starved machines and the bottleneck producer', () => {
    const r = simulate({
      name: 't',
      groups: [
        { id: 'ore', recipeId: 'x-titanium-ore', count: 1, purity: 'impure' }, // 60/min
        { id: 'bar', recipeId: 'titanium-bar', count: 2 }, // needs 120/min
      ],
      sources: [],
    });
    const bar = r.groups.find((g) => g.group.id === 'bar')!;
    const ore = r.groups.find((g) => g.group.id === 'ore')!;
    expect(bar.utilization).toBeCloseTo(0.5);
    expect(bar.status).toBe('starved');
    expect(bar.limitingInput).toBe('titanium-ore');
    expect(ore.status).toBe('bottleneck');
    const bal = r.balance.find((b) => b.item === 'titanium-ore')!;
    expect(bal.missingMachines).toBe(1);
  });

  it('limits by the scarcest input and releases unused share', () => {
    // tube needs rod + sheet. Rods plentiful, sheets scarce.
    const r = simulate({
      name: 't',
      groups: [{ id: 'tube', recipeId: 'tube', count: 2 }], // needs 60 rod + 60 sheet
      sources: [
        { id: 's1', item: 'titanium-rod', rate: 60 },
        { id: 's2', item: 'titanium-sheet', rate: 30 },
      ],
    });
    const tube = r.groups[0];
    expect(tube.utilization).toBeCloseTo(0.5);
    expect(tube.limitingInput).toBe('titanium-sheet');
    const rod = r.balance.find((b) => b.item === 'titanium-rod')!;
    expect(rod.consumed).toBeCloseTo(30);
  });

  it('shares a scarce item between two consumers', () => {
    const r = simulate({
      name: 't',
      groups: [
        { id: 'rod', recipeId: 'titanium-rod', count: 1 }, // 30 bar
        { id: 'sheet', recipeId: 'titanium-sheet', count: 1 }, // 30 bar
      ],
      sources: [{ id: 's', item: 'titanium-bar', rate: 30 }],
    });
    expect(r.groups[0].utilization).toBeCloseTo(0.5);
    expect(r.groups[1].utilization).toBeCloseTo(0.5);
  });

  it('reports surplus', () => {
    const r = simulate({
      name: 't',
      groups: [
        { id: 'ore', recipeId: 'x-titanium-ore', count: 1, purity: 'pure' }, // 240
        { id: 'bar', recipeId: 'titanium-bar', count: 1 }, // 60
      ],
      sources: [],
    });
    expect(r.groups.find((g) => g.group.id === 'ore')!.status).toBe('surplus');
  });
});
