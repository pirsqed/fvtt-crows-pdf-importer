import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNPCBlock,npcToActor,validateActorPreview} from '../scripts/npc-parser.mjs';
import {discoverPacket,extractPacket} from '../scripts/packet.mjs';
const row=(text,bold=false)=>({text,first_bold:bold,all_bold:bold});
const rows=()=>[row('Test Guard (Power 4)',true),row('Size: Medium Power: 3 Type: Human'),row('Stamina: 12 Speed: 5 Slots: 10'),row('Agility: 2 Mind: 0 Strength: 1'),row('Expertises: Athletics'),row('Equipment: Shield,'),row('spear'),row('Attack Range 12-16 17+',true),row('Spear (+3)* Melee 2 3 dam 6 dam'),row('*First feature',true),row('First effect.'),row('*Second feature',true),row('Second effect.')];

test('NPC stats, wrapped equipment and attack notes become a Human combat Actor',()=>{
  const block=parseNPCBlock(rows(),23),actor=npcToActor(block);
  assert.equal(block.stats.Equipment,'Shield, spear');assert.equal(actor.type,'monster');assert.equal(actor.system.type,'Human');
  assert.equal(actor.system.power,4);assert.equal(actor.flags['fvtt-crows-pdf-importer'].stats.Power,'3');
  assert.equal(actor.prototypeToken.disposition,0);assert.equal(actor.items.length,3);
  assert.equal(actor.items[0].system.bonus,'+3');assert.equal(actor.items[0].system.tier3Damage,'6 dam');
  assert.match(actor.items[0].system.notes,/First effect/);assert.match(actor.items[0].system.notes,/Second effect/);
  assert.equal(actor.flags['fvtt-crows-pdf-importer'].source.page,23);
});

test('NPC parser skips prose and rejects incomplete stat blocks',()=>{
  assert.equal(parseNPCBlock([row('Encounter description'),row('No creature statistics here.')],1),null);
  assert.throws(()=>parseNPCBlock(rows().filter(r=>!r.text.startsWith('Stamina')),1),/missing Stamina/);
  assert.throws(()=>parseNPCBlock(rows().filter(r=>!r.text.startsWith('Spear')),1),/no attacks/);
});

test('animal, blood, undead and unique Actors retain type, icon, size and disposition',()=>{
  for(const [type,size,width,disposition] of [['Animal','Huge',2,0],['Blood','Large',1,-1],['Undead','Holy Shit!',3,-1],['Unique','Medium',1,-1]]){
    const input=rows();input[0]=row(type==='Animal'?'Bear':type==='Undead'?'Undead Creature A':'Test Creature',true);
    input[1]=row(`Size: ${size} Power: 3 Type: ${type}`);
    input[2]=row('Stamina: 12 Speed: 5'); // Creatures can omit inventory slots.
    const block=parseNPCBlock(input,32),actor=npcToActor(block);
    assert.equal(actor.system.type,type);assert.equal(actor.system.slots,0);
    assert.equal(actor.prototypeToken.width,width);assert.equal(actor.prototypeToken.height,width);assert.equal(actor.prototypeToken.disposition,disposition);
    if(type==='Animal')assert.match(actor.img,/bear-roar/);
    if(type==='Unique')assert.match(actor.img,/silhouette/);
    if(type==='Undead')assert.equal(actor.name,'Undead A');
  }
});

test('expertise use counts printed in the label remain attached to the list',()=>{
  const input=rows();input[4]=row('Expertises (2 uses all): Athletics, Lift, Stabbing',true);
  const block=parseNPCBlock(input,27);assert.equal(block.stats.Expertises,'(2 uses all) Athletics, Lift, Stabbing');
  assert.match(npcToActor(block).system.description,/Expertises:<\/b> \(2 uses all\) Athletics/);
});

test('feature text and titles cannot introduce executable HTML',()=>{
  const input=rows();input[9]=row('*<img src=x onerror=bad()>',true);input[10]=row('<script>bad()</script>');
  const actor=npcToActor(parseNPCBlock(input,1));
  assert.ok(!actor.items[0].system.notes.includes('<img'));assert.ok(!actor.items[1].system.description.includes('<script>'));
  assert.match(actor.items[1].system.description,/&lt;script&gt;/);
});

test('Ref book discovery and batch results keep Actors separate from Items',async()=>{
  const entries=discoverPacket([{name:'03 Crows The Ref Book for Playtest 2.pdf'}]);assert.equal(entries[0].source,'ref');
  const block=parseNPCBlock(rows(),23),actor=npcToActor(block);
  const report=await extractPacket(entries,{extractFile:async()=>({pages:[{page:23,npcs:1}],npcRecords:[block],actors:[actor]})});
  assert.equal(report.actors.length,1);assert.equal(report.documents.length,0);assert.equal(report.files[0].npcs,1);
});

test('Actor validation checks embedded Items without saving documents',()=>{
  let actorChecks=0,itemChecks=0;
  globalThis.CONFIG={Actor:{dataModels:{monster:{}}}};
  globalThis.Actor=class{constructor(source,options){assert.equal(options.strict,true);this.items=source.items.map(()=>({validate(){itemChecks++;return true;}}));}validate(){actorChecks++;return true;}};
  try{assert.equal(validateActorPreview([npcToActor(parseNPCBlock(rows(),1))]).status,'passed');assert.equal(actorChecks,1);assert.equal(itemChecks,3);}
  finally{delete globalThis.CONFIG;delete globalThis.Actor;}
  assert.equal(validateActorPreview([]).status,'unavailable');
});
