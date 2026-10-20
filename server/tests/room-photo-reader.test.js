import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { photoReader } from '../lib/auth.js';
import { createRoomPhotos } from '../lib/roomPhotos.js';

const KEY = 'k'.repeat(40);
const req = (method, p, token = KEY) => ({ method, path: p, headers: { authorization: `Bearer ${token}` } });

test('lesenøkkel for rombilder gir bare GET på /room-photos', () => {
  assert.equal(photoReader(req('GET', '/room-photos/index'), KEY), true);
  assert.equal(photoReader(req('GET', '/room-photos/images/abc-123'), KEY), true);
  assert.equal(photoReader(req('GET', '/room-photos/rooms/zone_1'), KEY), true);
  assert.equal(photoReader(req('POST', '/room-photos/rooms/zone_1'), KEY), false);
  assert.equal(photoReader(req('PATCH', '/room-photos/images/abc'), KEY), false);
  assert.equal(photoReader(req('GET', '/homey/devices'), KEY), false);
  assert.equal(photoReader(req('GET', '/config/contacts'), KEY), false);
  assert.equal(photoReader(req('GET', '/room-photos/../homey/devices'), KEY), false);
  assert.equal(photoReader(req('GET', '/room-photos/index', 'x'.repeat(40)), KEY), false);
  assert.equal(photoReader({ method: 'GET', path: '/room-photos/index', headers: {} }, KEY), false);
});

test('lesenøkkelen er av når den mangler eller er for kort', () => {
  assert.equal(photoReader(req('GET', '/room-photos/index'), undefined), false);
  assert.equal(photoReader(req('GET', '/room-photos/index', 'kort'), 'kort'), false);
});

test('index grupperer bilder per sone', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'room-photo-index-'));
  try {
    const s = createRoomPhotos(dir);
    const b = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#123456' } }).png().toBuffer();
    await s.upload('zone-a', b, 'image/png');
    await s.upload('zone-a', b, 'image/png');
    await s.upload('zone-b', b, 'image/png');
    const idx = await s.index();
    assert.equal(idx['zone-a'].length, 2);
    assert.equal(idx['zone-b'].length, 1);
    assert.deepEqual(await createRoomPhotos(path.join(dir, 'finnes-ikke')).index(), {});
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
