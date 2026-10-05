import { useState } from 'react';
import {
  applyTemplate, blankDishLine, dishLineFrom, emptySlotLine, move, removeLine, saladLine, templateSuggestions, textLine, updateLine,
} from '../model/event';
import { SLOTS, type Catalog, type Dish, type Line, type Meal } from '../model/types';
import { ConfirmButton } from './common';
import { DishRow, SaladRow, TextRow } from './LineRow';

interface Props {
  meal: Meal;
  index: number;
  count: number;
  catalog: Catalog;
  dishByName: Map<string, Dish>;
  warnings: string[];
  onChange: (m: Meal) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}

export function MealEditor({ meal, index, count, catalog, dishByName, warnings, onChange, onDuplicate, onDelete, onMove }: Props) {
  const templates = catalog.templates.filter((t) => t.mealType === meal.type);
  const [pickedTemplate, setPickedTemplate] = useState(meal.templateId ?? templates[0]?.id ?? '');
  const template = catalog.templates.find((t) => t.id === meal.templateId);
  const suggestions = templateSuggestions(meal, template, catalog);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const hasSalad = meal.lines.some((l) => l.kind === 'salad');

  const setLine = (l: Line) => onChange(updateLine(meal, l.id, () => l));
  const addLine = (l: Line) => onChange({ ...meal, lines: [...meal.lines, l] });
  const doApply = () => {
    const t = catalog.templates.find((x) => x.id === pickedTemplate);
    if (t) onChange(applyTemplate(meal, t, catalog));
  };

  return (
    <section className={`meal meal-${meal.type.toLowerCase()}`} aria-label={`${meal.type} ${meal.time}`}>
      <header className="meal-head">
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
          <button type="button" className="icon" title="Move meal up" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="icon" title="Move meal down" disabled={index === count - 1} onClick={() => onMove(1)}>↓</button>
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

      <ol className="lines">
        {meal.lines.map((line, i) => (
          <li
            key={line.id}
            className={`line line-${line.kind} ${dragOver === i ? 'drag-over' : ''} ${dragFrom === i ? 'dragging' : ''}`}
            onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDragOver(i); } }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null) onChange({ ...meal, lines: move(meal.lines, dragFrom, i) });
              setDragFrom(null);
              setDragOver(null);
            }}
          >
            <span
              className="handle"
              draggable
              title="Drag to reorder"
              onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', line.id); }}
              onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
            >⋮⋮</span>
            {line.kind === 'dish' && <DishRow line={line} catalog={catalog} dishByName={dishByName} onChange={setLine} />}
            {line.kind === 'text' && <TextRow line={line} catalog={catalog} dishByName={dishByName} onChange={setLine} />}
            {line.kind === 'salad' && <SaladRow line={line} catalog={catalog} dishByName={dishByName} onChange={setLine} />}
            <span className="row-actions">
              <button type="button" className="icon" title="Move up" disabled={i === 0} onClick={() => onChange({ ...meal, lines: move(meal.lines, i, i - 1) })}>↑</button>
              <button type="button" className="icon" title="Move down" disabled={i === meal.lines.length - 1} onClick={() => onChange({ ...meal, lines: move(meal.lines, i, i + 1) })}>↓</button>
              <button type="button" className="icon remove" title="Remove line" onClick={() => onChange(removeLine(meal, line.id))}>✕</button>
            </span>
          </li>
        ))}
      </ol>

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
