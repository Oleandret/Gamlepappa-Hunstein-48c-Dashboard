import { accessControl, authConfigured } from './lib/auth.js';
import { googleAuth } from './lib/googleAuth.js';
import { experienceRoutes } from './routes/experience.js';
import { stopDevicePoller } from './workers/devicePoller.js';
import { shutdown } from './lib/db.js';
import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { savingsRoutes } from './routes/savings.js';
import { homeyRoutes } from './routes/homey.js';
import { weatherRoutes } from './routes/weather.js';
import { systemRoutes } from './routes/system.js';
import { configRoutes } from './routes/config.js';
import { eventsRoutes } from './routes/events.js';
import { chatRoutes } from './routes/chat.js';
import { runMigrations, isEnabled as dbEnabled } from './lib/db.js';
import { startDevicePoller } from './workers/devicePoller.js';
import { cfg, isDemoMode } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
let ready = false;
const PORT = process.env.PORT || 8080;
const isProd = process.env.NODE_ENV === 'production';

// Railway/Heroku reverse-proxy — trust X-Forwarded-* headers
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(compression());
app.use((_req,res,next) => { res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-src https://artimis-ai-production.up.railway.app; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"}); next(); });

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

app.use('/auth', googleAuth.router);
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, accessControl);
app.use('/api/experience', experienceRoutes);
app.get('/api/session', (req,res) => res.json(req.user));
app.post('/api/logout', googleAuth.logout);
// API routes
app.use('/api/system', systemRoutes);
app.use('/api/homey', homeyRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/config', configRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/chat', chatRoutes);

// Healthcheck — Railway uses this for restart policy
app.get('/healthz', (_req, res) =>
  res.json({ ok: true, demo: isDemoMode(), ts: Date.now() })
);

app.get('/readyz', (_req,res) => res.status(ready ? 200 : 503).json({ready}));

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
  res.status(err.status || 500).json({ error: err.status && err.status < 500 ? safeMessage : 'Tjenesten kunne ikke fullføre forespørselen' });
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
const server = app.listen(PORT, async () => {
  const banner = [
    '',
    '  ⚡  Gamlepappa Smarthus backend ready on port ' + PORT,
    '     mode: ' + (isDemoMode() ? 'DEMO (mock data)' : 'LIVE (Homey)'),
    '     PAT:  ' + (patSet ? 'set ✓' : 'missing — fill in server/config.js or HOMEY_PAT env'),
    '     db:   ' + (dbEnabled() ? 'configured (DATABASE_URL set)' : 'disabled (no DATABASE_URL)'),
    '     env:  ' + (isProd ? 'production' : 'development'),
    ''
  ].join('\n');
  console.log(banner);

  // Initialiser databasen + start device-poller hvis konfigurert
  if (dbEnabled()) {
    const ok = await runMigrations();
    if (ok && !isDemoMode() && authConfigured()) startDevicePoller();
    if (!ok) return;
  }
  ready = authConfigured() || (!isProd && process.env.DEMO_MODE === 'true');
});
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => {
  ready = false; stopDevicePoller();
  server.close(async () => { await shutdown(); process.exit(0); });
  setTimeout(() => process.exit(1), 15000).unref();
});
