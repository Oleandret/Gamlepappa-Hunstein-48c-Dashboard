import { useMemo, useState } from 'react';
import { Check, Trash2, Plus, Repeat, Bell, BellOff, Send } from 'lucide-react';
import { chip, field, primaryButton, iconButton, dayLabel, addDays, RECURRENCE_LABEL, taskReminderLabel, time } from './shared.js';

const DEFAULT_REMINDER = { sms: true, dagerFor: 0, klokkeslett: '08:00', purring: false };
const daysLabel = n => n === 0 ? 'Fristdagen' : n === 1 ? 'Dagen før' : `${n} dager før`;
const smallButton = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-nx-line/60 text-nx-mute hover:text-nx-text hover:border-nx-cyan/40 disabled:opacity-40';

/** Valg for SMS-påminnelse om et gjøremål: hvilken dag (0–N dager før fristen), klokkeslett og purring. */
export function ReminderFields({ value, onChange, maxDaysBefore = 14, ansvarlig, h, compact = false }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return <div className="rounded-xl border border-nx-line/60 p-3 space-y-2">
    <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={value.sms} onChange={e => set('sms', e.target.checked)} /><Bell size={14} aria-hidden="true" className="text-nx-cyan" />SMS-påminnelse til {ansvarlig || 'den ansvarlige'}</label>
    {value.sms && <>
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2'}`}>
        <label className="block"><span className="text-xs text-nx-mute">Hvilken dag</span>
          <select value={value.dagerFor} onChange={e => set('dagerFor', Number(e.target.value))} className={`${field} w-full mt-1`}>{Array.from({ length: maxDaysBefore + 1 }, (_, n) => <option key={n} value={n}>{daysLabel(n)}</option>)}</select></label>
        <label className="block"><span className="text-xs text-nx-mute">Klokkeslett</span>
          <input type="time" value={value.klokkeslett} onChange={e => set('klokkeslett', e.target.value)} required className={`${field} w-full mt-1`} /></label>
      </div>
      <label className="text-xs text-nx-mute flex items-center gap-2"><input type="checkbox" checked={value.purring} onChange={e => set('purring', e.target.checked)} />Purr hver dag på samme klokkeslett til det er gjort, hvis fristen går ut</label>
      {h && !h.smsKanal && <p className="text-xs text-nx-amber">SMS fra iPhonen er ikke satt opp på serveren ennå.</p>}
      {h && h.smsKanal && ansvarlig && !h.smsMottakere.includes(ansvarlig) && <p className="text-xs text-nx-amber">{ansvarlig} har ikke mobilnummer registrert (Beboere), så påminnelsen kan ikke sendes før det er lagt inn.</p>}
    </>}
  </div>;
}
export const toTaskReminder = v => v?.sms ? { dagerFor: v.dagerFor, klokkeslett: v.klokkeslett, purring: v.purring } : null;
export const fromTaskReminder = p => p ? { sms: true, dagerFor: p.dagerFor, klokkeslett: p.klokkeslett, purring: p.purring === true } : { ...DEFAULT_REMINDER, sms: false };

// Gjøremål per beboer: én gang eller gjentakende. Fullført markeres av den som gjorde det,
// og gjentakende gjøremål får automatisk ny frist. SMS-påminnelse går på valgt dag før fristen.
export function GjoremalPanel({ h, me, setMe, standalone }) {
  const [filter, setFilter] = useState(() => me || '');
  const [visFerdige, setVisFerdige] = useState(false);
  const [form, setForm] = useState({ tittel: '', ansvarlig: '', gjentakelse: 'ukentlig', frist: h.today, kategori: 'Annet', notat: '' });
  const [reminder, setReminder] = useState(DEFAULT_REMINDER);
  const [editing, setEditing] = useState(null); // { id, value } – påminnelse som redigeres i lista
  const [notice, setNotice] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const active = h.tasks.filter(t => t.status === 'aktiv');
  const load = useMemo(() => h.residents.map(name => ({ name, count: active.filter(t => t.ansvarlig === name).length, overdue: active.filter(t => t.ansvarlig === name && t.frist < h.today).length })), [h.residents, active, h.today]);
  const mine = h.tasks.filter(t => !filter || t.ansvarlig === filter);
  const week = addDays(h.today, 7);
  const groups = [
    ['Forfalt', mine.filter(t => t.status === 'aktiv' && t.frist < h.today)],
    ['I dag', mine.filter(t => t.status === 'aktiv' && t.frist === h.today)],
    ['Neste 7 dager', mine.filter(t => t.status === 'aktiv' && t.frist > h.today && t.frist <= week)],
    ['Senere', mine.filter(t => t.status === 'aktiv' && t.frist > week)],
    ...(visFerdige ? [['Ferdig', mine.filter(t => t.status === 'ferdig')]] : [])
  ].map(([title, list]) => [title, [...list].sort((a, b) => a.frist.localeCompare(b.frist))]);

  async function submit(e) {
    e.preventDefault();
    const d = await h.send('/huset/gjoremal', 'POST', { ...form, av: me, paaminnelse: toTaskReminder(reminder) });
    if (d) setForm(f => ({ ...f, tittel: '', notat: '' }));
  }
  const saveReminder = async () => { const d = await h.send(`/huset/gjoremal/${encodeURIComponent(editing.id)}`, 'PATCH', { paaminnelse: toTaskReminder(editing.value) }); if (d) setEditing(null); };
  const remindNow = async t => {
    if (!window.confirm(`Sende SMS-påminnelse om «${t.tittel}» til ${t.ansvarlig} nå?`)) return;
    const d = await h.send(`/huset/gjoremal/${encodeURIComponent(t.id)}/paaminn`, 'POST');
    if (d) setNotice((d.sendt || []).map(s => `${s.navn}: ${s.status}${s.feil ? ` (${s.feil})` : ''}`).join(' · '));
  };
  const complete = t => h.send(`/huset/gjoremal/${encodeURIComponent(t.id)}/fullfor`, 'POST', { av: me || t.ansvarlig });
  const reassign = (t, ansvarlig) => h.send(`/huset/gjoremal/${encodeURIComponent(t.id)}`, 'PATCH', { ansvarlig });
  const remove = t => { if (window.confirm(`Slette gjøremålet «${t.tittel}»?`)) h.send(`/huset/gjoremal/${encodeURIComponent(t.id)}`, 'DELETE'); };

  return (
    <div className="grid grid-cols-12 gap-3 lg:gap-4">
      <section className={`col-span-12 panel ${standalone ? 'p-4' : 'lg:col-span-7 p-5'} ${standalone ? 'order-1' : ''}`}>
        <h2 className="panel-title">Fordeling · aktive gjøremål per beboer</h2>
        {notice && <p role="status" className="text-xs text-nx-cyan mt-2">{notice}</p>}
        <div className="flex flex-wrap gap-2 mt-3" aria-label="Filtrer på beboer">
          <button type="button" className={chip(!filter)} aria-pressed={!filter} onClick={() => setFilter('')}>Alle</button>
          {load.map(p => <button key={p.name} type="button" className={chip(filter === p.name)} aria-pressed={filter === p.name} onClick={() => setFilter(p.name)}>
            {p.name} <strong className="ml-1">{p.count}</strong>{p.overdue > 0 && <span className="ml-1 text-nx-amber">· {p.overdue} forfalt</span>}
          </button>)}
        </div>
        <label className="text-xs text-nx-mute flex items-center gap-2 mt-3"><input type="checkbox" checked={visFerdige} onChange={e => setVisFerdige(e.target.checked)} />Vis ferdige engangsgjøremål</label>
        {h.loaded && groups.every(([, l]) => !l.length) && <p className="text-sm text-nx-mute mt-4">{filter ? `${filter} har ingen gjøremål.` : 'Ingen gjøremål ennå. Legg inn det første.'}</p>}
        {groups.filter(([, l]) => l.length).map(([title, list]) => (
          <div key={title} className="mt-4">
            <h3 className={`text-xs uppercase tracking-[0.14em] ${title === 'Forfalt' ? 'text-nx-amber' : 'text-nx-mute'}`}>{title} · {list.length}</h3>
            <ul className="mt-1 divide-y divide-nx-line/40">
              {list.map(t => (
                <li key={t.id} className={`py-3 flex gap-3 items-start ${t.status === 'ferdig' ? 'opacity-60' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm break-words"><strong>{t.tittel}</strong></p>
                    <p className="text-xs text-nx-mute mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <select aria-label={`Ansvarlig for ${t.tittel}`} value={t.ansvarlig} disabled={h.busy} onChange={e => reassign(t, e.target.value)} className="bg-transparent border border-nx-line/60 rounded-md px-1 py-0.5 text-xs text-nx-text">
                        {h.residents.map(n => <option key={n}>{n}</option>)}
                      </select>
                      <span>· {t.status === 'ferdig' ? 'Ferdig' : `Frist ${dayLabel(t.frist)}`}</span>
                      {t.gjentakelse !== 'ingen' && <span className="inline-flex items-center gap-1"><Repeat size={12} aria-hidden="true" />{RECURRENCE_LABEL[t.gjentakelse]}</span>}
                      <span>· {t.kategori}</span>
                    </p>
                    {t.notat && <p className="text-xs text-nx-mute mt-1 break-words">{t.notat}</p>}
                    {t.fullfort?.[0] && <p className="text-xs text-nx-mute mt-1">Sist gjort av {t.fullfort[0].av}, {dayLabel(t.fullfort[0].dato)}</p>}
                    {t.status === 'aktiv' && editing?.id !== t.id && <p className="text-xs text-nx-mute mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex items-center gap-1">{t.paaminnelse ? <Bell size={12} aria-hidden="true" className="text-nx-cyan" /> : <BellOff size={12} aria-hidden="true" />}SMS-påminnelse {taskReminderLabel(t.paaminnelse)}</span>
                      {t.sistePaaminnelse && <span className={t.sistePaaminnelse.status === 'sendt' ? 'text-nx-green' : 'text-nx-amber'} title={t.sistePaaminnelse.feil || undefined}>· sist {t.sistePaaminnelse.status} {time(t.sistePaaminnelse.at)}</span>}
                      <button type="button" className="underline" disabled={h.busy} onClick={() => setEditing({ id: t.id, value: fromTaskReminder(t.paaminnelse) })}>Endre</button>
                      <button type="button" className="underline inline-flex items-center gap-1" disabled={h.busy} onClick={() => remindNow(t)}><Send size={11} aria-hidden="true" />Send nå</button>
                    </p>}
                    {editing?.id === t.id && <div className="mt-2 space-y-2">
                      <ReminderFields value={editing.value} onChange={v => setEditing({ id: t.id, value: v })} maxDaysBefore={h.maxDaysBefore} ansvarlig={t.ansvarlig} h={h} compact />
                      <div className="flex gap-2"><button type="button" className={smallButton} disabled={h.busy} onClick={saveReminder}>Lagre påminnelse</button><button type="button" className={smallButton} onClick={() => setEditing(null)}>Avbryt</button></div>
                    </div>}
                  </div>
                  {t.status === 'aktiv' && <button type="button" disabled={h.busy} onClick={() => complete(t)} className={iconButton} title="Merk som gjort" aria-label={`Merk ${t.tittel} som gjort`}><Check size={18} /></button>}
                  <button type="button" disabled={h.busy} onClick={() => remove(t)} className={`${iconButton} hover:text-nx-amber`} title="Slett" aria-label={`Slett ${t.tittel}`}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <form onSubmit={submit} className={`col-span-12 panel space-y-4 self-start ${standalone ? 'p-4 order-2' : 'lg:col-span-5 p-5'}`}>
        <h2 className="panel-title">Nytt gjøremål</h2>
        <label className="block"><span className="text-xs text-nx-mute">Hva skal gjøres?</span>
          <input value={form.tittel} onChange={e => set('tittel', e.target.value)} maxLength={200} required placeholder="F.eks. ta ut søpla" className={`${field} w-full mt-1`} /></label>
        <fieldset><legend className="text-xs text-nx-mute mb-2">Hvem har ansvaret?</legend>
          <div className="flex flex-wrap gap-2">{h.residents.map(n => <button key={n} type="button" className={chip(form.ansvarlig === n)} aria-pressed={form.ansvarlig === n} onClick={() => set('ansvarlig', n)}>{n}</button>)}</div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-nx-mute">Gjentakelse</span>
            <select value={form.gjentakelse} onChange={e => set('gjentakelse', e.target.value)} className={`${field} w-full mt-1`}>{h.recurrence.map(r => <option key={r} value={r}>{RECURRENCE_LABEL[r] || r}</option>)}</select></label>
          <label className="block"><span className="text-xs text-nx-mute">{form.gjentakelse === 'ingen' ? 'Frist' : 'Første gang'}</span>
            <input type="date" value={form.frist} onChange={e => set('frist', e.target.value)} required className={`${field} w-full mt-1`} /></label>
          <label className="block"><span className="text-xs text-nx-mute">Kategori</span>
            <select value={form.kategori} onChange={e => set('kategori', e.target.value)} className={`${field} w-full mt-1`}>{h.categories.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="block"><span className="text-xs text-nx-mute">Lagt inn av</span>
            <select value={me} onChange={e => setMe(e.target.value)} required className={`${field} w-full mt-1`}><option value="">Velg …</option>{h.residents.map(n => <option key={n}>{n}</option>)}</select></label>
        </div>
        <label className="block"><span className="text-xs text-nx-mute">Notat (valgfritt)</span>
          <input value={form.notat} onChange={e => set('notat', e.target.value)} maxLength={500} className={`${field} w-full mt-1`} /></label>
        <ReminderFields value={reminder} onChange={setReminder} maxDaysBefore={h.maxDaysBefore} ansvarlig={form.ansvarlig} h={h} />
        <button type="submit" disabled={h.busy || !form.tittel.trim() || !form.ansvarlig || !me} className={primaryButton}><Plus size={14} aria-hidden="true" />Legg til gjøremål</button>
      </form>
    </div>
  );
}
