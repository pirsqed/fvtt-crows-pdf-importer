import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setupBrowserImport} from './import-browser.mjs';

// The licensed fixture stays local, like the other packet fixtures.
export async function testAdditionalCardsBrowser(page,modulePath){
  const file=process.env.CROWS_ADDITIONAL_PDF??fileURLToPath(new URL('../../playtest2_pdfs/Inventory Cards/Crows Spells for Patreon.pdf',import.meta.url));
  let bytes;
  try{bytes=await readFile(file);}catch(error){if(error.code==='ENOENT')return {skipped:'Set CROWS_ADDITIONAL_PDF to the five-page spell-card supplement.'};throw error;}
  await setupBrowserImport(page);
  const previous={schemaVersion:1,content:{marker:'Existing character-creation content'}};
  await page.evaluate(async({path,previous})=>{
    await game.settings.set('fvtt-crows-pdf-importer','characterContent',previous);
    const {openPacketPreview}=await import(path+'scripts/packet-preview.mjs');openPacketPreview();
  },{path:modulePath,previous});
  const $=id=>page.locator(`[data-id="${id}"]`);
  await $('files').setInputFiles([
    {name:'Unrecognized supplement.pdf',mimeType:'application/pdf',buffer:bytes},
    {name:'Extra spellbooks.pdf',mimeType:'application/pdf',buffer:bytes}
  ]);
  const manual=page.getByRole('combobox',{name:'Content type for Unrecognized supplement.pdf'});
  assert.equal(await manual.inputValue(),'');await manual.selectOption('cards');
  assert.equal(await page.getByRole('combobox',{name:'Content type for Extra spellbooks.pdf'}).inputValue(),'cards');
  assert.match(await $('review').textContent(),/2 PDF\(s\) selected.*without the rest/);
  await $('extract').click();await page.waitForFunction(()=>document.querySelector('[data-id="abort"]').disabled,{},{timeout:60000});
  const report=JSON.parse(await $('packet-result').textContent());
  assert.deepEqual(report.errors,[]);assert.equal(report.files.length,2);assert.equal(report.documents.length,162);
  for(const file of report.files)assert.deepEqual(file.pages.map(page=>page.cards),[17,20,20,20,4]);
  assert.equal(report.documents.every(doc=>doc.system.isSpellbook&&doc.system.cost>0),true);
  assert.equal(report.documents.every(doc=>doc.flags['fvtt-crows-pdf-importer'].spell.range&&doc.flags['fvtt-crows-pdf-importer'].spell.cast),true);
  assert.deepEqual([...new Set(report.documents.map(doc=>doc.flags['fvtt-crows-pdf-importer'].source.file))].sort(),['Extra spellbooks.pdf','Unrecognized supplement.pdf']);
  assert.equal(report.documents.every(doc=>doc.flags['fvtt-crows-pdf-importer'].source.set==='cards'),true);
  await $('open-import').click();
  assert.equal(await $('publish-creator').isChecked(),false);assert.equal(await $('publish-creator').isDisabled(),true);
  assert.equal(await $('conflicts').locator('select').count(),0);
  assert.match(await $('selection-count').textContent(),/^81 entries selected/);
  assert.match(await $('dedup-summary').textContent(),/^81 repeated copies combined/);
  await $('review-import').click();await page.waitForFunction(()=>!document.querySelector('[data-id="save-import"]').disabled);
  assert.match(await $('import-status').textContent(),/81 new/);
  await $('save-import').click();await $('finish-import').waitFor({state:'visible'});
  assert.match(await $('completion-summary').textContent(),/81 added/);
  assert.deepEqual(await page.evaluate(()=>game.settings.get('fvtt-crows-pdf-importer','characterContent')),previous);
  assert.deepEqual(await page.evaluate(()=>[...game.packs.keys()]),['world.crows-equipment']);
  await $('finish-import').click();
  await page.evaluate(async({path,report})=>{const {openImportReview}=await import(path+'scripts/import-review.mjs');openImportReview(report);},{path:modulePath,report});
  await $('review-import').click();await page.waitForFunction(()=>!document.querySelector('[data-id="save-import"]').disabled);
  assert.match(await $('import-status').textContent(),/0 new, 0 updates, 81 unchanged/);
  await $('save-import').click();await $('finish-import').waitFor({state:'visible'});
  assert.match(await $('completion-summary').textContent(),/0 added, 0 updated, 81 unchanged/);
  await $('finish-import').click();
  // Differing definitions must identify their file and require an explicit choice.
  const conflicting=structuredClone(report);conflicting.documents=report.documents.slice(0,1).map(doc=>structuredClone(doc));
  const variant=structuredClone(conflicting.documents[0]);variant.system.cost++;
  variant.flags['fvtt-crows-pdf-importer'].source.file='Revised cards.pdf';conflicting.documents.push(variant);
  await page.evaluate(async({path,report})=>{const {openImportReview}=await import(path+'scripts/import-review.mjs');openImportReview(report);},{path:modulePath,report:conflicting});
  assert.equal(await $('review-import').isDisabled(),true);
  assert.match(await $('conflicts').textContent(),/Extra spellbooks\.pdf/);
  assert.match(await $('conflicts').textContent(),/Revised cards\.pdf/);
  await $('conflicts').locator('select').selectOption('1');assert.equal(await $('review-import').isEnabled(),true);
  await $('close-import').click();
  // A bad download gets a specific error while a valid supplement stays usable.
  await page.evaluate(async path=>{const {openPacketPreview}=await import(path+'scripts/packet-preview.mjs');openPacketPreview();},modulePath);
  await $('files').setInputFiles([
    {name:'Saved spells.pdf',mimeType:'application/pdf',buffer:Buffer.from('<!DOCTYPE html><title>Log in</title>')},
    {name:'Valid spells.pdf',mimeType:'application/pdf',buffer:bytes}
  ]);
  await $('extract').click();await page.waitForFunction(()=>document.querySelector('[data-id="abort"]').disabled,{},{timeout:60000});
  const partial=JSON.parse(await $('packet-result').textContent());
  assert.equal(partial.errors.length,1);assert.match(partial.errors[0].message,/web page, not a PDF/);
  assert.equal(partial.documents.length,81);assert.equal(await $('open-import').isEnabled(),true);
  await $('close-packet').click();
  return {pagesPerPDF:5,spells:81,multiplePDFs:true,renamedFile:true,provenance:true,duplicateCollapse:true,repeatUnchanged:81,conflictChoice:true,creatorPreserved:true,badDownload:true};
}
