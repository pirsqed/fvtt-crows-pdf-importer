import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,relative,extname} from 'node:path';
import assert from 'node:assert/strict';
import {compare} from './comparison.mjs';
import {compareCards} from './card-comparison.mjs';
import {cardToItem} from '../scripts/item-mapper.mjs';
import {testPacketBrowser} from './packet-browser.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=process.env.CROWS_MODULE_ROOT??fileURLToPath(new URL('../',import.meta.url));
const sourceRoot=fileURLToPath(new URL('../',import.meta.url));
const library=process.env.FOUNDRY_PDFJS??'C:/Program Files/Foundry Virtual Tabletop/resources/app/node_modules/@foundryvtt/pdfjs/';
const prefix='/test-foundry/',systemPath=prefix+'modules/fvtt-crows-pdf-importer/';
const served=new Set();
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
    if(pathname===prefix+'game'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Foundry route harness</title><body>PDF.js browser integration test</body>');return;}
    let base,tail;
    if(pathname.startsWith(prefix+'scripts/pdfjs/')){base=library;tail=pathname.slice((prefix+'scripts/pdfjs/').length);}
    else if(pathname.startsWith(systemPath)){base=root;tail=pathname.slice(systemPath.length);}
    else if(pathname.startsWith(prefix+'systems/fvtt-crows-system/')){base=resolve(sourceRoot,'../fvtt-crows-system');tail=pathname.slice((prefix+'systems/fvtt-crows-system/').length);}
    else {res.writeHead(404);res.end();return;}
    const path=resolve(base,tail);
    if(relative(base,path).startsWith('..')){res.writeHead(403);res.end();return;}
    const bytes=await readFile(path);served.add(pathname);
    // Foundry 14.361+ serves package HTML as text/plain. Our launcher needs none.
    res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.html':'text/plain'})[extname(path)]??'application/octet-stream');res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage(),errors=[],unexpected=[];
  const origin=`http://127.0.0.1:${server.address().port}`;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin))unexpected.push(r.url());});
  await page.goto(origin+prefix+'game');
  await page.evaluate(async path=>{const {openPreview}=await import(path);openPreview();},systemPath+'scripts/preview.mjs');
  const $=id=>page.locator(`[data-id="${id}"]`);
  const cases=JSON.parse(await readFile(process.env.CROWS_BASELINE ?? new URL('../out/baseline.json',import.meta.url),'utf8'));
  const selected=[cases.find(c=>c.kind==='cards'&&c.expected.records.some(r=>r.raw_lines.some(l=>l.includes('12-16')))),cases.find(c=>c.kind==='traits'),cases.find(c=>c.kind==='cards'&&c.expected.records.some(r=>r.raw_lines.some(l=>l.includes('\u200b'))))];
  const cards=JSON.parse(await readFile(new URL('../out/cards-baseline.json',import.meta.url),'utf8'));
  const spellPage=cards.find(c=>c.expected.some(card=>card.spell));
  selected.push(cases.find(c=>c.file===spellPage.file&&c.page===spellPage.page&&c.kind==='cards'));
  const results=[];
  async function run(c){
    await $('file').setInputFiles(c.file);await $('kind').selectOption(c.kind);await $('page').fill(String(c.page));await $('run').click();
    await page.waitForFunction(()=>!document.querySelector('[data-id="run"]').disabled,{},{timeout:35000});
    const status=await $('status').textContent();assert.match(status,/^Extracted/);
    const actual=JSON.parse(await $('result').textContent());assert.deepEqual(compare(c.expected,actual,{normalize:true}),[]);
    if(c.kind==='cards'){
      const expected=cards.find(b=>b.file===c.file&&b.page===c.page).expected;
      assert.deepEqual(compareCards(expected,actual.parsedCards),[]);
      const withoutHTML=item=>{const copy=structuredClone(item);delete copy.system.description;delete copy.system.consumable.actionText;return copy;};
      assert.deepEqual(compareCards(expected.map(cardToItem).map(withoutHTML),actual.documents.map(withoutHTML)),[]);
      assert.equal(await $('items').locator('tr').count(),actual.documents.length+1);
      assert.equal(actual.validation.status,'unavailable'); // Route harness has no Foundry document classes.
      assert.match(await $('validation').textContent(),/active Crows world/);
    }
    return {kind:c.kind,page:c.page,records:actual.records.length,strictDifferences:compare(c.expected,actual),status};
  }
  for(const c of selected)results.push(await run(c));
  const itemCases=JSON.parse(await readFile(new URL('../out/items-baseline.json',import.meta.url),'utf8'));
  // Compare browser-parsed text, emphasis and table shape for every description.
  const rendered=await page.evaluate(pairs=>{
    const signature=html=>{
      const root=document.createElement('div');root.innerHTML=html;
      const characters=[];
      const walk=(node,bold=false,italic=false)=>{
        if(node.nodeType===Node.TEXT_NODE){for(const char of node.textContent)if(!/[\s\u200b]/.test(char))characters.push([char,bold,italic]);return;}
        for(const child of node.childNodes)walk(child,bold||['B','STRONG'].includes(node.tagName),italic||['I','EM'].includes(node.tagName));
      };
      walk(root);
      const text=root.textContent.replace(/[\s\u200b]+/g,' ').trim().replace(/([●:])\s*/g,'$1 ').replace(/(Self|Ranged \d+)\s*Dur\./g,'$1 Dur.');
      return {text,characters,tables:[...root.querySelectorAll('table')].map(t=>[...t.rows].map(r=>r.cells.length))};
    };
    return pairs.map(([expected,actual])=>JSON.stringify(signature(expected))===JSON.stringify(signature(actual)));
  },itemCases.map(({card,expected})=>[expected.system.description,cardToItem(card).system.description]));
  assert.deepEqual(rendered.map((pass,index)=>pass?null:index).filter(i=>i!==null),[]);
  await $('page').fill('9999');await $('run').click();await page.waitForFunction(()=>!document.querySelector('[data-id="run"]').disabled);
  assert.match(await $('status').textContent(),/^Page must be between/);
  await $('file').setInputFiles({name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a pdf')});await $('page').fill('1');await $('run').click();
  await page.waitForFunction(()=>!document.querySelector('[data-id="run"]').disabled);assert.doesNotMatch(await $('status').textContent(),/^Extracted/);
  await $('file').setInputFiles(selected[0].file);
  await page.evaluate(()=>{document.querySelector('dialog form').requestSubmit();document.querySelector('[data-id="cancel"]').click();});assert.equal(await $('status').textContent(),'Cancelled.');
  await run(selected[1]);
  await $('close').click();await page.locator('dialog').waitFor({state:'detached'});
  const packet=await testPacketBrowser(page,systemPath,cards);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  assert.ok([...served].some(p=>p.endsWith('/build/pdf.worker.mjs')));
  assert.ok(![...served].some(p=>p.endsWith('.html')));
  await writeFile(new URL('../out/browser-results.json',import.meta.url),JSON.stringify({packet,results,descriptions:rendered.length,invalidPage:true,invalidPDF:true,cancelAndRetry:true,launcher:true,reverseProxyPrefix:true,externalRequests:unexpected,pageErrors:errors,served:[...served]},null,2));
  console.log(JSON.stringify({packet}));
  console.log(JSON.stringify({results,invalidPage:true,invalidPDF:true,cancelAndRetry:true,launcher:true,reverseProxyPrefix:true,pageErrors:errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
