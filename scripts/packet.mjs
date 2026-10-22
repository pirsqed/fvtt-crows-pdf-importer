import {finalizeBackgrounds} from './characters-parser.mjs';
export const CARD_SETS={core:'Core inventory',profession:'Profession inventory',poi:'POIs and dungeons',ref:'Ref book — creatures and rollable tables',rules:'Rules Book — Miasma Effects and Backlashes tables',characters:'Characters — backgrounds, connections and traits',cards:'Additional inventory / spell cards'};
const PACKET_SOURCES=Object.keys(CARD_SETS).filter(source=>source!=='cards');
export const filePath=file=>file.webkitRelativePath||file.name;

/** Filename discovery only. File contents are read after the user starts extraction. */
export function discoverPacket(files){
  return [...files].filter(file=>/\.pdf$/i.test(file.name)).sort((a,b)=>filePath(a).localeCompare(filePath(b))).map(file=>{
    const path=filePath(file),name=file.name.toLowerCase();
    let source='',reason='Choose Additional inventory / spell cards for a PDF using the Crows card layout, or assign a supported book type. Otherwise leave skipped.';
    if(path.split(/[\\/]/).some(part=>part.startsWith('.')||part==='__MACOSX'))reason='Hidden or archive metadata copy; skipped.';
    else if(/annotated/.test(name))reason='Annotated copy; skipped to avoid duplicate cards.';
    else if(/ref(?:eree)?[ _-]+book|\bthe[ _-]+ref[ _-]+for[ _-]+playtest\b/.test(name)){source='ref';reason='Ref book detected; extracts creature stat blocks and rollable tables.';}
    else if(/rules?[ _-]+book/.test(name)){source='rules';reason='Rules Book detected; extracts the Miasma Effects table, and the Backlashes table from Playtest 3.';}
    else if(/characters|character[ _-]+book/.test(name)){source='characters';reason='Characters book detected; extracts backgrounds, NPC connections and trait trees.';}
    else if(/cards/.test(name) && !/sheet/.test(name)){
      source=/profession/.test(name)?'profession':/poi|dungeon/.test(name)?'poi':/inventory|invetory/.test(name)?'core':'cards';reason='Detected from filename; check the assignment before extracting.';
    }
    else if(/\bspells?\b|\bspell[ _-]*books?\b/.test(name)&&!/sheet/.test(name)){source='cards';reason='Possible spell cards; check that this PDF uses the Crows card layout.';}
    return {file,path,source,reason};
  });
}

export function reviewPacket(entries){
  const selected=entries.filter(entry=>entry.source),errors=[];
  for(const entry of selected)if(!Object.hasOwn(CARD_SETS,entry.source))errors.push(`Unsupported card set: ${entry.source}`);
  for(const source of PACKET_SOURCES)if(selected.filter(entry=>entry.source===source).length>1)errors.push(`${CARD_SETS[source]}: choose one PDF and skip the extra copies. For separate card supplements, choose Additional inventory / spell cards.`);
  return {selected,errors,missing:PACKET_SOURCES.filter(source=>!selected.some(entry=>entry.source===source))};
}

const cancelled=()=>new DOMException('Extraction cancelled.','AbortError');

/** One PDF/worker at a time, with an inactivity timeout and immediate abort. */
export function extractPacketFile(entry,{signal,onProgress=()=>{},timeout=30000}={}){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(cancelled());return;}
    const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
    let timer,finished=false;
    const finish=(error,value)=>{
      if(finished)return;finished=true;clearTimeout(timer);worker.terminate();signal?.removeEventListener('abort',abort);
      error?reject(error):resolve(value);
    };
    const abort=()=>finish(cancelled());
    const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(new Error('Extraction stopped responding (30-second inactivity limit).')),timeout);};
    signal?.addEventListener('abort',abort,{once:true});touch();
    worker.onerror=event=>finish(new Error(event.message||'Could not load extraction worker.'));
    worker.onmessage=({data})=>{
      if(finished)return;touch();
      if(data.progress){onProgress(data.progress);return;}
      if(data.error){finish(new Error(data.error));return;}
      finish(null,data.result);
    };
    entry.file.arrayBuffer().then(bytes=>{
      if(finished)return;
      worker.postMessage({bytes,page:null,kind:['ref','characters','rules'].includes(entry.source)?entry.source:'cards',source:entry.source,file:entry.path,baseURL:new URL('../../../scripts/pdfjs/',import.meta.url).href},[bytes]);
    }).catch(error=>finish(error));
  });
}

export async function extractPacket(entries,{signal,onProgress=()=>{},extractFile=extractPacketFile}={}){
  const review=reviewPacket(entries);
  if(review.errors.length)throw new Error(review.errors.join(' '));
  if(!review.selected.length)throw new Error('Select at least one supported PDF.');
  const report={files:[],documents:[],parsedCards:[],actors:[],npcRecords:[],tables:[],tableWarnings:[],backgrounds:[],connections:[],backgroundIssues:[],errors:[],missing:review.missing};
  for(const [index,entry] of review.selected.entries()){
    if(signal?.aborted)throw cancelled();
    const progress=detail=>onProgress({file:entry.path,index:index+1,files:review.selected.length,...detail});
    progress({page:0,total:null});
    try{
      const result=await extractFile(entry,{signal,onProgress:progress});
      if(signal?.aborted)throw cancelled();
      report.files.push({path:entry.path,source:entry.source,pages:result.pages,cards:result.parsedCards?.length??0,npcs:result.npcRecords?.length??0,traits:result.documents?.filter(item=>item.type==='trait').length??0,tables:result.tables?.length??0});
      report.documents.push(...result.documents??[]);report.parsedCards.push(...result.parsedCards??[]);
      report.actors.push(...result.actors??[]);report.npcRecords.push(...result.npcRecords??[]);
      report.tables.push(...result.tables??[]);report.tableWarnings.push(...result.tableWarnings??[]);
      if(result.characterData)report.characterData=result.characterData;
    }catch(error){
      if(signal?.aborted||error.name==='AbortError')throw cancelled();
      report.errors.push({path:entry.path,source:entry.source,message:error.message});
    }
  }
  if(report.characterData){
    report.connections=report.characterData.connections;
    try{report.backgrounds=finalizeBackgrounds(report.characterData,report.parsedCards);}
    catch(error){report.backgroundIssues.push(error.message);}
  }
  return report;
}
