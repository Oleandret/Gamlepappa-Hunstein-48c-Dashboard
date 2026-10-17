/**
 * ElevenLabs ConvAI-widget i en isolert side.
 *
 * Dashboardet viser denne siden i en <iframe sandbox="allow-scripts …"> uten
 * allow-same-origin, og svaret har i tillegg CSP-direktivet `sandbox`. Siden
 * får dermed en «opaque origin» – også om den åpnes direkte – slik at
 * leverandørens skript ikke kan lese innloggingsnøkkelen i sessionStorage,
 * cookies eller kalle /api med dashboardets tilgang.
 *
 * Widget-pakken er låst til én versjon med Subresource Integrity, så en endret
 * fil på CDN-et blir avvist av nettleseren.
 */

export const VOICE_AGENTS = Object.freeze({
  oversikt: 'SCOI5nAeUm2P90tPlhxJ',
  standard: 'agent_4501kc02r47xec2s0r87f0awxdj6'
});

export const WIDGET_SCRIPT = Object.freeze({
  src: 'https://unpkg.com/@elevenlabs/convai-widget-embed@0.18.1/dist/index.js',
  integrity: 'sha384-XvWW14iVN5ShLLtK82Bs9f6O11Ts1EuybLOPFG40AqUXtQ7ltjuDp1lMAkB5MFZP'
});

export const WIDGET_CSP = [
  "default-src 'none'",
  "script-src https://unpkg.com/@elevenlabs/convai-widget-embed@0.18.1/ blob: data:",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com data:',
  'img-src https: data: blob:',
  'media-src https: data: blob:',
  'connect-src https://*.elevenlabs.io wss://*.elevenlabs.io https://storage.googleapis.com https://*.openfpcdn.io https://cdn.jsdelivr.net',
  'worker-src blob:',
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
  'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox'
].join('; ');

export function widgetHtml(agentId) {
  return `<!doctype html>
<html lang="no">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Taleassistent</title>
<style>html,body{margin:0;height:100%;background:transparent;color-scheme:dark;font-family:system-ui,sans-serif}</style>
</head>
<body>
<elevenlabs-convai agent-id="${agentId}" variant="expanded"></elevenlabs-convai>
<script src="${WIDGET_SCRIPT.src}" integrity="${WIDGET_SCRIPT.integrity}" crossorigin="anonymous" async></script>
</body>
</html>`;
}

export function voiceWidget(req, res) {
  const agentId = VOICE_AGENTS[req.query.agent] || VOICE_AGENTS.standard;
  res.removeHeader('X-Frame-Options');
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': WIDGET_CSP,
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    'Permissions-Policy': 'microphone=*, autoplay=*, camera=()'
  });
  res.send(widgetHtml(agentId));
}
