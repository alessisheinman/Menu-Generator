import { setLineDish } from '../model/event';
import { SLOT_CATEGORIES, type Catalog, type Dish, type DishLine, type Line, type SaladLine, type SaladSize, type TextLine } from '../model/types';
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

export function SaladRow({ line, catalog, onChange }: RowProps<SaladLine>) {
  const known = [...catalog.saladBar.standard, ...catalog.saladBar.addOns];
  const all = [...known, ...line.items.filter((i) => !known.includes(i))];
  const toggle = (item: string) => {
    if (line.items.includes(item)) return onChange({ ...line, items: line.items.filter((i) => i !== item) });
    // keep the canonical order of the full list
    onChange({ ...line, items: all.filter((i) => i === item || line.items.includes(i)) });
  };
  return (
    <div className="salad">
      <div className="salad-head">
        <strong>Salad bar</strong>
        <span className="seg" role="group" aria-label="Salad size">
          {SIZES.map((s) => (
            <button key={s} type="button" className={line.size === s ? 'on' : ''} onClick={() => onChange({ ...line, size: line.size === s ? '' : s })}>
              {s}
            </button>
          ))}
        </span>
      </div>
      <div className="chips">
        {all.map((item) => (
          <button key={item} type="button" className={`chip ${line.items.includes(item) ? 'on' : ''}`} onClick={() => toggle(item)}>
            {item}
          </button>
        ))}
        <input
          className="chip-add"
          placeholder="+ add item"
          aria-label="Add salad item"
          onKeyDown={(e) => {
            const input = e.target as HTMLInputElement;
            const v = input.value.trim();
            if (e.key === 'Enter' && v && !line.items.includes(v)) {
              onChange({ ...line, items: [...line.items, v] });
              input.value = '';
            }
          }}
        />
      </div>
    </div>
  );
}
