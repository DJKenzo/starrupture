import { useMemo, useState } from 'react';
import { purityLabel, type ItemId, type Purity } from '../data/gameData';
import { defaultRecipe, itemName, machineById, machineName, recipeById, recipesFor } from '../core/db';
import { fmt, simulate, type Factory, type FactoryGroup, type GroupResult, type GroupStatus } from '../core/factory';
import { downloadJson, ItemChip, ItemPicker, pickJsonFile, UtilBar, uid } from './common';

const statusInfo: Record<GroupStatus, { label: string; cls: string }> = {
  ok: { label: 'Voll ausgelastet', cls: 'ok' },
  starved: { label: 'Zu wenig Input', cls: 'starved' },
  bottleneck: { label: 'Engpass – Ausgabe reicht nicht', cls: 'bottleneck' },
  surplus: { label: 'Überkapazität (pausiert zeitweise)', cls: 'surplus' },
  idle: { label: 'Steht still', cls: 'idle' },
};

interface Props {
  factories: Factory[];
  setFactories: (f: Factory[]) => void;
  active: number;
  setActive: (i: number) => void;
  railCapacity: number;
  defaultPurity: Purity;
}

export function FactoryPlanner({ factories, setFactories, active, setActive, railCapacity, defaultPurity }: Props) {
  const factory = factories[active];
  const update = (f: Factory) => setFactories(factories.map((x, i) => (i === active ? f : x)));

  const newFactory = () => {
    setFactories([...factories, { name: `Fabrik ${factories.length + 1}`, groups: [], sources: [] }]);
    setActive(factories.length);
  };

  if (!factory) {
    return (
      <div className="card empty">
        <p>Noch keine Fabrik angelegt.</p>
        <p className="muted">Baue deine Kette hier Maschine für Maschine nach, oder übernimm einen Plan aus dem Rechner.</p>
        <button className="primary" onClick={newFactory}>
          + Neue Fabrik
        </button>
      </div>
    );
  }

  return (
    <FactoryEditor
      key={active}
      factory={factory}
      update={update}
      railCapacity={railCapacity}
      defaultPurity={defaultPurity}
      header={
        <div className="row wrap">
          <select value={active} onChange={(e) => setActive(Number(e.target.value))}>
            {factories.map((f, i) => (
              <option key={i} value={i}>
                {f.name}
              </option>
            ))}
          </select>
          <button onClick={newFactory}>+ Neu</button>
          <button
            onClick={() => {
              setFactories([...factories, { ...structuredClone(factory), name: factory.name + ' (Kopie)' }]);
              setActive(factories.length);
            }}
          >
            Duplizieren
          </button>
          <button onClick={() => downloadJson(`${factory.name.replace(/[^\w-]+/g, '_')}.json`, factory)}>Export</button>
          <button
            onClick={async () => {
              try {
                const f = (await pickJsonFile()) as Factory;
                if (!Array.isArray(f.groups)) throw new Error();
                setFactories([...factories, { name: f.name ?? 'Import', groups: f.groups, sources: f.sources ?? [] }]);
                setActive(factories.length);
              } catch {
                alert('Datei konnte nicht gelesen werden.');
              }
            }}
          >
            Import
          </button>
          <button
            className="danger"
            onClick={() => {
              if (!confirm(`„${factory.name}“ löschen?`)) return;
              setFactories(factories.filter((_, i) => i !== active));
              setActive(Math.max(0, active - 1));
            }}
          >
            Löschen
          </button>
        </div>
      }
    />
  );
}

function FactoryEditor({
  factory,
  update,
  railCapacity,
  defaultPurity,
  header,
}: {
  factory: Factory;
  update: (f: Factory) => void;
  railCapacity: number;
  defaultPurity: Purity;
  header: React.ReactNode;
}) {
  const result = useMemo(() => simulate(factory, railCapacity), [factory, railCapacity]);
  const [addItem, setAddItem] = useState<ItemId | ''>('');
  const [srcItem, setSrcItem] = useState<ItemId | ''>('');
  const [srcRate, setSrcRate] = useState(60);

  const setGroup = (id: string, patch: Partial<FactoryGroup>) =>
    update({ ...factory, groups: factory.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) });

  const addGroup = (recipeId: string, count = 1) => {
    const r = recipeById.get(recipeId)!;
    const existing = factory.groups.find((g) => g.recipeId === recipeId);
    if (existing) return setGroup(existing.id, { count: existing.count + count });
    update({
      ...factory,
      groups: [...factory.groups, { id: uid(), recipeId, count, purity: r.purityDependent ? defaultPurity : undefined }],
    });
  };

  /** Add machines until nothing is a bottleneck any more. */
  const fixAll = () => {
    let f = structuredClone(factory);
    for (let i = 0; i < 100; i++) {
      const r = simulate(f, railCapacity);
      const missing = r.balance.filter((b) => b.missingMachines > 0 && b.producerRecipe);
      const unproduced = r.balance.filter((b) => b.demand > b.maxSupply + 1e-6 && !b.producerRecipe && defaultRecipe(b.item));
      if (!missing.length && !unproduced.length) break;
      for (const b of missing) {
        const g = f.groups.find((x) => x.recipeId === b.producerRecipe)!;
        g.count += b.missingMachines;
      }
      for (const b of unproduced) {
        const r0 = defaultRecipe(b.item)!;
        f.groups.push({ id: uid(), recipeId: r0.id, count: 1, purity: r0.purityDependent ? defaultPurity : undefined });
      }
    }
    update(f);
  };

  // stage (column) of each group: 0 = raw/extractors
  const stages = useMemo(() => {
    const producers = new Map<ItemId, FactoryGroup[]>();
    for (const g of factory.groups) for (const o of recipeById.get(g.recipeId)?.outputs ?? []) producers.set(o.item, [...(producers.get(o.item) ?? []), g]);
    const memo = new Map<string, number>();
    const depth = (g: FactoryGroup, seen: Set<string>): number => {
      if (memo.has(g.id)) return memo.get(g.id)!;
      if (seen.has(g.id)) return 0;
      seen.add(g.id);
      let d = 0;
      for (const i of recipeById.get(g.recipeId)?.inputs ?? []) for (const p of producers.get(i.item) ?? []) d = Math.max(d, depth(p, seen) + 1);
      memo.set(g.id, d);
      return d;
    };
    const cols: GroupResult[][] = [];
    for (const gr of result.groups) {
      const d = depth(gr.group, new Set());
      (cols[d] ??= []).push(gr);
    }
    return cols.filter(Boolean);
  }, [factory.groups, result]);

  const problems = result.groups.filter((g) => g.status === 'bottleneck' || g.status === 'starved').length;
  const missingInputs = result.balance.filter((b) => b.demand > b.maxSupply + 1e-6 && !b.producerRecipe);
  const finals = result.balance.filter((b) => b.isFinal && b.supply > 0);

  return (
    <div className="stack">
      <section className="card">
        <div className="row spread wrap">
          <input className="title-input" value={factory.name} onChange={(e) => update({ ...factory, name: e.target.value })} />
          {header}
        </div>
      </section>

      <section className="grid2">
        <div className="card">
          <h3>Maschine hinzufügen</h3>
          <div className="row wrap">
            <ItemPicker value={addItem} onChange={setAddItem} filter={(id) => recipesFor.has(id)} placeholder="Was soll produziert werden?" />
            {addItem && (
              <div className="row wrap">
                {(recipesFor.get(addItem) ?? []).map((r) => (
                  <button key={r.id} onClick={() => addGroup(r.id)}>
                    + {machineName(r.machine)}
                    {r.alternate ? ' (Alt.)' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <h3>Externe Zufuhr (Lager, andere Basis…)</h3>
          <div className="row wrap">
            <ItemPicker value={srcItem} onChange={setSrcItem} />
            <label className="rate-input">
              <input type="number" min={0} value={srcRate} onChange={(e) => setSrcRate(Number(e.target.value))} />
              <span>/min</span>
            </label>
            <button
              disabled={!srcItem}
              onClick={() => srcItem && update({ ...factory, sources: [...factory.sources, { id: uid(), item: srcItem, rate: srcRate }] })}
            >
              + Zufuhr
            </button>
          </div>
          <div className="chips">
            {factory.sources.map((s) => (
              <span key={s.id} className="chip">
                {itemName(s.item)}{' '}
                <input
                  className="mini"
                  type="number"
                  min={0}
                  value={s.rate}
                  onChange={(e) =>
                    update({ ...factory, sources: factory.sources.map((x) => (x.id === s.id ? { ...x, rate: Number(e.target.value) } : x)) })
                  }
                />
                /min
                <button className="icon" onClick={() => update({ ...factory, sources: factory.sources.filter((x) => x.id !== s.id) })}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      </section>

      {factory.groups.length > 0 && (
        <section className={`card summary ${problems ? 'has-problems' : 'all-good'}`}>
          <div className="row spread wrap">
            <div>
              <b>{problems ? `${problems} Problem${problems > 1 ? 'e' : ''} in der Kette` : 'Kette läuft rund ✓'}</b>
              <div className="muted">
                Strom: {fmt(result.totalPower)} MW{result.unknownPower ? ' + unbekannte' : ''} · Endprodukte:{' '}
                {finals.length ? finals.map((b) => `${itemName(b.item)} ${fmt(b.supply, 2)}/min`).join(', ') : '–'}
              </div>
            </div>
            {(problems > 0 || missingInputs.length > 0) && (
              <button className="primary" onClick={fixAll}>
                Engpässe automatisch beheben
              </button>
            )}
          </div>
          {missingInputs.length > 0 && (
            <div className="alert bad">
              Fehlende Inputs ohne Produzent:{' '}
              {missingInputs.map((b) => (
                <span key={b.item} className="chip">
                  {itemName(b.item)} {fmt(b.demand - b.maxSupply, 2)}/min
                  {defaultRecipe(b.item) && (
                    <button className="icon" title="Produzent hinzufügen" onClick={() => addGroup(defaultRecipe(b.item)!.id)}>
                      +
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="legend">
        {Object.entries(statusInfo).map(([k, v]) => (
          <span key={k} className={`badge ${v.cls}`}>
            {v.label}
          </span>
        ))}
      </div>

      <section className="chain">
        {stages.map((col, i) => (
          <div className="stage" key={i}>
            <div className="stage-title">{i === 0 ? 'Rohstoffe / Stufe 1' : `Stufe ${i + 1}`}</div>
            {col.map((gr) => (
              <GroupCard
                key={gr.group.id}
                gr={gr}
                railCapacity={railCapacity}
                onCount={(count) => setGroup(gr.group.id, { count })}
                onPurity={(purity) => setGroup(gr.group.id, { purity })}
                onRecipe={(recipeId) => setGroup(gr.group.id, { recipeId })}
                onRemove={() => update({ ...factory, groups: factory.groups.filter((g) => g.id !== gr.group.id) })}
              />
            ))}
          </div>
        ))}
      </section>

      {result.balance.length > 0 && (
        <section className="card">
          <h2>Item-Bilanz</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="r">Produktion max.</th>
                  <th className="r">Produktion real</th>
                  <th className="r">Bedarf (100 %)</th>
                  <th className="r">Verbraucht</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {result.balance
                  .sort((a, b) => itemName(a.item).localeCompare(itemName(b.item)))
                  .map((b) => {
                    const deficit = b.demand - b.maxSupply;
                    const reserve = b.maxSupply - b.demand;
                    return (
                      <tr key={b.item}>
                        <td>{itemName(b.item)}</td>
                        <td className="r">{fmt(b.maxSupply, 2)}</td>
                        <td className="r">{fmt(b.supply, 2)}</td>
                        <td className="r">{fmt(b.demand, 2)}</td>
                        <td className="r">{fmt(b.consumed, 2)}</td>
                        <td>
                          {deficit > 1e-6 ? (
                            <span className="badge bottleneck">
                              −{fmt(deficit, 2)}/min
                              {b.missingMachines > 0 && ` · +${b.missingMachines} Maschine(n)`}
                            </span>
                          ) : b.isFinal ? (
                            <span className="badge ok">Endprodukt</span>
                          ) : reserve > 1e-6 ? (
                            <span className="badge surplus">+{fmt(reserve, 2)}/min Reserve</span>
                          ) : (
                            <span className="badge ok">ausgeglichen</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function GroupCard({
  gr,
  railCapacity,
  onCount,
  onPurity,
  onRecipe,
  onRemove,
}: {
  gr: GroupResult;
  railCapacity: number;
  onCount: (n: number) => void;
  onPurity: (p: Purity) => void;
  onRecipe: (id: string) => void;
  onRemove: () => void;
}) {
  const r = recipeById.get(gr.group.recipeId)!;
  const m = machineById.get(r.machine);
  const info = statusInfo[gr.status];
  const alternatives = recipesFor.get(r.outputs[0].item) ?? [];
  const overRails = gr.railsNeeded.filter((x) => x.rails > 1);
  return (
    <div className={`group-card st-${info.cls}`}>
      <div className="row spread">
        <div>
          <div className="group-title">{itemName(r.outputs[0].item)}</div>
          <div className="muted small">
            {m?.name} · {r.time}s/Zyklus
          </div>
        </div>
        <button className="icon" title="Entfernen" onClick={onRemove}>
          ✕
        </button>
      </div>
      <div className="row">
        <div className="counter">
          <button onClick={() => onCount(Math.max(1, gr.group.count - 1))}>−</button>
          <input type="number" min={1} value={gr.group.count} onChange={(e) => onCount(Math.max(1, Math.floor(Number(e.target.value))))} />
          <button onClick={() => onCount(gr.group.count + 1)}>+</button>
        </div>
        <span className="muted">Maschinen</span>
        {r.purityDependent && (
          <select value={gr.group.purity ?? 'normal'} onChange={(e) => onPurity(e.target.value as Purity)}>
            {(Object.keys(purityLabel) as Purity[]).map((p) => (
              <option key={p} value={p}>
                {purityLabel[p]}
              </option>
            ))}
          </select>
        )}
      </div>
      {alternatives.length > 1 && (
        <select className="small" value={r.id} onChange={(e) => onRecipe(e.target.value)}>
          {alternatives.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({machineName(a.machine)})
            </option>
          ))}
        </select>
      )}
      <UtilBar value={gr.utilization} status={info.cls} />
      <span className={`badge ${info.cls}`}>{info.label}</span>

      {gr.inputs.length > 0 && (
        <div className="io">
          <div className="io-label">Input</div>
          {gr.inputs.map((i) => (
            <div key={i.item} className={`io-row ${i.item === gr.limitingInput ? 'bad' : ''}`}>
              <span>{itemName(i.item)}</span>
              <span className="num">
                {fmt(i.received, 2)} / {fmt(i.need, 2)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="io">
        <div className="io-label">Output</div>
        {gr.outputs.map((o) => (
          <div key={o.item} className="io-row">
            <span>{itemName(o.item)}</span>
            <span className="num">
              {fmt(o.actual, 2)} <small>/ {fmt(o.max, 2)} max</small>
            </span>
          </div>
        ))}
      </div>
      {gr.messages.map((msg, i) => (
        <div key={i} className="msg">
          {msg}
        </div>
      ))}
      {overRails.length > 0 && (
        <div className="msg warn">
          Rail-Limit ({railCapacity}/min):{' '}
          {overRails.map((x) => (
            <ItemChip key={x.dir + x.item} item={x.item} rate={x.rate} />
          ))}{' '}
          braucht {Math.max(...overRails.map((x) => x.rails))} Rails
        </div>
      )}
      {r.uncertain && <div className="msg small muted">⚠ {r.note ?? 'Rezeptwerte unsicher'}</div>}
      <div className="muted small">{m?.power == null ? 'Strom unbekannt' : `${fmt(m.power * gr.group.count)} MW`}</div>
    </div>
  );
}
