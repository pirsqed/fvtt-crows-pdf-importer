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
  const header=lines[0],stackIndex=lines.slice(0,4).findIndex(line=>/Stack\s*\d+/.test(line.text));
  const headerEnd=Math.max(0,stackIndex),headerIndices=Array.from({length:headerEnd+1},(_,i)=>i).filter(i=>!i||!/^(?:UD\s*:?\s*\d|Slot\s*:)/.test(norm(lines[i].text)));
  let headerText=norm(headerIndices.map(i=>lines[i].text).join(' '));
  // Occupancy can wrap after the Stack line, even on the wide weapon cards.
  if(/\(Occupies(?:\s+\d+)?$/i.test(headerText)){
    let tail=headerEnd;
    while(tail+1<lines.length&&tail-headerEnd<2&&/^(?:\d+\s*)?(?:Slots?\))?$/i.test(norm(lines[tail+1].text))){
      headerIndices.push(++tail);headerText=norm(`${headerText} ${lines[tail].text}`);
      if(headerText.endsWith(')'))break;
    }
  }
  let name=norm(headerText.split('Stack')[0]),match;
  const consumed=new Set(headerIndices);
  if(/Stack\s*\d+\s*\(wearable\)/i.test(headerText))card.wearable=true;
  if((match=name.match(/^(.*?)\s*Book\s*R\s*(\d)$/i))) {name=`${match[1].trim()} Book`;card.rank=Number(match[2]);}
  name=name.replace(/\bbook$/i,'Book');
  if(card.rank===null&&name.endsWith(' Book')){
    const rankLine=lines.slice(1,3).find(line=>/^R\s*\d+(?:\s|$)/.test(norm(line.text)));
    if(rankLine)card.rank=Number(norm(rankLine.text).match(/^R\s*(\d+)/)[1]);
  }
  if((match=headerText.match(/\(Occupies\s+(\d+)\s+Slots?\)/i))) {card.slots=Number(match[1]);name=norm(name.replace(/\(Occupies\s+\d+\s+Slots?\)/ig,''));}
  card.name=name=name.replace(/\s*R\d$/,'').trim();
  if((match=headerText.match(/Stack\s*(\d+)/)))card.stack=Number(match[1]);
  if(card.stack===null)for(const i of [1,2]) {
    if(lines[i] && (match=norm(lines[i].text).match(/Stack\s*(\d+)/))) {
      card.stack=Number(match[1]);if(/^Stack\s*\d+$/.test(norm(lines[i].text)))consumed.add(i);break;
    }
  }

  const footerLimit=header.size<=footerSize?header.size-0.5:footerSize;
  const footer=lines.map((_,i)=>i).filter(i=>!consumed.has(i)&&(lines[i].size<=footerLimit||/^[\d,]+\s*gc$/.test(norm(lines[i].text))));
  let priceLine=null,priceTail=null;
  for(const i of [...footer].reverse()) {
    const text=norm(lines[i].text);match=text.match(/(?:Worth:\s*)?([\d,]+)\s*gc\s*$/i);
    if(match && !/gc\s*\|/.test(text)) {card.price=Number(match[1].replaceAll(',',''));priceLine=i;priceTail=norm(text.slice(0,match.index).replace(/\|\s*$/,''));break;}
  }
  const isUnique=text=>/^Unique Item(?:\s*\|\s*(?:Worth:\s*[\d,]+\s*gc|XP:\s*[\d,]+))?$/i.test(text);
  for(const i of footer) {
    const text=i===priceLine?priceTail:norm(lines[i].text);
    if(text && isUnique(text)) {card.unique=true;consumed.add(i);if(i===priceLine)priceTail='';}
  }
  const hasCraftHeader=footer.some(i=>{const text=i===priceLine?priceTail:norm(lines[i].text);return /(Alchemy|Blacksmithing|Enchanting)\s*[\d/]/.test(text);});
  if(!hasCraftHeader)for(const i of footer)if(i!==priceLine && /^\d+$/.test(norm(lines[i].text)))consumed.add(i);
  const isCraft=line=>{const text=norm(line.text);return !isUnique(text)&&(/(Alchemy|Blacksmithing|Enchanting)\s*[\d/]/.test(text)||text.includes('|')||hasCraftHeader&&/^[\d/ ,]+$/.test(text)||/gc\s*\|?\s*$/.test(text));};
  const craftLines=footer.filter(i=>i!==priceLine && !consumed.has(i) && isCraft(lines[i]));
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
    if(q.length){
      const text=q.join(' '),enchantment=text.match(/\bEnchantment:\s*(.+)$/i);
      if(enchantment)card.enchantment=norm(enchantment[1]);
      card.qualities=splitQualities(enchantment?text.slice(0,enchantment.index):text);
    }
  }
  if(card.rank!==null || name.endsWith(' Book')) {
    const spell={rank:card.rank};
    for(let i=0;i<lines.length;i++) {
      if(consumed.has(i) && i>Math.max(1,headerEnd))continue;
      const line=lines[i],text=norm(line.text);
      const wrappedCast=/(Alteration|Benefaction|Conjuration|Elemental|Illusion|Necromancy)$/.test(text)&&/^(Attk\.|Man\.|Act\.|React\.|OOC\.?)$/.test(norm(lines[i+1]?.text??''));
      if((match=(wrappedCast?`${text} ${norm(lines[i+1].text)}`:text).match(/(Alteration|Benefaction|Conjuration|Elemental|Illusion|Necromancy)\s+(Attk\.|Man\.|Act\.|React\.|OOC\.?)/))) {
        if(wrappedCast)consumed.add(i+1);
        spell.discipline=match[1];spell.cast=({'Attk.':'Attack','Man.':'Maneuver','Act.':'Action','React.':'Reaction'})[match[2]]??match[2];consumed.add(i);continue;
      }
      const bold=line.spans.filter(s=>s.bold).map(s=>s.text.trim()),hasTarget=bold.some(s=>s.startsWith('Target'));
      {
        // Cards may combine range, target and duration on one line.
        // Split only actual metadata lines with bold labels, retaining prose.
        const hasDuration=bold.some(s=>s.startsWith('Dur'));
        const duration=hasDuration?text.match(/\bDur\.?\s+(.+)$/):null;
        const withoutDuration=duration?text.slice(0,duration.index).trim():text;
        const target=hasTarget?withoutDuration.match(/\bTarget\s+(.+)$/):null;
        let range=target?withoutDuration.slice(0,target.index).trim():withoutDuration;
        const wrappedRange=/\bwithin$/.test(range)&&/^\d+$/.test(norm(lines[i+1]?.text??''));
        if(wrappedRange)range+=` ${norm(lines[i+1].text)}`;
        const isRange=/^(?:Self(?: and Ranged \d+)?|Melee \d+|Range[d]? \d+|Line .+|Aura (?:\d+|varies)|(?:\d+ Cube|Cube (?:\d+|of variable size))(?: within \d+)?|Variable range)$/i.test(range);
        if(isRange||!range&&(duration||target)){
          if(wrappedRange)consumed.add(i+1);
          if(range)spell.range=range;
          if(target)spell.target=norm(target[1]);
          if(duration)spell.duration=norm(duration[1]);
          consumed.add(i);continue;
        }
        if(/^R\s*\d+$/.test(text)){consumed.add(i);continue;}
      }
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
    // Armor enchantments are standalone italic metadata rather than weapon qualities.
    if(line.spans.every(s=>s.italic)&&(match=text.match(/^Enchantment:\s*(.*)$/i))){
      let enchantment=match[1];
      if(!enchantment&&lines[i+1]?.spans.every(s=>s.italic))enchantment=norm(lines[++i].text);
      if(enchantment){card.enchantment=enchantment;continue;}
    }
    // A narrow card can wrap the flags: "UD 1 (Useless;" / "Activate)".
    if(/^UD:?\s*\d+\s*\([^)]*$/.test(text)&&i+1<lines.length&&!consumed.has(i+1)&&/^[^()]*\)$/.test(norm(lines[i+1].text))){
      match=`${text} ${norm(lines[++i].text)}`.match(/^UD:?\s*(\d+)\s*\(([^)]*)\)/);
      card.ud={max:Number(match[1]),flags:match[2].split(';').map(norm).filter(Boolean)};continue;
    }
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
  // A book holding several spells (Zaziel's Book of Elation) becomes one
  // spellbook whose pool totals every spell's UD; the card text says how to
  // share it. Rank stays unknown, so the casting dialog asks for it.
  if(!card.spell&&!card.ud&&(match=plain.match(/^This book contains the (.+?) spellbooks\. Each spell has (\d+) UD\.?/i))){
    const spells=match[1].split(/\s*,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean).length;
    card.spell={rank:null,discipline:null,contains:spells};
    card.ud={max:spells*Number(match[2]),flags:['Rest','Activate']};
  }
  card.stack??=1;
  return card;
}
