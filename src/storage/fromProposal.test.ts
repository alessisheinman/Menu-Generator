import { describe, expect, it } from 'vitest';
import type { Catalog, DishLine } from '../model/types';
import { kitchenDayLabel, parseProposals, proposalToKitchen, readBrowserProposals, type Proposal } from './fromProposal';

const catalog: Catalog = {
  dishes: [
    { id: 'organic-scrambled-eggs', name: 'Organic Scrambled Eggs', category: 'Breakfast', tags: ['GF'] },
    { id: 'french-toast', name: 'French Toast', category: 'Breakfast', tags: [] },
    { id: 'blueberry-pancakes', name: 'Blueberry Pancakes', category: 'Breakfast', tags: [] },
  ],
  templates: [{ id: 'lunch-italian', name: 'Italian', mealType: 'Lunch', includesSaladBar: true, lines: [] }],
  venues: [{ id: 'rcmh', name: 'Radio City Music Hall', printLabel: 'RCMH' }],
  saladBar: { standard: ['Cherry Tomatoes', 'Corn'], addOns: [] },
};

const proposal = {
  id: 'p1', name: 'ENHYPEN World Tour', venue: 'Radio City Music Hall', updatedAt: '2026-10-09T00:00:00Z',
  palette: { primary: '#bc8851', secondary: '#5ab8a3', auto: true }, coverId: 'cov', coverFocusY: 35, fileName: 'x.pdf',
  days: [{
    id: 'd', dateLabel: 'Tuesday, November 10',
    meals: [
      {
        id: 'm1', type: 'Breakfast', title: 'BREAKFAST', templateId: 'breakfast-standard',
        lines: [
          { kind: 'dish', id: 'l1', dishName: 'Organic Scrambled Eggs', tags: ['GF'], description: 'Soft, fluffy farm-fresh eggs', sourceDishId: 'organic-scrambled-eggs' },
          { kind: 'dish', id: 'l2', dishName: 'Tofu Scramble', tags: ['Vegan', 'GF', 'Bogus'], description: 'Turmeric tofu', alternatives: ['french-toast', 'not-in-kitchen'] },
          { kind: 'dish', id: 'l3', dishName: 'blueberry pancakes', tags: [], description: '' },
        ],
      },
      {
        id: 'm2', type: 'Lunch', title: 'LUNCH', templateId: 'lunch-italian',
        lines: [
          { kind: 'dish', id: 'l4', dishName: 'Salad World', tags: [], description: 'Build-your-own salad' },
          { kind: 'text', id: 't1', text: 'Sandwich Station' },
          { kind: 'dish', id: 'l5', dishName: '', tags: [], description: '', slot: 'Dessert' },
        ],
      },
      { id: 'm3', type: 'Custom', title: 'OVERNIGHT MEAL', lines: [] },
    ],
  }],
};

describe('parseProposals', () => {
  it('reads a proposal backup or the saved browser data', () => {
    const res = parseProposals(JSON.stringify({ schemaVersion: 1, events: [proposal], covers: { cov: 'data:...' } }));
    expect(res.ok && res.proposals.map((p) => p.name)).toEqual(['ENHYPEN World Tour']);
    expect(parseProposals(null)).toEqual({ ok: true, proposals: [] });
  });
  it('explains when given a kitchen backup or garbage', () => {
    const kitchen = JSON.stringify({ schemaVersion: 1, events: [{ id: 'k', name: 'K', venueLabel: 'RCMH', days: [] }] });
    expect(parseProposals(kitchen)).toEqual({ ok: false, error: 'That looks like a kitchen menu backup, not a proposal — use Import… for those.' });
    expect(parseProposals('nope').ok).toBe(false);
    expect(parseProposals('{"foo":1}').ok).toBe(false);
  });
  it('reads proposals saved in this browser and survives broken storage', () => {
    const store = { getItem: () => JSON.stringify({ schemaVersion: 1, events: [proposal] }) };
    expect(readBrowserProposals(store).map((p) => p.id)).toEqual(['p1']);
    expect(readBrowserProposals({ getItem: () => '{broken' })).toEqual([]);
    expect(readBrowserProposals({ getItem: () => { throw new Error('blocked'); } })).toEqual([]);
    expect(readBrowserProposals(null)).toEqual([]);
  });
});

describe('kitchenDayLabel', () => {
  it('turns a date line into the weekday', () => {
    expect(kitchenDayLabel('Tuesday, November 10')).toBe('TUESDAY');
    expect(kitchenDayLabel('Sat Nov 14')).toBe('SATURDAY');
    expect(kitchenDayLabel('11.10.2026')).toBe('11.10.2026');
    expect(kitchenDayLabel('')).toBe('');
  });
});

describe('proposalToKitchen', () => {
  const ev = proposalToKitchen(proposal as unknown as Proposal, catalog, 2026);
  const [bf, lunch, overnight] = ev.days[0].meals;

  it('fills the event header like a new kitchen menu', () => {
    expect(ev).toMatchObject({ name: 'ENHYPEN World Tour', venueLabel: 'RCMH', fileName: 'ENHYPEN World Tour Kitchen Menu 2026.docx' });
    expect(ev.days[0].label).toBe('TUESDAY');
    expect(ev.id).not.toBe('p1');
  });
  it('drops descriptions and leaves quantities, units, time and headcount blank', () => {
    expect(bf).toMatchObject({ type: 'Breakfast', time: '', headcount: null, headerNote: '' });
    for (const l of bf.lines as DishLine[]) {
      expect(l).toMatchObject({ qty: '', unit: '', note: '' });
      expect(l).not.toHaveProperty('description');
    }
  });
  it('keeps dish names and valid tags, and links dishes the kitchen catalog knows', () => {
    const lines = bf.lines as DishLine[];
    expect(lines.map((l) => l.dishName)).toEqual(['Organic Scrambled Eggs', 'Tofu Scramble', 'blueberry pancakes']);
    expect(lines.map((l) => l.tags)).toEqual([['GF'], ['Vegan', 'GF'], []]);
    expect(lines.map((l) => l.sourceDishId)).toEqual(['organic-scrambled-eggs', undefined, 'blueberry-pancakes']);
    expect(lines[1].alternatives).toEqual(['french-toast']);
  });
  it('turns Salad World into the kitchen salad bar and keeps plain lines and empty slots', () => {
    expect(lunch.lines.map((l) => l.kind)).toEqual(['salad', 'text', 'dish']);
    expect(lunch.lines[0]).toMatchObject({ kind: 'salad', items: ['Cherry Tomatoes', 'Corn'] });
    expect(lunch.lines[2]).toMatchObject({ slot: 'Dessert', dishName: '' });
    expect(lunch.templateId).toBe('lunch-italian');
    expect(bf.templateId).toBeUndefined(); // not a kitchen template id
  });
  it('puts a non-standard page heading on the red header line', () => {
    expect(overnight).toMatchObject({ type: 'Custom', headerNote: 'OVERNIGHT MEAL', lines: [] });
  });
  it('keeps an unknown venue as typed', () => {
    expect(proposalToKitchen({ ...(proposal as unknown as Proposal), venue: 'UBS Arena' }, catalog).venueLabel).toBe('UBS Arena');
  });
});
