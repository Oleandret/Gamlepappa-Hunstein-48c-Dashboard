/**
 * Macene som kan fjernstyres via iphone-remote. id er gatewayens navn (MAC_<ID>_HOST der;
 * «soverom» er gatewayens standard uten mac=). Legges en ny Mac til i gatewayen, legges den til her.
 * `vnc` er adressen Skjermdeling (macOS' innebygde VNC, port 5900) nås på fra tailnettet: Macens egen
 * Tailscale-adresse, eller for Macene uten Tailscale (Eufy, Andreas) en videresending på Soverom-Macen
 * (no.byggkon.mobile.forward-<navn>-vnc, port 5907/5942 → 192.168.10.x:5900).
 */
export const MACS = [
  { id: 'soverom', name: 'Mac på Soverom', short: 'Soverom', vnc: '100.91.248.127' },
  { id: 'stue', name: 'Mac i stua', short: 'Stua', vnc: '100.121.133.90' },
  { id: 'eufy', name: 'Eufy-Macen', short: 'Eufy', vnc: '100.91.248.127:5907' },
  { id: 'andreas', name: 'Andreas-iMac', short: 'Andreas', vnc: '100.91.248.127:5942' },
  { id: 'halsaneset', name: 'Mac på Halsaneset', short: 'Halsaneset', vnc: '100.66.190.70' }
];
export const DEFAULT_MAC = MACS[0].id;
export const validMac = id => MACS.some(m => m.id === id) ? id : DEFAULT_MAC;
export const macName = id => (MACS.find(m => m.id === id) || MACS[0]).name;
/** vnc://-lenke som åpner Skjermdeling på en Mac (nettleseren må stå på en Mac på tailnettet). */
export const macVncUrl = id => { const m = MACS.find(m => m.id === id); return m?.vnc ? `vnc://${m.vnc}` : null; };
/** «Mac på Soverom» → «Mac på⏎Soverom» for den smale stolpen. */
export const twoLines = name => name.replace(/ (\S+)$/, '\n$1');
