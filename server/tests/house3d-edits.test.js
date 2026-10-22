import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { editKey, applyEdit, resetEdit, sanitizeEdits, movedBox, canRotate } from '../../client/src/lib/house3dEdits.js';
import { changeCandidates } from '../../client/src/lib/house3dChangeTargets.js';

test('nøkler for inventar, lyspunkter og BIM; rom og punkt kan ikke flyttes', () => {
  assert.equal(editKey({ kind: 'furniture', elementId: 'f1-kjokken:items:1' }), 'furniture:f1-kjokken:items:1');
  assert.equal(editKey({ kind: 'fixture', elementId: 'f1-kjokken:spot:0' }), 'fixture:f1-kjokken:spot:0');
  assert.equal(editKey({ kind: 'bim', globalId: '2DzGQc2ujE8fAS1pGiA1$I' }), 'bim:2DzGQc2ujE8fAS1pGiA1$I');
  assert.equal(editKey({ kind: 'room', elementId: 'f1-kjokken' }), null);
  assert.equal(editKey({ kind: 'point' }), null);
  assert.equal(canRotate('furniture:x:items:0'), true);
  assert.equal(canRotate('bim:abc'), false);
});

test('flytting summeres, fjerning og tilbakestilling virker', () => {
  const key = 'furniture:f1-kjokken:items:1';
  let e = applyEdit({}, key, { dx: 0.1, label: 'Sofa' });
  e = applyEdit(e, key, { dx: 0.1, dz: -0.5 });
  assert.deepEqual(e[key], { dx: 0.2, dz: -0.5, rot: 0, removed: false, label: 'Sofa' });
  e = applyEdit(e, key, { removed: true });
  assert.equal(e[key].removed, true);
  assert.equal(e[key].dx, 0.2);
  assert.deepEqual(resetEdit(e, key), {});
  // Tilbake til null flytting = ingen oppføring
  assert.deepEqual(applyEdit(applyEdit({}, key, { dx: 0.1 }), key, { dx: -0.1 }), {});
});

test('ugyldige endringer renses bort; BIM og lyspunkter snus ikke', () => {
  const clean = sanitizeEdits({
    'furniture:a:items:0': { dx: 99, dz: 'x', rot: -Math.PI / 2 },
    'bim:abc': { dx: 1, rot: 1 },
    'evil:<script>': { removed: true },
    'fixture:b:spot:0': { removed: 'yes' }
  });
  assert.deepEqual(Object.keys(clean), ['furniture:a:items:0', 'bim:abc']);
  assert.equal(clean['furniture:a:items:0'].dx, 6);
  assert.equal(clean['furniture:a:items:0'].dz, 0);
  assert.ok(Math.abs(clean['furniture:a:items:0'].rot - 3 * Math.PI / 2) < 1e-3);
  assert.equal(clean['bim:abc'].rot, 0);
});

test('flyttet og snudd boks, og klikk finner møbelet der det står nå', () => {
  assert.deepEqual(movedBox([0, 0, 2, 1], { dx: 1, dz: 0, rot: 0 }), [1, 0, 3, 1]);
  assert.deepEqual(movedBox([0, 0, 2, 1], { dx: 0, dz: 0, rot: Math.PI / 2 }), [0.5, -0.5, 1.5, 1.5]);
  // Spisebordet i kjøkkenet (items:10) flyttes 3 m øst: klikk på ny plass finner det, gammel plass ikke
  const key = 'furniture:f1-kjokken:items:10';
  const edits = { [key]: { dx: 3, dz: 0, rot: 0, removed: false } };
  const at = (x, z, e) => changeCandidates({ floorId: 'floor1', local: [x, 0.1, z], edits: e }).filter(c => c.kind === 'furniture').map(c => c.elementId);
  assert.ok(at(-3.5, 3.8, {}).includes('f1-kjokken:items:10'));
  assert.ok(!at(-3.5, 3.8, edits).includes('f1-kjokken:items:10'));
  assert.ok(at(-0.5, 3.8, edits).includes('f1-kjokken:items:10'));
  // Fjernet møbel kan ikke velges
  assert.ok(!at(-3.5, 3.8, { [key]: { dx: 0, dz: 0, rot: 0, removed: true } }).includes('f1-kjokken:items:10'));
});

test('endringene kan lagres i config-store', () => {
  const s = readFileSync(new URL('../routes/config.js', import.meta.url), 'utf8');
  assert.match(s, /'house3dEdits'/);
});
