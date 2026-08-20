import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const dir = dirname(fileURLToPath(import.meta.url));
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port=9877;
const chrome=spawn(CHROME,['--headless=new',`--remote-debugging-port=${port}`,'--disable-gpu','--user-data-dir=' + join(tmpdir(), 'tendr-agreement-pages'),'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let page;
for(let i=0;i<60;i++){try{const j=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();page=j.find(t=>t.type==='page');if(page)break;}catch{}await sleep(250);}
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const p=new Map();
const send=(m,params={})=>new Promise((res,rej)=>{const i=++id;p.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params}));});
let lr;const loaded=new Promise(r=>lr=r);
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){const{res,rej}=p.get(m.id);p.delete(m.id);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);}if(m.method==='Page.loadEventFired')lr();});
await new Promise(r=>ws.addEventListener('open',r));
await send('Page.enable');
await send('Page.navigate',{url:'file://' + join(dir, 'agreement.html')});
await loaded;await sleep(1500);
const footer=`<div style="width:100%;font-family:'Helvetica Neue',Arial,sans-serif;font-size:6.5pt;color:#618794;padding:0 15mm;display:flex;justify-content:space-between;letter-spacing:.04em;text-transform:uppercase;"><span>Tendr Pty Ltd &nbsp;&middot;&nbsp; Estimating services agreement</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
for(const n of [1,2,3,4]){
  try{
    const {data}=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<div></div>',footerTemplate:footer,marginTop:0.63,marginBottom:0.71,marginLeft:0.591,marginRight:0.591,pageRanges:String(n)});
    writeFileSync(join(tmpdir(), `tendr-pg${n}.pdf`),Buffer.from(data,'base64'));
    execFileSync('sips',['-s','format','png','--resampleWidth','1400',join(tmpdir(),`tendr-pg${n}.pdf`),'--out',join(dir,'preview',`page${n}.png`)],{stdio:'ignore'});
    console.log('page',n,'ok');
  }catch(e){console.log('page',n,'none');}
}
ws.close();chrome.kill();process.exit(0);
