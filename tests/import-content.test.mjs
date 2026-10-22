import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveImport,prepareImport,executeImport,getCharacterContent,SCOPE} from '../scripts/import-content.mjs';
import {setupImport,adapter} from './import-harness.mjs';
import {cardToItem} from '../scripts/item-mapper.mjs';
const item=(name='Tool',cost=1,set='core')=>({name,type:'equipment',img:'icons/svg/item-bag.svg',system:{cost},flags:{[SCOPE]:{source:{set,page:1}}}});
const report=documents=>({documents,actors:[],backgrounds:[],connections:[]});
const prepare=bundle=>prepareImport(bundle,{adapter});
const execute=(review,options={})=>executeImport(review,{adapter,...options});

test('dungeon Healing Potion prefers only the otherwise identical printed belt clarification',()=>{
  const make=(body,extra={})=>cardToItem({name:'Healing Potion',source:'poi',page:1,card_index:0,price:100,body_html:body,...extra});
  const short=make('Test effect.'),long=make('Test effect. Draw from a belt slot and drink in one maneuver.',{page:14});
  for(const docs of [[short,long],[long,short],[short,long,structuredClone(long)]]){
    const before=structuredClone(docs),bundle=resolveImport(report(docs));
    assert.equal(bundle.conflicts.length,0);assert.equal(bundle.repeated,docs.length-1);
    assert.deepEqual(bundle.packs[0].data,[long]);assert.deepEqual(docs,before);
  }
  assert.deepEqual(resolveImport(report([short])).packs[0].data,[short]);
  for(const alternative of [make('Test effect. Draw from a belt slot and drink in one maneuver.',{price:200}),
    make('Different effect. Draw from a belt slot and drink in one maneuver.'),
    make('Test effect. Draw from a belt slot and drink in one maneuver. Another change.')]){
    assert.equal(resolveImport(report([short,alternative])).conflicts.length,1);
  }
  const core=make('Test effect.',{source:'core'}),supplement=make('Test effect. Draw from a belt slot and drink in one maneuver.',{source:'cards'});
  assert.equal(resolveImport(report([core,supplement])).conflicts.length,1);
});

test('the known Creature Part comma is cosmetic but other description and stat differences still conflict',()=>{
  const make=(body,extra={})=>cardToItem({name:'Creature Part',source:'poi',body_html:body,...extra});
  const plain=make('A creature used for testing.'),comma=make('A creature, used for testing.');
  assert.equal(resolveImport(report([plain,comma])).conflicts.length,0);
  for(const other of [make('A creature, used for testing.',{stack:3}),make('A creature, used for another purpose.'),
    make('A creature, used for testing.',{name:'Other Part'})]){
    const bundle=resolveImport(report([plain,other]));
    if(other.name===plain.name)assert.equal(bundle.conflicts.length,1);else assert.equal(bundle.packs[0].data.length,2);
  }
});

test('ordinary and enchanted loot both import and re-import without overwriting local edits',async()=>{
  const env=setupImport(),base={name:'Test Sword',source:'poi',price:10,body_html:'Test weapon.'};
  const ordinary=cardToItem(base),enchanted=cardToItem({...base,price:100,enchantment:'Flaming'});
  const bundle=resolveImport(report([ordinary,enchanted]));assert.equal(bundle.conflicts.length,0);
  await execute(await prepare(bundle));
  const pack=env.packs.get('world.crows-dungeon-loot');
  assert.deepEqual(pack.docs.map(d=>d.name),['Test Sword','Test Sword (Flaming)']);
  assert.equal((await prepare(bundle)).counts.unchanged,2);
  pack.docs[0].edit(data=>{data.system.cost=42;});
  const again=await prepare(bundle);assert.equal(again.counts.preserve,1);assert.equal(again.counts.unchanged,1);
  await execute(again);assert.equal(pack.docs[0].toObject().system.cost,42);
});

test('successful entries import despite failed PDFs or unresolved kits without replacing character content',async()=>{
  for(const issue of [{errors:[{path:'Ref Book.pdf',message:'Invalid PDF'}]}, {backgroundIssues:['Missing starting knife']}]){
    const env=setupImport(),previous={schemaVersion:1,content:{saved:'Previous creator content'}};
    await game.settings.set(SCOPE,'characterContent',previous);env.writes.length=0;
    const trait={name:'Test trait',type:'trait',system:{tree:'Test'}};
    const bundle=resolveImport({...report([trait]),backgrounds:[{name:'Incomplete kit'}],connections:[{name:'Connection'}],...issue});
    assert.equal(bundle.creation,null);assert.match(bundle.creationIssue,/unavailable/);
    const result=await execute(await prepare(bundle));
    assert.equal(env.packs.get('world.crows-traits').docs[0].name,'Test trait');
    assert.equal(result.published,false);
    assert.deepEqual(env.saved,previous);
    assert.ok(!env.writes.some(([type])=>type==='setting'));
  }
});

test('RollTables import separately, replace stale results and preserve local edits',async()=>{
  const env=setupImport();
  const table={name:'Encounters',formula:'1d2',results:[{type:'text',description:'First',range:[1,1],weight:1},{type:'text',description:'Second',range:[2,2],weight:1}]};
  const bundle=resolveImport({...report([]),tables:[table]});
  assert.equal(bundle.packs[0].config.type,'RollTable');
  await execute(await prepare(bundle));
  const pack=env.packs.get('world.crows-ref-tables'),doc=pack.docs[0],id=doc.id;
  assert.equal((await prepare(bundle)).counts.unchanged,1);
  table.results=[{type:'text',description:'Replacement',range:[1,2],weight:2}];
  const changed=resolveImport({...report([]),tables:[table]});
  assert.equal((await prepare(changed)).counts.update,1);
  await execute(await prepare(changed));
  assert.equal(doc.id,id);assert.equal(doc.toObject().results.length,1);
  assert.equal(doc.toObject().results[0].description,'Replacement');
  assert.equal((await prepare(changed)).counts.unchanged,1);
  doc.edit(data=>{data.results[0].description='Local result';});
  assert.equal((await prepare(changed)).counts.preserve,1);
  await execute(await prepare(changed));assert.equal(doc.toObject().results[0].description,'Local result');
  await execute(await prepareImport(changed,{adapter,forceOverwrite:true}));
  assert.equal(doc.toObject().results[0].description,'Replacement');
  pack.locked=true;await assert.rejects(prepare(changed),/locked/);
});

test('malformed RollTables and changed table reviews cannot write',async()=>{
  const env=setupImport(),table={name:'Table',formula:'1d6',results:[{range:[6,1]}]};
  await assert.rejects(prepare(resolveImport({...report([]),tables:[table]})),/Invalid table/);
  assert.deepEqual(env.writes,[]);
  table.results=[{range:[1,6],description:'Original'}];
  const bundle=resolveImport({...report([]),tables:[table]});
  await execute(await prepare(bundle));const review=await prepare(bundle);
  env.packs.get('world.crows-ref-tables').docs[0].edit(data=>{data.results[0].description='Edited after review';});
  env.writes.length=0;await assert.rejects(execute(review),/changed since the review/);assert.deepEqual(env.writes,[]);
});

test('resolution prefers core, collapses identical copies and requires choices for conflicting loot',()=>{
  const data=report([item(),item(),item('Tool',4,'profession'),item('Relic',1,'poi'),item('Relic',2,'poi')]);
  const bundle=resolveImport(data);assert.equal(bundle.professionCopies,1);assert.equal(bundle.repeated,1);assert.equal(bundle.unresolved.length,1);
  const chosen=resolveImport(data,{[bundle.conflicts[0].id]:1});assert.equal(chosen.unresolved.length,0);assert.equal(chosen.packs[1].data[0].system.cost,2);
  assert.equal(resolveImport(data,{[bundle.conflicts[0].id]:'skip'}).packs.length,1);
});

test('review is read-only; first import creates once and repeat import is unchanged',async()=>{
  const env=setupImport(),bundle=resolveImport(report([item()]));
  const review=await prepare(bundle);assert.equal(review.counts.create,1);assert.deepEqual(env.writes,[]);
  await execute(review);const doc=env.packs.get('world.crows-equipment').docs[0],id=doc.id;
  const again=await prepare(bundle);assert.equal(again.counts.unchanged,1);env.writes.length=0;
  await execute(again);assert.deepEqual(env.writes,[]);assert.equal(doc.id,id);
});

test('updated Item source retains IDs/artwork; local and untracked entries are preserved',async()=>{
  const env=setupImport();await execute(await prepare(resolveImport(report([item()]))));
  const pack=env.packs.get('world.crows-equipment'),doc=pack.docs[0],id=doc.id;
  const update=await prepare(resolveImport(report([item('Tool',2)])));assert.equal(update.counts.update,1);await execute(update);assert.equal(doc.id,id);assert.equal(doc.system.cost,2);
  doc.edit(d=>{d.system.cost=99;d.img='icons/user-art.webp';});
  pack.docs.push(env.makeDoc(item('Untracked')));
  const preserved=await prepare(resolveImport(report([item('Tool',3),item('Untracked',4)])));assert.equal(preserved.counts.preserve,2);
  env.writes.length=0;await execute(preserved);assert.deepEqual(env.writes,[]);assert.equal(doc.img,'icons/user-art.webp');
});

test('changed Actors are preserved and stale reviews perform no writes',async()=>{
  const env=setupImport(),actor={name:'Creature',type:'monster',system:{power:1},items:[]};
  const data={...report([]),actors:[actor]};await execute(await prepare(resolveImport(data)));
  actor.system.power=2;assert.equal((await prepare(resolveImport(data))).counts.preserve,1);
  const review=await prepare(resolveImport(report([item()])));
  env.makePack('crows-equipment','Item',[item('Unexpected')]);env.writes.length=0;
  await assert.rejects(execute(review),/changed since the review/);assert.deepEqual(env.writes,[]);
});

test('adding module provenance alone does not force an existing legacy Actor inventory review',async()=>{
  const env=setupImport(),actor={name:'Creature',type:'monster',img:'icons/legacy.webp',system:{power:1},items:[],prototypeToken:{texture:{src:'icons/legacy.webp'}}};
  await execute(await prepare(resolveImport({...report([]),actors:[actor]})));
  const incoming=structuredClone(actor);incoming.img='icons/svg/mystery-man.svg';incoming.prototypeToken.texture.src=incoming.img;incoming.flags={[SCOPE]:{source:{set:'ref',page:2}}};
  const review=await prepare(resolveImport({...report([]),actors:[incoming]}));assert.equal(review.counts.unchanged,1);
  env.writes.length=0;await execute(review);assert.deepEqual(env.writes,[]);
});

test('all targets are validated before writes; locks and active GM checks apply',async()=>{
  const env=setupImport(),bad=item('Bad');bad.system.invalid=true;
  await assert.rejects(prepare(resolveImport(report([item(),bad]))),/Invalid test field/);assert.deepEqual(env.writes,[]);
  const pack=env.makePack('crows-equipment','Item');pack.locked=true;
  await assert.rejects(prepare(resolveImport(report([item()]))),/locked/);
  game.users.activeGM.id='other';await assert.rejects(prepare(resolveImport(report([item()]))),/active GM/);
});

test('Foundry validation may mutate its input without changing reviewed source data',async()=>{
  setupImport();const original=globalThis.Item;let serial=0;
  globalThis.Item=class extends original{constructor(data,options){super(data,options);data._stats={createdTime:++serial};data.system.defaulted=true;}};
  const bundle=resolveImport(report([item()])),review=await prepare(bundle);
  assert.equal(review.packs[0].data[0]._stats,undefined);assert.equal(review.packs[0].data[0].system.defaulted,undefined);
  await execute(review);assert.equal((await prepare(bundle)).counts.unchanged,1);
});

test('stop keeps completed entries and retry safely finishes the rest',async()=>{
  const env=setupImport(),bundle=resolveImport(report([item('One'),item('Two')])),review=await prepare(bundle),controller=new AbortController();let progress=0;
  await assert.rejects(execute(review,{signal:controller.signal,onProgress(){if(++progress===1)controller.abort();}}),{name:'AbortError'});
  assert.equal(env.packs.get('world.crows-equipment').docs.length,1);assert.equal(env.saved,null);
  await execute(await prepare(bundle));assert.equal(env.packs.get('world.crows-equipment').docs.length,2);assert.equal(adapter.CrowsContentImport.busy,false);
});

test('core precedence excludes profession copies but preserves conflicts with additional PDFs',()=>{
  const core=item('Tool',1),profession=item('Tool',4,'profession'),extra=item('Tool',2,'cards');
  extra.flags[SCOPE].source.file='Supplement.pdf';
  const data=report([core,profession,extra]),review=resolveImport(data);
  assert.equal(review.professionCopies,1);assert.equal(review.unresolved.length,1);
  assert.deepEqual(review.conflicts[0].candidates.map(doc=>doc.flags[SCOPE].source.set),['core','cards']);
  const chosen=resolveImport(data,{[review.conflicts[0].id]:1});
  assert.equal(chosen.packs[0].config.name,'crows-equipment');assert.equal(chosen.packs[0].data[0].system.cost,2);
  const same=item('Tool',1,'cards');same.flags[SCOPE].source.file='Copy.pdf';
  const identical=resolveImport(report([core,same]));
  assert.equal(identical.conflicts.length,0);assert.equal(identical.repeated,1);
  assert.equal(identical.packs[0].data.length,1);
});

test('entry results distinguish confirmed writes, unchanged entries and preserved content',async()=>{
  const env=setupImport();
  await execute(await prepare(resolveImport(report([item('Updated'),item('Unchanged')]))));
  env.packs.get('world.crows-equipment').docs.push(env.makeDoc(item('Preserved')));
  const bundle=resolveImport(report([item('Created'),item('Updated',2),item('Unchanged'),item('Preserved')]));
  const review=await prepare(bundle),events=[];
  await execute(review,{onEntry:event=>{
    events.push(event);
    if(['created','updated'].includes(event.status)){
      const doc=env.packs.get('world.crows-equipment').docs.find(doc=>doc.name===event.name);
      assert.equal(doc.getFlag('fvtt-crows-system','importSource').baseline,adapter.fingerprint(doc.toObject()));
    }
  }});
  assert.deepEqual(events.map(e=>[e.name,e.status]),[
    ['Created','importing'],['Created','created'],['Updated','importing'],['Updated','updated'],
    ['Unchanged','importing'],['Unchanged','unchanged'],['Preserved','importing'],['Preserved','preserved']
  ]);
  assert.deepEqual(events.filter(e=>e.status==='importing').map(e=>e.id),review.rows.map(row=>row.id));
});

test('tracking failures never announce completion and later entries stay pending',async()=>{
  const env=setupImport(),pack=env.makePack('crows-equipment','Item'),create=pack.documentClass.createDocuments,events=[];
  pack.documentClass.createDocuments=async data=>{
    const docs=await create(data);
    if(data[0].name==='Fails')docs[0].setFlag=async()=>{throw new Error('Tracking write failed');};
    return docs;
  };
  const review=await prepare(resolveImport(report([item('Saved'),item('Fails'),item('Pending')])));
  await assert.rejects(execute(review,{onEntry:event=>events.push(event)}),/Tracking write failed/);
  assert.deepEqual(events.map(e=>[e.name,e.status]),[
    ['Saved','importing'],['Saved','created'],['Fails','importing'],['Fails','failed']
  ]);
  assert.equal(events.at(-1).message,'Tracking write failed');
  assert.equal(pack.docs.length,2); // The failed tracking write may leave a created document.
});

test('stopping acknowledges the in-flight save without starting or failing the next entry',async()=>{
  setupImport();const events=[],controller=new AbortController();
  const review=await prepare(resolveImport(report([item('One'),item('Two')])));
  await assert.rejects(execute(review,{signal:controller.signal,onProgress:()=>controller.abort(),onEntry:event=>events.push(event)}),{name:'AbortError'});
  assert.deepEqual(events.map(e=>[e.name,e.status]),[['One','importing'],['One','created']]);
});

test('entry identifiers distinguish traits with the same name in different trees',async()=>{
  setupImport();const events=[];
  const review=await prepare(resolveImport(report(['First','Second'].map(tree=>({name:'Shared name',type:'trait',system:{tree}})))));
  await execute(review,{onEntry:event=>events.push(event)});
  assert.equal(new Set(review.rows.map(row=>row.id)).size,2);
  assert.deepEqual(events.filter(e=>e.status==='created').map(e=>e.id),review.rows.map(row=>row.id));
});

test('missing character dependencies fail preflight without writes or publication',async()=>{
  const env=setupImport(),bundle=resolveImport({...report([item()]),backgrounds:[{}],connections:[{}]});
  await assert.rejects(prepare(bundle),/needs Traits/);assert.deepEqual(env.writes,[]);assert.equal(await getCharacterContent(),null);
});

test('a failed pack write keeps completed entries and the previous creator snapshot',async()=>{
  const env=setupImport(),previous={schemaVersion:1,content:{marker:'previous'}};
  await game.settings.set(SCOPE,'characterContent',previous);
  const pack=env.makePack('crows-traits','Item');pack.documentClass.createDocuments=async()=>{throw new Error('Simulated write failure');};
  env.makePack('crows-bestiary','Actor');
  const backgrounds=Array.from({length:36},(_,i)=>({name:`Background ${i}`,startingKit:[{name:'Tool',quantity:1}],trait:{name:'Trait',tree:'General'},pets:[]}));
  const connections=Array.from({length:10},(_,i)=>({name:`Benefit ${i}`,description:'Text'}));
  const bundle=resolveImport({...report([item(),{name:'Trait',type:'trait',system:{tree:'General'}}]),backgrounds,connections});
  await assert.rejects(execute(await prepare(bundle)),error=>error.message.includes('Simulated')&&error.importReport.results[0].created===1);
  assert.equal(env.packs.get('world.crows-equipment').docs.length,1);assert.deepEqual(env.saved,previous);assert.equal(adapter.CrowsContentImport.busy,false);
});


test('force overwrite updates edited and untracked entries, replaces Actor items, and still preserves ambiguous matches',async()=>{
  const env=setupImport(),bundle=resolveImport({...report([item(),item('Untracked'),item('Ambiguous')]),actors:[{name:'Creature',type:'monster',system:{power:2},items:[{name:'New attack',type:'attack',system:{}}]}]});
  await execute(await prepare(resolveImport(report([item()]))));
  const pack=env.packs.get('world.crows-equipment'),edited=pack.docs[0],id=edited.id;
  edited.edit(d=>{d.system.cost=99;d.img='custom.webp';});
  pack.docs.push(env.makeDoc(item('Untracked',99)),env.makeDoc(item('Ambiguous')),env.makeDoc(item('Ambiguous')));
  const actor=env.makePack('crows-bestiary','Actor',[{name:'Creature',type:'monster',system:{power:99},items:[{_id:'old',name:'Old attack',type:'attack',system:{}}]}]).docs[0];
  assert.equal((await prepare(bundle)).counts.preserve,4);
  env.writes.length=0;
  const review=await prepareImport(bundle,{adapter,forceOverwrite:true});
  assert.equal(review.counts.update,3);assert.equal(review.counts.preserve,1);assert.deepEqual(env.writes,[]);
  await execute(review);
  assert.equal(edited.id,id);assert.equal(edited.system.cost,1);assert.equal(edited.img,'custom.webp');
  assert.equal(pack.docs[1].system.cost,1);assert.equal(actor.system.power,2);
  assert.deepEqual(actor.toObject().items.map(i=>i.name),['New attack']);
  const again=await prepareImport(bundle,{adapter,forceOverwrite:true});assert.equal(again.counts.update,0);assert.equal(again.counts.unchanged,3);
  review.forceOverwrite=false;
  env.writes.length=0;await assert.rejects(execute(review),/changed since the review/);assert.deepEqual(env.writes,[]);
});


test('failed forced Actor replacement reports partial progress and can be retried',async()=>{
  const env=setupImport(),actor=env.makePack('crows-bestiary','Actor',[{name:'Creature',type:'monster',system:{power:1},items:[{name:'Old',type:'attack',system:{}}]}]).docs[0];
  const bundle=resolveImport({...report([]),actors:[{name:'Creature',type:'monster',system:{power:2},items:[{name:'New',type:'attack',system:{}}]}]});
  const create=actor.createEmbeddedDocuments;
  actor.createEmbeddedDocuments=async()=>{throw new Error('Embedded creation failed');};
  await assert.rejects(execute(await prepareImport(bundle,{adapter,forceOverwrite:true})),error=>{
    assert.match(error.message,/Embedded creation failed/);assert.equal(error.importReport.published,false);return true;
  });
  assert.equal(adapter.CrowsContentImport.busy,false);
  actor.createEmbeddedDocuments=create;
  await execute(await prepareImport(bundle,{adapter,forceOverwrite:true}));
  assert.deepEqual(actor.toObject().items.map(i=>i.name),['New']);
  assert.equal((await prepareImport(bundle,{adapter,forceOverwrite:true})).counts.unchanged,1);
});


test('Lore Book re-import repairs the generic bag while retaining custom artwork',async()=>{
  const env=setupImport(),old=item('Lore Book (Nature)');
  await execute(await prepare(resolveImport(report([old]))));
  const incoming={...old,img:'icons/sundries/books/book-embossed-bound-brown.webp'};
  const bundle=resolveImport(report([incoming]));
  const review=await prepare(bundle);assert.equal(review.counts.update,1);await execute(review);
  const doc=env.packs.get('world.crows-equipment').docs[0];assert.equal(doc.img,incoming.img);
  doc.edit(d=>{d.img='custom-book.webp';});
  await execute(await prepareImport(bundle,{adapter,forceOverwrite:true}));
  assert.equal(doc.img,'custom-book.webp');
});
