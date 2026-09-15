import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {extractPage} from '../scripts/extract.mjs';
import {npcToActor} from '../scripts/npc-parser.mjs';
import {compareCards} from './card-comparison.mjs';
const baseURL=pathToFileURL(process.env.FOUNDRY_PDFJS??'C:/Program Files/Foundry Virtual Tabletop/resources/app/node_modules/@foundryvtt/pdfjs/').href;
const pdfjs=await import(new URL('build/pdf.mjs',baseURL));
pdfjs.GlobalWorkerOptions.workerSrc=new URL('build/pdf.worker.mjs',baseURL).href;
const expected=JSON.parse(await readFile(new URL('../out/npcs-baseline.json',import.meta.url),'utf8'));
const result=await extractPage(new Uint8Array(await readFile(expected.file)),null,'npcs',{pdfjs,baseURL,source:'ref'});
const differences=compareCards(expected.blocks,result.npcRecords);
const actors=result.npcRecords.map(npcToActor);
// Two features can share an attack marker. The new mapper keeps every linked
// note; the Python mapper retained only the final feature for each marker.
const actorDifferences=[];let improvedNotes=0;
actors.forEach((actor,index)=>{
  const actual=structuredClone(actor),oracle=structuredClone(expected.actors[index]);delete actual.flags;
  actual.items.forEach((item,i)=>{if(item.type==='attack'&&item.system.notes!==oracle.items[i]?.system.notes){
    const linked=result.npcRecords[index].features.filter(f=>item.system.notes.includes(f.html.replace(/^<p>|<\/p>$/g,'')));
    if(linked.length>1&&item.system.notes.endsWith(oracle.items[i].system.notes)){improvedNotes++;oracle.items[i].system.notes=item.system.notes;}
  }});
  actorDifferences.push(...compareCards(oracle,actual,`[${index}]`));
});
const types=Object.fromEntries([...new Set(actors.map(a=>a.system.type))].map(type=>[type,actors.filter(a=>a.system.type===type).length]));
const summary={pages:result.pages.length,npcs:result.npcRecords.length,types,blockDifferences:differences.length,actorDifferences:actorDifferences.length,improvedAttackNotes:improvedNotes,correctedExpertiseLabels:expected.corrections?.length??0};
await writeFile(new URL('../out/npcs-comparison.json',import.meta.url),JSON.stringify({summary,differences,actorDifferences},null,2));
console.log(summary);console.log([...differences,...actorDifferences].slice(0,8));
if(differences.length||actorDifferences.length)process.exitCode=1;
