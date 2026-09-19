// Layout map for the user-supplied Playtest 2 Ref book. No result text is bundled.
const segment=(page,column,top,bottom,rows)=>({page,column,top,bottom,rows});
export const REF_TABLES=[
  ['Travel Encounters',100,[segment(1,0,158,287,8)]],
  ['Any Monster Encounter',10,[segment(1,0,448,534,5)]],
  ['Merchant Sales',100,[segment(2,1,49,404,20)]],
  ['Merchant Guards',10,[segment(3,0,49,207,10)]],
  ['Miasma-Touched Humans',100,[segment(3,1,49,422,25)]],
  ['Miasma-Touched Encounters',100,[segment(4,0,50,610,5),segment(4,1,36,610,5),segment(5,0,36,609,5),segment(5,1,36,598,5),segment(6,0,36,210,2)]],
  ['Travelers',100,[segment(7,0,49,422,25)]],
  ['Traveler Encounters',10,[segment(7,1,49,568,5),segment(8,0,36,447,5)]],
  ['Traveler Rewards',6,[segment(8,1,50,215,6)]],
  ['Coastal Animal Encounters',10,[segment(9,0,49,207,10)]],
  ['Cold Climate Animal Encounters',10,[segment(9,0,226,385,10)]],
  ['Desert Animal Encounters',100,[segment(9,1,49,279,15)]],
  ['Forest Animal Encounters',100,[segment(9,1,298,610,20)]],
  ['Grassland Animal Encounters',100,[segment(10,0,49,361,20)]],
  ['Hill/Mountain Animal Encounters',100,[segment(10,1,49,361,20)]],
  ['Marsh/Swamp Animal Encounters',10,[segment(10,1,380,549,10)]],
  ['Wild Animal Reaction',100,[segment(11,0,50,570,6),segment(11,1,36,501,5),segment(12,0,36,433,4)]],
  ['Minor Interesting Things',100,[segment(12,1,50,611,36),segment(13,0,36,603,31),segment(13,1,36,277,9)]],
  ['Major Interesting Things',100,[segment(14,0,50,608,32),segment(14,1,36,452,19)]],
  ['Blood Dungeon Encounters',6,[segment(32,0,385,497,6)]],
  ['Undead Dungeon Encounters',6,[segment(34,0,403,561,10)]]
];
export const REF_TABLE_PAGES=new Set(REF_TABLES.flatMap(([, ,segments])=>segments.map(s=>s.page)));
const scope='fvtt-crows-pdf-importer';
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const clean=s=>s.replace(/\s+/g,' ').trim();
const unique=values=>values.sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>1);

/** Read actual ruled cells, so wrapped ranges and long descriptions stay together. */
export function readTableCells(layout,{column,top,bottom,rows}){
  const left=column?222:36,right=column?396:210;
  const lines=layout.paths.filter(p=>p.width>0).flatMap(p=>p.segments);
  const ys=unique(lines.filter(([a,b])=>Math.abs(a[1]-b[1])<0.1&&Math.abs(a[0]-b[0])>12&&Math.min(a[0],b[0])>=left-1&&Math.abs(Math.max(a[0],b[0])-right)<1&&a[1]>=top-1&&a[1]<=bottom+1).map(([a])=>a[1]));
  if(ys.length!==rows+2)throw new Error(`Expected ${rows} table rows, found ${ys.length-2}. Check the Ref book version.`);
  const headerY=(ys[0]+ys[1])/2;
  const xs=unique(lines.filter(([a,b])=>Math.abs(a[0]-b[0])<0.1&&a[0]>=left-1&&a[0]<=right+1&&Math.min(a[1],b[1])<headerY&&Math.max(a[1],b[1])>headerY).map(([a])=>a[0]));
  if(xs.length<3)throw new Error('Missing table column boundaries.');
  const spans=layout.lines.flatMap(l=>l.spans);
  const text=(x0,y0,x1,y1)=>{
    const selected=spans.filter(s=>{const x=(s.bbox[0]+s.bbox[2])/2,y=(s.bbox[1]+s.bbox[3])/2;return x>x0&&x<x1&&y>y0&&y<y1;});
    // Font ascenders differ between bold labels and body text on the same line.
    const ordered=selected.sort((a,b)=>a.bbox[1]-b.bbox[1]),bands=[];
    for(const span of ordered){let band=bands.find(b=>Math.abs(b.y-span.bbox[1])<3);if(!band){band={y:span.bbox[1],spans:[]};bands.push(band);}band.spans.push(span);}
    return clean(bands.map(b=>{let text='',end=null;for(const s of b.spans.sort((a,b)=>a.bbox[0]-b.bbox[0])){if(end!==null&&s.bbox[0]-end>0.8&&!text.endsWith(' ')&&!s.text.startsWith(' '))text+=' ';text+=s.text;end=s.bbox[2];}return text;}).join(' '));
  };
  return ys.slice(0,-1).map((y,i)=>xs.slice(0,-1).map((x,j)=>text(x,y,xs[j+1],ys[i+1])));
}

function rangeOf(text){
  const token=text.replace(/\s/g,'').replace(/[–−]/g,'-');
  const match=token.match(/^(\d+)(?:-(\d+)|(\+)\*?)?$/);
  if(!match)throw new Error(`Unrecognized result range: ${text}`);
  return [+match[1],match[3]?Number.MAX_SAFE_INTEGER:+(match[2]??match[1])];
}

function document(name,die,rows,pages,notes=[]){
  const results=rows.map(({range,text})=>({type:'text',name:text.length>80?text.slice(0,77)+'…':text,description:escape(text),range,weight:range[1]===Number.MAX_SAFE_INTEGER?1:range[1]-range[0]+1,drawn:false}));
  return {name,img:'icons/svg/d20-grey.svg',description:`<p>Ref Book for Playtest 2, pages ${pages.join(', ')}.</p>`+notes.map(n=>`<p>${escape(n)}</p>`).join(''),formula:`1d${die}`,replacement:true,displayRoll:true,results,
    flags:{[scope]:{source:{set:'ref',page:pages[0],pages},notes}}};
}

export function parseRefTables(layouts){
  const byPage=new Map(layouts.map(l=>[l.page,l])),tables=[],warnings=[];
  for(const [name,die,segments] of REF_TABLES){
    const rows=[];
    for(const part of segments){
      const layout=byPage.get(part.page);if(!layout)throw new Error(`${name}: missing page ${part.page}.`);
      const [header,...cells]=readTableCells(layout,part);
      if(!/^d(?:6|10|100)$/.test(header[0]))throw new Error(`${name}: missing die header on page ${part.page}.`);
      for(const [roll,...values] of cells){
        if(values.some(v=>!v))throw new Error(`${name}: empty result cell on page ${part.page}.`);
        rows.push({range:rangeOf(roll),text:values.join(' — ')});
      }
    }
    const notes=[];let formulaDie=die;
    if(name==='Minor Interesting Things'){
      for(const [from,to] of [[[45,46],[46,46]],[[58,58],[57,57]],[[59,59],[58,59]]]){
        const matches=rows.filter(r=>r.range[0]===from[0]&&r.range[1]===from[1]);
        if(matches.length!==1)throw new Error(`${name}: expected printed range ${from.join('–')} for the Playtest 2 correction.`);
        matches[0].range=to;
      }
      notes.push('Playtest 2 corrections: gems use 46; the case of steel crossbow bolts uses 57; the fine torch uses 58–59.');
    }
    if(name==='Undead Dungeon Encounters'){
      formulaDie=10;
      notes.push('Playtest 2 correction: the printed Blood Dungeon Encounters title and d6 header are corrected to Undead Dungeon Encounters and d10 for its ten results.');
    }
    for(let value=1;value<=formulaDie;value++){
      const count=rows.filter(r=>r.range[0]<=value&&r.range[1]>=value).length;
      if(count!==1)throw new Error(`${name}: result ${value} has ${count?'overlapping entries':'no entry'}.`);
    }
    if(name==='Major Interesting Things')notes.push('The printed 101+ result is for Greed Exchange in the temple institution. It is retained for modified rolls; an ordinary d100 cannot reach it.');
    if(notes.length)warnings.push(...notes.map(note=>`${name}: ${note}`));
    tables.push(document(name,formulaDie,rows,[...new Set(segments.map(s=>s.page))],notes));
  }
  const weather=tables.find(t=>t.name==='Travel Encounters').results.find(r=>r.name==='Bad Weather');
  if(!weather)throw new Error('Travel Encounters: missing Bad Weather result. Check the Ref book version.');
  weather.description+=' — Use the Bad Weather table for the current climate or season in the Ref Book for Playtest 2, page 1. Roll any die: odd selects the first listed event; even selects the second. Weather lasts 24 hours; see pages 1–2 for effects.';
  return {tables,tableWarnings:warnings};
}
