import {useEffect,useState}from 'react';import {apiFetch}from '../lib/api.js';
// Store bilder (og HEIC der nettleseren kan lese dem) skaleres ned til maks 2400 px JPEG
// før opplasting, slik serveren uansett lagrer dem. Det gjør opplasting rask også på mobil.
const MAX_SIDE=2400,SERVER_MAX=25*1024*1024,DIRECT=['image/jpeg','image/png','image/webp'];
export async function prepareImage(file){
 const direct=DIRECT.includes(file.type);
 if(direct&&file.size<=4*1024*1024)return file;
 let bitmap;
 try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}
 catch{if(direct&&file.size<=SERVER_MAX)return file;throw Error(`Kunne ikke lese «${file.name}». Velg JPEG, PNG eller WebP.`);}
 const scale=Math.min(1,MAX_SIDE/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
 canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.9));
 if(!blob)throw Error(`Kunne ikke gjøre klar «${file.name}»`);
 return blob;
}
function Photo({photo,onSave}){const [src,setSrc]=useState(''),[description,setDescription]=useState(photo.description),[confirmed,setConfirmed]=useState(photo.userConfirmed);
 useEffect(()=>{const c=new AbortController();let url;apiFetch(`/api/room-photos/images/${photo.id}`,{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();const b=await r.blob();if(!c.signal.aborted){url=URL.createObjectURL(b);setSrc(url);}}).catch(()=>{});return()=>{c.abort();if(url)URL.revokeObjectURL(url);};},[photo.id]);
 return <article className="panel p-3">{src?<img src={src} alt={description||'Opplastet rombilde'} className="w-full h-48 object-contain rounded"/>:<p>Bilde utilgjengelig / laster</p>}<p className="text-xs mt-2">Lastet opp · Ikke analysert · {photo.userConfirmed?'Beskrivelse brukerbekreftet':'Ikke brukerbekreftet'}</p><label className="block text-sm mt-2">Beskriv rommet<textarea maxLength={2000} className="block w-full bg-nx-bg border border-nx-line p-2" value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="block text-xs mt-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Jeg bekrefter beskrivelsen</label><button className="chip mt-2" onClick={()=>onSave(photo.id,{description,userConfirmed:confirmed})}>Lagre beskrivelse</button></article>;
}
export function RoomPhotos({zoneId}){const [photos,setPhotos]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;setPhotos([]);setError('');apiFetch(`/api/room-photos/rooms/${encodeURIComponent(zoneId)}`).then(async r=>{if(!r.ok)throw Error('Kunne ikke lese rombilder');const d=await r.json();if(active)setPhotos(d.photos);}).catch(e=>active&&setError(e.message));return()=>{active=false;};},[zoneId]);
 async function upload(e){const files=Array.from(e.target.files||[]);e.target.value='';setBusy(true);setError('');try{if(files.length+photos.length>20)throw Error('Maks 20 bilder per rom');for(const original of files){if(!original.type.startsWith('image/'))throw Error(`«${original.name}» er ikke et bilde`);const file=await prepareImage(original);if(file.size>SERVER_MAX)throw Error(`«${original.name}» er for stort`);const r=await apiFetch(`/api/room-photos/rooms/${encodeURIComponent(zoneId)}`,{method:'POST',headers:{'Content-Type':file.type},body:file});const d=await r.json();if(!r.ok)throw Error(d.error);setPhotos(p=>[...p,d]);}}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function save(id,patch){try{const r=await apiFetch(`/api/room-photos/images/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});const d=await r.json();if(!r.ok)throw Error(d.error);setPhotos(p=>p.map(x=>x.id===id?d:x));setError('');}catch(e){setError(e.message);}}
 return <section className="panel p-4 mt-4"><h3 className="panel-title">Bilder av rommet</h3><p className="text-xs text-nx-mute mt-2">Privat lagret i dashboardet, knyttet til dette Homey-rommet. Ingen bildeanalyse eller automatisk 3D-rekonstruksjon er aktivert. Bildene sendes ikke til en bildemodell.</p><label className="btn inline-block mt-3">{busy?'Laster opp…':'Last opp bilder av rommet'}<input aria-label="Last opp bilder av rommet" className="block mt-2 text-xs" type="file" multiple accept="image/*" disabled={busy} onChange={upload}/></label><p className="text-xs mt-2">Alle vanlige bildeformater · store bilder skaleres automatisk ned til 2400 px · 20 bilder per rom. Metadata fjernes.</p>{error&&<p role="alert" className="text-nx-amber">{error}</p>}<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">{photos.map(p=><Photo key={p.id} photo={p} onSave={save}/>)}</div></section>;
}
