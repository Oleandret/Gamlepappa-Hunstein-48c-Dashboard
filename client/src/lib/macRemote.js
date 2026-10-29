/**
 * Kall mot Macen (mac-agent) via iphone-remote og dashboardets mellomtjener (/iphone/api/mac/…).
 * Samme billett som telefonen (openIphoneSession, administrator). Koordinater er i skjermpunkter.
 */
import { phoneApi } from './iphoneRemote.js';

export { openIphoneSession } from './iphoneRemote.js';
export { macPointerAction, keyEventAction, eventModifiers } from './macGestures.js';

/** mac=<id> på alle kall (se macs.js); uten id svarer gatewayen for standard-Macen. */
export const withMac = (path, mac) => mac ? `${path}${path.includes('?') ? '&' : '?'}mac=${encodeURIComponent(mac)}` : path;
export const macApi = (path, body, mac) => phoneApi(withMac(`/api/mac${path}`, mac), body);
export const macType = (text, mac) => macApi('/type', { text }, mac);
export const macKey = (combo, mac) => macApi('/key', { combo }, mac);
export const macActivate = (app, mac) => macApi('/activate', { app }, mac);
export const macOpen = (app, url, mac) => macApi('/open', { app: app || undefined, url: url || undefined }, mac);
/** Videokvalitet for alle som ser, byttes uten å starte strømmen på nytt (se macVideoQuality.js). */
export const macVideoQuality = (quality, mac) => macApi('/video/quality', { quality }, mac);
