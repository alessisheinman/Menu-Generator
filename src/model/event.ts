import { newId } from './ids';
import type {
  Catalog, Day, Dish, DishLine, Line, Meal, MealTemplate, MealType, MenuEvent, SaladLine, Slot, TextLine,
} from './types';

export function createEvent(name: string, venueLabel: string, fileName: string): MenuEvent {
  return { id: newId(), name, venueLabel, fileName, days: [], updatedAt: new Date().toISOString() };
}

export function createDay(label: string): Day {
  return { id: newId(), label, meals: [] };
}

export function dishLineFrom(dish: Dish, extra: Partial<DishLine> = {}): DishLine {
  return {
    kind: 'dish', id: newId(), qty: '', unit: '', note: '',
    dishName: dish.name, tags: [...dish.tags], sourceDishId: dish.id, ...extra,
  };
}

export function emptySlotLine(slot: Slot): DishLine {
  return { kind: 'dish', id: newId(), qty: '', unit: '', dishName: '', tags: [], note: '', slot };
}

export function blankDishLine(): DishLine {
  return { kind: 'dish', id: newId(), qty: '', unit: '', dishName: '', tags: [], note: '' };
}

export function textLine(text = ''): TextLine {
  return { kind: 'text', id: newId(), text };
}

export function saladLine(items: string[]): SaladLine {
  return { kind: 'salad', id: newId(), size: '', items: [...items] };
}

export function linesFromTemplate(template: MealTemplate, catalog: Catalog): Line[] {
  const byId = new Map(catalog.dishes.map((d) => [d.id, d]));
  const lines: Line[] = [];
  if (template.includesSaladBar) lines.push(saladLine(template.saladItems ?? catalog.saladBar.standard));
  for (const tl of template.lines) {
    if (tl.enabled === false) continue;
    if (tl.dishId === null) {
      if (tl.slot) lines.push(emptySlotLine(tl.slot));
      continue;
    }
    const dish = byId.get(tl.dishId);
    if (!dish) continue; // dish was deleted from the catalog
    lines.push(dishLineFrom(dish, { unit: tl.unit ?? '', slot: tl.slot, alternatives: tl.alternatives }));
  }
  return lines;
}

export function createMeal(type: MealType, template: MealTemplate | undefined, catalog: Catalog): Meal {
  return {
    id: newId(), type, time: '', headcount: null, headerNote: '',
    templateId: template?.id,
    lines: template ? linesFromTemplate(template, catalog) : [],
  };
}

export function applyTemplate(meal: Meal, template: MealTemplate, catalog: Catalog): Meal {
  return { ...meal, templateId: template.id, lines: linesFromTemplate(template, catalog) };
}

/** Template dishes not currently in the meal — shown as one-click "quick add" chips. */
export function templateSuggestions(meal: Meal, template: MealTemplate | undefined, catalog: Catalog): Dish[] {
  if (!template) return [];
  const present = new Set(meal.lines.flatMap((l) => (l.kind === 'dish' && l.sourceDishId ? [l.sourceDishId] : [])));
  const byId = new Map(catalog.dishes.map((d) => [d.id, d]));
  const out: Dish[] = [];
  for (const tl of template.lines) {
    if (!tl.dishId || present.has(tl.dishId)) continue;
    const dish = byId.get(tl.dishId);
    if (dish && !out.includes(dish)) out.push(dish);
  }
  return out;
}

/** Replace a dish line's dish with a catalog dish, keeping qty/unit/note/slot. */
export function setLineDish(line: DishLine, dish: Dish | undefined, typedName: string): DishLine {
  if (dish) return { ...line, dishName: dish.name, tags: [...dish.tags], sourceDishId: dish.id };
  return { ...line, dishName: typedName, sourceDishId: undefined };
}

const cloneLine = (l: Line): Line => {
  const copy = structuredClone(l);
  copy.id = newId();
  return copy;
};

export function duplicateMeal(meal: Meal): Meal {
  return { ...structuredClone(meal), id: newId(), lines: meal.lines.map(cloneLine) };
}

export function duplicateDay(day: Day): Day {
  return { id: newId(), label: day.label, meals: day.meals.map(duplicateMeal) };
}

// ---- immutable update helpers ----

export function touch(event: MenuEvent): MenuEvent {
  return { ...event, updatedAt: new Date().toISOString() };
}

export function mapDay(event: MenuEvent, dayId: string, fn: (d: Day) => Day): MenuEvent {
  return { ...event, days: event.days.map((d) => (d.id === dayId ? fn(d) : d)) };
}

export function mapMeal(event: MenuEvent, dayId: string, mealId: string, fn: (m: Meal) => Meal): MenuEvent {
  return mapDay(event, dayId, (d) => ({ ...d, meals: d.meals.map((m) => (m.id === mealId ? fn(m) : m)) }));
}

export function insertAfter<T extends { id: string }>(list: T[], afterId: string, item: T): T[] {
  const i = list.findIndex((x) => x.id === afterId);
  if (i < 0) return [...list, item];
  return [...list.slice(0, i + 1), item, ...list.slice(i + 1)];
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function updateLine(meal: Meal, lineId: string, fn: (l: Line) => Line): Meal {
  return { ...meal, lines: meal.lines.map((l) => (l.id === lineId ? fn(l) : l)) };
}

export function removeLine(meal: Meal, lineId: string): Meal {
  return { ...meal, lines: meal.lines.filter((l) => l.id !== lineId) };
}

// ---- validation (warnings only; never blocks download) ----

export interface Warning { dayId: string; mealId?: string; message: string; }

export function validateEvent(event: MenuEvent): Warning[] {
  const out: Warning[] = [];
  if (event.days.length === 0) out.push({ dayId: '', message: 'Add at least one day.' });
  event.days.forEach((day, di) => {
    const dayName = day.label.trim() || `Day ${di + 1}`;
    if (!day.label.trim()) out.push({ dayId: day.id, message: `${dayName} has no day label.` });
    day.meals.forEach((meal, mi) => {
      const where = `${dayName}, meal ${mi + 1}`;
      if (!meal.time.trim()) out.push({ dayId: day.id, mealId: meal.id, message: `${where} has no time.` });
      if (meal.headcount == null) out.push({ dayId: day.id, mealId: meal.id, message: `${where} has no headcount.` });
      const empties = meal.lines.filter((l) => l.kind === 'dish' && l.slot && !l.dishName.trim()).length;
      const unitOnly = meal.lines.filter((l) => l.kind === 'dish' && l.dishName.trim() && l.unit.trim() && !l.qty.trim()).length;
      if (unitOnly) out.push({ dayId: day.id, mealId: meal.id, message: `${where} has ${unitOnly} line${unitOnly > 1 ? 's' : ''} with a unit but no quantity.` });
      if (empties) out.push({ dayId: day.id, mealId: meal.id, message: `${where} has ${empties} empty slot${empties > 1 ? 's' : ''} (won't print).` });
    });
  });
  return out;
}
