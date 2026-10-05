import { useRef, useState } from 'react';
import { createEvent } from '../model/event';
import { defaultFileName } from '../model/format';
import { newId } from '../model/ids';
import type { Catalog, CatalogOverrides, ExportFile, MenuEvent } from '../model/types';
import { buildExport, findConflicts, mergeImport, parseImport, type ConflictChoice } from '../storage/exportImport';
import { ConfirmButton } from './common';
import { saveBlob } from './useAppState';

interface Props {
  events: MenuEvent[];
  overrides: CatalogOverrides;
  catalog: Catalog;
  onOpen: (id: string) => void;
  setEvents: (fn: (e: MenuEvent[]) => MenuEvent[]) => void;
  setOverrides: (o: CatalogOverrides) => void;
  onExported: () => void;
}

export function EventList({ events, overrides, catalog, onOpen, setEvents, setOverrides, onExported }: Props) {
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [pending, setPending] = useState<{ file: ExportFile; conflicts: MenuEvent[]; withCatalog: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = () => {
    const n = name.trim() || 'Untitled event';
    const v = catalog.venues.find((x) => x.name === venue || x.printLabel === venue);
    const ev = createEvent(n, v ? v.printLabel : venue.trim(), defaultFileName(n, new Date().getFullYear()));
    setEvents((all) => [ev, ...all]);
    onOpen(ev.id);
  };

  const exportAll = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const json = JSON.stringify(buildExport(events, overrides), null, 2);
    saveBlob(new Blob([json], { type: 'application/json' }), `menu-generator-backup-${stamp}.json`);
    onExported();
  };

  const finishImport = (file: ExportFile, choice: ConflictChoice, withCatalog: boolean) => {
    setEvents((all) => mergeImport(all, file.events, choice));
    if (withCatalog && file.catalogOverrides) setOverrides(file.catalogOverrides);
    setImportMsg(`Imported ${file.events.length} event${file.events.length === 1 ? '' : 's'}${withCatalog && file.catalogOverrides ? ' and catalog edits' : ''}.`);
    setPending(null);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const res = parseImport(await f.text());
    if (fileRef.current) fileRef.current.value = '';
    if (!res.ok) return setImportMsg(`Import failed: ${res.error} Nothing was changed.`);
    const conflicts = findConflicts(events, res.file.events);
    const withCatalog = !!res.file.catalogOverrides;
    if (conflicts.length || withCatalog) setPending({ file: res.file, conflicts, withCatalog });
    else finishImport(res.file, 'keepBoth', false);
  };

  const sorted = [...events].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="list-page">
      <section className="card new-event">
        <h2>New event</h2>
        <form onSubmit={(e) => { e.preventDefault(); create(); }}>
          <label className="field grow">
            <span>Event name</span>
            <input value={name} placeholder="e.g. Artist Name – Radio City" onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Venue</span>
            <input value={venue} list="dl-venue-names" placeholder="Radio City Music Hall" onChange={(e) => setVenue(e.target.value)} />
            <datalist id="dl-venue-names">{catalog.venues.map((v) => <option key={v.id} value={v.name}>{v.printLabel}</option>)}</datalist>
          </label>
          <button type="submit" className="primary">Create</button>
        </form>
      </section>

      <section className="card">
        <div className="list-head">
          <h2>Events</h2>
          <div className="list-tools">
            <button type="button" onClick={exportAll} disabled={events.length === 0}>Export backup</button>
            <button type="button" onClick={() => fileRef.current?.click()}>Import…</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </div>

        {importMsg && <p className="notice">{importMsg}</p>}
        {pending && (
          <div className="notice">
            {pending.conflicts.length > 0 && (
              <p>{pending.conflicts.length} event{pending.conflicts.length > 1 ? 's' : ''} in this file already exist here ({pending.conflicts.map((c) => c.name).join(', ')}).</p>
            )}
            {pending.file.catalogOverrides && (
              <label className="check">
                <input type="checkbox" checked={pending.withCatalog} onChange={(e) => setPending({ ...pending, withCatalog: e.target.checked })} />
                Also replace my catalog edits with the ones in this file
              </label>
            )}
            <div className="row">
              {pending.conflicts.length > 0 ? (
                <>
                  <button type="button" onClick={() => finishImport(pending.file, 'replace', pending.withCatalog)}>Replace existing</button>
                  <button type="button" onClick={() => finishImport(pending.file, 'keepBoth', pending.withCatalog)}>Keep both</button>
                </>
              ) : (
                <button type="button" onClick={() => finishImport(pending.file, 'keepBoth', pending.withCatalog)}>Import</button>
              )}
              <button type="button" className="ghost" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <p className="empty">No events yet. Create one above.</p>
        ) : (
          <ul className="event-list">
            {sorted.map((ev) => {
              const meals = ev.days.reduce((n, d) => n + d.meals.length, 0);
              return (
                <li key={ev.id}>
                  <button type="button" className="event-open" onClick={() => onOpen(ev.id)}>
                    <strong>{ev.name}</strong>
                    <span>{ev.venueLabel || 'No venue'}, {ev.days.length} day{ev.days.length === 1 ? '' : 's'}, {meals} meal{meals === 1 ? '' : 's'}</span>
                    <time>Edited {new Date(ev.updatedAt).toLocaleString()}</time>
                  </button>
                  <div className="row">
                    <button type="button" onClick={() => {
                      const copy: MenuEvent = { ...structuredClone(ev), id: newId(), name: `${ev.name} (copy)`, updatedAt: new Date().toISOString() };
                      setEvents((all) => [copy, ...all]);
                    }}>Duplicate</button>
                    <ConfirmButton label="Delete" confirmLabel="Delete event?" onConfirm={() => setEvents((all) => all.filter((x) => x.id !== ev.id))} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
