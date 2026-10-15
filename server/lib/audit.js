import { isEnabled, query } from './db.js';
export async function recordAction(kind, detail, status, actor = 'system') {
  if (!isEnabled()) return null;
  const result=await query('INSERT INTO dashboard_actions(kind,detail,status,actor) VALUES ($1,$2::jsonb,$3,$4) RETURNING id',[kind,JSON.stringify(detail),status,actor]);
  return result.rows[0].id;
}
