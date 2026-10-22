/**
 * Lyspunkter i Hunstein 48c, hentet fra el-tegningene (el-inst U/1./2. etg,
 * 08.–09.10.2018). Symbolene er funnet automatisk på tegningene og lagt over
 * plantegningene i client/public med SIFT + RANSAC (restavvik < 1 px), så de
 * bruker samme koordinater som house3dModel.js (meter, x → øst, z → sør).
 *
 * Typer:
 *   spot     – downlight/spot i himlingen (lite ⊗ eller fylt prikk på tegningen)
 *   ceiling  – lampepunkt i tak (stort ⊗)
 *   tube     – LED-armatur (lysrør) i taket, `len` meter langs x
 *   strip    – LED-list langs en linje (`path`) i høyde `h` over gulv
 *   outdoor  – utelys/downlight i takutstikket
 *
 * Lyspunktene får lysstyrken til Homey-lampene i rommet: nærmeste lampe med pin
 * hvis rommet har pins, ellers den sterkeste lampen i rommet.
 */

const ROOMS = {
  // ── U.etasje ──
  // Spoten ved [-8.01, -1.99] finnes ikke (endringsønske 22.10.2026)
  'u-kino': { spot: [[-11.71, -3.31], [-9.79, -3.29], [-8.01, -3.29], [-11.73, -1.96], [-9.79, -1.97], [-11.73, -0.42], [-9.81, -0.42], [-8.0, -0.41], [-6.28, -0.4]] },
  'u-basseng': { spot: [[-12.04, 0.8], [-10.21, 0.81], [-8.46, 0.8], [-6.58, 0.81], [-5.59, 3.82], [-12.06, 4.53], [-10.21, 4.54], [-6.58, 4.52]] },
  'u-bassbad': { spot: [[-7.31, 5.65], [-6.02, 6.72], [-7.31, 6.74]], ceiling: [[-7.86, 6.96]] },
  'u-sov1': { ceiling: [[-2.64, -2.27]] },
  'u-gang': { ceiling: [[-3.01, -1.26], [-2.96, -0.1]] },
  'u-tek': { ceiling: [[-4.37, 1.06]] },
  // Badstua har lenestoler, ikke benker, så LED-listene under benkene på
  // el-tegningen er ikke med (endringsønske 22.10.2026)
  'u-kjstue': { ceiling: [[2.07, -2.42]] },
  'u-bod': { ceiling: [[0.17, 0.28]] },
  'u-kjokken': { ceiling: [[3.46, 0.87]] },
  'u-sov2': { ceiling: [[0.22, 3.33]] },
  'u-bad2': { ceiling: [[2.79, 3.79]] },
  'u-entre': { ceiling: [[4.63, 3.79]] },
  'u-sportsbod': { ceiling: [[-3.43, 6.43]] },
  'u-tekrom': { ceiling: [[-11.6, 6.32]] },
  'u-bassbod': { ceiling: [[-8.59, 5.88]] },

  // ── 1. etasje ──
  'f1-kjokken': {
    spot: [
      [-3.03, 2.46], [-1.1, 2.46], [1.0, 2.44],          // over kjøkkenbenken
      [-3.98, 3.47], [-3.02, 3.46],                      // spisekroken mot vest
      [5.34, 0.91], [5.45, 2.0], [5.61, 3.2],            // langs vinduene mot øst
      [2.37, 4.39], [3.53, 4.37], [4.72, 4.4], [5.78, 4.41] // sofakroken mot sør
    ]
  },
  'f1-walkin': { spot: [[-0.68, -0.99], [0.22, -0.99]] },
  'f1-sov3': { spot: [[1.43, -3.4], [2.96, -3.4], [4.63, -3.4], [1.42, -1.09], [2.96, -1.09], [4.64, -1.1]] },
  'f1-bad': { spot: [[-3.11, -3.08], [-1.97, -3.07], [-0.82, -3.08], [0.16, -3.08]] },
  'f1-vask': { spot: [[-2.74, -1.61], [-2.73, -0.51]] },
  'f1-wc': { ceiling: [[-4.34, -2.97]] },
  // Det siste punktet er entréen innenfor hoveddøra (ikke eget rom i modellen)
  'f1-gang': { ceiling: [[-5.72, -1.46], [-4.15, -0.42], [-5.73, 1.07]] },
  'f1-sluse': { ceiling: [[-7.35, 0.19]] },
  'f1-garasje': { tube: [[-12.39, -3.09], [-9.53, -3.09], [-12.39, 0.93], [-9.53, 0.93]] },

  // ── 2. etasje ──
  'f2-sov6': { ceiling: [[-3.26, -0.82]] },
  'f2-sov4': { ceiling: [[0.25, -0.82]] },
  'f2-gang': { ceiling: [[-3.77, 1.16], [1.2, 1.16]] },
  'f2-bad': { spot: [[-4.3, 4.48]], ceiling: [[-3.59, 3.37]] },
  'f2-sov5': { ceiling: [[-0.48, 3.53]] },
  'f2-vinterhage': { outdoor: [[-5.59, -1.28], [-5.39, 1.58]] },
  'f2-terrasse': { outdoor: [[2.81, -1.47], [2.26, 1.24]] }
};

/** Lyspunkter som med vilje ligger utenfor rommets omriss (se kommentar over). */
export const FIXTURES_OUTSIDE_ROOM = new Set(['f1-gang:ceiling:2']);

const TUBE_LENGTH = 1.26;

/** Alle lyspunkter, flatt: { id, roomId, kind, x, z, len?, h?, path? } */
export const FIXTURES = Object.entries(ROOMS).flatMap(([roomId, kinds]) =>
  Object.entries(kinds).flatMap(([kind, list]) => list.map((p, i) => {
    const id = `${roomId}:${kind}:${i}`;
    if (kind === 'strip') {
      const xs = p.path.map(q => q[0]), zs = p.path.map(q => q[1]);
      return { id, roomId, kind, h: p.h, path: p.path, x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
    }
    return { id, roomId, kind, x: p[0], z: p[1], ...(kind === 'tube' ? { len: TUBE_LENGTH } : {}) };
  }))
);

export const FIXTURES_BY_ROOM = FIXTURES.reduce((m, f) => ((m[f.roomId] ||= []).push(f), m), {});

/** Kort beskrivelse til rompanelet, f.eks. «12 spotter». */
export function fixtureSummary(roomId) {
  const list = FIXTURES_BY_ROOM[roomId] || [];
  const n = k => list.filter(f => f.kind === k).length;
  const parts = [];
  if (n('spot')) parts.push(`${n('spot')} ${n('spot') === 1 ? 'spot' : 'spotter'}`);
  if (n('ceiling')) parts.push(`${n('ceiling')} lampepunkt${n('ceiling') === 1 ? '' : 'er'}`);
  if (n('tube')) parts.push(`${n('tube')} LED-armaturer`);
  if (n('strip')) parts.push(`${n('strip')} LED-lister`);
  if (n('outdoor')) parts.push(`${n('outdoor')} utelys`);
  return parts.join(' · ');
}

/**
 * Grupperer et roms lyspunkter i høyst `max` klynger (k-means), slik at et rom
 * med mange spotter lyses opp jevnt uten ett punktlys per spot.
 * Gir [{ x, z, members: [indekser i list] }].
 */
export function fixtureClusters(list, max = 4) {
  const pts = list.map(f => [f.x, f.z]);
  if (pts.length <= max) return pts.map((p, i) => ({ x: p[0], z: p[1], members: [i] }));
  const k = Math.min(max, Math.ceil(pts.length / 3));
  // Start: lengst-fra-hverandre-punkter (deterministisk)
  const cents = [pts[0]];
  while (cents.length < k) {
    let best = null, bd = -1;
    for (const p of pts) {
      const d = Math.min(...cents.map(c => (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2));
      if (d > bd) { bd = d; best = p; }
    }
    cents.push(best);
  }
  let assign = [];
  for (let iter = 0; iter < 10; iter++) {
    assign = pts.map(p => {
      let bi = 0, bd = Infinity;
      cents.forEach((c, i) => { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2; if (d < bd) { bd = d; bi = i; } });
      return bi;
    });
    for (let i = 0; i < k; i++) {
      const mine = pts.filter((_, j) => assign[j] === i);
      if (mine.length) cents[i] = [mine.reduce((s, p) => s + p[0], 0) / mine.length, mine.reduce((s, p) => s + p[1], 0) / mine.length];
    }
  }
  return cents
    .map((c, i) => ({ x: c[0], z: c[1], members: assign.flatMap((a, j) => (a === i ? [j] : [])) }))
    .filter(c => c.members.length > 0);
}
