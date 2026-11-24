import { useEffect, useId, useState } from 'react';
import { items, type ItemId } from '../data/gameData';
import { itemName, itemNameEn, itemSearchText } from '../core/db';
import { fmt } from '../core/factory';

/** useState backed by localStorage (fails silently when storage is unavailable). */
export function usePersistent<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue];
}


/** Searchable item picker (text input + datalist). */
export function ItemPicker({
  value,
  onChange,
  filter,
  placeholder = 'Item suchen…',
}: {
  value: ItemId | '';
  onChange: (id: ItemId) => void;
  filter?: (id: ItemId) => boolean;
  placeholder?: string;
}) {
  const listId = useId();
  const [text, setText] = useState(value ? itemName(value) : '');
  useEffect(() => setText(value ? itemName(value) : ''), [value]);
  const options = items
    .filter((i) => !filter || filter(i.id))
    .map((i) => ({ id: i.id, label: itemName(i.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  return (
    <>
      <input
        className="item-picker"
        list={listId}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          const t = e.target.value.trim().toLowerCase();
          // exact match on German or English name, else the only partial match
          const exact = options.find((i) => i.label.toLowerCase() === t || itemNameEn(i.id).toLowerCase() === t);
          const partial = t.length > 2 ? options.filter((i) => itemSearchText(i.id).includes(t)) : [];
          const hit = exact ?? (partial.length === 1 ? partial[0] : undefined);
          if (hit) onChange(hit.id);
        }}
        onFocus={(e) => e.target.select()}
      />
      <datalist id={listId}>
        {options.map((i) => (
          <option key={i.id} value={i.label} label={itemNameEn(i.id) !== i.label ? itemNameEn(i.id) : undefined} />
        ))}
      </datalist>
    </>
  );
}

export function Rate({ v, unit = '/min' }: { v: number; unit?: string }) {
  return (
    <span className="num">
      {fmt(v, 2)}
      <small>{unit}</small>
    </span>
  );
}

export function UtilBar({ value, status }: { value: number; status?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`util util-${status ?? (value >= 0.999 ? 'ok' : 'partial')}`} title={`${fmt(pct)} %`}>
      <div className="util-fill" style={{ width: `${pct}%` }} />
      <span>{fmt(pct, 0)} %</span>
    </div>
  );
}

export function ItemChip({ item, rate, onClick }: { item: ItemId; rate?: number; onClick?: () => void }) {
  return (
    <span className={`chip${onClick ? ' clickable' : ''}`} onClick={onClick}>
      {itemName(item)}
      {rate !== undefined && (
        <>
          {' '}
          <b>{fmt(rate, 2)}</b>
        </>
      )}
    </span>
  );
}

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function pickJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      f.text()
        .then((t) => resolve(JSON.parse(t)))
        .catch(reject);
    };
    input.click();
  });
}

export const uid = () => Math.random().toString(36).slice(2, 10);
