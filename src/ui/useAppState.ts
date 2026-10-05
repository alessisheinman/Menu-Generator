import { useEffect, useMemo, useRef, useState } from 'react';
import type { Catalog, CatalogOverrides, MenuEvent } from '../model/types';
import { SEED_CATALOG, mergeCatalog } from '../storage/catalog';
import { getBrowserStore, loadState, saveState, type PersistedState } from '../storage/persist';

export interface AppState {
  state: PersistedState;
  catalog: Catalog;
  storageAvailable: boolean;
  saveFailed: boolean;
  setEvents: (fn: (events: MenuEvent[]) => MenuEvent[]) => void;
  setOverrides: (fn: (o: CatalogOverrides) => CatalogOverrides) => void;
  markExported: () => void;
}

export function useAppState(): AppState {
  const store = useRef(getBrowserStore());
  const [state, setState] = useState<PersistedState>(() => {
    const loaded = loadState(store.current);
    return loaded.firstUseAt ? loaded : { ...loaded, firstUseAt: new Date().toISOString() };
  });
  const [saveFailed, setSaveFailed] = useState(false);

  // Autosave on every change.
  useEffect(() => {
    if (store.current) setSaveFailed(!saveState(store.current, state));
  }, [state]);

  const catalog = useMemo(() => mergeCatalog(SEED_CATALOG, state.overrides), [state.overrides]);

  return {
    state,
    catalog,
    storageAvailable: store.current !== null,
    saveFailed,
    setEvents: (fn) => setState((s) => ({ ...s, events: fn(s.events) })),
    setOverrides: (fn) => setState((s) => ({ ...s, overrides: fn(s.overrides) })),
    markExported: () => setState((s) => ({ ...s, lastExportAt: new Date().toISOString() })),
  };
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
