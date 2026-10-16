export function cachedReader(loader, ttlMs = 5000) {
  let value, expires = 0, pending, generation = 0;
  const read = async () => {
    if (value !== undefined && Date.now() < expires) return value;
    if (!pending) {
      const startedGeneration = generation;
      const request = Promise.resolve().then(loader).then(data => {
        if (generation === startedGeneration) { value = data; expires = Date.now() + ttlMs; }
        return data;
      }).finally(() => { if (pending === request) pending = null; });
      pending = request;
    }
    return pending;
  };
  read.invalidate = () => { generation++; expires = 0; pending = null; };
  return read;
}
