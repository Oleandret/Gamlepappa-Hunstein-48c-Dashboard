import {Router} from 'express';import fs from 'node:fs/promises';import path from 'node:path';
import {configPath} from '../lib/configStore.js';import {localDate,priceUrl}from '../lib/spotPrices.js';import {priceLogStatus}from '../workers/priceLogger.js';
export const priceRoutes=Router();
priceRoutes.get('/',async(req,res)=>{
 const date=req.query.date||localDate(Date.now());try{priceUrl(date,'NO2');}catch{return res.status(400).json({error:'Ugyldig dato'});}
 try{const dir=path.join(path.dirname(configPath()),'spot-prices');const names=(await fs.readdir(dir)).filter(n=>n.startsWith(`${date}_NO2_`)&&/^\d{4}-\d{2}-\d{2}_NO2_(?:[0-9]{13}_)?[a-f0-9]{24}\.json$/.test(n));let latest=null;
 for(const n of names){const file=path.join(dir,n),st=await fs.lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.size>65536)throw Error();const record=JSON.parse(await fs.readFile(file,'utf8'));if(!latest||record.firstObservedAt>latest.firstObservedAt)latest=record;}
 res.json({area:'NO2',date,record:latest,available:!!latest,logger:priceLogStatus});
 }catch(e){if(e.code==='ENOENT')return res.json({area:'NO2',date,record:null,available:false,logger:priceLogStatus});res.status(503).json({error:'Prisarkiv utilgjengelig'});}
});
