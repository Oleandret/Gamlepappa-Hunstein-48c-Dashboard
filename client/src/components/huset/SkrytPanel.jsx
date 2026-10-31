import { useCallback, useEffect, useState } from 'react';
import { Trophy, Sparkles, Trash2, MessageSquare, Save } from 'lucide-react';
import { chip, field, primaryButton, iconButton, time, call } from './shared.js';

/**
 * Skryt: beboerne gir hverandre skryt for trivsel, og hvert skryt gir poeng (1–3). Poengtavlen
 * nullstilles hver måned; den som har flest poeng når måneden er omme, vinner premien eieren har satt.
 * Den som får skryt, får en SMS med skrytet og stillingen (kan tas bort per skryt).
 */
const monthLabel = m => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('nb-NO', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const VARSEL = { sender: p => `Sender SMS til ${p} …`, sendt: p => `SMS sendt til ${p}`, feilet: p => `SMS til ${p} feilet`, valgt_bort: () => 'Ingen SMS (valgt bort)', mangler_telefon: p => `Ingen SMS: mangler mobilnummer for ${p}`, ikke_satt_opp: () => 'Ingen SMS: iPhone-SMS er ikke satt opp' };
const MEDAL = ['🥇', '🥈', '🥉'];

export function SkrytPanel({ h, me, setMe, standalone, owner }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [til, setTil] = useState('');
  const [poeng, setPoeng] = useState(1);
  const [tekst, setTekst] = useState('');
  const [sendSms, setSendSms] = useState(true);
  const [premie, setPremie] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => call('/skryt').then(d => { setData(d); setPremie(d.premie); setError(''); }).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function send(path, method, body) {
    setBusy(true); setError('');
    try { const d = await call(`/skryt${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }); setData(d); return d; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }
  async function submit(e) {
    e.preventDefault();
    const d = await send('', 'POST', { til, fra: me, tekst, poeng, sendSms });
    if (d) { setTekst(''); setTil(''); setPoeng(1); setNotice(`Skryt til ${d.item.til} er registrert.${d.item.varsel?.status === 'sender' ? ' SMS sendes fra iPhonen.' : ''}`); }
  }
  const remove = s => { if (window.confirm(`Angre skrytet til ${s.til}?`)) send(`/${encodeURIComponent(s.id)}`, 'DELETE'); };
  const savePrize = () => send('/premie', 'PUT', { tekst: premie }).then(d => d && setNotice(premie.trim() ? 'Premien er lagret.' : 'Premien er fjernet.'));

  if (!data) return <p className={`panel p-4 text-sm ${error ? 'text-nx-amber' : 'text-nx-mute'}`}>{error || 'Laster …'}</p>;
  const board = data.leaderboard, top = board[0]?.poeng || 0;
  const pad = standalone ? 'p-4' : 'p-5';
  return (
    <div className="grid grid-cols-12 gap-3 lg:gap-4">
      <section className={`col-span-12 panel ${pad} ${standalone ? 'order-1' : 'lg:col-span-7'}`}>
        <h2 className="panel-title flex items-center gap-2"><Trophy size={16} className="text-nx-amber" aria-hidden="true" />Poengtavle · {monthLabel(data.month)}</h2>
        <p className="text-xs text-nx-mute mt-1">{data.premie ? <>Premie til den som har flest poeng når måneden er omme: <strong className="text-nx-text">{data.premie}</strong></> : 'Ingen premie er satt for denne måneden ennå.'}</p>
        {error && <p role="alert" className="text-sm text-nx-amber mt-2">{error}</p>}
        {notice && <p role="status" className="text-xs text-nx-cyan mt-2">{notice}</p>}
        <ol className="mt-3 space-y-1.5">
          {board.map((r, i) => (
            <li key={r.navn} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${r.poeng > 0 && r.poeng === top ? 'border-nx-amber/60 bg-nx-amber/10' : 'border-nx-line/40'}`}>
              <span className="w-7 text-center text-lg" aria-hidden="true">{r.poeng > 0 && i < 3 ? MEDAL[i] : <span className="text-xs text-nx-mute">{i + 1}.</span>}</span>
              <span className="flex-1 min-w-0 text-sm"><strong>{r.navn}</strong><span className="text-xs text-nx-mute"> · {r.antall} skryt fått · {r.gitt} gitt</span></span>
              <div className="flex-1 h-2 rounded-full bg-nx-line/40 overflow-hidden hidden sm:block"><div className="h-full bg-nx-cyan/70" style={{ width: `${top ? Math.round((r.poeng / top) * 100) : 0}%` }} /></div>
              <strong className="w-14 text-right text-nx-cyan">{r.poeng} p</strong>
            </li>
          ))}
        </ol>
        {data.forrige.vinnere && <p className="text-xs text-nx-mute mt-3">Forrige måned ({monthLabel(data.forrige.month)}): {data.forrige.vinnere.length > 1 ? `delt seier mellom ${data.forrige.vinnere.join(' og ')}` : `${data.forrige.vinnere[0]} vant`} med {data.forrige.leaderboard[0].poeng} poeng. 🎉</p>}
        {owner && <div className="mt-4 rounded-xl border border-nx-line/60 p-3 space-y-2">
          <p className="text-xs text-nx-mute">Premie (bare du kan endre den)</p>
          <div className="flex gap-2"><input value={premie} onChange={e => setPremie(e.target.value)} maxLength={200} placeholder="F.eks. velge middag en fredag, eller kinobilletter" className={`${field} flex-1`} /><button type="button" className={primaryButton} disabled={busy || premie === data.premie} onClick={savePrize}><Save size={14} aria-hidden="true" />Lagre</button></div>
        </div>}
        <h3 className="text-xs uppercase tracking-[0.14em] text-nx-mute mt-5">Siste skryt</h3>
        {!data.items.length && <p className="text-sm text-nx-mute mt-2">Ingen skryt ennå. Vær den første!</p>}
        <ul className="mt-1 divide-y divide-nx-line/40">
          {data.items.slice(0, 30).map(s => (
            <li key={s.id} className="py-2.5 flex gap-3 items-start">
              <Sparkles size={16} className="text-nx-amber mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm break-words"><strong>{s.til}</strong> <span className="text-nx-mute">fikk {s.poeng} p fra</span> <strong>{s.fra}</strong>: {s.tekst}</p>
                <p className="text-xs text-nx-mute mt-0.5">{time(s.opprettet)}{s.varsel && VARSEL[s.varsel.status] ? ` · ${VARSEL[s.varsel.status](s.til)}` : ''}</p>
              </div>
              {(owner || s.fra === me) && <button type="button" disabled={busy} onClick={() => remove(s)} className={`${iconButton} hover:text-nx-amber`} title="Angre" aria-label={`Angre skrytet til ${s.til}`}><Trash2 size={16} /></button>}
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={submit} className={`col-span-12 panel space-y-4 self-start ${pad} ${standalone ? 'order-2' : 'lg:col-span-5'}`}>
        <h2 className="panel-title">Gi skryt</h2>
        <fieldset><legend className="text-xs text-nx-mute mb-2">Hvem fortjener skryt?</legend>
          <div className="flex flex-wrap gap-2">{data.residents.filter(n => n !== me).map(n => <button key={n} type="button" className={chip(til === n)} aria-pressed={til === n} onClick={() => setTil(n)}>{n}</button>)}</div>
        </fieldset>
        <label className="block"><span className="text-xs text-nx-mute">Hva gjorde {til || 'personen'} bra?</span>
          <textarea value={tekst} onChange={e => setTekst(e.target.value)} maxLength={300} rows={3} required placeholder="F.eks. ryddet hele kjøkkenet uten å bli spurt" className={`${field} w-full mt-1`} /></label>
        <fieldset><legend className="text-xs text-nx-mute mb-2">Hvor mye skryt?</legend>
          <div className="flex flex-wrap gap-2">{data.points.map(([p, label]) => <button key={p} type="button" className={chip(poeng === p)} aria-pressed={poeng === p} onClick={() => setPoeng(p)}>{'⭐'.repeat(p)} {label} · {p} p</button>)}</div>
        </fieldset>
        <label className="block"><span className="text-xs text-nx-mute">Fra</span>
          <select value={me} onChange={e => setMe(e.target.value)} required className={`${field} w-full mt-1`}><option value="">Velg …</option>{data.residents.map(n => <option key={n}>{n}</option>)}</select></label>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)} /><MessageSquare size={14} aria-hidden="true" className="text-nx-cyan" />Send SMS til {til || 'personen'} med skrytet og stillingen</label>
        {sendSms && h.smsKanal && til && !h.smsMottakere.includes(til) && <p className="text-xs text-nx-amber">{til} har ikke mobilnummer registrert (Beboere), så SMS-en kan ikke sendes.</p>}
        <button type="submit" disabled={busy || !til || !me || !tekst.trim()} className={primaryButton}><Sparkles size={14} aria-hidden="true" />Gi skryt</button>
        {!me && <p className="text-xs text-nx-mute">Velg hvem du er under «Fra».</p>}
      </form>
    </div>
  );
}
