import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../../client/vercel.json', import.meta.url), 'utf8'));
const RAILWAY = 'https://gamlepappa-hunstein-48c-dashboard-production.up.railway.app';

test('Vercel bygger klienten og sender API og innlogging videre til Railway', () => {
  assert.equal(cfg.framework, 'vite');
  assert.equal(cfg.outputDirectory, 'dist');
  const dest = (src) => cfg.rewrites.find(r => r.source === src)?.destination;
  assert.equal(dest('/api/:path*'), `${RAILWAY}/api/:path*`);
  assert.equal(dest('/auth/:path*'), `${RAILWAY}/auth/:path*`);
  // SPA-fallback treffer ikke bygde filer eller 3D-modellen
  const fallback = new RegExp(`^${cfg.rewrites.at(-1).source}$`);
  for (const p of ['/', '/hus', '/innstillinger/rom']) assert.ok(fallback.test(p), p);
  for (const p of ['/assets/index-abc.js', '/models/hunstein48c.glb', '/favicon.svg']) assert.ok(!fallback.test(p), p);
});
