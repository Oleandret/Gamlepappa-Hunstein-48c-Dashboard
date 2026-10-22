import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES, FIXTURES_BY_ROOM, FIXTURES_OUTSIDE_ROOM, fixtureClusters, fixtureSummary } from '../../client/src/lib/house3dFixtures.js';
import { ALL_ROOMS, roomPoly } from '../../client/src/lib/house3dModel.js';

function inside(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

test('lyspunktene fra el-tegningene ligger i rommet de hører til', () => {
  for (const f of FIXTURES) {
    const room = ALL_ROOMS.find(r => r.id === f.roomId);
    assert.ok(room, `ukjent rom ${f.roomId}`);
    if (FIXTURES_OUTSIDE_ROOM.has(f.id)) continue;
    const pts = f.path || [[f.x, f.z]];
    for (const [x, z] of pts) assert.ok(inside(x, z, roomPoly(room)), `${f.id} (${x}, ${z}) ligger utenfor ${room.name}`);
  }
});

test('antall spotter og lampepunkter per rom stemmer med el-tegningene', () => {
  const count = (roomId, kind) => (FIXTURES_BY_ROOM[roomId] || []).filter(f => f.kind === kind).length;
  assert.equal(count('u-kino', 'spot'), 9);
  assert.equal(count('u-basseng', 'spot'), 8);
  assert.equal(count('f1-kjokken', 'spot'), 12);
  assert.equal(count('f1-sov3', 'spot'), 6);
  assert.equal(count('f1-bad', 'spot'), 4);
  assert.equal(count('f1-garasje', 'tube'), 4);
  assert.equal(count('u-badstu', 'strip'), 0);
  assert.equal(count('f2-gang', 'ceiling'), 2);
  assert.equal(FIXTURES.length, 80);
  assert.equal(new Set(FIXTURES.map(f => f.id)).size, FIXTURES.length);
});

test('mange spotter samles i høyst fire punktlys per rom', () => {
  const kitchen = FIXTURES_BY_ROOM['f1-kjokken'];
  const clusters = fixtureClusters(kitchen);
  assert.equal(clusters.length, 4);
  assert.deepEqual(clusters.flatMap(c => c.members).sort((a, b) => a - b), kitchen.map((_, i) => i));
  assert.equal(fixtureClusters(FIXTURES_BY_ROOM['f1-vask']).length, 2);
  assert.equal(fixtureClusters([]).length, 0);
});

test('rompanelet beskriver lyspunktene', () => {
  assert.equal(fixtureSummary('f1-kjokken'), '12 spotter');
  assert.equal(fixtureSummary('f2-bad'), '1 spot · 1 lampepunkt');
  assert.equal(fixtureSummary('f1-garasje'), '4 LED-armaturer');
  assert.equal(fixtureSummary('u-kino-finnes-ikke'), '');
});
