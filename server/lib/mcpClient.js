/**
 * Minimal MCP-klient som snakker JSON-RPC over HTTP mot Homey-MCP-serveren.
 *
 * Config:
 *   HOMEY_MCP_URL — endpoint (eks. http://92.221.70.95:3000/mcp)
 *
 * Vi følger Model Context Protocol-spesifikasjonen:
 *   - initialize  → handshake med capabilities
 *   - tools/list  → liste verktøy
 *   - tools/call  → utfør verktøy
 *
 * Mange MCP-server-implementasjoner krever en sesjon. Vi initialiserer
 * én gang, husker session-id (Mcp-Session-Id-header), og bruker den på
 * påfølgende kall. Hvis sesjonen brytes, init på nytt.
 */

const DEFAULT_URL = 'http://92.221.70.95:3000/mcp';
const CLIENT_INFO = { name: 'gamlepappa-dashboard', version: '1.0.0' };
const PROTOCOL_VERSION = '2025-06-18';

let sessionId = null;
let toolsCache = null;
let toolsCacheAt = 0;
const TOOLS_CACHE_TTL = 5 * 60 * 1000;
let nextRpcId = 1;

export function mcpUrl() {
  return process.env.HOMEY_MCP_URL || DEFAULT_URL;
}

export function mcpConfigured() {
  // MCP-URL har en default — alltid 'konfigurert'. Funksjonen er for
  // konsekvent grensesnitt mot resten av appen.
  return Boolean(mcpUrl());
}

/**
 * Send en JSON-RPC request. Returnerer parsed result (eller kaster).
 * Håndterer både SSE-respons og vanlig JSON-respons.
 */
async function rpc(method, params = {}, { withSession = true } = {}) {
  const url = mcpUrl();
  const id = nextRpcId++;
  const body = { jsonrpc: '2.0', id, method, params };
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  };
  if (withSession && sessionId) headers['Mcp-Session-Id'] = sessionId;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  // Server kan returnere session-id på initialize
  const newSession = res.headers.get('Mcp-Session-Id');
  if (newSession) sessionId = newSession;

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MCP ${method} → ${res.status}: ${text.slice(0, 300)}`);
  }

  const contentType = res.headers.get('content-type') || '';
  let payload;

  if (contentType.includes('text/event-stream')) {
    // SSE — les til vi får en data-melding som matcher vår id
    const text = await res.text();
    const lines = text.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      try {
        const msg = JSON.parse(data);
        if (msg.id === id) { payload = msg; break; }
      } catch { /* ignore non-json data lines */ }
    }
    if (!payload) {
      throw new Error(`MCP ${method}: ingen respons med id=${id} i SSE-stream`);
    }
  } else {
    payload = await res.json();
  }

  if (payload.error) {
    throw new Error(`MCP ${method} error: ${payload.error.message || JSON.stringify(payload.error)}`);
  }
  return payload.result;
}

async function ensureInitialized() {
  if (sessionId) return;
  try {
    await rpc('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      clientInfo: CLIENT_INFO
    }, { withSession: false });
    // Etter init må vi sende 'notifications/initialized' (no response)
    try {
      await fetch(mcpUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {})
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })
      });
    } catch { /* notification is fire-and-forget */ }
  } catch (err) {
    sessionId = null;
    throw err;
  }
}

export async function listTools({ force = false } = {}) {
  if (!force && toolsCache && Date.now() - toolsCacheAt < TOOLS_CACHE_TTL) {
    return toolsCache;
  }
  await ensureInitialized();
  const result = await rpc('tools/list');
  const tools = Array.isArray(result?.tools) ? result.tools : [];
  toolsCache = tools;
  toolsCacheAt = Date.now();
  return tools;
}

export async function callTool(name, args = {}) {
  await ensureInitialized();
  try {
    return await rpc('tools/call', { name, arguments: args });
  } catch (err) {
    // Hvis sesjonen har gått ut, prøv én gang til etter re-init
    if (/session/i.test(err.message) || /not initialized/i.test(err.message)) {
      sessionId = null;
      await ensureInitialized();
      return await rpc('tools/call', { name, arguments: args });
    }
    throw err;
  }
}

export function resetSession() {
  sessionId = null;
  toolsCache = null;
  toolsCacheAt = 0;
}

/**
 * Konverter MCP tools til OpenAI Chat Completions tool-format.
 */
export function toOpenAITools(tools) {
  return (tools || []).map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description || '',
      parameters: t.inputSchema || { type: 'object', properties: {} }
    }
  }));
}
