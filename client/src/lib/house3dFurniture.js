/**
 * Faktisk møblering per rom, målt ut fra bilder av rommet. Rom som står her
 * får arkitektens møbler fra BIM-modellen (IfcFurnishingElement) skjult og
 * disse tegnet i stedet.
 *
 * Koordinater i meter i samme system som house3dModel.js (x øst, z sør),
 * y = høyde over gulvflaten i rommet (oppå romplata, FLOOR_TOP). Bokser er { at: [x0, z0, x1, z1], y0, y1 }.
 */

/** Overkant av gulvplata som rommene tegnes med i interiør (House3DView InteriorRoom). */
export const FLOOR_TOP = 0.12;

export const ROOM_FURNISHINGS = {
  // Soverom 3, 1. etg — bilder 20.10.2026 (IMG_2180–2183)
  'f1-sov3': {
    floorId: 'floor1',
    // Innvendig mål fra BIM-veggene
    bounds: [0.94, -3.97, 5.3, -0.09],
    // Gulv: grått, slipt betong
    floor: { color: '#9c9c98', roughness: 0.35 },
    // Dører (fra BIM): bad og garderobe i vestveggen, stue i sørveggen.
    // Veggflatene har åpninger der, så dørene i BIM-modellen synes.
    doors: [
      { side: 'west', from: -3.27, to: -2.37, name: 'Bad' },
      { side: 'west', from: -1.5, to: -0.7, name: 'Garderobe (skyvedør)' },
      { side: 'south', from: 1.38, to: 2.28, name: 'Stue' }
    ],
    walls: [
      // Skogtapet bak senga (nordvegg, vest for vinduet)
      { side: 'north', from: 0.94, to: 3.69, finish: 'forest' },
      { side: 'north', from: 5.1, to: 5.3, finish: 'green' },
      { side: 'west', from: -3.97, to: -0.09, finish: 'green' },
      { side: 'south', from: 0.94, to: 5.3, finish: 'green' },
      { side: 'east', from: -1.44, to: -0.09, finish: 'green' }
    ],
    items: [
      { type: 'rug', at: [2.2, -1.98, 4.15, -0.75], color: '#d9d2c3' },
      // Dobbeltseng med hodeende mot skogtapetet
      { type: 'bed', at: [1.95, -3.95, 3.95, -1.95] },
      { type: 'bench', at: [2.45, -1.92, 3.75, -1.48] },
      { type: 'nightstand', at: [1.45, -3.95, 1.9, -3.52] },
      { type: 'smartDisplay', at: [1.55, -3.85, 1.8, -3.72], y0: 0.6 },
      // Sprinkelseng inntil senga, foran nordvinduet
      { type: 'crib', at: [3.97, -3.9, 4.6, -2.7] },
      // TV-veggen mot stua (sørveggen): skjenk med TV, og en like stor TV på veggen ved siden av
      { type: 'sideboard', at: [3.95, -0.55, 5.25, -0.1] },
      { type: 'tv', at: [3.98, -0.34, 5.22, -0.28], y0: 0.68, y1: 1.4, stand: true },
      { type: 'tv', at: [2.5, -0.15, 3.74, -0.1], y0: 0.62, y1: 1.34, wall: true },
      // Massasjestol foran TV-en på skjenken, vendt mot den
      { type: 'massageChair', at: [4.2, -2.25, 5.0, -0.75] },
      { type: 'picture', at: [4.1, -0.12, 5.1, -0.09], y0: 1.55, y1: 2.2, wall: true },
      { type: 'speaker', at: [3.0, -0.3, 3.55, -0.1], y0: 2.2, y1: 2.38, wall: true },
      { type: 'speaker', at: [5.05, -0.3, 5.28, -0.1], y0: 2.05, y1: 2.38, wall: true }
    ]
  }
};

/** Er punktet (x, z) inne i et rom som har egen møblering på denne etasjen? */
export function furnishedRoomAt(floorId, x, z) {
  for (const [roomId, f] of Object.entries(ROOM_FURNISHINGS)) {
    if (f.floorId !== floorId) continue;
    const [x0, z0, x1, z1] = f.bounds;
    if (x > x0 && x < x1 && z > z0 && z < z1) return roomId;
  }
  return null;
}

/** Veggsegmenter for en vegg minus døråpningene på samme side. */
export function wallSegments(wall, doors = []) {
  let segs = [[wall.from, wall.to]];
  for (const d of doors.filter(d => d.side === wall.side)) {
    segs = segs.flatMap(([a, b]) => {
      if (d.to <= a || d.from >= b) return [[a, b]];
      return [[a, d.from], [d.to, b]].filter(([x, y]) => y - x > 0.02);
    });
  }
  return segs;
}
