import { useEffect, useMemo, useState } from 'react';
import { purityLabel, type ItemId, type Purity } from '../data/gameData';
import { ceilSafe, itemName, machineById, machineName, recipesFor } from '../core/db';
import { buildTree, plan, type PlanOptions, type Target, type TreeNode } from '../core/planner';
import { fmt, type Factory } from '../core/factory';
import { ItemChip, ItemPicker, Rate, UtilBar, uid, usePersistent } from './common';

interface Props {
  purity: Purity;
  railCapacity: number;
  railName: string;
  onCreateFactory: (f: Factory) => void;
  focusItem?: (item: ItemId) => void;
  planRequest?: { item: ItemId; n: number };
  onPlanConsumed?: () => void;
}

export function Calculator({ purity, railCapacity, railName, onCreateFactory, focusItem, planRequest, onPlanConsumed }: Props) {
  const [targets, setTargets] = usePersistent<Target[]>('calc.targets', [{ item: 'rotor', rate: 10 }]);
  const [choice, setChoice] = usePersistent<Record<ItemId, string | null>>('calc.choice', {});
  const [view, setView] = useState<'table' | 'tree'>('table');
  useEffect(() => {
    if (!planRequest) return;
    setTargets([{ item: planRequest.item, rate: 10 }]);
    onPlanConsumed?.();
  }, [planRequest?.n]); // eslint-disable-line

  const opts: PlanOptions = { recipeChoice: choice, purity, railCapacity };
  const result = useMemo(() => plan(targets, opts), [targets, choice, purity, railCapacity]); // eslint-disable-line

  const updateTarget = (i: number, t: Partial<Target>) => setTargets(targets.map((x, j) => (j === i ? { ...x, ...t } : x)));

  const extractorLines = result.lines.filter((l) => machineById.get(l.recipe.machine)?.kind === 'extractor');
  const productionLines = result.lines.filter((l) => machineById.get(l.recipe.machine)?.kind !== 'extractor');

  const toFactory = () => {
    onCreateFactory({
      name: 'Plan: ' + result.targets.map((t) => `${fmt(t.rate)} ${itemName(t.item)}`).join(', '),
      groups: result.lines.map((l) => ({
        id: uid(),
        recipeId: l.recipe.id,
        count: l.machines,
        purity: l.recipe.purityDependent ? purity : undefined,
      })),
      sources: result.imports.map((i) => ({ id: uid(), item: i.item, rate: Math.ceil(i.rate) })),
    });
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Was möchtest du produzieren?</h2>
        <div className="targets">
          {targets.map((t, i) => (
            <div className="target-row" key={i}>
              <ItemPicker value={t.item} onChange={(item) => updateTarget(i, { item })} />
              <label className="rate-input">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={t.rate}
                  onChange={(e) => updateTarget(i, { rate: Math.max(0, Number(e.target.value)) })}
                />
                <span>/min</span>
              </label>
              <button className="icon" title="Entfernen" onClick={() => setTargets(targets.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="row">
          <button onClick={() => setTargets([...targets, { item: 'titanium-bar', rate: 60 }])}>+ Ziel hinzufügen</button>
          {Object.keys(choice).length > 0 && (
            <button className="ghost" onClick={() => setChoice({})}>
              Rezeptwahl zurücksetzen
            </button>
          )}
        </div>
      </section>

      {result.cycle && <div className="alert bad">Kreislauf in den Rezepten: {result.cycle.map(itemName).join(' → ')}</div>}

      {result.lines.length > 0 && (
        <>
          <section className="stats">
            <Stat label="Maschinen gesamt" value={String([...result.totalMachines.values()].reduce((a, b) => a + b, 0))} />
            <Stat label="Strom" value={`${fmt(result.totalPower)} MW${result.unknownPower ? ' +?' : ''}`} />
            <Stat label="Produktionsstufen" value={String(Math.max(...result.lines.map((l) => l.depth)) + 1)} />
            <Stat label="Rail-Tier" value={`${railName} (${railCapacity}/min)`} />
          </section>

          <section className="card">
            <div className="row spread">
              <h2>Benötigte Maschinen</h2>
              <div className="row">
                <div className="seg">
                  <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>
                    Tabelle
                  </button>
                  <button className={view === 'tree' ? 'on' : ''} onClick={() => setView('tree')}>
                    Baum
                  </button>
                </div>
                <button className="primary" onClick={toFactory}>
                  → Als Fabrik übernehmen
                </button>
              </div>
            </div>

            {view === 'table' ? (
              <div className="table-wrap">
                <table className="plan">
                  <thead>
                    <tr>
                      <th>Produkt</th>
                      <th>Maschine / Rezept</th>
                      <th className="r">Bedarf</th>
                      <th className="r">Maschinen</th>
                      <th>Auslastung</th>
                      <th>Benötigt (Input)</th>
                      <th className="r">Rails</th>
                      <th className="r">Strom</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionLines.map((l) => (
                      <tr key={l.item}>
                        <td>
                          <a className="item-link" onClick={() => focusItem?.(l.item)}>
                            {itemName(l.item)}
                          </a>
                          {l.recipe.uncertain && (
                            <span className="warn-dot" title={l.recipe.note ?? 'Werte unsicher'}>
                              ?
                            </span>
                          )}
                        </td>
                        <td>
                          <RecipeSelect item={l.item} value={choice[l.item]} onChange={(v) => setChoice({ ...choice, [l.item]: v })} />
                        </td>
                        <td className="r">
                          <Rate v={l.rate} />
                        </td>
                        <td className="r">
                          <b className="big">{l.machines}×</b> <small className="muted">({fmt(l.machinesExact, 2)})</small>
                        </td>
                        <td>
                          <UtilBar value={l.utilization} />
                        </td>
                        <td className="chips">
                          {l.inputs.map((f) => (
                            <ItemChip key={f.item} item={f.item} rate={f.rate} />
                          ))}
                        </td>
                        <td className={`r ${l.railsOut > 1 ? 'warn' : ''}`} title={`${fmt(l.rate)}/min bei ${railCapacity}/min pro Rail`}>
                          {l.railsOut}
                        </td>
                        <td className="r">{l.power == null ? '?' : `${fmt(l.power)} MW`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="tree">
                {result.targets.map((t, i) => (
                  <TreeView key={i} node={buildTree(t.item, t.rate, opts)} purity={purity} />
                ))}
              </div>
            )}
          </section>

          <section className="grid2">
            <div className="card">
              <h2>Rohstoffe &amp; Extraktoren</h2>
              <table>
                <thead>
                  <tr>
                    <th>Rohstoff</th>
                    <th className="r">Bedarf</th>
                    <th>Extraktor</th>
                    <th className="r">Anzahl</th>
                  </tr>
                </thead>
                <tbody>
                  {extractorLines.map((l) => (
                    <tr key={l.item}>
                      <td>{itemName(l.item)}</td>
                      <td className="r">
                        <Rate v={l.rate} />
                      </td>
                      <td>
                        {machineName(l.recipe.machine)}
                        {l.recipe.purityDependent && <small className="muted"> ({purityLabel[purity]})</small>}
                      </td>
                      <td className="r">
                        <b>{l.machines}×</b> <small className="muted">({fmt(l.machinesExact, 2)})</small>
                      </td>
                    </tr>
                  ))}
                  {result.imports.map((f) => (
                    <tr key={f.item}>
                      <td>{itemName(f.item)}</td>
                      <td className="r">
                        <Rate v={f.rate} />
                      </td>
                      <td colSpan={2} className="muted">
                        {recipesFor.has(f.item) ? 'Import (Rezept abgewählt)' : 'Kein Rezept bekannt – extern liefern'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h2>Maschinen nach Typ</h2>
              <table>
                <tbody>
                  {[...result.totalMachines]
                    .sort((a, b) => (machineById.get(a[0])?.tier ?? 0) - (machineById.get(b[0])?.tier ?? 0))
                    .map(([m, n]) => {
                      const p = machineById.get(m)?.power;
                      return (
                        <tr key={m}>
                          <td>{machineName(m)}</td>
                          <td className="r">
                            <b>{n}×</b>
                          </td>
                          <td className="r muted">{p == null ? '? MW' : `${fmt(p * n)} MW`}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function RecipeSelect({ item, value, onChange }: { item: ItemId; value: string | null | undefined; onChange: (v: string | null) => void }) {
  const options = recipesFor.get(item) ?? [];
  const current = value === null ? '__import' : (value ?? options[0]?.id);
  return (
    <select className="recipe-select" value={current} onChange={(e) => onChange(e.target.value === '__import' ? null : e.target.value)}>
      {options.map((r) => (
        <option key={r.id} value={r.id}>
          {machineName(r.machine)}
          {r.alternate ? ' – Alternative' : ''} · {r.inputs.map((i) => `${i.amount} ${itemName(i.item)}`).join(' + ')} → {r.outputs[0].amount} in {r.time}s
        </option>
      ))}
      <option value="__import">Nicht produzieren (Import)</option>
    </select>
  );
}

function TreeView({ node, purity }: { node: TreeNode; purity: Purity }) {
  const [open, setOpen] = useState(true);
  const m = node.recipe ? machineById.get(node.recipe.machine) : undefined;
  return (
    <div className="tree-node">
      <div className="tree-head" onClick={() => setOpen(!open)}>
        {node.children.length > 0 ? <span className="caret">{open ? '▾' : '▸'}</span> : <span className="caret" />}
        <b>{itemName(node.item)}</b> <Rate v={node.rate} />
        {m && (
          <span className="muted">
            {' '}
            · {ceilSafe(node.machinesExact)}× {machineName(m.id)} ({fmt(node.machinesExact, 2)}){node.recipe?.purityDependent ? `, ${purityLabel[purity]}` : ''}
          </span>
        )}
        {!node.recipe && <span className="muted"> · Import</span>}
      </div>
      {open && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((c, i) => (
            <TreeView key={i} node={c} purity={purity} />
          ))}
        </div>
      )}
    </div>
  );
}
