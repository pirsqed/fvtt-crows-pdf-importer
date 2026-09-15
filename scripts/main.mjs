import {openPacketPreview} from './packet-preview.mjs';
import {getCharacterContent} from './import-content.mjs';

export const MODULE_ID='fvtt-crows-pdf-importer';

Hooks.once('init',()=>{
  const module=game.modules.get(MODULE_ID);
  game.settings.register(MODULE_ID,'characterContent',{scope:'world',config:false,type:Object,default:null});
  module.api=Object.freeze({
    getCharacterContent,
    open(){
      if(!game.user?.isGM){ui.notifications.warn('Only the GM can open the Crows PDF Importer.');return;}
      if(game.system.id!=='fvtt-crows-system'){ui.notifications.warn('Enable the Crows system to use this importer.');return;}
      return openPacketPreview();
    }
  });
});
