import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('module initializes its guarded preview API without opening a dialog',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../module.json',import.meta.url),'utf8'));
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(manifest.id,pkg.name);assert.equal(manifest.version,pkg.version);
  for(const script of manifest.esmodules)await readFile(new URL('../'+script,import.meta.url));
  const module={},warnings=[];let initialize;
  globalThis.Hooks={once(event,callback){assert.equal(event,'init');initialize=callback;}};
  globalThis.game={modules:new Map([[manifest.id,module]]),system:{id:'fvtt-crows-system'},user:{isGM:false},settings:{register(scope,key,options){assert.equal(scope,manifest.id);assert.equal(key,'characterContent');assert.equal(options.scope,'world');assert.equal(options.config,false);}}};
  globalThis.ui={notifications:{warn(message){warnings.push(message);}}};
  try{
    await import('../scripts/main.mjs');assert.equal(module.api,undefined);
    initialize();assert.equal(typeof module.api.open,'function');
    module.api.open();assert.match(warnings.pop(),/Only the GM/);
    game.user.isGM=true;game.system.id='another-system';module.api.open();assert.match(warnings.pop(),/Crows system/);
  }finally{delete globalThis.Hooks;delete globalThis.game;delete globalThis.ui;}
});
