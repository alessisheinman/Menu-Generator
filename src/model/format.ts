import { TAGS, type Line, type Meal, type Tag } from './types';

export function formatTags(tags: Tag[]): string {
  const ordered = TAGS.filter((t) => tags.includes(t));
  if (ordered.length === 0) return '';
  if (ordered.length === 1 && ordered[0] === 'GF') return 'GF';
  return `(${ordered.join(', ')})`;
}

const joinParts = (parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(' ');

export function formatLine(line: Line): string {
  switch (line.kind) {
    case 'text':
      return line.text.trim();
    case 'salad':
      return `Salad with${line.size ? ` ${line.size}` : ''}: ${line.items.join(', ')}`;
    case 'dish':
      if (!line.dishName.trim()) return '';
      return joinParts([line.qty, line.unit, line.dishName, formatTags(line.tags), line.note]);
  }
}

/** The body lines that actually get printed (empty slots and blank notes are skipped). */
export function printableLines(meal: Pick<Meal, 'lines'>): string[] {
  return meal.lines.map(formatLine).filter(Boolean);
}

export function formatHeader(dayLabel: string, venueLabel: string, meal: Pick<Meal, 'time' | 'headcount' | 'headerNote'>): string[] {
  const count = meal.headcount != null ? `${meal.headcount} PPL` : '';
  return [dayLabel.trim().toUpperCase(), venueLabel.trim(), joinParts([meal.time, count, meal.headerNote])];
}

export function defaultFileName(eventName: string, year: number): string {
  const clean = eventName.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Event';
  return `${clean} Kitchen Menu ${year}.docx`;
}
