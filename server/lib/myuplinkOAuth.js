import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { googleAuth } from './googleAuth.js';

const hash = s => createHash('sha256').update(s).digest('base64url');
const COOKIE='__Host-myuplink-login';
const cookieOptions={httpOnly:true,secure:true,sameSite:'lax',path:'/'};
const cookie=req=>{const values=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));return values.length===1?values[0].slice(COOKIE.length+1):'';};
const random = () => randomBytes(32).toString('base64url');
const safeError = (status=400) => Object.assign(new Error('myUplink-tilkoblingen kunne ikke fullføres'), { status });
export function myuplinkConfig(env=process.env) {
  if (env.MYUPLINK_ENABLED !== 'true' || env.DEMO_MODE === 'true') return null;
  try {
    const origin = new URL(env.AUTH_PUBLIC_ORIGIN);
    if (origin.protocol !== 'https:' || origin.origin !== env.AUTH_PUBLIC_ORIGIN || !env.MYUPLINK_CLIENT_ID || !env.MYUPLINK_CLIENT_SECRET || !/^[a-f0-9]{64}$/i.test(env.MYUPLINK_TOKEN_KEY || '') || !path.isAbsolute(env.MYUPLINK_TOKEN_FILE || '')) return null;
    return { origin: origin.origin, redirectUri: `${origin.origin}/auth/myuplink/callback`, clientId: env.MYUPLINK_CLIENT_ID, clientSecret: env.MYUPLINK_CLIENT_SECRET, key: env.MYUPLINK_TOKEN_KEY, file: env.MYUPLINK_TOKEN_FILE, offline: env.MYUPLINK_OFFLINE_ACCESS_APPROVED === 'true', write: env.MYUPLINK_WRITE_APPROVED === 'true' };
  } catch { return null; }
}
// WRITESYSTEM is accepted only when the owner has separately approved write access (MYUPLINK_WRITE_APPROVED).
export function validReadScope(scope, offline=false, write=false) {
  if (typeof scope !== 'string') return false;
  const scopes = scope.trim().split(/\s+/);
  return scopes.includes('READSYSTEM') && scopes.every(s => s === 'READSYSTEM' || (offline && s === 'offline_access') || (write && s === 'WRITESYSTEM')) && new Set(scopes).size === scopes.length;
}
export const hasWriteScope = scope => typeof scope === 'string' && scope.trim().split(/\s+/).includes('WRITESYSTEM');
const requestedScope = cfg => ['READSYSTEM', ...(cfg.write ? ['WRITESYSTEM'] : []), ...(cfg.offline ? ['offline_access'] : [])].join(' ');

// Constructing a store has no filesystem effects. AES-GCM authenticates configuration binding.
export function encryptedTokenStore(cfg) {
  const key=Buffer.from(cfg.key,'hex'), aad=Buffer.from(`myuplink-token-v1\n${cfg.clientId}\n${cfg.redirectUri}`), dir=path.dirname(cfg.file);
  async function privateDir(create=false) {
    if (create) await fs.mkdir(dir,{recursive:true,mode:0o700});
    if (await fs.realpath(dir) !== path.resolve(dir)) throw safeError();
    const stat=await fs.stat(dir); if ((stat.mode & 0o077)!==0) throw safeError();
  }
  return {
    async load() {
      try {
        await privateDir();
        const file=await fs.open(cfg.file,constants.O_RDONLY|constants.O_NOFOLLOW);let body;
        try {const stat=await file.stat();if(!stat.isFile()||(stat.mode&0o077)!==0||stat.size>65536)throw safeError();body=JSON.parse(await file.readFile('utf8'));}finally{await file.close();}
        if(body.version!==1) throw safeError();
        const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(body.iv,'base64'));decipher.setAAD(aad);decipher.setAuthTag(Buffer.from(body.tag,'base64'));
        return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body.data,'base64')),decipher.final()]).toString('utf8'));
      } catch(e) { if(e.code==='ENOENT') return null; throw safeError(503); }
    },
    async save(value) {
      await privateDir(true); const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad);
      const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
      const temporary=path.join(dir,`.tokens-${random()}.tmp`);
      try { const file=await fs.open(temporary,'wx',0o600);try{await file.writeFile(JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}));await file.sync();}finally{await file.close();}await fs.rename(temporary,cfg.file);const directory=await fs.open(dir,'r');try{await directory.sync();}finally{await directory.close();} }
      finally { await fs.unlink(temporary).catch(()=>{}); }
    },
    async clear() { try { await privateDir(); await fs.unlink(cfg.file); } catch(e) { if(e.code!=='ENOENT')throw safeError(503); } }
  };
}

export function createMyUplinkOAuth({config=()=>myuplinkConfig(), session=req=>googleAuth.session(req), csrfValid=(req,s)=>googleAuth.csrfValid(req,s), fetchImpl=fetch, storeFactory=encryptedTokenStore, now=Date.now}={}) {
  let store, storeConfig, pendingRefresh, retryAt=0, epoch=0;
  const attempts=new Map();
  let writes=Promise.resolve();
  function commit(value,expected) {const operation=writes.then(async()=>{if(expected!==epoch)throw safeError();if(value===null)await store.clear();else await store.save(value);epoch++;});writes=operation.catch(()=>{});return operation;}

  const callback=Router();
  function configured() { const cfg=config(); if(!cfg) return null; if(!store || storeConfig!==JSON.stringify(cfg)){store=storeFactory(cfg);storeConfig=JSON.stringify(cfg);} return cfg; }
  function owner(req,write=false) { const s=req.headers.authorization===undefined?session(req):null; if(!s || s.role!=='admin' || !s.sub || !s.csrfToken || (write && !csrfValid(req,s)))throw safeError(403);return s; }
  async function record() { const cfg=configured(); if(!cfg)return null;const r=await store.load();if(!r)return null;if(!validReadScope(r.scope,cfg.offline,cfg.write) || typeof r.accessToken!=='string' || !Number.isFinite(r.expiresAt) || typeof r.owner!=='string')throw safeError(503);return r; }
  async function tokenRequest(cfg, fields, previous) {
    let response;
    try { response=await fetchImpl('https://api.myuplink.com/oauth/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...fields,client_id:cfg.clientId,client_secret:cfg.clientSecret})}); } catch {retryAt=now()+60000;throw safeError(503);}
    let body;try{body=await response.json();}catch{retryAt=now()+60000;throw safeError(503);}
    if(!response.ok) {
      if(response.status===400 && body?.error==='invalid_grant' && previous) throw Object.assign(safeError(503),{invalidGrant:true});
      const raw=response.headers.get('retry-after'); const seconds=Number(raw);const delay=raw && Number.isFinite(seconds)?seconds*1000:Date.parse(raw||'')-now();
      retryAt=now()+Math.max(60000,Number.isFinite(delay)?Math.min(delay,3600000):0);throw safeError(503);
    }
    const scope=typeof body.scope==='string'?body.scope:previous?.scope;
    if(!validReadScope(scope,cfg.offline,cfg.write) || !/^Bearer$/i.test(body.token_type||'') || typeof body.access_token!=='string' || !body.access_token || body.access_token.length>16000 || !Number.isFinite(body.expires_in) || body.expires_in<60 || body.expires_in>86400 || (body.refresh_token!=null && (typeof body.refresh_token!=='string' || body.refresh_token.length>16000)) || (!cfg.offline && body.refresh_token) || (cfg.offline && !body.refresh_token && !previous?.refreshToken))throw safeError();
    retryAt=0;
    return {accessToken:body.access_token,scope,expiresAt:now()+body.expires_in*1000,refreshToken:cfg.offline?(body.refresh_token||previous?.refreshToken||null):null};
  }
  async function accessToken() {
    const cfg=configured(), r=await record();if(!cfg||!r)throw safeError(503);
    if(r.expiresAt>now()+60000)return {accessToken:r.accessToken,scope:r.scope};
    if(!cfg.offline||!r.refreshToken||now()<retryAt)throw safeError(503);
    if(!pendingRefresh) {const started=epoch;pendingRefresh=(async()=>{try{const tokens=await tokenRequest(cfg,{grant_type:'refresh_token',refresh_token:r.refreshToken},r);const next={...r,...tokens};await commit(next,started);return {accessToken:next.accessToken,scope:next.scope};}catch(e){if(e.invalidGrant)await commit(null,started);else retryAt=Math.max(retryAt,now()+60000);throw safeError(503);}})().finally(()=>{pendingRefresh=null;});}
    return pendingRefresh;
  }
  async function status() {
    const cfg=configured();if(!cfg)return {configured:false,connected:false,selected:false,reason:'myUplink er ikke konfigurert. Eier må godkjenne lesetilgang og serveroppsett.'};
    try {const r=await record();return {configured:true,connected:Boolean(r),selected:Boolean(r?.deviceId&&r?.systemId),offline:cfg.offline,writeApproved:cfg.write,writeGranted:Boolean(cfg.write&&hasWriteScope(r?.scope)),reauthorizationRequired:Boolean(r && r.expiresAt<=now()+60000 && (!cfg.offline||!r.refreshToken)),reason:r?'Lesetilgang lagret':'Klar for eierens myUplink-innlogging'};}
    catch{return {configured:true,connected:false,selected:false,reason:'Tokenlageret kan ikke leses. Kontroller serveroppsettet.'};}
  }
  async function start(req,res) {
    const s=owner(req,true), cfg=configured();if(!cfg)throw safeError(503);if(now()<retryAt)throw safeError(429);await record();
    for(const [k,v] of attempts)if(v.expires<=now())attempts.delete(k);
    if(attempts.size>=100)throw safeError(429);
    const binding=hash(s.csrfToken);for(const [k,v]of attempts)if(v.binding===binding)attempts.delete(k);
    const state=random(), verifier=random(), browserBinding=random();res.cookie(COOKIE,browserBinding,{...cookieOptions,maxAge:600000});attempts.set(hash(state),{binding,browserBinding:hash(browserBinding),owner:s.sub,verifier,expires:now()+600000,epoch,config:hash(storeConfig)});
    const url=new URL('https://api.myuplink.com/oauth/authorize');url.search=new URLSearchParams({client_id:cfg.clientId,redirect_uri:cfg.redirectUri,response_type:'code',scope:requestedScope(cfg),state,code_challenge:hash(verifier),code_challenge_method:'S256'});
    return {url:url.href};
  }
  callback.use((_req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});next();});
  callback.get('/callback',async(req,res)=>{
    res.clearCookie(COOKIE,cookieOptions);
    try {
      const s=owner(req),cfg=configured();if(!cfg||typeof req.query.state!=='string'||req.query.state.length>128)throw safeError();
      const key=hash(req.query.state), a=attempts.get(key);attempts.delete(key);
      if(!a||a.expires<=now()||a.binding!==hash(s.csrfToken)||a.browserBinding!==hash(cookie(req))||a.owner!==s.sub||a.epoch!==epoch||a.config!==hash(storeConfig)||req.query.error||typeof req.query.code!=='string'||!req.query.code||req.query.code.length>4096)throw safeError();
      const tokens=await tokenRequest(cfg,{grant_type:'authorization_code',code:req.query.code,redirect_uri:cfg.redirectUri,code_verifier:a.verifier});
      if(a.epoch!==epoch)throw safeError();
      await commit({...tokens,owner:s.sub,deviceId:null,systemId:null},a.epoch);
      res.redirect('/?myuplink=connected');
    }catch{res.redirect('/?myuplink=failed');}
  });
  callback.all('*',(_req,res)=>res.status(405).json({error:'Metoden støttes ikke'}));
  async function systems(req) {
    const s=owner(req),r=await record();if(!r||r.owner!==s.sub)throw safeError(403);const token=await accessToken();const result=[];
    for(let page=1;page<=20;page++) {
      const response=await fetchImpl(`https://api.myuplink.com/v2/systems/me?page=${page}&itemsPerPage=100`,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${token.accessToken}`}});
      if(!response.ok)throw safeError(503);const body=await response.json();if(!Array.isArray(body.systems)||!Number.isInteger(body.numItems)||body.numItems<0)throw safeError(503);
      for(const system of body.systems.filter(s=>s&&typeof s==='object'))for(const device of (Array.isArray(system.devices)?system.devices:[]).filter(d=>d&&typeof d==='object'))if(typeof system.systemId==='string'&&typeof device.id==='string')result.push({systemId:system.systemId,deviceId:device.id,name:typeof device.product?.name==='string'?device.product.name.slice(0,200):device.id});
      if(page*100>=body.numItems)return result;
    }
    throw safeError(503);
  }
  async function select(req) {owner(req,true);const found=(await systems(req)).find(x=>x.systemId===req.body?.systemId&&x.deviceId===req.body?.deviceId);if(!found)throw safeError();const before=epoch,r=await record();if(!r)throw safeError(409);await commit({...r,systemId:found.systemId,deviceId:found.deviceId},before);return {ok:true};}
  async function disconnect(req) {owner(req,true);if(!configured())throw safeError(503);epoch++;attempts.clear();await pendingRefresh?.catch(()=>{});await commit(null,epoch);return {ok:true};}
  return {callback,start,status,accessToken,systems,select,disconnect,record,owner,revision:()=>epoch};
}
export const myuplinkOAuth=createMyUplinkOAuth();
