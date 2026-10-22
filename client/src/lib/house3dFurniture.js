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

/** Trinn i trappa fra U.etg til 1. etg (x0, z0, x1, z1), nederst først. */
const STAIR_STEPS = [
  // Opp mot nord langs vestsiden
  [-7.33, -2.66, -6.45, -2.4], [-7.33, -2.92, -6.45, -2.66], [-7.33, -3.18, -6.45, -2.92], [-7.33, -3.44, -6.45, -3.18],
  // Vendetrinn i nordenden
  [-7.33, -3.88, -6.82, -3.44], [-6.82, -3.88, -6.31, -3.44], [-6.31, -3.88, -5.8, -3.44], [-5.8, -3.88, -5.3, -3.44],
  // Mot sør langs østsiden, opp til gangen i 1. etg
  [-6.3, -3.44, -5.3, -3.18], [-6.3, -3.18, -5.3, -2.92], [-6.3, -2.92, -5.3, -2.66], [-6.3, -2.66, -5.3, -2.4]
];

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
  },

  // ── U.etasje — bilder 21.10.2026 (IMG_2227–2252) ─────────────────────────
  // Kino: hvilestoler på podium, kiste og AV-rack fra BIM stemmer og beholdes.
  // Teknisk rom bak kinoen ble aldri bygget: vestveggen er kinoens TV-vegg,
  // og den hvite hjørnesofaen står i hjørnet mellom TV-veggen og nordveggen.
  'u-kino': {
    floorId: 'basement',
    bounds: [-12.86, -3.9, -5.0, 0.2],
    floor: { color: '#b9b8b3', roughness: 0.3 },
    keepBim: /Hvilestol|Podium|Kiste|AV-rack|Dartskive|Projektor/i,
    walls: [
      { side: 'north', from: -12.86, to: -7.35, finish: 'grey' },
      { side: 'west', from: -3.9, to: 0.2, finish: 'grey' }
    ],
    items: [
      // Hvit hjørnesofa i nordvesthjørnet
      { type: 'sofa', at: [-12.84, -3.88, -9.3, -2.98], back: 'n', color: '#efece6' },
      { type: 'sofa', at: [-12.84, -2.98, -11.94, -2.1], back: 'w', color: '#efece6' },
      // TV på vestveggen, rødt forheng ved glassveggen til bassenget
      { type: 'tv', at: [-12.86, -2.05, -12.8, -0.45], y0: 0.85, y1: 1.75, wall: true, screenTo: 'e' },
      { type: 'speaker', at: [-12.84, -2.0, -12.66, -1.75], y0: 1.95, y1: 2.25, wall: true },
      { type: 'speaker', at: [-12.84, -0.75, -12.66, -0.5], y0: 1.95, y1: 2.25, wall: true },
      { type: 'box', at: [-12.84, -0.4, -12.68, 0.18], y0: 0, y1: 2.26, color: '#9b1419' },
      // Filmplakater (Alien, Terminator, Gladiator, Pulp Fiction) over sofaen
      { type: 'box', at: [-12.2, -3.9, -11.65, -3.87], y0: 1.3, y1: 2.15, color: '#1d1d1f', wall: true },
      { type: 'box', at: [-11.47, -3.9, -10.92, -3.87], y0: 1.3, y1: 2.15, color: '#1d1d1f', wall: true },
      { type: 'box', at: [-10.74, -3.9, -10.19, -3.87], y0: 1.3, y1: 2.15, color: '#1d1d1f', wall: true },
      { type: 'box', at: [-10.01, -3.9, -9.46, -3.87], y0: 1.3, y1: 2.15, color: '#1d1d1f', wall: true },
      // Kuskinn foran TV-en
      { type: 'rug', at: [-11.7, -1.5, -10.4, -0.2], color: '#1e1c1b' },
      { type: 'rug', at: [-10.2, -1.3, -9.35, -0.4], color: '#2a2726' },
      // Mørkegrå sofa bak hvilestolene, med lydabsorbenter på veggen bak
      { type: 'box', at: [-6.08, -1.75, -5.98, -0.5], y0: 0, y1: 2.26, color: '#8e9398' },
      { type: 'sofa', at: [-7.0, -1.7, -6.1, 0.1], back: 'e', color: '#4a4846' },
      { type: 'box', at: [-5.98, -1.65, -5.94, -1.2], y0: 1.25, y1: 1.75, color: '#1b1b1b', wall: true },
      { type: 'box', at: [-5.98, -1.1, -5.94, -0.65], y0: 1.25, y1: 1.75, color: '#1b1b1b', wall: true },
      // Trapp opp til 1. etg mellom kinoen og soverommet: opp langs vestsiden,
      // vendetrinn i nord og ned mot sør til gangen i 1. etg
      { type: 'stairs', at: [-7.33, -3.88, -5.3, -2.4], rise: 3.14, steps: STAIR_STEPS },
      // Bar under trappa: skrivebord med skjerm og spilevegg med vinglass
      { type: 'box', at: [-6.25, -2.95, -5.4, -2.5], y0: 0, y1: 0.75, color: '#2b2522' },
      { type: 'box', at: [-6.05, -2.95, -5.6, -2.9], y0: 0.8, y1: 1.15, color: '#111111' },
      { type: 'slats', at: [-5.33, -3.44, -5.3, -1.8], y1: 2.2, color: '#c9a77c', along: 'z' }
    ]
  },

  // Svømmebassenget (bildene ligger i Drive-mappa «Bassengbad»): naturstein på
  // veggene, flis rundt bassenget, sittesekk foran badstua og palmer
  'u-basseng': {
    floorId: 'basement',
    bounds: [-12.8, 0.27, -5.05, 4.85],
    floor: { color: '#9a8a78', roughness: 0.55 },
    doors: [
      { side: 'south', from: -10.35, to: -9.54, name: 'Bassengbod' },
      { side: 'south', from: -6.51, to: -5.7, name: 'Bad' },
      { side: 'east', from: 0.64, to: 1.45, name: 'Tek' }
    ],
    walls: [
      { side: 'west', from: 0.27, to: 4.85, finish: 'stone' },
      { side: 'south', from: -12.8, to: -5.05, finish: 'stone' },
      // Østveggen mot badstua er glass (se STRUCTURE); stein bare ved Tek
      { side: 'east', from: 0.27, to: 1.63, finish: 'stone' }
    ],
    items: [
      { type: 'pool', at: [-12.76, 1.17, -6.24, 4.24] },
      { type: 'beanbag', at: [-6.15, 2.0, -5.12, 3.25], color: '#d8cdb8' },
      { type: 'plant', at: [-12.75, 0.35, -12.35, 0.75], y1: 1.3 },
      { type: 'plant', at: [-12.75, 4.4, -12.35, 4.8], y1: 1.2 },
      { type: 'plant', at: [-5.5, 0.35, -5.1, 0.75], y1: 1.2 }
    ]
  },

  // Bad U.etg: beige marmorflis, dusjhjørne i glass og mørk servant med speilskap
  'u-bad': {
    floorId: 'basement',
    bounds: [-3.5, 0.3, -1.7, 1.54],
    floor: { color: '#d8cbb6', roughness: 0.4 },
    walls: [
      { side: 'north', from: -3.5, to: -1.7, finish: 'beige' },
      { side: 'west', from: 0.3, to: 1.54, finish: 'beige' },
      { side: 'east', from: 0.3, to: 1.54, finish: 'beige' }
    ],
    items: [
      { type: 'shower', at: [-3.48, 0.32, -2.6, 1.2] },
      { type: 'vanity', at: [-2.5, 0.32, -1.75, 0.77], color: '#2e211c' },
      { type: 'box', at: [-2.48, 0.3, -1.77, 0.45], y0: 1.1, y1: 1.85, color: '#2e211c', wall: true }
    ]
  },

  // Bod: eikehyller langs den ene langveggen, hvit kommode med overskap på den
  // andre, spilevegg med speil i enden
  'u-bod': {
    floorId: 'basement',
    bounds: [-1.35, -0.3, 1.7, 1.0],
    floor: { color: '#a9a8a4', roughness: 0.6 },
    walls: [{ side: 'west', from: -0.3, to: 1.0, finish: 'slats' }],
    items: [
      { type: 'box', at: [-1.3, 0.62, 0.45, 0.98], y0: 0, y1: 2.0, color: '#c4934f' },
      { type: 'box', at: [-0.95, -0.28, 0.4, 0.15], y0: 0, y1: 0.95, color: '#f2f1ee' },
      { type: 'box', at: [-0.95, -0.28, 0.4, 0.05], y0: 1.55, y1: 2.15, color: '#f2f1ee', wall: true },
      { type: 'box', at: [-1.33, 0.0, -1.3, 0.45], y0: 0.3, y1: 1.85, color: '#c6d4dc', metalness: 0.6, roughness: 0.1 },
      { type: 'box', at: [-0.4, 0.25, 0.1, 0.55], y0: 0, y1: 0.7, color: '#e7a59a' },
      { type: 'box', at: [-0.95, 0.25, -0.5, 0.55], y0: 0, y1: 0.75, color: '#1d1d1f' }
    ]
  },

  // Bassengboden er delt med en ny vegg (rød strek på plantegningen): et lite
  // treningsrom mot øst (svart glassdør fra bassenget) og teknisk rom vegg i vegg
  // mot vest med sandfilter, pumper og UV fra BIM. Bildene ligger i mappa «Tek».
  'u-bassbod': {
    floorId: 'basement',
    bounds: [-11.2, 5.3, -8.5, 7.4],
    floor: { color: '#9e9e9a', roughness: 0.6 },
    items: [
      // Solarium langs østveggen, tredemølle langs skilleveggen, hylle i enden
      { type: 'sunbed', at: [-9.45, 5.35, -8.55, 7.35] },
      { type: 'treadmill', at: [-11.1, 5.6, -10.35, 7.35], front: 's' },
      { type: 'box', at: [-10.25, 7.0, -9.5, 7.38], y0: 0, y1: 0.77, color: '#f4f4f2' }
    ]
  },

  'u-tekrom': {
    floorId: 'basement',
    bounds: [-14.9, 5.3, -11.2, 7.4],
    floor: { color: '#9e9e9a', roughness: 0.6 },
    walls: [{ side: 'south', from: -14.9, to: -11.25, finish: 'plywood' }],
    items: [
      // Varmtvannsbereder med slangetrommel, kanner med bassengkjemikalier og overskap
      { type: 'box', at: [-12.05, 6.75, -11.45, 7.35], y0: 0, y1: 1.85, color: '#f2f2f0' },
      { type: 'box', at: [-11.45, 6.95, -11.28, 7.3], y0: 0.9, y1: 1.3, color: '#2f8f6e' },
      { type: 'box', at: [-13.05, 6.95, -12.75, 7.35], y0: 0, y1: 0.45, color: '#1f5fc4' },
      { type: 'box', at: [-12.7, 6.95, -12.4, 7.35], y0: 0, y1: 0.45, color: '#1f5fc4' },
      { type: 'box', at: [-13.7, 7.1, -13.0, 7.38], y0: 1.5, y1: 2.0, color: '#f4f4f2', wall: true }
    ]
  }
};

/**
 * BIM-elementer som står feil i virkeligheten og tegnes på nytt her
 * (uansett rom): pergolaen med glasstak og glassrekkverket mot sør.
 */
export const HIDDEN_BIM = [
  /Pergola/i, /glassrekkverk sør/i,
  // U.etg: lerretet byttes med TV; veggen mellom basseng og badstu er glass;
  // dørene fra bassenget til bad og treningsrom er svart glass; nordveggen
  // tegnes på nytt uten stumpen ut mot teknisk rom som aldri ble bygget
  /Kinolerret/i,
  /28IhcQfGr6qxmbTpt/, /0L3Y8bLTj6MQqLSZDbzr/, /0yzDU1kgrFmgPaLW/,
  /3VXswughn4YfrWXMB/, /IfcDoor\|.*3QyoxqihLDShTF5w2/,
  /3_Vhh1clf63R9voNqw5rKb/
];

/** Områder der alt fra BIM skjules (elementets midtpunkt), per etasje. */
export const HIDDEN_BIM_AREAS = [
  // Teknisk rom vest for kinoen ble aldri bygget
  { floorId: 'basement', rect: [-15.4, -4.4, -12.9, 1.05] }
];

export function hiddenBimArea(floorId, x, z) {
  return HIDDEN_BIM_AREAS.some(a => a.floorId === floorId && x > a.rect[0] && x < a.rect[2] && z > a.rect[1] && z < a.rect[3]);
}

const WALL = '#d9d6cf', BLACK_GLASS = '#141517';
/**
 * Bygningsdeler som tegnes i stedet for skjulte BIM-elementer (ikke knyttet til ett rom).
 * Bokser { at: [x0, z0, x1, z1], y0, y1 }; `glass` gir gjennomsiktig glass.
 */
export const STRUCTURE = {
  basement: [
    // Nordveggen (med åpning for vinduet i kjellerstua) og kinoens vestvegg med TV-en
    { at: [-12.98, -4.27, 3.69, -3.86], y0: 0, y1: 2.81, color: WALL },
    { at: [5.1, -4.27, 5.46, -3.86], y0: 0, y1: 2.81, color: WALL },
    { at: [3.69, -4.27, 5.1, -3.86], y0: 2.41, y1: 2.81, color: WALL },
    { at: [-12.98, -3.86, -12.86, 0.36], y0: 0, y1: 2.8, color: WALL },
    // Bassengets østvegg: murt ved Tek (med dør), glass hele veien langs badstua
    { at: [-5.05, 0.56, -4.93, 0.64], y0: 0, y1: 2.8, color: WALL },
    { at: [-5.05, 1.45, -4.93, 1.63], y0: 0, y1: 2.8, color: WALL },
    { at: [-5.05, 0.64, -4.93, 1.45], y0: 2.12, y1: 2.8, color: WALL },
    { at: [-5.0, 0.64, -4.97, 1.45], y0: 0, y1: 2.12, color: '#efefec' },
    { at: [-5.0, 1.63, -4.97, 4.82], y0: 0, y1: 2.8, glass: true },
    { at: [-5.02, 1.63, -4.95, 4.82], y0: 2.74, y1: 2.8, color: '#1b1b1b' },
    { at: [-5.02, 2.2, -4.95, 2.24], y0: 0, y1: 2.8, color: '#1b1b1b' },
    { at: [-5.02, 3.01, -4.95, 3.05], y0: 0, y1: 2.8, color: '#1b1b1b' },
    // Svarte glassdører fra bassenget til badet og til treningsrommet
    { at: [-6.51, 4.96, -5.7, 5.0], y0: 0, y1: 2.12, color: BLACK_GLASS, glass: true, opacity: 0.88 },
    { at: [-10.35, 4.96, -9.54, 5.0], y0: 0, y1: 2.12, color: BLACK_GLASS, glass: true, opacity: 0.88 },
    // Ny skillevegg med dør mellom teknisk rom og treningsrommet
    { at: [-11.25, 5.23, -11.15, 6.1], y0: 0, y1: 2.7, color: WALL },
    { at: [-11.25, 6.95, -11.15, 7.42], y0: 0, y1: 2.7, color: WALL },
    { at: [-11.25, 6.1, -11.15, 6.95], y0: 2.1, y1: 2.7, color: WALL }
  ]
};

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
