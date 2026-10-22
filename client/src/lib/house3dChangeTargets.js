import { FLOORS, roomPoly } from './house3dModel.js';
import { ROOM_FURNISHINGS } from './house3dFurniture.js';
import { FIXTURES_BY_ROOM } from './house3dFixtures.js';
import { editFor, movedBox } from './house3dEdits.js';

/**
 * Hva kan et klikk i 3D-modellen gjelde? Ut fra punktet (i etasjens egne
 * koordinater) og eventuelt BIM-elementet som ble truffet, lages en liste
 * med kandidater: BIM-elementet, møbler og lyspunkter i nærheten, rommet og
 * selve punktet. Brukeren velger, og valget lagres sammen med endringsønsket,
 * så Claude finner igjen elementet i koden (elementId / globalId / meshName).
 */

const FURNITURE_LABEL = {
  bed: 'Seng', sofa: 'Sofa', chair: 'Stol', table: 'Bord', tv: 'TV', speaker: 'Høyttaler', rug: 'Teppe',
  wardrobe: 'Garderobe', vanity: 'Servant', plant: 'Plante', foldingChair: 'Klappstol', washer: 'Vaskemaskin',
  slats: 'Spilevegg', shower: 'Dusj', lounger: 'Solseng', car: 'Bil', treadmill: 'Tredemølle', sunbed: 'Solarium',
  stool: 'Krakk', stairs: 'Trapp', smartDisplay: 'Skjerm', sideboard: 'Skjenk', pool: 'Basseng', picture: 'Bilde',
  pergola: 'Pergola', outdoorKitchen: 'Utekjøkken', nightstand: 'Nattbord', massageChair: 'Massasjestol',
  glassCabinet: 'Glasskap', crib: 'Sprinkelseng', bench: 'Benk', beanbag: 'Sittesekk', armchair: 'Lenestol',
  box: 'Innredning'
};
const FIXTURE_LABEL = { spot: 'Spot', ceiling: 'Lampepunkt', tube: 'LED-armatur', strip: 'LED-list', outdoor: 'Utelys' };
const IFC_LABEL = {
  IfcWall: 'Vegg', IfcWallStandardCase: 'Vegg', IfcSlab: 'Dekke/gulv', IfcRoof: 'Tak', IfcDoor: 'Dør', IfcWindow: 'Vindu',
  IfcStair: 'Trapp', IfcStairFlight: 'Trapp', IfcRailing: 'Rekkverk', IfcColumn: 'Søyle', IfcBeam: 'Bjelke',
  IfcFurnishingElement: 'Møbel (BIM)', IfcCovering: 'Kledning/himling', IfcPlate: 'Plate', IfcMember: 'Stender/profil'
};

function inPoly([x, z], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** Leser BIM-nodenavnet «gruppe|IfcType|navn|GlobalId|mat». */
export function parseBimName(name) {
  const parts = String(name || '').split('|');
  if (parts.length < 4) return null;
  return { ifcType: parts[1], name: parts[2], globalId: parts[3] };
}

/**
 * Finner etasjen et klikk hører til. `worldPoint` er punktet i scenen, `offsets`
 * gir etasjenes forskyvning ({ [floorId]: [sx, y, sz] }) slik de er tegnet nå.
 * Gir { floorId, local: [x, y, z] } i etasjens egne koordinater.
 */
export function localizePoint(worldPoint, offsets) {
  const [px, py, pz] = worldPoint;
  let best = null;
  for (const floor of [...FLOORS].reverse()) {
    const off = offsets[floor.id];
    if (!off) continue;
    const local = [px - off[0], py - off[1], pz - off[2]];
    if (local[1] < -0.5 || local[1] > floor.height + 0.8) continue;
    const inside = floor.rooms.some(r => inPoly([local[0], local[2]], roomPoly(r)));
    if (inside) return { floorId: floor.id, local };
    best ||= { floorId: floor.id, local };
  }
  return best;
}

const round = v => Math.round(v * 100) / 100;

export function changeCandidates({ floorId, local, bimName = null, doorLabel = null, edits = {} }) {
  const floor = FLOORS.find(f => f.id === floorId);
  if (!floor) return [];
  const [x, y, z] = local;
  const point = [round(x), round(y), round(z)];
  const room = floor.rooms.find(r => inPoly([x, z], roomPoly(r))) || null;
  const base = { floorId, roomId: room?.id, roomName: room?.name, point };
  const out = [];

  const bim = parseBimName(bimName);
  if (bim) {
    const what = doorLabel || IFC_LABEL[bim.ifcType] || bim.ifcType.replace(/^Ifc/, '');
    out.push({ ...base, kind: bim.ifcType === 'IfcDoor' ? 'door' : 'bim', label: `${what}: ${bim.name}`, ifcType: bim.ifcType, globalId: bim.globalId, meshName: bimName });
  }

  // Møbler fra bildene: boksen rundt punktet (litt utvidet), minste først
  const furniture = [];
  for (const [roomId, f] of Object.entries(ROOM_FURNISHINGS)) {
    if (f.floorId !== floorId) continue;
    f.items.forEach((it, i) => {
      // Der møbelet står nå (flyttet/snudd i 3D-visningen); fjernede hoppes over
      const e = editFor(edits, `furniture:${roomId}:items:${i}`);
      if (e.removed) return;
      const [x0, z0, x1, z1] = movedBox(it.at, e);
      const pad = 0.25;
      if (x >= x0 - pad && x <= x1 + pad && z >= z0 - pad && z <= z1 + pad) {
        const r = floor.rooms.find(rr => rr.id === roomId);
        furniture.push({ area: (x1 - x0) * (z1 - z0), c: { ...base, roomId, roomName: r?.name, kind: 'furniture', label: `${FURNITURE_LABEL[it.type] || it.type} i ${r?.name || roomId}`, elementId: `${roomId}:items:${i}` } });
      }
    });
  }
  furniture.sort((a, b) => a.area - b.area).slice(0, 4).forEach(f => out.push(f.c));

  // Lyspunkter innen 0,8 m, nærmeste først
  const fixtures = floor.rooms.flatMap(r => (FIXTURES_BY_ROOM[r.id] || [])
    .map(f => ({ f, e: editFor(edits, `fixture:${f.id}`) }))
    .filter(({ e }) => !e.removed)
    .map(({ f, e }) => ({ f, r, d: Math.hypot(f.x + e.dx - x, f.z + e.dz - z) })))
    .filter(e => e.d < 0.8).sort((a, b) => a.d - b.d).slice(0, 3);
  for (const { f, r } of fixtures) out.push({ ...base, roomId: r.id, roomName: r.name, kind: 'fixture', label: `${FIXTURE_LABEL[f.kind] || f.kind} i ${r.name}`, elementId: f.id });

  if (room) out.push({ ...base, kind: 'room', label: `Rommet: ${room.name}`, elementId: room.id });
  out.push({ ...base, kind: 'point', label: `Punktet (${point[0]}, ${point[2]})${room ? ` i ${room.name}` : ''}` });
  return out;
}
