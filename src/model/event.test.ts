import { describe, expect, it } from 'vitest';
import {
  applyTemplate, createDay, createEvent, createMeal, duplicateDay, duplicateMeal, insertAfter, mapMeal, move,
  setLineDish, templateSuggestions, validateEvent,
} from './event';
import type { Catalog, DishLine, MealTemplate } from './types';

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
