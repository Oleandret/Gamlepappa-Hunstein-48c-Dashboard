/**
 * 3D-modell av Hunstein 48c, målt opp fra arkitekttegningene (STAV AS,
 * endringssøknad 08.10.2018, tegn. 756-001…006, målestokk 1:100).
 *
 * Koordinatsystem (meter):
 *   x → øst (høyre på plantegningen), z → sør (ned på plantegningen),
 *   y → opp. Origo = kryssingen mellom snittlinje A og snittlinje B,
 *   som er felles for alle etasjene — derfor ligger etasjene riktig
 *   over hverandre.
 *
 * Kotehøyder fra snitt A: U.etg +5.00, 1. etg +8.14, 2. etg +10.92,
 * tak +13.76. Her er U.etg satt til y = 0.
 *
 * Bygningskroppen tegnes fra BIM-modellen (public/models/hunstein48c.glb,
 * eksportert fra «som bygget»-IFC i samme koordinatsystem). Rommene her
 * brukes til klikk, overlegg og kobling mot Homey-soner.
 *
 * Rom er rektangler [x0, z0, x1, z1] eller polygoner (poly: [[x,z],…]).
 * `match` brukes for å koble rommet automatisk mot Homey-soner ved navn.
 */

export const FLOORS = [
  {
    id: 'basement',
    label: 'U.etasje',
    short: 'U',
    level: 0,
    height: 2.8,
    planId: 'homeBasement',
    rooms: [
      { id: 'u-kino',      name: 'Kino',           rect: [-12.8, -3.9, -5.0, 0.2],    match: /kino/i, kind: 'living' },
      { id: 'u-basseng',   name: 'Svømmebasseng',  rect: [-12.8, 0.27, -5.05, 4.85],  match: /basseng$|sv.mme/i, kind: 'pool' },
      { id: 'u-sov1',      name: 'Soverom 1',      rect: [-5.0, -3.9, -0.9, -1.75],   match: /soverom 1|hybel/i, kind: 'bed' },
      { id: 'u-gang',      name: 'Gang U.etg',     rect: [-5.0, -1.75, -1.7, 0.3],    match: /gang u|kjellergang|^kjeller$/i, kind: 'hall' },
      { id: 'u-kjstue',    name: 'Kjellerstue',    rect: [-0.9, -3.9, 5.6, -0.75],    match: /kjellerstue|tv-?stue nede/i, kind: 'living' },
      { id: 'u-tek',       name: 'Tek',            rect: [-4.9, 0.36, -3.5, 1.54],    match: /^tek$/i, kind: 'tech' },
      { id: 'u-bad',       name: 'Bad U.etg',      rect: [-3.5, 0.3, -1.7, 1.54],     match: /bad (u|kjeller|nede)/i, kind: 'bath' },
      { id: 'u-badstu',    name: 'Badstu',         rect: [-4.9, 1.63, -1.7, 4.85],    match: /badstu|sauna/i, kind: 'sauna' },
      { id: 'u-bod',       name: 'Bod',            rect: [-1.35, -0.3, 1.7, 1.0],     match: /^bod u/i, kind: 'storage' },
      { id: 'u-sov2',      name: 'Soverom 2',      rect: [-1.35, 1.0, 1.7, 4.9],      match: /soverom 2/i, kind: 'bed' },
      { id: 'u-kjokken',   name: 'Kjøkken/stue U', rect: [1.8, -0.3, 8.3, 2.6],       match: /leilighet|kj.kken u/i, kind: 'living' },
      { id: 'u-bad2',      name: 'Bad leilighet',  rect: [1.8, 2.6, 3.8, 4.9],        match: /bad leil/i, kind: 'bath' },
      { id: 'u-entre',     name: 'Entré U.etg',    rect: [3.9, 2.6, 5.4, 4.9],        match: /entr. u/i, kind: 'hall' },
      { id: 'u-stue2',     name: 'Stue leilighet', rect: [5.4, 2.6, 8.3, 4.9],        match: /stue leil/i, kind: 'living' },
      // Teknisk rom vest for kinoen ble aldri bygget; bassengboden er delt i teknisk rom og treningsrom
      { id: 'u-tekrom',    name: 'Teknisk rom',    rect: [-14.9, 5.3, -11.2, 7.4],    match: /teknisk/i, kind: 'tech' },
      { id: 'u-bassbod',   name: 'Treningsrom',    rect: [-11.2, 5.3, -8.5, 7.4],     match: /trening|bassengbod|basseng bod/i, kind: 'storage' },
      { id: 'u-bassbad',   name: 'Bassengbad',     rect: [-8.3, 5.3, -5.65, 7.4],     match: /bassengbad|bad basseng/i, kind: 'bath' },
      { id: 'u-sportsbod', name: 'Sportsbod',      rect: [-5.15, 5.3, -1.7, 7.7],     match: /sport/i, kind: 'storage' }
    ],
    stairs: [[-7.35, -3.9, -5.25, -2.35]]
  },
  {
    id: 'floor1',
    label: '1. etasje',
    short: '1',
    level: 3.14,
    height: 2.6,
    planId: 'homeFloor1',
    rooms: [
      { id: 'f1-garasje',  name: 'Dobbelgarasje',  rect: [-13.6, -4.05, -8.0, 2.13],  match: /garasje/i, kind: 'garage' },
      { id: 'f1-sluse',    name: 'Bod/sluse',      rect: [-7.95, -0.9, -6.65, 2.13],  match: /sluse/i, kind: 'storage' },
      { id: 'f1-gang',     name: 'Gang',           rect: [-6.6, -2.35, -3.55, -0.05],  match: /^gang$|gang 1/i, kind: 'hall' },
      { id: 'f1-wc',       name: 'WC',             rect: [-5.15, -3.9, -3.55, -2.35], match: /^wc/i, kind: 'bath' },
      { id: 'f1-bad',      name: 'Bad',            rect: [-3.45, -3.9, 0.93, -2.35],  match: /^bad$|bad 1/i, kind: 'bath' },
      { id: 'f1-vask',     name: 'Vaskerom',       rect: [-3.45, -2.1, -1.6, 0.1],    match: /vask/i, kind: 'utility' },
      { id: 'f1-walkin',   name: 'Walk-in/bod',    rect: [-1.5, -2.1, 0.6, 0.1],      match: /walk/i, kind: 'storage' },
      { id: 'f1-sov3',     name: 'Soverom 3',      rect: [0.93, -3.9, 5.5, -0.07],    match: /hovedsoverom|soverom 3/i, kind: 'bed' },
      { id: 'f1-kjokken',  name: 'Kjøkken/stue',   rect: [-4.9, 0.1, 6.2, 5.1],       match: /kj.kken|^stue$|spisestue/i, kind: 'living' },
      {
        // Ballbane på dekket over bassenget (+8,14), med pergola mot huset
        id: 'f1-ballbane', name: 'Ballbane', match: /ballbane|uteomr/i, kind: 'outdoor', outdoor: true,
        poly: [[-18.96, 2.3], [-5.03, 2.3], [-5.03, 10.25], [-19.29, 10.25]]
      },
      {
        // Uteplass med glasstak rett ut fra skyvedøra i kjøkkenet (sør). Større enn
        // på tegningene; målt fra dronebilder 20.10.2026, og går helt ut til
        // ballbanens sørkant (endringsønske 22.10.2026).
        id: 'f1-uteplass', name: 'Uteplass (glasstak)', match: /uteplass|glasstak/i, kind: 'outdoor', outdoor: true,
        poly: [[-4.9, 5.1], [2.0, 5.1], [2.0, 10.25], [-4.9, 10.25]]
      },
      {
        id: 'f1-terrasse', name: 'Terrasse', match: /terr?asse/i, kind: 'outdoor', outdoor: true,
        poly: [[5.9, -0.6], [8.55, -0.6], [8.55, 6.3], [2.0, 6.3], [2.0, 5.1], [6.2, 5.1]]
      }
    ],
    stairs: [[-7.35, -3.9, -5.25, -2.35], [-3.2, 0.2, 0.6, 1.2]]
  },
  {
    id: 'floor2',
    label: '2. etasje',
    short: '2',
    level: 5.92,
    height: 2.5,
    planId: 'homeFloor2',
    rooms: [
      // Innglassingen ble aldri utført – åpen takterrasse over garasjen
      { id: 'f2-vinterhage', name: 'Takterrasse vest',    rect: [-13.7, -2.35, -5.0, 2.27], match: /vinter|loft|takterr/i, kind: 'outdoor', outdoor: true },
      { id: 'f2-sov6',       name: 'Soverom 6 / Vendela', rect: [-4.83, -2.2, -1.47, 0.08], match: /vendela|soverom 6/i, kind: 'bed' },
      { id: 'f2-sov4',       name: 'Soverom 4 / Andrea',  rect: [-1.36, -2.2, 1.6, 0.08],   match: /andrea|soverom 4/i, kind: 'bed' },
      { id: 'f2-gang',       name: 'Gang/trapp',          rect: [-4.83, 0.08, 1.6, 2.1],    match: /gang.*trapp|gang 2/i, kind: 'hall' },
      { id: 'f2-bad',        name: 'Bad 2. etg',          rect: [-4.83, 2.1, -2.54, 5.0],   match: /bad (oppe|2)/i, kind: 'bath' },
      { id: 'f2-sov5',       name: 'Soverom 5 / Ylva / TV-stue', rect: [-2.46, 2.1, 1.2, 5.0], match: /ylva|soverom 5|tv-?stue/i, kind: 'bed' },
      {
        id: 'f2-terrasse', name: 'Terrasse sjøside', match: /sj.side/i, kind: 'outdoor', outdoor: true,
        poly: [[2.3, -2.3], [5.5, -2.3], [6.45, 5.0], [1.2, 5.0]]
      }
    ],
    // Flatt tak over 1. etasje (nord for 2. etasje)
    roofs: [[-5.0, -4.0, 5.5, -2.37]],
    stairs: [[-3.0, 0.15, 0.5, 1.0]]
  }
];

/** Takflate over 2. etasje (+13.76). */
export const ROOF_LEVEL = 8.76;

/** BIM-modell (GLB). Nodenavn: «<gruppe>|<IfcType>|<navn>|<GlobalId>|<mat>», gruppe = basement/floor1/floor2/roof/site. */
export const BIM_MODEL_URL = '/models/hunstein48c.glb';
/** Dørmetadata (hengsel, åpningsbevegelse, navn) – generert fra samme IFC. */
export const DOOR_META_URL = '/models/hunstein48c.doors.json';

/**
 * Transformasjon fra prosent-koordinater på 2D-plantegningene (de eksisterende
 * pinnene) til meter i 3D-modellen: X = ax·x% + bx, Z = az·y% + bz.
 * Registrert med SIFT + RANSAC mellom bildene i client/public og STAV-PDF-en
 * (tegn. 756-001/002/003), gjennomsnittlig restavvik 8–9 mm.
 */
export const PLAN_IMAGE_TRANSFORM = {
  homeBasement: { ax: 0.31318, bx: -18.7957, az: 0.19340, bz: -8.7364 },
  homeFloor1:   { ax: 0.31315, bx: -18.8084, az: 0.15679, bz: -6.7833 },
  homeFloor2:   { ax: 0.25870, bx: -15.8786, az: 0.14637, bz: -9.3003 }
};

export function planPctToWorld(planId, xPct, yPct) {
  const t = PLAN_IMAGE_TRANSFORM[planId];
  if (!t) return null;
  return [t.ax * xPct + t.bx, t.az * yPct + t.bz];
}

/** Omvendt av planPctToWorld: meter i 3D-modellen → prosent på plantegningen. */
export function worldToPlanPct(planId, x, z) {
  const t = PLAN_IMAGE_TRANSFORM[planId];
  if (!t) return null;
  return [(x - t.bx) / t.ax, (z - t.bz) / t.az];
}

/** Polygon-punkter for et rom (rektangel → 4 hjørner). */
const _polyCache = new Map();
export function roomPoly(room) {
  if (room.poly) return room.poly;
  // Cachet per rom-id slik at referansen er stabil (brukes i useMemo-deps)
  let p = _polyCache.get(room.id);
  if (!p) {
    const [x0, z0, x1, z1] = room.rect;
    p = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    _polyCache.set(room.id, p);
  }
  return p;
}

export function roomCenter(room) {
  const pts = roomPoly(room);
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const z = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [x, z];
}

export function roomArea(room) {
  const pts = roomPoly(room);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    a += x0 * z1 - x1 * z0;
  }
  return Math.abs(a) / 2;
}

export const ALL_ROOMS = FLOORS.flatMap(f => f.rooms.map(r => ({ ...r, floorId: f.id })));
