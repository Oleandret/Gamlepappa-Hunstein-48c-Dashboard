import { randomUUID } from 'node:crypto';
import { getNamespace, updateNamespace } from './configStore.js';

/**
 * Endringsønsker for 3D-modellen. Eieren trykker på et element i modellen og
 * skriver hva som skal endres; Claude leser listen når eieren ber om «ny modell»,
 * gjør endringene i koden og merker ønsket som gjort med lenke til PR-en.
 *
 * Lagres i config-store (namespace `house3dChanges`), ikke i det offentlige repoet.
 */

const NS = 'house3dChanges';
export const CHANGE_STATUSES = ['ny', 'pågår', 'gjort', 'avvist'];
export const TARGET_KINDS = ['bim', 'furniture', 'fixture', 'room', 'door', 'point'];
const MAX_ITEMS = 300;

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const num = v => (Number.isFinite(v) ? Math.round(v * 100) / 100 : undefined);

/** Renser elementet brukeren trykket på: bare kjente felter, korte strenger og tall. */
export function cleanTarget(t) {
  if (!t || typeof t !== 'object') throw Object.assign(new Error('Velg et element i modellen'), { status: 400 });
  const kind = TARGET_KINDS.includes(t.kind) ? t.kind : 'point';
  const point = Array.isArray(t.point) && t.point.length === 3 && t.point.every(Number.isFinite) ? t.point.map(num) : undefined;
  const out = {
    kind,
    label: str(t.label, 120),
    floorId: str(t.floorId, 20),
    roomId: str(t.roomId, 40),
    roomName: str(t.roomName, 80),
    ifcType: str(t.ifcType, 40),
    globalId: str(t.globalId, 40),
    meshName: str(t.meshName, 200),
    elementId: str(t.elementId, 80),
    point
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== ''));
}

export function createHouse3dChanges({ read = () => getNamespace(NS), update = fn => updateNamespace(NS, fn), now = () => new Date().toISOString(), id = randomUUID } = {}) {
  const list = async () => (await read()) || [];
  return {
    list,
    async add({ target, text, by }) {
      const t = cleanTarget(target);
      const tekst = str(text, 1000);
      if (!tekst || tekst.length < 3) throw Object.assign(new Error('Skriv hva som skal endres'), { status: 400 });
      const item = { id: id(), status: 'ny', target: t, text: tekst, by: str(by, 80) || 'eier', created: now(), updated: now() };
      await update(prev => {
        const items = prev || [];
        if (items.filter(i => i.status === 'ny' || i.status === 'pågår').length >= MAX_ITEMS) throw Object.assign(new Error('For mange åpne ønsker'), { status: 409 });
        return [item, ...items].slice(0, MAX_ITEMS);
      });
      return item;
    },
    async patch(itemId, body = {}) {
      let found = null;
      await update(prev => (prev || []).map(i => {
        if (i.id !== itemId) return i;
        const next = { ...i, updated: now() };
        if (body.status !== undefined) {
          if (!CHANGE_STATUSES.includes(body.status)) throw Object.assign(new Error('Ukjent status'), { status: 400 });
          next.status = body.status;
        }
        if (body.note !== undefined) next.note = str(body.note, 1000) || undefined;
        if (body.pr !== undefined) {
          const pr = str(body.pr, 200);
          if (pr && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(pr)) throw Object.assign(new Error('PR må være en GitHub-lenke'), { status: 400 });
          next.pr = pr || undefined;
        }
        found = next;
        return next;
      }));
      if (!found) throw Object.assign(new Error('Ønsket finnes ikke'), { status: 404 });
      return found;
    },
    async remove(itemId) {
      let removed = false;
      await update(prev => (prev || []).filter(i => (i.id === itemId ? ((removed = true), false) : true)));
      if (!removed) throw Object.assign(new Error('Ønsket finnes ikke'), { status: 404 });
    }
  };
}
