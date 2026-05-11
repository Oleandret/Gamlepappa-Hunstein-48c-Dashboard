import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, Wrench, Loader, AlertCircle, User, Bot, ChevronDown, ChevronRight, Globe, Server, ExternalLink, Cpu } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAiModels, AVAILABLE_MODELS } from '../../lib/useAiModels.js';

/**
 * AI-chat-fane som lar brukeren snakke med Homey via MCP-tools.
 *
 * Conversation lever i klient-state (resettes ved page-reload). Hver
 * Send-handling sender hele historikken til /api/chat/message som
 * orkestrerer OpenAI ↔ MCP-loop og returnerer alle nye assistant/tool-
 * meldinger.
 */
export function ChatView() {
  const [messages, setMessages] = useState([]);  // {role, content, tool_calls?, tool_call_id?}
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [tools, setTools] = useState([]);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [lastToolCalls, setLastToolCalls] = useState([]);
  const aiModels = useAiModels();
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.chat.status().then(setStatus).catch(() => {});
    api.chat.tools().then(r => setTools(r?.tools || [])).catch(() => {});
  }, []);

  // Scroll til bunns ved nye meldinger
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    const newUserMsg = { role: 'user', content: text };
    const next = [...messages, newUserMsg];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const result = await api.chat.send(next);
      const newMessages = Array.isArray(result?.messages) ? result.messages : [];
      setMessages(prev => [...prev, ...newMessages]);
      setLastToolCalls(Array.isArray(result?.toolCalls) ? result.toolCalls : []);
    } catch (err) {
      setError(err);
      // Sett user-melding tilbake i input så den ikke går tapt
      setInput(text);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
      // Re-fokuser input etter sending
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [input, messages, sending]);

  const reset = useCallback(async () => {
    if (!confirm('Tøm hele samtalen?')) return;
    setMessages([]);
    setError(null);
    try { await api.chat.reset(); } catch { /* ok */ }
  }, []);

  const llmOk = status?.llm === true;

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 panel p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="panel-title flex items-center gap-2">
              <Bot size={14} className="text-nx-cyan" /> Homey AI-chat
            </p>
            <h1 className="text-xl font-semibold mt-1">Snakk med smarthuset</h1>
            <p className="text-xs text-nx-mute mt-1 leading-relaxed max-w-2xl">
              Skriv en kommando eller spørsmål. AI-en bruker Homey via Model Context Protocol
              for å lese status og styre enheter på vegne av deg.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={messages.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-[0.16em] border border-nx-line/60 text-nx-mute hover:text-nx-text disabled:opacity-40"
            >
              <RotateCcw size={12} /> Ny samtale
            </button>
          </div>
        </div>

        {!llmOk && (
          <div className="mt-3 rounded-lg border border-nx-amber/40 bg-nx-amber/10 p-2 text-xs text-nx-amber">
            <AlertCircle size={11} className="inline" /> OPENAI_API_KEY ikke satt på server. Chat er deaktivert.
          </div>
        )}

        {/* Tydelig statuslinje med MCP-URL og Altibox-lenke for å sjekke brannmur */}
        <div className="mt-3 rounded-lg border border-nx-line/50 bg-nx-panel/40 px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
          <Server size={12} className="text-nx-cyan shrink-0" aria-hidden="true" />
          <span className="font-mono text-nx-mute">Homey MCP:</span>
          <code className="font-mono text-nx-cyan break-all">{status?.mcpUrl || '—'}</code>
          <a
            href="https://www.altibox.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-mono text-nx-mute hover:text-nx-cyan"
            title="Sjekk fast IP og brannmur-innstillinger hos Altibox"
          >
            <Globe size={10} /> (sjekk brannmur er åpen) <ExternalLink size={9} />
          </a>
          <div className="ml-auto flex items-center gap-1.5">
            <Cpu size={12} className="text-nx-cyan" aria-hidden="true" />
            <select
              value={aiModels.config.chat}
              onChange={(e) => aiModels.set('chat', e.target.value)}
              className="bg-nx-panel/60 border border-nx-line/60 rounded px-1.5 py-0.5 text-[11px] text-nx-cyan font-mono focus:outline-none focus:border-nx-cyan/60"
              title="Velg AI-modell for chat"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label} — {m.tier}</option>
              ))}
              {/* Vis nåværende verdi hvis den ikke er i listen (custom model) */}
              {!AVAILABLE_MODELS.find(m => m.id === aiModels.config.chat) && (
                <option value={aiModels.config.chat}>{aiModels.config.chat} (egendefinert)</option>
              )}
            </select>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setToolsExpanded(e => !e)}
            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute hover:text-nx-cyan"
            title="Vis verktøy AI-en har tilgang til"
          >
            {toolsExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <Wrench size={10} /> {tools.length} verktøy fra MCP
          </button>
          <label className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute cursor-pointer">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
              className="accent-nx-cyan"
            />
            Debug-modus (vis raw MCP-respons)
          </label>
        </div>
        {toolsExpanded && tools.length > 0 && (
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 max-h-48 overflow-y-auto">
            {tools.map(t => (
              <li key={t.name} className="rounded border border-nx-line/40 bg-nx-panel/30 px-2 py-1 text-[11px]">
                <div className="font-mono text-nx-cyan">{t.name}</div>
                {t.description && <div className="text-nx-mute text-[10px] truncate" title={t.description}>{t.description}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {debugMode && lastToolCalls.length > 0 && (
        <div className="col-span-12 panel p-3 border border-nx-purple/40 bg-nx-purple/5">
          <p className="panel-title flex items-center gap-2 mb-2">
            <Wrench size={12} className="text-nx-purple" /> Debug: siste {lastToolCalls.length} MCP-kall
          </p>
          <ul className="space-y-1.5 max-h-72 overflow-y-auto">
            {lastToolCalls.map((tc, i) => (
              <DebugToolCall key={i} tc={tc} />
            ))}
          </ul>
        </div>
      )}

      <div className="col-span-12 panel p-0 overflow-hidden flex flex-col" style={{ minHeight: 'calc(100vh - 320px)' }}>
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-xs text-nx-mute py-12 max-w-md mx-auto leading-relaxed">
              <Bot size={32} className="mx-auto mb-3 text-nx-cyan" />
              Skriv en kommando under for å starte. Eksempler:
              <ul className="mt-3 space-y-1 text-nx-text">
                <li>"Skru på alle lys i stua"</li>
                <li>"Hvor varmt er det i kjøkkenet?"</li>
                <li>"Er alle dører låst?"</li>
                <li>"Hvor mye strøm bruker vi nå?"</li>
              </ul>
            </div>
          )}
          {messages.map((m, i) => <Message key={i} m={m} />)}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-nx-mute">
              <Loader size={14} className="animate-spin text-nx-cyan" />
              <span>Tenker og kjører verktøy...</span>
            </div>
          )}
        </div>

        <div className="border-t border-nx-line/40 p-3">
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder={llmOk ? 'Skriv en kommando... (Enter for å sende, Shift+Enter for ny linje)' : 'Chat er deaktivert'}
              disabled={!llmOk || sending}
              rows={2}
              className="flex-1 min-h-[44px] max-h-32 bg-nx-panel/60 border border-nx-line/70 rounded-lg px-3 py-2 text-sm text-nx-text placeholder:text-nx-mute focus:outline-none focus:border-nx-cyan/60 resize-none font-sans disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!llmOk || sending || !input.trim()}
              className="grid h-10 w-10 place-items-center rounded-lg bg-nx-cyan/15 text-nx-cyan border border-nx-cyan/55 shadow-glow-soft hover:bg-nx-cyan/25 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send"
            >
              {sending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </form>
          {error && (
            <p className="mt-2 text-xs text-nx-red font-mono">Feil: {error.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DebugToolCall({ tc }) {
  const d = tc.debug || {};
  return (
    <li className="rounded border border-nx-line/40 bg-nx-bg/40 px-2 py-1.5 text-[11px] font-mono">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={tc.isError ? 'text-nx-red' : 'text-nx-cyan'}>
          {tc.isError ? '✗' : '✓'} {tc.name}
        </span>
        {d.status && (
          <span className={d.status >= 400 ? 'text-nx-red' : 'text-nx-green'}>
            HTTP {d.status}
          </span>
        )}
        {d.contentType && <span className="text-nx-mute">{d.contentType.split(';')[0]}</span>}
        {d.bodyBytes != null && <span className="text-nx-mute">{d.bodyBytes}B</span>}
        {d.durationMs != null && <span className="text-nx-mute">{d.durationMs}ms</span>}
        {d.parsedEvents != null && <span className="text-nx-mute">{d.parsedEvents} events</span>}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-nx-mute hover:text-nx-cyan text-[10px]">Args</summary>
        <pre className="mt-1 text-[10px] text-nx-cyan whitespace-pre-wrap break-all">
          {JSON.stringify(tc.args, null, 2)}
        </pre>
      </details>
      <details className="mt-1">
        <summary className="cursor-pointer text-nx-mute hover:text-nx-cyan text-[10px]">Tolket resultat ({(tc.result || '').length}B)</summary>
        <pre className="mt-1 text-[10px] text-nx-text whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
          {tc.result || '(tomt)'}
        </pre>
      </details>
      {d.rawBody && (
        <details className="mt-1">
          <summary className="cursor-pointer text-nx-mute hover:text-nx-cyan text-[10px]">Raw HTTP body ({d.bodyBytes}B)</summary>
          <pre className="mt-1 text-[10px] text-nx-mute whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
            {d.rawBody}
          </pre>
        </details>
      )}
      {d.parsedPayload && (
        <details className="mt-1">
          <summary className="cursor-pointer text-nx-mute hover:text-nx-cyan text-[10px]">Parsed JSON-RPC payload</summary>
          <pre className="mt-1 text-[10px] text-nx-purple whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
            {d.parsedPayload}
          </pre>
        </details>
      )}
    </li>
  );
}

function Message({ m }) {
  if (m.role === 'tool') {
    // Verktøy-resultat — vises som kollapsbar boks under assistant-message
    return (
      <details className="text-xs">
        <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute hover:text-nx-cyan inline-flex items-center gap-1">
          <Wrench size={10} /> Verktøy-resultat
        </summary>
        <pre className="mt-1 rounded border border-nx-line/40 bg-nx-panel/30 px-2 py-1.5 text-[10px] text-nx-text font-mono overflow-x-auto whitespace-pre-wrap break-words">
          {String(m.content || '').slice(0, 4000)}
        </pre>
      </details>
    );
  }

  const isUser = m.role === 'user';
  const hasToolCalls = Array.isArray(m.tool_calls) && m.tool_calls.length > 0;

  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={[
        'grid h-7 w-7 place-items-center rounded-md shrink-0',
        isUser ? 'bg-nx-purple/15 text-nx-purple' : 'bg-nx-cyan/15 text-nx-cyan'
      ].join(' ')}>
        {isUser ? <User size={12} /> : <Bot size={12} />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        {m.content && (
          <div className={[
            'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
            isUser
              ? 'bg-nx-purple/10 border border-nx-purple/30 text-nx-text'
              : 'bg-nx-panel/40 border border-nx-line/50 text-nx-text'
          ].join(' ')}>
            {m.content}
          </div>
        )}
        {hasToolCalls && (
          <div className="mt-1 space-y-0.5">
            {m.tool_calls.map(tc => (
              <div key={tc.id} className="text-[10px] font-mono text-nx-mute inline-flex items-center gap-1 mr-2">
                <Wrench size={9} className="text-nx-cyan" />
                <span className="text-nx-cyan">{tc.function?.name}</span>
                {tc.function?.arguments && tc.function.arguments !== '{}' && (
                  <span className="text-nx-mute truncate max-w-[200px]" title={tc.function.arguments}>
                    {tc.function.arguments.slice(0, 60)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
