import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_FURNISHINGS, furnishedRoomAt, keepsBimElement } from '../../client/src/lib/house3dFurniture.js';

test('utleieleiligheten i U.etg er møblert etter bildene fra 2019', () => {
  for (const id of ['u-kjokken', 'u-stue2', 'u-sov2']) assert.ok(ROOM_FURNISHINGS[id], id);
  // Kjøkken, seng og garderober fra BIM står; TV-en på kjøkkenveggen og den hvite sjeselongen i BIM gjør ikke
  assert.equal(keepsBimElement('u-kjokken', 'basement|IfcFurnishingElement|Kjøkken_Benkskap|33KbQL8_r2whLamE4Lxeli|0'), true);
  assert.equal(keepsBimElement('u-kjokken', 'basement|IfcBuildingElementProxy|Kjøleskap:Kjøleskap:1675847|0$tjMlH71EUxlkNSey$uyh|0'), true);
  assert.equal(keepsBimElement('u-kjokken', 'basement|IfcFurnishingElement|Television-Plasma|0mfGk4XwrEjew8iSqXDFYL|0'), false);
  assert.equal(keepsBimElement('u-stue2', 'basement|IfcFurnishingElement|Innredning_Stue_Sofa_tunge0003|0mfGk4XwrEjew8iSqXDFZi|0'), false);
  assert.equal(keepsBimElement('u-sov2', 'basement|IfcFurnishingElement|Seng_1600x2100|2a_QjNUWn6EfHfSkeW$syh|0'), true);
  const stue = ROOM_FURNISHINGS['u-stue2'].items;
  const sofa = stue.find(i => i.type === 'sofa' && i.back === 'n');
  const tv = stue.find(i => i.type === 'tv');
  assert.ok(sofa.at[1] < tv.at[1], 'sofaen står nord for TV-en og ser mot den');
  assert.equal(furnishedRoomAt('basement', 6.5, 3.8), 'u-stue2');
});

test('hybelen har seng og lite kjøkken etter plantegningen', () => {
  assert.ok(ROOM_FURNISHINGS['u-sov1'].items.some(i => i.type === 'bed'));
  const kitchen = ROOM_FURNISHINGS['u-kjstue'].items;
  assert.ok(kitchen.every(i => i.at[0] < -0.2), 'kjøkkenet står langs vestveggen');
  assert.equal(keepsBimElement('u-kjstue', 'basement|IfcFurnishingElement|3+1+1-SIDESTILT|2BiFOi5Un0bAz7kGGmJFhE|0'), true);
});
