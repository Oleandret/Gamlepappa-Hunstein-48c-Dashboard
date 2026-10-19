import fsp from 'node:fs/promises';
import path from 'node:path';

/**
 * Enkel JSON-fil-basert config-store. All brukerkonfig (pins på framsiden,
 * floor plan pins, sensor-widgets, lenker, flow-favoritter, bilde-config)
 * lagres her per namespace.
 *
 * Filsti: process.env.CONFIG_PATH (default: <projektrot>/data/config.json).
 * For persistens på Railway: legg til en Volume og mount den på /data,
 * sett deretter CONFIG_PATH=/data/config.json som env-variabel.
 *
 * Skriver med atomic rename (write to .tmp, deretter rename) så filen
 * aldri blir delvis skrevet hvis prosessen krasjer midt under en write.
 */

const DEFAULT_PATH = path.resolve(process.cwd(), 'data', 'config.json');
const CONFIG_PATH = process.env.CONFIG_PATH || DEFAULT_PATH;

let _loading = null;
let _cache = null;       // {[namespace]: any}
let _writeQueue = Promise.resolve();  // pending Promise to serialize writes

async function ensureDir() {
  const dir = path.dirname(CONFIG_PATH);
  await fsp.mkdir(dir, { recursive: true });
}

async function load() {
  if (_cache) return _cache;
  if (!_loading) _loading = loadFile().finally(() => { _loading = null; });
  return _loading;
}
async function loadFile() {
  try {
    const raw = await fsp.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Config must be an object');
    _cache = parsed;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new Error('Cannot read config; existing file preserved', { cause: err });
    }
    _cache = {};
  }
  return _cache;
}

async function persist() {
  await ensureDir();
  const tmp = CONFIG_PATH + '.tmp';
  const data = JSON.stringify(_cache, null, 2);
  await fsp.writeFile(tmp, data, 'utf8');
  await fsp.rename(tmp, CONFIG_PATH);
}

function mutate(update) {
  const task = _writeQueue.catch(() => {}).then(async () => {
    await load();
    const previous = _cache;
    _cache = structuredClone(previous);
    update(_cache);
    try { await persist(); } catch (err) { _cache = previous; throw err; }
  });
  _writeQueue = task;
  return task;
}

export async function getAll() {
  await _writeQueue.catch(() => {});
  return structuredClone(await load());
}

export async function getNamespace(ns) {
  const all = await getAll();
  return all[ns];
}

export async function setNamespace(ns, value) {
  await mutate(all => { all[ns] = value; });
  return value;
}

// Les-endre-skriv i samme skrivekø, så samtidige endringer ikke overskriver hverandre.
export async function updateNamespace(ns, update) {
  let result;
  await mutate(all => { all[ns] = update(all[ns]); result = all[ns]; });
  return structuredClone(result);
}

export async function deleteNamespace(ns) {
  await mutate(all => { delete all[ns]; });
}

export function configPath() { return CONFIG_PATH; }
