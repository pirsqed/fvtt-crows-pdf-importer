import {openPreview} from './preview.mjs';

export const MODULE_ID='fvtt-crows-pdf-importer';

Hooks.once('init',()=>{
  const module=game.modules.get(MODULE_ID);
  module.api=Object.freeze({
    open(){
      if(!game.user?.isGM){ui.notifications.warn('Only the GM can open the Crows PDF Importer.');return;}
      if(game.system.id!=='fvtt-crows-system'){ui.notifications.warn('Enable the Crows system to use this importer.');return;}
      return openPreview();
    }
  });
});
