import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isEnabled, query, hasTimescaleDB } from '../lib/db.js';
import { pollerStatus, triggerPollNow } from '../workers/devicePoller.js';
import { runDetection } from '../lib/patternDetector.js';
import { runSuggestionEngine } from '../workers/suggestionEngine.js';
import { openaiEnabled } from '../lib/openaiClient.js';
import { configPath } from '../lib/configStore.js';
import { cfg, isDemoMode } from '../config.js';

export const eventsRoutes = Router();

/**
 * Inspiser disk-lagring rundt config-filen (Railway volume eller lokalt
 * filsystem). Returnerer størrelse på filen + ledig plass i mappa.
 */
async function inspectStorage() {
  const fp = configPath();
  const dir = path.dirname(fp);
  const result = {
    configPath: fp,
    dirExists: false,
    fileExists: false,
    fileSizeBytes: null,
    writable: false,
    freeBytes: null,
    totalBytes: null,
    error: null
  };
  try {
    await fs.access(dir);
    result.dirExists = true;
  } catch { /* dir doesn't exist yet */ }
  try {
    const st = await fs.stat(fp);
    result.fileExists = true;
    result.fileSizeBytes = st.size;
  } catch { /* file doesn't exist yet */ }
  // Test write-permissions ved å skrive en tom .write-test
  try {
    if (result.dirExists) {
      const probe = path.join(dir, '.write-test');
      await fs.writeFile(probe, '', { flag: 'w' });
      await fs.unlink(probe);
      result.writable = true;
    }
  } catch (err) {
    result.writable = false;
    result.error = err.message;
  }
  // statfs (Node 18+) for ledig diskplass
  try {
    if (typeof fs.statfs === 'function' && result.dirExists) {
      const sfs = await fs.statfs(dir);
      result.freeBytes = sfs.bavail * sfs.bsize;
      result.totalBytes = sfs.blocks * sfs.bsize;
    }
  } catch { /* statfs might not be supported */ }
  return result;
}

/**
 * DB-statistikk: antall events totalt, eldste + nyeste tidsstempel,
 * patterns og suggestions teller.
 */
async function inspectDb() {
  if (!isEnabled()) return null;
  try {
    const ev = await query(`
      SELECT
        COUNT(*)::int AS total_events,
        COUNT(*) FILTER (WHERE kind='transition')::int AS transitions,
        COUNT(*) FILTER (WHERE kind='snapshot')::int   AS snapshots,
        MIN(ts) AS oldest_ts,
        MAX(ts) AS newest_ts
      FROM device_events
    `);
    const pat = await query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active)::int AS active FROM patterns`);
    const sug = await query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='pending')::int AS pending FROM suggestions`);
    return {
      events: ev.rows[0],
      patterns: pat.rows[0],
      suggestions: sug.rows[0],
      timescale: hasTimescaleDB()
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Status om databasen + poller. Brukes av Innsikt-fanen for å vise om
 * lagring er konfigurert.
 */
eventsRoutes.get('/status', async (_req, res, next) => {
  try {
    const [storage, dbInfo] = await Promise.all([
      inspectStorage(),
      inspectDb()
    ]);
    res.json({
      // Komponent-flagg
      db:       isEnabled(),
      llm:      openaiEnabled(),
      homey:    !isDemoMode() && Boolean(cfg('HOMEY_PAT')),
      demo:     isDemoMode(),
      // Detaljer
      poller:   pollerStatus(),
      storage,
      database: dbInfo
    });
  } catch (err) { next(err); }
});

// ── Patterns ─────────────────────────────────────────────────────────────

/**
 * Hent aktive (eller alle) patterns sortert etter score.
 */
eventsRoutes.get('/patterns', async (req, res, next) => {
  try {
    if (!isEnabled()) return res.json({ patterns: [], _disabled: true });
    const onlyActive = req.query.all !== 'true';
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const sql = `
      SELECT id, detected_at, kind, description, data, confidence, support, score, active, user_feedback
      FROM patterns
      ${onlyActive ? 'WHERE active = true' : ''}
      ORDER BY score DESC NULLS LAST
      LIMIT $1
    `;
    const result = await query(sql, [limit]);
    res.json({ patterns: result.rows });
  } catch (err) { next(err); }
});

/**
 * Trigger pattern-detection nå (synkront — kan ta noen sekunder).
 */
eventsRoutes.post('/patterns/analyze', async (_req, res, next) => {
  try {
    const result = await runDetection();
    res.json({ result });
  } catch (err) { next(err); }
});

// ── Suggestions ──────────────────────────────────────────────────────────

eventsRoutes.get('/suggestions', async (req, res, next) => {
  try {
    if (!isEnabled()) return res.json({ suggestions: [], _disabled: true });
    const status = req.query.status; // 'pending' | 'accepted' | 'rejected' | 'later' | undefined
    const where = status ? `WHERE status = $1` : '';
    const params = status ? [status] : [];
    const sql = `
      SELECT id, generated_at, title, description, trigger_text, action_text, why,
             confidence, pattern_ids, model, status, reviewed_at
      FROM suggestions
      ${where}
      ORDER BY generated_at DESC, id DESC
      LIMIT 50
    `;
    const result = await query(sql, params);
    res.json({ suggestions: result.rows });
  } catch (err) { next(err); }
});

/**
 * Trigger LLM-forslag nå (synkront — typisk 3-8 sekunder).
 */
eventsRoutes.post('/suggestions/generate', async (_req, res, next) => {
  try {
    const result = await runSuggestionEngine();
    res.json({ result });
  } catch (err) { next(err); }
});

/**
 * Endre status på en suggestion (accepted/rejected/later).
 */
eventsRoutes.patch('/suggestions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
    const status = req.body?.status;
    if (!['accepted', 'rejected', 'later', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    await query(
      `UPDATE suggestions SET status = $1, reviewed_at = NOW() WHERE id = $2`,
      [status, id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/**
 * Hent siste device-events med valgfri filtrering.
 * Query params: limit (default 100, max 500), kind, capability, deviceId, sinceMinutes
 */
eventsRoutes.get('/recent', async (req, res, next) => {
  try {
    if (!isEnabled()) return res.json({ events: [], _disabled: true });
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const where = [];
    const params = [];
    if (req.query.kind) {
      params.push(req.query.kind);
      where.push(`kind = $${params.length}`);
    }
    if (req.query.capability) {
      params.push(req.query.capability);
      where.push(`capability = $${params.length}`);
    }
    if (req.query.deviceId) {
      params.push(req.query.deviceId);
      where.push(`device_id = $${params.length}`);
    }
    if (req.query.sinceMinutes) {
      const min = Math.max(1, Number(req.query.sinceMinutes) || 60);
      params.push(min);
      where.push(`ts > NOW() - ($${params.length} || ' minutes')::interval`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    const sql = `
      SELECT id, ts, device_id, device_name, zone, class, capability,
             value, prev_value, kind, hour_of_day, day_of_week
      FROM device_events
      ${whereSql}
      ORDER BY ts DESC
      LIMIT $${params.length}
    `;
    const result = await query(sql, params);
    res.json({ events: result.rows });
  } catch (err) { next(err); }
});

/**
 * Sammendrag: antall events per kapabilitet siste 24t, og hyppigst aktive
 * enheter. Brukes som "puls"-widget i Innsikt-fanen.
 */
eventsRoutes.get('/summary', async (_req, res, next) => {
  try {
    if (!isEnabled()) return res.json({ _disabled: true });
    const byCap = await query(`
      SELECT capability, COUNT(*)::int AS count
      FROM device_events
      WHERE ts > NOW() - INTERVAL '24 hours' AND kind = 'transition'
      GROUP BY capability
      ORDER BY count DESC
      LIMIT 12
    `);
    const byDevice = await query(`
      SELECT device_id, device_name, zone, COUNT(*)::int AS count
      FROM device_events
      WHERE ts > NOW() - INTERVAL '24 hours' AND kind = 'transition'
      GROUP BY device_id, device_name, zone
      ORDER BY count DESC
      LIMIT 12
    `);
    const totals = await query(`
      SELECT
        COUNT(*) FILTER (WHERE kind = 'transition' AND ts > NOW() - INTERVAL '24 hours')::int AS transitions_24h,
        COUNT(*) FILTER (WHERE kind = 'snapshot'   AND ts > NOW() - INTERVAL '24 hours')::int AS snapshots_24h,
        COUNT(*)::int AS total,
        MIN(ts) AS oldest_ts,
        MAX(ts) AS newest_ts
      FROM device_events
    `);
    res.json({
      totals: totals.rows[0] || {},
      byCapability: byCap.rows,
      byDevice: byDevice.rows
    });
  } catch (err) { next(err); }
});

/**
 * Trigger en poll umiddelbart — nyttig for å verifisere oppsett uten å vente
 * på neste interval.
 */
eventsRoutes.post('/poll-now', async (_req, res, next) => {
  try {
    const result = await triggerPollNow();
    res.json({ result });
  } catch (err) { next(err); }
});
