// Manual snapshots only. No Tesla API, wake-up, or upstream loader is accepted here.
export const isTesla = d => /tesla/i.test(`${d?.driverUri || ''} ${d?.driverId || ''} ${d?.name || ''}`);
export function createTeslaSnapshots({load, save, now=Date.now, cooldown=300000}) {
  let latest={}, pending;
  const clone = x => structuredClone(x);
  const pick = d => ({id:d.id,name:d.name,class:d.class,driverUri:d.driverUri,zone:d.zone,capabilities:clone(d.capabilities||[]),capabilitiesObj:clone(d.capabilitiesObj||{})});
  async function project(devices) {
    latest=Object.fromEntries(Object.entries(devices).filter(([,d])=>isTesla(d)).map(([id,d])=>[id,pick(d)]));
    const saved=await load() || {};
    return Object.fromEntries(Object.entries(devices).map(([id,d])=> {
      if (!isTesla(d)) return [id,d];
      const s=saved[id];
      return [id,{...pick(d),capabilities: s?.device.capabilities || [],capabilitiesObj:s?.device.capabilitiesObj || {},_teslaSnapshot:{savedAt:s?.savedAt||null,source:'Homey',manualOnly:true}}];
    }));
  }
  async function update(id) {
    if (pending) { await pending; return update(id); }
    const task=(async()=>{
      const all=await load()||{};const old=all[id];
      if(old && now()-old.savedAt<cooldown) return {...old,cooldownUntil:old.savedAt+cooldown};
      if(!Object.hasOwn(latest,id))throw Object.assign(new Error('Ingen Tesla-data i Homeys hurtiglager ennå'),{status:409});
      const snapshot={device:clone(latest[id]),savedAt:now()};
      await save({...all,[id]:snapshot});
      return {...snapshot,cooldownUntil:snapshot.savedAt+cooldown};
    })();
    pending=task;
    try{return await task;}finally{if(pending===task)pending=null;}
  }
  return {project,update};
}
