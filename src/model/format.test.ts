import { describe, expect, it } from 'vitest';
import { defaultFileName, formatHeader, formatLine, formatTags, printableLines } from './format';
import type { DishLine, Meal } from './types';

const dish = (over: Partial<DishLine>): DishLine => ({
  kind: 'dish', id: 'x', qty: '', unit: '', dishName: '', tags: [], note: '', ...over,
});

describe('formatTags', () => {
  it('prints nothing for no tags', () => expect(formatTags([])).toBe(''));
  it('prints GF alone without parentheses', () => expect(formatTags(['GF'])).toBe('GF'));
  it('wraps a single non-GF tag', () => expect(formatTags(['Vegan'])).toBe('(Vegan)'));
  it('orders and wraps multiple tags', () => expect(formatTags(['GF', 'Vegan'])).toBe('(Vegan, GF)'));
  it('drops duplicates', () => expect(formatTags(['GF', 'GF', 'Vegan'])).toBe('(Vegan, GF)'));
});

describe('formatLine', () => {
  it('joins qty, unit, name, tags and note', () => {
    expect(formatLine(dish({ qty: '1', dishName: '“Just” Eggs Scrambled', tags: ['Vegan', 'GF'], note: 'OVALADO' })))
      .toBe('1 “Just” Eggs Scrambled (Vegan, GF) OVALADO');
  });
  it('includes the unit', () => expect(formatLine(dish({ qty: '5', unit: 'dz', dishName: 'Pastries' }))).toBe('5 dz Pastries'));
  it('skips blank parts', () => expect(formatLine(dish({ dishName: 'Moroccan Lentil Soup', tags: ['Vegan', 'GF'] }))).toBe('Moroccan Lentil Soup (Vegan, GF)'));
  it('keeps fractions as typed', () => expect(formatLine(dish({ qty: '½', dishName: 'Soup' }))).toBe('½ Soup'));
  it('prints text lines verbatim', () => expect(formatLine({ kind: 'text', id: 't', text: 'JUICER' })).toBe('JUICER'));
  it('prints the salad bar with size', () => {
    expect(formatLine({ kind: 'salad', id: 's', size: 'Large', items: ['Cherry Tomatoes', 'Corn'] }))
      .toBe('Salad with Large: Cherry Tomatoes, Corn');
  });
  it('prints the salad bar without size', () => {
    expect(formatLine({ kind: 'salad', id: 's', size: '', items: ['Cucumbers'] })).toBe('Salad with: Cucumbers');
  });
  it('prints the omelette station with its egg count', () => {
    expect(formatLine({ kind: 'omelette', id: 'o', size: '', eggs: '50', items: ['ham', 'shredded cheese', 'parsley'] }))
      .toBe('50 EGGS OMELETTE STATION: ham, shredded cheese, parsley');
  });
  it('prints the omelette station without a count or fillings', () => {
    expect(formatLine({ kind: 'omelette', id: 'o', size: '', eggs: ' ', items: ['ham'] })).toBe('OMELETTE STATION: ham');
    expect(formatLine({ kind: 'omelette', id: 'o', size: '', eggs: '', items: [] })).toBe('OMELETTE STATION');
  });
  it('prints the omelette station size in capitals, with or without a count', () => {
    expect(formatLine({ kind: 'omelette', id: 'o', size: 'Large', eggs: '50', items: ['ham'] })).toBe('50 EGGS LARGE OMELETTE STATION: ham');
    expect(formatLine({ kind: 'omelette', id: 'o', size: 'Small', eggs: '', items: [] })).toBe('SMALL OMELETTE STATION');
  });
  it('prints omelette stations saved before sizes existed', () => {
    const saved = { kind: 'omelette', id: 'o', eggs: '50', items: ['ham'] } as unknown as Parameters<typeof formatLine>[0];
    expect(formatLine(saved)).toBe('50 EGGS OMELETTE STATION: ham');
  });
  it('prints assorted burritos with a total and only the kinds that have a count', () => {
    const kinds = [{ code: 'EGG/CH', qty: 10 }, { code: 'B/E/C', qty: 10 }, { code: 'S/E/C', qty: null }, { code: 'X', qty: 0 }];
    expect(formatLine({ kind: 'burritos', id: 'b', kinds })).toBe('20 Assorted Burritos: 10 EGG/CH, 10 B/E/C');
  });
  it('prints assorted burritos with no counts as a plain line', () => {
    expect(formatLine({ kind: 'burritos', id: 'b', kinds: [{ code: 'EGG/CH', qty: null }] })).toBe('Assorted Burritos');
  });
});

describe('printableLines', () => {
  it('omits empty dinner slots and blank text lines', () => {
    const meal = {
      lines: [dish({ slot: 'Starch' }), { kind: 'text', id: 't', text: '  ' }, dish({ qty: '2', dishName: 'Rice' })],
    } as Meal;
    expect(printableLines(meal)).toEqual(['2 Rice']);
  });
});

describe('formatHeader', () => {
  const meal = { time: '5AM', headcount: 70, headerNote: '' } as Meal;
  it('builds the three red lines', () => {
    expect(formatHeader('Tuesday', 'RCMH', meal)).toEqual(['TUESDAY', 'RCMH', '5AM 70 PPL']);
  });
  it('appends the header note and tolerates missing parts', () => {
    expect(formatHeader('wed', '', { ...meal, headcount: null, headerNote: 'CHINA' }))
      .toEqual(['WED', '', '5AM CHINA']);
  });
});

describe('defaultFileName', () => {
  it('uses the existing naming style and strips illegal characters', () => {
    expect(defaultFileName('Artist Name / Radio City', 2026)).toBe('Artist Name Radio City Kitchen Menu 2026.docx');
  });
});
