export function cachedReader(loader, ttlMs = 5000) {
  let value, expires = 0, pending, generation = 0, failure, retryAt = 0, failures = 0;
  const read = async () => {
    if (value !== undefined && Date.now() < expires) return value;
    if (failure && Date.now() < retryAt) throw failure;
    if (!pending) {
      const startedGeneration = generation;
      const request = Promise.resolve().then(loader).then(data => {
        if (generation === startedGeneration) { value = data; expires = Date.now() + ttlMs; failure = null; failures = 0; retryAt = 0; }
        return data;
      }).catch(error => {
        if (generation === startedGeneration) {
          failure = error; failures++;
          retryAt = Date.now() + Math.max(Math.min(900_000, 60_000 * 2 ** Math.min(failures - 1, 4)), Math.min(3_600_000, Number(error.retryAfterMs) || 0));
        }
        throw error;
      }).finally(() => { if (pending === request) pending = null; });
      pending = request;
    }
    return pending;
  };
  read.invalidate = () => { generation++; expires = 0; pending = null; };
  return read;
}
