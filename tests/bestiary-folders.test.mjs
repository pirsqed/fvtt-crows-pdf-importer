import test from 'node:test';
import assert from 'node:assert/strict';
import {BESTIARY_FOLDERS} from '../scripts/bestiary-folders.mjs';
import {resolveImport,prepareImport,executeImport,PACKS} from '../scripts/import-content.mjs';
import {setupImport,adapter} from './import-harness.mjs';
const npc=(name,type='Animal')=>({name,type:'monster',system:{type,power:1},items:[]});
const bundle=actors=>resolveImport({documents:[],actors});
const prepare=input=>prepareImport(input,{adapter});
const execute=(review,options={})=>executeImport(review,{adapter,...options});
const folderPath=(pack,id)=>{
  const path=[];
  while(id){const data=pack.folders.get(id).toObject();path.unshift(data.name);id=data.folder;}
  return path.join(' / ');
};
const paths=pack=>[...pack.folders.keys()].map(id=>folderPath(pack,id)).sort();

test('the requested Bestiary hierarchy files all creature types and reuses every folder on re-import',async()=>{
  const env=setupImport(),types=['Animal','Human','Blood','Undead','Plant','Demon','Angel','Unique','Elemental','Unknown'];
  const input=bundle(types.map(type=>npc(type,type))),review=await prepare(input);
  assert.equal(review.folderAssignments,types.length);assert.deepEqual(env.writes,[]);
  const result=await execute(review),pack=env.packs.get('world.crows-bestiary');
  assert.deepEqual(paths(pack),BESTIARY_FOLDERS.map(p=>p.join(' / ')).sort());
  assert.equal(result.results[0].filed,types.length);
  for(const actor of pack.docs){
    const target=['Animal','Human','Unique'].includes(actor.name)?actor.name:actor.name==='Elemental'?'Unique':actor.name==='Unknown'?'Monster':`Monster / ${actor.name}`;
    assert.equal(folderPath(pack,actor.toObject().folder),target);
  }
  const ids=[...pack.folders.keys()];env.writes.length=0;
  const again=await prepare(input);assert.equal(again.folderAssignments,0);assert.equal(again.counts.unchanged,types.length);
  await execute(again);assert.deepEqual([...pack.folders.keys()],ids);assert.deepEqual(env.writes,[]);
});

test('Elementals previously filed in Monster move to Unique while custom folders and content remain intact',async()=>{
  const env=setupImport(),pack=env.makePack('crows-bestiary','Actor'),monster=env.makeFolder(pack,{name:'Monster'});
  const custom=env.makeFolder(pack,{name:'My encounters'}),nested=env.makeFolder(pack,{name:'Monster',folder:custom.id});
  const actors=[npc('Elemental','Elemental'),npc('Custom Elemental','Elemental'),npc('Nested Elemental','Elemental'),npc('Other monster','Unknown')];
  for(const [i,source] of actors.entries())pack.docs.push(env.makeDoc({...source,folder:[monster.id,custom.id,nested.id,monster.id][i]}));
  pack.docs[0].edit(d=>{d.system.power=7;});
  const input=bundle(actors),before=pack.docs[0].toObject(),review=await prepare(input);
  assert.equal(review.folderAssignments,1);assert.deepEqual(review.rows[0].folderPath,['Unique']);
  const result=await execute(review);assert.equal(result.results[0].filed,1);
  assert.equal(folderPath(pack,pack.docs[0].toObject().folder),'Unique');
  assert.deepEqual({...pack.docs[0].toObject(),folder:undefined},{...before,folder:undefined});
  assert.deepEqual(pack.docs.slice(1).map(d=>d.toObject().folder),[custom.id,nested.id,monster.id]);
  assert.equal((await prepare(input)).folderAssignments,0);
});

test('existing unfiled Actors are organized without replacing content or manual folders',async()=>{
  const env=setupImport(),actors=[npc('Edited animal'),npc('Manual human','Human'),npc('Untracked plant','Plant'),npc('Unselected demon','Demon')];
  const result={created:0,updated:0,unchanged:0,preserved:[]};
  await adapter.CrowsContentImport.importPack(PACKS[3],actors.slice(0,2),result);
  const pack=env.packs.get('world.crows-bestiary'),[edited,manual]=pack.docs;
  edited.edit(d=>{d.system.power=9;d.items=[{name:'Custom trait',type:'trait',system:{}}];});
  const custom=env.makeFolder(pack,{name:'My favourites'});manual.edit(d=>{d.folder=custom.id;});
  pack.docs.push(env.makeDoc(actors[2]),env.makeDoc(actors[3]));
  const input=bundle([npc('Edited animal','Human'),actors[1],actors[2]]),review=await prepare(input);
  assert.equal(review.counts.preserve,2);assert.equal(review.folderAssignments,2);
  assert.deepEqual(review.rows.find(r=>r.name==='Edited animal').folderPath,['Animal']);
  const before=edited.toObject();await execute(review);
  assert.equal(folderPath(pack,edited.toObject().folder),'Animal');assert.equal(manual.toObject().folder,custom.id);
  assert.deepEqual({...edited.toObject(),folder:undefined},{...before,folder:undefined});
  assert.equal(folderPath(pack,pack.docs[2].toObject().folder),'Monster / Plant');assert.equal(pack.docs[3].toObject().folder,undefined);
});

test('existing matching folders are reused only under the correct parent',async()=>{
  const env=setupImport(),pack=env.makePack('crows-bestiary','Actor');
  const monster=env.makeFolder(pack,{name:'Monster'}),blood=env.makeFolder(pack,{name:'Blood',folder:monster.id});
  const rootBlood=env.makeFolder(pack,{name:'Blood'});
  await execute(await prepare(bundle([npc('Creature','Blood')])));
  assert.equal(pack.docs[0].toObject().folder,blood.id);assert.ok(pack.folders.has(rootBlood.id));
  assert.equal(pack.folders.size,10);
});

test('ambiguous folders and folder edits since review stop before content writes',async()=>{
  const env=setupImport(),pack=env.makePack('crows-bestiary','Actor'),input=bundle([npc('Creature','Blood')]);
  const monster=env.makeFolder(pack,{name:'Monster'}),review=await prepare(input);
  monster.edit(d=>{d.name='Renamed';});env.writes.length=0;
  await assert.rejects(execute(review),/changed since the review/);assert.deepEqual(env.writes,[]);
  env.makeFolder(pack,{name:'Animal'});env.makeFolder(pack,{name:'Animal'});
  await assert.rejects(prepare(input),/multiple Animal folders/);assert.deepEqual(env.writes,[]);
});

test('folder failure keeps imported Actors and retry completes without duplicate folders',async()=>{
  const env=setupImport(),input=bundle([npc('Creature','Demon')]),create=Folder.createDocuments;let calls=0;
  Folder.createDocuments=async(...args)=>{if(++calls===3)throw new Error('Folder save failed');return create(...args);};
  await assert.rejects(execute(await prepare(input)),/folder organization stopped: Folder save failed/);
  const pack=env.packs.get('world.crows-bestiary');assert.equal(pack.docs.length,1);assert.equal(pack.folders.size,2);
  assert.equal(adapter.CrowsContentImport.busy,false);
  Folder.createDocuments=create;
  await execute(await prepare(input));assert.equal(pack.docs.length,1);assert.equal(pack.folders.size,9);
  assert.equal(folderPath(pack,pack.docs[0].toObject().folder),'Monster / Demon');
});

test('cancellation during filing retains completed folder assignments and retry files the rest',async()=>{
  const env=setupImport(),input=bundle([npc('One'),npc('Two')]),controller=new AbortController();
  const create=CompendiumCollection.createCompendium;
  CompendiumCollection.createCompendium=async config=>{
    const pack=await create(config),createActors=pack.documentClass.createDocuments;
    pack.documentClass.createDocuments=async data=>{
      const created=await createActors(data);
      for(const doc of created){const update=doc.update;doc.update=async value=>{const result=await update.call(doc,value);if(value.folder)controller.abort();return result;};}
      return created;
    };
    return pack;
  };
  await assert.rejects(execute(await prepare(input),{signal:controller.signal}),/Import cancelled/);
  const pack=env.packs.get('world.crows-bestiary');assert.equal(pack.docs.filter(d=>d.toObject().folder).length,1);
  assert.equal(pack.folders.size,9);
  await execute(await prepare(input));assert.equal(pack.docs.filter(d=>d.toObject().folder).length,2);assert.equal(pack.folders.size,9);
});
