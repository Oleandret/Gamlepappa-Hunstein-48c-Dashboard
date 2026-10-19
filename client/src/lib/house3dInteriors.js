/**
 * Interiør per rom, modellert fra beboernes egne rombilder (Rom → Bilder av rommet).
 * Samme koordinater som house3dModel.js (meter, x → øst, z → sør), y fra ferdig gulv.
 *
 * bounds: innvendige veggflater [x0, z0, x1, z1] (målt mot BIM-veggene).
 * walls: malte veggflater med åpninger for dører/vinduer, per side (n/s/e/w): [fra, til] langs veggen.
 * replaceBimFurniture: skjul generiske BIM-møbler i rommet (erstattes av items).
 * items: møbler; type styrer formen, box = [x0, z0, x1, z1], h = høyde.
 */
export const INTERIORS = {
  // Hovedsoverom (Soverom 3), 1. etasje. Fra 4 bilder lastet opp 19.10.2026.
  'f1-sov3': {
    source: 'Rombilder: hovedsoverom (4 bilder, 19.10.2026)',
    bounds: [0.95, -3.96, 5.12, -0.10],
    wallColor: '#829670',          // salviegrønn
    floor: 'terrazzo',
    replaceBimFurniture: true,
    walls: {
      // Nord: hodegjerdeveggen med skogstapet; vindu øst for senga (BIM: Vindu FK x 3.69–5.10)
      n: [{ from: 0.95, to: 3.69, mural: 'forest' }],
      // Øst: to vinduer (z −3.76 … −1.44) med mørke plisségardiner
      e: [{ from: -3.96, to: -3.76 }, { from: -1.44, to: -0.10 }],
      // Sør: skillevegg mot stua, dør x 1.38–2.28
      s: [{ from: 0.95, to: 1.38 }, { from: 2.28, to: 5.12 }],
      // Vest: dør til bad (z −3.27 … −2.37) og skyvedør (z −1.50 … −0.70)
      w: [{ from: -3.96, to: -3.27 }, { from: -2.37, to: -1.50 }, { from: -0.70, to: -0.10 }]
    },
    blinds: [
      { side: 'n', from: 3.69, to: 5.10 },
      { side: 'e', from: -3.76, to: -1.44 }
    ],
    items: [
      { type: 'rug', box: [1.6, -2.6, 4.2, -0.6], color: '#d8cfbd' },
      { type: 'bed', box: [1.94, -3.94, 3.74, -1.94], head: 'n' },
      { type: 'nightstand', box: [1.40, -3.92, 1.85, -3.50], h: 0.55 },
      { type: 'crib', box: [3.78, -3.92, 4.40, -2.72], h: 0.85 },
      { type: 'massageChair', box: [4.35, -2.75, 5.05, -1.35], facing: 's' },
      { type: 'bench', box: [2.20, -1.92, 3.50, -1.52], h: 0.46 },
      { type: 'sideboard', box: [3.95, -0.55, 5.05, -0.12], h: 0.55 },
      { type: 'tv', side: 's', from: 4.05, to: 4.95, y0: 0.75, y1: 1.30 },
      { type: 'tv', side: 's', from: 2.50, to: 3.95, y0: 0.85, y1: 1.70, on: true }
    ]
  }
};

/** Rektangler der generiske BIM-møbler skal skjules, per etasje-id (fra rom-id-prefiks). */
export function bimFurnitureMasks(rooms) {
  const masks = {};
  for (const room of rooms) {
    const def = INTERIORS[room.id];
    if (!def?.replaceBimFurniture) continue;
    (masks[room.floorId] ||= []).push(def.bounds);
  }
  return masks;
}
