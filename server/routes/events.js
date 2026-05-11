import { Router } from 'express';
import { isEnabled, query } from '../lib/db.js';
import { pollerStatus, triggerPollNow } from '../workers/devicePoller.js';
import { runDetection } from '../lib/patternDetector.js';
import { runSuggestionEngine } from '../workers/suggestionEngine.js';
import { openaiEnabled } from '../lib/openaiClient.js';

export const eventsRoutes = Router();

/**
 * Status om databasen + poller. Brukes av Innsikt-fanen for å vise om
 * lagring er konfigurert.
 */
eventsRoutes.get('/status', async (_req, res) => {
  res.json({
    db: isEnabled(),
    poller: pollerStatus(),
    llm: openaiEnabled()
  });
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
