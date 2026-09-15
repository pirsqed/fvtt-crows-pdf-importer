import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {cardToItem} from '../scripts/item-mapper.mjs';
import {npcToActor} from '../scripts/npc-parser.mjs';
import {resolveImport,prepareImport,executeImport,getCharacterContent} from '../scripts/import-content.mjs';
import {setupImport,adapter} from './import-harness.mjs';
import {validateBackgrounds,buildCrowPlan} from '../../fvtt-crows-system/module/character-creation.mjs';
const read=async name=>JSON.parse(await readFile(new URL(`../out/${name}-baseline.json`,import.meta.url),'utf8'));
const cards=(await read('cards')).flatMap(c=>c.expected),characters=await read('characters'),creatures=await read('npcs');
const report={documents:[...cards.map(cardToItem),...characters.traits],actors:creatures.blocks.map(npcToActor),backgrounds:characters.backgrounds,connections:characters.connections};
const unresolved=resolveImport(report),choices=Object.fromEntries(unresolved.conflicts.map(c=>[c.id,0])),bundle=resolveImport(report,choices);
assert.deepEqual(unresolved.conflicts,[]);
const loreNames=new Set(bundle.packs.flatMap(p=>p.data).filter(item=>item.name.startsWith('Lore Book')).map(item=>item.name));
assert.deepEqual([...loreNames].sort(),['Lore Book','Lore Book (Historical)','Lore Book (Magic)','Lore Book (Monster)','Lore Book (Nature)']);
const env=setupImport();
const review=await prepareImport(bundle,{adapter});assert.equal(env.writes.length,0);
const result=await executeImport(review,{adapter});assert.equal(result.published,true);
const content=await getCharacterContent();validateBackgrounds(content.backgrounds);
assert.equal(content.connections.length,10);assert.equal(content.traits.length,276);
for(const background of content.backgrounds){
  const primary=background.characteristicAt2[0]==='Any'?'agility':background.characteristicAt2[0].toLowerCase();
  buildCrowPlan({background,draft:{name:'Fixture Crow',feature:'Test',connectionName:'Friend',relationship:'Friend',connection:content.connections[0].name,primary,spread:'balanced',secondary:['agility','mind','strength'].find(key=>key!==primary),gold:10,traitChoice:content.traits.find(t=>t.system.tree==='Reputation')?.name},equipment:content.equipment,traits:content.traits,monsters:content.monsters,connections:content.connections,userId:'gm'});
}
const again=await prepareImport(bundle,{adapter});assert.equal(again.counts.create,0);assert.equal(again.counts.update,0);assert.equal(again.counts.preserve,0);
console.log({packs:review.packs.map(p=>[p.config.name,p.data.length]),conflicts:unresolved.conflicts.map(c=>c.name),published:result.published,backgroundPlans:36,repeat:again.counts});
