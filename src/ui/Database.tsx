import { useState } from 'react';
import { items, machines, type ItemId, type Recipe } from '../data/gameData';
import { itemById, itemName, itemNameEn, itemSearchText, machineName, recipeName, recipesFor, stackRate, usagesOf } from '../core/db';
import { fmt } from '../core/factory';

export function Database({ selected, onSelect, onPlan }: { selected: ItemId; onSelect: (id: ItemId) => void; onPlan: (id: ItemId) => void }) {
  const [q, setQ] = useState('');
  const [machine, setMachine] = useState('');
  const list = items
    .filter((i) => itemSearchText(i.id).includes(q.toLowerCase()))
    .filter((i) => !machine || (recipesFor.get(i.id) ?? []).some((r) => r.machine === machine))
    .sort((a, b) => itemName(a.id).localeCompare(itemName(b.id), 'de'));
  const item = itemById.get(selected);
  const producing = recipesFor.get(selected) ?? [];
  const using = usagesOf.get(selected) ?? [];

  return (
    <div className="db">
      <aside className="card db-list">
        <input placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={machine} onChange={(e) => setMachine(e.target.value)}>
          <option value="">Alle Maschinen</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {machineName(m.id)}
            </option>
          ))}
        </select>
        <ul>
          {list.map((i) => (
            <li key={i.id} className={i.id === selected ? 'on' : ''} onClick={() => onSelect(i.id)}>
              {itemName(i.id)}
              {i.raw && <small className="muted"> roh</small>}
            </li>
          ))}
        </ul>
      </aside>
      <div className="stack">
        {item && (
          <section className="card">
            <div className="row spread">
              <h2>
                {itemName(item.id)}
                {itemName(item.id) !== itemNameEn(item.id) && <small className="muted"> · im Spiel: {itemNameEn(item.id)}</small>}
              </h2>
              {producing.length > 0 && (
                <button className="primary" onClick={() => onPlan(item.id)}>
                  Im Rechner planen →
                </button>
              )}
            </div>
            <h3>Herstellung</h3>
            {producing.length === 0 && <p className="muted">Kein Rezept bekannt – Rohstoff bzw. noch nicht im Wiki dokumentiert.</p>}
            {producing.map((r) => (
              <RecipeCard key={r.id} r={r} onSelect={onSelect} />
            ))}
            <h3>Wird verwendet in</h3>
            {using.length === 0 && <p className="muted">Keine bekannte Verwendung.</p>}
            {using.map((r) => (
              <RecipeCard key={r.id} r={r} onSelect={onSelect} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function RecipeCard({ r, onSelect }: { r: Recipe; onSelect: (id: ItemId) => void }) {
  return (
    <div className="recipe">
      <div className="recipe-head">
        <b>{recipeName(r)}</b> <span className="muted">· {machineName(r.machine)} · {r.time}s</span>
        {r.alternate && <span className="badge surplus">Alternative</span>}
        {r.uncertain && <span className="badge starved" title={r.note}>unsicher</span>}
      </div>
      <div className="recipe-body">
        <div className="chips">
          {r.inputs.length === 0 && <span className="muted">Extraktor{r.purityDependent ? ' (Rate: Unrein / Normal / Rein = ×1 / ×2 / ×4)' : ''}</span>}
          {r.inputs.map((i) => (
            <span key={i.item} className="chip clickable" onClick={() => onSelect(i.item)}>
              {i.amount}× {itemName(i.item)} <small>{fmt(stackRate(r, i), 2)}/min</small>
            </span>
          ))}
        </div>
        <span className="arrow">→</span>
        <div className="chips">
          {r.outputs.map((o) => (
            <span key={o.item} className="chip clickable out" onClick={() => onSelect(o.item)}>
              {o.amount}× {itemName(o.item)} <small>{fmt(stackRate(r, o, 'impure'), 2)}/min{r.purityDependent ? ' (unrein)' : ''}</small>
            </span>
          ))}
        </div>
      </div>
      {r.note && <div className="small muted">⚠ {r.note}</div>}
    </div>
  );
}
