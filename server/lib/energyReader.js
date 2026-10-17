// Read-only, single-flight cache. Last successful timestamp is never refreshed on errors.
export function energyReader(load, {ttl=60_000, now=Date.now}={}) {
  let value, updatedAt=null, nextAttempt=0, failures=0, pending;
  const result=(quality,reason=null)=>({value:value??null,quality,updatedAt,retryAt:nextAttempt,reason});
  return async () => {
    if(now()<nextAttempt) return result(failures ? (value===undefined?'missing':'stale') : 'live', failures?'Kilden er midlertidig utilgjengelig':null);
    if(pending) return pending;
    pending=Promise.resolve().then(load).then(data=>{
      value=data; updatedAt=now(); failures=0; nextAttempt=now()+ttl; return result('live');
    }).catch(error=>{
      failures++;
      const throttled=error.upstreamStatus===429;
      const retry=Number(error.retryAfterMs);
      nextAttempt=now()+Math.max(ttl, Math.min(900_000,throttled?60_000*2**Math.min(failures-1,4):ttl*2**Math.min(failures-1,4)),Number.isFinite(retry)?Math.min(retry,3_600_000):0);
      return result(value===undefined?'missing':'stale',throttled?'Homey begrenser forespørsler (429)':'Kilden er ikke tilgjengelig');
    }).finally(()=>{pending=null;});
    return pending;
  };
}
