import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCard} from '../scripts/card-parser.mjs';
import {compareCards} from './card-comparison.mjs';
import {cards} from '../scripts/layout-parser.mjs';
import {cardToItem} from '../scripts/item-mapper.mjs';

const span=(text,x=0,extra={})=>({text,x,x1:x+text.length*5,size:11,bold:false,italic:false,...extra});
const line=(text,yc,extra={})=>({text,yc,size:11,x0:0,x1:200,spans:[span(text)],...extra});

test('mixed-case printed Book titles retain spell rank, discipline and spellbook behavior',()=>{
  for(const title of ['Greater Animal Form BooK R3','Greater Animal Form BOOK R3']){
    const parsed=parseCard([line(title,0),line('Stack 1',12),line('Alteration Act.',24)],{source:'core'});
    assert.equal(parsed.name,'Greater Animal Form Book');assert.equal(parsed.rank,3);
    assert.equal(parsed.spell.discipline,'Alteration');
    const mapped=cardToItem(parsed);
    assert.equal(mapped.name,'Greater Animal Form Book R3');assert.equal(mapped.system.isSpellbook,true);
    assert.equal(mapped.flags['fvtt-crows-pdf-importer'].spell.rank,3);
  }
});

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

test('additional cards handle small titles, wrapped rank/casting labels and combined metadata',()=>{
  const lines=[line('Example Book',10,{size:6,spans:[span('Example Book',5,{size:6,bold:true})]}),
    line('R3 Stack 1 Necromancy',20,{spans:[span('R3 Stack 1',5,{bold:true}),span('Necromancy',70,{italic:true})]}),
    line('Attk.',32,{spans:[span('Attk.',5,{italic:true})]}),line('UD 1 (Rest; Activate)',44),
    line('Ranged 5 Target 1 ally Dur. 2 UD',56,{spans:[span('Ranged 5',0,{italic:true}),span('Target',45,{bold:true}),span('1 ally',80),span('Dur.',115,{bold:true}),span('2 UD',140)]}),
    line('Example effect.',68),line('5,000 gc',85,{size:9})];
  const layout={lines:lines.map(l=>({bbox:[0,l.yc,200,l.yc+l.size],spans:l.spans.map(s=>({...s,bbox:[s.x,l.yc,s.x1,l.yc+s.size]}))})),
    paths:[{segments:[[[0,0],[0,200]],[[200,0],[200,200]]]}]};
  const parsed=cards(layout,{source:'cards'}).parsedCards;
  assert.equal(parsed.length,1);assert.equal(parsed[0].name,'Example Book');assert.equal(parsed[0].rank,3);
  const card=parseCard(lines,{source:'cards'});
  assert.deepEqual(card.spell,{rank:3,discipline:'Necromancy',cast:'Attack',range:'Ranged 5',target:'1 ally',duration:'2 UD'});
  assert.equal(card.price,5000);assert.equal(card.body_html,'Example effect.');
  assert.equal(card.crafting,null);
});

test('additional cards retain variable, wrapped and combined ranges without treating prose as metadata',()=>{
  for(const [range,next,expected] of [
    ['Cube of variable size within','10','Cube of variable size within 10'],
    ['Self and Ranged 5',null,'Self and Ranged 5'],
    ['Aura varies',null,'Aura varies'],['5 Cube within 10',null,'5 Cube within 10'],
    ['Range 5',null,'Range 5']
  ]){
    const lines=[line('Example Book R1',0),line('Illusion Man.',12),line(range,24,{spans:[span(range,0,{italic:true})]})];
    if(next)lines.push(line(next,36));
    lines.push(line('Dur. Instant',48,{spans:[span('Dur.',0,{bold:true}),span('Instant',30)]}),line('You move within range.',60));
    const card=parseCard(lines,{source:'cards'});
    assert.equal(card.spell.range,expected);assert.equal(card.spell.duration,'Instant');
    assert.equal(card.body_html,'You move within range.');
  }
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

const cardLayout=rows=>({lines:rows.map((text,i)=>({spans:[{text,bold:true,italic:false,size:9,bbox:[5,10+i*12,195,19+i*12]}]})),paths:[{segments:[[[0,0],[0,200]],[[200,0],[200,200]]]}]});
test('Stack anchors keep wrapped titles whole and accept titles beginning with Fine',()=>{
  const result=cards(cardLayout(['Case of 20 Crossbow','Bolts','Stack 1','Fine Coin Purse','Stack 1']),{source:'core'});
  assert.deepEqual(result.parsedCards.map(c=>c.name),['Case of 20 Crossbow Bolts','Fine Coin Purse']);
});
test('a usage label between the title and Stack remains metadata',()=>{
  const result=cards(cardLayout(['Case of Crossbow Bolts','UD 2 (activate; useless)','Stack 1']),{source:'poi'});
  assert.equal(result.parsedCards[0].name,'Case of Crossbow Bolts');
  assert.deepEqual(result.parsedCards[0].ud,{max:2,flags:['activate','useless']});
});
test('small official spell titles and glued Stack labels are detected',()=>{
  const layout=cardLayout(['Example Book R3Stack1']);layout.lines[0].spans[0].size=6;
  const [card]=cards(layout,{source:'core'}).parsedCards;
  assert.equal(card.name,'Example Book');assert.equal(card.rank,3);
});
test('a Stack label outside detected columns fails completeness validation',()=>{
  const layout=cardLayout(['Test Stack 1']);layout.paths=[];
  assert.throws(()=>cards(layout),/found 1 Stack labels but parsed 0 cards/);
});
test('official card modes parse combined metadata and wearable markers',()=>{
  for(const source of ['core','profession','poi']){
    const card=parseCard([line('Example Book R1',0),line('Stack 1 Necromancy',12),line('Attk.',24),
      line('Self Dur. 1 UD',36,{spans:[span('Self',0),span('Dur.',30,{bold:true}),span('1 UD',60)]})],{source});
    assert.equal(card.spell.discipline,'Necromancy');assert.equal(card.spell.cast,'Attack');
    assert.equal(card.spell.range,'Self');assert.equal(card.spell.duration,'1 UD');
  }
  assert.equal(parseCard([line('Example Ring',0),line('Stack 1 (wearable)',12)]).wearable,true);
});

test('Unidentified Item has its own boundary without a Stack label, including an otherwise empty column',()=>{
  const layout=cardLayout(['Gem Stack 5','A gem.','Unidentified Item','Ask the Ref for details.','Rope Stack 1','A rope.']);
  const result=cards(layout,{source:'poi'}).parsedCards;
  assert.deepEqual(result.map(c=>c.name),['Gem','Unidentified Item','Rope']);
  assert.deepEqual(result.map(c=>c.raw_lines),[['Gem Stack 5','A gem.'],['Unidentified Item','Ask the Ref for details.'],['Rope Stack 1','A rope.']]);
  assert.equal(cards(cardLayout(['Unidentified Item','Ask the Ref.'])).parsedCards.length,1);
  const missing=cardLayout(['Unidentified Item']);missing.paths=[];
  assert.throws(()=>cards(missing),/1 Unidentified Item titles but parsed 0 cards/);
});

test('wrapped occupancy remains slot metadata and leaves following content intact',()=>{
  for(const rows of [['Bow Stack 1 (Occupies 2','Slots)'],['Bow Stack 1 (Occupies','2 Slots)'],['Bow Stack 1 (Occupies','2','Slots)']]){
    const input=[...rows,'Ranged 23','A bow.'].map((text,i)=>line(text,i*12));
    const card=parseCard(input,{source:'poi'});
    assert.equal(card.name,'Bow');assert.equal(card.stack,1);assert.equal(card.slots,2);
    assert.equal(card.weapon.range,'Ranged 23');assert.equal(card.body_html,'A bow.');
  }
});

test('weapon enchantments are distinct from qualities and preserve wrapped target names',()=>{
  const input=[line('Test Blade Stack 1',0),line('Melee 1',12),
    line('Attack 2d10 + S',24,{spans:[span('Attack',0,{bold:true}),span('2d10 + S',40)]}),
    line('12-16 17+',36,{spans:[span('12-16',20,{bold:true}),span('17+',100,{bold:true})]}),
    line('3 + S 6 + S',48,{spans:[span('3 + S',20),span('6 + S',100)]}),
    line('Slashing, Parry 6, Enchantment:',60,{spans:[span('Slashing, Parry 6, Enchantment:',0,{italic:true})]}),
    line('Slaying (Human)',72,{spans:[span('Slaying (Human)',0,{italic:true})]}),line('100 gc',84,{size:7})];
  const card=parseCard(input,{verticals:[[70,30,54]]});
  assert.equal(card.name,'Test Blade');assert.equal(card.enchantment,'Slaying (Human)');
  assert.deepEqual(card.qualities,['Slashing','Parry 6']);assert.equal(card.price,100);
  assert.equal(card.body_html,'');assert.equal(card.weapon.tier3,'6 + S');
});

test('armor enchantments retain their value without consuming adjacent prose',()=>{
  for(const labels of [['Enchantment: Silent'],['Enchantment:','Silent']]){
    const input=[line('Test Armor Stack 1',0),line('Armor AD 14',12),
      ...labels.map((text,i)=>line(text,24+i*12,{spans:[span(text,0,{italic:true})]})),line('Quiet armor.',60)];
    const card=parseCard(input);assert.equal(card.enchantment,'Silent');assert.equal(card.armor_ad,14);
    assert.equal(card.body_html,'Quiet armor.');
  }
  assert.equal(parseCard([line('Test Kit',0),line('Enchantment: this is explanatory prose.',12)]).enchantment,undefined);
});

test('Unfinished Craftable Item has its own boundary without a Stack label and does not merge into preceding cards',()=>{
  const layout=cardLayout(['Truth Poison Stack 1','Tell the truth.','Unfinished Craftable Item','Item: ____________','Goal: ____________']);
  const result=cards(layout,{source:'core'}).parsedCards;
  assert.deepEqual(result.map(c=>c.name),['Truth Poison','Unfinished Craftable Item']);
  assert.ok(!result[0].body_html.includes('Unfinished Craftable Item'));
  assert.match(result[1].body_html,/Item:/);
});

test('Unique Item footers and stray numeric footers without crafting headers do not set crafting metadata',()=>{
  const book=parseCard([line("Zaziel's Book of Elation",0),line('Stack 1',12),line('Unique Item | Worth: 30,000 gc',24,{size:7})]);
  assert.equal(book.unique,true);assert.equal(book.price,30000);assert.equal(book.crafting,null);
  const blood=parseCard([line('Blood Concoction',0),line('Stack 1',12),line('Unique Item | XP: 500',24,{size:7}),line('200 gc',36,{size:7})]);
  assert.equal(blood.unique,true);assert.equal(blood.price,200);assert.equal(blood.crafting,null);
  const shield=parseCard([line('Shield Stack 1',0),line('Armor AD 4',12),line('5',24,{size:7})]);
  assert.equal(shield.crafting,null);assert.equal(shield.body_html,'');
});

test('a usage die label wrapped across two lines remains metadata',()=>{
  const card=parseCard([line('Hurling Wand Stack 2',0),line('UD 1 (Useless;',12),line('Activate)',24),line('Maneuver: You target a creature.',36)]);
  assert.deepEqual(card.ud,{max:1,flags:['Useless','Activate']});
  assert.ok(!card.body_html.includes('UD'));assert.ok(!card.body_html.includes('Activate)'));
  assert.equal(cardToItem({...card,source:'core'}).system.consumable.maxUD,1);
});
test('a book containing several spells becomes one spellbook with their combined UD and its text kept',()=>{
  const text="This book contains the greater phantasm, light shell, and illusory double spellbooks. Each spell has 2 UD.";
  const card=parseCard([line("Zaziel's Book of Elation",0),line('Stack 1',12),line(text,24)]);
  assert.deepEqual(card.ud,{max:6,flags:['Rest','Activate']});assert.equal(card.spell.rank,null);
  const item=cardToItem({...card,source:'poi'});
  assert.equal(item.system.isSpellbook,true);assert.equal(item.system.consumable.maxUD,6);
  assert.equal(item.name,"Zaziel's Book of Elation");assert.match(item.system.description,/Each spell has 2 UD\./);
});
