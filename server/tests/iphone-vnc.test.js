import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import http from 'node:http';import {createHash} from 'node:crypto';
import {createIphoneProxy,upgradeTarget} from '../lib/iphoneProxy.js';

test('upgradeTarget lets only the VNC bridge through',()=>{
 assert.equal(upgradeTarget('/iphone/api/mac/vnc?mac=stue'),'/api/mac/vnc?mac=stue');
 assert.equal(upgradeTarget('/iphone/api/mac/vnc'),'/api/mac/vnc');
 assert.equal(upgradeTarget('/iphone/api/mac/vnc?mac=../x'),null);
 assert.equal(upgradeTarget('/iphone/api/mac/stream'),null);
 assert.equal(upgradeTarget('/api/mac/vnc'),null);
 assert.equal(upgradeTarget(undefined),null);
});

// iphone-remote på liksom: /login gir øktcookie, oppgraderinger krever den og svarer med én binær ramme.
function fakeRemote(){
 const seen=[],sockets=new Set();
 const srv=http.createServer((req,res)=>{
  if(req.method==='POST'&&req.url==='/login'){res.setHeader('set-cookie','sid=abc; Path=/; HttpOnly');return res.end('{}');}
  res.statusCode=404;res.end();
 });
 srv.on('upgrade',(req,socket)=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));
  seen.push({url:req.url,cookie:req.headers.cookie,key:req.headers['sec-websocket-key']});
  if(req.headers.cookie!=='sid=abc'){socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');return;}
  const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const payload=Buffer.from('RFB 003.008\n');socket.write(Buffer.concat([Buffer.from([0x82,payload.length]),payload]));
  socket.on('data',()=>{});
 });
 const close=()=>{for(const s of sockets)s.destroy();srv.closeAllConnections();srv.close();};
 return new Promise(r=>srv.listen(0,()=>r({srv,seen,close,url:`http://127.0.0.1:${srv.address().port}`})));
}

test('VNC WebSocket is forwarded to iphone-remote with the server-side session, ticket required',async()=>{
 const remote=await fakeRemote();
 const env={IPHONE_REMOTE_URL:remote.url,IPHONE_REMOTE_USER:'ole',IPHONE_REMOTE_PASSWORD:'x'};
 const iphone=createIphoneProxy({env,isProd:false});   // http mot iphone-remote godtas utenfor produksjon
 const app=express();app.use('/api',(req,_res,next)=>{req.user={role:'admin'};next();});app.use('/api/iphone',iphone.sessionRoute);
 const srv=app.listen(0);await new Promise(r=>srv.once('listening',r));
 srv.on('upgrade',(req,socket,head)=>iphone.upgrade(req,socket,head));
 const base=`127.0.0.1:${srv.address().port}`;
 const open=(path,headers)=>new Promise(resolve=>{const ws=new WebSocket(`ws://${base}${path}`,{headers});ws.binaryType='arraybuffer';ws.onopen=()=>resolve({ws,ok:true});ws.onerror=()=>resolve({ws,ok:false});});
 assert.equal((await open('/iphone/api/mac/vnc?mac=stue',{})).ok,false,'uten billett');
 assert.equal(remote.seen.length,0,'ingen oppgradering uten billett');
 assert.equal((await open('/iphone/api/mac/stream',{cookie:'gp_iphone=x'})).ok,false,'feil sti');
 remote.close();srv.closeAllConnections();srv.close();
});

test('with a valid ticket the handshake and the first frame reach the browser',async()=>{
 const remote=await fakeRemote();
 const env={IPHONE_REMOTE_URL:remote.url,IPHONE_REMOTE_USER:'ole',IPHONE_REMOTE_PASSWORD:'x'};
 const iphone=createIphoneProxy({env,isProd:false});
 const app=express();app.use('/api',(req,_res,next)=>{req.user={role:'admin'};next();});app.use('/api/iphone',iphone.sessionRoute);
 const srv=app.listen(0);await new Promise(r=>srv.once('listening',r));
 srv.on('upgrade',(req,socket,head)=>iphone.upgrade(req,socket,head));
 const base=`127.0.0.1:${srv.address().port}`;
 const r=await fetch(`http://${base}/api/iphone/session`,{method:'POST'});const ticket=r.headers.get('set-cookie').split(';')[0];
 const got=await new Promise(resolve=>{const ws=new WebSocket(`ws://${base}/iphone/api/mac/vnc?mac=stue`,{headers:{cookie:ticket}});ws.binaryType='arraybuffer';ws.onmessage=e=>{resolve(Buffer.from(e.data).toString());ws.close();};ws.onerror=()=>resolve(null);});
 assert.equal(got,'RFB 003.008\n');
 assert.equal(remote.seen.length,1);assert.equal(remote.seen[0].url,'/api/mac/vnc?mac=stue');assert.equal(remote.seen[0].cookie,'sid=abc');
 remote.close();srv.closeAllConnections();srv.close();
});
