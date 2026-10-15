import {chromium} from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='/tmp/dashboard-build-isolated/client/dist';
const server=http.createServer(async(req,res)=>{try{const path=req.url==='/'?'/index.html':req.url;res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(root+path));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
let mode='live';const requests=[],errors=[];
const room={id:'testroom',name:'Teststue',quality:'live',devices:1,lightsOn:1,offline:[],temperature:[{deviceId:'sensor',name:'Testsensor',value:21}],alarms:[]};
const overview={quality:'live',updatedAt:'2026-10-15T12:00:00Z',brief:[{text:'Teststue: 21 °C fra målt sensor.'}],rooms:[room],routines:[{deviceId:'testlight',hour:18,suggestion:'Testlampe brukes rundt klokken 18.',limitation:'Polling er omtrentlig.',eventIds:[1,2,3]}],energy:{note:'Målt øyeblikkseffekt',measured:[{deviceId:'testlight',name:'Testlampe',watts:12}]}};
for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==origin)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();requests.push({path:url.pathname,method:req.method()});let body={},status=200;
 if(url.pathname==='/api/session'){status=req.headers().authorization?200:401;body={role:'admin'};}
 else if(mode==='error'&&url.pathname.endsWith('/overview')){status=503;body={error:'Test: avlesning utilgjengelig'};}
 else if(url.pathname.endsWith('/overview'))body=mode==='unknown'?{...overview,quality:'unavailable',rooms:[],routines:[],brief:[{text:'Ingen ferske avlesninger.'}],energy:{note:'Ingen målinger',measured:[]}}:overview;
 else if(url.pathname.endsWith('/timeline'))body={items:[{id:'test-event',ts:'2026-10-15T12:00:00Z',type:'observation',device_name:'Testlampe',capability:'dim',prev_value:0.2,value:0.3,explanation:'Observert endring. Årsak ukjent.'}]};
 else if(url.pathname.endsWith('/auto-flows'))body={flows:[{id:'testflow',title:'Testautomasjon'}]};
 else if(url.pathname.includes('/simulate/'))body={count:3,executed:0,limitation:'Ingen handlinger utført.',matches:[]};
 else if(url.pathname.endsWith('/run'))body={id:'test-action',message:'Test: bekreftet av fixture',results:[{deviceId:'testlight',confirmed:true}],undoAvailable:true};
 else if(url.pathname.endsWith('/undo'))body={ok:true};
 else body={scenes:{film:{actions:[{deviceId:'testlight',capability:'dim',value:0.3}]}}};
 return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});});
 mode='live';await page.goto(origin);await page.getByLabel('Tilgangsnøkkel').fill('fixture-only-no-real-secret');await page.getByRole('button',{name:'Logg inn',exact:true}).click();await page.getByRole('heading',{name:'Huspuls',exact:true}).waitFor();await page.getByText('Teststue: 21 °C fra målt sensor.').waitFor();assert.equal(await page.getByLabel('Lys',{exact:true}).count(),1,'saved scene hydrated');
 for(const heading of ['Husbrief','Levende romoversikt','Lærende rutineforslag','Prøv automasjonen på historikken','Stemninger','Energidetektiven','Forklarbar tidslinje'])assert.equal(await page.getByRole('heading',{name:heading,exact:true}).count(),1);
 await page.locator('select').first().selectOption('testflow');await page.getByText('3 mulige kjøringer · 0 utførte handlinger').waitFor();assert.equal(requests.filter(r=>r.path.includes('/simulate/')&&r.method!=='GET').length,0);
 await page.getByRole('button',{name:'Kjør lagret stemning'}).click();await page.getByRole('button',{name:'Angre hvis lysene er uendret'}).click();await page.getByText('Angre bekreftet',{exact:true}).waitFor();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');await page.screenshot({path:`/tmp/dashboard-browser-check/${name}-live.png`,fullPage:true});
 mode='error';await page.getByRole('button',{name:'Oppdater avlesninger'}).click();await page.getByRole('alert').waitFor();await page.getByText(/Utdatert avlesning/).first().waitFor();
 mode='unknown';await page.getByRole('button',{name:'Oppdater avlesninger'}).click();await page.getByText('Romstatus kan ikke hentes.').waitFor();await page.getByText('Ingen ferske effektmålinger tilgjengelig.').waitFor();await page.screenshot({path:`/tmp/dashboard-browser-check/${name}-unknown.png`,fullPage:true});
 await context.close();
}
assert.deepEqual(errors,[]);await browser.close();server.close();console.log(JSON.stringify({passed:true,viewports:['1440x1000','390x844'],features:7,pageErrors:errors,apiRequests:requests.length,externalRequests:'blocked',screenshots:4}));
