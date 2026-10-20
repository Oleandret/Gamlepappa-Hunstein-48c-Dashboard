import test from 'node:test';
import assert from 'node:assert/strict';
import { sunPosition, sunDirection, skyLighting } from '../../client/src/lib/sunPosition.js';

test('sola står i sør ved sann middag på Hundvåg ved sommersolverv', () => {
  // Sann middag på 5.75° Ø ≈ 11:39 UTC
  const { elevation, azimuth } = sunPosition(new Date('2026-06-21T11:39:00Z'));
  assert.ok(Math.abs(elevation - 54.4) < 1, `elevation ${elevation}`);
  assert.ok(Math.abs(azimuth - 180) < 3, `azimuth ${azimuth}`);
});

test('vintersolverv: lav middagssol og mørkt om kvelden', () => {
  assert.ok(Math.abs(sunPosition(new Date('2026-12-21T11:39:00Z')).elevation - 7.6) < 1);
  assert.ok(sunPosition(new Date('2026-12-21T18:00:00Z')).elevation < -10);
});

test('morgensol står i øst; modellen er dreid 35° etter situasjonsplanen', () => {
  const pos = sunPosition(new Date('2026-03-20T07:00:00Z'));
  assert.ok(pos.azimuth > 90 && pos.azimuth < 125, `azimuth ${pos.azimuth}`);
  // Sol i nordøst (55°) skal ligge langs modellens +x-akse
  const [x, , z] = sunDirection({ elevation: 0, azimuth: 55 });
  assert.ok(Math.abs(x - 1) < 1e-9 && Math.abs(z) < 1e-9);
  // Uten dreining: øst = +x
  const [x0] = sunDirection({ elevation: 0, azimuth: 90 }, 0);
  assert.ok(Math.abs(x0 - 1) < 1e-9);
});

test('lysoppsett skiller dag og natt', () => {
  assert.equal(skyLighting(40).isNight, false);
  assert.equal(skyLighting(-20).isNight, true);
  assert.equal(skyLighting(-20).sunIntensity, 0);
});
