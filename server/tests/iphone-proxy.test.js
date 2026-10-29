import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {createIphoneProxy,rewriteHtml,upstreamPath,makeTicket,validTicket,iphoneConfigured} from '../lib/iphoneProxy.js';
const env={IPHONE_REMOTE_URL:'https://remote.example',IPHONE_REMOTE_USER:'ole',IPHONE_REMOTE_PASSWORD:'hemmelig'};
function fakeUpstream(){const calls=[];let valid='s=1',expireNext=false;const fetchImpl=async(url,o={})=>{const u=new URL(url);calls.push({path:u.pathname+u.search,method:o.method||'GET',cookie:o.headers?.cookie,body:o.body});
 if(u.pathname==='/login'){const b=JSON.parse(o.body);if(b.password!=='hemmelig')return new Response('{}',{status:401});valid=`s=${calls.length}`;return new Response('{}',{status:200,headers:{'set-cookie':`${valid}; Path=/; HttpOnly`}});}
 if(o.headers?.cookie!==valid||expireNext){expireNext=false;return new Response('{"error":"login"}',{status:401,headers:{'content-type':'application/json'}});}
 if(u.pathname==='/')return new Response('<script>fetch("/api/me");img.src="/api/stream?t=1";api(\'/login\',{});api("/logout",{});</script>',{headers:{'content-type':'text/html'}});
 return new Response(JSON.stringify({ok:true,path:u.pathname,body:o.body??null}),{headers:{'content-type':'application/json'}});};
 return {fetchImpl,calls,expire:()=>{expireNext=true;}};}
async function serve(role='admin',up=fakeUpstream()){const {sessionRoute,proxy}=createIphoneProxy({env,fetchImpl:up.fetchImpl,isProd:false});const app=express();app.use(express.json());app.use('/api',(req,_res,next)=>{req.user={role};next();});app.use('/api/iphone',sessionRoute);app.use('/iphone',proxy);const srv=app.listen(0);await new Promise(r=>srv.once('listening',r));return {base:`http://127.0.0.1:${srv.address().port}`,close:()=>srv.close(),up};}
const ticketCookie=async base=>{const r=await fetch(`${base}/api/iphone/session`,{method:'POST'});const c=r.headers.get('set-cookie');assert.match(c,/gp_iphone=.*HttpOnly.*SameSite=Strict/i);assert.match(c,/Path=\/iphone/);return c.split(';')[0];};

test('helpers: path allowlist, html rewrite, tickets, config',()=>{
 assert.equal(upstreamPath('/'),'/');assert.equal(upstreamPath('/api/tap'),'/api/tap');assert.equal(upstreamPath('/mcp'),null);assert.equal(upstreamPath('/../etc'),null);
 assert.equal(upstreamPath('/mac.html'),'/mac.html');assert.equal(upstreamPath('/api/mac/stream'),'/api/mac/stream');assert.equal(upstreamPath('/mac/mcp'),null);
 assert.equal(rewriteHtml('<a href="/mac.html">Mac</a><a href="/">iPhone</a>'),'<a href="/iphone/mac.html">Mac</a><a href="/iphone/">iPhone</a>');
 assert.equal(rewriteHtml('fetch("/api/x");src=\'/login\';`/logout`; "/mcp"'),'fetch("/iphone/api/x");src=\'/iphone/login\';`/iphone/logout`; "/mcp"');
 const n=Date.parse('2026-10-28T12:00:00Z'),t=makeTicket(n);assert.ok(validTicket(t,n+1));assert.ok(!validTicket(t,n+13*3600000));assert.ok(!validTicket(t.replace(/.$/,'x'),n+1));assert.ok(!validTicket('',1));
 assert.ok(iphoneConfigured(env));assert.ok(!iphoneConfigured({...env,IPHONE_REMOTE_URL:'http://x'}));assert.ok(!iphoneConfigured({}));
});

test('only admins get a ticket; without ticket the proxy refuses and never calls upstream',async()=>{
 const s=await serve('viewer');try{assert.equal((await fetch(`${s.base}/api/iphone/session`,{method:'POST'})).status,403);const r=await fetch(`${s.base}/iphone/`);assert.equal(r.status,401);assert.equal(r.headers.get('x-frame-options'),'SAMEORIGIN');assert.equal(s.up.calls.length,0);}finally{s.close();}
});

test('proxy logs in server-side, rewrites the page, forwards API calls and re-logs in on 401',async()=>{
 const s=await serve();try{const cookie=await ticketCookie(s.base);
  const page=await fetch(`${s.base}/iphone/`,{headers:{cookie}});assert.equal(page.status,200);const html=await page.text();
  assert.ok(html.includes('"/iphone/api/me"')&&html.includes('"/iphone/api/stream?t=1"')&&html.includes("'/iphone/login'"));
  assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'self'/);
  assert.equal(s.up.calls[0].path,'/login');assert.ok(!JSON.stringify(await (await fetch(`${s.base}/iphone/`,{headers:{cookie}})).text()).includes('hemmelig'));
  const tap=await (await fetch(`${s.base}/iphone/api/tap`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({x:10,y:20})})).json();assert.deepEqual(tap,{ok:true,path:'/api/tap',body:'{"x":10,"y":20}'});
  s.up.expire();const again=await fetch(`${s.base}/iphone/api/status`,{headers:{cookie}});assert.equal(again.status,200);assert.equal(s.up.calls.filter(c=>c.path==='/login').length,2);
  const before=s.up.calls.length;assert.deepEqual(await (await fetch(`${s.base}/iphone/logout`,{method:'POST',headers:{cookie}})).json(),{ok:true});assert.equal(s.up.calls.length,before);
  assert.equal((await fetch(`${s.base}/iphone/mcp`,{headers:{cookie}})).status,404);
 }finally{s.close();}
});

test('dashboard pages may frame same-origin /iphone/ but can never be framed themselves',async()=>{
 const {readFileSync}=await import('node:fs');
 const csp=readFileSync(new URL('../index.js',import.meta.url),'utf8').match(/'Content-Security-Policy':"([^"]+)"/)[1];
 const frameSrc=csp.split(';').map(s=>s.trim()).find(s=>s.startsWith('frame-src'));
 assert.ok(frameSrc.split(/\s+/).includes("'self'"),frameSrc);
 assert.match(csp,/frame-ancestors 'none'/);
});
