import { enqueueCommand } from './commandQueue.js';
const READ_TOOLS = new Set(['get_home_structure','search_tools','get_device','get_devices','get_zones','get_flows']);
let sessionId, initialized, toolsCache, initializedPromise;
let nextId = 1;
export function mcpUrl() { return process.env.HOMEY_MCP_URL || ''; }
export function mcpConfigured() { return Boolean(mcpUrl() && process.env.HOMEY_MCP_TOKEN); }
export function getLastRawResponse() { return null; } // Raw responses/session IDs never leave the server.
function endpoint() {
  if (!process.env.HOMEY_MCP_TOKEN) throw new Error('MCP-autentisering er ikke konfigurert');
  const url = new URL(mcpUrl());
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('MCP krever HTTPS uten credentials i URL');
  return url.href;
}
function headers() {
  return { 'Content-Type':'application/json', Accept:'application/json, text/event-stream',
    'MCP-Protocol-Version':'2025-06-18',
    ...(sessionId ? {'Mcp-Session-Id':sessionId} : {}),
    ...(process.env.HOMEY_MCP_TOKEN ? {Authorization:`Bearer ${process.env.HOMEY_MCP_TOKEN}`} : {}) };
}
export async function readRpcResponse(response, id) {
  let buffer='', bytes=0;
  const decoder = new TextDecoder();
  const sse = (response.headers.get('content-type') || '').includes('text/event-stream');
  const reader = response.body.getReader();
  try {
    while (true) {
      const {value,done}=await reader.read();
      if (done) break;
      bytes+=value.byteLength;
      if (bytes>2_000_000) throw new Error('MCP response too large');
      buffer+=decoder.decode(value,{stream:true});
      if (sse) {
        buffer=buffer.replace(/\r\n/g,'\n');
        let end;
        while ((end=buffer.indexOf('\n\n'))>=0) {
          const event=buffer.slice(0,end);buffer=buffer.slice(end+2);
          const data=event.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');
          if (!data) continue;
          const msg=JSON.parse(data);
          if (msg.id === id) return unwrap(msg,id);
        }
      }
    }
    if (sse) throw new Error('MCP stream ended without matching response');
    return unwrap(JSON.parse(buffer),id);
  } finally { await reader.cancel().catch(()=>{}); }
}
function unwrap(msg,id) {
  if (msg.jsonrpc!=='2.0' || msg.id!==id) throw new Error('MCP response ID mismatch');
  if (msg.error) throw new Error(`MCP RPC error ${msg.error.code || ''}`);
  return msg.result;
}
async function rpc(method,params={}) {
  const id=nextId++;
  const response=await fetch(endpoint(),{method:'POST',headers:headers(),body:JSON.stringify({jsonrpc:'2.0',id,method,params}),signal:AbortSignal.timeout(20000),redirect:'error'});
  if (response.status===404) { resetSession(); throw new Error('MCP session expired; request not retried'); }
  if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
  if (method==='initialize') sessionId=response.headers.get('Mcp-Session-Id');
  return readRpcResponse(response,id);
}
async function ensureInitialized() {
  if (initialized) return;
  if (!initializedPromise) initializedPromise=(async()=>{
    await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'dashboard',version:'2.0'}});
    const response=await fetch(endpoint(),{method:'POST',headers:headers(),body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}),signal:AbortSignal.timeout(10000),redirect:'error'});
    if (!response.ok) throw new Error('MCP initialization notification failed');
    await response.body?.cancel(); initialized=true;
  })().finally(()=>{initializedPromise=null;});
  return initializedPromise;
}
function allowed(name) {
  let writes=[];try { writes=JSON.parse(process.env.HOMEY_MCP_ALLOWED_TOOLS_JSON || '[]'); } catch { /* deny */ }
  return READ_TOOLS.has(name) || (Array.isArray(writes) && writes.includes(name));
}
export async function listTools({force=false}={}) {
  if (!mcpConfigured()) return [];
  if (!force && toolsCache && Date.now()-toolsCache.ts<300000) return toolsCache.tools;
  await ensureInitialized();
  const tools=[];let cursor;
  for (let page=0;page<10;page++) {
    const result=await rpc('tools/list',cursor?{cursor}:{});
    tools.push(...(result?.tools || []).filter(t=>allowed(t.name)));
    cursor=result?.nextCursor;if(!cursor) break;
  }
  toolsCache={ts:Date.now(),tools};return tools;
}
export async function callTool(name,args={}) {
  if (process.env.DEMO_MODE==='true') throw new Error('MCP handlinger er av i demo');
  const tools=await listTools();
  const tool=tools.find(t=>t.name===name);
  if (!tool || !allowed(name)) throw new Error('MCP-verktøyet er ikke tillatt');
  if (!args || typeof args!=='object' || Array.isArray(args)) throw new Error('Ugyldige verktøyargumenter');
  for (const key of tool.inputSchema?.required || []) if (!(key in args)) throw new Error('Manglende verktøyargument');
  // Shared rate-limited command lane. No automatic retry of side effects.
  return enqueueCommand(()=>rpc('tools/call',{name,arguments:args}),`mcp:${name}`);
}
export function resetSession() { sessionId=null;initialized=false;toolsCache=null; }
export function toOpenAITools(tools) {
  return tools.map(t=>({type:'function',function:{name:t.name,description:t.description || '',parameters:t.inputSchema || {type:'object',properties:{}}}}));
}
