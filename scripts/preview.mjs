import {styleImport} from './import-ui.mjs';
import {validateItemPreview} from './item-mapper.mjs';
// A DOM-only preview: compatible with Foundry's restriction on package HTML.
export function openPreview(){
  const dialog=document.createElement('dialog');
  styleImport(dialog);
  // Static markup only; extracted PDF content is always displayed as text.
  dialog.innerHTML=`<header>
      <p class="eyebrow"><span>⚙️</span> Developer Tool · Single-Page Inspector</p>
      <h1>Crows PDF Importer — extraction preview</h1>
      <p class="subtitle">Choose a local PDF to inspect page extraction, card geometry, and field mapping without modifying your world.</p>
    </header>
    <form style="background:rgba(15,23,42,0.65);padding:18px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);margin:16px 0">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:14px">
        <label style="display:flex;flex-direction:column;gap:6px;font-weight:600">
          <span>Target PDF</span>
          <input data-id="file" type="file" accept=".pdf,application/pdf" required>
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;font-weight:600">
          <span>Layout Kind</span>
          <select data-id="kind"><option value="cards">Inventory cards</option><option value="traits">Trait tree</option></select>
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;font-weight:600">
          <span>Card Set</span>
          <select data-id="source"><option value="core">Core inventory</option><option value="profession">Profession inventory</option><option value="poi">POIs and dungeons</option></select>
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;font-weight:600">
          <span>PDF Page Number</span>
          <input data-id="page" type="number" min="1" step="1" value="1" required>
        </label>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="primary" data-id="run" type="submit">⚡ Extract page</button>
        <button data-id="cancel" type="button" disabled>✕ Cancel</button>
        <button data-id="close" type="button">Close preview</button>
      </div>
    </form>
    <p data-id="status" role="status">Ready. Uses Foundry’s bundled PDF.js.</p>
    <p data-id="validation"></p>
    <div data-id="items"></div>
    <pre data-id="result"></pre>`;
  const $=id=>dialog.querySelector(`[data-id="${id}"]`);
  $('file').onchange=()=>{const name=$('file').files[0]?.name??'';$('source').value=/profession/i.test(name)?'profession':/poi|dungeon/i.test(name)?'poi':'core';};
  $('kind').onchange=()=>{$('source').disabled=$('kind').value!=='cards';};
  let worker=null,timer=null;
  const stop=()=>{worker?.terminate();worker=null;clearTimeout(timer);$('run').disabled=false;$('cancel').disabled=true;};
  $('close').onclick=()=>dialog.close();$('cancel').onclick=()=>{stop();$('status').textContent='Cancelled.';$('status').className='';};
  const pagehide=()=>dialog.close();window.addEventListener('pagehide',pagehide,{once:true});
  dialog.addEventListener('close',()=>{stop();window.removeEventListener('pagehide',pagehide);dialog.remove();});
  dialog.querySelector('form').onsubmit=async event=>{
    event.preventDefault();stop();$('run').disabled=true;$('cancel').disabled=false;$('result').textContent='';$('status').textContent='Reading PDF…';$('status').className='';
    $('items').replaceChildren();$('validation').textContent='';$('validation').className='';
    const file=$('file').files[0],page=Number($('page').value),kind=$('kind').value,source=$('source').value;
    const started=performance.now();let current;
    try{
      current=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});worker=current;
      const fail=message=>{if(worker!==current)return;stop();$('status').textContent=message;$('status').className='status-warn';};
      timer=setTimeout(()=>fail('Extraction timed out. Check access to Foundry’s bundled PDF.js and worker.'),30000);
      current.onerror=e=>fail(`Could not load extraction worker: ${e.message}`);
      current.onmessage=({data})=>{
        if(worker!==current)return;
        if(data.error){fail(data.error);return;}
        stop();$('status').textContent=`Extracted ${data.result.records.length} records in ${((performance.now()-started)/1000).toFixed(2)} seconds with PDF.js ${data.version}.`;
        $('status').className='status-success';
        const validation=kind==='cards'?validateItemPreview(data.result.documents):null;
        if(validation){
          $('validation').textContent=validation.status==='passed'?`${validation.checked} proposed Items passed Foundry validation. Nothing has been imported.`:validation.status==='failed'?`Item validation failed: ${validation.errors.map(e=>`${e.name}: ${e.message}`).join('; ')}`:validation.message;
          if(validation.status==='passed')$('validation').className='status-success';
          else if(validation.status==='failed')$('validation').className='status-warn';
          const table=document.createElement('table');
          const addRow=(values,header=false)=>{const row=table.insertRow();for(const value of values){const cell=document.createElement(header?'th':'td');cell.textContent=String(value);row.append(cell);}};
          addRow(['Proposed Item','Kind','Cost (gc)','Stack','Institution tier'],true);
          for(const item of data.result.documents){const s=item.system;addRow([item.name,s.isSpellbook?'Spellbook':s.isWeapon?'Weapon':s.isArmor?'Armor':s.contentsType?'Supply':s.isConsumable?'Consumable':'Equipment',s.cost,s.maxStack,item.flags['fvtt-crows-pdf-importer'].crafting?.institution_tier??'—']);}
          $('items').append(table);
        }
        const result=kind==='cards'?{documents:data.result.documents,validation,parsedCards:data.result.parsedCards,...data.result}:data.result;
        $('result').textContent=JSON.stringify(result,null,2);
      };
      const bytes=await file.arrayBuffer();if(worker!==current)return;
      // Based on the module URL, so a Foundry reverse-proxy prefix is retained.
      const baseURL=new URL('../../../scripts/pdfjs/',import.meta.url).href;
      $('status').textContent='Extracting page…';
      current.postMessage({bytes,page,kind,source,baseURL},[bytes]);
    }catch(error){if(!current || worker===current){stop();$('status').textContent=error.message;$('status').className='status-warn';}}
  };
  document.body.append(dialog);dialog.showModal();return dialog;
}
