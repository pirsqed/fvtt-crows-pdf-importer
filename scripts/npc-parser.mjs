import {escapeHTML} from './card-parser.mjs';
import {animalIcons} from './npc-icons.mjs';
const norm=text=>text.replace(/[’‘]/g,"'").replace(/–/g,'-').replace(/[ \t]+/g,' ').trim().replace(/\s+([,.;:!?])/g,'$1');
const labels=['Size','Power','Type','Stamina','Speed','Slots','Reactions','Agility','Mind','Strength','AD','Expertises','Equipment'];
const statsPattern=new RegExp(`(${labels.join('|')}):\\s*`);
// Values are inserted only into HTML text nodes, never into attributes.
const esc=text=>escapeHTML(text).replaceAll('&#39;',"'").replaceAll('&quot;','"');

export function parseNPCBlock(rows,page){
  if(!rows.length)return null;
  const stats={},attacks=[],features=[];let index=1,lastLabel;
  while(index<rows.length&&!/^Attack\s+Range/.test(rows[index].text)){
    const row=rows[index++];
    // A few blocks put the shared use count in the label itself.
    const statText=row.text.replace(/Expertises\s*(\([^)]*\)):/,'Expertises: $1');
    const parts=statText.split(statsPattern);
    if(parts.length>1){for(let n=1;n<parts.length-1;n+=2){stats[parts[n]]=norm(parts[n+1]);lastLabel=parts[n];}}
    else if(['Expertises','Equipment'].includes(lastLabel)&&!row.first_bold)stats[lastLabel]=norm(stats[lastLabel]+' '+row.text);
  }
  if(stats.Power===undefined)return null;
  for(const label of ['Size','Power','Type','Stamina','Speed','Agility','Mind','Strength'])if(!stats[label])throw new Error(`${rows[0].text}: missing ${label} stat.`);
  if(index===rows.length)throw new Error(`${rows[0].text}: attack table was not found.`);
  index++;
  while(index<rows.length){
    const match=rows[index].text.match(/^(.+?\(\+\d+\)\**)\s+(.+?)\s+(\d+ (?:P )?dam\**)\s+(\d+ (?:P )?dam\**)\s*$/);
    if(!match)break;
    attacks.push({name:norm(match[1]),range:norm(match[2]),t2:match[3],t3:match[4]});index++;
  }
  if(!attacks.length)throw new Error(`${rows[0].text}: no attacks could be parsed.`);
  let feature;
  while(index<rows.length){
    const row=rows[index++];
    if(row.all_bold&&!/^\d|^(≤11|12-16|17\+)/.test(row.text)){feature={title:row.text,lines:[]};features.push(feature);}
    else if(feature)feature.lines.push(row.text);
    else throw new Error(`${rows[0].text}: unrecognized text after the attack table: ${row.text}`);
  }
  for(const f of features){
    const text=f.lines.join(' '),tiers=text.match(/(?:^|\s)1 (.+?) 2 (.+?) 3 (.+)$/);
    if(tiers&&/RR\.?\s*(1 |$)/.test(text+' 1 '))f.html=`<p>${esc(text.slice(0,tiers.index).trim())}</p><p><b>&le;11:</b> ${esc(tiers[1])} &bull; <b>12-16:</b> ${esc(tiers[2])} &bull; <b>17+:</b> ${esc(tiers[3])}</p>`;
    else{
      const cells=text.match(/≤11 12-16 17\+ (.+?) (\d+ dam) (\d+ dam)$/);
      f.html=cells?`<p>${esc(text.slice(0,cells.index))}<b>&le;11:</b> ${esc(cells[1])} &bull; <b>12-16:</b> ${esc(cells[2])} &bull; <b>17+:</b> ${esc(cells[3])}</p>`:`<p>${esc(text)}</p>`;
    }
  }
  return {name:rows[0].text.replace(/^Undead Creature ([A-H])$/,'Undead $1'),stats,attacks,features,page};
}

export function npcs({lines,paths},page){
  const boxes=paths.filter(path=>path.fill&&path.rect&&path.rect[2]-path.rect[0]>60&&path.rect[3]-path.rect[1]>40).map(path=>path.rect);
  boxes.sort((a,b)=>Number(a[0]>200)-Number(b[0]>200)||a[1]-b[1]);
  const records=[];
  for(const box of boxes){
    const spans=lines.flatMap(line=>line.spans).filter(span=>{
      const [x0,y0,x1,y1]=span.bbox,x=(x0+x1)/2,y=(y0+y1)/2;
      return span.text.trim()&&x>=box[0]&&x<=box[2]&&y>=box[1]&&y<=box[3];
    }).sort((a,b)=>a.bbox[1]-b.bbox[1]||a.bbox[0]-b.bbox[0]);
    const rows=[];
    for(const span of spans){let row=rows.at(-1);if(!row||Math.abs(span.bbox[1]-row.y)>2.5){row={y:span.bbox[1],spans:[]};rows.push(row);}row.spans.push(span);}
    for(const row of rows){row.spans.sort((a,b)=>a.bbox[0]-b.bbox[0]);row.text=norm(row.spans.map(span=>span.text).join(' '));row.all_bold=row.spans.every(span=>span.bold);row.first_bold=row.spans[0].bold;}
    const block=parseNPCBlock(rows,page);if(block)records.push(block);
  }
  return records;
}

export function npcToActor(block){
  const stats=block.stats,num=(value,fallback=0)=>Number(String(value??'').match(/-?\d+/)?.[0]??fallback);
  const creatureType=stats.Type??'Monster',size=stats.Size??'Medium';
  const img=creatureType==='Animal'?(animalIcons[block.name]??'icons/svg/mystery-man.svg'):creatureType==='Unique'?'icons/creatures/magical/humanoid-silhouette-glowing-pink.webp':'icons/svg/mystery-man.svg';
  const tokenSize=({'Huge':2,'Holy Shit':3,'Holy Shit!':3})[size]??1;
  const meta=['Reactions','AD','Expertises','Equipment'].filter(key=>stats[key]).map(key=>`<li><b>${key}:</b> ${esc(stats[key])}</li>`);
  const items=block.attacks.map(attack=>{
    const stars=Math.max(...[attack.name,attack.t2,attack.t3].map(value=>(value.match(/\*/g)??[]).length));
    // Several features may share an attack's marker. Keep every matching note.
    const linked=stars?block.features.filter(f=>(f.title.match(/^\*+/)?.[0].length??0)===stars):[];
    return {name:attack.name.replace(/\s*\(\+\d+\)\**/g,'').trim(),type:'attack',img:'icons/svg/sword.svg',system:{
      bonus:'+'+(attack.name.match(/\(\+(\d+)\)/)?.[1]??'0'),range:attack.range,tier2Damage:attack.t2.replaceAll('*',''),tier3Damage:attack.t3.replaceAll('*',''),
      notes:linked.map(f=>`<p><b>${esc(f.title.replace(/^\*+/,''))}.</b> ${f.html.replace(/^<p>|<\/p>$/g,'')}</p>`).join('')}};
  });
  for(const f of block.features)items.push({name:f.title.replace(/^\*+/,''),type:'trait',img:'icons/svg/book.svg',system:{tree:'General',tier:'Monster Feature',cost:0,prerequisites:'',description:f.html}});
  return {name:block.name,type:'monster',img,system:{size,power:Number(block.name.match(/\(Power (\d+)\)/)?.[1]??num(stats.Power,1)),type:creatureType,
    stamina:{value:num(stats.Stamina,10),max:num(stats.Stamina,10)},speed:stats.Speed??'5',characteristics:{agility:num(stats.Agility),mind:num(stats.Mind),strength:num(stats.Strength)},
    slots:num(stats.Slots),coins:0,tempAD:num(stats.AD),description:(meta.length?`<ul class='monster-meta'>${meta.join('')}</ul>`:'')+(block.features.length?'<p><em>Features are listed as traits on this sheet.</em></p>':'')},items,
    prototypeToken:{name:block.name,displayName:20,displayBars:20,disposition:['Animal','Human'].includes(creatureType)?0:-1,width:tokenSize,height:tokenSize,texture:{src:img},bar1:{attribute:'stamina'},actorLink:false},
    flags:{'fvtt-crows-pdf-importer':{schemaVersion:1,source:{set:'ref',page:block.page,name:block.name},stats:structuredClone(stats)}}};
}

export function validateActorPreview(actors){
  if(!globalThis.Actor||!globalThis.CONFIG?.Actor?.dataModels?.monster)return {status:'unavailable',message:'Actor validation requires an active Crows world.'};
  const errors=[];
  actors.forEach((source,index)=>{try{
    const actor=new Actor(structuredClone(source),{strict:true});if(actor.validate({strict:true})===false)throw new Error('Actor validation failed.');
    for(const item of actor.items)if(item.validate({strict:true})===false)throw new Error(`${item.name}: embedded Item validation failed.`);
  }catch(error){errors.push({index,name:source.name,message:error.message});}});
  return {status:errors.length?'failed':'passed',checked:actors.length,errors};
}
