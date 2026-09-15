import assert from 'node:assert/strict';
import {dirname} from 'node:path';
import {compareCards} from './card-comparison.mjs';
import {readFile} from 'node:fs/promises';
import {npcToActor} from '../scripts/npc-parser.mjs';
import {testImportBrowser} from './import-browser.mjs';

export async function testPacketBrowser(page,modulePath,cards){
  await page.evaluate(async path=>{const {openPacketPreview}=await import(path);openPacketPreview();},modulePath+'scripts/packet-preview.mjs');
  const $=id=>page.locator(`[data-id="${id}"]`);
  const packet=dirname(dirname(cards[0].file));
  await $('folder').setInputFiles(packet);
  assert.match(await $('review').textContent(),/5 PDF\(s\) selected/);
  assert.equal(await $('assignments').locator('select').evaluateAll(selects=>selects.filter(select=>select.value).length),5);
  const run=async()=>{await $('extract').click();await page.waitForFunction(()=>document.querySelector('[data-id="abort"]').disabled,{},{timeout:60000});};
  await run();
  assert.match(await $('packet-status').textContent(),/^Extraction complete: 5 PDFs, 142 pages, 1010 proposed Items, 71 proposed NPC Actors, 36 ready backgrounds, 10 NPC connection benefits/);
  const result=JSON.parse(await $('packet-result').textContent());
  assert.deepEqual(result.errors,[]);
  for(const source of ['core','profession','poi']){
    assert.deepEqual(compareCards(cards.filter(c=>c.source===source).flatMap(c=>c.expected),result.parsedCards.filter(c=>c.source===source)),[]);
  }
  assert.equal(result.documents.filter(item=>item.type==='equipment').length,734);
  const characters=JSON.parse(await readFile(new URL('../out/characters-baseline.json',import.meta.url),'utf8'));
  assert.deepEqual(compareCards(characters.backgrounds,result.backgrounds),[]);
  assert.deepEqual(compareCards(characters.connections,result.connections),[]);
  assert.deepEqual(compareCards(characters.common,result.characterData.common),[]);
  const traitFields=items=>items.map(item=>({name:item.name,type:item.type,system:{...item.system,description:item.system.description.replaceAll('&#39;',"'").replaceAll('&quot;','"')}}));
  assert.deepEqual(compareCards(traitFields(characters.traits),traitFields(result.documents.filter(item=>item.type==='trait'))),[]);
  const npcs=JSON.parse(await readFile(new URL('../out/npcs-baseline.json',import.meta.url),'utf8'));
  assert.deepEqual(compareCards(npcs.blocks,result.npcRecords),[]);
  assert.deepEqual(compareCards(npcs.blocks.map(npcToActor),result.actors),[]);
  assert.equal(result.actorValidation.status,'unavailable');
  assert.equal(await $('file-results').locator('li').count(),71);
  assert.deepEqual(result.actorCounts,{Animal:32,Human:27,Blood:3,Unique:1,Undead:8});
  const importing=await testImportBrowser(page,modulePath,result);
  // A Characters-only run keeps traits/connections and reports unresolved kits.
  await $('files').setInputFiles(characters.file);await run();
  const partial=JSON.parse(await $('packet-result').textContent());
  assert.equal(partial.connections.length,10);assert.equal(partial.documents.length,276);assert.equal(partial.backgrounds.length,0);
  assert.match(await $('packet-status').textContent(),/^Finished with unresolved starting kits/);
  assert.match(partial.backgroundIssues[0],/Include the core inventory/);
  // Same action path after cancellation, with no previous results left visible.
  await page.evaluate(()=>{document.querySelector('[data-id="extract"]').click();document.querySelector('[data-id="abort"]').click();});
  await page.waitForFunction(()=>document.querySelector('[data-id="abort"]').disabled);
  assert.match(await $('packet-status').textContent(),/^Cancelled/);assert.equal(await $('packet-result').textContent(),'');
  // Multiple-file fallback and duplicate assignments.
  await $('files').setInputFiles([{name:'Cards.pdf',mimeType:'application/pdf',buffer:Buffer.from('invalid')},{name:'Cards copy.pdf',mimeType:'application/pdf',buffer:Buffer.from('invalid')}]);
  assert.equal(await $('extract').isDisabled(),true);assert.match(await $('review').textContent(),/choose one PDF/);
  const poi=cards.find(c=>c.source==='poi');
  await $('files').setInputFiles(poi.file);await run();
  assert.match(await $('packet-status').textContent(),/^Extraction complete: 1 PDFs/);
  // Malformed PDF is reported as a file failure, not a successful empty batch.
  await $('files').setInputFiles({name:'renamed.pdf',mimeType:'application/pdf',buffer:Buffer.from('invalid')});
  assert.equal(await $('extract').isDisabled(),true);
  await $('assignments').locator('select').selectOption('core');await run();
  assert.match(await $('packet-status').textContent(),/^Finished with errors/);
  assert.equal(JSON.parse(await $('packet-result').textContent()).errors.length,1);
  await $('files').setInputFiles(poi.file);
  await page.evaluate(()=>{document.querySelector('[data-id="extract"]').click();document.querySelector('[data-id="close-packet"]').click();});
  await page.locator('dialog').waitFor({state:'detached'});
  return {importing,folder:true,pages:142,cards:734,npcs:71,traits:276,backgrounds:36,connections:10,charactersOnly:true,multipleFiles:true,duplicates:true,renamedAssignment:true,cancelAndRetry:true,invalidPDF:true,closeDuringExtraction:true};
}
