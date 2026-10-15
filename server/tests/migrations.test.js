import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';

// Embedded PostgreSQL, in memory. No sockets, connection strings or production data.
test('additive migration preserves history and enabled flows; repeat runs are idempotent', async () => {
  const db = new PGlite();
  const pool = {
    on() {},
    async query(sql, params) {
      if (sql.includes('CREATE EXTENSION')) throw new Error('Optional extension unavailable in test');
      // Advisory locking coordinates separate PostgreSQL connections; PGlite has one connection.
      if (sql.includes('pg_advisory_xact_lock')) return {rows:[{}]};
      if (!params?.length && sql.includes(';')) return (await db.exec(sql)).at(-1);
      return db.query(sql,params);
    },
    async connect() {return {...this,release(){}};}
  };
  const originalSource=fs.readFileSync(new URL('../lib/db.js',import.meta.url),'utf8');
  assert.ok(originalSource.includes('export async function runMigrations'), 'DB source must be complete');
  function moduleFor(legacy=false) {
    let source=originalSource.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
    if(legacy) {
      const start=source.indexOf('    await p.query(`CREATE TABLE IF NOT EXISTS schema_migrations');
      const end=source.indexOf('    migrationsRan = true;',start);
      assert.ok(start>0 && end>start, 'Legacy fixture must remove only the additive migration');
      source=source.slice(0,start)+source.slice(end);
    }
    const context=vm.createContext({pg:{Pool:function(){return pool;}},process:{env:{DATABASE_URL:'test-fixture'}},console:{log(){},warn(){},error(){}}});
    vm.runInContext(source+'\nglobalThis.migrate=runMigrations;',context);return context.migrate;
  }
  try {
    assert.equal(await moduleFor(true)(),true);
    await db.query("INSERT INTO device_events(device_id,capability,value,kind) VALUES ('fixture','onoff','true','transition')");
    await db.query("INSERT INTO auto_flows(title,trigger,actions,enabled) VALUES ('existing','{}','[]',true)");
    assert.equal(await moduleFor()(),true);
    assert.equal(await moduleFor()(),true);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM device_events')).rows[0].n,1);
    assert.equal((await db.query('SELECT enabled FROM auto_flows')).rows[0].enabled,true);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM schema_migrations')).rows[0].n,1);
    assert.equal((await db.query('SELECT time_source FROM device_events')).rows[0].time_source,'legacy_unknown');
    await db.query("INSERT INTO auto_flows(title,trigger,actions) VALUES ('new','{}','[]')");
    assert.equal((await db.query("SELECT enabled FROM auto_flows WHERE title='new'")).rows[0].enabled,false);
    // PostgreSQL executes the actual cooldown reservation SQL atomically.
    const claim="UPDATE auto_flows SET last_run_at=NOW() WHERE id=$1 AND enabled=true AND (last_run_at IS NULL OR last_run_at<=NOW()-make_interval(secs=>min_interval_seconds)) RETURNING id";
    assert.equal((await db.query(claim,[1])).rows.length,1);
    assert.equal((await db.query(claim,[1])).rows.length,0);
  } finally {await db.close();}
});
