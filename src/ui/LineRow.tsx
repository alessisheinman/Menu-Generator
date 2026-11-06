import { setLineDish } from '../model/event';
import {
  SLOT_CATEGORIES, type BurritoLine, type Catalog, type Dish, type DishLine, type Line, type OmeletteLine, type SaladLine, type SaladSize,
  type TextLine,
} from '../model/types';
import { TagToggles } from './common';
import { DishPicker } from './DishPicker';

export interface RowProps<L extends Line> {
  line: L;
  catalog: Catalog;
  dishByName: Map<string, Dish>;
  onChange: (l: Line) => void;
}

export function DishRow({ line, catalog, dishByName, onChange }: RowProps<DishLine>) {
  const alternatives = (line.alternatives ?? [])
    .map((id) => catalog.dishes.find((d) => d.id === id))
    .filter((d): d is Dish => !!d);
  const current = line.sourceDishId ? catalog.dishes.find((d) => d.id === line.sourceDishId) : undefined;
  const swapOptions = current && !alternatives.includes(current) ? [current, ...alternatives] : alternatives;
  const unmatched = line.dishName.trim() !== '' && !line.sourceDishId;

  return (
    <>
      <input
        className="qty"
        value={line.qty}
        placeholder="Qty"
        aria-label="Quantity"
        onChange={(e) => onChange({ ...line, qty: e.target.value })}
      />
      <input
        className="unit"
        value={line.unit}
        placeholder="unit"
        list="dl-units"
        aria-label="Unit"
        onChange={(e) => onChange({ ...line, unit: e.target.value })}
      />
      <div className="dish-cell">
        {line.slot && <span className={`slot slot-${line.slot}`}>{line.slot}</span>}
        <DishPicker
          className={`dish ${unmatched ? 'one-off' : ''}`}
          value={line.dishName}
          dishes={catalog.dishes}
          preferred={line.slot ? SLOT_CATEGORIES[line.slot] : undefined}
          placeholder={line.slot ? `Choose ${line.slot.toLowerCase()}…` : 'Type to search dishes…'}
          title={unmatched ? 'Not in the catalog — will print exactly as typed' : undefined}
          onType={(text) => onChange(setLineDish(line, dishByName.get(text.trim().toLowerCase()), text))}
          onPick={(dish) => onChange(setLineDish(line, dish, dish.name))}
        />
        {swapOptions.length > 1 && (
          <span className="swap-wrap" title="Swap for an alternative">
          <select
            className="swap"
            aria-label="Swap dish"
            value={line.sourceDishId ?? ''}
            onChange={(e) => {
              const picked = catalog.dishes.find((d) => d.id === e.target.value);
              if (!picked) return;
              // keep the whole swap group available after swapping (Patties → Links → Patties)
              const pool = swapOptions.map((d) => d.id).filter((id) => id !== picked.id);
              onChange({ ...setLineDish(line, picked, line.dishName), alternatives: pool });
            }}
          >
            {!current && <option value="">—</option>}
            {swapOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          </span>
        )}
      </div>
      <TagToggles tags={line.tags} onChange={(tags) => onChange({ ...line, tags })} />
      <input
        className="note"
        value={line.note}
        placeholder="note"
        aria-label="Kitchen note"
        onChange={(e) => onChange({ ...line, note: e.target.value })}
      />
    </>
  );
}

export function TextRow({ line, onChange }: RowProps<TextLine>) {
  return (
    <input
      className="text-line"
      value={line.text}
      placeholder="Free text, e.g. JUICER or 11 sandwiches to-go"
      aria-label="Note line"
      onChange={(e) => onChange({ ...line, text: e.target.value })}
    />
  );
}

const SIZES: SaladSize[] = ['Small', 'Medium', 'Large'];

function SizeButtons({ size, label, onChange }: { size: SaladSize; label: string; onChange: (s: SaladSize) => void }) {
  return (
    <span className="seg" role="group" aria-label={label}>
      {SIZES.map((s) => (
        <button key={s} type="button" className={size === s ? 'on' : ''} onClick={() => onChange(size === s ? '' : s)}>
          {s}
        </button>
      ))}
    </span>
  );
}

/** Calls `add` with the typed text when Enter is pressed, then clears the box. */
function AddBox({ label, placeholder, add }: { label: string; placeholder: string; add: (v: string) => void }) {
  return (
    <input
      className="chip-add"
      placeholder={placeholder}
      aria-label={label}
      onKeyDown={(e) => {
        const input = e.target as HTMLInputElement;
        const v = input.value.trim();
        if (e.key === 'Enter' && v) {
          add(v);
          input.value = '';
        }
      }}
    />
  );
}

/** Tickable chips for a catalog list (standard + add-ons) plus one-off items typed in. */
function ItemChips({ items, known, addLabel, onChange }: { items: string[]; known: string[]; addLabel: string; onChange: (items: string[]) => void }) {
  const all = [...known, ...items.filter((i) => !known.includes(i))];
  const toggle = (item: string) => {
    if (items.includes(item)) return onChange(items.filter((i) => i !== item));
    // keep the canonical order of the full list
    onChange(all.filter((i) => i === item || items.includes(i)));
  };
  return (
    <div className="chips">
      {all.map((item) => (
        <button key={item} type="button" className={`chip ${items.includes(item) ? 'on' : ''}`} onClick={() => toggle(item)}>
          {item}
        </button>
      ))}
      <AddBox label={addLabel} placeholder="+ add item" add={(v) => { if (!items.includes(v)) onChange([...items, v]); }} />
    </div>
  );
}

export function SaladRow({ line, catalog, onChange }: RowProps<SaladLine>) {
  return (
    <div className="salad">
      <div className="salad-head">
        <strong>Salad bar</strong>
        <SizeButtons size={line.size} label="Salad size" onChange={(size) => onChange({ ...line, size })} />
      </div>
      <ItemChips
        items={line.items}
        known={[...catalog.saladBar.standard, ...catalog.saladBar.addOns]}
        addLabel="Add salad item"
        onChange={(items) => onChange({ ...line, items })}
      />
    </div>
  );
}

export function OmeletteRow({ line, catalog, onChange }: RowProps<OmeletteLine>) {
  return (
    <div className="salad station">
      <div className="salad-head">
        <strong>Omelette station</strong>
        <SizeButtons size={line.size ?? ''} label="Omelette station size" onChange={(size) => onChange({ ...line, size })} />
        <label className="station-count">
          <input value={line.eggs} placeholder="#" inputMode="numeric" aria-label="Number of eggs" onChange={(e) => onChange({ ...line, eggs: e.target.value })} />
          eggs
        </label>
      </div>
      <ItemChips
        items={line.items}
        known={[...catalog.omelette.standard, ...catalog.omelette.addOns]}
        addLabel="Add omelette filling"
        onChange={(items) => onChange({ ...line, items })}
      />
    </div>
  );
}

export function BurritoRow({ line, catalog, onChange }: RowProps<BurritoLine>) {
  const names = new Map(catalog.burritoKinds.map((k) => [k.code, k.name]));
  const total = line.kinds.reduce((sum, k) => sum + (k.qty ?? 0), 0);
  const setQty = (code: string, qty: number | null) =>
    onChange({ ...line, kinds: line.kinds.map((k) => (k.code === code ? { ...k, qty } : k)) });
  return (
    <div className="salad station">
      <div className="salad-head">
        <strong>Assorted burritos</strong>
        <span className="station-total">{total} total</span>
      </div>
      <div className="chips">
        {line.kinds.map((k) => (
          <label key={k.code} className="burrito" title={names.get(k.code) ?? 'Only on this menu'}>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={k.qty ?? ''}
              placeholder="0"
              aria-label={`${names.get(k.code) ?? k.code} burritos`}
              onChange={(e) => setQty(k.code, e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
            />
            <span>{k.code}</span>
            {names.has(k.code) ? <small>{names.get(k.code)}</small> : (
              <button type="button" className="icon" title="Remove this kind" onClick={() => onChange({ ...line, kinds: line.kinds.filter((x) => x.code !== k.code) })}>✕</button>
            )}
          </label>
        ))}
        <AddBox
          label="Add burrito kind"
          placeholder="+ other kind"
          add={(v) => { const code = v.toUpperCase(); if (!line.kinds.some((k) => k.code === code)) onChange({ ...line, kinds: [...line.kinds, { code, qty: null }] }); }}
        />
      </div>
    </div>
  );
}
