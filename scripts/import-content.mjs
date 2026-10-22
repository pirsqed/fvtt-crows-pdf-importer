import {isBestiary,npcFolderPath,isElementalInMonster,checkBestiaryFolders,organizeBestiary} from './bestiary-folders.mjs';
export const SCOPE='fvtt-crows-pdf-importer';
const SYSTEM='fvtt-crows-system';
export const PACKS=[
  {name:'crows-equipment',label:'Equipment & Spellbooks',file:'equipment.json',type:'Item'},
  {name:'crows-dungeon-loot',label:'Dungeon Loot & Relics',file:'dungeon-loot.json',type:'Item'},
  {name:'crows-traits',label:'Traits',file:'traits.json',type:'Item'},
  {name:'crows-bestiary',label:'Bestiary',file:'monsters.json',type:'Actor'},
  {name:'crows-ref-tables',label:'Ref Tables',file:'ref-tables.json',type:'RollTable'}
];
const clone=structuredClone;
const key=doc=>`${doc.type}:${doc.name.trim().toLowerCase()}${doc.type==='trait'?':'+String(doc.system.tree??'').trim().toLowerCase():''}`;
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const fingerprint=value=>JSON.stringify(stable(value));
const comparable=doc=>{
  const value=clone(doc);
  // A known cosmetic difference between the printed dungeon Creature Part cards.
  // Keep this exception local; punctuation can change other items' meaning.
  if(value.type==='equipment'&&value.name==='Creature Part'&&value.flags?.[SCOPE]?.source?.set==='poi'&&value.system?.description)
    value.system.description=value.system.description.replace(/\bcreature, used\b/g,'creature used');
  if(value.flags?.[SCOPE])delete value.flags[SCOPE].source;
  return fingerprint(value);
};
function preferBeltPotion(candidates){
  const prose=/<p class=['"]card-prose['"]>(.*?)<\/p>/s;
  return candidates.filter(short=>{
    if(short.type!=='equipment'||short.name!=='Healing Potion'||short.flags?.[SCOPE]?.source?.set!=='poi')return true;
    const brief=short.system?.description?.match(prose)?.[1];if(!brief)return true;
    return !candidates.some(long=>{
      if(long===short||long.flags?.[SCOPE]?.source?.set!=='poi')return false;
      const full=long.system?.description?.match(prose)?.[1];
      if(!full?.startsWith(brief+' '))return false;
      const addition=full.slice(brief.length).trim().replace(/<\/?[bi]>/g,'');
      if(!/^[^.]*\bbelt slot\b[^.]*\bone maneuver\.$/i.test(addition))return false;
      // Prefer the printed clarification only if every other field matches.
      const equivalent=clone(long);equivalent.system.description=long.system.description.replace(prose,()=>`<p class='card-prose'>${brief}</p>`);
      return comparable(equivalent)===comparable(short);
    });
  });
}
export const systemAdapter=()=>import(new URL('../../../systems/fvtt-crows-system/module/import-content.mjs',import.meta.url).href);

export function resolveImport(report,choices={}){
  const groups=new Map();let repeated=0,professionCopies=0;
  for(const doc of [...report.documents,...report.actors,...report.tables??[]]){
    const pack=doc.results?PACKS[4]:doc.type==='monster'?PACKS[3]:doc.type==='trait'?PACKS[2]:doc.flags?.[SCOPE]?.source?.set==='poi'?PACKS[1]:PACKS[0];
    const id=pack.name+':'+key(doc);if(!groups.has(id))groups.set(id,{id,pack,documents:[]});groups.get(id).documents.push(doc);
  }
  const conflicts=[],packs=PACKS.map(config=>({config,data:[]}));
  for(const group of groups.values()){
    let candidates=group.documents;
    if(group.pack===PACKS[0]&&candidates.some(d=>d.flags?.[SCOPE]?.source?.set==='core')){
      // Core overrides profession copies only. Supplements can intentionally
      // revise a core card and must participate in conflict review.
      const preferred=candidates.filter(d=>d.flags?.[SCOPE]?.source?.set!=='profession');professionCopies+=candidates.length-preferred.length;candidates=preferred;
    }
    const distinct=preferBeltPotion([...new Map(candidates.map(doc=>[comparable(doc),doc])).values()]);repeated+=candidates.length-distinct.length;
    let selected=distinct[0];
    if(distinct.length>1){
      const choice=choices[group.id];
      conflicts.push({id:group.id,name:distinct[0].name,pack:group.pack.label,candidates:distinct,choice});
      if(choice==='skip')continue;
      if(!Number.isInteger(choice)||choice<0||choice>=distinct.length){selected=null;}else selected=distinct[choice];
    }
    if(selected)packs.find(pack=>pack.config===group.pack).data.push(clone(selected));
  }
  const unresolved=conflicts.filter(c=>c.choice!=='skip'&&(!Number.isInteger(c.choice)||c.choice<0||c.choice>=c.candidates.length));
  const creationIssue=report.errors?.length?'Character-creation publishing is unavailable until failed PDFs are resolved. You can still import successful entries.'
    :report.backgroundIssues?.length?'Character-creation publishing is unavailable until starting kits are resolved. You can still import traits and other entries.'
    :!report.backgrounds?.length||!report.connections?.length?'Extract the Characters Book and resolve its starting kits to publish character-creation content.':'';
  return {packs:packs.filter(p=>p.data.length),conflicts,unresolved,repeated,professionCopies,
    creationIssue,creation:!creationIssue?{backgrounds:clone(report.backgrounds),connections:clone(report.connections)}:null};
}

function requireGM(){
  if(!game.user?.isGM||game.users.activeGM?.id!==game.user.id)throw new Error('Run the import as the active GM.');
}
function checkPack(pack,config){
  if(pack&&pack.documentName!==config.type)throw new Error(`${config.label}: existing compendium has the wrong document type.`);
  if(pack?.locked)throw new Error(`${config.label}: compendium is locked. Unlock it before reviewing the import.`);
}
const stored=()=>clone(game.settings.get(SCOPE,'characterContent'));

/** Read and validate every target; no compendiums or settings are written here. */
export async function prepareImport(bundle,{adapter,forceOverwrite=false}={}){
  requireGM();adapter??=await systemAdapter();
  if(bundle.unresolved.length)throw new Error('Resolve the conflicting PDF definitions first.');
  if(!bundle.packs.length)throw new Error('Nothing selected for import.');
  const packs=[],rows=[],state=[],projected=new Map();
  for(const {config,data} of bundle.packs){
    const pack=game.packs.get(`world.${config.name}`);checkPack(pack,config);
    const existing=pack?await pack.getDocuments():[];
    const folders=isBestiary(config)?checkBestiaryFolders(pack):null,folderAssignments=[];
    const projection=new Map(existing.map(doc=>[doc.id,doc.toObject()]));
    const prepared=clone(data);
    for(const raw of prepared){
      const k=adapter.sourceKey(raw),matches=existing.filter(doc=>doc.getFlag(SYSTEM,'importSource')?.key===k||adapter.sourceKey(doc)===k);
      const old=matches.length===1?matches[0]:null,meta=old?.getFlag(SYSTEM,'importSource');
      // Keep existing curated/user artwork; upgrade only category placeholders.
      const placeholders=new Set(['icons/svg/item-bag.svg','icons/svg/sword.svg','icons/svg/shield.svg',
        'icons/sundries/books/book-worn-brown.webp']);
      const upgradePlaceholder=old?.img!==raw.img&&placeholders.has(old?.img)&&!placeholders.has(raw.img);
      if(old?.img&&!upgradePlaceholder)raw.img=old.img;
      if(old&&config.type==='Actor'){
        const oldTexture=old.toObject().prototypeToken?.texture?.src;
        if(oldTexture&&raw.prototypeToken?.texture)raw.prototypeToken.texture.src=oldTexture;
        // Provenance alone is not an Actor inventory change. An exact legacy
        // source match can keep its original tracking without rewriting it.
        const legacy=clone(raw);if(legacy.flags){delete legacy.flags[SCOPE];if(!Object.keys(legacy.flags).length)delete legacy.flags;}
        if(meta?.source===adapter.fingerprint(legacy)){
          if(legacy.flags)raw.flags=legacy.flags;else delete raw.flags;
        }
      }
      const source=adapter.fingerprint(raw);let action='create',reason='';
      if(matches.length>1){action='preserve';reason='ambiguous existing entries';}
      else if(old&&forceOverwrite&&(!meta||adapter.fingerprint(old.toObject())!==meta.baseline||meta.source!==source)){action='update';reason=config.type==='Actor'?'force overwrite; embedded Items will be replaced':'force overwrite imported fields';}
      else if(old&&!meta){action='preserve';reason='existing untracked entry';}
      else if(old&&adapter.fingerprint(old.toObject())!==meta.baseline){action='preserve';reason='locally edited';}
      else if(old&&meta.source===source)action='unchanged';
      else if(old&&config.type==='Actor'){action='preserve';reason='changed Actor source; inventory review required';}
      else if(old)action='update';
      let folderPath=null;
      if(isBestiary(config)&&matches.length<=1&&(!old?.toObject().folder||isElementalInMonster(old,folders))){
        // Preserved content retains its current creature type, even if the PDF changed.
        folderPath=npcFolderPath(old&&action!=='update'?old:raw);
        folderAssignments.push({key:k,actorId:old?.id??null,name:raw.name,path:folderPath,fromFolder:old?.toObject().folder??null});
      }
      rows.push({id:`${config.name}:${k}`,pack:config.label,name:raw.name,action,reason,...(folderPath?{folderPath}:{})});
      if(action==='create'||action==='update')projection.set(old?.id??'new:'+k,clone(raw));
    }
    // Foundry constructors own and may mutate their input while adding defaults.
    // Validation must not change the reviewed payload or its source fingerprint.
    adapter.validateImport(clone(prepared),config);
    state.push({name:config.name,exists:Boolean(pack),documents:existing.map(doc=>({id:doc.id,value:doc.toObject()})).sort((a,b)=>a.id.localeCompare(b.id)),...(folders?{folders}:{})});
    packs.push({config,data:prepared,...(isBestiary(config)?{folderAssignments}:{})});
    projected.set(config.name,[...projection.values()]);
  }
  if(bundle.creation){
    for(const config of [PACKS[0],PACKS[2],PACKS[3]])if(!projected.has(config.name)){
      const pack=game.packs.get(`world.${config.name}`);
      if(!pack||pack.documentName!==config.type)throw new Error(`Character creation needs ${config.label}. Include its PDF or import it first.`);
      const docs=await pack.getDocuments();projected.set(config.name,docs.map(doc=>doc.toObject()));
      state.push({name:config.name,exists:true,documents:docs.map(doc=>({id:doc.id,value:doc.toObject()})).sort((a,b)=>a.id.localeCompare(b.id))});
    }
    validateCreation({...bundle.creation,equipment:projected.get(PACKS[0].name),traits:projected.get(PACKS[2].name),monsters:projected.get(PACKS[3].name)});
  }
  const previous=stored(),signature=fingerprint({state,previous,packs,creation:bundle.creation,forceOverwrite});
  return {forceOverwrite,bundle:clone(bundle),packs,rows,signature,previous,creation:Boolean(bundle.creation),folderAssignments:packs.reduce((n,p)=>n+(p.folderAssignments?.length??0),0),counts:Object.fromEntries(['create','update','unchanged','preserve'].map(action=>[action,rows.filter(r=>r.action===action).length]))};
}

function validateCreation(content){
  if(content.backgrounds.length!==36||content.connections.length!==10)throw new Error('Character creation requires all 36 backgrounds and 10 connection benefits.');
  const unique=(entries,name,type,tree)=>{
    const matches=entries.filter(e=>e.name===name&&e.type===type&&(!tree||e.system.tree===tree));
    if(matches.length!==1)throw new Error(`Character creation: ${matches.length?'ambiguous':'missing'} ${type} ${name}.`);
  };
  for(const b of content.backgrounds){
    for(const item of b.startingKit)unique(content.equipment,item.name,'equipment');
    unique(content.traits,b.trait.name,'trait',b.trait.tree);
    for(const pet of b.pets)unique(content.monsters,pet,'monster');
  }
}

async function creationSnapshot(creation){
  const creatorSource=value=>{
    const data=clone(value);for(const key of ['_id','_stats','folder','ownership','sort'])delete data[key];
    if(data.flags?.[SYSTEM]){delete data.flags[SYSTEM].importSource;if(!Object.keys(data.flags[SYSTEM]).length)delete data.flags[SYSTEM];}
    if(data.items)data.items=data.items.map(creatorSource);return data;
  };
  const read=async name=>{const pack=game.packs.get(`world.${name}`);if(!pack)throw new Error(`Missing ${name}; import equipment, traits and creatures before publishing character creation.`);return (await pack.getDocuments()).map(doc=>creatorSource(doc.toObject()));};
  const [equipment,traits,allMonsters]=await Promise.all([read('crows-equipment'),read('crows-traits'),read('crows-bestiary')]);
  const pets=new Set(creation.backgrounds.flatMap(b=>b.pets));
  const content={...clone(creation),equipment,traits,monsters:allMonsters.filter(actor=>pets.has(actor.name))};
  validateCreation(content);return content;
}

/** Explicit user action. Recheck the review, then use the system's guarded importer. */
export async function executeImport(review,{adapter,signal,onProgress=()=>{},onEntry=()=>{}}={}){
  requireGM();adapter??=await systemAdapter();
  if(adapter.CrowsContentImport.busy)throw new Error('An import is already running.');
  adapter.CrowsContentImport.busy=true;
  const results=[];let published=false;
  const checkpoint=()=>{requireGM();if(signal?.aborted)throw new DOMException('Import cancelled. Completed writes have been kept.','AbortError');};
  try{
    checkpoint();const current=await prepareImport(review.bundle,{adapter,forceOverwrite:review.forceOverwrite});
    if(current.signature!==review.signature)throw new Error('World content changed since the review. Review the import again.');
    for(const {config,data,folderAssignments} of current.packs){
      checkpoint();const result={label:config.label,created:0,updated:0,unchanged:0,preserved:[]};results.push(result);
      let index=-1,active=null,before=null;
      const counts=()=>({created:result.created,updated:result.updated,unchanged:result.unchanged,preserved:result.preserved.length});
      const finishEntry=()=>{
        if(!active)return;
        const after=counts(),status=Object.keys(after).find(key=>after[key]>before[key]);
        onEntry({...active,status});active=null;
      };
      try{
        await adapter.CrowsContentImport.importPack(config,data,result,text=>{
          // The system reports each entry BEFORE processing it. Reaching the next
          // callback confirms the previous entry, including its tracking flag,
          // finished successfully. This also works with existing system releases.
          finishEntry();checkpoint();
          const raw=data[++index];
          active={id:`${config.name}:${adapter.sourceKey(raw)}`,name:raw.name};before=counts();
          onEntry({...active,status:'importing'});onProgress(text);
        },{forceOverwrite:current.forceOverwrite});
        finishEntry();
        if(isBestiary(config)){
          result.filed=0;
          try{
            await organizeBestiary(game.packs.get(`world.${config.name}`),folderAssignments,{sourceKey:adapter.sourceKey,checkpoint,onProgress,onFiled:()=>result.filed++});
          }catch(error){
            if(error.name==='AbortError')throw error;
            throw new Error(`Bestiary folder organization stopped: ${error.message}`,{cause:error});
          }
        }
      }catch(error){
        if(active)onEntry({...active,status:'failed',message:error.message});
        throw error;
      }
    }
    if(current.bundle.creation){
      checkpoint();onProgress('Checking and publishing character-creation data…');
      const content=await creationSnapshot(current.bundle.creation);
      checkpoint();if(fingerprint(stored())!==fingerprint(current.previous))throw new Error('Character-creation data changed during import. Review again before publishing.');
      await game.settings.set(SCOPE,'characterContent',{schemaVersion:1,content});published=true;
    }
    return {results,published};
  }catch(error){error.importReport={results,published};throw error;}
  finally{adapter.CrowsContentImport.busy=false;}
}

/** Read-only published snapshot, including only the creatures needed as pets. */
export async function getCharacterContent(){
  const saved=stored();if(!saved)return null;
  if(saved.schemaVersion!==1||!saved.content)throw new Error('Unsupported imported character-creation data. Re-import the packet.');
  return clone(saved.content);
}
