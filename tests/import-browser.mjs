import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

export async function testImportBrowser(page,modulePath,report){
  await page.evaluate(()=>{
    let next=0,saved=null;const packs=new Map();
    const makeDoc=source=>{
      let data=structuredClone(source);data._id??=String(++next).padStart(16,'0');
      return {get id(){return data._id;},get name(){return data.name;},get type(){return data.type;},get system(){return data.system;},get img(){return data.img;},
        get results(){return data.results;},
        getFlag(scope,key){return data.flags?.[scope]?.[key];},toObject(){return structuredClone(data);},
        async update(update){data={...data,...structuredClone(update)};return this;},
        async setFlag(scope,key,value){data.flags??={};data.flags[scope]??={};data.flags[scope][key]=structuredClone(value);}};
    };
    globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},packs,settings:{get:()=>structuredClone(saved),async set(scope,key,value){saved=structuredClone(value);}},system:{id:'fvtt-crows-system'}};
    globalThis.foundry={utils:{deepClone:value=>structuredClone(value)}};
    globalThis.CONFIG={Item:{dataModels:{equipment:{},trait:{}}},Actor:{dataModels:{monster:{}}}};
    globalThis.Item=globalThis.Actor=class{constructor(data){this.items=(data.items??[]).map(()=>({validate:()=>true}));}validate(){return true;}};
    globalThis.RollTable=class{constructor(data){if(!data.results?.length)throw new Error('Missing table results');}validate(){return true;}};
    globalThis.CompendiumCollection={async createCompendium({name,type}){
      const docs=[],pack={collection:'world.'+name,documentName:type,locked:false,async getDocuments(){return [...docs];},documentClass:{async createDocuments(entries){const created=entries.map(makeDoc);docs.push(...created);return created;}}};
      packs.set(pack.collection,pack);return pack;
    }};
  });
  await page.evaluate(async({path,report})=>{const {openImportReview}=await import(path);openImportReview(report);},{path:modulePath+'scripts/import-review.mjs',report});
  const $=id=>page.locator(`[data-id="${id}"]`);
  assert.equal(await $('review-import').isEnabled(),true);
  assert.equal(await $('conflicts').locator('select').count(),0);
  const review=async()=>{await $('review-import').click();await page.waitForFunction(()=>!document.querySelector('[data-id="review-import"]').disabled);assert.equal(await $('save-import').isEnabled(),true);};
  await $('select-none').click();assert.equal(await $('review-import').isDisabled(),true);
  await $('entry-list').locator('input').first().check();
  await $('publish-creator').uncheck();
  await review();assert.match(await $('import-status').textContent(),/1 new/);
  await $('search').fill('Lore Book');
  assert.equal(await $('entry-list').locator('input:checked').count(),1);
  await $('select-all').click();
  assert.ok(await $('entry-list').locator('input:checked').count()>1);
  await $('search').fill('');await $('select-all').click();await $('publish-creator').check();
  await review();assert.match(await $('import-status').textContent(),/542 new/);
  await page.evaluate(()=>document.querySelector('dialog:last-of-type').scrollTop=0);
  await page.screenshot({path:fileURLToPath(new URL('../out/import-review-ui.png',import.meta.url))});
  const viewport=page.viewportSize();await page.setViewportSize({width:600,height:850});
  assert.equal(await page.evaluate(()=>{const d=document.querySelector('dialog:last-of-type');return d.scrollWidth<=d.clientWidth+1;}),true);
  await page.setViewportSize(viewport);

  assert.equal(await $('force-overwrite').isChecked(),false);
  await $('force-overwrite').check();assert.equal(await $('save-import').isDisabled(),true);
  await review();
  await $('force-overwrite').uncheck();assert.equal(await $('save-import').isDisabled(),true);
  await review();
  // A new pack after review invalidates that review, even if it is empty.
  await page.evaluate(()=>CompendiumCollection.createCompendium({name:'crows-equipment',type:'Item'}));
  await $('save-import').click();await page.waitForFunction(()=>!document.querySelector('[data-id="review-import"]').disabled);
  assert.match(await $('import-status').textContent(),/changed since the review/);
  assert.equal(await page.evaluate(async()=>{let count=0;for(const p of game.packs.values())count+=(await p.getDocuments()).length;return count;}),0);
  await review();await $('save-import').click();await page.waitForFunction(()=>!document.querySelector('[data-id="review-import"]').disabled);
  assert.match(await $('import-status').textContent(),/^Import complete/);assert.match(await $('import-status').textContent(),/Character-creation data published/);
  assert.equal(await page.evaluate(()=>game.settings.get().content.backgrounds.length),36);
  await review();assert.match(await $('import-status').textContent(),/0 new, 0 updates, 542 unchanged/);
  assert.equal(await page.evaluate(async()=>{const p=game.packs.get('world.crows-ref-tables');return p.documentName==='RollTable'&&(await p.getDocuments()).length;}),21);
  await $('close-import').click();
  return {loreVariantsWithoutConflicts:true,staleReview:true,documents:542,published:true,repeatUnchanged:542};
}
