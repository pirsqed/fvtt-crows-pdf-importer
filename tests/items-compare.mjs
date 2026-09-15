import {readFile,writeFile} from 'node:fs/promises';
import {cardToItem} from '../scripts/item-mapper.mjs';
import {compareCards} from './card-comparison.mjs';
const cases=JSON.parse(await readFile(new URL('../out/items-baseline.json',import.meta.url),'utf8'));
if(!cases.length)throw new Error('Empty Item baseline. Regenerate with build-card-baseline.py.');
const results=cases.map(({card,expected})=>{
  const actual=cardToItem(card);
  // Descriptions are rendered separately in browser tests. Everything else in
  // the legacy builder's Item schema must match, including its fallback icons.
  const fields=item=>{const value=structuredClone(item);delete value.flags;delete value.system.description;
    value.system.consumable.body_html=value.system.consumable.actionText;delete value.system.consumable.actionText;return value;};
  return {source:card.source,page:card.page,name:actual.name,differences:compareCards(fields(expected),fields(actual))};
});
const summary={items:results.length,passed:results.filter(r=>!r.differences.length).length};
await writeFile(new URL('../out/items-comparison.json',import.meta.url),JSON.stringify({summary,results},null,2));
console.log(summary);if(summary.passed!==summary.items){console.log(results.filter(r=>r.differences.length).slice(0,5));process.exitCode=1;}
