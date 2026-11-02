import { describe, expect, it } from 'vitest';
import { createDay, createEvent } from '../model/event';
import type { Catalog, MenuEvent } from '../model/types';
import { burritoKindsText, deleteDish, emptyOverrides, mergeCatalog, parseBurritoKinds, upsertDish } from './catalog';
import { buildExport, findConflicts, mergeImport, parseImport, shouldRemindExport } from './exportImport';
import { emptyState, loadState, saveState, type KeyValueStore } from './persist';

const seed: Catalog = {
  dishes: [
    { id: 'a', name: 'A', category: 'Soup', tags: [] },
    { id: 'b', name: 'B', category: 'Soup', tags: [] },
  ],
  templates: [],
  venues: [{ id: 'v', name: 'Venue', printLabel: 'V' }],
  saladBar: { standard: ['x'], addOns: [] },
  omelette: { standard: ['ham'], addOns: [] },
  burritoKinds: [{ code: 'B/E/C', name: 'Bacon, Egg & Cheese' }],
};

describe('burrito kinds text', () => {
  it('reads one "CODE = Name" per line, uppercasing codes and skipping blanks and repeats', () => {
    expect(parseBurritoKinds('EGG/CH = Egg & Cheese\n\n b/e/c=Bacon, Egg & Cheese \nVEG\nveg = again')).toEqual([
      { code: 'EGG/CH', name: 'Egg & Cheese' },
      { code: 'B/E/C', name: 'Bacon, Egg & Cheese' },
      { code: 'VEG', name: 'VEG' },
    ]);
  });
  it('writes them back the same way', () => {
    expect(burritoKindsText([{ code: 'S/E/C', name: 'Sausage, Egg & Cheese' }])).toBe('S/E/C = Sausage, Egg & Cheese');
  });
});

describe('mergeCatalog', () => {
  it('applies edits, additions and deletions over the seed', () => {
    let o = emptyOverrides();
    o = upsertDish(o, { id: 'a', name: 'A renamed', category: 'Soup', tags: ['GF'] });
    o = upsertDish(o, { id: 'c', name: 'C', category: 'Fish', tags: [] });
    o = deleteDish(o, 'b');
    expect(mergeCatalog(seed, o).dishes.map((d) => d.name)).toEqual(['A renamed', 'C']);
  });
  it('keeps user edits when the seed gains new dishes', () => {
    const o = upsertDish(emptyOverrides(), { id: 'a', name: 'Mine', category: 'Soup', tags: [] });
    const newSeed = { ...seed, dishes: [...seed.dishes, { id: 'z', name: 'Z', category: 'Soup' as const, tags: [] }] };
    expect(mergeCatalog(newSeed, o).dishes.map((d) => d.name)).toEqual(['Mine', 'B', 'Z']);
  });
  it('re-adding a deleted dish un-deletes it', () => {
    let o = deleteDish(emptyOverrides(), 'a');
    o = upsertDish(o, { id: 'a', name: 'Back', category: 'Soup', tags: [] });
    expect(mergeCatalog(seed, o).dishes.map((d) => d.name)).toContain('Back');
  });
  it('uses edited omelette fillings and burrito kinds, else the seed ones', () => {
    expect(mergeCatalog(seed, emptyOverrides())).toMatchObject({ omelette: seed.omelette, burritoKinds: seed.burritoKinds });
    const mine = { omelette: { standard: ['spinach'], addOns: [] }, burritoKinds: [{ code: 'VEG', name: 'Veggie' }] };
    expect(mergeCatalog(seed, { ...emptyOverrides(), ...mine })).toMatchObject(mine);
  });
});

const ev = (name: string): MenuEvent => ({ ...createEvent(name, 'RCMH', `${name}.docx`), days: [createDay('Tuesday')] });

describe('export / import', () => {
  it('round-trips events and overrides', () => {
    const events = [ev('One')];
    const o = upsertDish(emptyOverrides(), { id: 'c', name: 'C', category: 'Fish', tags: [] });
    const res = parseImport(JSON.stringify(buildExport(events, o)));
    expect(res.ok && res.file.events).toEqual(events);
    expect(res.ok && res.file.catalogOverrides).toEqual(o);
  });
  it('migrates a version-0 file (no schemaVersion, no headerNote/fileName)', () => {
    const v0 = { events: [{ id: '1', name: 'Old', venueLabel: 'RCMH', updatedAt: '', days: [{ id: 'd', label: 'Mon', meals: [{ id: 'm', type: 'Custom', time: '', headcount: null, lines: [] }] }] }] };
    const res = parseImport(JSON.stringify(v0));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.file.schemaVersion).toBe(1);
      expect(res.file.events[0].fileName).toBe('Old Kitchen Menu.docx');
      expect(res.file.events[0].days[0].meals[0].headerNote).toBe('');
    }
  });
  it('rejects garbage without throwing', () => {
    expect(parseImport('not json')).toEqual({ ok: false, error: 'That file is not valid JSON.' });
    expect(parseImport('{"schemaVersion":1,"events":[{"nope":1}]}').ok).toBe(false);
    expect(parseImport('{"schemaVersion":99,"events":[]}').ok).toBe(false);
  });
  it('detects conflicts and resolves them', () => {
    const one = ev('One');
    const two = ev('Two');
    const incomingOne = { ...one, name: 'One v2' };
    expect(findConflicts([one, two], [incomingOne])).toEqual([incomingOne]);
    expect(mergeImport([one, two], [incomingOne], 'replace').map((e) => e.name)).toEqual(['One v2', 'Two']);
    const both = mergeImport([one, two], [incomingOne], 'keepBoth');
    expect(both.map((e) => e.name)).toEqual(['One', 'Two', 'One v2 (imported)']);
    expect(both[2].id).not.toBe(one.id);
  });
});

describe('shouldRemindExport', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  it('reminds after 14 days without export', () => {
    expect(shouldRemindExport(now, true, '2026-10-01T00:00:00Z', null)).toBe(true);
    expect(shouldRemindExport(now, true, '2026-10-10T00:00:00Z', null)).toBe(false);
  });
  it('falls back to first use, and never reminds with no events', () => {
    expect(shouldRemindExport(now, true, null, '2026-09-01T00:00:00Z')).toBe(true);
    expect(shouldRemindExport(now, false, null, '2026-09-01T00:00:00Z')).toBe(false);
  });
});

class MemStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('persist', () => {
  it('saves and loads state', () => {
    const store = new MemStore();
    const state = { ...emptyState(), events: [ev('One')], firstUseAt: '2026-10-05T00:00:00Z' };
    expect(saveState(store, state)).toBe(true);
    expect(loadState(store)).toEqual(state);
  });
  it('returns empty state when storage is unavailable', () => {
    expect(loadState(null)).toEqual(emptyState());
    expect(saveState(null, emptyState())).toBe(false);
  });
  it('sets corrupt data aside instead of losing it', () => {
    const store = new MemStore();
    store.setItem('menu-generator:v1', '{broken');
    expect(loadState(store)).toEqual(emptyState());
    expect([...store.data.keys()].some((k) => k.includes(':corrupt:'))).toBe(true);
  });
  it('reports a failed write (e.g. quota exceeded)', () => {
    const store = new MemStore();
    store.setItem = () => { throw new Error('QuotaExceeded'); };
    expect(saveState(store, emptyState())).toBe(false);
  });
});
