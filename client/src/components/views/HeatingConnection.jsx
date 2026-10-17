import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
export function HeatingConnection({connection, onChange}) {
  const [owner,setOwner]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[devices,setDevices]=useState([]),[selected,setSelected]=useState('');
  useEffect(()=>{const c=new AbortController();apiFetch('/api/session',{signal:c.signal}).then(r=>r.ok?r.json():null).then(s=>setOwner(s?.method==='google'&&s?.role==='admin')).catch(()=>{});return()=>c.abort();},[]);
  async function request(action,body,method='POST') {
    setBusy(true);setMessage('');
    try {
      const r=await apiFetch(`/api/heating/${action}`,{method,headers:{'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body||{})}:{})});
      if(!r.ok)throw new Error();const result=await r.json();
      if(action==='connect') {const url=new URL(result.url);if(url.origin!=='https://api.myuplink.com'||url.pathname!=='/connect/authorize')throw new Error();window.location.assign(url.href);}
      else if(action==='systems') {setDevices(result.devices||[]);setSelected('');}
      else {setDevices([]);setSelected('');setMessage(action==='disconnect'?'Lokal lesetilgang fjernet. Tilbakekall også appens tilgang i myUplink ved behov.':'Varmepumpen er valgt.');onChange();}
    }catch{setMessage('Kunne ikke fullføre. Kontroller tilkoblingsstatus og prøv igjen.');}finally{setBusy(false);}
  }
  return <article className="heating-panel"><h2>Tilkobling til myUplink</h2>
    <p>{connection?.reason || 'Serveroppsett og godkjent lesetilgang mangler.'}</p>
    {!connection?.configured && <p>OAuth-koden er klar, men avskrudd. Klient, krypteringsnøkkel og privat tokenlager må først konfigureres sikkert på serveren. Ikke send nøkler i chat.</p>}
    {connection?.configured && <><p>{connection.offline?'Godkjent oppsett ber om lesetilgang med automatisk fornying.':'Oppsettet ber kun om lesetilgang for en begrenset økt.'} Ingen temperaturer eller innstillinger kan endres.</p>{!owner&&<p>Logg inn med eierens Google-konto for å administrere tilkoblingen.</p>}
      {(!connection.connected||connection.reauthorizationRequired)&&<button disabled={!owner||busy} onClick={()=>request('connect')}>Koble til myUplink – kun lesing</button>}
      {connection.connected&&<><button disabled={!owner||busy} onClick={()=>request('systems',null,'GET')}>Hent mine enheter</button><button disabled={!owner||busy} onClick={()=>request('disconnect')}>Fjern lokal lesetilgang</button><p>Velg bare riktig NIBE-enhet etter å ha kontrollert ID mot din myUplink-konto.</p></>}
      {!!devices.length&&<><label>Bekreftet varmepumpe<select aria-label="Bekreftet varmepumpe" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Velg enhet</option>{devices.map((d,i)=><option value={i} key={`${d.systemId}-${d.deviceId}`}>{d.name} · {d.deviceId} · system {d.systemId}</option>)}</select></label><button disabled={busy||!owner||selected===''} onClick={()=>request('select',devices[Number(selected)])}>Bruk denne enheten for lesing</button></>}
    </>}
    {message&&<p role="status">{message}</p>}
    {new URLSearchParams(window.location.search).get('myuplink')==='failed'&&<p role="alert">myUplink-innloggingen ble ikke fullført. Ingen ny tilgang ble lagret fra dette forsøket.</p>}
  </article>;
}
