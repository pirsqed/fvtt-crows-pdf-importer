/** Folders live inside the world Bestiary compendium, not the Actor sidebar. */
export const BESTIARY_FOLDERS=[
  ['Animal'],['Human'],['Monster'],['Unique'],
  ...['Blood','Undead','Plant','Demon','Angel'].map(name=>['Monster',name])
];
export const isBestiary=config=>config.type==='Actor'&&config.name==='crows-bestiary';
export function npcFolderPath(actor){
  const type=String(actor.system?.type??'').trim().toLowerCase();
  // TODO: Add Monster / Elemental when more Elemental creatures are introduced.
  if(type==='elemental')return ['Unique'];
  return BESTIARY_FOLDERS.find(path=>path.at(-1).toLowerCase()===type)??['Monster'];
}
export function isElementalInMonster(actor,folders){
  if(String(actor?.system?.type??'').trim().toLowerCase()!=='elemental')return false;
  const folder=folders.find(f=>f._id===actor.toObject().folder);
  return folder?.type==='Actor'&&folder.name==='Monster'&&!folder.folder;
}
export function bestiaryFolderSnapshot(pack){
  return [...(pack?.folders?.values()??[])].map(folder=>folder.toObject()).sort((a,b)=>a._id.localeCompare(b._id));
}
function matchingFolder(folders,path,parent){
  const matches=folders.filter(f=>f.type==='Actor'&&f.name===path.at(-1)&&(f.folder??null)===parent);
  if(matches.length>1)throw new Error(`Bestiary has multiple ${path.join(' / ')} folders. Rename or combine them before importing.`);
  return matches[0];
}
/** Read-only: also detect ambiguous existing folders before saving any content. */
export function checkBestiaryFolders(pack){
  const folders=bestiaryFolderSnapshot(pack),ids=new Map();
  for(const path of BESTIARY_FOLDERS){
    const parent=path.length>1?ids.get(path.slice(0,-1).join('/')):null;
    if(path.length>1&&!parent)continue;
    const match=matchingFolder(folders,path,parent);
    if(match)ids.set(path.join('/'),match._id);
  }
  return folders;
}

/** Apply reviewed folder-only assignments, including preserved Actors. */
export async function organizeBestiary(pack,assignments,{sourceKey,checkpoint,onProgress,onFiled=()=>{}}){
  const FolderClass=globalThis.foundry?.utils?.getDocumentClass?.('Folder')??globalThis.Folder;
  if(!FolderClass?.createDocuments)throw new Error('Foundry Folder documents are unavailable.');
  const folders=checkBestiaryFolders(pack),ids=new Map();
  for(const [index,path] of BESTIARY_FOLDERS.entries()){
    checkpoint();
    const parent=path.length>1?ids.get(path.slice(0,-1).join('/')):null;
    let folder=matchingFolder(folders,path,parent);
    if(!folder){
      onProgress(`Bestiary: creating ${path.join(' / ')}`);
      const [created]=await FolderClass.createDocuments([{name:path.at(-1),type:'Actor',folder:parent,sorting:'a',sort:(index+1)*100000}],{pack:pack.collection});
      if(!created?.id)throw new Error(`Could not create Bestiary folder ${path.join(' / ')}.`);
      folder=created.toObject();folders.push(folder);
    }
    ids.set(path.join('/'),folder._id);
  }
  if(!assignments.length)return;
  checkpoint();const actors=await pack.getDocuments();
  for(const assignment of assignments){
    checkpoint();
    const matches=actors.filter(actor=>assignment.actorId?actor.id===assignment.actorId:sourceKey(actor)===assignment.key);
    if(matches.length!==1)throw new Error(`${assignment.name}: the Actor changed during folder organization. Review and retry.`);
    const actor=matches[0];
    // Respect any manual move made while the import was running as well.
    if((actor.toObject().folder??null)!==(assignment.fromFolder??null))continue;
    onProgress(`Bestiary: filing ${actor.name} in ${assignment.path.join(' / ')}`);
    await actor.update({folder:ids.get(assignment.path.join('/'))});
    onFiled();
  }
}
