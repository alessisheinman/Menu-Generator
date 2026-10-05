import { DndContext, DragOverlay, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';
import { formatHeader, printableLines } from '../model/format';
import type { Day, Meal, MenuEvent } from '../model/types';
import { dragId, rawId, useDragSensors, useSortableBox } from './dnd';

interface Props {
  event: MenuEvent;
  activeMealId?: string;
  /** Drop page `mealId` onto page `overMealId` (it may change day). */
  onMoveMeal: (mealId: string, overMealId: string) => void;
}

/** On-screen replica of the Word output: one US Letter page per meal. Drag pages to reorder. */
export function Preview({ event, activeMealId, onMoveMeal }: Props) {
  const sensors = useDragSensors();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const pages = event.days.flatMap((day) => day.meals.map((meal) => ({ day, meal })));
  if (pages.length === 0) return <p className="empty">Add a day and a meal to see the preview.</p>;

  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    if (e.over && e.over.id !== e.active.id) onMoveMeal(rawId(e.active.id), rawId(e.over.id));
  };
  const dragged = pages.find((p) => p.meal.id === draggingId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setDraggingId(rawId(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <p className="hint">Drag pages to change their order.</p>
      <SortableContext items={pages.map((p) => dragId('page', p.meal.id))} strategy={rectSortingStrategy}>
        <div className="pages">
          {pages.map(({ day, meal }) => (
            <SortablePage key={meal.id} day={day} meal={meal} venueLabel={event.venueLabel} active={meal.id === activeMealId} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {dragged && <Page day={dragged.day} meal={dragged.meal} venueLabel={event.venueLabel} className="lifted" />}
      </DragOverlay>
    </DndContext>
  );
}

function SortablePage({ day, meal, venueLabel, active }: { day: Day; meal: Meal; venueLabel: string; active: boolean }) {
  const { setNodeRef, style, isDragging, boxProps, gripProps } = useSortableBox(dragId('page', meal.id), { type: 'page' });
  const { ref: _activatorRef, ...grip } = gripProps; // the whole page is the handle, so it keeps the node ref
  return (
    <div ref={setNodeRef} style={style} {...boxProps} {...grip} className={`page-slot ${isDragging ? 'dragging' : ''}`}>
      <Page day={day} meal={meal} venueLabel={venueLabel} className={active ? 'active' : ''} />
    </div>
  );
}

function Page({ day, meal, venueLabel, className = '' }: { day: Day; meal: Meal; venueLabel: string; className?: string }) {
  return (
    <article id={`page-${meal.id}`} className={`page ${className}`}>
      <div className="page-inner">
        {formatHeader(day.label, venueLabel, meal).filter(Boolean).map((l, i) => <p key={i} className="red">{l}</p>)}
        <p>&nbsp;</p>
        {printableLines(meal).map((l, i) => <p key={i}>{l}</p>)}
      </div>
    </article>
  );
}
