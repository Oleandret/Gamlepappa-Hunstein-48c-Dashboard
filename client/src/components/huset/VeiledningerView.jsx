import { useMemo, useState } from 'react';
import { BookOpen, Search, ChevronDown, Flame, Wind, Waves, Droplets, Sun, Plug, LayoutGrid, Gauge, FileText } from 'lucide-react';
import { GUIDES, GUIDE_CATEGORIES, searchGuides } from '../../lib/veiledninger.js';
import { chip, field } from './shared.js';

const ICONS = { Flame, Wind, Waves, Droplets, Sun, Plug, LayoutGrid, Gauge };

/**
 * Veiledninger: hvordan huset brukes og holdes ved like, skrevet ut fra
 * FDV-dokumentasjonen og romskjemaet. Brukes både som egen fane i dashboardet,
 * som underfane i Huset (der beboerne også ser den) og på mobilsiden /veiledninger.
 */
export function VeiledningerView({ standalone = false, embedded = false }) {
  const [query, setQuery] = useState('');
  const [kategori, setKategori] = useState('Alle');
  const [open, setOpen] = useState(() => new Set());
  const list = useMemo(() => searchGuides(query, kategori), [query, kategori]);
  const searching = query.trim().length > 0;
  const toggle = id => setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className={standalone && !embedded ? 'mx-auto max-w-xl p-3 pb-16 space-y-3' : 'space-y-4'}>
      {!embedded && (
        <header className={standalone ? 'px-1 pt-1' : 'panel p-5'}>
          <h1 className={`${standalone ? 'text-lg' : 'text-2xl'} font-semibold flex items-center gap-2`}><BookOpen size={standalone ? 20 : 22} className="text-nx-cyan" aria-hidden="true" />Veiledninger</h1>
          <p className="text-sm text-nx-mute mt-1">Slik bruker og steller du huset: varme, ventilasjon, basseng, solskjerming og overflater. Skrevet ut fra FDV-dokumentasjonen; kilden står under hver veiledning.</p>
        </header>
      )}

      <div className={`${standalone ? '' : 'panel p-4'} space-y-3`}>
        <label className="relative block">
          <span className="sr-only">Søk i veiledningene</span>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-mute" aria-hidden="true" />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Søk, f.eks. filter, pH, alarm, gardin …" className={`${field} w-full pl-9`} />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Emne">
          {['Alle', ...GUIDE_CATEGORIES].map(k => (
            <button key={k} type="button" onClick={() => setKategori(k)} aria-pressed={kategori === k} className={`${chip(kategori === k)} shrink-0`}>{k}</button>
          ))}
        </div>
      </div>

      {!list.length && <p className="panel p-4 text-sm text-nx-mute">Fant ingen veiledning for «{query}». Prøv et annet ord, eller velg «Alle».</p>}

      <div className="space-y-3">
        {list.map(g => {
          const Icon = ICONS[g.icon] || BookOpen;
          const expanded = searching || open.has(g.id);
          return (
            <article key={g.id} className="panel overflow-hidden">
              <button type="button" onClick={() => toggle(g.id)} aria-expanded={expanded} className="w-full text-left p-4 flex gap-3 items-start hover:bg-nx-cyan/5">
                <Icon size={20} className="text-nx-cyan shrink-0 mt-0.5" aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold">{g.title}</span>
                  {g.model && <span className="block font-mono text-[11px] text-nx-mute mt-0.5">{g.model}</span>}
                  <span className="block text-sm text-nx-mute mt-1">{g.intro}</span>
                </span>
                <ChevronDown size={18} className={`text-nx-mute shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {expanded && (
                <div className="px-4 pb-4 pl-12 space-y-4">
                  {g.blocks.map(b => (
                    <section key={b.title}>
                      <h3 className={`text-xs uppercase tracking-[0.14em] ${b.tone === 'alert' ? 'text-nx-amber' : 'text-nx-cyan'}`}>{b.title}</h3>
                      <ul className="mt-1.5 space-y-1.5 text-sm list-disc pl-4 marker:text-nx-mute">
                        {b.items.map(it => <li key={it} className="break-words">{it}</li>)}
                      </ul>
                    </section>
                  ))}
                  {g.tables?.map(t => (
                    <section key={t.title}>
                      <h3 className="text-xs uppercase tracking-[0.14em] text-nx-cyan">{t.title}</h3>
                      <div className="mt-1.5 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-xs text-nx-mute">{t.columns.map(c => <th key={c} className="py-1 pr-3 font-normal">{c}</th>)}</tr></thead>
                          <tbody className="divide-y divide-nx-line/40">
                            {t.rows.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`py-1.5 pr-3 align-top ${i === 0 ? 'font-medium whitespace-nowrap' : ''}`}>{c}</td>)}</tr>)}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                  {g.kilder?.length > 0 && (
                    <p className="text-[11px] text-nx-mute flex gap-1.5 items-start"><FileText size={12} className="mt-0.5 shrink-0" aria-hidden="true" />Kilde: {g.kilder.join(' · ')}</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="text-[11px] text-nx-mute px-1">{GUIDES.length} veiledninger. Er noe feil eller mangler? Meld det som et avvik i Huset.</p>
    </div>
  );
}
