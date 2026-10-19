// Shared wiring for heat pump setting changes and the daily settings log, so the
// route and the background logger use the same files and the same write queue.
import path from 'node:path';
import { myuplinkConfig, myuplinkOAuth } from './myuplinkOAuth.js';
import { createMyUplinkWriter } from './myuplinkWriter.js';
import { createHeatingSettingsLog } from './heatingSettingsLog.js';

let log, logDir, writer, writerKey;
export function settingsLog() {
  const cfg = myuplinkConfig();
  if (!cfg) return null;
  const dir = path.join(path.dirname(cfg.file), '../heating-settings');
  if (!log || logDir !== dir) { log = createHeatingSettingsLog({ dir }); logDir = dir; }
  return log;
}
export async function settingsWriter() {
  const cfg = myuplinkConfig(), r = await myuplinkOAuth.record();
  if (!cfg?.write) throw Object.assign(new Error('Skrivetilgang til varmepumpen er ikke godkjent i serveroppsettet (MYUPLINK_WRITE_APPROVED)'), { status: 403 });
  if (!r?.deviceId) throw Object.assign(new Error('Velg varmepumpen før innstillinger kan endres'), { status: 409 });
  const key = `${r.deviceId}:${myuplinkOAuth.revision()}`;
  if (!writer || writerKey !== key) { writer = createMyUplinkWriter({ deviceId: r.deviceId, getAccessToken: myuplinkOAuth.accessToken, changeLog: settingsLog() }); writerKey = key; }
  return writer;
}
