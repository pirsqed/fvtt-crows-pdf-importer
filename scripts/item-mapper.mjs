import {escapeHTML} from './card-parser.mjs';
import {iconForItem} from './item-icons.mjs';

const scope='fvtt-crows-pdf-importer';
const aliases={'Quiver of 20 Arrows':'Quiver of Arrows','Case of 20 Crossbow Bolts':'Case of Crossbow Bolts','Case of Bolts':'Case of Crossbow Bolts','Strong Poison':'Strong Poison Vial'};
const capacities={'coin purse':500,'quiver of arrows':20,'case of crossbow bolts':20};
const icons={book:'icons/sundries/books/book-worn-brown.webp',weapon:'icons/svg/sword.svg',armor:'icons/svg/shield.svg',default:'icons/svg/item-bag.svg'};
const esc=value=>escapeHTML(String(value??''));

/** Only the parser's exact b/i tags are accepted; all other markup is escaped. */
export function safeBody(html='') {
  return html.split(/(<\/?[bi]>)/g).map(part=>/^<\/?[bi]>$/.test(part)?part:esc(part
    .replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'))).join('');
}

function improvisedWeapon(card) {
  const text=(card.body_html??'').replace(/<[^>]+>/g,''),match=text.match(/make an? (ranged|melee) (\d+) attack/i);
  if(!match || !card.tiers?.t2 || !card.tiers?.t3)return null;
  return {range:`${match[1][0].toUpperCase()+match[1].slice(1).toLowerCase()} ${match[2]}`,
    attack:`2d10 + ${/agility/i.test(text)?'A':'S'}`,tier2:card.tiers.t2,tier3:card.tiers.t3};
}

function description(card,relic) {
  const badges=[],parts=["<div class='crows-item-card'>"],spell=card.spell;
  const badge=(text,kind='')=>badges.push(`<span class='badge ${kind}'>${esc(text)}</span>`);
  if(relic)badge('Dungeon Relic');
  if(spell){badge(spell.discipline??'Spell','magic');if(spell.cast)badge(spell.cast);badge(`Rank ${spell.rank??0}`);}
  if(card.weapon){badge('Weapon','weapon');badge(card.weapon.range,'range');}
  if(card.armor_ad!=null)badge(`AD ${card.armor_ad}`,'armor');
  if(card.ud)badge(`UD ${card.ud.max} (${card.ud.flags.join('; ')})`,'ud');
  if(card.magic_slot)badge(`Slot: ${card.magic_slot}`,'slot');
  if(card.slots>1)badge(`${card.slots} Slots`,'slots');
  if(card.stack>1)badge(`Stack ${card.stack}`,'stack');
  if(badges.length)parts.push(`<div class='card-badges'>${badges.join(' ')}</div>`);
  if(spell){const meta=['range','target','duration'].filter(key=>spell[key]).map(key=>`<b>${key[0].toUpperCase()+key.slice(1)}:</b> ${esc(spell[key])}`);if(meta.length)parts.push(`<div class='spell-meta'>${meta.join(' &bull; ')}</div>`);}
  if(card.weapon?.attack)parts.push(`<div class='atk-formula'><strong>Attack:</strong> ${esc(card.weapon.attack)}</div>`);
  let body=card.body_html??'';
  if(Object.keys(card.variants??{}).length){const cut=body.search(/<b>\s*(Fine|Masterwork)\s*\(/);if(cut>=0)body=body.slice(0,cut).trim();}
  if(body)parts.push(`<p class='card-prose'>${safeBody(body)}</p>`);
  const tiers=card.tiers??{},columns=['t1','t2','t3'].filter(key=>key in tiers);
  if(columns.some(key=>tiers[key])){
    const headings={t1:'&le;11 (Tier 1)',t2:'12&ndash;16 (Tier 2)',t3:'17+ (Tier 3)'};
    parts.push(`<table class='crows-tier-table ${card.weapon?'weapon':'effect'}'><thead><tr>${columns.map(key=>`<th class='tier-${key[1]}'>${headings[key]}</th>`).join('')}</tr></thead><tbody><tr>${columns.map(key=>`<td>${esc(tiers[key])}</td>`).join('')}</tr></tbody></table>`);
  }
  if(card.qualities?.length)parts.push(`<div class='traits-block'><strong>Traits:</strong> ${card.qualities.map(q=>`<span class='trait-tag'>${esc(q)}</span>`).join(' ')}</div>`);
  const variants=['fine','masterwork'].filter(key=>card.variants?.[key]);
  if(variants.length)parts.push(`<div class='variants-block'>${variants.map(key=>{const v=card.variants[key];return `<div><b>${key[0].toUpperCase()+key.slice(1)} (${esc(v.price?.toLocaleString('en-US'))} gc):</b> ${esc(v.text)}</div>`;}).join('')}</div>`);
  const footer=[];
  if(card.crafting)footer.push(`<span class='crafting-tag'><i class='fas fa-hammer'></i> ${esc(card.crafting.raw)}</span>`);
  if(card.price!=null)footer.push(`<span class='cost-tag'>${esc(card.price.toLocaleString('en-US'))} gc</span>`);
  if(footer.length)parts.push(`<div class='card-footer-meta'>${footer.join('')}</div>`);
  parts.push('</div>');return parts.join('\n');
}

/** Map one parsed card to unsaved Item source data. No Foundry APIs or writes. */
export function cardToItem(card) {
  if(!card || typeof card.name!=='string' || !card.name.trim())throw new Error('Cannot map a card without a name.');
  if(!['core','profession','poi'].includes(card.source))throw new Error(`${card.name}: choose a supported card set.`);
  let name=aliases[card.name]??card.name;
  if(name==='Lore Book'){
    const text=(card.body_html??'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ');
    const expertise=text.match(/\bThis book relates to the ([^.?!]+?) Lore expertise\b/i)?.[1]?.trim();
    if(expertise)name+=` (${expertise})`;
  }
  const spell=card.spell,weapon=card.weapon??improvisedWeapon(card),ud=card.ud,tiers=card.tiers??{};
  if(spell?.rank!=null && name.endsWith(' Book'))name+=` R${spell.rank}`;
  const capacity=capacities[name.trim().toLowerCase()]??0;
  const contentsType=capacity?(/purse/i.test(name)?'gold':/quiver/i.test(name)?'arrows':'bolts'):'';
  const consumable=Boolean(ud || spell || Object.keys(tiers).length && !card.weapon);
  const traits=[...(spell?[spell.discipline,`Rank ${spell.rank??0}`,spell.cast]:[]),...(card.qualities??[])].filter(Boolean);
  const trigger=ud?(/dt/i.test(ud.flags.join(';'))?'DT':/rest/i.test(ud.flags.join(';'))?'Rest':/useless/i.test(ud.flags.join(';'))?'Useless':'Activate'):'DT';
  const system={
    contentsType,contentsMax:capacity,contentsQuantity:['arrows','bolts'].includes(contentsType)?capacity:0,
    description:description(card,card.source==='poi'),shortDescription:card.shortDescription||card.short_description||'',
    location:'backpack1',slots:card.slots??1,quantity:1,cost:card.price??0,crafting:card.crafting?.raw??'',traits:traits.join(', '),
    maxStack:capacity?1:card.stack||1,isEquipped:true,greedBonus:0,isShield:/\bshield\b/i.test(name),isSpellbook:Boolean(spell),
    isWeapon:Boolean(weapon),weapon:{range:weapon?.range??'',attackFormula:weapon?.attack||'2d10 + S',tier2Damage:weapon?.tier2||'',tier3Damage:weapon?.tier3||''},
    isArmor:card.armor_ad!=null,armor:{defense:card.armor_ad??0,maxDefense:card.armor_ad??0},isConsumable:consumable,
    consumable:{usageDice:ud?`UD ${ud.max} (${ud.flags.join('; ')})`:'',currentUD:ud?.max??0,maxUD:ud?.max??0,udTrigger:trigger,
      actionText:card.body_html&&consumable?`<p>${safeBody(card.body_html)}</p>`:'',tier1Effect:card.weapon?'':tiers.t1??'',tier2Effect:card.weapon?'':tiers.t2??'',tier3Effect:card.weapon?'':tiers.t3??''}
  };
  // Separate provenance from the system importer's importSource fingerprint.
  // Page/index locate the printed card; name+type identify the proposed Item.
  const fallback=icons[spell||card.name==='Lore Book'?'book':weapon?'weapon':card.armor_ad!=null?'armor':'default'];
  return {name,type:'equipment',img:iconForItem(name,card.name,fallback),system,
    flags:{[scope]:{schemaVersion:1,source:{set:card.source,page:card.page,cardIndex:card.card_index,name:card.name},
      crafting:structuredClone(card.crafting??null),variants:structuredClone(card.variants??{}),spell:structuredClone(spell??null),magicSlot:card.magic_slot??null}}};
}

/** Strict validation instantiates temporary documents only; never saves them. */
export function validateItemPreview(documents,{ItemClass=globalThis.Item,models=globalThis.CONFIG?.Item?.dataModels}={}) {
  if(!ItemClass || !models?.equipment)return {status:'unavailable',message:'Item validation requires an active Crows world.'};
  const errors=[];
  documents.forEach((source,index)=>{
    try{const doc=new ItemClass(structuredClone(source),{strict:true});if(doc.validate({strict:true})===false)throw new Error('Document validation failed.');}
    catch(error){errors.push({index,name:source.name,message:error.message});}
  });
  return {status:errors.length?'failed':'passed',checked:documents.length,errors};
}
