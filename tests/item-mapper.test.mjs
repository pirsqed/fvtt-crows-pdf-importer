import test from 'node:test';
import assert from 'node:assert/strict';
import {cardToItem,safeBody,validateItemPreview} from '../scripts/item-mapper.mjs';
const card=extra=>({source:'core',page:1,card_index:0,name:'Practice blade',stack:2,slots:1,price:10,body_html:'A <b>sturdy</b> blade.',...extra});

test('unknown spell rank remains unknown through mapped metadata while rank zero remains valid',()=>{
  const unknown=cardToItem(card({name:'Unranked Book',spell:{rank:null,discipline:'Illusion'}}));
  assert.equal(unknown.system.isSpellbook,true);
  assert.equal(unknown.flags['fvtt-crows-pdf-importer'].spell.rank,null);
  assert.doesNotMatch(unknown.system.traits,/Rank 0/);
  assert.match(unknown.system.description,/Rank unknown/);
  const zero=cardToItem(card({name:'Cantrip Book',spell:{rank:0,discipline:'Illusion'}}));
  assert.match(zero.system.traits,/Rank 0/);assert.equal(zero.name,'Cantrip Book R0');
});

test('enchantment suffixes distinguish loot while preserving the printed name, icon and metadata',()=>{
  for(const extra of [{name:'Greatsword',weapon:{range:'Melee 1'},qualities:['Slashing'],enchantment:'Flaming'},
    {name:'EE Greataxe',weapon:{range:'Melee 1'},enchantment:'Slaying (Human)'},
    {name:'DH Light Armor',armor_ad:14,enchantment:'Silent'}]){
    const input=card({...extra,source:'poi'}),before=structuredClone(input),item=cardToItem(input);
    const ordinary=cardToItem({...input,enchantment:undefined});
    assert.equal(item.name,`${extra.name} (${extra.enchantment})`);assert.equal(ordinary.name,extra.name);
    assert.equal(item.img,ordinary.img);assert.equal(item.flags['fvtt-crows-pdf-importer'].source.name,extra.name);
    assert.equal(item.flags['fvtt-crows-pdf-importer'].enchantment,extra.enchantment);
    assert.ok(item.system.traits.includes(`Enchantment: ${extra.enchantment}`));
    assert.ok(item.system.description.includes(extra.enchantment));assert.deepEqual(input,before);
  }
  const unsafe=cardToItem(card({enchantment:'<img src=x onerror=bad()>'}));
  assert.ok(!unsafe.system.description.includes('<img'));assert.match(unsafe.system.description,/&lt;img/);
});

test('v3 Lore Book subjects stay distinct while generic expertise choices stay generic',()=>{
  for(const name of ['Lore Book','MW Lore Book'])assert.equal(cardToItem(card({name,body_html:'This book relates to Nature Lore.'})).name,`${name} (Nature)`);
  assert.equal(cardToItem(card({name:'Lore Book',body_html:'This book relates to a lore expertise or Alchemy.'})).name,'Lore Book');
});
test('wearable metadata and a visible badge survive without inventing a body slot',()=>{
  const item=cardToItem(card({name:'Example Ring',wearable:true}));
  assert.equal(item.flags['fvtt-crows-pdf-importer'].wearable,true);
  assert.equal(item.flags['fvtt-crows-pdf-importer'].magicSlot,null);
  assert.match(item.system.description,/Wearable/);
});
test('a Fine Coin Purse uses its printed coin capacity',()=>{
  const item=cardToItem(card({name:'Fine Coin Purse',body_html:'Holds up to 750 coins.'}));
  assert.equal(item.system.contentsType,'gold');assert.equal(item.system.contentsMax,750);
});

test('weapon mapping preserves roll fields, crafting tier and variants without mutating the card',()=>{
  const input=card({weapon:{range:'Melee 1',attack:'2d10 + A',tier2:'3 + A',tier3:'6 + A'},qualities:['Light'],
    crafting:{raw:'Blacksmithing 1 | 1 iron bar | 10',institution_tier:'1'},variants:{fine:{price:30,text:'Improved.'}}});
  const before=structuredClone(input),item=cardToItem(input);
  assert.equal(item.type,'equipment');assert.equal(item.system.isWeapon,true);
  assert.deepEqual(item.system.weapon,{range:'Melee 1',attackFormula:'2d10 + A',tier2Damage:'3 + A',tier3Damage:'6 + A'});
  assert.equal(item.system.crafting,input.crafting.raw);assert.equal(item.system.maxStack,2);
  const metadata=item.flags['fvtt-crows-pdf-importer'];
  assert.equal(metadata.crafting.institution_tier,'1');assert.deepEqual(metadata.source,{set:'core',page:1,cardIndex:0,name:'Practice blade'});
  metadata.variants.fine.price=99;assert.deepEqual(input,before);
  assert.equal(item.flags['fvtt-crows-system'],undefined);
});

test('books retain rank identity, spell metadata and effect tiers',()=>{
  const item=cardToItem(card({name:'Example Book',spell:{rank:2,discipline:'Illusion',cast:'Action',range:'Self'},tiers:{t1:'Miss',t2:'Effect',t3:'More effect'}}));
  assert.equal(item.name,'Example Book R2');assert.equal(item.system.isSpellbook,true);assert.equal(item.system.isConsumable,true);
  assert.equal(item.system.consumable.tier3Effect,'More effect');assert.equal(item.system.traits,'Illusion, Rank 2, Action');
  assert.match(item.system.description,/<b>Range:<\/b> Self/);
});

test('Lore Books use the printed expertise to distinguish variants and keep unspecified books generic',()=>{
  for(const expertise of ['Nature','Monster','Historical','Magic','Ancient History']){
    const input=card({name:'Lore Book',body_html:`This book relates to the <b>${expertise}</b>\nLore expertise. Study this book.`});
    const before=structuredClone(input),item=cardToItem(input);
    assert.equal(item.name,`Lore Book (${expertise})`);
    assert.equal(item.img,'icons/sundries/books/book-embossed-bound-brown.webp');
    assert.equal(item.flags['fvtt-crows-pdf-importer'].source.name,'Lore Book');
    assert.deepEqual(input,before);
    assert.match(item.system.description,/Study this book/);
  }
  assert.equal(cardToItem(card({name:'Lore Book',body_html:'This book relates to an expertise.'})).name,'Lore Book');
  assert.equal(cardToItem(card({name:'Lore Book',body_html:''})).name,'Lore Book');
  assert.equal(cardToItem(card({name:'Other Book',body_html:'This book relates to the Nature Lore expertise.'})).name,'Other Book');
});

test('armor, supplies, usage dice and improvised attacks map to usable system fields',()=>{
  const armor=cardToItem(card({name:'Practice Shield',armor_ad:3}));
  assert.equal(armor.system.isShield,true);assert.deepEqual(armor.system.armor,{defense:3,maxDefense:3});
  const arrows=cardToItem(card({name:'Quiver of 20 Arrows',stack:20}));
  assert.equal(arrows.name,'Quiver of Arrows');assert.equal(arrows.system.maxStack,1);assert.equal(arrows.system.contentsQuantity,20);
  assert.equal(cardToItem(card({name:'Coin Purse'})).system.contentsQuantity,0);
  const vial=cardToItem(card({body_html:'Make a ranged 5 attack using Agility.',tiers:{t2:'2 damage',t3:'4 damage'},ud:{max:4,flags:['Rest']}}));
  assert.equal(vial.system.weapon.attackFormula,'2d10 + A');assert.equal(vial.system.weapon.range,'Ranged 5');
  assert.equal(vial.system.consumable.udTrigger,'Rest');assert.equal(vial.system.consumable.currentUD,4);
});

test('additional spell cards retain the same fields and record the source filename',()=>{
  const input=card({name:'Example Book',spell:{rank:2,discipline:'Illusion',cast:'Action'},tiers:{t1:'Miss',t2:'Effect',t3:'More effect'},ud:{max:6,flags:['Activate']}});
  const core=cardToItem(input),extra=cardToItem({...input,source:'cards',file:'Additional spells.pdf'});
  assert.equal(extra.name,core.name);assert.deepEqual(extra.system,core.system);
  assert.deepEqual(extra.flags['fvtt-crows-pdf-importer'].source,{set:'cards',file:'Additional spells.pdf',page:1,cardIndex:0,name:input.name});
});

test('fresh imports use curated named icons before category fallbacks',()=>{
  assert.equal(cardToItem(card({name:'Axe',weapon:{range:'Melee 1'}})).img,'icons/weapons/axes/axe-battle-broad-stone.webp');
  assert.equal(cardToItem(card({name:'Coin Purse'})).img,'icons/commodities/currency/coins-plain-pouch-gold.webp');
  assert.equal(cardToItem(card({name:'Animal Form Book',spell:{rank:0}})).img,'icons/sundries/books/book-clasp-spiral-green.webp');
  assert.equal(cardToItem(card({name:'Unlisted Tool'})).img,'icons/svg/item-bag.svg');
});

test('PDF markup is escaped in every rendered description section',()=>{
  const item=cardToItem(card({body_html:'<b>Safe</b> <img src=x onerror=bad()> &lt;script&gt;',qualities:['<img>'],tiers:{t2:'<script>'},crafting:{raw:'<iframe>'},variants:{fine:{price:1,text:'<svg onload=bad()>'}}}));
  assert.ok(!/<(?:img|script|iframe|svg)\b/i.test(item.system.description));
  assert.match(item.system.description,/<b>Safe<\/b>/);assert.match(item.system.description,/&lt;img/);
  assert.equal(safeBody('&lt;b&gt;literal&lt;/b&gt;'),'&lt;b&gt;literal&lt;/b&gt;');
});

test('preview validates temporary Items without saving and reports failures',()=>{
  const documents=[cardToItem(card()),cardToItem(card({name:'Broken'}))];let checked=0;
  class TemporaryItem{constructor(source,options){assert.equal(options.strict,true);this.source=source;}
    validate(options){assert.equal(options.strict,true);checked++;if(this.source.name==='Broken')throw new Error('Invalid field');return true;}}
  const result=validateItemPreview(documents,{ItemClass:TemporaryItem,models:{equipment:{}}});
  assert.equal(checked,2);assert.equal(result.status,'failed');assert.equal(result.errors[0].name,'Broken');
  assert.equal(validateItemPreview(documents,{ItemClass:null,models:null}).status,'unavailable');
  assert.throws(()=>cardToItem(card({source:'unknown'})),/card set/);
});

test('Parry weapons map Parry N quality to armor defense and maxDefense for hand defense tracking',()=>{
  for(const [name,parry] of [['Knife',2],['Sword',4],['Glaive',6],['Greatsword',6]]){
    const item=cardToItem(card({name,weapon:{range:'Melee 1',attack:'2d10 + S',tier2:'3 + S',tier3:'6 + S'},qualities:['Slashing',`Parry ${parry}`]}));
    assert.equal(item.system.isWeapon,true);assert.equal(item.system.isArmor,true);assert.equal(item.system.isShield,false);
    assert.deepEqual(item.system.armor,{defense:parry,maxDefense:parry});
    assert.match(item.system.description,new RegExp(`AD ${parry}`));
  }
});

test('unique items preserve unique flag and badge without setting crafting',()=>{
  const item=cardToItem(card({name:"Zaziel's Book of Elation",unique:true,price:30000}));
  assert.equal(item.flags['fvtt-crows-pdf-importer'].unique,true);
  assert.equal(item.system.crafting,'');
  assert.match(item.system.description,/Unique Item/);
});
