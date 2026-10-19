import { useMemo, useState } from 'react';
import { Check, Trash2, Plus } from 'lucide-react';
import { field, primaryButton, iconButton, time } from './shared.js';

// Felles husregler. Forslag (også fra avvik) må godkjennes før de blir gjeldende.
export function HusreglerPanel({ h, me, setMe, standalone }) {
  const [tekst, setTekst] = useState('');
  const [kategori, setKategori] = useState('Annet');
  const [somForslag, setSomForslag] = useState(false);
  const proposals = h.rules.filter(r => r.status === 'forslag');
  const byCategory = useMemo(() => {
    const map = new Map();
    for (const r of h.rules.filter(x => x.status === 'gjeldende')) { if (!map.has(r.kategori)) map.set(r.kategori, []); map.get(r.kategori).push(r); }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'nb'));
  }, [h.rules]);
  const breaches = useMemo(() => { const m = {}; for (const a of h.avvik) if (a.regelId) m[a.regelId] = (m[a.regelId] || 0) + 1; return m; }, [h.avvik]);

  async function submit(e) {
    e.preventDefault();
    const d = await h.send('/huset/regler', 'POST', { tekst, kategori, av: me, status: somForslag ? 'forslag' : 'gjeldende' });
    if (d) setTekst('');
  }
  const approve = r => h.send(`/huset/regler/${encodeURIComponent(r.id)}`, 'PATCH', { status: 'gjeldende' });
  const remove = (r, verb = 'Slette') => { if (window.confirm(`${verb} «${r.tekst}»?`)) h.send(`/huset/regler/${encodeURIComponent(r.id)}`, 'DELETE'); };

  return (
    <div className="grid grid-cols-12 gap-3 lg:gap-4">
      <section className={`col-span-12 panel ${standalone ? 'p-4' : 'lg:col-span-7 p-5'}`}>
        {!!proposals.length && <div className="mb-5">
          <h2 className="panel-title text-nx-amber">Forslag til nye regler · {proposals.length}</h2>
          <ul className="mt-2 divide-y divide-nx-line/40">{proposals.map(r => (
            <li key={r.id} className="py-3 flex gap-3 items-start">
              <div className="flex-1 min-w-0"><p className="text-sm break-words">{r.tekst}</p><p className="text-xs text-nx-mute mt-1">{r.kategori} · foreslått av {r.av}, {time(r.opprettet)}{r.fraAvvik ? ' · fra et avvik' : ''}</p></div>
              <button type="button" disabled={h.busy} onClick={() => approve(r)} className={iconButton} title="Godkjenn som husregel" aria-label={`Godkjenn ${r.tekst}`}><Check size={18} /></button>
              <button type="button" disabled={h.busy} onClick={() => remove(r, 'Avvise forslaget')} className={`${iconButton} hover:text-nx-amber`} title="Avvis" aria-label={`Avvis ${r.tekst}`}><Trash2 size={16} /></button>
            </li>))}</ul>
        </div>}
        <h2 className="panel-title">Husregler · {h.rules.length - proposals.length}</h2>
        {h.loaded && !byCategory.length && <p className="text-sm text-nx-mute mt-3">Ingen husregler ennå. Legg inn den første, eller godkjenn et forslag.</p>}
        {byCategory.map(([cat, list]) => (
          <div key={cat} className="mt-4">
            <h3 className="text-xs uppercase tracking-[0.14em] text-nx-mute">{cat}</h3>
            <ol className="mt-1 divide-y divide-nx-line/40">{list.map(r => (
              <li key={r.id} className="py-2.5 flex gap-3 items-start">
                <p className="flex-1 min-w-0 text-sm break-words">{r.tekst}{breaches[r.id] ? <span className="block text-xs text-nx-mute mt-0.5">Brutt {breaches[r.id]} gang{breaches[r.id] === 1 ? '' : 'er'} ifølge avvik</span> : null}</p>
                <button type="button" disabled={h.busy} onClick={() => remove(r)} className={`${iconButton} hover:text-nx-amber`} title="Slett" aria-label={`Slett ${r.tekst}`}><Trash2 size={16} /></button>
              </li>))}</ol>
          </div>
        ))}
      </section>

      <form onSubmit={submit} className={`col-span-12 panel space-y-4 self-start ${standalone ? 'p-4' : 'lg:col-span-5 p-5'}`}>
        <h2 className="panel-title">Ny husregel</h2>
        <label className="block"><span className="text-xs text-nx-mute">Regel</span>
          <textarea value={tekst} onChange={e => setTekst(e.target.value)} maxLength={500} rows={2} required placeholder="F.eks. Den som lager middag slipper oppvasken" className={`${field} w-full mt-1`} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-nx-mute">Kategori</span>
            <select value={kategori} onChange={e => setKategori(e.target.value)} className={`${field} w-full mt-1`}>{h.categories.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="block"><span className="text-xs text-nx-mute">Lagt inn av</span>
            <select value={me} onChange={e => setMe(e.target.value)} required className={`${field} w-full mt-1`}><option value="">Velg …</option>{h.residents.map(n => <option key={n}>{n}</option>)}</select></label>
        </div>
        <label className="text-xs text-nx-mute flex items-center gap-2"><input type="checkbox" checked={somForslag} onChange={e => setSomForslag(e.target.checked)} />Legg inn som forslag som må godkjennes</label>
        <button type="submit" disabled={h.busy || !tekst.trim() || !me} className={primaryButton}><Plus size={14} aria-hidden="true" />{somForslag ? 'Foreslå regel' : 'Legg til regel'}</button>
      </form>
    </div>
  );
}
