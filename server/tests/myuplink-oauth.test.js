import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createMyUplinkOAuth, encryptedTokenStore, myuplinkConfig, validReadScope} from '../lib/myuplinkOAuth.js';
const cfg={origin:'https://dashboard.test',redirectUri:'https://dashboard.test/auth/myuplink/callback',clientId:'fixture-client',clientSecret:'fixture-secret',key:'ab'.repeat(32),file:'/unused/test.json',offline:true};
const user={role:'admin',sub:'owner-fixture',csrfToken:'session-csrf-fixture'};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers});
const token=(extra={})=>({access_token:'fixture-access',refresh_token:'fixture-refresh',token_type:'Bearer',scope:'READSYSTEM offline_access',expires_in:3600,...extra});
function harness(options={}) {
 let r=null,t=0,network=[],cookie='',stored=0,cleared=0;
 const store={load:async()=>r,save:async v=>{r=structuredClone(v);stored++;},clear:async()=>{r=null;cleared++;}};
 const auth=createMyUplinkOAuth({config:()=>cfg,session:req=>req.identity===undefined?user:req.identity,csrfValid:req=>req.headers['x-csrf-token']===user.csrfToken,storeFactory:()=>store,now:()=>t,fetchImpl:async(url,init)=>{network.push({url,init});return options.respond?options.respond(url,init):json(token());},...options});
 const req=(extra={})=>({headers:{'x-csrf-token':user.csrfToken,origin:cfg.origin,cookie},...extra});
 const res={cookie:(name,value)=>{cookie=`${name}=${value}`;}};
 async function start(){return new URL((await auth.start(req(),res)).url);}
 async function callback(url,extra={}) {return new Promise((resolve,reject)=>{auth.callback({...req(extra),method:'GET',url:'/callback',query:{state:url.searchParams.get('state'),code:'fixture-code',...extra.query}}, {set(){return this;},clearCookie(){},redirect:resolve,status(){return this;},json:resolve},reject);});}
 return {auth,req,start,callback,network,clock:v=>t=v,get record(){return r;},get stored(){return stored;},get cleared(){return cleared;},seed:v=>r=v};
}
test('configuration and scopes fail closed; disabled touches neither storage nor network',async()=>{
 assert.equal(myuplinkConfig({}),null);assert.equal(myuplinkConfig({MYUPLINK_ENABLED:'true'}),null);
 assert.equal(validReadScope('READSYSTEM WRITESYSTEM',true),false);assert.equal(validReadScope('READSYSTEM offline_access'),false);
 const h=harness({config:()=>null,storeFactory:()=>assert.fail('no file access'),fetchImpl:()=>assert.fail('no network')});assert.equal((await h.auth.status()).configured,false);await assert.rejects(()=>h.auth.start(h.req(),{}));
});
test('start requires Google owner session and CSRF, refuses bearer even alongside cookie',async()=>{
 const h=harness();for(const extra of [{identity:null},{identity:{...user,role:'viewer'}},{headers:{}},{headers:{authorization:'Bearer fixture','x-csrf-token':user.csrfToken}}])await assert.rejects(()=>h.auth.start(h.req(extra),{}));assert.equal(h.network.length,0);
});
test('PKCE S256, fixed URLs, one-time state and cookie binding',async()=>{
 const h=harness(),url=await h.start();assert.equal(url.origin+url.pathname,'https://api.myuplink.com/oauth/authorize');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('scope'),'READSYSTEM offline_access');assert.equal(await h.callback(url),'/?myuplink=connected');
 const body=h.network[0].init.body;assert.equal(createHash('sha256').update(body.get('code_verifier')).digest('base64url'),url.searchParams.get('code_challenge'));assert.equal(body.get('redirect_uri'),cfg.redirectUri);assert.equal(h.network[0].url,'https://api.myuplink.com/oauth/token');assert.equal(h.network[0].init.redirect,'error');assert.equal(h.record.owner,user.sub);
 assert.equal(await h.callback(url),'/?myuplink=failed');assert.equal(h.network.length,1);
});
test('wrong session, absent browser cookie, expired state, denial and altered state never exchange',async()=>{
 for(const kind of ['session','cookie','expired','denied','state']){const h=harness(),u=await h.start();let extra={};if(kind==='session')extra.identity={...user,csrfToken:'other'};if(kind==='cookie')extra.headers={};if(kind==='expired')h.clock(600001);if(kind==='denied')extra.query={error:'access_denied'};if(kind==='state')extra.query={state:'wrong'};assert.equal(await h.callback(u,extra),'/?myuplink=failed');assert.equal(h.network.length,0);}
});
test('overbroad/unknown scopes, missing refresh, wrong type and malformed expiry not persisted',async()=>{
 for(const change of [{scope:'READSYSTEM WRITESYSTEM'},{scope:undefined},{refresh_token:undefined},{token_type:'Other'},{expires_in:-2},{access_token:''}]){const h=harness({respond:()=>json(token(change))}),u=await h.start();assert.equal(await h.callback(u),'/?myuplink=failed');assert.equal(h.stored,0);}
});
test('access token is refreshed single-flight and rotated refresh token persisted before return',async()=>{
 let n=0;const h=harness({respond:()=>json(token({access_token:`access-${++n}`,refresh_token:`refresh-${n}`}))});await h.callback(await h.start());h.clock(3550000);const [a,b]=await Promise.all([h.auth.accessToken(),h.auth.accessToken()]);assert.equal(a.accessToken,'access-2');assert.deepEqual(a,b);assert.equal(h.network.length,2);assert.equal(h.record.refreshToken,'refresh-2');assert.equal(h.stored,2);
});
test('400 invalid_grant clears tokens; transient errors preserve and back off',async()=>{
 for(const status of [400,503,429]) {let fail=false;const h=harness({respond:()=>fail?json({error:'invalid_grant'},status,{'retry-after':'180'}):json(token())});await h.callback(await h.start());h.clock(3550000);fail=true;await assert.rejects(()=>h.auth.accessToken());if(status===400){assert.equal(h.record,null);}else{assert.ok(h.record);await assert.rejects(()=>h.auth.accessToken());assert.equal(h.network.length,2);}}
});
test('local disconnect prevents late refresh restoring credentials',async()=>{
 let release;let first=true;const h=harness({respond:()=>first?(first=false,json(token())):new Promise(r=>release=r)});await h.callback(await h.start());h.clock(3550000);const pending=h.auth.accessToken();while(!release)await new Promise(r=>setImmediate(r));const disconnected=h.auth.disconnect(h.req());release(json(token({access_token:'late'})));await assert.rejects(()=>pending);await disconnected;assert.equal(h.record,null);
});
test('no offline permission means no refresh and expired session needs reauthorization',async()=>{
 const h=harness({config:()=>({...cfg,offline:false}),respond:()=>json(token({scope:'READSYSTEM',refresh_token:undefined}))});const u=await h.start();assert.equal(u.searchParams.get('scope'),'READSYSTEM');await h.callback(u);h.clock(3600000);await assert.rejects(()=>h.auth.accessToken());assert.equal((await h.auth.status()).reauthorizationRequired,true);assert.equal(h.network.length,1);
});
test('device selection requires actual account inventory and explicit matching IDs',async()=>{
 const h=harness({respond:url=>url.includes('/systems/me')?json({numItems:1,systems:[{systemId:'system',devices:[{id:'device',product:{name:'NIBE fixture'}}]}]}):json(token())});await h.callback(await h.start());await assert.rejects(()=>h.auth.select(h.req({body:{systemId:'system',deviceId:'unknown'}})));await h.auth.select(h.req({body:{systemId:'system',deviceId:'device'}}));assert.equal(h.record.deviceId,'device');assert.equal((await h.auth.status()).selected,true);
});
test('encrypted store round trip, permissions, tamper and wrong-key rejection',async()=>{
 const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'myuplink-mock-'))),file=path.join(dir,'tokens.json');const store=encryptedTokenStore({...cfg,file});
 try{assert.equal(await store.load(),null);await store.save({accessToken:'sensitive-fixture'});assert.deepEqual(await store.load(),{accessToken:'sensitive-fixture'});assert.equal((await fs.stat(file)).mode&0o777,0o600);assert.ok(!(await fs.readFile(file,'utf8')).includes('sensitive-fixture'));await assert.rejects(()=>encryptedTokenStore({...cfg,file,key:'cd'.repeat(32)}).load());let b=JSON.parse(await fs.readFile(file,'utf8'));b.data='AAAA';await fs.writeFile(file,JSON.stringify(b));await assert.rejects(()=>store.load());await store.clear();assert.equal(await store.load(),null);}finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('provider backoff also blocks a new authorization attempt',async()=>{
 const h=harness({respond:()=>json({error:'temporarily_unavailable'},429,{'retry-after':'120'})});
 await h.callback(await h.start());await assert.rejects(()=>h.start());assert.equal(h.network.length,1);
});
