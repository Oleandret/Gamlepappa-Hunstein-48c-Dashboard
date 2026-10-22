import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_FURNISHINGS, STRUCTURE, furnishedRoomAt, keepsBimElement, hiddenBimElement, hiddenBimArea, wallSegments } from '../../client/src/lib/house3dFurniture.js';
import { ALL_ROOMS, roomPoly } from '../../client/src/lib/house3dModel.js';

test('møblering fra bilder ligger inne i riktig rom', () => {
  for (const [roomId, f] of Object.entries(ROOM_FURNISHINGS)) {
    const room = ALL_ROOMS.find(r => r.id === roomId);
    assert.ok(room, `ukjent rom ${roomId}`);
    assert.equal(room.floorId, f.floorId);
    const xs = roomPoly(room).map(p => p[0]), zs = roomPoly(room).map(p => p[1]);
    const [bx0, bz0, bx1, bz1] = f.bounds;
    assert.ok(bx0 >= Math.min(...xs) - 0.1 && bx1 <= Math.max(...xs) + 0.1 && bz0 >= Math.min(...zs) - 0.1 && bz1 <= Math.max(...zs) + 0.1, `${roomId}: bounds utenfor rommet`);
    for (const it of f.items) {
      const [x0, z0, x1, z1] = it.at;
      assert.ok(x0 < x1 && z0 < z1, `${roomId}/${it.type}: ugyldig boks`);
      assert.ok(x0 >= bx0 - 1e-9 && x1 <= bx1 + 1e-9 && z0 >= bz0 - 1e-9 && z1 <= bz1 + 1e-9, `${roomId}/${it.type} står utenfor rommet`);
    }
  }
});

test('veggflatene har åpninger der dørene står', () => {
  const f = ROOM_FURNISHINGS['f1-sov3'];
  const west = f.walls.find(w => w.side === 'west');
  assert.deepEqual(wallSegments(west, f.doors), [[-3.97, -3.27], [-2.37, -1.5], [-0.7, -0.09]]);
  const south = f.walls.find(w => w.side === 'south');
  assert.deepEqual(wallSegments(south, f.doors), [[0.94, 1.38], [2.28, 5.3]]);
  assert.deepEqual(wallSegments({ side: 'north', from: 0, to: 1 }, f.doors), [[0, 1]]);
  assert.equal(f.doors.length, 3);
});

test('Soverom 3 skjuler arkitektens møbler bare inne i rommet', () => {
  assert.equal(furnishedRoomAt('floor1', 2.8, -3.0), 'f1-sov3');   // BIM-sengen
  assert.equal(furnishedRoomAt('floor1', 4.6, -0.6), 'f1-sov3');   // BIM-skrivebordet
  assert.equal(furnishedRoomAt('floor1', 2.0, 2.0), 'f1-kjokken');
  assert.equal(furnishedRoomAt('floor2', 2.8, -3.0), null);        // annen etasje
});

test('rom i 1. etg skjuler feil BIM-møbler, men beholder de som stemmer', () => {
  // Arkitektens sofa og spisebord i stua byttes ut; kjøkkenet beholdes
  assert.equal(furnishedRoomAt('floor1', 4.2, 3.8), 'f1-kjokken');
  assert.equal(keepsBimElement('f1-kjokken', 'floor1|IfcFurnishingElement|Sofa 3 + 1 + 1 + Bord|x'), false);
  assert.equal(keepsBimElement('f1-kjokken', 'floor1|IfcFurnishingElement|Spisebord 6|x'), false);
  assert.equal(keepsBimElement('f1-kjokken', 'floor1|IfcFurnishingElement|Kjøkkenøy – underskap (mørk eik)|x'), true);
  assert.equal(keepsBimElement('f1-kjokken', 'floor1|IfcFurnishingElement|Kjøkken Benkskap|x'), true);
  // Feilplasserte BIM-møbler på ballbanen og i garasjen beholdes ikke
  assert.equal(keepsBimElement('f1-ballbane', 'floor1|IfcFurnishingElement|Grill|x'), false);
  assert.equal(keepsBimElement('f1-garasje', 'floor1|IfcFurnishingElement|Garasjehylle|x'), false);
  // Alle rom i 1. etg (inkl. uteplassen med glasstak) har egen møblering
  const f1 = Object.values(ROOM_FURNISHINGS).filter(f => f.floorId === 'floor1').length;
  assert.equal(f1, 12);
  assert.equal(furnishedRoomAt('basement', -8, 2), 'u-basseng');
  assert.equal(furnishedRoomAt('basement', -9, -2), 'u-kino');
  assert.equal(furnishedRoomAt('floor2', -8, 2), null);
});

test('pergola med glasstak og sørrekkverket fra BIM tegnes på nytt ved kjøkkenet', () => {
  assert.equal(hiddenBimElement('floor1|IfcPlate|Pergola – glasstak (herdet glass)|x'), true);
  assert.equal(hiddenBimElement('floor1|IfcColumn|Pergola – stolpe #1|x'), true);
  // Nodenavn slik GLTFLoader gir dem (mellomrom → _, punktum fjernet)
  assert.equal(hiddenBimElement('floor1|IfcRailing|Terrasse_1etg_–_glassrekkverk_sør|1kj5eO39H0keroGaeYWm$6|0'), true);
  assert.equal(hiddenBimElement('floor2|IfcRailing|Terrasse_øst_–_glassrekkverk_sør|3ttfkU6bvE6OvjNNMxRGjX|0'), false);
  assert.equal(hiddenBimElement('floor1|IfcMember|Ballbane – stolpe 98x98|x'), false);
  const pergola = ROOM_FURNISHINGS['f1-uteplass'].items.find(i => i.type === 'pergola');
  const [x0, , x1] = pergola.at;
  // Skyvedøra fra kjøkkenet mot sør står ved x −2,86 … −0,82
  assert.ok(x0 < -2.86 && x1 > -0.82);
});

test('garasjen har bare to biler, og vaskerommet står mot walk-in-veggen', () => {
  const cars = ROOM_FURNISHINGS['f1-garasje'].items;
  assert.deepEqual(cars.map(c => `${c.type}:${c.model}`), ['car:X', 'car:Y']);
  for (const it of ROOM_FURNISHINGS['f1-vask'].items.filter(i => i.type === 'washer')) {
    assert.ok(it.at[2] >= -1.7, 'vaskemaskinen skal stå mot østveggen (x −1,6)');
  }
  // Walk-in: ingen hyller mot østveggen med døra til soverommet (x 0,6)
  for (const w of ROOM_FURNISHINGS['f1-walkin'].items) {
    const [, z0, x1, z1] = w.at;
    assert.ok(!(x1 > 0.5 && z0 > -1.55 && z1 < -0.45), 'hylle foran skyvedøra');
  }
});

test('møblerte uteområder får ikke generiske glassrekkverk tvers gjennom seg', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../client/src/components/views/House3DView.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('!(room.outdoor && ROOM_FURNISHINGS[room.id]) && walls.map'));
  assert.ok(ROOM_FURNISHINGS['f1-uteplass'] && ROOM_FURNISHINGS['f1-terrasse'] && ROOM_FURNISHINGS['f1-ballbane']);
});

test('etasjene kan spres skrått, og alt i en etasje følger samme forskyvning', async () => {
  const { readFileSync } = await import('node:fs');
  const view = readFileSync(new URL('../../client/src/components/views/House3DView.jsx', import.meta.url), 'utf8');
  const furn = readFileSync(new URL('../../client/src/components/views/House3DFurniture.jsx', import.meta.url), 'utf8');
  // Én kilde til forskyvningen, brukt av BIM, rom, møbler, lys og enhetsmarkører
  assert.match(view, /const SLANT_STEP = \[/);
  assert.match(view, /const floorShift = \(floorId\) =>/);
  for (const use of ['floorShift={floorShift}', 'shift={floorShift(floor.id)}', 'baseX={floorShift(floor.id)[0]}', 'x: l.x + floorShift(l.floorId)[0]', 'floorShift(m.floorId)']) {
    assert.ok(view.includes(use), `mangler ${use}`);
  }
  assert.ok(view.includes('offsetX={sx} offsetY={y - floor.level} offsetZ={sz}'));
  assert.ok(furn.includes('position={[baseX, baseY + FLOOR_TOP, baseZ]}'));
  // Bryteren huskes per enhet
  assert.ok(view.includes("localStorage.setItem('nexora.house3d.slant'"));
});

test('U.etasje fra bildene: TV-vegg og hjørnesofa i kinoen, trapp opp til 1. etg', () => {
  const kino = ROOM_FURNISHINGS['u-kino'];
  for (const name of ['Hvilestol skinn rad 2 #1', 'Kiste (salongbord)', 'AV-rack']) {
    assert.ok(keepsBimElement('u-kino', `basement|IfcFurnishingElement|${name}|x`), name);
  }
  // Arkitektens sofa, lerret og minibar står feil og tegnes på nytt
  for (const name of ['Hjørnesofa hvit (sjeselong)', 'Minibar – bakbenk og glasshyller', 'Spilevegg sort/tre (dekor)']) {
    assert.equal(keepsBimElement('u-kino', `basement|IfcFurnishingElement|${name}|x`), false, name);
  }
  assert.ok(hiddenBimElement('basement|IfcFurnishingElement|Kinolerret (vegg)|x'));
  const tv = kino.items.find(i => i.type === 'tv');
  assert.equal(tv.screenTo, 'e');
  assert.ok(tv.at[0] <= -12.8, 'TV-en henger på vestveggen');
  // Hjørnesofaen står i hjørnet mellom TV-veggen og nordveggen
  const sofas = kino.items.filter(i => i.type === 'sofa' && i.color === '#efece6');
  assert.ok(sofas.every(s => s.at[0] <= -12.8) && sofas.some(s => s.at[1] <= -3.85));
  // Trappa: tolv trinn i trapperommet mellom kinoen og soverommet, opp til 1. etg
  const stairs = kino.items.find(i => i.type === 'stairs');
  assert.equal(stairs.rise, 3.14);
  assert.equal(stairs.steps.length, 12);
  for (const [x0, z0, x1, z1] of stairs.steps) assert.ok(x0 >= -7.35 && x1 <= -5.25 && z0 >= -3.9 && z1 <= -2.35);
  assert.equal(furnishedRoomAt('basement', -9, -2), 'u-kino');
  assert.equal(keepsBimElement('u-bad', 'basement|IfcFurnishingElement|Bad Underskap 2 Dør - Servant|x'), false);
});

test('U.etasje: teknisk rom bak kinoen finnes ikke, glass mot badstua og svarte glassdører', () => {
  // Alt fra BIM i det ubygde tekniske rommet skjules (varmepumpe, vegger)
  assert.ok(hiddenBimArea('basement', -14.1, -3.3));
  assert.ok(hiddenBimArea('basement', -14.7, -1.6));
  assert.equal(hiddenBimArea('basement', -12.56, -0.05), false, 'AV-racket i kinoen står');
  assert.equal(hiddenBimArea('floor1', -14.1, -3.3), false);
  assert.equal(ALL_ROOMS.find(r => r.id === 'u-tekrom').rect[1], 5.3, 'teknisk rom ligger i bassengboden');
  // Kinoens vestvegg finnes som egen bygningsdel
  const parts = STRUCTURE.basement;
  assert.ok(parts.some(p => p.at[0] === -12.98 && p.at[2] === -12.86 && p.at[3] >= 0.2));
  // Hele veggen mellom basseng og badstu er glass
  assert.ok(hiddenBimElement('basement|IfcWallStandardCase|Basic Wall|28IhcQfGr6qxmbTptu_2'));
  const glass = parts.find(p => p.glass && p.at[0] === -5.0);
  assert.ok(glass.at[1] <= 1.63 && glass.at[3] >= 4.8);
  assert.ok(ROOM_FURNISHINGS['u-basseng'].walls.every(w => !(w.side === 'east' && w.to > 1.63)));
  // Svarte glassdører fra bassenget til badet og treningsrommet erstatter BIM-dørene
  assert.ok(hiddenBimElement('basement|IfcDoor|Innerdør Slett (Diplomat)|3QyoxqihLDShTF5w2|0'));
  assert.equal(hiddenBimElement('basement|IfcWallStandardCase|Basic Wall|3QyoxqihLDShTF5w2aRD'), false);
  const black = parts.filter(p => p.glass && p.opacity > 0.5);
  assert.deepEqual(black.map(p => p.at[0]).sort((a, b) => a - b), [-10.35, -6.51]);
  // Lite treningsrom vegg i vegg med teknisk rom, skilleveggen har døråpning
  assert.ok(ROOM_FURNISHINGS['u-bassbod'].items.some(i => i.type === 'sunbed'));
  assert.ok(ROOM_FURNISHINGS['u-tekrom'].bounds[2] <= ROOM_FURNISHINGS['u-bassbod'].bounds[0]);
  const wall = parts.filter(p => p.at[0] === -11.25 && p.y0 === 0);
  assert.equal(wall.length, 2);
  assert.ok(wall[0].at[3] < wall[1].at[1], 'døråpning i skilleveggen');
});

test('endringsønsker 22.10.2026 er gjort i modellen', () => {
  const items = id => ROOM_FURNISHINGS[id].items;
  // Skjult fra BIM: terrassevarmer, markise, trappa med rekkverk på takterrassen, trappa sør for uteplassen, veggen i sluse
  for (const name of [
    'floor2|IfcBuildingElementProxy|Terrassevarmer|2DzGQc2ujE8fAS1pGiA1$I|0',
    'floor2|IfcBuildingElementProxy|Markise_(motorisert)|31UXbzxoDBTebqYG3PqbkR|0',
    'floor2|IfcStairFlight|Assembled_Stair|17f930AKz8uwxTR9XcYaOM|0',
    'floor2|IfcMember|Assembled_Stair|17f930AKz8uwxTR9XcYaOw|0',
    'basement|IfcStairFlight|Cast-In-Place_Stair|1UbdneFcj9Vga6TPPXISX9|0',
    'floor1|IfcWallStandardCase|Basic_Wall|1hpf7cvIzBUutLyEBy3uZO|0'
  ]) assert.equal(hiddenBimElement(name), true, name);
  // Trappa opp til takterrassen fra bakken (nord for garasjen) finnes og står
  assert.equal(hiddenBimElement('floor1|IfcStairFlight|Assembled_Stair|0Eyvp8hPnDHhm0IGWdcI2R|0'), false);
  // Selve dekket i 1. etg skjules ikke
  assert.equal(hiddenBimElement('floor1|IfcSlab|Floor|0Thnxxox56gfKzaDcDaJtj|0'), false);
  // Sittesekken er borte; badstua har tre lenestoler mot bassenget (vest)
  assert.ok(!items('u-basseng').some(i => i.type === 'beanbag'));
  const chairs = items('u-badstu').filter(i => i.type === 'armchair');
  assert.equal(chairs.length, 3);
  assert.ok(chairs.every(c => c.back === 'e'));
  assert.equal(furnishedRoomAt('basement', -3, 2.2), 'u-badstu');
  // Kino: én mørk sofa, i hjørnet ved trappa og ikke ved glassveggen (z ≈ 0,2); ingen bar under trappa
  const sofas = items('u-kino').filter(i => i.type === 'sofa' && i.color === '#4a4846');
  assert.equal(sofas.length, 1);
  assert.ok(sofas[0].at[3] < -0.4 && sofas[0].at[1] >= -2.4);
  assert.equal(items('u-kino').find(i => i.type === 'stairs').solid, true);
  // Gang: ingen hyller på vestveggen
  assert.ok(!items('f1-gang').some(i => i.at[0] < -6.5));
  // Sluse: døra fra entréen er fri for hyller
  assert.ok(items('f1-sluse').every(i => i.at[0] < -6.9 || i.at[1] >= 0.9 || i.at[3] <= 0));
  // Solsengene står på tvers i sørøsthjørnet av ballbanen
  const loungers = items('f1-ballbane').filter(i => i.type === 'lounger');
  assert.equal(loungers.length, 2);
  assert.ok(loungers.every(l => l.head === 'e' && l.at[1] > 5 && l.at[0] > -8.5));
  // Uteplassen og glasstaket går helt ut til ballbanens sørkant
  assert.deepEqual(ROOM_FURNISHINGS['f1-uteplass'].bounds, [-4.9, 5.1, 2.0, 10.25]);
  assert.ok(items('f1-uteplass').find(i => i.type === 'pergola').at[3] > 10);
});
