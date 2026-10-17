const privateIp = ip => typeof ip === 'string' && /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(p=>String(Number(p))===p&&Number(p)<=255) && (ip.startsWith('10.')||ip.startsWith('192.168.')||(/^172\./.test(ip)&&Number(ip.split('.')[1])>=16&&Number(ip.split('.')[1])<=31));
export function importNetwork(previous, input, now=Date.now()) {
 if(!Array.isArray(input?.nodes)||!input.nodes.length||input.nodes.length>64)throw Error('Oppgi 1–64 noder');
 const seen=new Set(),ips=new Set();
 const nodes=input.nodes.map(n=>{
  const mac=typeof n.mac==='string'?n.mac.toLowerCase():'';
  if(!privateIp(n.ip)||!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(mac)||seen.has(mac)||ips.has(n.ip))throw Error('Ugyldig eller duplisert privat IP/MAC');
  seen.add(mac);ips.add(n.ip);
  return {ip:n.ip,mac,name:typeof n.name==='string'?n.name.trim().slice(0,80):'Mulig Deco-node',model:null,verified:false};
 });
 const observedAt=input.source==='local-arp-cache'&&Number.isFinite(input.observedAt)&&input.observedAt>0&&input.observedAt<=now+5000?input.observedAt:null;
 if(input.source==='local-arp-cache'&&!observedAt)throw Error('Gyldig observasjonstid kreves');
 const source=observedAt?'local-arp-cache':'owner-list';
 const old=previous?.nodes||[],events=(previous?.events||[]).filter(e=>e.at>now-7*86400000);
 for(const n of nodes){const p=old.find(x=>x.mac===n.mac);if(!p||p.ip!==n.ip)events.push({at:now,kind:p?'address-changed':'registered',mac:n.mac,ip:n.ip,previousIp:p?.ip||null});}
 for(const n of old)if(!seen.has(n.mac))events.push({at:now,kind:'removed-from-list',mac:n.mac,ip:n.ip});
 return {nodes,source,observedAt,importedAt:now,events:events.slice(-500)};
}
export function networkView(state,now=Date.now()){
 return {...state,nodes:state?.nodes||[],events:(state?.events||[]).filter(e=>e.at>now-7*86400000).slice(-500).reverse(),connected:false,clientCount:null,clients:null,stale:!state?.observedAt||now-state.observedAt>300000,retentionDays:7};
}
