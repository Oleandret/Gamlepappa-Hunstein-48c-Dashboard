import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api.js';

/**
 * Endre innstillinger på varmepumpen, se hvordan den var stilt inn hver dag, og
 * gjenopprett en tidligere dag. Grenser og valg kommer fra varmepumpen selv.
 * Alle endringer bekreftes av eieren og lagres i endringsloggen på serveren.
 */

const day = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const time = t => t ? new Date(t).toLocaleString('nb-NO', { timeZone: 'Europe/Oslo' }) : 'Ukjent';
const label = (s, value = s.value) => s.enumValues?.find(e => String(e.value) === String(value))?.text ?? (value == null ? '—' : `${value}${s.parameterUnit ? ` ${s.parameterUnit}` : ''}`);
const statusText = { bekreftet: 'Bekreftet', uendret: 'Uendret', avvist: 'Avvist', feilet: 'Feilet', 'sendt, ikke bekreftet ennå': 'Sendt, ikke bekreftet ennå' };

async function call(path, options = {}) {
  const r = await apiFetch(`/api/heating${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Forespørselen feilet');
  return body;
}

function Results({ entry }) {
  if (!entry?.results?.length) return entry?.message ? <p role="status">{entry.message}</p> : null;
  return <ul className="heating-results" role="status">{entry.results.map(r => <li key={r.parameterId}><strong>{r.name || r.parameterId}</strong>: {statusText[r.status] || r.status}{r.from !== undefined && r.status !== 'avvist' ? ` (${r.from} → ${r.to})` : ''}{r.reason ? ` · ${r.reason}` : ''}</li>)}</ul>;
}

export function HeatingSettings({ connection, onChanged }) {
  const [owner, setOwner] = useState(false);
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [days, setDays] = useState([]);
  const [date, setDate] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [changes, setChanges] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, h, c] = await Promise.all([call('/settings'), call('/settings/history').catch(() => ({ days: [] })), call('/settings/changes').catch(() => ({ changes: [] }))]);
      setData(s); setDays(h.days || []); setChanges(c.changes || []); setError('');
      setDate(d => d || h.days?.[1] || h.days?.[0] || '');
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load, connection?.connected, connection?.selected]);
  useEffect(() => { const c = new AbortController(); apiFetch('/api/session', { signal: c.signal }).then(r => r.ok ? r.json() : null).then(s => setOwner(s?.method === 'google' && s?.role === 'admin')).catch(() => {}); return () => c.abort(); }, []);
  useEffect(() => {
    if (!date) { setSnapshot(null); return; }
    let alive = true;
    call(`/settings/history/${date}`).then(s => { if (alive) { setSnapshot(s); setPicked(new Set((s.diff || []).filter(d => d.restorable).map(d => d.parameterId))); } }).catch(e => alive && setSnapshot({ error: e.message }));
    return () => { alive = false; };
  }, [date, changes.length]);

  const canWrite = owner && data?.writeGranted;
  const settings = data?.settings || [];
  const pending = Object.entries(drafts).filter(([id, v]) => v !== '' && String(settings.find(s => s.parameterId === id)?.value) !== String(v));

  async function submit(path, body, summary) {
    if (!window.confirm(`${summary}\n\nVarmepumpen endres nå. Fortsette?`)) return;
    setBusy(true); setError(''); setResult(null);
    try { const entry = await call(path, { method: 'POST', body: JSON.stringify(body) }); setResult(entry); setDrafts({}); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const save = () => submit('/settings', { changes: Object.fromEntries(pending) }, pending.map(([id, v]) => { const s = settings.find(x => x.parameterId === id); return `${s.parameterName}: ${label(s)} → ${label(s, v)}`; }).join('\n'));
  const restore = () => {
    const rows = (snapshot?.diff || []).filter(d => picked.has(d.parameterId));
    submit('/settings/restore', { date, parameterIds: [...picked] }, `Gjenopprett ${day(date)}:\n` + rows.map(d => `${d.parameterName}: ${label(d, d.current)} → ${label(d)}`).join('\n'));
  };

  const access = !connection?.configured ? 'myUplink er ikke konfigurert.'
    : !data?.writeApproved ? 'Skrivetilgang er ikke slått på i serveroppsettet (MYUPLINK_WRITE_APPROVED). Innstillingene vises, men kan ikke endres.'
    : !data?.writeGranted ? 'Skrivetilgang er godkjent, men varmepumpen er koblet til med bare lesetilgang. Koble til myUplink på nytt for å gi skrivetilgang.'
    : !owner ? 'Logg inn med eierens Google-konto for å endre innstillinger.'
    : 'Du kan endre innstillingene. Grensene kommer fra varmepumpen, og hver endring kontrolleres med en ny lesing.';

  return <>
    <article className="heating-panel" aria-labelledby="heating-settings-title">
      <h2 id="heating-settings-title">Innstillinger på varmepumpen</h2>
      <p>{access}</p>
      {error && <p role="alert" className="heating-error">{error}</p>}
      <Results entry={result} />
      {!settings.length ? <p className="heating-empty">{data?.status === 'ok' ? 'Varmepumpen oppgir ingen innstillinger som kan endres.' : 'Ingen innstillinger tilgjengelig før varmepumpen kan leses.'}</p> :
        <div className="heating-table"><table><thead><tr><th>Innstilling</th><th>Nå</th><th>Ny verdi</th><th>Tillatt</th></tr></thead><tbody>{settings.map(s => {
          const draft = drafts[s.parameterId] ?? '';
          const set = v => setDrafts(d => ({ ...d, [s.parameterId]: v }));
          return <tr key={s.parameterId}><td>{s.parameterName || 'Uten navn'}<small>ID {s.parameterId}{s.category ? ` · ${s.category}` : ''}</small></td><td>{label(s)}</td>
            <td>{s.enumValues?.length
              ? <select aria-label={`Ny verdi for ${s.parameterName}`} disabled={!canWrite || busy} value={draft} onChange={e => set(e.target.value)}><option value="">Uendret</option>{s.enumValues.map(e => <option key={e.value} value={e.value}>{e.text}</option>)}</select>
              : <input aria-label={`Ny verdi for ${s.parameterName}`} type="number" inputMode="decimal" disabled={!canWrite || busy || s.minValue == null || s.maxValue == null} min={s.minValue ?? undefined} max={s.maxValue ?? undefined} step={s.stepValue || 'any'} placeholder={String(s.value ?? '')} value={draft} onChange={e => set(e.target.value)} />}</td>
            <td>{s.enumValues?.length ? `${s.enumValues.length} valg` : s.minValue != null && s.maxValue != null ? `${s.minValue} til ${s.maxValue}${s.stepValue ? `, steg ${s.stepValue}` : ''}` : 'Ingen grenser oppgitt; endres ikke herfra'}</td></tr>;
        })}</tbody></table></div>}
      <button type="button" disabled={!canWrite || busy || !pending.length} onClick={save}>{busy ? 'Lagrer …' : `Lagre ${pending.length || ''} endring${pending.length === 1 ? '' : 'er'}`}</button>
      {!!pending.length && <button type="button" disabled={busy} onClick={() => setDrafts({})}>Forkast</button>}
    </article>

    <article className="heating-panel" aria-labelledby="heating-history-title">
      <h2 id="heating-history-title">Slik var varmepumpen stilt inn</h2>
      <p>Innstillingene lagres hver dag, og dagens fil oppdateres når noe endres. Velg en dag for å se hva som er annerledes nå, og gjenopprett det du vil ha tilbake.</p>
      {!days.length ? <p className="heating-empty">Ingen dager lagret ennå. Første lagring skjer ved neste lesing av varmepumpen.</p> : <>
        <label className="heating-filters">Dag<select aria-label="Velg dag" value={date} onChange={e => setDate(e.target.value)}>{days.map(d => <option key={d} value={d}>{day(d)}</option>)}</select></label>
        {snapshot?.error && <p role="alert">{snapshot.error}</p>}
        {snapshot?.snapshot && <p>Sist lagret {time(snapshot.snapshot.recordedAt)} · {snapshot.snapshot.settings.length} innstillinger</p>}
        {snapshot?.diff === null && <p>Varmepumpen kan ikke leses nå, så forskjellene kan ikke vises.</p>}
        {snapshot?.diff?.length === 0 && <p>Innstillingene er de samme som denne dagen.</p>}
        {!!snapshot?.diff?.length && <div className="heating-table"><table><thead><tr><th>Gjenopprett</th><th>Innstilling</th><th>Nå</th><th>{day(date)}</th></tr></thead><tbody>{snapshot.diff.map(d => <tr key={d.parameterId}>
          <td><input type="checkbox" aria-label={`Gjenopprett ${d.parameterName}`} disabled={!d.restorable || !canWrite || busy} checked={picked.has(d.parameterId)} onChange={e => setPicked(p => { const n = new Set(p); e.target.checked ? n.add(d.parameterId) : n.delete(d.parameterId); return n; })} /></td>
          <td>{d.parameterName}<small>ID {d.parameterId}{d.reason ? ` · ${d.reason}` : ''}</small></td><td>{label(d, d.current)}</td><td>{label(d)}</td></tr>)}</tbody></table></div>}
        <button type="button" disabled={!canWrite || busy || !picked.size || !snapshot?.diff?.length} onClick={restore}>Gjenopprett valgte ({picked.size})</button>
      </>}
    </article>

    <article className="heating-panel" aria-labelledby="heating-changes-title">
      <h2 id="heating-changes-title">Endringslogg</h2>
      {!changes.length ? <p className="heating-empty">Ingen endringer er gjort fra dashboardet.</p> :
        <ul className="heating-results">{changes.slice(0, 30).map((c, i) => <li key={`${c.at}-${i}`}><strong>{time(c.at)}</strong> · {c.source?.startsWith('gjenoppretting:') ? `Gjenopprettet ${day(c.source.slice(15))}` : 'Manuell endring'}<ul>{c.results.map(r => <li key={r.parameterId}>{r.name || r.parameterId}: {r.from ?? '—'} → {r.to} · {statusText[r.status] || r.status}</li>)}</ul></li>)}</ul>}
    </article>
  </>;
}
