import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../model/types';
import { SEED_DISHES, parseSeedEntry } from './dishes';
import { SEED_TEMPLATES, SEED_VENUES } from './templates';

describe('seed catalog', () => {
  it('has unique dish ids', () => {
    const ids = SEED_DISHES.map((d) => d.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('uses only known categories', () => {
    expect(SEED_DISHES.every((d) => CATEGORIES.includes(d.category))).toBe(true);
  });

  it('references only existing dishes from templates', () => {
    const ids = new Set(SEED_DISHES.map((d) => d.id));
    const missing = SEED_TEMPLATES.flatMap((t) =>
      t.lines.flatMap((l) => [l.dishId, ...(l.alternatives ?? [])]).filter((id): id is string => id !== null && !ids.has(id)),
    );
    expect(missing).toEqual([]);
  });

  it('has unique template and venue ids', () => {
    expect(new Set(SEED_TEMPLATES.map((t) => t.id)).size).toBe(SEED_TEMPLATES.length);
    expect(new Set(SEED_VENUES.map((v) => v.id)).size).toBe(SEED_VENUES.length);
  });

  it('parses tag codes and rejects unknown ones', () => {
    expect(parseSeedEntry('Falafel|V,G', 'Vegetarian Main')).toEqual({ id: 'falafel', name: 'Falafel', category: 'Vegetarian Main', tags: ['Vegan', 'GF'] });
    expect(() => parseSeedEntry('X|Q', 'Soup')).toThrow();
  });

  it('slugs the curly-quoted Just Eggs sensibly', () => {
    expect(SEED_DISHES.find((d) => d.name.includes('Just'))?.id).toBe('just-eggs-scrambled');
  });
});
