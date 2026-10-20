import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_FURNISHINGS, furnishedRoomAt } from '../../client/src/lib/house3dFurniture.js';
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

test('Soverom 3 skjuler arkitektens møbler bare inne i rommet', () => {
  assert.equal(furnishedRoomAt('floor1', 2.8, -3.0), 'f1-sov3');   // BIM-sengen
  assert.equal(furnishedRoomAt('floor1', 4.6, -0.6), 'f1-sov3');   // BIM-skrivebordet
  assert.equal(furnishedRoomAt('floor1', 2.0, 2.0), null);         // kjøkken/stue
  assert.equal(furnishedRoomAt('floor2', 2.8, -3.0), null);        // annen etasje
});
