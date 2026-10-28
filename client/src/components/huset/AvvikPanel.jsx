import { useMemo, useState } from 'react';
import { Check, RotateCcw, Trash2, Plus, Lightbulb } from 'lucide-react';
import { chip, field, primaryButton, iconButton, time } from './shared.js';

// Ferdige forslag til forbedring per kategori, så det går raskt å foreslå noe på mobil.
const SUGGESTIONS = {
  'Kjøkken': ['Oppvasken tas samme dag', 'Tørk av benken etter bruk', 'Sett maten i kjøleskapet igjen'],
  'Rydding': ['Rydd etter deg før du går fra rommet', 'Sko og jakker på plass i gangen'],
  'Bad': ['Heng opp håndkleet etter dusjing', 'Skyll vasken etter bruk'],
  'Lys og strøm': ['Skru av lyset når du går ut av rommet', 'Ta ut laderen når den er ferdig'],
  'Dører og vinduer': ['Lukk og lås ytterdøra etter deg', 'Lukk vinduet når varmen står på'],
  'Klesvask': ['Ta ut klesvasken når maskinen er ferdig', 'Skittentøy i kurven, ikke på gulvet'],
  'Støy': ['Stille i huset etter kl. 22', 'Bruk hodetelefoner sent på kvelden'],
  'Annet': []
};

// SMS-varsel til den avviket gjelder (sendt fra iPhonen).
const VARSEL = {
  sender: p => `Sender SMS til ${p} …`,
  sendt: p => `SMS sendt til ${p}`,
  feilet: p => `SMS til ${p} feilet`,
  varsel_av: p => `Ingen SMS: ${p} har SMS-varsel av`,
  mangler_telefon: p => `Ingen SMS: mangler telefonnummer for ${p}`,
  ikke_satt_opp: () => 'Ingen SMS: iPhone-SMS er ikke satt opp'
};

export function AvvikPanel({ h, me, setMe, standalone }) {
  const [person, setPerson] = useState('');
  const [kategori, setKategori] = useState('Annet');
  const [beskrivelse, setBeskrivelse] = useState('');
  const [forslag, setForslag] = useState('');
  const [foreslaRegel, setForeslaRegel] = useState(false);
  const [regelId, setRegelId] = useState('');
  const [filterPerson, setFilterPerson] = useState('');
  const [visLoste, setVisLoste] = useState(false);
  const [notice, setNotice] = useState('');

  const open = h.avvik.filter(a => a.status === 'apen');
  const perPerson = useMemo(() => h.residents.map(name => ({ name, open: open.filter(a => a.person === name).length })), [h.residents, open]);
  const shown = h.avvik.filter(a => (visLoste || a.status === 'apen') && (!filterPerson || a.person === filterPerson));
  const activeRules = h.rules.filter(r => r.status === 'gjeldende');
  const ruleById = Object.fromEntries(h.rules.map(r => [r.id, r]));
  const relatedRules = activeRules.filter(r => r.kategori === kategori);

  async function submit(e) {
    e.preventDefault();
    const d = await h.send('/avvik', 'POST', { person, kategori, beskrivelse, registrertAv: me, forslag, foreslaRegel, regelId: regelId || undefined });
    if (d) {
      setBeskrivelse(''); setPerson(''); setForslag(''); setForeslaRegel(false); setRegelId('');
      setNotice(d.rule ? 'Avviket er registrert, og forslaget ligger under Husregler til godkjenning.' : 'Avviket er registrert.');
    }
  }
  const setStatus = (id, status) => h.send(`/avvik/${encodeURIComponent(id)}`, 'PATCH', { status });
  const remove = a => { if (window.confirm(`Slette avviket «${a.beskrivelse}»?`)) h.send(`/avvik/${encodeURIComponent(a.id)}`, 'DELETE'); };

  return (
    <div className="grid grid-cols-12 gap-3 lg:gap-4">
      <form onSubmit={submit} className={`col-span-12 panel space-y-4 self-start ${standalone ? 'p-4' : 'lg:col-span-5 p-5'}`}>
        <h2 className="panel-title">Nytt avvik</h2>
        <fieldset>
          <legend className="text-xs text-nx-mute mb-2">Hvem gjelder det?</legend>
          <div className="flex flex-wrap gap-2">
            {h.residents.map(name => <button key={name} type="button" className={chip(person === name)} aria-pressed={person === name} onClick={() => setPerson(name)}>{name}</button>)}
          </div>
        </fieldset>
        <label className="block">
          <span className="text-xs text-nx-mute">Hva skjedde?</span>
          <textarea value={beskrivelse} onChange={e => setBeskrivelse(e.target.value)} maxLength={500} rows={3} required placeholder="F.eks. lot lyset stå på i kjelleren hele natta" className={`${field} w-full mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-nx-mute">Kategori</span>
            <select value={kategori} onChange={e => { setKategori(e.target.value); setRegelId(''); }} className={`${field} w-full mt-1`}>
              {h.categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-nx-mute">Registrert av</span>
            <select value={me} onChange={e => setMe(e.target.value)} required className={`${field} w-full mt-1`}>
              <option value="">Velg …</option>
              {h.residents.map(name => <option key={name}>{name}</option>)}
            </select>
          </label>
        </div>
        {!!relatedRules.length && <label className="block">
          <span className="text-xs text-nx-mute">Bryter det en husregel?</span>
          <select value={regelId} onChange={e => setRegelId(e.target.value)} className={`${field} w-full mt-1`}>
            <option value="">Ingen bestemt regel</option>
            {relatedRules.map(r => <option key={r.id} value={r.id}>{r.tekst}</option>)}
          </select>
        </label>}
        <div className="rounded-xl border border-nx-line/60 p-3 space-y-2">
          <p className="text-xs text-nx-mute flex items-center gap-1.5"><Lightbulb size={14} aria-hidden="true" />Forslag til forbedring (valgfritt)</p>
          {!!SUGGESTIONS[kategori]?.length && <div className="flex flex-wrap gap-2">
            {SUGGESTIONS[kategori].map(s => <button key={s} type="button" className={chip(forslag === s)} aria-pressed={forslag === s} onClick={() => setForslag(f => f === s ? '' : s)}>{s}</button>)}
          </div>}
          <textarea value={forslag} onChange={e => setForslag(e.target.value)} maxLength={500} rows={2} placeholder="Hva kan vi gjøre annerledes?" className={`${field} w-full`} />
          <label className="text-xs text-nx-mute flex items-center gap-2"><input type="checkbox" checked={foreslaRegel} disabled={!forslag.trim()} onChange={e => setForeslaRegel(e.target.checked)} />Foreslå som ny husregel</label>
        </div>
        <button type="submit" disabled={h.busy || !person || !me || !beskrivelse.trim()} className={primaryButton}>
          <Plus size={14} aria-hidden="true" />Registrer avvik
        </button>
        {!person && <p className="text-xs text-nx-mute">Velg hvem avviket gjelder.</p>}
        {notice && <p role="status" className="text-xs text-nx-cyan">{notice}</p>}
      </form>

      <section className={`col-span-12 panel ${standalone ? 'p-4' : 'lg:col-span-7 p-5'}`}>
        <div className="flex flex-wrap gap-2 mb-3" aria-label="Åpne avvik per beboer">
          {perPerson.map(p => (
            <button key={p.name} type="button" className={chip(filterPerson === p.name)} aria-pressed={filterPerson === p.name} onClick={() => setFilterPerson(f => f === p.name ? '' : p.name)}>
              {p.name} <strong className="ml-1">{p.open}</strong>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="panel-title">{filterPerson ? `Avvik for ${filterPerson}` : 'Alle avvik'} · {shown.length}</h2>
          <label className="text-xs text-nx-mute flex items-center gap-2"><input type="checkbox" checked={visLoste} onChange={e => setVisLoste(e.target.checked)} />Vis løste</label>
        </div>
        {h.loaded && shown.length === 0 && <p className="text-sm text-nx-mute mt-4">{open.length === 0 ? 'Ingen åpne avvik. Bra jobba, alle sammen!' : 'Ingen avvik her.'}</p>}
        <ul className="mt-3 divide-y divide-nx-line/40">
          {shown.map(a => (
            <li key={a.id} className={`py-3 flex gap-3 items-start ${a.status === 'lost' ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm"><strong>{a.person}</strong> <span className="text-nx-mute">· {a.kategori}</span></p>
                <p className={`text-sm mt-0.5 break-words ${a.status === 'lost' ? 'line-through' : ''}`}>{a.beskrivelse}</p>
                {a.regelId && ruleById[a.regelId] && <p className="text-xs text-nx-mute mt-1">Husregel: {ruleById[a.regelId].tekst}</p>}
                {a.forslag && <p className="text-xs mt-1 text-nx-cyan/90 break-words">Forslag: {a.forslag}</p>}
                <p className="text-xs text-nx-mute mt-1">Registrert av {a.registrertAv}, {time(a.opprettet)}{a.lost ? ` · løst ${time(a.lost)}` : ''}</p>
                {a.varsel && <p className={`text-xs mt-0.5 ${a.varsel.status === 'sendt' ? 'text-nx-green' : a.varsel.status === 'feilet' ? 'text-nx-amber' : 'text-nx-mute'}`} title={a.varsel.feil || undefined}>{VARSEL[a.varsel.status] ? VARSEL[a.varsel.status](a.person) : ''}</p>}
              </div>
              {a.status === 'apen'
                ? <button type="button" disabled={h.busy} onClick={() => setStatus(a.id, 'lost')} className={iconButton} title="Merk som løst" aria-label="Merk som løst"><Check size={16} /></button>
                : <button type="button" disabled={h.busy} onClick={() => setStatus(a.id, 'apen')} className={iconButton} title="Gjenåpne" aria-label="Gjenåpne"><RotateCcw size={16} /></button>}
              <button type="button" disabled={h.busy} onClick={() => remove(a)} className={`${iconButton} hover:text-nx-amber`} title="Slett" aria-label="Slett avvik"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
