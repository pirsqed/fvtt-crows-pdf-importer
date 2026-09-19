import {styleImport} from './import-ui.mjs';
import {CARD_SETS,discoverPacket,reviewPacket,extractPacket} from './packet.mjs';
import {validateItemPreview} from './item-mapper.mjs';
import {openPreview} from './preview.mjs';
import {validateActorPreview} from './npc-parser.mjs';
import {openImportReview} from './import-review.mjs';

export function openPacketPreview(){
  const dialog=document.createElement('dialog');
  styleImport(dialog);
  dialog.innerHTML=`<header>
      <p class="eyebrow"><span>⚡</span> Crows · Playtest Library</p>
      <h1>Bring your books to the table</h1>
      <p class="subtitle">Choose your packet, extract its content, and select what to bring into your world compendiums.</p>
    </header>
    <section>
      <h2><span class="step-number">1</span> Choose your PDFs</h2>
      <div class="pickers">
        <label class="picker" data-picker="folder">
          <span class="picker-icon">📁</span>
          <span class="picker-title">Packet folder</span>
          <small>Select the root playtest folder (includes PDFs in subfolders).</small>
          <input data-id="folder" type="file" webkitdirectory multiple>
        </label>
        <label class="picker" data-picker="files">
          <span class="picker-icon">📚</span>
          <span class="picker-title">Individual PDFs</span>
          <small>Choose one or several Crows book PDFs directly.</small>
          <input data-id="files" type="file" accept=".pdf,application/pdf" multiple>
        </label>
      </div>
      <p data-id="discovery" role="status">Choose a folder or PDFs to begin.</p>
      <div data-id="assignments"></div>
      <p data-id="review"></p>
    </section>
    <section>
      <h2><span class="step-number">2</span> Extract your content</h2>
      <p>Extracts inventory, creatures, rollable tables, traits, backgrounds, and NPC connection benefits. You will review and filter all entries before saving.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0">
        <button class="primary" data-id="extract" type="button" disabled>⚡ Extract selected PDFs</button>
        <button data-id="abort" type="button" disabled>✕ Cancel extraction</button>
      </div>
      <p data-id="packet-status" role="status"></p>
      <progress data-id="progress" value="0" max="1" hidden></progress>
      <p data-id="packet-validation"></p>
      <div data-id="kpi-dashboard" class="kpi-grid" hidden></div>
      <details><summary>Extraction results breakdown</summary><div data-id="file-results"></div></details>
    </section>
    <details><summary>Developer tools &amp; extraction data</summary>
      <button data-id="single" type="button">Single-page tools</button>
      <pre data-id="packet-result"></pre>
    </details>
    <footer class="actions">
      <button data-id="close-packet" type="button">Close</button>
      <button class="primary" data-id="open-import" type="button" disabled>Choose entries &amp; review →</button>
    </footer>`;

  const $=id=>dialog.querySelector(`[data-id="${id}"]`);
  let entries=[],controller=null,closed=false,lastReport=null;

  for(const picker of dialog.querySelectorAll('.picker')){
    picker.addEventListener('dragover',e=>{e.preventDefault();picker.classList.add('dragover');});
    picker.addEventListener('dragleave',()=>picker.classList.remove('dragover'));
    picker.addEventListener('drop',e=>{
      e.preventDefault();picker.classList.remove('dragover');
      if(e.dataTransfer?.files?.length){
        const input=picker.querySelector('input[type=file]');
        input.files=e.dataTransfer.files;
        input.dispatchEvent(new Event('change'));
      }
    });
  }

  $('open-import').onclick=()=>{if(lastReport)openImportReview(lastReport);};

  const clear=()=>{
    lastReport=null;
    $('open-import').disabled=true;
    $('packet-status').textContent='';
    $('packet-status').className='';
    $('packet-validation').textContent='';
    $('packet-validation').className='';
    $('packet-result').textContent='';
    $('file-results').replaceChildren();
    $('progress').hidden=true;
    const kpi=$('kpi-dashboard');
    if(kpi){kpi.hidden=true;kpi.replaceChildren();}
  };

  const review=()=>{
    const result=reviewPacket(entries);
    $('review').textContent=result.errors.length?result.errors.join(' '):`${result.selected.length} PDF(s) selected.${result.missing.length?' Not selected: '+result.missing.map(key=>CARD_SETS[key]).join(', ')+'. You can extract a partial packet.':''}`;
    $('extract').disabled=Boolean(controller)||!result.selected.length||Boolean(result.errors.length);
  };

  const busy=value=>{
    for(const control of dialog.querySelectorAll('input,select,[data-id="single"]'))control.disabled=value;
    $('abort').disabled=!value;review();
  };

  const choose=files=>{
    if(controller)return;
    clear();entries=discoverPacket(files);$('assignments').replaceChildren();
    $('discovery').textContent=`Found ${entries.length} PDFs in ${files.length} selected files. Check the assignments before extracting.`;
    for(const entry of entries){
      const row=document.createElement('div');row.className='assignment';
      const label=document.createElement('label');
      label.textContent=entry.path+' ';
      const select=document.createElement('select');select.setAttribute('aria-label',`Content type for ${entry.path}`);
      for(const [value,text] of [['','Skip'],...Object.entries(CARD_SETS)]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
      select.value=entry.source;select.onchange=()=>{entry.source=select.value;clear();review();};
      const note=document.createElement('small');note.textContent=' '+entry.reason;
      label.append(select);row.append(label,note);$('assignments').append(row);
    }
    review();
  };

  $('folder').onchange=()=>{$('files').value='';choose([...$('folder').files]);};
  $('files').onchange=()=>{$('folder').value='';choose([...$('files').files]);};
  $('abort').onclick=()=>controller?.abort();
  $('close-packet').onclick=()=>{for(const d of document.querySelectorAll('dialog.crows-import-ui'))d.close();};
  $('single').onclick=()=>{dialog.close();openPreview();};
  const pagehide=()=>dialog.close();window.addEventListener('pagehide',pagehide,{once:true});
  dialog.addEventListener('close',()=>{closed=true;controller?.abort();window.removeEventListener('pagehide',pagehide);dialog.remove();});

  $('extract').onclick=async()=>{
    if(controller)return;
    clear();const current=new AbortController();controller=current;busy(true);$('progress').hidden=false;
    try{
      const report=await extractPacket(entries,{signal:current.signal,onProgress:progress=>{
        if(closed||current.signal.aborted)return;
        $('packet-status').textContent=`PDF ${progress.index}/${progress.files}: ${progress.file} — ${progress.total?`page ${progress.page}/${progress.total}`:'reading…'}`;
        $('progress').max=progress.files;$('progress').value=progress.index-1+(progress.total?progress.page/progress.total:0);
      }});
      if(closed||current.signal.aborted)return;
      report.validation=report.documents.length?validateItemPreview(report.documents):{status:'unavailable',message:'No proposed Items to validate.'};
      report.actorValidation=report.actors.length?validateActorPreview(report.actors):null;
      report.tableValidation=validateTablePreview(report.tables);
      const counts=new Map();for(const actor of report.actors)counts.set(actor.system.type,(counts.get(actor.system.type)??0)+1);
      report.actorCounts=Object.fromEntries(counts);
      $('packet-status').textContent=`${report.errors.length?'Finished with errors':report.backgroundIssues.length?'Finished with unresolved starting kits':'Extraction complete'}: ${report.files.length} PDFs, ${report.files.reduce((sum,file)=>sum+file.pages.length,0)} pages, ${report.documents.length} proposed Items, ${report.actors.length} proposed NPC Actors, ${report.tables.length} rollable tables, ${report.backgrounds.length} ready backgrounds, ${report.connections.length} NPC connection benefits. Repeated cards are resolved in the import review. Extraction itself does not save content.`;
      $('packet-status').className=report.errors.length||report.backgroundIssues.length?'status-warn':'status-success';

      const v=report.validation;
      $('packet-validation').textContent=v.status==='passed'?`${v.checked} Items passed Foundry validation.`:v.status==='failed'?`Validation failed: ${v.errors.map(e=>`${e.name}: ${e.message}`).join('; ')}`:v.message;
      const av=report.actorValidation;if(av)$('packet-validation').textContent+=' '+(av.status==='passed'?`${av.checked} NPC Actors passed Foundry validation.`:av.status==='failed'?`Actor validation failed: ${av.errors.map(e=>`${e.name}: ${e.message}`).join('; ')}`:av.message);
      const tv=report.tableValidation;if(tv)$('packet-validation').textContent+=' '+(tv.status==='passed'?`${tv.checked} RollTables passed Foundry validation.`:tv.status==='failed'?`Table validation failed: ${tv.errors.map(e=>`${e.name}: ${e.message}`).join('; ')}`:tv.message);
      if(v.status==='passed'&&(av?.status==='passed'||!av))$('packet-validation').className='status-success';

      const kpi=$('kpi-dashboard');
      if(kpi){
        kpi.hidden=false;
        kpi.innerHTML=`
          <div class="kpi-card"><div class="kpi-value">${report.documents.length}</div><div class="kpi-label">Proposed Items</div></div>
          <div class="kpi-card"><div class="kpi-value">${report.actors.length}</div><div class="kpi-label">NPC Bestiary</div></div>
          <div class="kpi-card"><div class="kpi-value">${report.tables.length}</div><div class="kpi-label">Rollable Tables</div></div>
          <div class="kpi-card"><div class="kpi-value">${report.documents.filter(d=>d.type==='trait').length}</div><div class="kpi-label">Traits &amp; Paths</div></div>
          <div class="kpi-card"><div class="kpi-value">${report.backgrounds.length}</div><div class="kpi-label">Ready Backgrounds</div></div>
          <div class="kpi-card"><div class="kpi-value">${report.connections.length}</div><div class="kpi-label">Connection Benefits</div></div>
          <div class="kpi-card"><div class="kpi-value">${report.files.reduce((sum,file)=>sum+file.pages.length,0)}</div><div class="kpi-label">Pages Scanned</div></div>
        `;
      }

      for(const file of report.files){const p=document.createElement('p');const empty=['ref','characters'].includes(file.source)?[]:file.pages.filter(page=>!page.cards).map(page=>page.page);p.textContent=`${file.path}: ${file.source==='ref'?file.npcs+' NPCs':file.source==='characters'?file.traits+' traits, '+report.characterData.backgrounds.length+' backgrounds, '+report.connections.length+' connection benefits':file.cards+' cards'} from ${file.pages.length} pages.${empty.length?' No cards on pages '+empty.join(', ')+'.':''}`;$('file-results').append(p);}
      for(const issue of report.backgroundIssues){const p=document.createElement('p');p.textContent='Starting kits need attention: '+issue;$('file-results').append(p);}
      if(report.tables.length){const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent=`Ref Tables (${report.tables.length})`;detail.append(summary);for(const table of report.tables){const p=document.createElement('p');p.textContent=`${table.name}: ${table.formula}, ${table.results.length} results`;detail.append(p);}for(const note of report.tableWarnings){const p=document.createElement('p');p.textContent=note;detail.append(p);}$('file-results').append(detail);}
      for(const [heading,values] of [['Backgrounds',report.backgrounds.map(b=>`${b.roll}: ${b.name} — ${b.trait.tree}: ${b.trait.name}`)],['NPC connection benefits',report.connections.map(c=>c.name)]]){
        if(!values.length)continue;const detail=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('p');summary.textContent=heading;body.textContent=values.join('; ');detail.append(summary,body);$('file-results').append(detail);
      }
      if(report.actors.length){const summary=document.createElement('p');summary.textContent='Creature types: '+[...counts].map(([type,count])=>`${type}: ${count}`).join(', ');$('file-results').append(summary);const list=document.createElement('ul');for(const actor of report.actors){const row=document.createElement('li');row.textContent=`${actor.name} — ${actor.system.type}, Power ${actor.system.power}, Stamina ${actor.system.stamina.max}, ${actor.items.filter(item=>item.type==='attack').length} attacks, ${actor.items.filter(item=>item.type==='trait').length} traits`;list.append(row);}$('file-results').append(list);}
      for(const error of report.errors){const p=document.createElement('p');p.textContent=`Failed — ${error.path}: ${error.message}`;$('file-results').append(p);}
      $('packet-result').textContent=JSON.stringify(report,null,2);
      lastReport=report;$('open-import').disabled=Boolean(report.errors.length||report.backgroundIssues.length||report.validation.status==='failed'||report.actorValidation?.status==='failed'||report.tableValidation?.status==='failed'||!globalThis.game?.user?.isGM);
    }catch(error){if(!closed)$('packet-status').textContent=error.name==='AbortError'?'Cancelled. No results kept; choose Extract to retry.':error.message;}
    finally{if(controller===current)controller=null;if(!closed){$('progress').hidden=true;busy(false);}}
  };
  document.body.append(dialog);dialog.showModal();return dialog;
}

function validateTablePreview(tables){
  if(!tables.length)return null;
  if(!globalThis.RollTable)return {status:'unavailable',message:'RollTable validation is available inside Foundry.'};
  const errors=[];
  for(const table of tables)try{const doc=new RollTable(structuredClone(table),{strict:true});if(doc.validate({strict:true})===false)throw new Error('Document validation failed.');}catch(error){errors.push({name:table.name,message:error.message});}
  return {status:errors.length?'failed':'passed',checked:tables.length,errors};
}
