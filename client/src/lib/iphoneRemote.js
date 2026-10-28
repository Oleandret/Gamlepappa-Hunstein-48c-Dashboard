/**
 * Kall mot iphone-remote via dashboardets mellomtjener (/iphone/api/…).
 * Billett-cookien hentes med openIphoneSession() (krever administrator).
 * Koordinater er i telefonens punkter (size.width × size.height).
 */
import { apiFetch } from './api.js';

export const IPHONE_BASE = '/iphone';

/** Henter billett for /iphone/. Svar: { status: 'ready' | 'forbidden' | 'not-configured' | 'error' }. */
export async function openIphoneSession() {
  try {
    const r = await apiFetch('/api/iphone/session', { method: 'POST' });
    if (r.status === 403) return { status: 'forbidden' };
    if (!r.ok) return { status: 'error' };
    const d = await r.json();
    return d.configured ? { status: 'ready', path: d.path } : { status: 'not-configured' };
  } catch { return { status: 'error' }; }
}

export async function phoneApi(path, body) {
  const r = await fetch(`${IPHONE_BASE}${path}`, body === undefined
    ? { credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `Telefonen svarte ${r.status}`), { status: r.status });
  return j;
}

const swipe = (fromX, fromY, toX, toY, duration = 0.2) => phoneApi('/api/swipe', { fromX, fromY, toX, toY, duration });

/** Knappene i panelet, samme bevegelser som i iphone-remote. */
export function gestures(size) {
  const W = size.width, H = size.height;
  return {
    home: () => phoneApi('/api/home', {}),
    back: () => swipe(1, H / 2, W * 0.7, H / 2, 0.25),
    switcher: () => swipe(W / 2, H - 2, W / 2, H * 0.45, 0.6),
    control: () => swipe(W - 30, 1, W - 30, H * 0.6, 0.3),
    lock: () => phoneApi('/api/lock', {}),
    unlock: () => phoneApi('/api/unlock', {}),
    volumeUp: () => phoneApi('/api/button', { name: 'volumeUp' }),
    volumeDown: () => phoneApi('/api/button', { name: 'volumeDown' }),
    scrollUp: () => swipe(W / 2, H / 2 - H * 0.22, W / 2, H / 2 + H * 0.22, 0.15),
    scrollDown: () => swipe(W / 2, H / 2 + H * 0.22, W / 2, H / 2 - H * 0.22, 0.15)
  };
}

export { pointerAction } from './iphoneGestures.js';

export const typeText = text => phoneApi('/api/keys', { text });
