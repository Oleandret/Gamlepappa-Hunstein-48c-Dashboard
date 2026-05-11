import { Router } from 'express';
import { isEnabled, query } from '../lib/db.js';
import { pollerStatus, triggerPollNow } from '../workers/devicePoller.js';

export const eventsRoutes = Router();

/**
 * Status om databasen + poller. Brukes av Innsikt-fanen for å vise om
 * lagring er konfigurert.
 */
eventsRoutes.get('/status', async (_req, res) => {
  res.json({
    db: isEnabled(),
    poller: pollerStatus()
  });
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
