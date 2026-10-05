import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useState, type ReactNode } from 'react';
import {
  applyTemplate, blankDishLine, dishLineFrom, emptySlotLine, removeLine, saladLine, templateSuggestions, textLine, updateLine,
} from '../model/event';
import { SLOTS, type Catalog, type Dish, type Line, type Meal } from '../model/types';
import { ConfirmButton } from './common';
import { dragId, useSortableBox, type DragBox } from './dnd';
import { DishRow, SaladRow, TextRow } from './LineRow';

interface Props {
  meal: Meal;
  catalog: Catalog;
  dishByName: Map<string, Dish>;
  warnings: string[];
  onChange: (m: Meal) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Handlers that make the header bar the meal's drag handle. */
  drag?: DragBox;
}

export function MealEditor({ meal, catalog, dishByName, warnings, onChange, onDuplicate, onDelete, drag }: Props) {
  const templates = catalog.templates.filter((t) => t.mealType === meal.type);
  const [pickedTemplate, setPickedTemplate] = useState(meal.templateId ?? templates[0]?.id ?? '');
  const template = catalog.templates.find((t) => t.id === meal.templateId);
  const suggestions = templateSuggestions(meal, template, catalog);
  const { setNodeRef: setLinesRef } = useDroppable({ id: `lines-area:${meal.id}`, data: { type: 'lines', mealId: meal.id, empty: meal.lines.length === 0 } });
  const hasSalad = meal.lines.some((l) => l.kind === 'salad');

  const setLine = (l: Line) => onChange(updateLine(meal, l.id, () => l));
  const addLine = (l: Line) => onChange({ ...meal, lines: [...meal.lines, l] });
  const doApply = () => {
    const t = catalog.templates.find((x) => x.id === pickedTemplate);
    if (t) onChange(applyTemplate(meal, t, catalog));
  };

  return (
    <section className={`meal meal-${meal.type.toLowerCase()}`} aria-label={`${meal.type} ${meal.time}`}>
      <header className="meal-head" {...drag?.boxProps}>
        <span className="grip" {...drag?.gripProps}>⋮⋮</span>
        <span className="meal-type">{meal.type}</span>
        <label className="field">
          <span>Time</span>
          <input className="time" value={meal.time} placeholder="e.g. 5AM" onChange={(e) => onChange({ ...meal, time: e.target.value.toUpperCase() })} />
        </label>
        <label className="field">
          <span>People</span>
          <input
            className="ppl"
            type="number"
            min={0}
            inputMode="numeric"
            value={meal.headcount ?? ''}
            placeholder="#"
            onChange={(e) => onChange({ ...meal, headcount: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
          />
        </label>
        <label className="field grow">
          <span>Header note</span>
          <input value={meal.headerNote} placeholder="e.g. CHINA, VERY NICE DINNER PLEASE" onChange={(e) => onChange({ ...meal, headerNote: e.target.value })} />
        </label>
        <div className="meal-actions">
          <button type="button" title="Duplicate this meal" onClick={onDuplicate}>Duplicate</button>
          <ConfirmButton label="Delete" confirmLabel="Delete meal?" onConfirm={onDelete} />
        </div>
      </header>

      {templates.length > 0 && (
        <div className="template-bar">
          <label>
            {meal.type === 'Lunch' ? 'Cuisine' : 'Template'}{' '}
            <select value={pickedTemplate} onChange={(e) => setPickedTemplate(e.target.value)}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          {meal.lines.length === 0
            ? <button type="button" onClick={doApply}>Load</button>
            : <ConfirmButton label={pickedTemplate === meal.templateId ? 'Reset to template' : 'Load (replaces lines)'} confirmLabel="Replace all lines?" onConfirm={doApply} />}
        </div>
      )}

      {warnings.length > 0 && <ul className="warnings">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

      <SortableContext items={meal.lines.map((l) => dragId('line', l.id))} strategy={verticalListSortingStrategy}>
        <ol className={`lines ${meal.lines.length === 0 ? 'empty-drop' : ''}`} ref={setLinesRef}>
          {meal.lines.map((line) => (
            <SortableLine key={line.id} line={line} mealId={meal.id} onRemove={() => onChange(removeLine(meal, line.id))}>
              {line.kind === 'dish' && <DishRow line={line} catalog={catalog} dishByName={dishByName} onChange={setLine} />}
              {line.kind === 'text' && <TextRow line={line} catalog={catalog} dishByName={dishByName} onChange={setLine} />}
              {line.kind === 'salad' && <SaladRow line={line} catalog={catalog} dishByName={dishByName} onChange={setLine} />}
            </SortableLine>
          ))}
          {meal.lines.length === 0 && <li className="drop-hint">No lines yet — add one below, or drag a dish here from another meal.</li>}
        </ol>
      </SortableContext>

      <footer className="meal-foot">
        <button type="button" onClick={() => addLine(blankDishLine())}>+ Dish</button>
        <button type="button" onClick={() => addLine(textLine())}>+ Note line</button>
        {meal.type === 'Dinner' && SLOTS.map((s) => (
          <button key={s} type="button" className="ghost" onClick={() => addLine(emptySlotLine(s))}>+ {s}</button>
        ))}
        {!hasSalad && <button type="button" className="ghost" onClick={() => onChange({ ...meal, lines: [saladLine(catalog.saladBar.standard), ...meal.lines] })}>+ Salad bar</button>}
      </footer>
      {suggestions.length > 0 && (
        <div className="suggestions">
          <span>Quick add:</span>
          {suggestions.map((d) => (
            <button key={d.id} type="button" className="chip" onClick={() => {
              const tl = template?.lines.find((l) => l.dishId === d.id);
              addLine(dishLineFrom(d, { unit: tl?.unit ?? '', slot: tl?.slot, alternatives: tl?.alternatives }));
            }}>+ {d.name}</button>
          ))}
        </div>
      )}
    </section>
  );
}

function SortableLine({ line, mealId, onRemove, children }: { line: Line; mealId: string; onRemove: () => void; children: ReactNode }) {
  const { setNodeRef, style, isDragging, boxProps, gripProps } = useSortableBox(dragId('line', line.id), { type: 'line', mealId });
  return (
    <li ref={setNodeRef} style={style} className={`line line-${line.kind} ${isDragging ? 'dragging' : ''}`} {...boxProps}>
      <span className="grip" {...gripProps}>⋮⋮</span>
      {children}
      <span className="row-actions">
        <button type="button" className="icon remove" title="Remove line" onClick={onRemove}>✕</button>
      </span>
    </li>
  );
}
