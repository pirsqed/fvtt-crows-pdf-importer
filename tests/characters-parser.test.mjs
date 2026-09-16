import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCharacterBook,parseBackgroundEquipment,finalizeBackgrounds,traitItems} from '../scripts/characters-parser.mjs';
import {extractPacket} from '../scripts/packet.mjs';

const rawBackground={name:'Apprentice',roll:'1-1',blurb:'Studies magic.',fields:{'Characteristic at 2':'Mind or Agility',Stamina:'7',Trait:'Smithing: Sieze the Advantage',Expertises:'Blacksmith (2 uses), Athletics',Equipment:'knife, spellbooks: example spell'}};
const book=()=>({backgrounds:[structuredClone(rawBackground)],common:{equipment:[{name:'Knife',quantity:1}],startingGold:'2d6',speed:5},connections:[]});
const spell={name:'Example Spell Book',spell:{rank:1}};

test('equipment retains pets, quantities, notes, extra gold and multiword spell names',()=>{
  const result=parseBackgroundEquipment('knife (2), lore book (History), lore book (Nature), dog (pet), 12 extra gold coins, spellbooks: example, spell',new Map([['example spell',1]]));
  assert.deepEqual(result,{equipment:[{name:'Knife',quantity:2},{name:'Lore Book',quantity:2,note:'History, Nature'},{name:'Example Spell Book R1',quantity:1}],pets:['Dog'],extraGold:12});
  assert.throws(()=>parseBackgroundEquipment('spellbooks: example spell',new Map()),/Unresolved starting spell/);
});

test('background mapping combines common kits and preserves expertise uses and corrected trait names',()=>{
  const [b]=finalizeBackgrounds(book(),[spell]);
  assert.deepEqual(b.characteristicAt2,['Mind','Agility']);assert.equal(b.stamina,7);
  assert.deepEqual(b.trait,{tree:'Blacksmithing',name:'Seize the Advantage'});
  assert.deepEqual(b.expertises,[{name:'Blacksmithing',uses:2},{name:'Athletics',uses:1}]);
  assert.equal(b.startingKit[0].quantity,2);assert.equal(b.startingGold,'2d6');
  assert.throws(()=>finalizeBackgrounds(book(),[spell,{name:spell.name,spell:{rank:2}}]),/Ambiguous rank/);
  const broken=book();broken.backgrounds[0].fields.Stamina='unknown';assert.throws(()=>finalizeBackgrounds(broken,[spell]),/invalid background/);
});

test('trait mapping distinguishes connected traits from cheaper prerequisites and escapes descriptions',()=>{
  const records=Array.from({length:12},(_,i)=>({name:i===0?'Sieze the Advantage':i===11?'Weapon Expert':`Trait ${i}`,cost:10*(Math.floor(i/3)+1),starting:i<3,desc:'Safe <img> text'}));
  const items=traitItems({lines:[{spans:[{size:14,text:'Blackmsithing'}]}]},{records,groups:[[0,3,6]]},8);
  assert.equal(items[3].system.tree,'Blacksmithing');assert.equal(items[3].system.prerequisites,'Seize the Advantage');
  assert.deepEqual(items[3].flags['fvtt-crows-pdf-importer'].connected,['Seize the Advantage','Trait 6']);
  assert.equal(items[0].system.prerequisites,'Starting Trait');assert.equal(items[3].system.tier,'Tier 2');
  assert.equal(items[3].system.description,'<p>Safe &lt;img&gt; text</p>');
  assert.equal(items[11].img,'icons/tools/smithing/anvil.webp');
  assert.throws(()=>traitItems({lines:[]},{records:[],groups:[]},8),/12 traits/);
});

test('trait prerequisite alternatives use pipes without splitting names containing or',()=>{
  const records=Array.from({length:12},(_,i)=>({name:i===0?'Fight or Flight':`Trait ${i}`,cost:10*(Math.floor(i/3)+1),starting:i<3,desc:''}));
  const items=traitItems({lines:[{spans:[{size:14,text:'Test Tree'}]}]},{records,groups:[[0,1,3,6]]},8);
  assert.equal(items[3].system.prerequisites,'Fight or Flight | Trait 1');
  assert.deepEqual(items[3].system.prerequisites.split('|').map(name=>name.trim()),['Fight or Flight','Trait 1']);
  assert.equal(items[6].system.prerequisites,'Fight or Flight | Trait 1 | Trait 3');
  assert.equal(items[0].system.prerequisites,'Starting Trait');
  assert.equal(items[4].system.prerequisites,'');
});

test('connection benefits continue across pages and common kit values come from text',()=>{
  const line=(text,x=0,y=0,bold=false,size=10)=>({text,x,y,bold,size});
  const first=[line('Every PC has an empty coin purse, a knife, a rope, six rations, and 3d6 gc.'),line('All PCs have a starting speed on 5.')];
  const second=[];
  for(let i=0;i<36;i++){
    const name=`Background ${String.fromCharCode(65+Math.floor(i/26))}${String.fromCharCode(65+i%26)}`;
    first.push(line(`${Math.floor(i/6)+1} ${i%6+1} ${name}`,300,i*10));
    second.push(line(name,0,i*80,true,12),line('Characteristic at 2: Mind',0,0,true),line('Stamina: 5',0,0,true),line('Trait: Test: Starting',0,0,true),line('Expertises: Athletics',0,0,true),line('Equipment: knife',0,0,true));
  }
  const start=[line('NPC Connection'),...Array.from({length:9},(_,i)=>line(`● Benefit ${i}: Description ${i}.`)),line('● Last benefit: Continues')];
  const end=[line('onto the next page.'),line('Village Cycle'),line('Not a connection.')];
  const parsed=parseCharacterBook([{lines:first},{lines:second},{lines:start},{lines:end}]);
  assert.equal(parsed.backgrounds.length,36);assert.equal(parsed.connections.length,10);
  assert.equal(parsed.connections[9].description,'Continues onto the next page.');
  assert.equal(parsed.common.equipment[3].quantity,6);assert.equal(parsed.common.startingGold,'3d6');
});

test('packet resolves backgrounds after all PDFs and reports missing inventory without losing traits',async()=>{
  const characters={source:'characters',path:'Characters.pdf'},inventory={source:'core',path:'Cards.pdf'};
  const extractFile=async entry=>entry.source==='characters'?{pages:[],documents:[{type:'trait'}],characterData:book()}:{pages:[],documents:[],parsedCards:[spell]};
  const complete=await extractPacket([characters,inventory],{extractFile});assert.equal(complete.backgrounds.length,1);assert.deepEqual(complete.backgroundIssues,[]);
  const partial=await extractPacket([characters],{extractFile});assert.equal(partial.backgrounds.length,0);assert.equal(partial.documents.length,1);assert.match(partial.backgroundIssues[0],/Include the core inventory/);
});
