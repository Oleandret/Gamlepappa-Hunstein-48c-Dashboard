import { capValue, hasCap } from './deviceUtils.js';

export function canWrite(device, capability) {
  return device?.available !== false && hasCap(device, capability)
    && device.capabilitiesObj?.[capability]?.setable !== false;
}

// Keep power-on and dim in order. A dim-only device must never receive onoff.
export async function setDimmer(device, percent, send) {
  if (!canWrite(device, 'dim') || !Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Dimmeren er utilgjengelig eller nivået er ugyldig');
  }
  if (percent > 0 && hasCap(device, 'onoff') && capValue(device, 'onoff') === false) {
    if (!canWrite(device, 'onoff')) throw new Error('Lyset kan ikke slås på');
    const power = await send(device.id, 'onoff', true);
    if (power?.ok === false) return power;
  }
  return send(device.id, 'dim', percent / 100);
}
