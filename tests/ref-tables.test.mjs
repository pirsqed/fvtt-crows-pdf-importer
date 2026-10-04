import test from 'node:test';
import assert from 'node:assert/strict';
import {readTableCells,parseRefTables,REF_TABLES,parseRulesTables} from '../scripts/ref-tables.mjs';

function grid(){
  const paths=[10,30,70].map(y=>({width:1,segments:[[[60,y],[210,y]]]}));
  for(const x of [36,60,210])paths.push({width:1,segments:[[[x,10],[x,70]]]});
  // An underline inside a cell is not a row boundary.
  paths.push({width:1,segments:[[[70,58],[100,58]]]});
  const span=(text,x,y,w=20)=>({text,bbox:[x,y,x+w,y+8]});
  return {paths,lines:[{spans:[span('d100',38,14),span('Result',65,14),span('01-',38,35),span('10',38,48),span('Bold:',65,35),span('Body',88,36),span('next line',65,48,45)]}]};
}
test('ruled cells preserve wrapped ranges, label order and continuation text',()=>{
  assert.deepEqual(readTableCells(grid(),{column:0,top:10,bottom:70,rows:1}),[['d100','Result'],['01- 10','Bold: Body next line']]);
});
test('unexpected row counts and missing pages fail instead of silently truncating tables',()=>{
  assert.throws(()=>readTableCells(grid(),{column:0,top:10,bottom:70,rows:2}),/Expected 2 table rows/);
  assert.throws(()=>parseRefTables([]),/Travel Encounters: missing page 1/);
  assert.equal(REF_TABLES.length,21);
});

/** A three-column ruled table in the given page column, one text span per cell. */
function ruled(column,top,rows){
  const [left,right]=column?[222,396]:[36,210],xs=[left,left+38,left+108,right],height=20;
  const ys=Array.from({length:rows.length+2},(_,i)=>top+i*height),paths=[],spans=[];
  for(const y of ys)for(let i=0;i<3;i++)paths.push({width:1,segments:[[[xs[i],y],[xs[i+1],y]]]});
  for(const x of xs)paths.push({width:1,segments:[[[x,top],[x,ys.at(-1)]]]});
  [['d10 + Cruelty','1st Effect','2nd Effect'],...rows].forEach((cells,row)=>cells.forEach((text,i)=>
    spans.push({text,bbox:[xs[i]+2,ys[row]+4,xs[i]+30,ys[row]+12]})));
  return {paths,lines:[{spans}]};
}
test('Miasma Effects keeps both printed effects and covers results 1 through 13+',()=>{
  const left=ruled(0,49,[['1-2','First A','Second A'],['3-4','First B','Second B'],['5-6','First C','Second C'],['7-8','First D','Second D'],['9-10','First E','Second <E>']]);
  const right=ruled(1,36,[['11-12','First F','Second F'],['13+','First G','Second G']]);
  const page={page:28,paths:[...left.paths,...right.paths],lines:[...left.lines,...right.lines]};
  const [table]=parseRulesTables([page]).tables;
  assert.equal(table.name,'Miasma Effects');assert.equal(table.formula,'1d10');
  assert.deepEqual(table.results.map(r=>r.range),[[1,2],[3,4],[5,6],[7,8],[9,10],[11,12],[13,Number.MAX_SAFE_INTEGER]]);
  assert.equal(table.results[4].name,'First E');assert.equal(table.results[4].description,'Second &lt;E&gt;');
  assert.equal(table.flags['fvtt-crows-pdf-importer'].source.set,'rules');
  assert.throws(()=>parseRulesTables([]),/Miasma Effects: missing page 28/);
  const gap=ruled(1,36,[['11-12','First F','Second F'],['14+','First G','Second G']]);
  assert.throws(()=>parseRulesTables([{page:28,paths:[...left.paths,...gap.paths],lines:[...left.lines,...gap.lines]}]),/result 13 has no entry/);
});
