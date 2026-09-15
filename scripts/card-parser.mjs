/** Crows card fields. Layout detection and PDF.js access live in separate modules. */
export const norm = text => text.replace(/[’‘]/g, "'").replace(/–/g, '-').replace(/\u200b/g, ' ').replace(/\s+/g, ' ').trim();
const footerSize = 7.6;
const qualities = new Set(['Bashing','Bow','Chopping','Slashing','Stabbing','Unarmed','Light','Pummeling','Dismember','Disengage','Brutal','Cumbersome','Parry','Reload','Exploding','Vicious','Absorbing','Dancing','Defending','Flaming','Frosty','Gashing','Hewing','Hungry','Impact','Infinity','Lightning','Poisoning','Raging','Returning','Slaying','Sworn Foe','Teleporting','Weakening','Steel','Yew']);
const fixWraps = text => text.replaceAll('weaken ed','weakened').replaceAll('movemen t','movement').replaceAll('monster par ','monster part ');
export const escapeHTML = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function splitQualities(text) {
  const result=[];
  for(const token of text.split(',').map(norm).filter(Boolean)) {
    let words=[];
    for(const word of token.split(/\s+/)) {
      if(qualities.has(word) && words.length && !['Parry','Sworn'].includes(words.at(-1))) {result.push(words.join(' '));words=[];}
      words.push(word);
    }
    if(words.length)result.push(words.join(' '));
  }
  return result;
}

function lineHTML(line) {
  // PDF text is untrusted. Only formatting tags generated here are allowed.
  let previous=null;
  return line.spans.map(span=>{
    const separator=previous && span.x-previous.x1>0.8 && !previous.text.endsWith(' ') && !span.text.startsWith(' ')?' ':'';
    previous=span;
    let text=escapeHTML(span.text);
    if(span.italic)text=`<i>${text}</i>`;
    if(span.bold)text=`<b>${text}</b>`;
    return separator+text;
  }).join('');
}

export function parseCard(lines,{source='unknown',page=1,index=0,verticals=[]}={}) {
  if(!lines.length)throw new Error('Cannot parse an empty card.');
  const spans=lines.flatMap(line=>line.spans);
  const big=spans.map(s=>s.size).filter(size=>size>footerSize);
  const bodySize=big.length?Math.max(...big):11;
  const card={source,page,card_index:index,name:null,rank:null,stack:null,slots:1,price:null,variants:{},crafting:null,weapon:null,qualities:[],armor_ad:null,ud:null,magic_slot:null,spell:null,tiers:null,body_html:'',raw_lines:lines.map(line=>norm(line.text))};
  const header=lines[0],headerText=norm(header.text);
  let name=norm(header.text.split('Stack')[0]),match;
  const consumed=new Set([0]);
  if((match=name.match(/^(.*?)\s*Book\s*R\s*(\d)$/))) {name=`${match[1].trim()} Book`;card.rank=Number(match[2]);}
  if((match=headerText.match(/\(Occupies\s+(\d+)\s+Slots?\)/i))) {card.slots=Number(match[1]);name=norm(name.replace(/\(Occupies\s+\d+\s+Slots?\)/ig,''));}
  card.name=name=name.replace(/\s*R\d$/,'').trim();
  if((match=headerText.match(/Stack\s*(\d+)/)))card.stack=Number(match[1]);
  if(card.stack===null)for(const i of [1,2]) {
    if(lines[i] && (match=norm(lines[i].text).match(/Stack\s*(\d+)/))) {
      card.stack=Number(match[1]);if(/^Stack\s*\d+$/.test(norm(lines[i].text)))consumed.add(i);break;
    }
  }

  const footer=lines.map((_,i)=>i).filter(i=>lines[i].size<=footerSize && !consumed.has(i));
  let priceLine=null,priceTail=null;
  for(const i of [...footer].reverse()) {
    const text=norm(lines[i].text);match=text.match(/([\d,]+)\s*gc\s*$/);
    if(match && !/gc\s*\|/.test(text)) {card.price=Number(match[1].replaceAll(',',''));priceLine=i;priceTail=norm(text.slice(0,match.index));break;}
  }
  const isCraft=line=>{const text=norm(line.text);return /(Alchemy|Blacksmithing|Enchanting)\s*[\d/]/.test(text)||text.includes('|')||/^[\d/ ,]+$/.test(text)||/gc\s*\|?\s*$/.test(text);};
  const craftLines=footer.filter(i=>i!==priceLine && isCraft(lines[i]));
  if(priceTail && (priceTail.includes('|') || /^(Alchemy|Blacksmithing|Enchanting)/.test(priceTail)))craftLines.push(priceLine);
  if(craftLines.length) {
    const raw=fixWraps(norm(craftLines.sort((a,b)=>a-b).map(i=>i===priceLine?priceTail:norm(lines[i].text)).join(' ')));
    card.crafting={raw};
    if((match=raw.match(/^(Alchemy|Blacksmithing|Enchanting)\s*([\d/]+)\s*\|\s*(.*?)\s*\|\s*([\d/ ,]+)\s*$/)))Object.assign(card.crafting,{expertise:match[1],institution_tier:match[2],materials:norm(match[3]),goal:norm(match[4])});
    craftLines.forEach(i=>consumed.add(i));
  }
  if(priceLine!==null)consumed.add(priceLine);

  const tableIndex=lines.findIndex((line,i)=>!consumed.has(i) && line.text.includes('12-16') && line.text.includes('17+') && line.spans.some(s=>s.bold));
  if(tableIndex!==-1) {
    const header=lines[tableIndex],columns=[];let pending=null;
    for(const span of header.spans) {
      const text=span.text.trim();
      if(['≤','<='].includes(text)){pending=span;continue;}
      if(pending && text.startsWith('11')) {columns.push(['t1',(pending.x+span.x1)/2]);pending=null;continue;}
      if(text.startsWith('≤11') || text.startsWith('<=11'))columns.push(['t1',(span.x+span.x1)/2]);
      else if(text.startsWith('12-16'))columns.push(['t2',(span.x+span.x1)/2]);
      else if(text.startsWith('17+'))columns.push(['t3',(span.x+span.x1)/2]);
    }
    if(!columns.length)throw new Error(`${card.name}: tier headings could not be located.`);
    const cells=Object.fromEntries(columns.map(([key])=>[key,[]]));consumed.add(tableIndex);
    const borders=verticals.filter(v=>v[1]-2<=header.yc && header.yc<=v[2]+2 && header.x0-6<=v[0] && v[0]<=header.x1+6);
    const bottom=borders.length?Math.max(...borders.map(v=>v[2])):null;
    let lastY=header.yc;
    for(let i=tableIndex+1;i<lines.length;i++) {
      const line=lines[i];if(consumed.has(i))break;
      if(bottom!==null) {if(line.yc>bottom+1)break;}
      else if(line.yc-lastY>bodySize*1.9 || line.spans.some(s=>s.italic||s.bold) && line.size>=bodySize)break;
      for(const span of line.spans) {
        if(span.estimatedWords && span.words?.length>1) {
          const cuts=columns.slice(1).map((column,i)=>(columns[i][1]+column[1])/2);
          if(cuts.some(x=>span.x<x && span.x1>x))throw new Error(`${card.name}: cannot reliably split tier text across columns with this font.`);
        }
        for(const [x0,x1,text] of span.words?.length?span.words:[[span.x,span.x1,span.text.trim()]]) {
        const center=(x0+x1)/2;
        const nearest=columns.reduce((a,b)=>Math.abs(b[1]-center)<Math.abs(a[1]-center)?b:a);
        cells[nearest[0]].push(text.trim());
        }
      }
      consumed.add(i);lastY=line.yc;
    }
    card.tiers=Object.fromEntries(Object.entries(cells).map(([key,value])=>[key,fixWraps(norm(value.join(' ')))]));
  }

  for(let i=0;i<lines.length;i++) {
    if(consumed.has(i))continue;
    const line=lines[i],text=norm(line.text),attack=line.spans.some(s=>s.bold && s.text.trim()==='Attack');
    match=text.match(/^(Melee \d+(?:\/Ranged \d+)?|Ranged \d+)(?:\s+Attack\s+(.+))?$/i);
    if(match && (match[2]===undefined || attack)) {card.weapon??={};card.weapon.range=match[1];if(match[2])card.weapon.attack=norm(match[2]);consumed.add(i);}
    else if(text.startsWith('Attack ') && attack) {card.weapon??={};card.weapon.attack=norm(text.slice(7));consumed.add(i);}
    else if((match=text.match(/^Armor\s+AD:?\s*(\d+)$/))) {card.armor_ad=Number(match[1]);consumed.add(i);}
  }
  if(card.weapon && card.tiers) {card.weapon.tier2=card.tiers.t2??null;card.weapon.tier3=card.tiers.t3??null;}
  if(card.weapon && tableIndex!==-1) {
    let i=tableIndex+1;while(i<lines.length && consumed.has(i))i++;
    const q=[];
    while(i<lines.length && !consumed.has(i) && lines[i].spans.every(s=>s.italic) && lines[i].size>=bodySize-1) {q.push(norm(lines[i].text));consumed.add(i++);}
    if(q.length)card.qualities=splitQualities(q.join(' '));
  }
  if(card.rank!==null || name.endsWith(' Book')) {
    const spell={rank:card.rank};
    for(let i=0;i<lines.length;i++) {
      if(consumed.has(i) && i!==1)continue;
      const line=lines[i],text=norm(line.text);
      if((match=text.match(/(Alteration|Benefaction|Conjuration|Elemental|Illusion|Necromancy)\s+(Attk\.|Man\.|Act\.|React\.|OOC\.?)/))) {
        spell.discipline=match[1];spell.cast=({'Attk.':'Attack','Man.':'Maneuver','Act.':'Action','React.':'Reaction'})[match[2]]??match[2];consumed.add(i);continue;
      }
      const bold=line.spans.filter(s=>s.bold).map(s=>s.text.trim()),hasTarget=bold.some(s=>s.startsWith('Target'));
      match=text.match(/^(Self|Melee \d+|Ranged \d+|Line .+?|Aura \d+|Cube \d+)\s*(?:Target\s*(.*))?$/);
      if(match && (match[2]===undefined || hasTarget)) {spell.range=norm(match[1]);if(match[2])spell.target=norm(match[2]);consumed.add(i);continue;}
      if((match=text.match(/^Target\s+(.*)$/)) && hasTarget) {spell.target=norm(match[1]);consumed.add(i);continue;}
      if((match=text.match(/^Dur\.?\s*(.*)$/)) && bold.some(s=>s.startsWith('Dur'))) {spell.duration=norm(match[1]);consumed.add(i);}
    }
    if(card.weapon && !spell.range && card.weapon.range)spell.range=card.weapon.range;
    if(card.weapon && !card.weapon.attack)card.weapon=null;
    if(spell.rank!==null || spell.discipline)card.spell=spell;
  }

  const body=[];
  for(let i=0;i<lines.length;i++) {
    if(consumed.has(i))continue;
    const line=lines[i],text=norm(line.text);
    if((match=text.match(/^UD:?\s*(\d+)\s*\(([^)]*)\)/))) {card.ud={max:Number(match[1]),flags:match[2].split(';').map(norm)};continue;}
    if((match=text.match(/^Slot:?\s*([A-Za-z]+)\s*$/))) {card.magic_slot=match[1];continue;}
    body.push(line);
  }
  card.body_html=body.map(lineHTML).join(' ').replace(/\s+/g,' ').trim();
  const plain=norm(body.map(line=>line.text).join(' '));
  let fine=0;
  for(const match of plain.matchAll(/(Fine|Masterwork)\s*\(([\d,]+)\s*gc\):\s*(.*?)(?=(?:Fine|Masterwork)\s*\([\d,]+\s*gc\):|$)/g)) {
    let kind=match[1].toLowerCase();if(kind==='fine' && ++fine===2)kind='masterwork';
    card.variants[kind]={price:Number(match[2].replaceAll(',','')),text:norm(match[3])};
  }
  card.stack??=1;
  return card;
}
