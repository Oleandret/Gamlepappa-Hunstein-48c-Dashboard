import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homeyRoutes } from './routes/homey.js';
import { weatherRoutes } from './routes/weather.js';
import { systemRoutes } from './routes/system.js';
import { configRoutes } from './routes/config.js';
import { cfg, isDemoMode } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const isProd = process.env.NODE_ENV === 'production';

// Railway/Heroku reverse-proxy — trust X-Forwarded-* headers
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(compression());

// CORS — same-origin in prod (frontend served by this server), permissive in dev
const allowedOrigin = process.env.CORS_ORIGIN
  || (isProd ? false : ['http://localhost:5173', 'http://127.0.0.1:5173']);
app.use(cors({ origin: allowedOrigin, credentials: false }));

app.use(express.json({ limit: '256kb' }));

// Lightweight request log (without auth headers / bodies)
app.use((req, _res, next) => {
  if (req.path.startsWith('/api') && !isProd) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// API routes
app.use('/api/system', systemRoutes);
app.use('/api/homey', homeyRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/config', configRoutes);

// Healthcheck — Railway uses this for restart policy
app.get('/healthz', (_req, res) =>
  res.json({ ok: true, demo: isDemoMode(), ts: Date.now() })
);

// JSON 404 for unknown API paths (instead of Express's default HTML)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not found' });
});

// Static frontend (override path with CLIENT_DIST env if needed)
const clientDist = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.resolve(__dirname, '..', 'client', 'dist');

// Hashed assets in /assets/* can cache aggressively (filename rotates on each build)
app.use('/assets', express.static(path.join(clientDist, 'assets'), {
  maxAge: isProd ? '1y' : 0,
  immutable: isProd,
  index: false
}));

// Other static files (index.html, house.jpg, favicon) cache for 1h in prod
app.use(express.static(clientDist, {
  maxAge: isProd ? '1h' : 0,
  index: false
}));

// SPA fallback — every non-API path returns index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(clientDist, 'index.html'), (err) => { if (err) next(err); });
});

// Centralised error handler — never leaks stack traces or auth headers
app.use((err, _req, res, _next) => {
  const safeMessage = sanitizeError(err.message || 'Internal server error');
  console.error('[server] error:', safeMessage);
  res.status(err.status || 500).json({ error: safeMessage });
});

function sanitizeError(s) {
  if (typeof s !== 'string') return 'Internal server error';
  // Strip anything that looks like a Bearer token, PAT, or long hex/base64 secret
  return s
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer ***')
    .replace(/\b[A-Za-z0-9_\-]{32,}\b/g, '***')
    .slice(0, 300);
}

const patSet = Boolean(cfg('HOMEY_PAT'));
app.listen(PORT, () => {
  const banner = [
    '',
    '  ⚡  Gamlepappa Smarthus backend ready on port ' + PORT,
    '     mode: ' + (isDemoMode() ? 'DEMO (mock data)' : 'LIVE (Homey)'),
    '     PAT:  ' + (patSet ? 'set ✓' : 'missing — fill in server/config.js or HOMEY_PAT env'),
    '     env:  ' + (isProd ? 'production' : 'development'),
    ''
  ].join('\n');
  console.log(banner);
});
