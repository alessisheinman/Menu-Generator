import { useEffect, useState } from 'react';
import { shouldRemindExport } from '../storage/exportImport';
import { CatalogEditor } from './CatalogEditor';
import { DogRails } from './DogRails';
import { EventEditor } from './EventEditor';
import { EventList } from './EventList';
import { useAppState } from './useAppState';

type Route = { view: 'list' } | { view: 'event'; id: string } | { view: 'catalog' };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h.startsWith('event/')) return { view: 'event', id: decodeURIComponent(h.slice(6)) };
  if (h === 'catalog') return { view: 'catalog' };
  return { view: 'list' };
}

export function App() {
  const app = useAppState();
  const [route, setRoute] = useState<Route>(parseHash);
  const [dismissedReminder, setDismissedReminder] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (hash: string) => { window.location.hash = hash; };

  const { events, lastExportAt, firstUseAt } = app.state;
  const remind = !dismissedReminder && shouldRemindExport(new Date(), events.length > 0, lastExportAt, firstUseAt);
  const current = route.view === 'event' ? events.find((e) => e.id === route.id) : undefined;

  return (
    <div className="app">
      <DogRails />
      <header className="topbar">
        <a className="brand" href="#/">Kitchen Menu Generator</a>
        <nav>
          <a href="#/" className={route.view !== 'catalog' ? 'on' : ''}>Events</a>
          <a href="#/catalog" className={route.view === 'catalog' ? 'on' : ''}>Catalog</a>
        </nav>
      </header>

      {!app.storageAvailable && (
        <div className="banner bad">This browser is blocking storage (private window?). Your work won't be saved — use Export backup before closing.</div>
      )}
      {app.saveFailed && <div className="banner bad">Couldn't save to this browser (storage full?). Export a backup now.</div>}
      {remind && (
        <div className="banner">
          It's been a while since your last backup. Events live only in this browser.{' '}
          <a href="#/">Go to Events → Export backup</a>
          <button type="button" className="ghost" onClick={() => setDismissedReminder(true)}>Later</button>
        </div>
      )}

      <main>
        {route.view === 'catalog' && <CatalogEditor catalog={app.catalog} overrides={app.state.overrides} setOverrides={app.setOverrides} />}
        {route.view === 'event' && current && (
          <EventEditor
            event={current}
            catalog={app.catalog}
            onChange={(ev) => app.setEvents((all) => all.map((e) => (e.id === ev.id ? ev : e)))}
            onBack={() => go('/')}
          />
        )}
        {route.view === 'event' && !current && (
          <div className="card"><p>That event doesn't exist in this browser.</p><a href="#/">Back to events</a></div>
        )}
        {route.view === 'list' && (
          <EventList
            events={events}
            overrides={app.state.overrides}
            catalog={app.catalog}
            onOpen={(id) => go(`/event/${encodeURIComponent(id)}`)}
            setEvents={app.setEvents}
            setOverrides={(o) => app.setOverrides(() => o)}
            onExported={app.markExported}
          />
        )}
      </main>
    </div>
  );
}
