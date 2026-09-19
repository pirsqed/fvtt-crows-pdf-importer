import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverPacket,reviewPacket,extractPacket,extractPacketFile} from '../scripts/packet.mjs';
const file=(name,path=name)=>({name,webkitRelativePath:path,arrayBuffer(){throw new Error('Discovery must not read files.');}});

test('Ref packet keeps tables and correction notes available for review',async()=>{
  const table={name:'Example',formula:'1d6',results:[]};
  const result=await extractPacket(discoverPacket([file('Ref Book.pdf')]),{extractFile:async()=>({pages:[],tables:[table],tableWarnings:['Correction applied']})});
  assert.deepEqual(result.tables,[table]);assert.deepEqual(result.tableWarnings,['Correction applied']);assert.deepEqual(result.documents,[]);
});

test('folder discovery includes nested PDFs, excludes extra copies, and detects all three sets',()=>{
  const entries=discoverPacket([file('02 Crows Invetory Cards.pdf','Packet/Inventory/02 Crows Invetory Cards.pdf'),file('Cards by Profession.PDF'),file('Cards for POIs and Dungeons.pdf'),file('Cards Annotated.pdf'),file('Characters Book.pdf'),file('picture.webp'),file('Cards.pdf','Packet/__MACOSX/Cards.pdf')]);
  assert.equal(entries.length,6);assert.deepEqual(reviewPacket(entries).missing,['ref']);
  assert.equal(reviewPacket(entries).selected.length,4);assert.equal(reviewPacket(entries).errors.length,0);
});

test('duplicates need an explicit choice; renamed PDFs and partial packets are supported',()=>{
  const entries=discoverPacket([file('Cards.pdf'),file('Cards copy.pdf'),file('renamed.pdf')]);
  assert.equal(reviewPacket(entries).errors.length,1);
  entries[1].source='';entries[2].source='profession';
  assert.deepEqual(reviewPacket(entries).missing,['poi','ref','characters']);assert.deepEqual(reviewPacket(entries).errors,[]);
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
  assert.ok(progress.some(p=>p.total===2));assert.equal(progress.at(-1).files,3);
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
