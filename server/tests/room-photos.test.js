import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import sharp from 'sharp';import {createRoomPhotos}from '../lib/roomPhotos.js';import {readFileSync}from 'node:fs';
test('private normalized photos survive reload; metadata editable without asserting analysis',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'room-photo-test-'));try{const s=createRoomPhotos(dir),b=await sharp({create:{width:4,height:4,channels:3,background:'#ffaa22'}}).png().toBuffer();const p=await s.upload('room-test',b,'image/png');assert.equal(p.analysisStatus,'not_analyzed');assert.equal((await sharp(await s.read(p.id)).metadata()).format,'jpeg');assert.equal((await createRoomPhotos(dir).list('room-test')).length,1);await s.update(p.id,{description:'Test room',userConfirmed:true});assert.equal((await s.metadata(p.id)).userConfirmed,true);assert.equal((await fs.stat(path.join(dir,p.id+'.jpg'))).mode&511,384);await assert.rejects(s.read('../secret'));await assert.rejects(s.upload('room-test',Buffer.from('<svg/>'),'image/png'));await assert.rejects(s.upload('../escape',b,'image/png'));await assert.rejects(s.upload('room-test',Buffer.alloc(5*1024*1024+1),'image/jpeg'));await assert.rejects(s.update(p.id,{description:'x'.repeat(2001),userConfirmed:true}));}finally{await fs.rm(dir,{recursive:true,force:true});}});
test('photo retrieval and upload mounted behind shared access control',()=>{const s=readFileSync(new URL('../index.js',import.meta.url),'utf8');assert.ok(s.indexOf("app.use('/api/room-photos'")>s.indexOf('}, accessControl)'));assert.ok(!s.includes("express.static('/data"));});
test('photos over 5 MB are accepted and stored downscaled; over 25 MB is refused',async()=>{
 const {default:sharp}=await import('sharp');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'room-photo-big-'));
 try{
  const big=await sharp({create:{width:4800,height:3600,channels:3,noise:{type:'gaussian',mean:128,sigma:70}}}).jpeg({quality:100}).toBuffer();
  assert.ok(big.length>5*1024*1024,`fixture must exceed 5 MB, was ${big.length}`);
  const s=createRoomPhotos(dir),m=await s.upload('zone-1',big,'image/jpeg');
  const meta=await sharp(await s.read(m.id)).metadata();
  assert.equal(Math.max(meta.width,meta.height),2400);
  await assert.rejects(()=>s.upload('zone-1',Buffer.alloc(25*1024*1024+1),'image/jpeg'),/25 MB/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
