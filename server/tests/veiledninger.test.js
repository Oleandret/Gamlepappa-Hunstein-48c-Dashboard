import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES, GUIDE_CATEGORIES, searchGuides } from '../../client/src/lib/veiledninger.js';

test('veiledningene er komplette og har kilde', () => {
  assert.ok(GUIDES.length >= 10);
  assert.equal(new Set(GUIDES.map(g => g.id)).size, GUIDES.length);
  for (const g of GUIDES) {
    assert.ok(g.title && g.intro && g.kategori, `${g.id}: mangler tittel, intro eller kategori`);
    assert.ok(g.blocks.length > 0 && g.blocks.every(b => b.title && b.items.length > 0), `${g.id}: tom bolk`);
    assert.ok(g.kilder?.length > 0, `${g.id}: mangler kilde`);
    for (const t of g.tables || []) {
      assert.ok(t.rows.every(r => r.length === t.columns.length), `${g.id}/${t.title}: feil antall kolonner`);
      assert.equal(new Set(t.rows.map(r => r[0])).size, t.rows.length, `${g.id}/${t.title}: like radnavn`);
    }
  }
  assert.deepEqual(GUIDE_CATEGORIES, ['Varme', 'Ventilasjon', 'Basseng', 'Badstu', 'Solskjerming', 'Rom og overflater']);
});

test('søk finner riktige veiledninger', () => {
  assert.equal(searchGuides('').length, GUIDES.length);
  assert.deepEqual(searchGuides('', 'Basseng').map(g => g.id), ['basseng', 'basseng-filter', 'basseng-utstyr', 'avfukter']);
  assert.deepEqual(searchGuides('filtrene F7').map(g => g.id), ['ventilasjon']);
  assert.ok(searchGuides('PH').some(g => g.id === 'basseng'));
  assert.ok(searchGuides('tilbakespyl').some(g => g.id === 'basseng-filter'));
  assert.ok(searchGuides('parkett').some(g => g.id === 'overflater'));   // treff i tabellene
  assert.deepEqual(searchGuides('finnes ikke i huset xyz'), []);
});
