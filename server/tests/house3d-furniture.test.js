import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_FURNISHINGS, furnishedRoomAt, keepsBimElement, wallSegments } from '../../client/src/lib/house3dFurniture.js';
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
  // Ballbanen beholder alt fra BIM; garasjen beholder ingenting
  assert.equal(keepsBimElement('f1-ballbane', 'floor1|IfcFurnishingElement|Grill|x'), true);
  assert.equal(keepsBimElement('f1-garasje', 'floor1|IfcFurnishingElement|Garasjehylle|x'), false);
  // Alle rom i 1. etg har nå egen møblering, U.etg ikke ennå
  const f1 = Object.values(ROOM_FURNISHINGS).filter(f => f.floorId === 'floor1').length;
  assert.equal(f1, 11);
  assert.equal(furnishedRoomAt('basement', -8, 2), null);
});
