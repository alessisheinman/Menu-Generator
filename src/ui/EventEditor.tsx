import {
  DndContext, DragOverlay, MeasuringStrategy, useDroppable, type DragEndEvent, type DragOverEvent, type DragStartEvent, type Over,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createDay, createMeal, duplicateDay, duplicateMeal, insertAfter, mapDay, mapMeal, touch, validateEvent,
} from '../model/event';
import { formatHeader, formatLine } from '../model/format';
import { findLine, findMeal, moveDay, moveLine, moveMeal } from '../model/reorder';
import type { Catalog, Day, Meal, MealType, MenuEvent } from '../model/types';
import { ConfirmButton, UNIT_SUGGESTIONS, WEEKDAYS } from './common';
import { dragId, rawId, typedCollision, useDragSensors, useSortableBox, type DragBox, type DragType } from './dnd';
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
  // Drag handlers read the latest event through a ref (several drag-over moves can fire between renders).
  const eventRef = useRef(event);
  eventRef.current = event;
  const dragStart = useRef<MenuEvent | null>(null);
  const [dragging, setDragging] = useState<{ type: DragType; id: string } | null>(null);
  const sensors = useDragSensors();

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

  /** Where a drop would land: the container (meal or day) and the hovered item, if any. */
  const targetOf = (over: Over | null) => {
    const d = over?.data.current;
    if (!over || !d) return null;
    if (d.type === 'line' || d.type === 'lines') return { container: d.mealId as string, overId: d.type === 'line' ? rawId(over.id) : undefined };
    if (d.type === 'meal' || d.type === 'meals') return { container: d.dayId as string, overId: d.type === 'meal' ? rawId(over.id) : undefined };
    if (d.type === 'day') return { container: 'days', overId: rawId(over.id) };
    return null;
  };
  const applyMove = (type: DragType, id: string, t: { container: string; overId?: string }) => {
    const ev = eventRef.current;
    const next = type === 'line' ? moveLine(ev, id, t.container, t.overId)
      : type === 'meal' ? moveMeal(ev, id, t.container, t.overId)
        : t.overId ? moveDay(ev, id, t.overId) : ev;
    if (next !== ev) { eventRef.current = next; update(next); }
  };
  const containerOf = (type: DragType, id: string) =>
    type === 'line' ? findLine(eventRef.current, id)?.meal.id : type === 'meal' ? findMeal(eventRef.current, id)?.day.id : 'days';

  const onDragStart = (e: DragStartEvent) => {
    dragStart.current = eventRef.current;
    setDragging({ type: e.active.data.current?.type as DragType, id: rawId(e.active.id) });
  };
  // Crossing into another meal/day moves the item right away so that list opens a gap for it.
  const activeOf = (e: DragOverEvent | DragEndEvent) => ({ type: e.active.data.current?.type as DragType, id: rawId(e.active.id) });
  const onDragOver = (e: DragOverEvent) => {
    const a = activeOf(e);
    if (a.type === 'day') return;
    const t = targetOf(e.over);
    if (t && t.overId !== a.id && t.container !== containerOf(a.type, a.id)) applyMove(a.type, a.id, t);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const a = activeOf(e);
    const t = targetOf(e.over);
    if (t && t.overId && t.overId !== a.id && t.container === containerOf(a.type, a.id)) applyMove(a.type, a.id, t);
    setDragging(null);
    dragStart.current = null;
  };
  const onDragCancel = () => {
    if (dragStart.current) update(dragStart.current);
    setDragging(null);
    dragStart.current = null;
  };

  const overlay = (): ReactNode => {
    if (!dragging) return null;
    if (dragging.type === 'line') {
      const hit = findLine(event, dragging.id);
      return hit && <div className="drag-chip">{formatLine(hit.line) || 'Empty line'}</div>;
    }
    if (dragging.type === 'meal') {
      const hit = findMeal(event, dragging.id);
      return hit && <div className="drag-card"><span className="meal-type">{hit.meal.type}</span> {formatHeader(hit.day.label, '', hit.meal).filter(Boolean).join(', ')}</div>;
    }
    const day = event.days.find((d) => d.id === dragging.id);
    return day && <div className="drag-card day-card">{day.label || 'Day'}, {day.meals.length} meal{day.meals.length === 1 ? '' : 's'}</div>;
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

        <DndContext
          sensors={sensors}
          collisionDetection={typedCollision}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <SortableContext items={event.days.map((d) => dragId('day', d.id))} strategy={verticalListSortingStrategy}>
            {event.days.map((day) => (
              <SortableDay key={day.id} day={day}>
                {(drag) => (
                  <>
                    <header className="day-head" {...drag.boxProps}>
                      <span className="grip" {...drag.gripProps}>⋮⋮</span>
                      <input
                        className="day-label"
                        value={day.label}
                        list="dl-days"
                        placeholder="DAY (e.g. TUESDAY)"
                        aria-label="Day label"
                        onChange={(e) => update(mapDay(event, day.id, (d) => ({ ...d, label: e.target.value.toUpperCase() })))}
                      />
                      <div className="day-actions">
                        <button type="button" title="Copy this whole day" onClick={() => update({ ...event, days: insertAfter(event.days, day.id, duplicateDay(day)) })}>Duplicate day</button>
                        <ConfirmButton label="Delete day" confirmLabel="Delete whole day?" onConfirm={() => update({ ...event, days: event.days.filter((d) => d.id !== day.id) })} />
                      </div>
                    </header>

                    <SortableContext items={day.meals.map((m) => dragId('meal', m.id))} strategy={verticalListSortingStrategy}>
                      <MealsArea day={day}>
                        {day.meals.map((meal) => (
                          <SortableMeal key={meal.id} meal={meal} dayId={day.id}>
                            {(mealDrag) => (
                              <div onFocusCapture={() => setActiveMealId(meal.id)}>
                                <MealEditor
                                  meal={meal}
                                  catalog={catalog}
                                  dishByName={dishByName}
                                  warnings={mealWarnings(meal.id)}
                                  drag={mealDrag}
                                  onChange={(m) => update(mapMeal(event, day.id, meal.id, () => m))}
                                  onDuplicate={() => update(mapDay(event, day.id, (d) => ({ ...d, meals: insertAfter(d.meals, meal.id, duplicateMeal(meal)) })))}
                                  onDelete={() => update(mapDay(event, day.id, (d) => ({ ...d, meals: d.meals.filter((m) => m.id !== meal.id) })))}
                                />
                              </div>
                            )}
                          </SortableMeal>
                        ))}
                      </MealsArea>
                    </SortableContext>

                    <div className="add-meal">
                      <span>Add meal:</span>
                      {ADDABLE.map((t) => <button key={t} type="button" onClick={() => addMeal(day.id, t)}>+ {t}</button>)}
                    </div>
                  </>
                )}
              </SortableDay>
            ))}
          </SortableContext>
          <DragOverlay dropAnimation={null}>{overlay()}</DragOverlay>
        </DndContext>

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
        <Preview
          event={event}
          activeMealId={activeMealId}
          onMoveMeal={(mealId, overMealId) => {
            const over = findMeal(event, overMealId);
            if (over) update(moveMeal(event, mealId, over.day.id, overMealId));
          }}
        />
      </aside>
    </div>
  );
}


function SortableDay({ day, children }: { day: Day; children: (drag: DragBox) => ReactNode }) {
  const { setNodeRef, style, isDragging, boxProps, gripProps } = useSortableBox(dragId('day', day.id), { type: 'day' });
  return (
    <section ref={setNodeRef} style={style} className={`day ${isDragging ? 'dragging' : ''}`}>
      {children({ boxProps, gripProps })}
    </section>
  );
}

function MealsArea({ day, children }: { day: Day; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `meals-area:${day.id}`, data: { type: 'meals', dayId: day.id, empty: day.meals.length === 0 } });
  return (
    <div ref={setNodeRef} className={`meals ${day.meals.length === 0 ? 'empty-drop' : ''}`}>
      {children}
      {day.meals.length === 0 && <p className="drop-hint">No meals yet — add one below, or drag a meal here.</p>}
    </div>
  );
}

function SortableMeal({ meal, dayId, children }: { meal: Meal; dayId: string; children: (drag: DragBox) => ReactNode }) {
  const { setNodeRef, style, isDragging, boxProps, gripProps } = useSortableBox(dragId('meal', meal.id), { type: 'meal', dayId });
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'dragging' : ''}>
      {children({ boxProps, gripProps })}
    </div>
  );
}
