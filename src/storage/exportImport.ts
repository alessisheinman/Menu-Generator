import { newId } from '../model/ids';
import type { CatalogOverrides, ExportFile, MenuEvent } from '../model/types';

export const SCHEMA_VERSION = 1;

export function buildExport(events: MenuEvent[], catalogOverrides: CatalogOverrides): ExportFile {
  return { schemaVersion: SCHEMA_VERSION, events, catalogOverrides };
}

export type ParseResult = { ok: true; file: ExportFile } | { ok: false; error: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function looksLikeEvent(x: unknown): x is MenuEvent {
  return isObj(x) && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.days);
}

/** Bring any older file shape up to the current schema. */
export function migrate(raw: unknown): ExportFile {
  if (!isObj(raw)) throw new Error('File is not a menu export.');
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  let data: Record<string, unknown> = { ...raw };
  if (version > SCHEMA_VERSION) throw new Error('This file was made by a newer version of the app.');
  if (version === 0) {
    // v0 (pre-release): no version, meals had no headerNote, events had no fileName.
    const events = Array.isArray(data.events) ? data.events : [];
    data = {
      ...data,
      events: events.map((e) => {
        if (!isObj(e)) return e;
        const days = Array.isArray(e.days) ? e.days : [];
        return {
          fileName: `${String(e.name ?? 'Event')} Kitchen Menu.docx`,
          ...e,
          days: days.map((d) => (isObj(d) && Array.isArray(d.meals)
            ? { ...d, meals: d.meals.map((m) => (isObj(m) ? { headerNote: '', ...m } : m)) }
            : d)),
        };
      }),
    };
    version = 1;
  }
  const events = data.events;
  if (!Array.isArray(events) || !events.every(looksLikeEvent)) throw new Error('File has no valid events.');
  return { schemaVersion: version, events, catalogOverrides: data.catalogOverrides as CatalogOverrides | undefined };
}

export function parseImport(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  try {
    return { ok: true, file: migrate(raw) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function findConflicts(existing: MenuEvent[], incoming: MenuEvent[]): MenuEvent[] {
  const ids = new Set(existing.map((e) => e.id));
  return incoming.filter((e) => ids.has(e.id));
}

export type ConflictChoice = 'replace' | 'keepBoth';

export function mergeImport(existing: MenuEvent[], incoming: MenuEvent[], choice: ConflictChoice): MenuEvent[] {
  const incomingById = new Map(incoming.map((e) => [e.id, e]));
  const existingIds = new Set(existing.map((e) => e.id));
  if (choice === 'replace') {
    const kept = existing.map((e) => incomingById.get(e.id) ?? e);
    return [...kept, ...incoming.filter((e) => !existingIds.has(e.id))];
  }
  const renamed = incoming.map((e) => (existingIds.has(e.id) ? { ...e, id: newId(), name: `${e.name} (imported)` } : e));
  return [...existing, ...renamed];
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPORT_REMINDER_DAYS = 14;

/** Remind when there is data that hasn't been backed up for 14 days. */
export function shouldRemindExport(now: Date, hasEvents: boolean, lastExportAt: string | null, firstUseAt: string | null): boolean {
  if (!hasEvents) return false;
  const since = lastExportAt ?? firstUseAt;
  if (!since) return false;
  return now.getTime() - new Date(since).getTime() >= EXPORT_REMINDER_DAYS * DAY_MS;
}
