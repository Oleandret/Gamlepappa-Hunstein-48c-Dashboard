import { timingSafeEqual, createHash } from 'node:crypto';
import { googleAuth } from './googleAuth.js';
const digest = value => createHash('sha256').update(value).digest();
export function authConfigured(configured = process.env.AUTH_TOKENS_JSON) {
  try { const tokens = JSON.parse(configured); return tokens && !Array.isArray(tokens) && Object.entries(tokens).some(([role,value]) => ['viewer','operator','admin'].includes(role) && typeof value === 'string' && value.length >= 24); }
  catch { return false; }
}
export function authenticate(header, configured) {
  if (!authConfigured(configured)) return null;
  let tokens;
  try { tokens = JSON.parse(configured); } catch { return null; }
  const token = /^Bearer (.+)$/.exec(header || '')?.[1];
  if (!token || token.length > 512) return null;
  for (const [role, expected] of Object.entries(tokens)) {
    if (['viewer','operator','admin'].includes(role) && typeof expected === 'string' && expected.length >= 24 && timingSafeEqual(digest(token), digest(expected))) return role;
  }
  return null;
}
const attempts = new Map();
export function accessControl(req, res, next) {
  // Explicit demo is isolated from real Homey/MCP/AI and needs no permanent credential.
  const demo = process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production';
  const session = !demo && req.headers.authorization === undefined ? googleAuth.session(req) : null;
  const role = demo ? 'admin' : session?.role || authenticate(req.headers.authorization, process.env.AUTH_TOKENS_JSON);
  if (!role) return res.status(401).json({ error: 'Innlogging kreves', code: 'AUTH_REQUIRED' });
  if (session && !['GET','HEAD'].includes(req.method) && !googleAuth.csrfValid(req, session)) return res.status(403).json({ error: 'Last siden på nytt og prøv igjen', code: 'CSRF_REQUIRED' });
  const now = Date.now();
  for (const [key,v] of attempts) if (now - v.ts > 60_000) attempts.delete(key);
  const key = req.ip;
  const limit = req.path.startsWith('/chat') ? 12 : 180;
  const bucketKey = key + (req.path.startsWith('/chat') ? ':chat' : ':api');
  const bucket = attempts.get(bucketKey) || { ts: now, count: 0 };
  if (attempts.size > 10000 || ++bucket.count > limit) return res.status(429).json({error:'For mange forespørsler'});
  attempts.set(bucketKey,bucket);
  if (!['GET','HEAD'].includes(req.method) && !(req.method === 'POST' && req.path === '/logout')) {
    const required = /^\/(homey|chat)\//.test(req.path) || /^\/experience\/scenes\/[^/]+\/(run|undo)$/.test(req.path) ? 'operator' : 'admin';
    if (role === 'viewer' || (required === 'admin' && role !== 'admin')) return res.status(403).json({error:'Mangler rettighet'});
  }
  req.user = { role, method: session ? 'google' : demo ? 'demo' : 'bearer', ...(session ? { csrfToken: session.csrfToken } : {}) };
  next();
}
