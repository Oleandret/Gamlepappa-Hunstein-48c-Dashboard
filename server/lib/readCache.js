export function cachedReader(loader, ttlMs = 5000) {
  let value, expires = 0, pending;
  const read = async () => {
    if (value !== undefined && Date.now() < expires) return value;
    if (!pending) pending = loader().then(data => {value=data;expires=Date.now()+ttlMs;return data;}).finally(()=>{pending=null;});
    return pending;
  };
  read.invalidate = () => { expires=0; };
  return read;
}
