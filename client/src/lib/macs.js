/**
 * Macene som kan fjernstyres via iphone-remote. id er gatewayens navn (MAC_<ID>_HOST der;
 * «soverom» er gatewayens standard uten mac=). Legges en ny Mac til i gatewayen, legges den til her.
 */
export const MACS = [
  { id: 'soverom', name: 'Mac på Soverom', short: 'Soverom' },
  { id: 'stue', name: 'Mac i stua', short: 'Stua' },
  { id: 'eufy', name: 'Eufy-Macen', short: 'Eufy' }
];
export const DEFAULT_MAC = MACS[0].id;
export const validMac = id => MACS.some(m => m.id === id) ? id : DEFAULT_MAC;
export const macName = id => (MACS.find(m => m.id === id) || MACS[0]).name;
/** «Mac på Soverom» → «Mac på⏎Soverom» for den smale stolpen. */
export const twoLines = name => name.replace(/ (\S+)$/, '\n$1');
