import { useMemo } from 'react';
import { useHomePresence, presencePeople } from '../lib/useHomePresence.js';
import { useNetworkDevices } from '../lib/useNetworkDevices.js';

/**
 * «Hjemme» i topplinja: én brikke per person med grønn prikk når minst én av
 * personens valgte enheter er på hjemmenettet. Enhetene velges i 3D-huset
 * (Nettverk → klikk en enhet → «Vis i Hjemme»). Vises ikke før noe er valgt.
 */
export function HomePresence() {
  const { devices: selected } = useHomePresence();
  const any = Object.keys(selected).length > 0;
  const net = useNetworkDevices(any);
  const people = useMemo(() => presencePeople(selected, net.devices), [selected, net.devices]);
  if (!any) return null;
  const known = net.connected;
  const home = people.filter(p => p.home).length;

  return (
    <div className="dashboard-presence" role="group" aria-label="Hvem er hjemme">
      <span className="dashboard-presence-label">Hjemme{known ? ` ${home}/${people.length}` : ''}</span>
      {people.map(p => {
        const state = !known ? 'unknown' : p.home ? 'home' : 'away';
        const title = `${p.person}: ${state === 'home' ? 'hjemme' : state === 'away' ? 'ikke sett på hjemmenettet' : 'ukjent'}\n`
          + p.devices.map(d => `${d.name} – ${known ? d.status : 'ukjent'}`).join('\n');
        return (
          <span key={p.person} className={`presence-chip presence-${state}`} title={title}>
            <span className="presence-dot" aria-hidden="true" />
            {p.person}
            <span className="sr-only">{state === 'home' ? ' er hjemme' : state === 'away' ? ' er borte' : ' – ukjent'}</span>
          </span>
        );
      })}
      {!known && net.reason && <span className="dashboard-presence-note">Får ikke kontakt med hjemmenett</span>}
    </div>
  );
}
