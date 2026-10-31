import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api.js';
import { osloDate } from '../lib/savingsModel.js';
import { buildActionPlan } from '../lib/actionPlan.js';
import { useHomePresence, presencePeople } from '../lib/useHomePresence.js';
import { useNetworkDevices } from '../lib/useNetworkDevices.js';
import { motionLocation } from '../lib/motionLocation.js';

const ICON = { away: '🏠', standby: '🔌', price: '⏱', heat: '🌡', insight: '⚡' };
const nb = (n, d = 2) => n.toLocaleString('nb-NO', { maximumFractionDigits: d });

/** Hvem er hjemme, fra enhetene valgt for «Hjemme» i topplinja. */
function usePresence() {
  const { devices: selected } = useHomePresence();
  const any = Object.keys(selected).length > 0;
  const net = useNetworkDevices(any);
  return useMemo(() => {
    if (!any || !net.connected) return { known: false, configured: any };
    const people = presencePeople(selected, net.devices);
    return { known: true, configured: true, anyoneHome: people.some(p => p.home), people };
  }, [any, net, selected]);
}

function useTodayPrices() {
  const [prices, setPrices] = useState([]);
  useEffect(() => {
    const c = new AbortController();
    apiFetch(`/api/prices?date=${osloDate()}`, { signal: c.signal })
      .then(r => r.ok ? r.json() : null).then(d => setPrices(d?.available ? d.record.intervals : [])).catch(() => {});
    return () => c.abort();
  }, []);
  return prices;
}

/** Enheter som hører til valgt anlegg etter Homey-sonene; enheter under det andre anlegget utelates. */
function siteFilter(rows, devices, zones, siteId) {
  const other = siteId === 'halsaneset' ? /^Hunstein/ : /^Halsaneset/;
  return rows.filter(r => !other.test(motionLocation({ zone: devices[r.id]?.zone }, zones).site));
}

export function ActionPlan({ rows, devices, zones = {}, siteId = 'hunstein' }) {
  const presence = usePresence(), prices = useTodayPrices();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const actions = useMemo(() => buildActionPlan({ rows: siteFilter(rows, devices, zones, siteId), devices, presence, prices, now }), [rows, devices, zones, siteId, presence, prices, now]);
  const [copied, setCopied] = useState(null);
  const copy = (a) => { navigator.clipboard?.writeText(a.flow).then(() => { setCopied(a.id); setTimeout(() => setCopied(null), 2000); }).catch(() => {}); };

  return (
    <section className="saving-card action-plan" aria-labelledby="action-plan-title">
      <div className="saving-section-head">
        <div><h2 id="action-plan-title">Tiltaksplan</h2><p>Forslag beregnet fra det som skjer i huset akkurat nå. Ingenting slås av herfra.</p></div>
        <span className={`presence-pill ${!presence.known ? 'unknown' : presence.anyoneHome ? 'home' : 'away'}`}>
          {!presence.known ? (presence.configured ? 'Hjemme: ukjent' : 'Hjemme: ikke satt opp') : presence.anyoneHome
            ? `Hjemme: ${presence.people.filter(p => p.home).map(p => p.state === 'recent' ? `${p.person} (nylig)` : p.person).join(', ')}` : 'Ingen er hjemme'}
        </span>
      </div>
      {!presence.configured && <p className="saving-notice">Velg familiens mobiler under <strong>3D-hus → Nettverk → «Vis i Hjemme»</strong>, så kan planen foreslå hva som kan slås av når ingen er hjemme.</p>}
      {!actions.length && <p className="saving-empty">Ingen tiltak å foreslå akkurat nå. Planen trenger ferske effektmålinger, termostater eller dagens strømpriser.</p>}
      <ol className="action-list">
        {actions.map((a, i) => (
          <li key={a.id} className={`action-item ${a.urgent ? 'urgent' : ''}`}>
            <div className="action-head">
              <span className="action-no" aria-hidden="true">{ICON[a.kind] || i + 1}</span>
              <div className="action-text"><h3>{a.title}</h3><p>{a.why}</p></div>
              <div className="action-value">
                {a.krPerHour != null && <><strong>{nb(a.krPerHour)} kr</strong><span>per time · {nb(a.kwhPerHour, 3)} kWh</span></>}
                {a.krPerDay != null && <><strong>{nb(a.krPerDay)} kr</strong><span>per døgn · {nb(a.kwhPerDay)} kWh</span></>}
                {a.krPerHour == null && a.krPerDay == null && a.kwhPerHour != null && <><strong>{nb(a.kwhPerHour, 3)} kWh</strong><span>per time</span></>}
                {a.krPerDay == null && a.kwhPerDay != null && a.krPerHour == null && <><strong>{nb(a.kwhPerDay)} kWh</strong><span>per døgn</span></>}
                {a.krPerKwh != null && <><strong>−{nb(a.krPerKwh)} kr</strong><span>per kWh flyttet</span></>}
              </div>
            </div>
            {a.devices?.length > 0 && (
              <details><summary>{a.devices.length} {a.devices.length === 1 ? 'enhet' : 'enheter'}</summary>
                <ul className="action-devices">{a.devices.map(d => <li key={d.id}><span>{d.name}{d.room ? <small> · {d.room}</small> : null}</span><span>{d.watts != null ? `${nb(d.watts, 0)} W` : d.target != null ? `${nb(d.target, 1)} °C` : ''}</span></li>)}</ul>
              </details>
            )}
            {a.flow && <div className="action-flow"><span>Forslag til Homey-flow</span><p>{a.flow}</p><button type="button" className="secondary" onClick={() => copy(a)}>{copied === a.id ? 'Kopiert' : 'Kopier'}</button></div>}
          </li>
        ))}
      </ol>
      <p className="history-note">Kroner er beregnet fra målt effekt og publisert spotpris uten nettleie og avgifter. Enheter som kan være kritiske (kjøl/frys, nettverk, alarm, varme, pumper, ladere) foreslås aldri slått av.</p>
    </section>
  );
}
