import { useMemo } from 'react';
import { useHomePresence, presencePeople } from '../lib/useHomePresence.js';
import { useNetworkDevices } from '../lib/useNetworkDevices.js';

/**
 * «Hjemme» i topplinja: én brikke per person. Grønn prikk når minst én av
 * personens valgte enheter er på hjemmenettet nå, gul når den er sett nylig
 * (telefonen ligger trolig i dvale), grå når den er borte lenge. Enhetene
 * velges i 3D-huset (Nettverk → klikk en enhet → «Vis i Hjemme»). Vises ikke før noe er valgt.
 */
const WORDS = { home: 'hjemme', recent: 'sett nylig, trolig hjemme', away: 'ikke sett på hjemmenettet på en stund', unknown: 'ukjent' };

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
        const state = !known ? 'unknown' : p.state;
        const title = `${p.person}: ${WORDS[state]}\n` + p.devices.map(d => `${d.name} – ${known ? d.status : 'ukjent'}`).join('\n');
        return (
          <span key={p.person} className={`presence-chip presence-${state}`} title={title}>
            <span className="presence-dot" aria-hidden="true" />
            {p.person}
            <span className="sr-only">{' – ' + WORDS[state]}</span>
          </span>
        );
      })}
      {!known && net.reason && <span className="dashboard-presence-note">Får ikke kontakt med hjemmenett</span>}
    </div>
  );
}
