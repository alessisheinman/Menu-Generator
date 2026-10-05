import { useMemo, useState } from 'react';
import {
  createDay, createMeal, duplicateDay, duplicateMeal, insertAfter, mapDay, mapMeal, move, touch, validateEvent,
} from '../model/event';
import type { Catalog, MealType, MenuEvent } from '../model/types';
import { ConfirmButton, UNIT_SUGGESTIONS, WEEKDAYS } from './common';
import { MealEditor } from './MealEditor';
import { Preview } from './Preview';
import { saveBlob } from './useAppState';

interface Props {
  event: MenuEvent;
  catalog: Catalog;
  onChange: (e: MenuEvent) => void;
  onBack: () => void;
}

const ADDABLE: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Custom'];

export function EventEditor({ event, catalog, onChange, onBack }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [activeMealId, setActiveMealId] = useState<string>();
  const update = (e: MenuEvent) => onChange(touch(e));

  const dishByName = useMemo(() => new Map(catalog.dishes.map((d) => [d.name.toLowerCase(), d])), [catalog.dishes]);
  const warnings = validateEvent(event);
  const mealWarnings = (mealId: string) => warnings.filter((w) => w.mealId === mealId).map((w) => w.message);
  const venueMatch = catalog.venues.find((v) => v.printLabel === event.venueLabel || v.name === event.venueLabel);

  const addMeal = (dayId: string, type: MealType) => {
    const template = catalog.templates.find((t) => t.mealType === type);
    const meal = createMeal(type, template, catalog);
    update(mapDay(event, dayId, (d) => ({ ...d, meals: [...d.meals, meal] })));
    setActiveMealId(meal.id);
  };

  const addDay = () => {
    // Suggest the weekday after the previous day.
    const last = event.days[event.days.length - 1];
    const lastIdx = last ? WEEKDAYS.indexOf(last.label.trim().toUpperCase()) : -1;
    const label = lastIdx >= 0 ? WEEKDAYS[(lastIdx + 1) % 7] : '';
    update({ ...event, days: [...event.days, createDay(label)] });
  };

  const download = async () => {
    setDownloading(true);
    setError('');
    try {
      const name = event.fileName.trim() || 'Kitchen Menu.docx';
      const { buildDocxBlob } = await import('../docx/buildDocx'); // loaded on demand to keep the page light
      saveBlob(await buildDocxBlob(event), name.toLowerCase().endsWith('.docx') ? name : `${name}.docx`);
    } catch (e) {
      setError(`Couldn't build the Word file: ${(e as Error).message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="editor">
      <datalist id="dl-units">{UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}</datalist>
      <datalist id="dl-days">{WEEKDAYS.map((d) => <option key={d} value={d} />)}</datalist>
      <datalist id="dl-venues">{catalog.venues.map((v) => <option key={v.id} value={v.printLabel}>{v.name}</option>)}</datalist>

      <div className="editor-main">
        <div className="event-bar">
          <button type="button" className="ghost" onClick={onBack}>← All events</button>
          <label className="field grow">
            <span>Event</span>
            <input className="event-name" value={event.name} onChange={(e) => update({ ...event, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Venue (as printed)</span>
            <input value={event.venueLabel} list="dl-venues" placeholder="RCMH" onChange={(e) => {
              const v = catalog.venues.find((x) => x.name === e.target.value);
              update({ ...event, venueLabel: v ? v.printLabel : e.target.value });
            }} />
            {venueMatch && venueMatch.name !== venueMatch.printLabel && <small>{venueMatch.name}</small>}
          </label>
        </div>

        {event.days.map((day, di) => (
          <section key={day.id} className="day">
            <header className="day-head">
              <input
                className="day-label"
                value={day.label}
                list="dl-days"
                placeholder="DAY (e.g. TUESDAY)"
                aria-label="Day label"
                onChange={(e) => update(mapDay(event, day.id, (d) => ({ ...d, label: e.target.value.toUpperCase() })))}
              />
              <div className="day-actions">
                <button type="button" className="icon" title="Move day up" disabled={di === 0} onClick={() => update({ ...event, days: move(event.days, di, di - 1) })}>↑</button>
                <button type="button" className="icon" title="Move day down" disabled={di === event.days.length - 1} onClick={() => update({ ...event, days: move(event.days, di, di + 1) })}>↓</button>
                <button type="button" title="Copy this whole day" onClick={() => update({ ...event, days: insertAfter(event.days, day.id, duplicateDay(day)) })}>Duplicate day</button>
                <ConfirmButton label="Delete day" confirmLabel="Delete whole day?" onConfirm={() => update({ ...event, days: event.days.filter((d) => d.id !== day.id) })} />
              </div>
            </header>

            {day.meals.map((meal, mi) => (
              <div key={meal.id} onFocusCapture={() => setActiveMealId(meal.id)}>
                <MealEditor
                  meal={meal}
                  index={mi}
                  count={day.meals.length}
                  catalog={catalog}
                  dishByName={dishByName}
                  warnings={mealWarnings(meal.id)}
                  onChange={(m) => update(mapMeal(event, day.id, meal.id, () => m))}
                  onDuplicate={() => update(mapDay(event, day.id, (d) => ({ ...d, meals: insertAfter(d.meals, meal.id, duplicateMeal(meal)) })))}
                  onDelete={() => update(mapDay(event, day.id, (d) => ({ ...d, meals: d.meals.filter((m) => m.id !== meal.id) })))}
                  onMove={(dir) => update(mapDay(event, day.id, (d) => ({ ...d, meals: move(d.meals, mi, mi + dir) })))}
                />
              </div>
            ))}

            <div className="add-meal">
              <span>Add meal:</span>
              {ADDABLE.map((t) => <button key={t} type="button" onClick={() => addMeal(day.id, t)}>+ {t}</button>)}
            </div>
          </section>
        ))}

        <button type="button" className="add-day" onClick={addDay}>+ Add day</button>
      </div>

      <aside className="editor-side">
        <div className="download-box">
          <label className="field">
            <span>File name</span>
            <input value={event.fileName} onChange={(e) => update({ ...event, fileName: e.target.value })} />
          </label>
          <button type="button" className="primary" disabled={downloading} onClick={download}>
            {downloading ? 'Building…' : 'Download .docx'}
          </button>
          {error && <p className="error">{error}</p>}
          {warnings.length > 0 && (
            <details className="warn-summary">
              <summary>{warnings.length} thing{warnings.length > 1 ? 's' : ''} to check (download still works)</summary>
              <ul>{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
            </details>
          )}
        </div>
        <h2 className="preview-title">Preview</h2>
        <Preview event={event} activeMealId={activeMealId} />
      </aside>
    </div>
  );
}

