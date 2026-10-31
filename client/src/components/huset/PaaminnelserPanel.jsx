import { useMemo, useState } from 'react';
import { Bell, BellOff, Plus, Send, Trash2, Pause, Play, Pencil, Repeat } from 'lucide-react';
import { chip, field, primaryButton, iconButton, dayLabel, time, RECURRENCE_LABEL, WEEKDAY_LABEL, scheduleLabel, taskReminderLabel, addDays } from './shared.js';

/**
 * Påminnelser: faste SMS-påminnelser (hver dag, hver uke på valgt ukedag, hver måned på valgt dag,
 * eller én gang på en dato) til én eller flere beboere, pluss oversikt over gjøremålene som har
 * SMS-påminnelse. Sendes fra iPhonen på klokkeslettet; serveren holder styr på hva som er sendt.
 */
const EMPTY = { tekst: '', mottakere: [], gjentakelse: 'ukentlig', ukedag: 1, dag: 1, dato: '', klokkeslett: '08:00' };
const smallButton = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-nx-line/60 text-nx-mute hover:text-nx-text hover:border-nx-cyan/40 disabled:opacity-40';
const STATUS = { sendt: 'text-nx-green', delvis: 'text-nx-amber', feilet: 'text-nx-amber', sender: 'text-nx-mute' };

export function PaaminnelserPanel({ h, me, setMe, standalone, owner }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, dato: addDays(h.today, 1) }));
  const [editId, setEditId] = useState(null);
  const [notice, setNotice] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleRecipient = n => set('mottakere', form.mottakere.includes(n) ? form.mottakere.filter(x => x !== n) : [...form.mottakere, n]);

  const sorted = useMemo(() => [...h.paaminnelser].sort((a, b) => (a.aktiv === b.aktiv ? 0 : a.aktiv ? -1 : 1) || (a.neste || '9').localeCompare(b.neste || '9') || a.klokkeslett.localeCompare(b.klokkeslett)), [h.paaminnelser]);
  const taskReminders = useMemo(() => h.tasks.filter(t => t.status === 'aktiv' && t.paaminnelse).map(t => ({ ...t, dag: addDays(t.frist, -t.paaminnelse.dagerFor) })).sort((a, b) => a.dag.localeCompare(b.dag)), [h.tasks]);
  const noPhone = h.residents.filter(n => !h.smsMottakere.includes(n));
  const missing = form.mottakere.filter(n => !h.smsMottakere.includes(n));

  const payload = () => ({ tekst: form.tekst, mottakere: form.mottakere, gjentakelse: form.gjentakelse, klokkeslett: form.klokkeslett, av: me,
    ukedag: form.gjentakelse === 'ukentlig' ? Number(form.ukedag) : undefined, dag: form.gjentakelse === 'maanedlig' ? Number(form.dag) : undefined, dato: form.gjentakelse === 'en-gang' ? form.dato : undefined });
  async function submit(e) {
    e.preventDefault(); setNotice('');
    const d = editId ? await h.send(`/huset/paaminnelser/${encodeURIComponent(editId)}`, 'PATCH', { ...payload(), aktiv: true }) : await h.send('/huset/paaminnelser', 'POST', payload());
    if (d) { setForm(f => ({ ...EMPTY, dato: addDays(h.today, 1), klokkeslett: f.klokkeslett, mottakere: f.mottakere })); setEditId(null); setNotice(editId ? 'Påminnelsen er endret.' : 'Påminnelsen er lagt inn.'); }
  }
  const edit = r => { setEditId(r.id); setForm({ tekst: r.tekst, mottakere: r.mottakere, gjentakelse: r.gjentakelse, ukedag: r.ukedag || 1, dag: r.dag || 1, dato: r.dato || addDays(h.today, 1), klokkeslett: r.klokkeslett }); window.scrollTo?.({ top: 0, behavior: 'smooth' }); };
  const toggle = r => h.send(`/huset/paaminnelser/${encodeURIComponent(r.id)}`, 'PATCH', { aktiv: !r.aktiv });
  const remove = r => { if (window.confirm(`Slette påminnelsen «${r.tekst}»?`)) h.send(`/huset/paaminnelser/${encodeURIComponent(r.id)}`, 'DELETE'); };
  const sendNow = async r => {
    if (!window.confirm(`Sende «${r.tekst}» på SMS til ${r.mottakere.join(', ')} nå?`)) return;
    const d = await h.send(`/huset/paaminnelser/${encodeURIComponent(r.id)}/send`, 'POST');
    if (d) setNotice((d.sendt || []).map(s => `${s.navn}: ${s.status}${s.feil ? ` (${s.feil})` : ''}`).join(' · '));
  };
  const nextLabel = r => r.neste ? `${r.neste === h.today ? 'i dag' : r.neste === addDays(h.today, 1) ? 'i morgen' : dayLabel(r.neste)} kl. ${r.klokkeslett.replace(':', '.')}` : 'ikke planlagt';

  return (
    <div className="grid grid-cols-12 gap-3 lg:gap-4">
      <form onSubmit={submit} className={`col-span-12 panel space-y-4 self-start ${standalone ? 'p-4' : 'lg:col-span-5 p-5'}`}>
        <h2 className="panel-title">{editId ? 'Endre påminnelse' : 'Ny SMS-påminnelse'}</h2>
        <label className="block"><span className="text-xs text-nx-mute">Hva skal det minnes om?</span>
          <textarea value={form.tekst} onChange={e => set('tekst', e.target.value)} maxLength={500} rows={2} required placeholder="F.eks. sett ut søppeldunkene" className={`${field} w-full mt-1`} /></label>
        <fieldset><legend className="text-xs text-nx-mute mb-2">Hvem skal få SMS-en?</legend>
          <div className="flex flex-wrap gap-2">{h.residents.map(n => <button key={n} type="button" className={`${chip(form.mottakere.includes(n))}${h.smsKanal && !h.smsMottakere.includes(n) ? ' opacity-60' : ''}`} aria-pressed={form.mottakere.includes(n)} title={h.smsKanal && !h.smsMottakere.includes(n) ? 'Mangler mobilnummer' : undefined} onClick={() => toggleRecipient(n)}>{n}</button>)}</div>
          {!!missing.length && <p className="text-xs text-nx-amber mt-2">{missing.join(', ')} har ikke mobilnummer registrert (Beboere), så SMS-en kan ikke sendes dit ennå.</p>}
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-nx-mute">Hvor ofte</span>
            <select value={form.gjentakelse} onChange={e => set('gjentakelse', e.target.value)} className={`${field} w-full mt-1`}>{h.reminderRecurrence.map(r => <option key={r} value={r}>{RECURRENCE_LABEL[r] || r}</option>)}</select></label>
          {form.gjentakelse === 'ukentlig' && <label className="block"><span className="text-xs text-nx-mute">Ukedag</span>
            <select value={form.ukedag} onChange={e => set('ukedag', Number(e.target.value))} className={`${field} w-full mt-1`}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{WEEKDAY_LABEL[d]}</option>)}</select></label>}
          {form.gjentakelse === 'maanedlig' && <label className="block"><span className="text-xs text-nx-mute">Dag i måneden</span>
            <input type="number" min={1} max={31} value={form.dag} onChange={e => set('dag', e.target.value)} required className={`${field} w-full mt-1`} /></label>}
          {form.gjentakelse === 'en-gang' && <label className="block"><span className="text-xs text-nx-mute">Dato</span>
            <input type="date" min={h.today} value={form.dato} onChange={e => set('dato', e.target.value)} required className={`${field} w-full mt-1`} /></label>}
          <label className="block"><span className="text-xs text-nx-mute">Klokkeslett (norsk tid)</span>
            <input type="time" value={form.klokkeslett} onChange={e => set('klokkeslett', e.target.value)} required className={`${field} w-full mt-1`} /></label>
          {!editId && <label className="block"><span className="text-xs text-nx-mute">Lagt inn av</span>
            <select value={me} onChange={e => setMe(e.target.value)} required className={`${field} w-full mt-1`}><option value="">Velg …</option>{h.residents.map(n => <option key={n}>{n}</option>)}</select></label>}
        </div>
        {form.gjentakelse === 'maanedlig' && Number(form.dag) > 28 && <p className="text-xs text-nx-mute">I måneder med færre dager sendes den på månedens siste dag.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={h.busy || !form.tekst.trim() || !form.mottakere.length || (!editId && !me)} className={primaryButton}><Plus size={14} aria-hidden="true" />{editId ? 'Lagre endringer' : 'Legg til påminnelse'}</button>
          {editId && <button type="button" className={smallButton} onClick={() => { setEditId(null); setForm({ ...EMPTY, dato: addDays(h.today, 1) }); }}>Avbryt</button>}
        </div>
        {!h.smsKanal && <p className="text-xs text-nx-amber">SMS fra iPhonen er ikke satt opp på serveren, så påminnelsene blir liggende uten å gå ut.</p>}
        {notice && <p role="status" className="text-xs text-nx-cyan">{notice}</p>}
      </form>

      <section className={`col-span-12 panel ${standalone ? 'p-4' : 'lg:col-span-7 p-5'}`}>
        <h2 className="panel-title">Faste påminnelser · {sorted.filter(r => r.aktiv).length} aktive</h2>
        {h.loaded && !sorted.length && <p className="text-sm text-nx-mute mt-3">Ingen påminnelser ennå. Legg inn den første, f.eks. «sett ut søppeldunkene» hver tirsdag kl. 20.</p>}
        <ul className="mt-3 divide-y divide-nx-line/40">
          {sorted.map(r => (
            <li key={r.id} className={`py-3 flex gap-3 items-start ${r.aktiv ? '' : 'opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm break-words flex items-start gap-1.5">{r.aktiv ? <Bell size={14} aria-hidden="true" className="text-nx-cyan mt-0.5 shrink-0" /> : <BellOff size={14} aria-hidden="true" className="mt-0.5 shrink-0" />}<strong>{r.tekst}</strong></p>
                <p className="text-xs text-nx-mute mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1"><Repeat size={12} aria-hidden="true" />{scheduleLabel(r)}</span>
                  <span>· til {r.mottakere.join(', ')}</span>
                  <span>· {r.aktiv ? `neste ${nextLabel(r)}` : 'satt på pause'}</span>
                </p>
                {r.siste && <p className={`text-xs mt-0.5 ${STATUS[r.siste.status] || 'text-nx-mute'}`}>Sist {r.siste.status} {time(r.siste.at)}{r.siste.feil ? ` · ${r.siste.feil}` : ''}</p>}
                <p className="text-xs text-nx-mute mt-0.5">Lagt inn av {r.av}</p>
              </div>
              <button type="button" disabled={h.busy} onClick={() => edit(r)} className={iconButton} title="Endre" aria-label={`Endre ${r.tekst}`}><Pencil size={16} /></button>
              <button type="button" disabled={h.busy} onClick={() => toggle(r)} className={iconButton} title={r.aktiv ? 'Sett på pause' : 'Slå på igjen'} aria-label={r.aktiv ? `Sett ${r.tekst} på pause` : `Slå på ${r.tekst}`}>{r.aktiv ? <Pause size={16} /> : <Play size={16} />}</button>
              <button type="button" disabled={h.busy} onClick={() => sendNow(r)} className={iconButton} title="Send nå" aria-label={`Send ${r.tekst} nå`}><Send size={16} /></button>
              <button type="button" disabled={h.busy} onClick={() => remove(r)} className={`${iconButton} hover:text-nx-amber`} title="Slett" aria-label={`Slett ${r.tekst}`}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>

        <h2 className="panel-title mt-6">Gjøremål med SMS-påminnelse · {taskReminders.length}</h2>
        <p className="text-xs text-nx-mute mt-1">Dag og klokkeslett velges på hvert gjøremål under Gjøremål. Purring går hver dag mens gjøremålet er forfalt, hvis det er valgt.</p>
        {h.loaded && !taskReminders.length && <p className="text-sm text-nx-mute mt-3">Ingen gjøremål har påminnelse ennå.</p>}
        <ul className="mt-2 divide-y divide-nx-line/40">
          {taskReminders.map(t => <li key={t.id} className="py-2">
            <p className="text-sm break-words"><strong>{t.tittel}</strong> <span className="text-nx-mute">· {t.ansvarlig}</span></p>
            <p className="text-xs text-nx-mute mt-0.5">Frist {dayLabel(t.frist)}{t.gjentakelse !== 'ingen' ? ` (${RECURRENCE_LABEL[t.gjentakelse]?.toLowerCase()})` : ''} · påminnelse {taskReminderLabel(t.paaminnelse)}{t.dag < h.today ? '' : ` · neste ${t.dag === h.today ? 'i dag' : dayLabel(t.dag)}`}{t.sistePaaminnelse ? ` · sist ${t.sistePaaminnelse.status} ${time(t.sistePaaminnelse.at)}` : ''}</p>
          </li>)}
        </ul>

        <div className="mt-6 rounded-xl border border-nx-line/60 p-3 text-xs text-nx-mute space-y-1">
          <p>SMS-ene sendes fra iPhonen ({h.smsKanal ? 'satt opp' : 'ikke satt opp på serveren'}) på klokkeslettet, én om gangen. Kommer serveren opp etter nedetid, sendes dagens påminnelser med en gang.</p>
          <p>Kan få SMS: {h.smsMottakere.length ? h.smsMottakere.join(', ') : 'ingen ennå'}.{!!noPhone.length && <> Mangler mobilnummer: {noPhone.join(', ')}{owner ? ' – legg inn under Beboere.' : ' – Ole Andre legger det inn under Beboere.'}</>}</p>
          {owner && <p>Den daglige oppsummeringen (forfalte og dagens gjøremål) styres under Beboere, og utsendingsloggen for alle SMS-ene ligger der.</p>}
        </div>
      </section>
    </div>
  );
}
