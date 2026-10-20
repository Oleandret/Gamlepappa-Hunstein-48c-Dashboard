/**
 * Faktisk møblering per rom, målt ut fra bilder av rommet. Rom som står her
 * får arkitektens møbler fra BIM-modellen (IfcFurnishingElement) skjult og
 * disse tegnet i stedet. `keepBim` (regex på BIM-navnet) beholder BIM-møbler
 * som stemmer med virkeligheten, f.eks. kjøkkeninnredningen.
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
  },

  // ── Øvrige rom i 1. etg — bilder 20.10.2026 (IMG_2187–2218) ──────────────
  // Kjøkkenbenk, øy, kjøleskap og oppvaskmaskin fra BIM stemmer med bildene
  // og beholdes (keepBim); sofa og spisebord står annerledes i virkeligheten.
  'f1-kjokken': {
    floorId: 'floor1',
    bounds: [-4.9, 0.21, 6.2, 5.05],
    floor: { color: '#a3a29e', roughness: 0.35 },
    keepBim: /Kjøkken|Kjøleskap|Oppvask/i,
    items: [
      // Stue mot øst: L-sofa med sjeselong foran terrassedøra, rygg mot vinduene
      { type: 'rug', at: [3.0, 2.2, 5.3, 4.3], color: '#8f8b84' },
      { type: 'sofa', at: [5.2, 2.35, 6.1, 5.0], back: 'e', color: '#d9cdb8' },
      { type: 'sofa', at: [2.6, 4.2, 5.2, 5.0], back: 's', color: '#d9cdb8' },
      { type: 'box', at: [5.2, 1.5, 6.1, 2.35], y0: 0, y1: 0.42, color: '#d9cdb8' },
      { type: 'table', at: [3.6, 2.9, 4.9, 3.8], y1: 0.42, color: '#bcd8e0', glass: true, legs: '#b8b8b8' },
      { type: 'armchair', at: [2.25, 2.2, 3.05, 3.0], back: 'w', color: '#d9cdb8' },
      // TV-veggen mot soverommet (dør til soverommet står vest for den)
      { type: 'box', at: [2.7, 0.21, 4.6, 0.6], y0: 0.25, y1: 0.6, color: '#c9ab84' },
      { type: 'tv', at: [2.85, 0.21, 4.45, 0.27], y0: 1.0, y1: 1.9, wall: true, screenTo: 's' },
      { type: 'glassCabinet', at: [1.6, 4.6, 2.45, 5.0] },
      // Kjøkken: barkrakk ved øya
      { type: 'stool', at: [-2.6, 3.2, -2.25, 3.55] },
      // Spisebord i vest ved skyvedøra, hvit duk og seks grå stoler
      { type: 'table', at: [-4.5, 3.3, -2.5, 4.3], y1: 0.75, color: '#f3f1ec', legs: '#2a2a2a' },
      { type: 'chair', at: [-4.35, 2.8, -3.85, 3.3], back: 'n', color: '#9a9590' },
      { type: 'chair', at: [-3.75, 2.8, -3.25, 3.3], back: 'n', color: '#9a9590' },
      { type: 'chair', at: [-3.15, 2.8, -2.65, 3.3], back: 'n', color: '#9a9590' },
      { type: 'chair', at: [-4.35, 4.3, -3.85, 4.8], back: 's', color: '#9a9590' },
      { type: 'chair', at: [-3.75, 4.3, -3.25, 4.8], back: 's', color: '#9a9590' },
      { type: 'chair', at: [-3.15, 4.3, -2.65, 4.8], back: 's', color: '#9a9590' }
    ]
  },

  'f1-garasje': {
    floorId: 'floor1',
    bounds: [-13.55, -4.0, -8.05, 2.1],
    floor: { color: '#b4b2ad', roughness: 0.8 },
    // Kryssfinér på langveggen (ingen dører der)
    walls: [{ side: 'north', from: -13.55, to: -8.05, finish: 'plywood' }],
    // Bare bilene: Model X der den står på bildene, Model Y på den ledige plassen
    items: [
      { type: 'car', model: 'X', at: [-13.2, -0.15, -8.25, 1.85], color: '#3b3e44' },
      { type: 'car', model: 'Y', at: [-13.2, -3.55, -8.45, -1.6], color: '#e9e9e7' }
    ]
  },

  'f1-gang': {
    floorId: 'floor1',
    bounds: [-6.6, -2.35, -3.55, -0.05],
    floor: { color: '#a8a7a3', roughness: 0.35 },
    items: [
      // Skjerm av eikespiler med speil
      { type: 'slats', at: [-6.1, -0.32, -4.5, -0.22], y1: 2.2, color: '#c9a77c' },
      { type: 'box', at: [-5.6, -0.36, -5.0, -0.32], y0: 0.3, y1: 1.9, color: '#c6d4dc', metalness: 0.6, roughness: 0.1 },
      // Skohylle i furu og knaggrekke med jakker
      { type: 'box', at: [-6.55, -2.3, -6.15, -1.55], y0: 0, y1: 2.0, color: '#d8b88a' },
      { type: 'box', at: [-6.55, -1.45, -6.25, -0.45], y0: 0.7, y1: 1.7, color: '#6d5a66' },
      { type: 'box', at: [-4.25, -0.6, -3.65, -0.2], y0: 0, y1: 0.42, color: '#c9a46e' }
    ]
  },

  'f1-wc': {
    floorId: 'floor1',
    bounds: [-5.15, -3.9, -3.55, -2.35],
    floor: { color: '#a8a7a3', roughness: 0.35 },
    items: [
      { type: 'vanity', at: [-5.1, -3.88, -4.35, -3.43], color: '#2e211c' },
      { type: 'box', at: [-5.0, -3.9, -4.45, -3.87], y0: 1.05, y1: 1.7, color: '#1a1a1a', wall: true },
      // Flislagt kasse i beige marmor bak det vegghengte toalettet (toalettet er fra BIM)
      { type: 'box', at: [-4.3, -3.9, -3.6, -3.68], y0: 0, y1: 1.1, color: '#e3d6c0', roughness: 0.4 }
    ]
  },

  'f1-bad': {
    floorId: 'floor1',
    bounds: [-3.45, -3.9, 0.93, -2.35],
    floor: { color: '#e0d4c0', roughness: 0.5 },
    items: [
      { type: 'shower', at: [-3.4, -3.88, -2.5, -2.98] },
      { type: 'vanity', at: [-2.2, -3.88, -1.0, -3.43], color: '#2b2b2b' },
      { type: 'box', at: [-2.1, -3.9, -1.1, -3.78], y0: 1.1, y1: 1.85, color: '#cfd8dc', metalness: 0.5, roughness: 0.15, wall: true },
      { type: 'box', at: [-0.7, -2.85, -0.1, -2.4], y0: 0, y1: 0.9, color: '#f4f4f2' }
    ]
  },

  'f1-vask': {
    floorId: 'floor1',
    bounds: [-3.45, -2.1, -1.6, 0.1],
    floor: { color: '#a8a7a3', roughness: 0.5 },
    // Alt utstyret står mot veggen til walk-in-garderoben (østveggen)
    items: [
      { type: 'box', at: [-2.25, -2.05, -1.65, -0.25], y0: 0.86, y1: 0.9, color: '#b9b6b0' },
      { type: 'box', at: [-2.2, -2.0, -1.68, -1.45], y0: 0, y1: 0.6, color: '#eceae6' },
      { type: 'washer', at: [-2.25, -1.4, -1.68, -0.83], face: 'w' },
      { type: 'washer', at: [-2.25, -0.8, -1.68, -0.25], face: 'w' },
      { type: 'box', at: [-1.95, -2.05, -1.65, -0.25], y0: 1.25, y1: 1.3, color: '#f2f2f0', wall: true },
      { type: 'box', at: [-2.0, -2.05, -1.65, -0.25], y0: 1.7, y1: 2.3, color: '#ebe7df', wall: true },
      { type: 'box', at: [-3.35, -2.05, -3.1, -1.8], y0: 0, y1: 0.55, color: '#f6f6f6' }
    ]
  },

  'f1-walkin': {
    floorId: 'floor1',
    bounds: [-1.5, -2.1, 0.6, 0.1],
    floor: { color: '#c9c1b2', roughness: 1 },
    items: [
      // Hyller på alle vegger unntatt østveggen med skyvedøra inn til soverommet
      { type: 'wardrobe', at: [-1.48, -2.08, -0.98, 0.08] },
      { type: 'wardrobe', at: [-0.95, -2.08, 0.58, -1.58] },
      { type: 'wardrobe', at: [-0.95, -0.42, 0.58, 0.08] }
    ]
  },

  'f1-sluse': {
    floorId: 'floor1',
    bounds: [-7.95, -0.9, -6.65, 2.13],
    floor: { color: '#a8a7a3', roughness: 0.6 },
    items: [
      // Nettverksskap og hyller på veggen, støvsuger og bøtte på gulvet
      { type: 'box', at: [-7.95, 0.2, -7.82, 0.85], y0: 0.9, y1: 1.6, color: '#f4f4f4', wall: true },
      { type: 'box', at: [-6.95, -0.5, -6.68, 1.6], y0: 0.5, y1: 0.53, color: '#f4f4f4' },
      { type: 'box', at: [-6.95, -0.5, -6.68, 1.6], y0: 1.1, y1: 1.13, color: '#f4f4f4' },
      { type: 'box', at: [-7.55, 1.0, -7.2, 1.4], y0: 0, y1: 0.3, color: '#222222' },
      { type: 'box', at: [-7.15, 1.5, -6.85, 1.8], y0: 0, y1: 0.6, color: '#c8c8c8', metalness: 0.5 }
    ]
  },

  // Ballbane på dekket over bassenget. Nett, kurv og mål fra BIM står riktig;
  // utekjøkken, grill og loungemøbler i BIM sto feil og er flyttet (se uteplass).
  'f1-ballbane': {
    floorId: 'floor1',
    bounds: [-19.25, 2.3, -5.05, 10.25],
    floor: { color: '#d8c59c', roughness: 0.95 },
    items: [
      // To solsenger på banen inntil huset
      { type: 'lounger', at: [-8.3, 2.6, -7.6, 4.55] },
      { type: 'lounger', at: [-7.4, 2.6, -6.7, 4.55] },
      // Oppbevaringsbenk foran det store vinduet på kjøkkenets vestvegg
      { type: 'box', at: [-5.6, 2.9, -5.12, 4.2], y0: 0, y1: 0.6, color: '#4b4f55' },
      // Utekjøkken/bar (betongblokk og tre, granittplate) på langs mot uteplassen
      { type: 'outdoorKitchen', at: [-5.75, 5.4, -5.12, 8.4] }
    ]
  },

  // Uteplass med glasstak utenfor kjøkkenets skyvedør mot sør
  'f1-uteplass': {
    floorId: 'floor1',
    bounds: [-4.9, 5.1, 2.0, 8.9],
    floor: { color: '#8e8b86', roughness: 1 },
    items: [
      { type: 'pergola', at: [-3.6, 5.15, 1.2, 8.5], y1: 2.55 },
      // Spisebord med fire hvite stoler
      { type: 'table', at: [-3.3, 6.3, -2.1, 7.2], y1: 0.74, color: '#6e6e6e', legs: '#2a2a2a' },
      { type: 'chair', at: [-3.2, 5.85, -2.75, 6.3], back: 'n', color: '#f1f1f1' },
      { type: 'chair', at: [-2.65, 5.85, -2.2, 6.3], back: 'n', color: '#f1f1f1' },
      { type: 'chair', at: [-3.2, 7.2, -2.75, 7.6], back: 's', color: '#f1f1f1' },
      { type: 'chair', at: [-2.65, 7.2, -2.2, 7.6], back: 's', color: '#f1f1f1' },
      // Loungesofa i rotting (hjørne) med bord, og grill
      { type: 'sofa', at: [-1.6, 7.65, 0.9, 8.45], back: 's', color: '#5f5a55' },
      { type: 'sofa', at: [0.1, 6.5, 0.9, 7.65], back: 'e', color: '#5f5a55' },
      { type: 'box', at: [-1.1, 6.75, -0.2, 7.35], y0: 0, y1: 0.4, color: '#3e3a36' },
      { type: 'box', at: [1.3, 7.85, 1.9, 8.45], y0: 0, y1: 1.05, color: '#2b2b2b', metalness: 0.5 },
      { type: 'foldingChair', at: [-4.6, 6.0, -4.1, 6.5], color: '#f1f1f1' },
      // Rekkverk i mørkt tre mot sør (sjøsiden)
      { type: 'box', at: [-4.9, 8.82, 2.0, 8.9], y0: 0, y1: 1.0, color: '#3b3029' }
    ]
  },

  // Terrasse mot øst/sør: smal gang langs fasaden og et bredere hjørne
  'f1-terrasse': {
    floorId: 'floor1',
    bounds: [6.25, -0.6, 8.55, 6.3],
    floor: { color: '#8e8b86', roughness: 1 },
    items: [
      { type: 'box', at: [7.0, 2.6, 7.4, 3.5], y0: 0, y1: 0.35, color: '#d9d6cf' },
      { type: 'foldingChair', at: [6.6, 2.2, 7.15, 2.75], color: '#c9dbe6' },
      { type: 'foldingChair', at: [7.4, 3.5, 7.95, 4.05], color: '#c9dbe6' }
    ]
  }
};

/**
 * BIM-elementer som står feil i virkeligheten og tegnes på nytt her
 * (uansett rom): pergolaen med glasstak og glassrekkverket mot sør.
 */
export const HIDDEN_BIM = [/Pergola/i, /glassrekkverk sør/i];

export function hiddenBimElement(name = '') {
  return HIDDEN_BIM.some(re => re.test(name));
}

/** Er punktet (x, z) inne i et rom som har egen møblering på denne etasjen? */
export function keepsBimElement(roomId, name = '') {
  const keep = ROOM_FURNISHINGS[roomId]?.keepBim;
  return Boolean(keep && keep.test(name));
}

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
