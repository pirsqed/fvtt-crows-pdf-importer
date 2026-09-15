import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCard} from '../scripts/card-parser.mjs';
import {compareCards} from './card-comparison.mjs';

const span=(text,x=0,extra={})=>({text,x,x1:x+text.length*5,size:11,bold:false,italic:false,...extra});
const line=(text,yc,extra={})=>({text,yc,size:11,x0:0,x1:200,spans:[span(text)],...extra});

test('tier geometry preserves weapon fields, qualities and following description',()=>{
  const lines=[line('Practice Blade Stack 2 (Occupies 2 Slots)',0),line('Melee 1',12),
    line('Attack 2d10 + A',24,{spans:[span('Attack',0,{bold:true}),span('2d10 + A',40)]}),
    line('12-16 17+',36,{spans:[span('12-16',20,{bold:true}),span('17+',100,{bold:true})]}),
    line('3 + A 6 + A',48,{spans:[span('3 + A',20),span('6 + A',100)]}),
    line('Slashing, Light',60,{spans:[span('Slashing, Light',0,{italic:true})]}),
    line('A training implement.',72),line('0 gc',84,{size:7,spans:[span('0 gc',0,{size:7})]})];
  const card=parseCard(lines,{source:'core',page:3,index:2,verticals:[[70,30,54]]});
  assert.equal(card.name,'Practice Blade');assert.equal(card.stack,2);assert.equal(card.slots,2);assert.equal(card.price,0);
  assert.deepEqual(card.weapon,{range:'Melee 1',attack:'2d10 + A',tier2:'3 + A',tier3:'6 + A'});
  assert.deepEqual(card.qualities,['Slashing','Light']);assert.equal(card.body_html,'A training implement.');
  lines[4].spans=[span('3 + A 6 + A',20,{x1:140,estimatedWords:true,words:[[20,60,'3 + A'],[100,140,'6 + A']]})];
  assert.throws(()=>parseCard(lines),/cannot reliably split tier text/);
});

test('spell metadata, usage die and crafting institution tier are distinct',()=>{
  const card=parseCard([line('Example Book R2',0),line('Illusion Act.',12),line('Self',24),
    line('Target one ally',36,{spans:[span('Target',0,{bold:true}),span('one ally',40)]}),
    line('Dur. one round',48,{spans:[span('Dur.',0,{bold:true}),span('one round',30)]}),
    line('UD: 4 (daily; fragile)',60),line('Slot: Hand',72),
    line('Enchanting 2 | 1 crystal | 12',84,{size:7}),line('200 gc',96,{size:7})]);
  assert.deepEqual(card.spell,{rank:2,discipline:'Illusion',cast:'Action',range:'Self',target:'one ally',duration:'one round'});
  assert.deepEqual(card.ud,{max:4,flags:['daily','fragile']});assert.equal(card.magic_slot,'Hand');
  assert.deepEqual(card.crafting,{raw:'Enchanting 2 | 1 crystal | 12',expertise:'Enchanting',institution_tier:'2',materials:'1 crystal',goal:'12'});
  assert.equal(card.price,200);assert.equal(card.body_html,'');
});

test('Blacksmithing footer specifies the required village institution tier',()=>{
  const card=parseCard([line('Practice Tool',0),line('Blacksmithing 1 | 1 iron bar | 10',12,{size:7})]);
  assert.deepEqual(card.crafting,{raw:'Blacksmithing 1 | 1 iron bar | 10',expertise:'Blacksmithing',institution_tier:'1',materials:'1 iron bar',goal:'10'});
  assert.equal(card.ud,null);
});

test('descriptions escape literal markup and preserve spaces and variant text',()=>{
  const card=parseCard([line('Test Kit',0,{spans:[span('Test'),span('Kit',30)]}),
    line('Fine (20 gc): Useful.',12),line('Masterwork (40 gc): Very useful.',24),
    line('Label: <img src=x onerror="bad()"> & other text',36,{spans:[span('Label:',0,{bold:true}),span('<img src=x onerror="bad()"> & other text',40)]})]);
  assert.equal(card.name,'Test Kit');assert.equal(card.variants.fine.price,20);assert.equal(card.variants.fine.text,'Useful.');
  assert.equal(card.variants.masterwork.price,40);
  assert.match(card.body_html,/<b>Label:<\/b> &lt;img/);assert.ok(!card.body_html.includes('<img'));
  assert.match(card.body_html,/&quot;bad\(\)&quot;&gt; &amp;/);
});

test('comparison permits tag-space changes but detects lost words, emphasis and fields',()=>{
  assert.deepEqual(compareCards({body_html:'<b>Label: </b>two words'},{body_html:'<b>Label:</b> two words'}),[]);
  assert.ok(compareCards({body_html:'two words'},{body_html:'twowords'}).length);
  assert.ok(compareCards({body_html:'<b>word</b>'},{body_html:'word'}).length);
  assert.ok(compareCards({price:1},{price:1,extra:true}).length);
});
