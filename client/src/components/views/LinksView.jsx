import { useMemo, useState } from 'react';
import { ExternalLink, Plus, Trash2, Edit2, Check, X, RotateCcw, Globe, Search } from 'lucide-react';

/**
 * Lenker-fane: brukerens favoritt-nettsider, gruppert per kategori.
 * Klikk på et kort åpner lenken i ny fane.
 * Edit-modus aktiveres med blyant-knappen og lar brukeren endre/fjerne/legge til.
 */

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function faviconUrl(url, size = 64) {
  // Bruker Google sin gratis favicon-service. Faller tilbake til Globe-ikon
  // hvis bildet ikke laster.
  const domain = getDomain(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

export function LinksView({ links }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => links.list.filter(l =>
    !q || (l.title || '').toLowerCase().includes(q) || (l.url || '').toLowerCase().includes(q) || (l.category || '').toLowerCase().includes(q)
  ), [links.list, q]);

  // Grupper per kategori
  const groups = useMemo(() => {
    const map = new Map();
    for (const l of filtered) {
      const key = l.category || 'Annet';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(l);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 panel p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="panel-title">Lenker</p>
            <h1 className="text-xl font-semibold mt-1">{links.list.length} sider · {groups.length} kategorier</h1>
            <p className="text-xs text-nx-mute mt-0.5">
              Dine favoritt-nettsider, gruppert per kategori. Klikk for å åpne i ny fane.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-mute" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Søk lenker..."
                className="bg-nx-panel/60 border border-nx-line/70 rounded-xl pl-9 pr-3 py-2 text-sm text-nx-text placeholder:text-nx-mute focus:outline-none focus:border-nx-cyan/60 w-56"
              />
            </div>
            <button
              type="button"
              onClick={() => setEditing(e => !e)}
              aria-pressed={editing}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-mono uppercase tracking-[0.18em] transition-colors',
                editing ? 'bg-nx-cyan/15 text-nx-cyan shadow-glow-soft' : 'border border-nx-line/60 text-nx-mute hover:text-nx-text hover:border-nx-cyan/40'
              ].join(' ')}
            >
              <Edit2 size={12} />
              {editing ? 'Ferdig' : 'Rediger'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => { if (confirm('Tilbakestille lenkene til standard?')) links.resetToDefaults(); }}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute hover:text-nx-cyan"
              >
                <RotateCcw size={11} /> Standard
              </button>
            )}
          </div>
        </div>
      </div>

      {groups.map(([category, items]) => (
        <div key={category} className="col-span-12 panel p-4">
          <p className="panel-title mb-3">{category} ({items.length})</p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {items.map(l => editing
              ? <EditableLinkCard key={l.id} link={l} onUpdate={(patch) => links.update(l.id, patch)} onRemove={() => links.remove(l.id)} />
              : <LinkCard key={l.id} link={l} />
            )}
            {editing && category === groups[groups.length - 1]?.[0] && (
              <AddLinkInline onAdd={links.add} />
            )}
          </ul>
        </div>
      ))}

      {editing && (
        <div className="col-span-12 panel p-4">
          <p className="panel-title mb-3">Legg til ny lenke</p>
          <AddLinkForm onAdd={links.add} />
        </div>
      )}

      {links.list.length === 0 && (
        <div className="col-span-12 panel p-8 text-center">
          <Globe size={42} className="mx-auto text-nx-mute mb-3" />
          <p className="text-sm">Ingen lenker lagret ennå.</p>
          <button
            type="button"
            onClick={links.resetToDefaults}
            className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-[0.18em] bg-nx-cyan/15 text-nx-cyan hover:bg-nx-cyan/25"
          >
            <RotateCcw size={11} /> Last default-lenker
          </button>
        </div>
      )}
    </div>
  );
}

function LinkCard({ link }) {
  const domain = getDomain(link.url);
  return (
    <li>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex flex-col items-center gap-2 rounded-xl border border-nx-line/40 bg-nx-panel/40 p-3 hover:border-nx-cyan/50 hover:bg-nx-cyan/5 transition-colors text-center"
        title={link.url}
      >
        <FaviconImage url={link.url} size={48} />
        <div className="min-w-0 w-full">
          <div className="text-sm leading-tight truncate">{link.title}</div>
          <div className="text-[10px] text-nx-mute font-mono truncate">{domain}</div>
        </div>
        <ExternalLink size={11} className="text-nx-mute opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      </a>
    </li>
  );
}

function EditableLinkCard({ link, onUpdate, onRemove }) {
  return (
    <li className="rounded-xl border border-nx-cyan/30 bg-nx-panel/40 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <FaviconImage url={link.url} size={32} />
        <input
          type="text"
          value={link.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Tittel"
          className="flex-1 min-w-0 bg-nx-panel/60 border border-nx-line/60 rounded px-1.5 py-0.5 text-xs text-nx-text font-mono"
        />
      </div>
      <input
        type="url"
        value={link.url}
        onChange={(e) => onUpdate({ url: e.target.value })}
        placeholder="https://"
        className="bg-nx-panel/60 border border-nx-line/60 rounded px-1.5 py-0.5 text-[10px] text-nx-mute font-mono truncate"
      />
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={link.category}
          onChange={(e) => onUpdate({ category: e.target.value })}
          placeholder="Kategori"
          className="flex-1 min-w-0 bg-nx-panel/60 border border-nx-line/60 rounded px-1.5 py-0.5 text-[10px] text-nx-cyan font-mono"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Fjern lenke"
          className="p-1 rounded hover:bg-nx-red/10 text-nx-mute hover:text-nx-red"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </li>
  );
}

function AddLinkForm({ onAdd }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Annet');

  const valid = /^https?:\/\/.+/i.test(url);

  const handleAdd = () => {
    if (!valid) return;
    onAdd({ url, title: title || getDomain(url), category });
    setUrl(''); setTitle(''); setCategory('Annet');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        className="flex-1 min-w-[220px] bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-text font-mono"
      />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tittel (auto fra URL)"
        className="flex-1 min-w-[160px] bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-text font-mono"
      />
      <input
        type="text"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Kategori"
        className="w-32 bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-cyan font-mono"
      />
      <button
        type="button"
        onClick={handleAdd}
        disabled={!valid}
        className={[
          'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-[0.16em] transition-colors',
          valid ? 'bg-nx-cyan/15 text-nx-cyan hover:bg-nx-cyan/25' : 'text-nx-mute opacity-50 cursor-not-allowed'
        ].join(' ')}
      >
        <Plus size={12} /> Legg til
      </button>
    </div>
  );
}

function AddLinkInline({ onAdd }) {
  // Liten knapp som plasseres på slutten av siste kategori for å gi raskt
  // tilgang til "legg til" uten å måtte scrolle ned
  return null; // Vi har AddLinkForm under i stedet — denne er placeholder
}

function FaviconImage({ url, size = 48 }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div
        className="grid place-items-center rounded-md bg-nx-cyan/10 text-nx-cyan shrink-0"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Globe size={Math.round(size * 0.5)} />
      </div>
    );
  }
  return (
    <img
      src={faviconUrl(url, Math.max(64, size * 2))}
      alt=""
      width={size}
      height={size}
      className="rounded-md bg-nx-bg/60 shrink-0"
      style={{ width: size, height: size }}
      onError={() => setErrored(true)}
      loading="lazy"
    />
  );
}
