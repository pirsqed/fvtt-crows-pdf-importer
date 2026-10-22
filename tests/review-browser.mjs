import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=resolve(import.meta.dirname,'../..'),output=resolve(import.meta.dirname,'../out');
await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Import review usability checks</title>');return;}
    const file=resolve(root,decodeURIComponent(path).replace(/^\/(modules|systems)\//,''));
    if(relative(root,file).startsWith('..')){res.writeHead(403).end();return;}
    res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async()=>{
    const {setupImport}=await import('/modules/fvtt-crows-pdf-importer/tests/import-harness.mjs');
    const {openImportReview}=await import('/modules/fvtt-crows-pdf-importer/scripts/import-review.mjs');
    globalThis.env=setupImport();foundry.utils.deepClone=value=>structuredClone(value);
    globalThis.report={documents:Array.from({length:521},(_,i)=>({name:`Test equipment ${String(i+1).padStart(3,'0')}`,type:'equipment',system:{cost:1}})),actors:[],backgrounds:[],connections:[]};
    globalThis.reopen=()=>openImportReview(report);
    const pack=env.makePack('crows-equipment','Item'),create=pack.documentClass.createDocuments;
    let count=0;
    pack.documentClass.createDocuments=async data=>{
      if(++count===2){globalThis.holding=true;await new Promise(done=>{globalThis.releaseWrite=done;});}
      if(globalThis.failWrite)throw new Error('Simulated save failure');
      return create(data);
    };
    reopen();
  });
  const $=id=>page.locator(`[data-id="${id}"]`);
  const review=async()=>{
    await $('review-import').click();
    await page.waitForFunction(()=>!document.querySelector('[data-id="review-import"]').disabled);
    assert.equal(await $('save-import').isEnabled(),true);
  };
  const rows=()=>page.locator('[data-id="import-changes"] tbody tr');
  const statuses=()=>rows().evaluateAll(rows=>rows.map(row=>row.dataset.status));
  await review();assert.equal(await rows().count(),521);
  const sizes=[{width:1280,height:900},{width:600,height:650},{width:375,height:667},{width:1280,height:500}];
  for(const size of sizes){
    await page.setViewportSize(size);
    for(const bottom of [false,true]){
      const geometry=await page.evaluate(bottom=>{
        const d=document.querySelector('dialog'),body=d.querySelector('.import-review-body'),changes=d.querySelector('[data-id="import-changes"]');
        body.scrollTop=bottom?body.scrollHeight:0;changes.scrollTop=bottom?changes.scrollHeight:0;
        const dr=d.getBoundingClientRect();
        const visible=selector=>{const r=d.querySelector(selector).getBoundingClientRect();return r.top>=dr.top&&r.bottom<=dr.bottom&&r.left>=dr.left&&r.right<=dr.right;};
        return {bounded:changes.clientHeight<=340,scrollable:changes.scrollHeight>changes.clientHeight,bodyHasRoom:body.clientHeight>75,noOuterOverflow:d.scrollHeight<=d.clientHeight+1&&d.scrollWidth<=d.clientWidth+1,statusVisible:visible('[data-id="import-status"]'),buttonVisible:visible('[data-id="save-import"]')};
      },bottom);
      assert.ok(Object.values(geometry).every(Boolean),JSON.stringify({size,bottom,geometry}));
    }
    await page.screenshot({path:resolve(output,`review-${size.width}x${size.height}.png`)});
  }
  await page.setViewportSize(sizes[0]);
  await $('import-changes').evaluate(element=>{element.scrollIntoView({block:'start'});});
  assert.equal(await $('import-changes').evaluate(element=>{
    const head=element.querySelector('th').getBoundingClientRect(),region=element.getBoundingClientRect();
    return Math.abs(head.top-region.top)<=2;
  }),true,'column headings stay visible when scrolling the review table');
  await $('import-changes').evaluate(element=>{element.scrollTop=0;});
  await $('save-import').click();await page.waitForFunction(()=>globalThis.holding);
  assert.deepEqual((await statuses()).slice(0,3),['created','importing','pending']);
  assert.equal(await $('progress-label').textContent(),'1 of 521 entries processed');
  assert.equal(await rows().nth(0).locator('td').nth(3).textContent(),'Added');
  await page.screenshot({path:resolve(output,'review-importing.png')});
  await $('cancel-import').click();assert.equal(await $('cancel-import').isDisabled(),true);
  await page.evaluate(()=>releaseWrite());
  await page.waitForFunction(()=>!document.querySelector('[data-id="review-import"]').disabled);
  assert.match(await $('import-status').textContent(),/Import cancelled/);
  assert.deepEqual((await statuses()).slice(0,3),['created','created','pending']);
  assert.equal(await $('progress-label').textContent(),'2 of 521 entries processed');
  assert.equal(await $('finish-import').isVisible(),false);
  assert.equal(await $('save-import').isDisabled(),true);
  await review();await page.evaluate(()=>{globalThis.failWrite=true;});await $('save-import').click();
  await page.waitForFunction(()=>!document.querySelector('[data-id="review-import"]').disabled);
  assert.deepEqual((await statuses()).slice(0,4),['unchanged','unchanged','failed','pending']);
  assert.match(await $('import-status').textContent(),/Simulated save failure/);
  assert.match(await rows().nth(2).textContent(),/Partial changes may have been kept/);
  assert.equal(await $('progress-label').textContent(),'2 of 521 entries processed');
  assert.equal(await $('finish-import').isVisible(),false);
  await page.screenshot({path:resolve(output,'review-failed.png')});
  await page.evaluate(()=>{globalThis.failWrite=false;});await review();await $('save-import').click();
  await $('finish-import').waitFor({state:'visible'});
  assert.match(await $('completion-summary').textContent(),/519 added.*2 unchanged/);
  await $('completed-entries').locator('summary').click();
  assert.equal(await $('import-changes').isVisible(),true);
  assert.equal((await statuses()).filter(status=>status==='created').length,519);
  await page.screenshot({path:resolve(output,'review-complete.png')});
  await $('finish-import').click();assert.equal(await page.locator('dialog').count(),0);
  // A stale review fails before any entry starts and keeps every row pending.
  await page.evaluate(()=>reopen());await review();
  await page.evaluate(()=>env.packs.get('world.crows-equipment').docs[0].edit(data=>{data.system.cost=99;}));
  await $('save-import').click();await page.waitForFunction(()=>!document.querySelector('[data-id="review-import"]').disabled);
  assert.match(await $('import-status').textContent(),/changed since the review/);
  assert.ok((await statuses()).every(status=>status==='pending'));
  assert.equal(await $('progress-label').textContent(),'0 of 521 entries processed');
  assert.deepEqual(errors,[]);
  console.log('PASS: 521-row review; desktop, narrow and short viewports; fixed status and controls; confirmed per-entry saves; cancellation; failure; retry; completion details; stale review; no browser errors.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
