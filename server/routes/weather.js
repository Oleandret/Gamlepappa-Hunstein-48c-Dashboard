import { Router } from 'express';
import fetch from 'node-fetch';
import { cfg } from '../config.js';

export const weatherRoutes = Router();

const MET_API = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

let cache = { ts: 0, data: null };

weatherRoutes.get('/', async (_req, res) => {
  const HOME_LAT = cfg('HOME_LAT') || '60.3913';
  const HOME_LON = cfg('HOME_LON') || '5.3221';
  const PLACE = cfg('HOME_PLACE') || 'Hunstein 48c';
  try {
    const now = Date.now();
    if (cache.data && now - cache.ts < 10 * 60 * 1000) {
      return res.json({ ...cache.data, cached: true });
    }
    const url = `${MET_API}?lat=${HOME_LAT}&lon=${HOME_LON}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'NEXORA-Hunstein-Dashboard/1.0 (oleandretorjussen@gmail.com)' }
    });
    if (!r.ok) throw new Error(`met.no ${r.status}`);
    const json = await r.json();
    const series = json.properties?.timeseries || [];
    const now0 = series[0];
    const days = pickNextDays(series, 5);
    const data = {
      place: PLACE,
      now: {
        temp: now0?.data?.instant?.details?.air_temperature,
        humidity: now0?.data?.instant?.details?.relative_humidity,
        wind: now0?.data?.instant?.details?.wind_speed,
        symbol: now0?.data?.next_1_hours?.summary?.symbol_code
          || now0?.data?.next_6_hours?.summary?.symbol_code
      },
      forecast: days
    };
    cache = { ts: now, data };
    res.json(data);
  } catch (err) {
    res.json({
      place: PLACE,
      now: { temp: 12, humidity: 67, wind: 3.4, symbol: 'partlycloudy_day' },
      forecast: [
        { day: 'Man', tempMax: 13, tempMin: 7, symbol: 'partlycloudy_day' },
        { day: 'Tir', tempMax: 14, tempMin: 8, symbol: 'cloudy' },
        { day: 'Ons', tempMax: 12, tempMin: 8, symbol: 'rain' },
        { day: 'Tor', tempMax: 11, tempMin: 6, symbol: 'rain' },
        { day: 'Fre', tempMax: 13, tempMin: 7, symbol: 'partlycloudy_day' }
      ],
      _fallback: true,
      _error: err.message
    });
  }
});

function pickNextDays(series, n) {
  const byDay = new Map();
  for (const entry of series) {
    const d = new Date(entry.time);
    const key = d.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(entry);
  }
  const days = [...byDay.entries()].slice(0, n + 1).slice(1, n + 1);
  const dayNames = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
  return days.map(([key, entries]) => {
    const temps = entries.map(e => e.data?.instant?.details?.air_temperature).filter(t => t != null);
    const tempMax = temps.length ? Math.max(...temps) : null;
    const tempMin = temps.length ? Math.min(...temps) : null;
    const middle = entries[Math.floor(entries.length / 2)];
    const symbol = middle?.data?.next_6_hours?.summary?.symbol_code
      || middle?.data?.next_1_hours?.summary?.symbol_code
      || 'cloudy';
    return {
      day: dayNames[new Date(key).getDay()],
      date: key,
      tempMax: tempMax != null ? Math.round(tempMax) : null,
      tempMin: tempMin != null ? Math.round(tempMin) : null,
      symbol
    };
  });
}
