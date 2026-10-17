import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeatingRoutes } from '../routes/heating.js';
import { accessControl } from '../lib/auth.js';
import { readFileSync } from 'node:fs';
const request = (method, headers = {}) => ({ method, url: '/', path: '/heating', headers, ip: 'heating-test' });
function response(done) { return { statusCode: 200, status(n) { this.statusCode=n; return this; }, set(){return this;}, json(body){done({status:this.statusCode,body});} }; }
test('unauthenticated heating reads are rejected', () => {
  let denied;
  accessControl(request('GET'), response(r => denied=r), () => assert.fail('must reject'));
  assert.equal(denied.status, 401);
});
test('default route cannot connect and rejects all mutations', async () => {
  const route = createHeatingRoutes();
  const get = await new Promise(resolve => route(request('GET'), response(resolve), () => assert.fail('unhandled')));
  assert.equal(get.body.status,'not_connected'); assert.equal(get.body.executionEnabled,false); assert.equal(get.body.oauthReady,false);
  for (const method of ['POST','PATCH','PUT','DELETE']) {
    const result = await new Promise(resolve => route(request(method), response(resolve), () => assert.fail('unhandled')));
    assert.equal(result.status,405);
  }
});
test('heating router is mounted after existing access control', () => {
  const source=readFileSync(new URL('../index.js',import.meta.url),'utf8');
  assert.ok(source.indexOf("app.use('/api/heating'") > source.indexOf('}, accessControl)'));
});
