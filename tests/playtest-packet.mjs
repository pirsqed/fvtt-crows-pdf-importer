// Integration against user-owned PDFs; never commit the generated reports.
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,relative,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {discoverPacket,extractPacket} from '../scripts/packet.mjs';
import {extractPage} from '../scripts/extract.mjs';
import {cardToItem} from '../scripts/item-mapper.mjs';
import {npcToActor} from '../scripts/npc-parser.mjs';
import {resolveImport,prepareImport,executeImport,getCharacterContent} from '../scripts/import-content.mjs';
import {setupImport,adapter} from './import-harness.mjs';
import {validateBackgrounds,buildCrowPlan,primaryChoices,CHARACTERISTICS} from '../../fvtt-crows-system/module/character-creation.mjs';

const root=process.env.CROWS_PACKET_ROOT,version=Number(process.env.CROWS_PLAYTEST_VERSION);
if(!root||![2,3].includes(version))throw new Error('Set CROWS_PACKET_ROOT to your packet directory and CROWS_PLAYTEST_VERSION to 2 or 3.');
const baseURL=pathToFileURL(process.env.FOUNDRY_PDFJS??'C:/Program Files/Foundry Virtual Tabletop/resources/app/node_modules/@foundryvtt/pdfjs/').href;
const pdfjs=await import(new URL('build/pdf.mjs',baseURL));pdfjs.GlobalWorkerOptions.workerSrc=new URL('build/pdf.worker.mjs',baseURL).href;
async function files(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())result.push(...await files(path));else if(/\.pdf$/i.test(path))result.push(path);}return result;}
const entries=discoverPacket((await files(root)).map(path=>({name:basename(path),webkitRelativePath:relative(root,path),localPath:path}))).filter(e=>e.source!=='cards');
assert.equal(entries.filter(e=>e.source).length,6,'all six supported PDFs discovered without manual assignment');
const report=await extractPacket(entries,{extractFile:async entry=>{
  const result=await extractPage(new Uint8Array(await readFile(entry.file.localPath)),null,['ref','rules','characters'].includes(entry.source)?entry.source:'cards',{pdfjs,baseURL,source:entry.source});
  if(result.parsedCards)result.documents=result.parsedCards.map(cardToItem);
  if(result.npcRecords)result.actors=result.npcRecords.map(npcToActor);
  return result;
}});
await mkdir(new URL('../out/',import.meta.url),{recursive:true});
await writeFile(new URL(`../out/playtest-${version}-packet.json`,import.meta.url),JSON.stringify(report,null,2));
assert.deepEqual(report.errors,[]);assert.deepEqual(report.backgroundIssues,[]);
// The title fix also recovers the v2 Fine Coin Purse formerly missed by the oracle.
assert.equal(report.parsedCards.length,version===3?985:735);
assert.equal(report.actors.length,version===3?117:71);
assert.equal(report.tables.length,version===3?44:22);
assert.equal(report.documents.filter(d=>d.type==='trait').length,276);
assert.equal(report.backgrounds.length,36);assert.equal(report.connections.length,10);
const stackless=new Set(['Unidentified Item','Unfinished Craftable Item']);
for(const card of report.parsedCards){
  assert.equal(card.raw_lines.filter(t=>/Stack\s*\d+/.test(t)).length,stackless.has(card.name)?0:1,`${card.source} p${card.page}: ${card.name}`);
  assert.ok(card.name&&!/Stack|\bgc\b/.test(card.name),card.name);
  for(const placeholder of stackless)if(card.name!==placeholder)assert.ok(!card.raw_lines.includes(placeholder),`${card.name}: merged ${placeholder}`);
}
for(const table of report.tables){
  assert.match(table.description,new RegExp(`Playtest ${version}`));
  const max=table.name==='Miasma Effects'?13:Number(table.formula.slice(2));
  for(let n=1;n<=max;n++)assert.equal(table.results.filter(r=>r.range[0]<=n&&r.range[1]>=n).length,1,`${table.name}: result ${n}`);
}
if(version===3){
  assert.deepEqual(report.files.filter(f=>f.cards).map(f=>[f.source,f.cards]).sort(),[['core',207],['poi',243],['profession',535]]);
  assert.equal(report.parsedCards.filter(c=>c.name==='Unidentified Item').length,4);
  assert.equal(report.parsedCards.filter(c=>c.name==='Unfinished Craftable Item').length,1);
  const truthPoison=report.documents.find(d=>d.name==='Truth Poison');
  assert.ok(!truthPoison.system.description.includes('Unfinished Craftable Item'));
  assert.ok(!truthPoison.system.consumable.actionText.includes('Unfinished Craftable Item'));
  for(const [name,parry] of [['Knife',2],['Sword',4],['Glaive',6],['Greatsword',6]]){
    const weapon=report.documents.find(d=>d.name===name&&d.flags['fvtt-crows-pdf-importer'].source.set==='core');
    assert.equal(weapon.system.isArmor,true,name);assert.deepEqual(weapon.system.armor,{defense:parry,maxDefense:parry},name);
  }
  for(const name of ["Zaziel's Book of Elation",'Blood Concoction']){
    const doc=report.documents.find(d=>d.name===name);
    assert.equal(doc.system.crafting,'',name);assert.equal(doc.flags['fvtt-crows-pdf-importer'].unique,true,name);
  }
  for(const type of ['Angel','Blood','Demon','Plant','Undead']){
    const table=report.tables.find(t=>t.name===`${type} Dungeon Encounters`);
    assert.ok(table,`${type} Dungeon Encounters`);assert.equal(table.formula,'1d100');assert.equal(table.results.length,24);
  }
  const backlashes=report.tables.find(t=>t.name==='Backlashes');
  assert.equal(backlashes.results.length,55);assert.deepEqual(backlashes.results.at(-1).range,[105,105]);
  assert.ok(backlashes.results.some(r=>r.range[0]===63&&r.range[1]===64));
  const regret=report.actors.find(a=>a.name==='Elemental of Regret');
  for(const feature of ['Warp World (3/Day)','Sorrow (only once per round)','Two Extra Actions','No Prone'])
    assert.ok(regret.items.some(i=>i.name===feature),`Elemental of Regret: ${feature}`);
  for(const doc of report.documents.filter(d=>d.name==="Zaziel's Book of Elation")){
    assert.equal(doc.system.isSpellbook,true);assert.equal(doc.system.consumable.maxUD,6);
    assert.match(doc.system.description,/Each spell has 2 UD\./);
  }
  for(const doc of report.documents.filter(d=>d.name==='Hurling Wand')){
    assert.equal(doc.system.consumable.maxUD,1,doc.flags['fvtt-crows-pdf-importer'].source.set);
    assert.ok(!doc.system.consumable.actionText.includes('UD'));
  }
  for(const name of ['NDT Longbow','NDT Longbow (Hungry)']){
    const bow=report.documents.find(d=>d.name===name);assert.ok(bow,name);assert.equal(bow.system.slots,2);
    assert.ok(!bow.system.description.includes('Slots)'));
  }
  for(const name of ['Grow Book','Illusory Double Book'])assert.ok(report.parsedCards.some(c=>c.source==='core'&&c.name===name));
  const greaterAnimal=report.documents.find(d=>d.name==='Greater Animal Form Book R3'&&d.flags['fvtt-crows-pdf-importer'].source.set==='core');
  assert.ok(greaterAnimal?.system.isSpellbook,'the printed BooK title must retain casting behavior');
  assert.equal(greaterAnimal.flags['fvtt-crows-pdf-importer'].spell.rank,3);
  const bolts=report.documents.find(d=>d.name==='Case of Crossbow Bolts'&&d.flags['fvtt-crows-pdf-importer'].source.set==='core');
  assert.equal(bolts.system.contentsMax,20);assert.equal(bolts.system.contentsType,'bolts');
  assert.ok(!report.documents.some(d=>['Bolts','Case of 20 Crossbow'].includes(d.name)));
  const corrupt=report.parsedCards.find(c=>c.source==='core'&&c.name==='Corrupt Book');
  assert.equal(corrupt.spell.discipline,'Necromancy');assert.equal(corrupt.spell.cast,'Attack');
  const shape=report.parsedCards.find(c=>c.source==='core'&&c.name==='Take Shape Book');
  assert.equal(shape.spell.range,'Self');assert.equal(shape.spell.duration,'1 UD');
  assert.equal(report.parsedCards.find(c=>c.source==='core'&&c.name==='Frostburn Book').spell.discipline,'Elemental');
  assert.equal(report.parsedCards.filter(c=>c.wearable).length,16);
  for(const [name,forbidden] of [['Crocodile','Crow'],['Rat','Scorpion, Giant']]){
    assert.ok(report.npcRecords.some(n=>n.name===forbidden));
    assert.ok(!report.npcRecords.find(n=>n.name===name).features.some(f=>f.title===forbidden));
  }
  assert.equal(report.npcRecords.find(n=>n.name==='Blood Creature H').attacks[0].t3,'6 P dam*');
  const gap=report.tables.find(t=>t.name==='Miasma-Touched Humans').results.find(r=>r.range[0]===29);
  assert.equal(gap.name,'Unspecified printed result');assert.match(gap.description,/choose an encounter or reroll/);
  assert.ok(report.tableWarnings.some(t=>/omits result 29/.test(t)));
  assert.ok(!report.tableWarnings.some(t=>/Playtest 2 correction/.test(t)));
  for(const subject of ['Monster','Magic','Nature','Historical'])assert.ok(report.documents.some(d=>d.name===`Lore Book (${subject})`));
}else{
  assert.equal(report.tables.find(t=>t.name==='Undead Dungeon Encounters').formula,'1d10');
  assert.ok(report.tableWarnings.some(t=>/Playtest 2 corrections/.test(t)));
}
const bundle=resolveImport(report);
assert.deepEqual(bundle.conflicts,[],'official packet should preserve all variants without conflict choices');
if(version===3){
  const loot=bundle.packs.find(p=>p.config.name==='crows-dungeon-loot').data;
  assert.equal(loot.length,76);assert.equal(bundle.packs.find(p=>p.config.name==='crows-equipment').data.length,210);
  for(const [name,enchantment,price,enchantedPrice] of [['Steel Hammer','Flaming',510,5510],['EE Greataxe','Slaying (Human)',18015,19015],
    ['DH Light Armor','Silent',9200,10200],['Greatsword','Flaming',15,5015],['NDT Longbow','Hungry',4012,9012]]){
    const ordinary=loot.find(d=>d.name===name),enchanted=loot.find(d=>d.name===`${name} (${enchantment})`);
    assert.ok(ordinary,name);assert.ok(enchanted,`${name} (${enchantment})`);
    assert.equal(ordinary.system.cost,price);assert.equal(enchanted.system.cost,enchantedPrice);
    assert.equal(enchanted.flags['fvtt-crows-pdf-importer'].enchantment,enchantment);
    assert.ok(enchanted.system.traits.includes(`Enchantment: ${enchantment}`));
  }
  assert.match(loot.find(d=>d.name==='Healing Potion').system.description,/belt slot/);
  for(const name of ['Gem','Creature Part','Unidentified Item'])assert.equal(loot.filter(d=>d.name===name).length,1);
}
const env=setupImport();
const review=await prepareImport(bundle,{adapter});assert.equal(env.writes.length,0);
const imported=await executeImport(review,{adapter});assert.equal(imported.published,true);
const bestiary=env.packs.get('world.crows-bestiary');assert.equal(bestiary.folders.size,9);
const folderIds=[...bestiary.folders.keys()];
assert.equal(imported.results.find(r=>r.label==='Bestiary').filed,version===3?117:71);
assert.ok(bestiary.docs.every(actor=>bestiary.folders.has(actor.toObject().folder)));
const content=await getCharacterContent();validateBackgrounds(content.backgrounds);
assert.ok(content.monsters.every(actor=>!actor.folder),'published pet templates do not retain compendium folder IDs');
for(const background of content.backgrounds){
  const primary=primaryChoices(background)[0];
  const plan=buildCrowPlan({background,equipment:content.equipment,traits:content.traits,monsters:content.monsters,connections:content.connections,userId:'gm',draft:{name:'Test Crow',feature:'Test',connectionName:'Friend',relationship:'Friend',connection:content.connections[0].name,primary,secondary:CHARACTERISTICS.find(k=>k!==primary),spread:'balanced',gold:10,traitChoice:'Test merchant'}});
  assert.deepEqual(plan.crow.system.effort,{value:2,max:2});
  assert.ok(Object.values(plan.crow.system.expertises).every(e=>e.trained===true));
}
const again=await prepareImport(bundle,{adapter});
for(const action of ['create','update','preserve'])assert.equal(again.counts[action],0);
assert.equal(again.folderAssignments,0);
await executeImport(again,{adapter});assert.deepEqual([...bestiary.folders.keys()],folderIds);
console.log(JSON.stringify({version,cards:report.parsedCards.length,npcs:report.actors.length,tables:report.tables.length,backgrounds:36,plans:36,conflicts:bundle.conflicts.map(c=>c.name),published:imported.published,repeat:again.counts}));
