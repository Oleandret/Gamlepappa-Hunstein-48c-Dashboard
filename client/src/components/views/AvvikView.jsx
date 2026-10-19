import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Trash2, Plus, HeartHandshake } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';

/**
 * Avvik for bedre livskvalitet: beboerne registrerer ting som gjøres feil i
 * huset (lys som står på, oppvask som blir stående …), så det blir bedre å bo her.
 * Lista ligger på serveren og deles av alle som bruker dashboardet.
 */

const REPORTER_KEY = 'nexora.avvik.registrertAv';
const time = t => new Date(t).toLocaleString('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function call(path = '', options = {}) {
  const r = await apiFetch(`/api/avvik${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const d = await r.json().catch(() => ({}));
  if (r.status === 403) throw new Error('Du har ikke rettighet til å endre avvik');
  if (!r.ok) throw new Error(d.error || 'Noe gikk galt');
  return d;
}

const chip = active => [
  'avvik-chip px-3 py-1.5 rounded-full text-xs border transition-colors',
  active ? 'bg-nx-cyan/15 border-nx-cyan/60 text-nx-cyan' : 'border-nx-line/60 text-nx-mute hover:text-nx-text hover:border-nx-cyan/40'
].join(' ');
const field = 'bg-nx-panel/60 border border-nx-line/70 rounded-xl px-3 py-2 text-sm text-nx-text placeholder:text-nx-mute focus:outline-none focus:border-nx-cyan/60';

export function AvvikView({ standalone = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [person, setPerson] = useState('');
  const [kategori, setKategori] = useState('Annet');
  const [beskrivelse, setBeskrivelse] = useState('');
  const [registrertAv, setRegistrertAv] = useState(() => { try { return localStorage.getItem(REPORTER_KEY) || ''; } catch { return ''; } });
  const [filterPerson, setFilterPerson] = useState('');
  const [visLoste, setVisLoste] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    call('', { signal: c.signal }).then(setData).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => c.abort();
  }, []);

  const items = data?.items || [];
  const residents = data?.residents || [];
  const open = items.filter(a => a.status === 'apen');
  const perPerson = useMemo(() => residents.map(name => ({ name, open: open.filter(a => a.person === name).length })), [residents, open]);
  const shown = items.filter(a => (visLoste || a.status === 'apen') && (!filterPerson || a.person === filterPerson));

  async function run(fn) {
    setBusy(true); setError('');
    try { setData(await fn()); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  }

  async function submit(e) {
    e.preventDefault();
    try { localStorage.setItem(REPORTER_KEY, registrertAv); } catch {}
    const ok = await run(() => call('', { method: 'POST', body: JSON.stringify({ person, kategori, beskrivelse, registrertAv }) }));
    if (ok) { setBeskrivelse(''); setPerson(''); setKategori('Annet'); }
  }
  const setStatus = (id, status) => run(() => call(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }));
  const remove = a => { if (window.confirm(`Slette avviket «${a.beskrivelse}»?`)) run(() => call(`/${encodeURIComponent(a.id)}`, { method: 'DELETE' })); };

  return (
    <div className={standalone ? 'avvik-mobile mx-auto max-w-xl grid grid-cols-12 gap-3 p-3 pb-16' : 'grid grid-cols-12 gap-4'}>
      <section className={`col-span-12 panel ${standalone ? 'p-4 order-2' : 'p-5'}`}>
        <p className="panel-title">{standalone ? 'Åpne avvik per beboer' : 'Hunstein 48c'}</p>
        {!standalone && <>
        <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2"><HeartHandshake size={22} className="text-nx-cyan" aria-hidden="true" />Avvik for bedre livskvalitet</h1>
        {!standalone && <p className="text-xs text-nx-mute mt-1">Mobilside for å registrere avvik: <a className="text-nx-cyan underline" href="/avvik">{window.location.host}/avvik</a></p>}
        <p className="text-sm text-nx-mute mt-1">Registrer små ting som blir gjort feil i huset, så vi sammen kan gjøre det bedre å bo her. Merk avviket som løst når det er ordnet.</p>
        </>}
        <div className={`flex flex-wrap gap-2 ${standalone ? 'mt-3' : 'mt-4'}`} aria-label="Åpne avvik per beboer">
          {perPerson.map(p => (
            <button key={p.name} type="button" className={chip(filterPerson === p.name)} aria-pressed={filterPerson === p.name} onClick={() => setFilterPerson(f => f === p.name ? '' : p.name)}>
              {p.name} <strong className="ml-1">{p.open}</strong>
            </button>
          ))}
        </div>
      </section>

      {standalone && <h1 className="col-span-12 order-first text-lg font-semibold flex items-center gap-2 px-1 pt-1"><HeartHandshake size={20} className="text-nx-cyan" aria-hidden="true" />Avvik for bedre livskvalitet</h1>}
      {error && <p role="alert" className="col-span-12 order-first panel p-3 text-nx-amber">{error}</p>}

      <form onSubmit={submit} className={`col-span-12 panel space-y-4 self-start ${standalone ? 'p-4 order-1' : 'lg:col-span-5 p-5'}`}>
        <h2 className="panel-title">Nytt avvik</h2>
        <fieldset>
          <legend className="text-xs text-nx-mute mb-2">Hvem gjelder det?</legend>
          <div className="flex flex-wrap gap-2">
            {residents.map(name => <button key={name} type="button" className={chip(person === name)} aria-pressed={person === name} onClick={() => setPerson(name)}>{name}</button>)}
          </div>
        </fieldset>
        <label className="block">
          <span className="text-xs text-nx-mute">Hva skjedde?</span>
          <textarea value={beskrivelse} onChange={e => setBeskrivelse(e.target.value)} maxLength={500} rows={3} required placeholder="F.eks. lot lyset stå på i kjelleren hele natta" className={`${field} w-full mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-nx-mute">Kategori</span>
            <select value={kategori} onChange={e => setKategori(e.target.value)} className={`${field} w-full mt-1`}>
              {(data?.categories || []).map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-nx-mute">Registrert av</span>
            <select value={registrertAv} onChange={e => setRegistrertAv(e.target.value)} required className={`${field} w-full mt-1`}>
              <option value="">Velg …</option>
              {residents.map(name => <option key={name}>{name}</option>)}
            </select>
          </label>
        </div>
        <button type="submit" disabled={busy || !person || !registrertAv || !beskrivelse.trim()} className="avvik-submit inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-xs font-mono uppercase tracking-[0.18em] bg-nx-cyan/15 text-nx-cyan disabled:opacity-40">
          <Plus size={14} aria-hidden="true" />Registrer avvik
        </button>
        {!person && <p className="text-xs text-nx-mute">Velg hvem avviket gjelder.</p>}
      </form>

      <section className={`col-span-12 panel ${standalone ? 'p-4 order-3' : 'lg:col-span-7 p-5'}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="panel-title">{filterPerson ? `Avvik for ${filterPerson}` : 'Alle avvik'} · {shown.length}</h2>
          <label className="text-xs text-nx-mute flex items-center gap-2"><input type="checkbox" checked={visLoste} onChange={e => setVisLoste(e.target.checked)} />Vis løste</label>
        </div>
        {!data && !error && <p className="text-sm text-nx-mute mt-4">Laster avvik …</p>}
        {data && shown.length === 0 && <p className="text-sm text-nx-mute mt-4">{open.length === 0 ? 'Ingen åpne avvik. Bra jobba, alle sammen!' : 'Ingen avvik her.'}</p>}
        <ul className="mt-3 divide-y divide-nx-line/40">
          {shown.map(a => (
            <li key={a.id} className={`py-3 flex gap-3 items-start ${a.status === 'lost' ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm"><strong>{a.person}</strong> <span className="text-nx-mute">· {a.kategori}</span></p>
                <p className={`text-sm mt-0.5 break-words ${a.status === 'lost' ? 'line-through' : ''}`}>{a.beskrivelse}</p>
                <p className="text-xs text-nx-mute mt-1">Registrert av {a.registrertAv}, {time(a.opprettet)}{a.lost ? ` · løst ${time(a.lost)}` : ''}</p>
              </div>
              {a.status === 'apen'
                ? <button type="button" disabled={busy} onClick={() => setStatus(a.id, 'lost')} className="p-2 rounded-md text-nx-mute hover:text-nx-cyan" title="Merk som løst" aria-label="Merk som løst"><Check size={16} /></button>
                : <button type="button" disabled={busy} onClick={() => setStatus(a.id, 'apen')} className="p-2 rounded-md text-nx-mute hover:text-nx-cyan" title="Gjenåpne" aria-label="Gjenåpne"><RotateCcw size={16} /></button>}
              <button type="button" disabled={busy} onClick={() => remove(a)} className="p-2 rounded-md text-nx-mute hover:text-nx-amber" title="Slett" aria-label="Slett avvik"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
