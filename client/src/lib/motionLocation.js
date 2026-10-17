export function motionLocation(event,zones={}){
 const room=zones[event.zone]?.name||(event.room&&event.room!=='Ukjent rom'?event.room:'Ukjent rom');
 let zone=event.zone;const seen=new Set(),names=[];
 while(zone&&zones[zone]&&!seen.has(zone)&&seen.size<20){seen.add(zone);names.push(zones[zone].name||'');zone=zones[zone].parent;}
 const text=names.join(' '),h=/hunstein/i.test(text),c=/halsaneset/i.test(text);
 const site=h&&!c?'Hunstein (Homey-sonenavn)':c&&!h?'Halsaneset (Homey-sonenavn)':'Anlegg ubekreftet';
 return {room,site};
}
