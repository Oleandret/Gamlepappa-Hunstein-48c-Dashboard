import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function downloadHarness({status=200}={}) {
  const requests=[],events=[],blobs=[],errors=[],loading=[];
  const context=vm.createContext({
    sessionStorage:{getItem:()=> 'synthetic-session-for-test'},
    window:{dispatchEvent:event=>events.push(event.type)},Event,Headers,
    fetch:async (url,options)=>{requests.push({url,options});return {ok:status===200,status,json:async()=>({devices:{fixture:{name:'Test light'}}})};},
    setDownloading:value=>loading.push(value),setError:value=>errors.push(value),
    Blob:class {constructor(parts,options){blobs.push({parts,options});}},
    URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:()=>{}},
    document:{createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}}
  });
  const apiSource=fs.readFileSync(new URL('../../client/src/lib/api.js',import.meta.url),'utf8').replace("import.meta.env.VITE_API_BASE", "''").replace(/^export /gm,'');
  vm.runInContext(apiSource,context);
  const component=fs.readFileSync(new URL('../../client/src/components/DiscoveryPanel.jsx',import.meta.url),'utf8');
  const callback=component.slice(component.indexOf('  async function downloadFull()'),component.indexOf('  async function copySummary()'));
  vm.runInContext(callback+'\nglobalThis.download=downloadFull;',context);
  return {download:context.download,requests,events,blobs,errors,loading};
}
test('full inventory download carries the session token and produces the returned JSON',async()=>{
  const h=downloadHarness();await h.download();
  assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].url,'/api/homey/inventory?full=true');
  assert.equal(h.requests[0].options.headers.get('Authorization'),'Bearer synthetic-session-for-test');
  assert.equal(JSON.parse(h.blobs[0].parts[0]).devices.fixture.name,'Test light');
  assert.deepEqual(h.loading,[true,false]);assert.deepEqual(h.errors,[]);
});
test('expired inventory session triggers login and does not download an error response',async()=>{
  const h=downloadHarness({status:401});await h.download();
  assert.deepEqual(h.events,['dashboard-auth-required']);assert.equal(h.blobs.length,0);
  assert.match(h.errors[0],/401/);assert.deepEqual(h.loading,[true,false]);
});

test('voice indicator describes separate-tab access without claiming an active connection',async()=>{
  const { createRequire }=await import('node:module');
  const requireClient=createRequire(new URL('../../client/package.json',import.meta.url));
  const {transformWithOxc}=await import(requireClient.resolve('vite'));
  const React=requireClient('react');
  const {renderToStaticMarkup}=requireClient('react-dom/server');
  const source=fs.readFileSync(new URL('../../client/src/components/AIConnection.jsx',import.meta.url),'utf8').replace(/^export /gm,'');
  const {code}=await transformWithOxc(source,'AIConnection.jsx',{jsx:{runtime:'classic'}});
  const forbidden=()=>assert.fail('unconfigured voice must not poll or register a call listener');
  const context=vm.createContext({React,setTimeout:forbidden,window:{customElements:{get:forbidden}},document:{addEventListener:forbidden}});
  vm.runInContext(code+'\nglobalThis.Component=AIConnection;',context);
  const html=renderToStaticMarkup(React.createElement(context.Component));
  assert.match(html,/aria-label="Taleassistent åpnes i ny fane"/);
  assert.match(html,/Ny fane/);
  assert.doesNotMatch(html,/tilkobler|online|AI CONNECTION|animate-pulseGlow/i);
});

test('cookie API writes carry CSRF in memory while bearer requests retain their authorization', async () => {
  const requests = [];
  let bearer = null;
  const context = vm.createContext({ Headers, Event, sessionStorage: { getItem: () => bearer }, window: { dispatchEvent() {} }, fetch: async (url, options) => { requests.push({url, options}); return {status: 200}; } });
  const source = fs.readFileSync(new URL('../../client/src/lib/api.js', import.meta.url), 'utf8').replace('import.meta.env.VITE_API_BASE', "''").replace(/^export /gm, '');
  vm.runInContext(source + '\nglobalThis.client = {apiFetch, setCsrfToken};', context);
  context.client.setCsrfToken('fixture-csrf');
  await context.client.apiFetch('/api/config/a', {method: 'PUT', headers: {'Content-Type': 'application/json'}});
  assert.equal(requests[0].options.credentials, 'same-origin');
  assert.equal(requests[0].options.headers.get('X-CSRF-Token'), 'fixture-csrf');
  assert.equal(requests[0].options.headers.get('Content-Type'), 'application/json');
  await context.client.apiFetch('/api/session');
  assert.equal(requests[1].options.headers.has('X-CSRF-Token'), false);
  bearer = 'fixture-bearer';
  await context.client.apiFetch('/api/config/a', {method: 'PUT'});
  assert.equal(requests[2].options.headers.get('Authorization'), 'Bearer fixture-bearer');
  assert.equal(requests[2].options.headers.has('X-CSRF-Token'), false);
  bearer = null; context.client.setCsrfToken('');
  await context.client.apiFetch('/api/logout', {method: 'POST'});
  assert.equal(requests[3].options.headers.has('X-CSRF-Token'), false);
});
