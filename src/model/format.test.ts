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
