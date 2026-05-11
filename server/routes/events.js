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
import { compileSuggestionToFlow } from '../lib/autoFlowCompiler.js';
import { invalidateFlowCache } from '../lib/autoFlowExecutor.js';

export const eventsRoutes = Router();

/**
 * Inspiser disk-lagring rundt config-filen (Railway volume eller lokalt
 * filsystem). Prøver å OPPRETTE config-mappa hvis den ikke finnes — slik
 * vet vi om filsystemet er skrivbart selv før første save har skjedd.
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
    error: null,
    hint: null
  };

  // Forsøk å opprette mappa (idempotent). Hvis dette feiler er FS read-only.
  try {
    await fs.mkdir(dir, { recursive: true });
    result.dirExists = true;
  } catch (err) {
    result.error = `Kunne ikke opprette ${dir}: ${err.message}`;
    result.hint = 'På Railway: legg til en Volume, mount den på /data, og sett CONFIG_PATH=/data/config.json som env-variabel.';
    return result;
  }

  // Test skriv ved å lage og slette en probe-fil
  try {
    const probe = path.join(dir, '.write-test');
    await fs.writeFile(probe, '', { flag: 'w' });
    await fs.unlink(probe);
    result.writable = true;
  } catch (err) {
    result.error = err.message;
    result.hint = 'På Railway: filsystemet rundt deploy-mappa er typisk ikke skrivbar. Legg til en Volume og pek CONFIG_PATH dit.';
  }

  try {
    const st = await fs.stat(fp);
    result.fileExists = true;
    result.fileSizeBytes = st.size;
  } catch { /* file doesn't exist yet — normalt */ }

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

// ── Auto-flows ───────────────────────────────────────────────────────────

eventsRoutes.get('/auto-flows', async (_req, res, next) => {
  try {
    if (!isEnabled()) return res.json({ flows: [], _disabled: true });
    const result = await query(`
      SELECT id, title, description, trigger, actions, enabled,
             created_at, last_run_at, last_run_ok, last_error, run_count,
             min_interval_seconds, source_suggestion_id
      FROM auto_flows
      ORDER BY enabled DESC, created_at DESC
    `);
    res.json({ flows: result.rows });
  } catch (err) { next(err); }
});

eventsRoutes.get('/auto-flows/:id/runs', async (req, res, next) => {
  try {
    if (!isEnabled()) return res.json({ runs: [], _disabled: true });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
    const result = await query(`
      SELECT id, run_at, trigger_event, actions_result, ok, duration_ms
      FROM auto_flow_runs
      WHERE flow_id = $1
      ORDER BY run_at DESC
      LIMIT 50
    `, [id]);
    res.json({ runs: result.rows });
  } catch (err) { next(err); }
});

/**
 * Kompiler en suggestion til en auto-flow med LLM, lagre med enabled=false
 * som default — brukeren slår den på etter å ha sjekket.
 */
eventsRoutes.post('/suggestions/:id/compile', async (req, res, next) => {
  try {
    if (!isEnabled()) return res.status(400).json({ error: 'database not configured' });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
    const sres = await query(`SELECT * FROM suggestions WHERE id = $1`, [id]);
    const sugg = sres.rows[0];
    if (!sugg) return res.status(404).json({ error: 'suggestion not found' });

    const result = await compileSuggestionToFlow(sugg);
    if (!result.ok) return res.status(400).json({ error: result.error, raw: result.raw });

    const insertResult = await query(
      `INSERT INTO auto_flows (title, description, source_suggestion_id, trigger, actions, enabled)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, false)
       RETURNING id`,
      [
        result.flow.title || sugg.title,
        result.flow.description || sugg.description,
        sugg.id,
        JSON.stringify(result.flow.trigger),
        JSON.stringify(result.flow.actions)
      ]
    );
    await query(`UPDATE suggestions SET status = 'accepted', reviewed_at = NOW() WHERE id = $1`, [id]);
    invalidateFlowCache();
    res.json({ flowId: insertResult.rows[0].id, flow: result.flow });
  } catch (err) { next(err); }
});

eventsRoutes.patch('/auto-flows/:id', async (req, res, next) => {
  try {
    if (!isEnabled()) return res.status(400).json({ error: 'database not configured' });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
    const patch = req.body || {};
    const fields = [];
    const values = [];
    if (typeof patch.enabled === 'boolean') {
      values.push(patch.enabled);
      fields.push(`enabled = $${values.length}`);
    }
    if (typeof patch.title === 'string') {
      values.push(patch.title);
      fields.push(`title = $${values.length}`);
    }
    if (typeof patch.description === 'string') {
      values.push(patch.description);
      fields.push(`description = $${values.length}`);
    }
    if (typeof patch.min_interval_seconds === 'number') {
      values.push(Math.max(1, Math.min(3600, Math.floor(patch.min_interval_seconds))));
      fields.push(`min_interval_seconds = $${values.length}`);
    }
    if (fields.length === 0) return res.status(400).json({ error: 'nothing to update' });
    values.push(id);
    await query(`UPDATE auto_flows SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
    invalidateFlowCache();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

eventsRoutes.delete('/auto-flows/:id', async (req, res, next) => {
  try {
    if (!isEnabled()) return res.status(400).json({ error: 'database not configured' });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
    await query(`DELETE FROM auto_flows WHERE id = $1`, [id]);
    invalidateFlowCache();
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
