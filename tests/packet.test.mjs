import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverPacket,reviewPacket,extractPacket,extractPacketFile} from '../scripts/packet.mjs';
import {canReviewPacket} from '../scripts/packet-preview.mjs';
import {extractPage} from '../scripts/extract.mjs';
const file=(name,path=name)=>({name,webkitRelativePath:path,arrayBuffer(){throw new Error('Discovery must not read files.');}});

test('Playtest 3 renamed books are discovered without treating a referee screen as the Ref book',()=>{
  const entries=discoverPacket(['02 Crows Character Booklet for Playtest 3.pdf','03 Crows The Ref for Playtest 3.pdf','05 Crows Referee Screen for Playtest 2.pdf'].map(name=>file(name)));
  assert.deepEqual(entries.map(e=>e.source),['characters','ref','']);
});

test('Ref packet keeps tables and correction notes available for review',async()=>{
  const table={name:'Example',formula:'1d6',results:[]};
  const result=await extractPacket(discoverPacket([file('Ref Book.pdf')]),{extractFile:async()=>({pages:[],tables:[table],tableWarnings:['Correction applied']})});
  assert.deepEqual(result.tables,[table]);assert.deepEqual(result.tableWarnings,['Correction applied']);assert.deepEqual(result.documents,[]);
});

test('folder discovery includes nested PDFs, excludes extra copies, and detects all three sets',()=>{
  const entries=discoverPacket([file('02 Crows Invetory Cards.pdf','Packet/Inventory/02 Crows Invetory Cards.pdf'),file('Cards by Profession.PDF'),file('Cards for POIs and Dungeons.pdf'),file('Cards Annotated.pdf'),file('Characters Book.pdf'),file('picture.webp'),file('Cards.pdf','Packet/__MACOSX/Cards.pdf')]);
  assert.equal(entries.length,6);assert.deepEqual(reviewPacket(entries).missing,['ref','rules']);
  assert.equal(reviewPacket(entries).selected.length,4);assert.equal(reviewPacket(entries).errors.length,0);
});

test('duplicates need an explicit choice; renamed PDFs and partial packets are supported',()=>{
  const entries=discoverPacket([file('Inventory Cards.pdf'),file('Inventory Cards copy.pdf'),file('renamed.pdf')]);
  assert.equal(reviewPacket(entries).errors.length,1);
  entries[1].source='';entries[2].source='profession';
  assert.deepEqual(reviewPacket(entries).missing,['poi','ref','rules','characters']);assert.deepEqual(reviewPacket(entries).errors,[]);
});

test('additional card PDFs are repeatable and may be selected without the base packet',()=>{
  const entries=discoverPacket([file('Spells for Patreon.pdf'),file('Homebrew Cards.pdf'),file('renamed.pdf')]);
  assert.equal(entries.find(e=>e.file.name==='Spells for Patreon.pdf').source,'cards');
  assert.equal(entries.find(e=>e.file.name==='Homebrew Cards.pdf').source,'cards');
  entries.find(e=>e.file.name==='renamed.pdf').source='cards';
  const review=reviewPacket(entries);
  assert.equal(review.selected.length,3);assert.deepEqual(review.errors,[]);
  assert.ok(!review.missing.includes('cards'));
  const mixed=reviewPacket([...entries,...discoverPacket([file('Inventory Cards.pdf')])]);
  assert.deepEqual(mixed.errors,[]);assert.equal(mixed.selected.length,4);
});

test('saved web pages and invalid files get actionable PDF errors before parsing',async()=>{
  await assert.rejects(extractPage(new TextEncoder().encode('<!DOCTYPE html><title>Log in</title>'),null,'cards'),/web page, not a PDF.*Download the PDF attachment/);
  await assert.rejects(extractPage(new TextEncoder().encode('not a PDF'),null,'cards'),/does not contain a PDF header/);
});

test('additional card extraction passes the file path to its worker',async()=>{
  const previous=globalThis.Worker;let message;
  globalThis.Worker=class{
    terminate(){}
    postMessage(data){message=data;queueMicrotask(()=>this.onmessage({data:{result:{parsedCards:[]}}}));}
  };
  try{
    await extractPacketFile({source:'cards',path:'Supplements/Spells.pdf',file:{arrayBuffer:async()=>new ArrayBuffer(0)}});
    assert.equal(message.kind,'cards');assert.equal(message.source,'cards');assert.equal(message.file,'Supplements/Spells.pdf');
  }finally{if(previous)globalThis.Worker=previous;else delete globalThis.Worker;}
});

test('batch processing is sequential, records file errors, and preserves successful file results',async()=>{
  const entries=discoverPacket([file('Cards.pdf'),file('Profession Cards.pdf'),file('POI Cards.pdf')]);
  let active=0;const progress=[];
  const report=await extractPacket(entries,{onProgress:p=>progress.push(p),extractFile:async(entry,{onProgress})=>{
    assert.equal(active++,0);await Promise.resolve();active--;
    if(entry.source==='profession')throw new Error('Page 2: invalid PDF');
    onProgress({page:2,total:2});return {pages:[{page:1,cards:0},{page:2,cards:1}],parsedCards:[{source:entry.source}],documents:[{name:entry.source}]};
  }});
  assert.equal(report.files.length,2);assert.equal(report.documents.length,2);assert.equal(report.errors[0].source,'profession');
  assert.equal(canReviewPacket(report,true),true);
  assert.ok(progress.some(p=>p.total===2));assert.equal(progress.at(-1).files,3);
});

test('partial-packet review permits unresolved kits but still blocks invalid documents, empty results, and players',()=>{
  const report={documents:[{name:'Trait'}],actors:[],tables:[],backgroundIssues:['Missing kit'],validation:{status:'passed'}};
  assert.equal(canReviewPacket(report,true),true);
  assert.equal(canReviewPacket(report,false),false);
  assert.equal(canReviewPacket({...report,documents:[]},true),false);
  for(const field of ['validation','actorValidation','tableValidation'])
    assert.equal(canReviewPacket({...report,[field]:{status:'failed'}},true),false);
  assert.equal(canReviewPacket({...report,documents:[],tables:[{name:'Miasma'}]},true),true);
  assert.equal(canReviewPacket({...report,documents:[],actors:[{name:'Creature'}]},true),true);
});

test('cancellation stops the queue without returning a partial success',async()=>{
  const controller=new AbortController();let calls=0;
  await assert.rejects(extractPacket(discoverPacket([file('Cards.pdf'),file('Profession Cards.pdf')]),{signal:controller.signal,extractFile:async()=>{
    calls++;controller.abort();return {pages:[],documents:[],parsedCards:[]};
  }}),{name:'AbortError'});
  assert.equal(calls,1);
});

test('abort terminates a worker even while the browser is reading a file',async()=>{
  let terminated=0,posted=0,release;
  globalThis.Worker=class{terminate(){terminated++;}postMessage(){posted++;}};
  try{
    const controller=new AbortController();
    const promise=extractPacketFile({source:'core',file:{arrayBuffer:()=>new Promise(resolve=>release=resolve)}},{signal:controller.signal});
    controller.abort();await assert.rejects(promise,{name:'AbortError'});
    release(new ArrayBuffer(0));await Promise.resolve();assert.equal(terminated,1);assert.equal(posted,0);
  }finally{delete globalThis.Worker;}
});

test('the Rules Book is detected separately from the Ref book',()=>{
  const entries=discoverPacket([file('01 Crows The Rules Book for Playtest 2.pdf'),file('03 Crows The Ref Book for Playtest 2.pdf')]);
  assert.deepEqual(entries.map(entry=>entry.source),['rules','ref']);
});
