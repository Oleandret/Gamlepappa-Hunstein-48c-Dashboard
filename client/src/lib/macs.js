/**
 * Macene som kan fjernstyres via iphone-remote. id er gatewayens navn (MAC_<ID>_HOST der;
 * «soverom» er gatewayens standard uten mac=). Legges en ny Mac til i gatewayen, legges den til her.
 * `vnc` er adressen Skjermdeling-appen (vnc://) bruker fra en Mac på tailnettet: Macens egen Tailscale-adresse,
 * eller for Macene uten Tailscale (Eufy, Andreas) LAN-adressen, som nås via subnet-ruten 192.168.10.0/24 fra
 * «soverom-router». noVNC i nettleseren bruker ikke denne; den går via gatewayen.
 */
export const MACS = [
  { id: 'soverom', name: 'Mac på Soverom', short: 'Soverom', vnc: '100.91.248.127' },
  { id: 'stue', name: 'Mac i stua', short: 'Stua', vnc: '100.121.133.90' },
  { id: 'eufy', name: 'Eufy-Macen', short: 'Eufy', vnc: '192.168.10.207' },
  { id: 'andreas', name: 'Andreas-iMac', short: 'Andreas', vnc: '192.168.10.42' },
  { id: 'halsaneset', name: 'Mac på Halsaneset', short: 'Halsaneset', vnc: '100.66.190.70' },
  { id: 'kino', name: 'Kino-Macen', short: 'Kino', vnc: '192.168.10.8' }
];
export const DEFAULT_MAC = MACS[0].id;
export const validMac = id => MACS.some(m => m.id === id) ? id : DEFAULT_MAC;
export const macName = id => (MACS.find(m => m.id === id) || MACS[0]).name;
/** vnc://-lenke som åpner Skjermdeling på en Mac (nettleseren må stå på en Mac på tailnettet). */
export const macVncUrl = id => { const m = MACS.find(m => m.id === id); return m?.vnc ? `vnc://${m.vnc}` : null; };
/** «Mac på Soverom» → «Mac på⏎Soverom» for den smale stolpen. */
export const twoLines = name => name.replace(/ (\S+)$/, '\n$1');
