import * as adapter from '../../fvtt-crows-system/module/import-content.mjs';
export {adapter};

export function setupImport(){
  let id=0,saved=null;const writes=[];
  const makeDoc=source=>{
    let data=structuredClone(source);data._id??=String(++id).padStart(16,'0');
    return {get id(){return data._id;},get name(){return data.name;},get type(){return data.type;},get system(){return data.system;},get img(){return data.img;},
      get items(){return (data.items??[]).map((item,i)=>({id:item._id??String(i)}));},
      get results(){return data.results?.map((result,i)=>({...result,id:result._id??String(i)}));},
      async deleteEmbeddedDocuments(type,ids){writes.push(['deleteEmbedded',this.id]);data[type==='TableResult'?'results':'items']=[];},
      async createEmbeddedDocuments(type,items){writes.push(['createEmbedded',this.id]);data[type==='TableResult'?'results':'items']=structuredClone(items);},
      getFlag(scope,key){return data.flags?.[scope]?.[key];},toObject(){return structuredClone(data);},
      async update(value){writes.push(['update',this.id]);data={...data,...structuredClone(value)};return this;},
      async setFlag(scope,key,value){writes.push(['flag',this.id]);data.flags??={};data.flags[scope]??={};data.flags[scope][key]=structuredClone(value);},
      edit(fn){fn(data);}
    };
  };
  const packs=new Map();
  const makePack=(name,type,entries=[])=>{
    const docs=entries.map(makeDoc),pack={collection:'world.'+name,documentName:type,locked:false,docs,
      async getDocuments(){return [...docs];},documentClass:{async createDocuments(data){writes.push(['create',name]);const result=data.map(makeDoc);docs.push(...result);return result;}}};
    packs.set(pack.collection,pack);return pack;
  };
  globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},system:{id:'fvtt-crows-system'},packs,
    settings:{get(){return structuredClone(saved);},async set(scope,key,value){writes.push(['setting',key]);saved=structuredClone(value);}}};
  globalThis.foundry={utils:{deepClone:structuredClone}};
  globalThis.CONFIG={Item:{dataModels:{equipment:{},trait:{}}},Actor:{dataModels:{monster:{}}}};
  globalThis.Item=globalThis.Actor=class{constructor(source){this.source=source;if(source.system.invalid)throw new Error('Invalid test field');}validate(){return true;}};
  globalThis.RollTable=class{constructor(source){if(!source.results.length||source.results.some(r=>r.range[0]>r.range[1]))throw new Error('Invalid table results');}validate(){return true;}};
  globalThis.CompendiumCollection={async createCompendium({name,type}){writes.push(['pack',name]);return makePack(name,type);}};
  adapter.CrowsContentImport.busy=false;
  return {writes,makeDoc,makePack,packs,get saved(){return saved;}};
}
