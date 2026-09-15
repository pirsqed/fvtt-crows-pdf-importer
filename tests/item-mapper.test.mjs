import test from 'node:test';
import assert from 'node:assert/strict';
import {cardToItem,safeBody,validateItemPreview} from '../scripts/item-mapper.mjs';
const card=extra=>({source:'core',page:1,card_index:0,name:'Practice blade',stack:2,slots:1,price:10,body_html:'A <b>sturdy</b> blade.',...extra});

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
    assert.equal(item.img,'icons/sundries/books/book-worn-brown.webp');
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
