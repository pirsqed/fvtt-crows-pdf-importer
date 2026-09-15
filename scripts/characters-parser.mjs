import {escapeHTML,norm} from './card-parser.mjs';

const itemAliases={'extra knife':'Knife','knife':'Knife','gluepot':'Glue Pot','glue pot':'Glue Pot','quill and ink pot':'Quill & Inkpot','quill and inkpot':'Quill & Inkpot','quiver of arrows':'Quiver of Arrows','case of bolts':'Case of Crossbow Bolts',"alchemist's tools":"Alchemist's Tools","blacksmith's tools":"Blacksmith's Tools","cook's utensils":"Cook's Utensils","merchant's scales":"Merchant's Scales",'11-foot pole':'11-Foot Pole','lore book':'Lore Book','musical instrument':'Musical Instrument'};
const petAliases={'riding horse':'Horse, Riding','draft horse':'Horse, Draft','war horse':'Horse, War'};
const fixTrait=name=>name==='Sieze the Advantage'?'Seize the Advantage':name;
const fixTree=name=>['Smithing','Blackmsithing'].includes(name)?'Blacksmithing':name;
const title=text=>text.split(' ').map((word,i)=>i&&['of','the','and','&'].includes(word.toLowerCase())?word.toLowerCase():word[0]?.toUpperCase()+word.slice(1)).join(' ');

export function characterLines(layout){
  return layout.lines.filter(line=>line.spans.some(s=>s.text.trim())).map(line=>{
    const first=line.spans.find(s=>s.text.trim());
    return {x:line.bbox[0],y:line.bbox[1],text:norm(line.spans.map(s=>s.text).join('')),size:first.size,bold:first.bold};
  }).filter(line=>line.size>=8.5).sort((a,b)=>Number(a.x>=200)-Number(b.x>=200)||a.y-b.y);
}

export function traitItems(layout,result,page){
  const heading=layout.lines.flatMap(l=>l.spans).find(s=>s.size>=11.5&&s.text.trim());
  const tree=fixTree(norm(heading?.text??''));
  if(!tree||result.records.length!==12)throw new Error(`Page ${page}: expected a named tree with 12 traits.`);
  const records=result.records.map(r=>({...r,name:fixTrait(r.name)}));
  return records.map((r,index)=>{
    if(!r.name||!Number.isInteger(r.cost)||r.cost<0)throw new Error(`Page ${page}: incomplete trait ${index+1}.`);
    const links=[...new Set(result.groups.filter(group=>group.includes(index)).flat())].filter(i=>i!==index).sort((a,b)=>a-b);
    const prerequisites=r.starting?'Starting Trait':links.filter(i=>records[i].cost<=r.cost).map(i=>records[i].name).join(' | ');
    return {name:r.name,type:'trait',img:'icons/sundries/books/book-worn-brown.webp',system:{tree,tier:['Starting','Tier 2','Tier 3','Tier 4'][Math.floor(index/3)],cost:r.cost,prerequisites,description:`<p>${escapeHTML(r.desc)}</p>`},
      flags:{'fvtt-crows-pdf-importer':{schemaVersion:1,source:{set:'characters',page,box:index},connected:links.map(i=>records[i].name)}}};
  });
}

/** Preserve column order and cross-page continuations before interpreting fields. */
export function parseCharacterBook(pages){
  const rolls=new Map(),backgrounds=[];let current;
  for(const page of pages){
    // Background roll table occupies the right column; merge its separated cells.
    const right=page.lines.filter(l=>l.x>=200).sort((a,b)=>a.y-b.y||a.x-b.x),rows=[];
    for(const line of right){let row=rows.at(-1);if(!row||Math.abs(row.y-line.y)>2.5){row={y:line.y,parts:[]};rows.push(row);}row.parts.push(line);}
    for(const row of rows){const match=row.parts.sort((a,b)=>a.x-b.x).map(l=>l.text).join(' ').match(/^([1-6])\s+([1-6])\s+([A-Z][A-Za-z' ]+)$/);if(match)rolls.set(match[3].trim(),`${match[1]}-${match[2]}`);}
    if(!page.lines.some(l=>l.text.startsWith('Characteristic at 2:')))continue;
    for(const line of page.lines){
      if(line.bold&&line.size>=11.5){current={name:line.text,blurb:'',fields:{},label:null};backgrounds.push(current);continue;}
      if(!current)continue;
      const match=line.text.match(/^(Characteristic at 2|Stamina|Trait|Expertises|Equipment):\s*(.*)$/);
      if(match&&line.bold){current.label=match[1];current.fields[current.label]=match[2];}
      else if(current.label)current.fields[current.label]=norm(current.fields[current.label]+' '+line.text);
      else current.blurb=norm(current.blurb+' '+line.text);
    }
  }
  const records=backgrounds.filter(b=>b.fields.Stamina).map(({label,...b})=>({...b,roll:rolls.get(b.name)??''}));
  if(records.length!==36||new Set(records.map(b=>b.roll)).size!==36||records.some(b=>!b.roll))throw new Error('Expected 36 backgrounds with distinct two-d6 rolls.');
  const text=pages.flatMap(p=>p.lines.map(l=>l.text)).join('\n');
  const start=text.indexOf('NPC Connection\n'),end=text.indexOf('Village Cycle',start);
  if(start<0||end<start)throw new Error('Could not locate the complete NPC Connection section.');
  const connections=text.slice(start,end).split(/[•●]/).slice(1).map(p=>{
    const value=norm(p),cut=value.indexOf(': ');
    if(cut<1||!value.slice(cut+2).trim())throw new Error('Incomplete NPC connection benefit.');
    return {name:value.slice(0,cut),description:value.slice(cut+2)};
  });
  if(connections.length!==10||new Set(connections.map(c=>c.name)).size!==10)throw new Error('Expected 10 distinct NPC connection benefits.');
  const flat=norm(text),kit=flat.match(/Every PC has (.+?) and (\d+d\d+) gc\./),speed=flat.match(/starting speed (?:on|of) (\d+)/);
  if(!kit||!speed)throw new Error('Could not read the common starting kit, gold or speed.');
  const commonEquipment=kit[1].replace(/,\s*$/,'').split(',').map(value=>{
    const phrase=norm(value).replace(/^(?:an? )?(?:empty )?/i,'');
    const count=phrase.match(/^(\d+|six)\s+(.+)$/i);
    return {name:title((count?count[2]:phrase).replace(/^rations$/i,'Ration')),quantity:count?count[1].toLowerCase()==='six'?6:Number(count[1]):1};
  });
  return {backgrounds:records,connections,common:{equipment:commonEquipment,startingGold:kit[2],speed:Number(speed[1])}};
}

export function parseBackgroundEquipment(text,ranks){
  const equipment=[],pets=[];let extraGold=0;
  const [items,books='']=text.split('spellbooks:');
  for(let part of norm(items).split(/,\s*/)){
    part=norm(part).replace(/\.$/,'');if(!part)continue;
    const gold=part.match(/^(\d+)\s*(?:extra\s+)?gold coins?$/);if(gold){extraGold+=Number(gold[1]);continue;}
    const match=part.match(/^(.*?)\s*\((.*?)\)$/),base=match?match[1]:part,paren=match?.[2]??'',low=base.toLowerCase();
    if(paren.toLowerCase()==='pet'){pets.push(petAliases[low]??title(base));continue;}
    const entry={name:itemAliases[low]??title(base),quantity:/^\d+$/.test(paren)?Number(paren):1};
    if(paren&&!/^\d+$/.test(paren))entry.note=paren;
    const previous=equipment.find(e=>e.name===entry.name&&e.note&&entry.note);
    if(previous){previous.quantity+=entry.quantity;previous.note+=', '+entry.note;}else equipment.push(entry);
  }
  const words=norm(books).toLowerCase().replace(/\.$/,'').split(/[,\s]+/).filter(Boolean);
  while(words.length){
    const spell=[3,2,1].map(n=>words.slice(0,n).join(' ')).find(name=>ranks.has(name));
    if(!spell)throw new Error(`Unresolved starting spell near "${words.slice(0,3).join(' ')}". Include the core inventory PDF.`);
    const rank=ranks.get(spell);if(!Number.isInteger(rank))throw new Error(`Ambiguous rank for starting spell: ${spell}.`);
    equipment.push({name:`${title(spell)} Book R${rank}`,quantity:1});words.splice(0,spell.split(' ').length);
  }
  return {equipment,pets,extraGold};
}

export function finalizeBackgrounds(book,cards){
  const ranks=new Map();
  for(const card of cards){if(card.spell&&card.name.endsWith(' Book')){
    const name=card.name.slice(0,-5).toLowerCase(),rank=card.spell.rank;
    ranks.set(name,ranks.has(name)&&ranks.get(name)!==rank?null:rank);
  }}
  return book.backgrounds.map(b=>{
    const f=b.fields,cut=f.Trait?.indexOf(': ');
    if(cut===undefined||cut<1||!f['Characteristic at 2']||!f.Expertises||!f.Equipment)throw new Error(`${b.name}: incomplete background fields.`);
    const expertises=f.Expertises.split(/,\s*/).filter(Boolean).map(part=>{
      const match=norm(part).match(/^(.*?)\s*\((\d+) uses?\)$/),name=match?match[1]:norm(part);
      return {name:name==='Blacksmith'?'Blacksmithing':name,uses:match?Number(match[2]):1};
    });
    const {equipment,pets,extraGold}=parseBackgroundEquipment(f.Equipment,ranks),kit=new Map(book.common.equipment.map(e=>[e.name,e.quantity]));
    for(const e of equipment)kit.set(e.name,(kit.get(e.name)??0)+e.quantity);
    const result={name:b.name,roll:b.roll,blurb:b.blurb,characteristicAt2:f['Characteristic at 2'].split(/\s+or\s+/).map(s=>s.trim()),stamina:Number(f.Stamina.match(/\d+/)?.[0]),trait:{tree:fixTree(f.Trait.slice(0,cut)),name:fixTrait(f.Trait.slice(cut+2))},expertises,equipment,pets,extraGold,
      startingKit:[...kit].map(([name,quantity])=>({name,quantity})),startingGold:book.common.startingGold};
    if(!/^[1-6]-[1-6]$/.test(result.roll)||!Number.isInteger(result.stamina)||result.stamina<1
      ||result.characteristicAt2.some(c=>!['Any','Agility','Mind','Strength'].includes(c))
      ||expertises.some(e=>!e.name||!Number.isInteger(e.uses)||e.uses<1||e.uses>2)
      ||result.startingKit.some(e=>!Number.isInteger(e.quantity)||e.quantity<1))throw new Error(`${b.name}: invalid background statistics or quantities.`);
    return result;
  });
}
