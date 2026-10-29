/**
 * Kall mot Macen (mac-agent) via iphone-remote og dashboardets mellomtjener (/iphone/api/mac/…).
 * Samme billett som telefonen (openIphoneSession, administrator). Koordinater er i skjermpunkter.
 */
import { phoneApi } from './iphoneRemote.js';

export { openIphoneSession } from './iphoneRemote.js';
export { macPointerAction, keyEventAction, eventModifiers } from './macGestures.js';

export const macApi = (path, body) => phoneApi(`/api/mac${path}`, body);
export const macType = text => macApi('/type', { text });
export const macKey = combo => macApi('/key', { combo });
export const macActivate = app => macApi('/activate', { app });
export const macOpen = (app, url) => macApi('/open', { app: app || undefined, url: url || undefined });
/** Videokvalitet for alle som ser, byttes uten å starte strømmen på nytt (se macVideoQuality.js). */
export const macVideoQuality = quality => macApi('/video/quality', { quality });
