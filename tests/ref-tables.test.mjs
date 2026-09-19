import test from 'node:test';
import assert from 'node:assert/strict';
import {readTableCells,parseRefTables,REF_TABLES} from '../scripts/ref-tables.mjs';

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
