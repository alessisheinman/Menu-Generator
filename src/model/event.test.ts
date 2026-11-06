import { describe, expect, it } from 'vitest';
import {
  addBreakfastStation, applyTemplate, breakfastStationsAvailable, carriedHeader, createDay, createEvent, createMeal, duplicateDay,
  duplicateMeal, insertAfter, mapMeal, move, setLineDish, templateSuggestions, validateEvent,
} from './event';
import type { BurritoLine, Catalog, DishLine, MealTemplate, MealType, MenuEvent } from './types';

const catalog: Catalog = {
  dishes: [
    { id: 'eggs', name: 'Scrambled Organic Eggs', category: 'Breakfast', tags: ['GF'] },
    { id: 'patties', name: 'Local Sausage Patties', category: 'Breakfast', tags: ['GF'] },
    { id: 'links', name: 'Local Sausage Links', category: 'Breakfast', tags: ['GF'] },
    { id: 'espresso', name: 'Espresso', category: 'Beverage/Service', tags: [] },
  ],
  templates: [],
  venues: [],
  saladBar: { standard: ['Cherry Tomatoes', 'Corn'], addOns: ['Tuna'] },
  omelette: { standard: ['ham', 'shredded cheese'], addOns: ['grilled chicken'] },
  burritoKinds: [{ code: 'EGG/CH', name: 'Egg & Cheese' }, { code: 'B/E/C', name: 'Bacon, Egg & Cheese' }],
};

const breakfast: MealTemplate = {
  id: 'bf', name: 'Breakfast', mealType: 'Breakfast', includesSaladBar: false,
  lines: [
    { dishId: 'eggs' },
    { dishId: 'patties', alternatives: ['links'] },
    { dishId: 'espresso', enabled: false },
    { dishId: 'deleted-dish' },
  ],
};

describe('carriedHeader (banner text for a new meal)', () => {
  const banner = (type: MealType, time: string, headcount: number | null, headerNote: string) =>
    ({ ...createMeal(type, undefined, catalog), time, headcount, headerNote });
  const eventWith = (...days: ReturnType<typeof banner>[][]): MenuEvent => ({
    ...createEvent('E', 'RCMH', 'e.docx'),
    days: days.map((meals) => ({ ...createDay('DAY'), meals })),
  });

  it('starts blank when there is nothing to copy', () => {
    const ev = eventWith([]);
    expect(carriedHeader(ev, ev.days[0].id, 'Lunch')).toEqual({ time: '', headcount: null, headerNote: '' });
  });
  it('copies people and note from the meal before it on the same day, but not its time', () => {
    const ev = eventWith([banner('Breakfast', '5AM', 40, 'CHINA')]);
    expect(carriedHeader(ev, ev.days[0].id, 'Lunch')).toEqual({ time: '', headcount: 40, headerNote: 'CHINA' });
  });
  it('copies everything, time included, from the same meal on an earlier day', () => {
    const ev = eventWith([banner('Lunch', '12PM', 60, 'BUFFET'), banner('Dinner', '6PM', 80, 'CHINA')], []);
    expect(carriedHeader(ev, ev.days[1].id, 'Lunch')).toEqual({ time: '12PM', headcount: 60, headerNote: 'BUFFET' });
  });
  it('prefers the closest earlier meal of that type', () => {
    const ev = eventWith([banner('Lunch', '12PM', 60, 'OLD')], [banner('Lunch', '1PM', 70, 'NEW')], []);
    expect(carriedHeader(ev, ev.days[2].id, 'Lunch')).toEqual({ time: '1PM', headcount: 70, headerNote: 'NEW' });
  });
  it('fills gaps in the same-type meal from the nearest other meal', () => {
    const ev = eventWith([banner('Lunch', '12PM', null, ''), banner('Dinner', '6PM', 80, 'CHINA')], []);
    expect(carriedHeader(ev, ev.days[1].id, 'Lunch')).toEqual({ time: '12PM', headcount: 80, headerNote: 'CHINA' });
  });
  it('looks at later days only when nothing comes earlier', () => {
    const ev = eventWith([], [banner('Lunch', '12PM', 60, 'BUFFET')]);
    expect(carriedHeader(ev, ev.days[0].id, 'Lunch')).toEqual({ time: '12PM', headcount: 60, headerNote: 'BUFFET' });
  });
  it('keeps a headcount of zero rather than treating it as blank', () => {
    const ev = eventWith([banner('Lunch', '', 0, '')]);
    expect(carriedHeader(ev, ev.days[0].id, 'Dinner').headcount).toBe(0);
  });
});

describe('createMeal / applyTemplate', () => {
  it('adds enabled template dishes, skipping disabled and missing ones', () => {
    const meal = createMeal('Breakfast', breakfast, catalog);
    expect(meal.lines.map((l) => (l as DishLine).dishName)).toEqual(['Scrambled Organic Eggs', 'Local Sausage Patties']);
    expect((meal.lines[1] as DishLine).alternatives).toEqual(['links']);
    expect(meal.templateId).toBe('bf');
  });

  it('puts the salad bar first and creates empty dinner slots', () => {
    const t: MealTemplate = {
      id: 'x', name: 'x', mealType: 'Dinner', includesSaladBar: true,
      lines: [{ dishId: null, slot: 'Starch' }],
    };
    const meal = createMeal('Dinner', t, catalog);
    expect(meal.lines[0]).toMatchObject({ kind: 'salad', items: ['Cherry Tomatoes', 'Corn'], size: '' });
    expect(meal.lines[1]).toMatchObject({ kind: 'dish', slot: 'Starch', dishName: '' });
  });

  it('applyTemplate replaces all lines', () => {
    const meal = { ...createMeal('Custom', undefined, catalog), lines: [] };
    expect(applyTemplate(meal, breakfast, catalog).lines).toHaveLength(2);
  });

  it('snapshots tags so later catalog edits do not leak into the meal', () => {
    const meal = createMeal('Breakfast', breakfast, catalog);
    catalog.dishes[0].tags.push('Vegan');
    expect((meal.lines[0] as DishLine).tags).toEqual(['GF']);
    catalog.dishes[0].tags.pop();
  });
});

describe('breakfast stations', () => {
  const meal = () => createMeal('Breakfast', breakfast, catalog);

  it('adds the omelette station first, with the standard fillings ticked', () => {
    const m = addBreakfastStation(meal(), 'omelette', catalog);
    expect(m.lines[0]).toMatchObject({ kind: 'omelette', size: '', eggs: '', items: ['ham', 'shredded cheese'] });
    expect(m.lines).toHaveLength(3);
  });

  it('adds burritos with every catalog kind and no counts, right after the omelette station', () => {
    const m = addBreakfastStation(addBreakfastStation(meal(), 'omelette', catalog), 'burritos', catalog);
    expect(m.lines.map((l) => l.kind)).toEqual(['omelette', 'burritos', 'dish', 'dish']);
    expect(m.lines[1]).toMatchObject({ kind: 'burritos', kinds: [{ code: 'EGG/CH', qty: null }, { code: 'B/E/C', qty: null }] });
  });

  it('puts burritos first when there is no omelette station, and the omelette station above them', () => {
    const m = addBreakfastStation(addBreakfastStation(meal(), 'burritos', catalog), 'omelette', catalog);
    expect(m.lines.map((l) => l.kind)).toEqual(['omelette', 'burritos', 'dish', 'dish']);
  });

  it('never adds a second one of the same station', () => {
    const once = addBreakfastStation(meal(), 'burritos', catalog);
    expect(addBreakfastStation(once, 'burritos', catalog)).toBe(once);
  });

  it('only offers stations on breakfast meals', () => {
    expect(breakfastStationsAvailable(createMeal('Breakfast', undefined, catalog))).toEqual(['omelette', 'burritos']);
    expect(breakfastStationsAvailable(addBreakfastStation(meal(), 'omelette', catalog))).toEqual(['burritos']);
    expect(breakfastStationsAvailable(createMeal('Lunch', undefined, catalog))).toEqual([]);
  });

  it('gives a duplicated meal its own copy of the burrito counts', () => {
    const m = addBreakfastStation(meal(), 'burritos', catalog);
    const copy = duplicateMeal(m);
    (copy.lines[0] as BurritoLine).kinds[0].qty = 5;
    expect((m.lines[0] as BurritoLine).kinds[0].qty).toBeNull();
  });
});

describe('templateSuggestions', () => {
  it('offers template dishes not in the meal', () => {
    const meal = createMeal('Breakfast', breakfast, catalog);
    expect(templateSuggestions(meal, breakfast, catalog).map((d) => d.id)).toEqual(['espresso']);
  });
});

describe('setLineDish', () => {
  it('keeps qty and unit when swapping dishes', () => {
    const meal = createMeal('Breakfast', breakfast, catalog);
    const line = { ...(meal.lines[1] as DishLine), qty: '2' };
    const swapped = setLineDish(line, catalog.dishes[2], '');
    expect(swapped).toMatchObject({ qty: '2', dishName: 'Local Sausage Links', sourceDishId: 'links' });
  });
  it('accepts a one-off typed dish', () => {
    const line = createMeal('Breakfast', breakfast, catalog).lines[0] as DishLine;
    expect(setLineDish(line, undefined, 'Mystery Dish')).toMatchObject({ dishName: 'Mystery Dish', sourceDishId: undefined, tags: ['GF'] });
  });
});

describe('duplicate', () => {
  it('deep-copies a meal with new ids', () => {
    const meal = createMeal('Breakfast', breakfast, catalog);
    const copy = duplicateMeal(meal);
    expect(copy.id).not.toBe(meal.id);
    expect(copy.lines[0].id).not.toBe(meal.lines[0].id);
    (copy.lines[0] as DishLine).qty = '9';
    expect((meal.lines[0] as DishLine).qty).toBe('');
  });
  it('deep-copies a day', () => {
    const day = { ...createDay('Tuesday'), meals: [createMeal('Breakfast', breakfast, catalog)] };
    const copy = duplicateDay(day);
    expect(copy.id).not.toBe(day.id);
    expect(copy.meals[0].id).not.toBe(day.meals[0].id);
    expect(copy.label).toBe('Tuesday');
  });
});

describe('list helpers', () => {
  it('move reorders and ignores out-of-range', () => {
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(move(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
  it('insertAfter places item after the target', () => {
    expect(insertAfter([{ id: 'a' }, { id: 'b' }], 'a', { id: 'x' }).map((x) => x.id)).toEqual(['a', 'x', 'b']);
  });
});

describe('validateEvent', () => {
  it('warns about missing time, headcount and empty slots', () => {
    let ev = createEvent('E', 'RCMH', 'E.docx');
    const day = createDay('Tuesday');
    const meal = createMeal('Dinner', { id: 'd', name: 'd', mealType: 'Dinner', includesSaladBar: false, lines: [{ dishId: null, slot: 'Protein' }] }, catalog);
    ev = { ...ev, days: [{ ...day, meals: [meal] }] };
    const msgs = validateEvent(ev).map((w) => w.message);
    expect(msgs).toEqual([
      'Tuesday, meal 1 has no time.',
      'Tuesday, meal 1 has no headcount.',
      'Tuesday, meal 1 has 1 empty slot (won\'t print).',
    ]);
    ev = mapMeal(ev, day.id, meal.id, (m) => ({ ...m, time: '2PM', headcount: 40, lines: [] }));
    expect(validateEvent(ev)).toEqual([]);
  });
  it('warns about a unit with no quantity (would print "dz Pastries")', () => {
    const day = createDay('Tuesday');
    const meal = { ...createMeal('Custom', undefined, catalog), time: '5AM', headcount: 70 };
    meal.lines = [{ kind: 'dish', id: 'l', qty: '', unit: 'dz', dishName: 'Pastries', tags: [], note: '' }];
    const ev = { ...createEvent('E', 'RCMH', 'E.docx'), days: [{ ...day, meals: [meal] }] };
    expect(validateEvent(ev).map((w) => w.message)).toEqual(['Tuesday, meal 1 has 1 line with a unit but no quantity.']);
  });
  it('warns when there are no days', () => {
    expect(validateEvent(createEvent('E', '', 'E.docx'))[0].message).toBe('Add at least one day.');
  });
});
