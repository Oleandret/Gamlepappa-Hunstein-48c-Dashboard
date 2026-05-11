import pg from 'pg';

/**
 * Postgres-tilkobling. Aktiveres kun hvis DATABASE_URL er satt — ellers
 * eksporterer modulen en "disabled" pool slik at resten av serveren ikke
 * krasjer. Pollerne og query-funksjonene sjekker `isEnabled()` før de gjør
 * noe.
 *
 * Railway: legg til Postgres-add-on, koble den til denne tjenesten, og
 * DATABASE_URL settes automatisk som env-variabel.
 */

const { Pool } = pg;

let pool = null;
let hasTimescale = false;
let migrationsRan = false;

export function isEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!isEnabled()) return null;
  if (pool) return pool;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Railway proxies eksternt-formet URL ofte over TLS uten gyldig CA-rot.
    // For interne (private) URL'er trengs ikke SSL. Bruk PGSSLMODE=require
    // hvis du peker mot ekstern URL.
    ssl: process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false }
      : (process.env.DATABASE_URL || '').includes('railway.app') && !process.env.DATABASE_URL.includes('railway.internal')
        ? { rejectUnauthorized: false }
        : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000
  });
  pool.on('error', err => console.error('[db] pool error:', err.message));
  return pool;
}

export async function query(text, params = []) {
  const p = getPool();
  if (!p) throw new Error('Database not configured — set DATABASE_URL');
  return p.query(text, params);
}

export function hasTimescaleDB() { return hasTimescale; }

/**
 * Idempotente migrations. Kjøres på server-start. CREATE TABLE IF NOT
 * EXISTS slik at det er trygt å kjøre flere ganger.
 */
export async function runMigrations() {
  if (!isEnabled()) return false;
  if (migrationsRan) return true;
  const p = getPool();

  try {
    // Detekter TimescaleDB — extension er gratis på de fleste managed PG-er,
    // men ikke alltid installert. Hvis det finnes, bruker vi hypertable.
    try {
      await p.query(`CREATE EXTENSION IF NOT EXISTS timescaledb`);
      const r = await p.query(`SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'`);
      hasTimescale = r.rows.length > 0;
    } catch {
      hasTimescale = false;
    }

    // device_events: hver state-endring eller periodisk snapshot
    await p.query(`
      CREATE TABLE IF NOT EXISTS device_events (
        id            BIGSERIAL,
        ts            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        device_id     TEXT NOT NULL,
        device_name   TEXT,
        zone          TEXT,
        class         TEXT,
        capability    TEXT NOT NULL,
        value         JSONB,
        prev_value    JSONB,
        kind          TEXT NOT NULL DEFAULT 'transition',
        -- Kontekstkolonner som gjør pattern-spørringer raske
        hour_of_day   SMALLINT,
        day_of_week   SMALLINT,
        is_weekend    BOOLEAN,
        is_dark       BOOLEAN,
        outdoor_temp  REAL,
        someone_home  BOOLEAN
      )
    `);

    // Lag hypertable hvis Timescale finnes (ekvivalent med å partisjonere på ts)
    if (hasTimescale) {
      try {
        await p.query(`SELECT create_hypertable('device_events', 'ts', if_not_exists => TRUE)`);
      } catch (e) {
        console.warn('[db] create_hypertable warning:', e.message);
      }
    }

    // Indekser for vanlige spørrings-mønstre
    await p.query(`CREATE INDEX IF NOT EXISTS idx_dev_events_device_ts   ON device_events (device_id, ts DESC)`);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_dev_events_capability ON device_events (capability, ts DESC)`);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_dev_events_zone_ts    ON device_events (zone, ts DESC)`);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_dev_events_kind_ts    ON device_events (kind, ts DESC)`);

    // Patterns: oppdagede mønstre fra lag-2-detektoren
    await p.query(`
      CREATE TABLE IF NOT EXISTS patterns (
        id           BIGSERIAL PRIMARY KEY,
        detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        kind         TEXT NOT NULL,           -- 'co_occurrence' | 'time_based' | 'sequence'
        description  TEXT NOT NULL,
        data         JSONB NOT NULL,
        confidence   REAL,
        support      INT,
        score        REAL,
        active       BOOLEAN DEFAULT TRUE,
        user_feedback TEXT                    -- 'accepted' | 'rejected' | null
      )
    `);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_patterns_kind_score ON patterns (kind, score DESC)`);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_patterns_active     ON patterns (active, score DESC)`);

    // Suggestions: AI-genererte automatiseringsforslag
    await p.query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id            BIGSERIAL PRIMARY KEY,
        generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        title         TEXT NOT NULL,
        description   TEXT NOT NULL,
        trigger_text  TEXT,
        action_text   TEXT,
        why           TEXT,
        confidence    TEXT,                   -- 'high' | 'medium' | 'low'
        pattern_ids   BIGINT[],
        model         TEXT,
        status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'later' | 'rejected'
        reviewed_at   TIMESTAMPTZ
      )
    `);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions (status, generated_at DESC)`);

    // Auto-flows: AI-genererte automatiseringer som faktisk kjøres av serveren
    await p.query(`
      CREATE TABLE IF NOT EXISTS auto_flows (
        id                   BIGSERIAL PRIMARY KEY,
        title                TEXT NOT NULL,
        description          TEXT,
        source_suggestion_id BIGINT,
        trigger              JSONB NOT NULL,   -- { type: 'device_change'|'time', ... }
        actions              JSONB NOT NULL,   -- [{ type: 'set_capability', deviceId, capability, value }]
        enabled              BOOLEAN NOT NULL DEFAULT TRUE,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_run_at          TIMESTAMPTZ,
        last_run_ok          BOOLEAN,
        last_error           TEXT,
        run_count            INT NOT NULL DEFAULT 0,
        min_interval_seconds INT NOT NULL DEFAULT 5   -- throttling: ikke kjør oftere enn dette
      )
    `);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_auto_flows_enabled ON auto_flows (enabled)`);

    // Run-historikk for hver auto-flow-kjøring
    await p.query(`
      CREATE TABLE IF NOT EXISTS auto_flow_runs (
        id              BIGSERIAL PRIMARY KEY,
        flow_id         BIGINT NOT NULL REFERENCES auto_flows(id) ON DELETE CASCADE,
        run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        trigger_event   JSONB,
        actions_result  JSONB,
        ok              BOOLEAN,
        duration_ms     INT
      )
    `);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_auto_flow_runs_flow_ts ON auto_flow_runs (flow_id, run_at DESC)`);

    migrationsRan = true;
    console.log('[db] migrations ok — timescale:', hasTimescale ? 'yes' : 'no');
    return true;
  } catch (err) {
    console.error('[db] migrations failed:', err.message);
    return false;
  }
}

export async function shutdown() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
