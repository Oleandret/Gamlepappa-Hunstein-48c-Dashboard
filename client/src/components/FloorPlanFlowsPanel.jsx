import { useMemo, useState } from 'react';
import { Workflow, Play, Plus, Trash2, ArrowUp, ArrowDown, Search, X, ChevronDown } from 'lucide-react';

/**
 * Fast panel til høyre for floor plan canvas. Viser flows brukeren har
 * pinnet til den aktuelle plantegninga, klikkbare for å kjøre dem direkte.
 * I edit-mode kan flows legges til/fjernes/sorteres.
 */
export function FloorPlanFlowsPanel({ planId, planLabel, flows, planFlows, onRun, editing }) {
  const ids = planFlows.getFlows(planId);

  const flowList = useMemo(() => Object.values(flows || {}), [flows]);

  const pinnedFlows = useMemo(() => {
    return ids.map(id => flowList.find(f => f.id === id))
              .filter(Boolean);
  }, [ids, flowList]);

  const totalCount = pinnedFlows.length;

  return (
    <aside
      className="shrink-0 w-60 border border-nx-line/50 rounded-xl bg-nx-panel/40 backdrop-blur-sm p-2.5 flex flex-col gap-2"
      aria-label={`Hurtig-flows for ${planLabel}`}
      style={{ alignSelf: 'flex-start' }}
    >
      <header className="flex items-center gap-1.5 pb-1.5 border-b border-nx-line/40">
        <Workflow size={13} className="text-nx-cyan shrink-0" aria-hidden="true" />
        <p className="panel-title flex-1">Hurtig-flows</p>
        <span className="font-mono text-[10px] text-nx-mute tabular-nums">{totalCount}</span>
      </header>

      {pinnedFlows.length === 0 ? (
        <p className="text-[11px] text-nx-mute italic px-1 py-2">
          {editing
            ? 'Ingen flows lagt til. Bruk dropdown-en under for å legge til flows som hører til denne plantegninga.'
            : 'Ingen flows. Klikk "Rediger pins" for å legge til.'}
        </p>
      ) : (
        <ul className="space-y-1 max-h-[480px] overflow-y-auto pr-0.5">
          {pinnedFlows.map((f, i) => (
            <li key={f.id}>
              <FlowRow
                flow={f}
                editing={editing}
                onRun={() => onRun(f.id)}
                onMoveUp={() => planFlows.reorderFlow(planId, i, i - 1)}
                onMoveDown={() => planFlows.reorderFlow(planId, i, i + 1)}
                onRemove={() => planFlows.removeFlow(planId, f.id)}
                canMoveUp={i > 0}
                canMoveDown={i < pinnedFlows.length - 1}
              />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AddFlowDropdown
          flows={flowList}
          existingIds={ids}
          onAdd={(id) => planFlows.addFlow(planId, id)}
        />
      )}
    </aside>
  );
}

function FlowRow({ flow, editing, onRun, onMoveUp, onMoveDown, onRemove, canMoveUp, canMoveDown }) {
  const enabled = flow.enabled !== false;
  return (
    <div
      className={[
        'group flex items-center gap-1.5 rounded-lg border bg-nx-panel/40 px-1.5 py-1.5 transition-colors',
        enabled ? 'border-nx-line/40 hover:border-nx-cyan/45' : 'border-nx-line/30 opacity-60'
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onRun}
        disabled={!enabled}
        title={`Kjør "${flow.name}"`}
        className={[
          'grid h-6 w-6 place-items-center rounded-md shrink-0 transition-colors',
          enabled ? 'bg-nx-cyan/10 text-nx-cyan hover:bg-nx-cyan/25' : 'text-nx-mute opacity-30 cursor-not-allowed'
        ].join(' ')}
      >
        <Play size={11} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onRun}
        disabled={!enabled}
        className="text-left flex-1 min-w-0 disabled:cursor-not-allowed"
      >
        <div className="text-[11px] leading-tight truncate" title={flow.name}>{flow.name}</div>
        {flow.folder && (
          <div className="text-[9px] text-nx-mute font-mono truncate">{flow.folder}</div>
        )}
      </button>
      {editing && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Flytt opp"
            className="p-0.5 rounded text-nx-mute hover:text-nx-cyan disabled:opacity-30"
          >
            <ArrowUp size={10} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Flytt ned"
            className="p-0.5 rounded text-nx-mute hover:text-nx-cyan disabled:opacity-30"
          >
            <ArrowDown size={10} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Fjern fra denne plantegninga"
            className="p-0.5 rounded text-nx-mute hover:text-nx-red"
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

function AddFlowDropdown({ flows, existingIds, onAdd }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const available = useMemo(() => {
    const ids = new Set(existingIds);
    const q = query.trim().toLowerCase();
    return flows
      .filter(f => f.enabled !== false && !ids.has(f.id))
      .filter(f => !q || (f.name || '').toLowerCase().includes(q) || (f.folder || '').toLowerCase().includes(q))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [flows, existingIds, query]);

  return (
    <div className="border-t border-nx-line/40 pt-2 relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full inline-flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono uppercase tracking-[0.16em] bg-nx-cyan/10 text-nx-cyan hover:bg-nx-cyan/20 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Plus size={11} /> Legg til flow
        </span>
        <ChevronDown size={11} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-nx-cyan/45 bg-nx-bg/95 backdrop-blur-md shadow-glow-soft overflow-hidden">
          <div className="relative border-b border-nx-line/40">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-nx-mute" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk flows..."
              autoFocus
              className="w-full bg-transparent border-none pl-7 pr-7 py-1.5 text-[11px] text-nx-text placeholder:text-nx-mute focus:outline-none font-mono"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Tøm søk" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-nx-mute hover:text-nx-cyan">
                <X size={10} />
              </button>
            )}
          </div>
          <ul className="max-h-[280px] overflow-y-auto">
            {available.length === 0 && (
              <li className="px-2 py-3 text-[10px] text-nx-mute italic text-center">
                {query ? 'Ingen treff' : 'Alle aktive flows er allerede lagt til'}
              </li>
            )}
            {available.map(f => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(f.id);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-nx-cyan/10 border-b border-nx-line/20 last:border-b-0"
                >
                  <div className="text-[11px] truncate">{f.name}</div>
                  {f.folder && <div className="text-[9px] text-nx-mute font-mono truncate">{f.folder}</div>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
