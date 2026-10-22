/**
 * Direkte endringer i 3D-modellen: flytt, snu eller fjern inventar, lyspunkter
 * og BIM-elementer. Lagres på serveren (config-namespace `house3dEdits`) og
 * vises med en gang for alle. Når eieren ber om «ny modell», bygger Claude dem
 * inn i koden og tømmer listen (se docs/ENDRINGSONSKER.md).
 *
 * Form: { [nøkkel]: { dx, dz, rot, removed, label } }
 *   nøkkel = furniture:<rom>:items:<i> | fixture:<rom>:<type>:<i> | bim:<GlobalId>
 *   dx/dz i meter (øst/sør), rot i radianer rundt elementets midtpunkt (bare inventar).
 */

const MAX_EDITS = 500;
const MAX_SHIFT = 6;
const round = v => Math.round(v * 1000) / 1000;
const clamp = (v, m) => Math.max(-m, Math.min(m, v));

/** Nøkkelen et valgt element lagres under, eller null hvis det ikke kan flyttes. */
export function editKey(target) {
  if (!target) return null;
  if (target.kind === 'furniture' && target.elementId) return `furniture:${target.elementId}`;
  if (target.kind === 'fixture' && target.elementId) return `fixture:${target.elementId}`;
  if ((target.kind === 'bim' || target.kind === 'door') && target.globalId) return `bim:${target.globalId}`;
  return null;
}

/** Kan elementet snus? Bare inventar fra bildene (BIM og lyspunkter flyttes eller fjernes). */
export const canRotate = key => typeof key === 'string' && key.startsWith('furniture:');

export function sanitizeEdits(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, e] of Object.entries(raw).slice(0, MAX_EDITS)) {
    if (!/^(furniture|fixture|bim):[\w$:.-]{1,80}$/.test(key) || !e || typeof e !== 'object') continue;
    const clean = {
      dx: Number.isFinite(e.dx) ? round(clamp(e.dx, MAX_SHIFT)) : 0,
      dz: Number.isFinite(e.dz) ? round(clamp(e.dz, MAX_SHIFT)) : 0,
      rot: Number.isFinite(e.rot) && canRotate(key) ? round(((e.rot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) : 0,
      removed: e.removed === true,
      label: typeof e.label === 'string' ? e.label.slice(0, 120) : ''
    };
    if (clean.dx || clean.dz || clean.rot || clean.removed) out[key] = clean;
  }
  return out;
}

const EMPTY = Object.freeze({ dx: 0, dz: 0, rot: 0, removed: false });
export const editFor = (edits, key) => (key && edits?.[key]) || EMPTY;

/** Ny edits-mappe der elementet er flyttet/snudd (relativt) eller fjernet/gjenopprettet. */
export function applyEdit(edits, key, { dx = 0, dz = 0, rot = 0, removed, label } = {}) {
  if (!key) return edits;
  const cur = editFor(edits, key);
  const next = {
    ...cur,
    dx: cur.dx + dx,
    dz: cur.dz + dz,
    rot: cur.rot + rot,
    removed: removed === undefined ? cur.removed : removed,
    label: label || cur.label || ''
  };
  return sanitizeEdits({ ...edits, [key]: next });
}

export function resetEdit(edits, key) {
  const next = { ...edits };
  delete next[key];
  return next;
}

/** Boksen [x0, z0, x1, z1] etter flytting (og kvart omdreining, som bytter bredde og dybde). */
export function movedBox(at, e = EMPTY) {
  const [x0, z0, x1, z1] = at;
  const cx = (x0 + x1) / 2 + e.dx, cz = (z0 + z1) / 2 + e.dz;
  const quarter = Math.round((e.rot || 0) / (Math.PI / 2)) % 2 === 1;
  const hw = (quarter ? z1 - z0 : x1 - x0) / 2, hd = (quarter ? x1 - x0 : z1 - z0) / 2;
  return [cx - hw, cz - hd, cx + hw, cz + hd];
}
