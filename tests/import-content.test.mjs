import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveImport,prepareImport,executeImport,getCharacterContent,SCOPE} from '../scripts/import-content.mjs';
import {setupImport,adapter} from './import-harness.mjs';
const item=(name='Tool',cost=1,set='core')=>({name,type:'equipment',img:'icons/svg/item-bag.svg',system:{cost},flags:{[SCOPE]:{source:{set,page:1}}}});
const report=documents=>({documents,actors:[],backgrounds:[],connections:[]});
const prepare=bundle=>prepareImport(bundle,{adapter});
const execute=(review,options={})=>executeImport(review,{adapter,...options});

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
