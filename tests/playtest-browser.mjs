import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {setupBrowserImport} from './import-browser.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),version=Number(process.env.CROWS_PLAYTEST_VERSION),packet=process.env.CROWS_PACKET_ROOT;
if(!packet||![2,3].includes(version))throw new Error('Set CROWS_PACKET_ROOT and CROWS_PLAYTEST_VERSION (2 or 3).');
const prefix='/test-foundry/',modulePath=prefix+'modules/fvtt-crows-pdf-importer/',served=new Set();
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path===prefix+'game'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Playtest packet integration</title><body></body>');return;}
    let base,tail;
    if(path.startsWith(prefix+'scripts/pdfjs/')){base=process.env.FOUNDRY_PDFJS??'C:/Program Files/Foundry Virtual Tabletop/resources/app/node_modules/@foundryvtt/pdfjs/';tail=path.slice((prefix+'scripts/pdfjs/').length);}
    else if(path.startsWith(modulePath)){base=root;tail=path.slice(modulePath.length);}
    else if(path.startsWith(prefix+'systems/fvtt-crows-system/')){base=resolve(root,'../fvtt-crows-system');tail=path.slice((prefix+'systems/fvtt-crows-system/').length);}
    else{res.writeHead(404);res.end();return;}
    const file=resolve(base,tail);if(relative(base,file).startsWith('..')){res.writeHead(403);res.end();return;}
    const bytes=await readFile(file);served.add(path);res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css'})[extname(file)]??'application/octet-stream');res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1366,height:1000}}),errors=[],external=[];
  const origin=`http://127.0.0.1:${server.address().port}`;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin))external.push(r.url());});
  await page.goto(origin+prefix+'game');await setupBrowserImport(page);
  await page.evaluate(async url=>{const {openPacketPreview}=await import(url);openPacketPreview();},modulePath+'scripts/packet-preview.mjs');
  const $=id=>page.locator(`[data-id="${id}"]`);
  await $('folder').setInputFiles(packet);
  for(const select of await $('assignments').locator('select').all())if(await select.inputValue()==='cards')await select.selectOption('');
  assert.match(await $('review').textContent(),/^6 PDF\(s\) selected\./);
  await $('extract').click();await page.waitForFunction(()=>document.querySelector('[data-id="abort"]').disabled,{},{timeout:60000});
  assert.match(await $('packet-status').textContent(),/^Extraction complete/);
  const result=JSON.parse(await $('packet-result').textContent());
  assert.deepEqual(result.errors,[]);assert.equal(result.parsedCards.length,version===3?985:735);
  assert.equal(result.actors.length,version===3?117:71);assert.equal(result.tables.length,version===3?44:22);
  assert.equal(await $('open-import').isEnabled(),true);await $('open-import').click();
  assert.equal(await $('publish-creator').isChecked(),true);
  const conflicts=await $('conflicts').locator('select').count();assert.equal(conflicts,0);
  await $('review-import').click();await page.waitForFunction(()=>!document.querySelector('[data-id="review-import"]').disabled);
  assert.match(await $('import-changes').textContent(),/File in Monster \/ Blood/);
  assert.equal(await $('save-import').isEnabled(),true,await $('import-status').textContent());
  await $('save-import').click();await $('finish-import').waitFor({state:'visible',timeout:60000});
  assert.equal(await $('finish-import').isEnabled(),true);
  const completion=await $('completion-summary').textContent();assert.match(completion,/Character-creation data published/);
  const content=await page.evaluate(async url=>(await import(url)).getCharacterContent(),modulePath+'scripts/import-content.mjs');
  assert.equal(content.backgrounds.length,36);assert.equal(content.connections.length,10);
  assert.ok(content.monsters.every(actor=>!actor.folder));
  const folderState=await page.evaluate(async()=>{
    const pack=game.packs.get('world.crows-bestiary'),folders=[...pack.folders.values()].map(f=>f.toObject());
    const path=id=>{const names=[];while(id){const f=folders.find(f=>f._id===id);if(!f)throw new Error('Missing folder');names.unshift(f.name);id=f.folder;}return names.join(' / ');};
    const counts=Object.fromEntries(folders.map(f=>[path(f._id),0]));
    for(const actor of await pack.getDocuments()){const target=path(actor.toObject().folder);assertFolder(target);counts[target]++;}
    function assertFolder(target){if(!(target in counts))throw new Error('Unfiled Actor');}
    return {ids:folders.map(f=>f._id),counts};
  });
  assert.deepEqual(folderState.counts,version===3?
    {Animal:33,Human:39,Monster:0,Unique:3,'Monster / Blood':8,'Monster / Undead':8,'Monster / Plant':8,'Monster / Demon':8,'Monster / Angel':10}:
    {Animal:32,Human:27,Monster:0,Unique:1,'Monster / Blood':3,'Monster / Undead':8,'Monster / Plant':0,'Monster / Demon':0,'Monster / Angel':0});
  await mkdir(new URL('../out/',import.meta.url),{recursive:true});
  await page.screenshot({path:resolve(root,`out/playtest-${version}-browser.png`),fullPage:true});
  await $('finish-import').click();await page.waitForFunction(()=>!document.querySelector('dialog.crows-import-ui'));
  await page.evaluate(async({url,report})=>(await import(url)).openImportReview(report),{url:modulePath+'scripts/import-review.mjs',report:result});
  assert.equal(await $('conflicts').locator('select').count(),0);
  await $('review-import').click();await page.waitForFunction(()=>!document.querySelector('[data-id="review-import"]').disabled);
  const repeat=await $('import-status').textContent();assert.match(repeat,/0 new, 0 updates, \d+ unchanged, 0 preserved/);
  assert.match(repeat,new RegExp(`${version===3?723:544} unchanged`));
  assert.ok(!repeat.includes('will be filed'));
  await $('save-import').click();await $('finish-import').waitFor({state:'visible',timeout:60000});
  assert.deepEqual(await page.evaluate(()=>[...game.packs.get('world.crows-bestiary').folders.keys()]),folderState.ids);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.ok([...served].some(p=>p.endsWith('/pdf.worker.mjs')));
  const summary={version,cards:result.parsedCards.length,actors:result.actors.length,tables:result.tables.length,conflicts,completion,repeat,folders:folderState.counts,errors,external};
  await writeFile(resolve(root,`out/playtest-${version}-browser.json`),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
