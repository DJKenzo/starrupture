import { useState } from 'react';
import { purityLabel, railTiers, type ItemId, type Purity } from '../data/gameData';
import type { Factory } from '../core/factory';
import { Calculator } from './Calculator';
import { FactoryPlanner } from './FactoryPlanner';
import { Database } from './Database';
import { usePersistent } from './common';
import { setNameMode } from '../core/db';
import { nameModeLabel, type NameMode } from '../data/i18n';

type Tab = 'calc' | 'factory' | 'db';

export function App() {
  const [tab, setTab] = usePersistent<Tab>('ui.tab', 'calc');
  const [purity, setPurity] = usePersistent<Purity>('set.purity', 'normal');
  const [railId, setRailId] = usePersistent('set.rail', 'rail-v1');
  const [factories, setFactories] = usePersistent<Factory[]>('factories', []);
  const [activeFactory, setActiveFactory] = usePersistent('factories.active', 0);
  const [dbItem, setDbItem] = useState<ItemId>('rotor');
  const [planRequest, setPlanRequest] = useState<{ item: ItemId; n: number }>();

  const [nameMode, setNameModeState] = usePersistent<NameMode>('set.names', 'de');
  // names are resolved during render, so set the mode before children render
  setNameMode(nameMode);

  const rail = railTiers.find((r) => r.id === railId) ?? railTiers[0];

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo">◆</span>
          <div>
            <div className="brand-name">StarRupture Planer</div>
            <div className="brand-sub">Ressourcen · Rezepte · Produktionsketten</div>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === 'calc' ? 'on' : ''} onClick={() => setTab('calc')}>
            Rechner
          </button>
          <button className={tab === 'factory' ? 'on' : ''} onClick={() => setTab('factory')}>
            Fabrik-Planer
          </button>
          <button className={tab === 'db' ? 'on' : ''} onClick={() => setTab('db')}>
            Rezepte
          </button>
        </nav>
        <div className="settings">
          <label>
            Namen
            <select value={nameMode} onChange={(e) => setNameModeState(e.target.value as NameMode)}>
              {(Object.keys(nameModeLabel) as NameMode[]).map((m) => (
                <option key={m} value={m}>
                  {nameModeLabel[m]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Erz-Vorkommen
            <select value={purity} onChange={(e) => setPurity(e.target.value as Purity)}>
              {(Object.keys(purityLabel) as Purity[]).map((p) => (
                <option key={p} value={p}>
                  {purityLabel[p]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rails
            <select value={rail.id} onChange={(e) => setRailId(e.target.value)}>
              {railTiers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.capacity}/min)
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main>
        {tab === 'calc' && (
          <Calculator
            planRequest={planRequest}
            onPlanConsumed={() => setPlanRequest(undefined)}
            purity={purity}
            railCapacity={rail.capacity}
            railName={rail.name}
            focusItem={(id) => {
              setDbItem(id);
              setTab('db');
            }}
            onCreateFactory={(f) => {
              setFactories([...factories, f]);
              setActiveFactory(factories.length);
              setTab('factory');
            }}
          />
        )}
        {tab === 'factory' && (
          <FactoryPlanner
            factories={factories}
            setFactories={setFactories}
            active={Math.min(activeFactory, Math.max(0, factories.length - 1))}
            setActive={setActiveFactory}
            railCapacity={rail.capacity}
            defaultPurity={purity}
          />
        )}
        {tab === 'db' && (
          <Database
            selected={dbItem}
            onSelect={setDbItem}
            onPlan={(id) => {
              setPlanRequest((p) => ({ item: id, n: (p?.n ?? 0) + 1 }));
              setTab('calc');
            }}
          />
        )}
      </main>

      <footer className="muted small">
        Daten: <a href="https://starrupture.wiki.gg" target="_blank" rel="noreferrer">starrupture.wiki.gg</a> (Early Access, Stand Nov. 2026).
        Mit „?“ markierte Rezepte sind im Wiki widersprüchlich. Deutsche Namen sind inoffizielle Übersetzungen – unter „Namen“ lassen sich die englischen Spielnamen einblenden. Fan-Projekt, nicht mit Creepy Jar verbunden.
      </footer>
    </div>
  );
}
