import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_FURNISHINGS, furnishedRoomAt, keepsBimElement, hiddenBimElement, wallSegments } from '../../client/src/lib/house3dFurniture.js';
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
  assert.equal(hiddenBimElement('floor1|IfcRailing|Terrasse 1.etg – glassrekkverk sør|x'), true);
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

test('U.etasje fra bildene: kinoen beholder BIM-møblene som stemmer, bassengboden er delt', () => {
  const kino = ROOM_FURNISHINGS['u-kino'];
  for (const name of ['Hjørnesofa hvit (sjeselong)', 'Hvilestol skinn rad 2 #1', 'Kiste (salongbord)', 'Kinolerret (vegg)', 'Minibar – disk m/ bokstavtavle', 'Spilevegg sort/tre (dekor)']) {
    assert.ok(keepsBimElement('u-kino', `basement|IfcFurnishingElement|${name}|x`), name);
  }
  assert.equal(keepsBimElement('u-bad', 'basement|IfcFurnishingElement|Bad Underskap 2 Dør - Servant|x'), false);
  assert.ok(kino.items.some(i => i.type === 'sofa'));
  // Bassenget har vannflate innenfor rommet, og naturstein på veggene
  const basseng = ROOM_FURNISHINGS['u-basseng'];
  assert.ok(basseng.items.some(i => i.type === 'pool'));
  assert.ok(basseng.walls.every(w => w.finish === 'stone'));
  // Skilleveggen i bassengboden har døråpning, solariet står øst for den og teknikken vest
  const bod = ROOM_FURNISHINGS['u-bassbod'].items;
  const wall = bod.filter(i => i.type === 'box' && i.at[0] === -11.25 && i.y0 === 0);
  assert.equal(wall.length, 2);
  assert.ok(wall[0].at[3] < wall[1].at[1], 'døråpning i skilleveggen');
  assert.ok(bod.find(i => i.type === 'sunbed').at[0] > -11.15);
  assert.ok(bod.find(i => i.type === 'treadmill').at[0] > -11.15);
});
