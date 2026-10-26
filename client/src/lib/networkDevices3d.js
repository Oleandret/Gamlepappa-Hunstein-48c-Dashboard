import { ALL_ROOMS, roomCenter } from './house3dModel.js';

/**
 * Nettverkslaget i 3D-huset: enhetene fra hjemmenett-monitoren plassert i
 * rommet de står på i portalen. Rom-navnene der er fritekst, så de kobles
 * mot 3D-rommene med `room.match` og noen ekstra alias. Enheter uten rom
 * (eller med et rom modellen ikke har) vises bare i listen.
 */

export const NET_CATEGORIES = [
  { id: 'mobile',   label: 'Mobiler',      color: '#22e6ff' },
  { id: 'computer', label: 'Datamaskiner', color: '#7d5cff' },
  { id: 'tv',       label: 'TV',           color: '#ff7a1a' },
  { id: 'speaker',  label: 'Høyttalere',   color: '#3ddc84' },
  { id: 'camera',   label: 'Kameraer',     color: '#ff5c7a' },
  { id: 'smart',    label: 'Smarthus',     color: '#ffb84a' },
  { id: 'network',  label: 'Nettverk',     color: '#9fd8ff' },
  { id: 'other',    label: 'Annet',        color: '#7c8aa8' }
];
export const NET_CATEGORY = Object.fromEntries(NET_CATEGORIES.map(c => [c.id, c]));

export const NET_SORTS = [
  { id: 'room',  label: 'Rom' },
  { id: 'name',  label: 'Navn' },
  { id: 'data',  label: 'Datamengde' },
  { id: 'owner', label: 'Eier' },
  { id: 'type',  label: 'Type' }
];

// Portal-navn som ikke treffer `room.match` direkte. null = rommet finnes
// ikke i modellen (heller enn å gjette feil etasje).
const ALIASES = [
  [/teknisk rom (i )?kjeller/i, 'u-tekrom'],
  [/teknisk rom bak kj.kken/i, null],
  [/bad til basseng|bassengbad/i, 'u-bassbad'],
  [/terr?asse.*3\.? ?etg/i, 'f2-terrasse']
];

const cache = new Map();
export function roomIdForName(name) {
  if (!name) return null;
  if (cache.has(name)) return cache.get(name);
  const alias = ALIASES.find(([re]) => re.test(name));
  const id = alias ? alias[1] : ALL_ROOMS.find(r => r.match?.test(name))?.id || null;
  cache.set(name, id);
  return id;
}

const collator = new Intl.Collator('nb', { sensitivity: 'base', numeric: true });
const roomOrder = new Map(ALL_ROOMS.map((r, i) => [r.id, i]));

export function sortNetDevices(list, sort) {
  const by = {
    name: (a, b) => collator.compare(a.name, b.name),
    data: (a, b) => (b.dataBytes ?? -1) - (a.dataBytes ?? -1),
    owner: (a, b) => (!a.owner - !b.owner) || collator.compare(a.owner || '', b.owner || ''),
    type: (a, b) => NET_CATEGORIES.findIndex(c => c.id === a.category) - NET_CATEGORIES.findIndex(c => c.id === b.category),
    room: (a, b) => (roomOrder.get(a.roomId) ?? 999) - (roomOrder.get(b.roomId) ?? 999)
  }[sort] || (() => 0);
  return [...list].sort((a, b) => by(a, b) || collator.compare(a.name, b.name));
}

/** Gruppeoverskrift for listen etter valgt sortering. */
export function groupKey(d, sort) {
  if (sort === 'room') return d.roomId ? ALL_ROOMS.find(r => r.id === d.roomId).name : 'Uten plass i modellen';
  if (sort === 'owner') return d.owner || 'Ingen eier';
  if (sort === 'type') return NET_CATEGORY[d.category]?.label || 'Annet';
  return null;
}

/**
 * Posisjon i rommet: enhetene i et rom legges i en ring rundt sentrum, i
 * fast rekkefølge (MAC) slik at de ikke hopper når listen oppdateres.
 */
export function placeNetDevices(devices) {
  const byRoom = new Map();
  for (const d of devices) if (d.roomId) (byRoom.get(d.roomId) || byRoom.set(d.roomId, []).get(d.roomId)).push(d);
  const out = [];
  for (const [roomId, list] of byRoom) {
    const room = ALL_ROOMS.find(r => r.id === roomId);
    const [cx, cz] = roomCenter(room);
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    sorted.forEach((d, i) => {
      const ring = Math.floor(i / 8), slot = i % 8, inRing = Math.min(8, sorted.length - ring * 8);
      const r = sorted.length === 1 ? 0 : 0.55 + ring * 0.45;
      const a = (slot / inRing) * Math.PI * 2 + ring * 0.4;
      out.push({ device: d, floorId: room.floorId, roomId, x: cx + r * Math.cos(a), z: cz + r * Math.sin(a), height: 0.9 + (ring % 2) * 0.35 });
    });
  }
  return out;
}
