import {normalizeSeparators} from './comparison.mjs';

/** Compare rendered words and the emphasis of every non-whitespace character.
 * The Python formatter sometimes attaches spaces to tags, omits a space after
 * an action/bullet label, or concatenates a range with Dur. These are the only
 * extra visible-whitespace equivalences accepted below.
 */
export function bodySignature(html) {
  const parts=html.split(/(<\/?[bi]>)/g),characters=[];
  let bold=false,italic=false,text='';
  for(const part of parts) {
    if(part==='<b>'){bold=true;continue;}if(part==='</b>'){bold=false;continue;}
    if(part==='<i>'){italic=true;continue;}if(part==='</i>'){italic=false;continue;}
    const decoded=part.replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    text+=decoded;
    for(const char of decoded)if(!/[\s\u200b]/.test(char))characters.push([char,bold,italic]);
  }
  text=normalizeSeparators(text).replace(/([●:])\s*/g,'$1 ').replace(/(Self|Ranged \d+)\s*Dur\./g,'$1 Dur.');
  return {text,characters};
}

export function compareCards(expected,actual,path='',semanticHTML=true) {
  if(path.endsWith('.body_html') && semanticHTML)return compareCards(bodySignature(expected),bodySignature(actual),path,false);
  if(Array.isArray(expected)&&Array.isArray(actual))return expected.length!==actual.length?[{path:path+'.length',expected:expected.length,actual:actual.length}]:expected.flatMap((v,i)=>compareCards(v,actual[i],`${path}[${i}]`,semanticHTML));
  if(expected && actual && typeof expected==='object' && typeof actual==='object')return [...new Set([...Object.keys(expected),...Object.keys(actual)])].flatMap(k=>compareCards(expected[k],actual[k],`${path}.${k}`,semanticHTML));
  if(typeof expected==='string' && typeof actual==='string' && !path.endsWith('.body_html'))return normalizeSeparators(expected)===normalizeSeparators(actual)?[]:[{path,expected,actual}];
  return expected===actual?[]:[{path,expected,actual}];
}
