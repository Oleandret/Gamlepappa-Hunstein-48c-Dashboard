import test from 'node:test';
import assert from 'node:assert/strict';
import { changeCandidates, localizePoint, parseBimName } from '../../client/src/lib/house3dChangeTargets.js';
import { worldToPlanPct, planPctToWorld } from '../../client/src/lib/house3dModel.js';

test('klikk i kjøkkenet gir BIM-elementet, møbler, spot, rommet og punktet', () => {
  const c = changeCandidates({ floorId: 'floor1', local: [-3.03, 2.6, 2.46], bimName: 'floor1|IfcWall|Yttervegg 300|2abcDEF|betong' });
  const kinds = c.map(x => x.kind);
  assert.equal(kinds[0], 'bim');
  assert.equal(c[0].globalId, '2abcDEF');
  assert.ok(kinds.includes('fixture'));
  assert.equal(c.find(x => x.kind === 'fixture').elementId, 'f1-kjokken:spot:0');
  assert.equal(c.find(x => x.kind === 'room').roomId, 'f1-kjokken');
  assert.equal(kinds.at(-1), 'point');
  assert.deepEqual(c.at(-1).point, [-3.03, 2.6, 2.46]);
});

test('dør fra BIM blir egen type, og møbler får elementId', () => {
  const c = changeCandidates({ floorId: 'floor1', local: [2.9, 0.4, -2.9], bimName: 'floor1|IfcDoor|Innerdør|3xyz|tre', doorLabel: 'Soverom 3' });
  assert.equal(c[0].kind, 'door');
  assert.equal(c[0].label, 'Soverom 3: Innerdør');
  const bed = c.find(x => x.kind === 'furniture' && x.label.startsWith('Seng'));
  assert.ok(bed, 'senga i soverom 3 skal være med');
  assert.match(bed.elementId, /^f1-sov3:items:\d+$/);
  assert.equal(parseBimName('ugyldig'), null);
});

test('etasjen finnes også når etasjene er spredt og forskjøvet', () => {
  const offsets = { basement: [0, 0, 0], floor1: [2, 3.14 + 1.92, -1], floor2: [4, 5.92 + 3.84, -2] };
  const loc = localizePoint([-3.03 + 2, 3.14 + 1.92 + 0.1, 2.46 - 1], offsets);
  assert.equal(loc.floorId, 'floor1');
  assert.deepEqual(loc.local.map(v => Math.round(v * 100) / 100), [-3.03, 0.1, 2.46]);
});

test('meter → plantegning-prosent er omvendt av prosent → meter', () => {
  const [x, y] = worldToPlanPct('homeFloor1', 1.5, -2.25);
  const [wx, wz] = planPctToWorld('homeFloor1', x, y);
  assert.ok(Math.abs(wx - 1.5) < 1e-9 && Math.abs(wz + 2.25) < 1e-9);
});
