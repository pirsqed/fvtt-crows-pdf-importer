import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {extractPage} from '../scripts/extract.mjs';
import {compareCards} from './card-comparison.mjs';
const baseURL=pathToFileURL(process.env.FOUNDRY_PDFJS??'C:/Program Files/Foundry Virtual Tabletop/resources/app/node_modules/@foundryvtt/pdfjs/').href;
const pdfjs=await import(new URL('build/pdf.mjs',baseURL));
pdfjs.GlobalWorkerOptions.workerSrc=new URL('build/pdf.worker.mjs',baseURL).href;
const cases=JSON.parse(await readFile(new URL('../out/cards-baseline.json',import.meta.url),'utf8'));
if(!cases.length)throw new Error('Empty full-card baseline.');
const cache=new Map(),results=[];
for(const c of cases){
  if(!cache.has(c.file))cache.set(c.file,new Uint8Array(await readFile(c.file)));
  const actual=(await extractPage(cache.get(c.file),c.page,'cards',{pdfjs,baseURL,source:c.source})).parsedCards;
  const differences=compareCards(c.expected,actual);
  results.push({source:c.source,page:c.page,expected:c.expected,actual,differences,serializationDifferences:compareCards(c.expected,actual,'',false)});
}
const counts={};for(const r of results)for(const d of r.differences){const field=d.path.replace(/^\[\d+\]\./,'').split(/[.[]/)[0];counts[field]=(counts[field]??0)+1;}
const all=results.flatMap(r=>r.actual);
const summary={pages:results.length,cards:all.length,passed:results.filter(r=>!r.differences.length).length,counts,serializationDifferences:results.reduce((n,r)=>n+r.serializationDifferences.length,0),coverage:{tiers:all.filter(c=>c.tiers).length,spells:all.filter(c=>c.spell).length,weapons:all.filter(c=>c.weapon).length,crafting:all.filter(c=>c.crafting).length,variants:all.filter(c=>Object.keys(c.variants).length).length}};
await writeFile(new URL('../out/cards-comparison.json',import.meta.url),JSON.stringify({summary,results},null,2));
console.log(summary);if(Object.keys(counts).length)process.exitCode=1;
