import { useMemo, useState } from 'react';
import { Star, Play, Search, Workflow, X } from 'lucide-react';

/**
 * Egen fane for flow-favoritter.
 *
 * Viser to seksjoner:
 * - Stjernede flows (det brukeren har markert)
 * - Alle andre flows, med stjerne-knapp for å legge til
 *
 * Søk filtrerer begge.
 */
export function FlowFavoritesView({ flows, onRun, flowFavorites }) {
  const [query, setQuery] = useState('');
  const flowList = useMemo(() => Object.values(flows || {}), [flows]);

  const q = query.trim().toLowerCase();
  const filter = (f) => {
    if (!q) return true;
    return (f.name || '').toLowerCase().includes(q)
        || (f.folder || '').toLowerCase().includes(q);
  };

  const favoriteFlows = useMemo(
    () => flowList
      .filter(f => flowFavorites.isFavorite(f.id))
      .filter(filter)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [flowList, flowFavorites, q]
  );

  const otherFlows = useMemo(
    () => flowList
      .filter(f => !flowFavorites.isFavorite(f.id))
      .filter(filter)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [flowList, flowFavorites, q]
  );

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 panel p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="panel-title">Flow-favoritter</p>
            <h1 className="text-xl font-semibold mt-1">{favoriteFlows.length} stjernede flows</h1>
            <p className="text-xs text-nx-mute mt-0.5">
              Klikk stjernen for å legge til/fjerne fra favoritter — lagres lokalt i nettleseren.
            </p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-mute" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk flows..."
              className="bg-nx-panel/60 border border-nx-line/70 rounded-xl pl-9 pr-9 py-2 text-sm text-nx-text placeholder:text-nx-mute focus:outline-none focus:border-nx-cyan/60 w-72"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Tøm søk"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nx-mute hover:text-nx-cyan"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {favoriteFlows.length > 0 && (
        <div className="col-span-12 panel p-4">
          <p className="panel-title mb-3 flex items-center gap-2">
            <Star size={14} className="text-nx-amber" fill="currentColor" />
            Stjernede ({favoriteFlows.length})
          </p>
          <FlowGrid flows={favoriteFlows} onRun={onRun} flowFavorites={flowFavorites} />
        </div>
      )}

      <div className="col-span-12 panel p-4">
        <p className="panel-title mb-3">
          Alle andre flows ({otherFlows.length})
        </p>
        {otherFlows.length === 0 && (
          <p className="text-xs text-nx-mute italic">
            {q ? 'Ingen flows matcher søket.' : 'Alle flows er stjernet!'}
          </p>
        )}
        <FlowGrid flows={otherFlows} onRun={onRun} flowFavorites={flowFavorites} />
      </div>
    </div>
  );
}

function FlowGrid({ flows, onRun, flowFavorites }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
      {flows.map(f => (
        <FlowCard key={f.id} flow={f} onRun={onRun} flowFavorites={flowFavorites} />
      ))}
    </ul>
  );
}

function FlowCard({ flow, onRun, flowFavorites }) {
  const isFav = flowFavorites.isFavorite(flow.id);
  const enabled = flow.enabled !== false;
  return (
    <li
      className={[
        'group flex items-center gap-2 rounded-xl border bg-nx-panel/40 px-2.5 py-2 transition-colors',
        enabled ? 'border-nx-line/50 hover:border-nx-cyan/50' : 'border-nx-line/30 opacity-60'
      ].join(' ')}
    >
      <div className="grid h-8 w-8 place-items-center rounded-md bg-nx-cyan/10 text-nx-cyan shrink-0" aria-hidden="true">
        <Workflow size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-tight truncate" title={flow.name}>{flow.name}</div>
        <div className="text-[11px] text-nx-mute font-mono truncate">
          {flow.folder || 'flow'}
          {!enabled && <span className="ml-1 text-nx-amber">· avskrudd</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => flowFavorites.toggle(flow.id)}
        aria-pressed={isFav}
        aria-label={isFav ? 'Fjern fra favoritter' : 'Legg til favoritt'}
        className={[
          'p-1.5 rounded transition-colors',
          isFav ? 'text-nx-amber hover:text-nx-amber/70' : 'text-nx-mute hover:text-nx-amber opacity-60 group-hover:opacity-100'
        ].join(' ')}
        title={isFav ? 'Fjern stjerne' : 'Legg til favoritt'}
      >
        <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        onClick={() => onRun(flow.id)}
        disabled={!enabled}
        aria-label={`Kjør ${flow.name}`}
        className={[
          'grid h-7 w-7 place-items-center rounded-full transition-colors shrink-0',
          enabled ? 'bg-nx-cyan/10 text-nx-cyan opacity-70 group-hover:opacity-100 hover:bg-nx-cyan/20' : 'text-nx-mute opacity-30 cursor-not-allowed'
        ].join(' ')}
      >
        <Play size={12} aria-hidden="true" />
      </button>
    </li>
  );
}
