import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNPCBlock,npcToActor,validateActorPreview,parseNPCSpeeds,npcs} from '../scripts/npc-parser.mjs';
import {discoverPacket,extractPacket} from '../scripts/packet.mjs';
const row=(text,bold=false)=>({text,first_bold:bold,all_bold:bold});
const rows=()=>[row('Test Guard (Power 4)',true),row('Size: Medium Power: 3 Type: Human'),row('Stamina: 12 Speed: 5 Slots: 10'),row('Agility: 2 Mind: 0 Strength: 1'),row('Expertises: Athletics'),row('Equipment: Shield,'),row('spear'),row('Attack Range 12-16 17+',true),row('Spear (+3)* Melee 2 3 dam 6 dam'),row('*First feature',true),row('First effect.'),row('*Second feature',true),row('Second effect.')];

test('movement separates base and named speeds while preserving annotations',()=>{
  assert.deepEqual(parseNPCSpeeds('6, climb 6 (U), swim 4; fly 8, burrow 2'), {
    base:6, modes:[{name:'climb',value:6},{name:'swim',value:4},{name:'fly',value:8},{name:'burrow',value:2}], notes:'climb: (U)'
  });
  assert.deepEqual(parseNPCSpeeds('0, fly 8'), {base:0,modes:[{name:'fly',value:8}],notes:''});
  assert.deepEqual(parseNPCSpeeds('fly 8'), {base:0,modes:[{name:'fly',value:8}],notes:''});
  assert.deepEqual(parseNPCSpeeds('5'), {base:5,modes:[],notes:''});
  assert.deepEqual(parseNPCSpeeds('5, shadow step 3, special movement in mist'), {
    base:5,modes:[{name:'shadow step',value:3}],notes:'special movement in mist'
  });
  assert.deepEqual(parseNPCSpeeds('Special movement only'), {base:0,modes:[],notes:'Special movement only'});
});

test('wrapped printed speeds reach the Actor as structured movement and retain source text',()=>{
  const input=rows();
  input.splice(2,1,row('Stamina: 12 Speed: 6,',true),row('climb 6 (U), swim 4'),row('Slots: 10',true));
  const actor=npcToActor(parseNPCBlock(input,23));
  assert.deepEqual(actor.system.movement, {base:6,modes:[{name:'climb',value:6},{name:'swim',value:4}],notes:'climb: (U)'});
  assert.equal(actor.system.speed,'6, climb 6 (U), swim 4');
  assert.equal(actor.flags['fvtt-crows-pdf-importer'].stats.Speed,actor.system.speed);
  assert.equal(actor.system.slots,10);
});

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

test('wrapped attack damage and negative attack bonuses survive parsing and mapping',()=>{
  const input=rows();input.splice(8,1,row('Web (-2) Melee 10 (3 tar) 4 P dam 6 P',true),row('dam*'));
  const block=parseNPCBlock(input,50),attack=npcToActor(block).items[0];
  assert.equal(block.attacks[0].t3,'6 P dam*');assert.equal(attack.system.bonus,'-2');assert.equal(attack.name,'Web');
});
test('two creatures in one shaded rectangle remain separate',()=>{
  const first=rows(),second=rows();first[0]=row('First',true);second[0]=row('Second',true);
  const lines=[...first,...second].map((r,i)=>({spans:[{text:r.text,bold:r.all_bold,bbox:[10,10+i*12,190,20+i*12]}]}));
  const paths=[{fill:true,rect:[0,0,200,400]}];
  const result=npcs({lines,paths},23);
  assert.deepEqual(result.map(n=>n.name),['First','Second']);
  assert.equal(result[0].features.length,2);
  assert.throws(()=>npcs({lines,paths:[]},23),/found 2 creature stat blocks but parsed 0/);
});

test('animal, blood, undead and unique Actors retain type, icon, size and disposition',()=>{
  for(const [type,size,width,disposition] of [['Animal','Huge',3,0],['Blood','Large',2,-1],['Undead','Holy Shit!',4,-1],['Unique','Medium',1,-1],['Animal','Small',1,0]]){
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
test('a stat block continued in the next column box keeps its remaining features',()=>{
  const first=rows();first[0]=row('Long Creature',true);
  const toLines=(list,x)=>list.map((r,i)=>({spans:[{text:r.text,bold:r.all_bold,bbox:[x+10,10+i*12,x+170,20+i*12]}]}));
  const continued=[row('3 No effect'),row('Extra Feature (3/Day)',true),row('The creature does a thing.'),row('No Prone',true),row("The creature can't be knocked prone.")];
  const lines=[...toLines(first,0),...toLines(continued,222)];
  const result=npcs({lines,paths:[{fill:true,rect:[0,0,200,400]},{fill:true,rect:[222,0,396,400]}]},56);
  assert.equal(result.length,1);
  assert.deepEqual(result[0].features.slice(-2).map(f=>f.title),['Extra Feature (3/Day)','No Prone']);
  assert.match(result[0].features.at(-3).lines.at(-1),/^3 No effect$/);
});
