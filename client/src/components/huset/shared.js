import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api.js';

// Felles for Trivsel-fanen: avvik, gjøremål, påminnelser, husregler og statistikk deler data og stil.

export const ME_KEY = 'nexora.avvik.registrertAv';
export const time = t => new Date(t).toLocaleString('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const dayLabel = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('nb-NO', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
export const osloDate = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
export const addDays = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const RECURRENCE_LABEL = { ingen: 'Én gang', daglig: 'Hver dag', ukentlig: 'Hver uke', 'annenhver-uke': 'Annenhver uke', maanedlig: 'Hver måned', 'en-gang': 'Én gang' };
/** Standard-SMS ved avvik; samme tekst som serveren bygger (avvikSms i routes/avvik.js), uten lenken serveren legger til sist. */
export const avvikSmsIntro = person => `Hei ${person}, Gamlepappa har registrert ett avvik idag som går på trivsel i huset. Og håper du kan fikse:`;
export const avvikSmsText = ({ person, beskrivelse, forslag, registrertAv }) => [`${avvikSmsIntro(person || 'NAVN')} ${(beskrivelse || '').trim()}`, forslag?.trim() ? `Forslag: ${forslag.trim()}` : '', `Registrert av ${registrertAv || '…'}.`].filter(Boolean).join('\n');
export const WEEKDAY_LABEL = ['', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
export const clockLabel = t => (t || '').replace(':', '.');
/** «hver onsdag kl. 18.00», «den 1. hver måned kl. 09.00», «hver dag kl. 08.00», «tirsdag 5. nov. kl. 09.00». */
export function scheduleLabel(r) {
  const kl = `kl. ${clockLabel(r.klokkeslett)}`;
  if (r.gjentakelse === 'ukentlig') return `hver ${WEEKDAY_LABEL[r.ukedag] || 'uke'} ${kl}`;
  if (r.gjentakelse === 'maanedlig') return `den ${r.dag}. hver måned ${kl}`;
  if (r.gjentakelse === 'en-gang') return `${r.dato ? dayLabel(r.dato) : 'én gang'} ${kl}`;
  return `hver dag ${kl}`;
}
/** Når påminnelsen om et gjøremål går: «på fristdagen kl. 08.00», «dagen før kl. 19.00», «3 dager før kl. 08.00». */
export const taskReminderLabel = p => p ? `${p.dagerFor === 0 ? 'på fristdagen' : p.dagerFor === 1 ? 'dagen før' : `${p.dagerFor} dager før`} kl. ${clockLabel(p.klokkeslett)}${p.purring ? ', purring hver dag når forfalt' : ''}` : 'ingen';

export const chip = active => [
  'avvik-chip px-3 py-1.5 rounded-full text-xs border transition-colors',
  active ? 'bg-nx-cyan/15 border-nx-cyan/60 text-nx-cyan' : 'border-nx-line/60 text-nx-mute hover:text-nx-text hover:border-nx-cyan/40'
].join(' ');
export const field = 'bg-nx-panel/60 border border-nx-line/70 rounded-xl px-3 py-2 text-sm text-nx-text placeholder:text-nx-mute focus:outline-none focus:border-nx-cyan/60';
export const primaryButton = 'avvik-submit inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-xs font-mono uppercase tracking-[0.18em] bg-nx-cyan/15 text-nx-cyan disabled:opacity-40';
export const iconButton = 'p-2 rounded-md text-nx-mute hover:text-nx-cyan disabled:opacity-40';

async function call(path, options = {}) {
  const r = await apiFetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const d = await r.json().catch(() => ({}));
  if (r.status === 403) throw new Error('Du har ikke rettighet til å endre dette');
  if (!r.ok) throw new Error(d.error || 'Noe gikk galt');
  return d;
}

// A logged-in resident is always themselves; others pick who they are (remembered per device).
export function useMe(locked = '') {
  const [me, setMeState] = useState(() => { try { return localStorage.getItem(ME_KEY) || ''; } catch { return ''; } });
  const setMe = useCallback(v => { setMeState(v); try { localStorage.setItem(ME_KEY, v); } catch {} }, []);
  return locked ? [locked, () => {}] : [me, setMe];
}

// Laster avvik og huset-data, og oppdaterer riktig del med svaret fra hver endring.
export function useHuset() {
  const [avvik, setAvvik] = useState(null);
  const [huset, setHuset] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async signal => {
    try {
      const [a, h] = await Promise.all([call('/avvik', { signal }), call('/huset', { signal })]);
      setAvvik(a); setHuset(h); setError('');
    } catch (e) { if (e.name !== 'AbortError') setError(e.message); }
  }, []);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load]);

  const send = useCallback(async (path, method = 'POST', body) => {
    setBusy(true); setError('');
    try {
      const d = await call(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      if (d.items) setAvvik(prev => ({ ...prev, ...d }));
      if (d.rule) setHuset(prev => prev && { ...prev, rules: [d.rule, ...prev.rules] });
      if (d.rules) setHuset(prev => prev && { ...prev, rules: d.rules });
      if (d.tasks) setHuset(prev => prev && { ...prev, tasks: d.tasks });
      if (d.paaminnelser) setHuset(prev => prev && { ...prev, paaminnelser: d.paaminnelser });
      return d;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }, []);

  return {
    loaded: Boolean(avvik && huset), avvik: avvik?.items || [], rules: huset?.rules || [], tasks: huset?.tasks || [],
    residents: avvik?.residents || huset?.residents || [], categories: avvik?.categories || [], recurrence: huset?.recurrence || [],
    paaminnelser: huset?.paaminnelser || [], reminderRecurrence: huset?.reminderRecurrence || ['daglig', 'ukentlig', 'maanedlig', 'en-gang'], maxDaysBefore: huset?.maxDaysBefore ?? 14,
    smsKanal: huset?.smsKanal === true, smsMottakere: huset?.smsMottakere || [],
    today: huset?.today || osloDate(Date.now()), error, setError, busy, send, reload: load
  };
}
