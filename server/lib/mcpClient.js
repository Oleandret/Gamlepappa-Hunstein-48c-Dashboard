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

// Siste rå-respons fra en RPC, eksponert til chat-endepunktet for debug
let lastRawResponse = null;
export function getLastRawResponse() { return lastRawResponse; }

/**
 * Send en JSON-RPC request. Returnerer parsed result (eller kaster).
 * Håndterer både SSE-respons og vanlig JSON-respons. Fanger raw body
 * i lastRawResponse for diagnostikk.
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
  const startedAt = Date.now();

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  // Server kan returnere session-id på initialize
  const newSession = res.headers.get('Mcp-Session-Id');
  if (newSession) sessionId = newSession;

  const contentType = res.headers.get('content-type') || '';

  // Les body som tekst FØRST slik at vi kan logge selv hvis JSON-parsing feiler
  const rawText = await res.text().catch(() => '');
  lastRawResponse = {
    method,
    requestId: id,
    status: res.status,
    contentType,
    sessionId: newSession || sessionId,
    bodyBytes: rawText.length,
    rawBody: rawText.slice(0, 4000),
    durationMs: Date.now() - startedAt
  };

  console.log(`[mcp] ${method} (id=${id}) → ${res.status} ${contentType} ${rawText.length}B in ${Date.now() - startedAt}ms`);

  if (!res.ok) {
    throw new Error(`MCP ${method} → ${res.status}: ${rawText.slice(0, 300)}`);
  }

  let payload;

  // 202 Accepted med tom body = response kommer asynkront via en separat GET
  // (modern MCP Streamable HTTP). Vi støtter ikke det per nå — gi tydelig feil.
  if (res.status === 202 && !rawText) {
    throw new Error(`MCP ${method}: serveren returnerte 202 Accepted uten body. Krever async SSE-stream på separat GET — ikke støttet ennå.`);
  }

  if (contentType.includes('text/event-stream') || rawText.trimStart().startsWith('event:') || rawText.trimStart().startsWith('data:')) {
    // SSE — parse events korrekt:
    //   * Events er separert med \n\n
    //   * Innenfor et event har vi 'data:' / 'event:' / 'id:' / 'retry:' linjer
    //   * Flere data:-linjer i samme event skal konkateneres med \n
    const events = rawText.split(/\r?\n\r?\n/);
    const allParsed = [];
    let unparsable = 0;
    for (const evt of events) {
      const dataLines = [];
      for (const rawLine of evt.split(/\r?\n/)) {
        if (!rawLine.startsWith('data:')) continue;
        const line = rawLine.slice(5);
        dataLines.push(line.startsWith(' ') ? line.slice(1) : line);
      }
      if (dataLines.length === 0) continue;
      const data = dataLines.join('\n').trim();
      if (!data) continue;
      try {
        const msg = JSON.parse(data);
        allParsed.push(msg);
        if (msg.id === id || String(msg.id) === String(id)) payload = msg;
      } catch {
        unparsable++;
      }
    }
    lastRawResponse.parsedEvents = allParsed.length;
    lastRawResponse.unparsableEvents = unparsable;

    if (!payload) {
      const candidate = allParsed.find(m => m && (m.result !== undefined || m.error !== undefined));
      if (candidate) payload = candidate;
    }
    if (!payload) {
      throw new Error(`MCP ${method}: ingen JSON-RPC respons i SSE-stream (${allParsed.length} events parset, ${unparsable} feilet, ${rawText.length} bytes)`);
    }
  } else if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch (err) {
      throw new Error(`MCP ${method}: kunne ikke parse JSON-respons: ${err.message}. Body: ${rawText.slice(0, 200)}`);
    }
  } else {
    throw new Error(`MCP ${method}: tom respons fra serveren (status ${res.status})`);
  }

  lastRawResponse.parsedPayload = payload ? JSON.stringify(payload).slice(0, 2000) : null;

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
