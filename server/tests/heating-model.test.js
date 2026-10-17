import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHeatingPoints, DEFAULT_MAX_AGE_MS, MAX_POINTS } from '../../client/src/lib/heatingModel.js';

const now = Date.parse('2026-10-17T10:00:00Z');
const fetchedAt = '2026-10-17T09:59:30Z';
const point = (patch = {}) => ({
  category: 'Varmepumpe',
  parameterId: '40004',
  parameterName: 'Utetemperatur (BT1)',
  parameterUnit: '°C',
  timestamp: new Date(now - 60_000).toISOString(),
  value: 7.4,
  strVal: '7.4',
  smartHomeCategories: [],
  writable: false,
  ...patch
});
const one = (patch, options = {}) => normalizeHeatingPoints([point(patch)], { fetchedAt, now, ...options }).points[0];

test('null value is missing, never zero; NaN/Infinity/objects are missing too', () => {
  for (const value of [null, undefined, NaN, Infinity, {}, []]) assert.equal(one({ value }).quality, 'missing');
  for (const value of [null, undefined, NaN, Infinity, {}, []]) assert.equal(one({ value }).value, null);
  assert.equal(one({ value: 0 }).quality, 'measured');
  assert.equal(one({ value: 0 }).value, 0);
  // A display string does not rescue a missing numeric value.
  assert.equal(one({ value: null, strVal: '-5.2' }).quality, 'missing');
});

test('negative temperatures are real readings and keep their sign', () => {
  const row = one({ value: -12.5 });
  assert.equal(row.value, -12.5);
  assert.equal(row.valueType, 'number');
  assert.equal(row.quality, 'measured');
});

test('boolean and string values are preserved with their type, not coerced', () => {
  assert.deepEqual([one({ value: true }).value, one({ value: true }).valueType], [true, 'boolean']);
  assert.deepEqual([one({ value: false }).value, one({ value: false }).valueType], [false, 'boolean']);
  assert.equal(one({ value: false }).quality, 'measured');
  assert.deepEqual([one({ value: 'Av' }).value, one({ value: 'Av' }).valueType], ['Av', 'string']);
  assert.equal(one({ value: '7.4' }).valueType, 'string');
});

test('timestamps outside the age window, in the future, or unparseable are flagged', () => {
  assert.equal(one({ timestamp: new Date(now - DEFAULT_MAX_AGE_MS - 1).toISOString() }).quality, 'stale');
  assert.equal(one({ timestamp: new Date(now - DEFAULT_MAX_AGE_MS).toISOString() }).quality, 'measured');
  assert.equal(one({ timestamp: new Date(now + 1).toISOString() }).quality, 'stale');
  assert.equal(one({ timestamp: new Date(now - 60_000).toISOString() }, { maxAgeMs: 30_000 }).quality, 'stale');
  for (const timestamp of [undefined, null, '', 'i går', 'not-a-date', {}]) {
    const row = one({ timestamp });
    assert.equal(row.quality, 'unknown-time');
    assert.equal(row.measuredAt, null);
    assert.equal(row.value, 7.4, 'unknown time must not discard the value itself');
  }
});

test('measuredAt comes from the point timestamp, never from fetchedAt', () => {
  const measured = Date.parse('2026-10-17T09:55:00Z');
  const result = normalizeHeatingPoints([point({ timestamp: new Date(measured).toISOString() })], { fetchedAt, now });
  assert.equal(result.points[0].measuredAt, measured);
  assert.equal(result.fetchedAt, Date.parse(fetchedAt));
  assert.notEqual(result.points[0].measuredAt, result.fetchedAt);
  // A fresh fetch cannot make an old point look fresh.
  const old = normalizeHeatingPoints([point({ timestamp: '2026-10-17T06:00:00Z' })], { fetchedAt: new Date(now).toISOString(), now });
  assert.equal(old.points[0].quality, 'stale');
  assert.equal(normalizeHeatingPoints([], { fetchedAt: 'ukjent', now }).fetchedAt, null);
});

test('id, name, unit and category are kept verbatim from upstream', () => {
  const row = one({ category: 'Varmtvann', parameterName: 'Varmtvannstopp', parameterUnit: 'kWh', parameterId: '40014' });
  assert.deepEqual(
    [row.id, row.name, row.unit, row.category],
    ['40014', 'Varmtvannstopp', 'kWh', 'Varmtvann']
  );
  const bare = one({ parameterName: '', parameterUnit: '   ', category: undefined });
  assert.deepEqual([bare.name, bare.unit, bare.category], [null, null, null]);
  assert.equal(one({ parameterId: 40004 }).id, '40004');
});

test('a kWh point is not split into heat vs electricity and no COP is derived', () => {
  const row = one({ parameterUnit: 'kWh', parameterName: 'Tilført energi', value: 1234.5 });
  assert.equal(row.unit, 'kWh');
  assert.equal(row.value, 1234.5);
  for (const key of ['heat', 'electric', 'electricity', 'cop', 'efficiency']) assert.ok(!(key in row), `${key} must not be invented`);
});

test('writable is upstream metadata, never presented as permitted control', () => {
  const row = one({ writable: true });
  assert.equal(row.writableUpstream, true);
  assert.equal(one({ writable: 'true' }).writableUpstream, false);
  for (const key of ['writable', 'canControl', 'controllable', 'canWrite']) assert.ok(!(key in row), `${key} must not be exposed`);
});

test('non-array input, junk entries and oversized lists fail closed', () => {
  for (const input of [null, undefined, 'points', 42, {}]) {
    assert.deepEqual(normalizeHeatingPoints(input, { fetchedAt, now }).points, []);
  }
  const mixed = normalizeHeatingPoints([point(), null, 'junk', 7, [], { parameterName: 'Uten id' }], { fetchedAt, now });
  assert.equal(mixed.points.length, 1);
  assert.equal(mixed.skipped, 5);
  const many = normalizeHeatingPoints(Array.from({ length: MAX_POINTS + 5 }, () => point()), { fetchedAt, now });
  assert.equal(many.points.length, MAX_POINTS);
  assert.equal(many.truncated, true);
  assert.equal(normalizeHeatingPoints([point()], { fetchedAt, now }).truncated, false);
});

test('an invalid maxAgeMs falls back to the default instead of passing everything', () => {
  const old = { timestamp: new Date(now - DEFAULT_MAX_AGE_MS - 1).toISOString() };
  for (const maxAgeMs of [0, -1, NaN, 'lenge', null]) assert.equal(one(old, { maxAgeMs }).quality, 'stale');
  assert.equal(normalizeHeatingPoints([point()], { fetchedAt, now, maxAgeMs: 'lenge' }).maxAgeMs, DEFAULT_MAX_AGE_MS);
});

test('timezone-free timestamps are unknown rather than inferred from host timezone', () => {
  for (const timestamp of ['2026-10-17', '2026-10-17T10:00:00']) {
    const result = normalizeHeatingPoints([{ parameterId: 'fixture', value: 3, timestamp }]);
    assert.equal(result.points[0].quality, 'unknown-time');
  }
});
