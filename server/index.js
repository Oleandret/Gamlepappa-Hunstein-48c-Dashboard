import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homeyRoutes } from './routes/homey.js';
import { weatherRoutes } from './routes/weather.js';
import { systemRoutes } from './routes/system.js';
import { cfg } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const isProd = process.env.NODE_ENV === 'production';

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/system', systemRoutes);
app.use('/api/homey', homeyRoutes);
app.use('/api/weather', weatherRoutes);

app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist, { maxAge: isProd ? '1h' : 0 }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => { if (err) next(err); });
});

app.use((err, _req, res, _next) => {
  console.error('[server] error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const patSet = Boolean(cfg('HOMEY_PAT'));
const demo = cfg('DEMO_MODE') === true || cfg('DEMO_MODE') === 'true' || !patSet;

app.listen(PORT, () => {
  console.log(`\n  ⚡  NEXORA backend ready on port ${PORT}`);
  console.log(`     mode: ${demo ? 'DEMO (mock data)' : 'LIVE (Homey)'}`);
  console.log(`     PAT:  ${patSet ? 'set ✓' : 'missing — fill in server/config.js or HOMEY_PAT env'}\n`);
});
