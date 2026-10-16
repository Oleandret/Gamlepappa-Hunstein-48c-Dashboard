import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';
export function AuthGate({children}) {
  const [ready,setReady]=useState(false),[token,setToken]=useState(''),[error,setError]=useState('');
  async function check() {
    try {const r=await apiFetch('/api/session');setReady(r.ok);if(!r.ok)setError('Oppgi tilgangsnøkkelen fra administrator.');}
    catch {setError('Serveren er utilgjengelig.');}
  }
  useEffect(()=>{check();const reset=()=>setReady(false);window.addEventListener('dashboard-auth-required',reset);return()=>window.removeEventListener('dashboard-auth-required',reset);},[]);
  if(ready) return <><button className="btn fixed bottom-2 left-2 z-50 text-xs" onClick={()=>{sessionStorage.removeItem('dashboard.session');setReady(false);}}>Logg ut</button>{children}</>;
  return <main className="min-h-screen grid place-items-center bg-nx-bg text-nx-text"><form className="panel p-8 max-w-md" onSubmit={e=>{e.preventDefault();sessionStorage.setItem('dashboard.session',token);setToken('');check();}}><h1 className="text-xl">Logg inn i dashboardet</h1><p className="my-3 text-sm">Tilgangen styres av administrator. Nøkkelen brukes bare i denne nettleserøkten.</p><label>Tilgangsnøkkel<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} className="block w-full bg-nx-bg border p-2 my-2" /></label><button className="btn">Logg inn</button><p role="status" className="mt-3 text-sm">{error}</p></form></main>;
}
