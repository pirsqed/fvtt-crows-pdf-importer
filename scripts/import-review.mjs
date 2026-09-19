import {styleImport} from './import-ui.mjs';
import {resolveImport,prepareImport,executeImport} from './import-content.mjs';

export function openImportReview(report){
  const dialog=document.createElement('dialog');
  styleImport(dialog);
  dialog.innerHTML=`<header>
      <p class="eyebrow"><span>⚔️</span> Crows · Import into your world</p>
      <h1>Build your playtest library</h1>
      <p class="subtitle">Select the entries you want, verify world differences, and commit them directly into your compendiums. Selections are preserved when searching or filtering.</p>
    </header>
    <section>
      <h2><span class="step-number">1</span> Choose entries</h2>
      <p data-id="dedup-summary"></p>
      <div data-id="conflicts"></div>
      <div class="filter-bar">
        <input data-id="search" type="search" placeholder="Search entries…" aria-label="Search entries">
        <select data-id="category" aria-label="Filter by category"><option value="">All categories</option></select>
        <button data-id="select-all" type="button">Select visible</button>
        <button data-id="select-none" type="button">Deselect visible</button>
      </div>
      <div class="entry-list" data-id="entry-list"></div>
      <p data-id="selection-count"></p>
    </section>
    <section>
      <h2><span class="step-number">2</span> Import options</h2>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="background:rgba(15,23,42,0.7);padding:14px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
          <label style="font-weight:600;display:flex;align-items:center;gap:10px;color:#f1f5f9;cursor:pointer">
            <input type="checkbox" data-id="publish-creator" checked> Update character-creation content
          </label>
          <p style="margin:6px 0 0 28px;font-size:12.5px;color:#94a3b8">Publishes backgrounds, NPC connections, and starting kits. Required equipment, traits, and pets must be selected or already available in the world.</p>
        </div>
        <div style="background:rgba(15,23,42,0.7);padding:14px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
          <label style="font-weight:600;display:flex;align-items:center;gap:10px;color:#f1f5f9;cursor:pointer">
            <input type="checkbox" data-id="force-overwrite"> Force overwrite existing entries
          </label>
          <p style="margin:6px 0 0 28px;font-size:12.5px;color:#94a3b8">By default, local edits are preserved. Force overwrite replaces imported fields and Actor embedded Items. Artwork and parent IDs remain; ambiguous matches stay preserved.</p>
        </div>
      </div>
    </section>
    <section>
      <h2><span class="step-number">3</span> Review changes</h2>
      <p data-id="import-status" role="status">Check the world to see what will be added, updated or preserved.</p>
      <div data-id="import-changes"></div>
    </section>
    <footer class="actions">
      <button data-id="close-import" type="button">Back to PDFs</button>
      <button data-id="cancel-import" type="button" disabled>✕ Stop after current entry</button>
      <button data-id="review-import" type="button">🔍 Check world and review changes</button>
      <button class="primary" data-id="save-import" type="button" disabled>💾 Import selected entries</button>
      <button data-id="finish-import" class="btn-finish" type="button">✓ Finish</button>
    </footer>`;

  const $=id=>dialog.querySelector(`[data-id="${id}"]`),choices={};let review=null,controller=null,busy=false,closed=false;
  const excluded=new Set(),entryKey=(pack,doc)=>`${pack.config.name}:${doc.type}:${doc.name}:${doc.system?.tree??''}`;
  const invalidate=()=>{review=null;$('save-import').disabled=true;$('import-changes').replaceChildren();$('import-status').textContent='Check the world to review your current selection.';$('import-status').className='';};
  $('force-overwrite').onchange=()=>{invalidate();$('import-status').textContent='Import mode changed. Check world and review changes again.';};
  const selectedBundle=()=>{
    const bundle=resolveImport(report,choices);
    bundle.packs=bundle.packs.map(pack=>({...pack,data:pack.data.filter(doc=>!excluded.has(entryKey(pack,doc)))})).filter(pack=>pack.data.length);
    if(!$('publish-creator').checked)bundle.creation=null;
    return bundle;
  };
  const updateSelection=()=>{
    const bundle=selectedBundle(),count=bundle.packs.reduce((n,p)=>n+p.data.length,0);
    $('selection-count').textContent=`${count} entries selected. Search and category filters only change what is shown.`;
    $('review-import').disabled=busy||!count||Boolean(bundle.unresolved.length);
  };
  const filterEntries=()=>{for(const row of $('entry-list').children)row.hidden=Boolean(($('category').value&&row.dataset.category!==$('category').value)||!row.dataset.name.includes($('search').value.toLowerCase()));};
  $('search').oninput=filterEntries;$('category').onchange=filterEntries;
  for(const [id,select] of [['select-all',true],['select-none',false]])$(id).onclick=()=>{
    if(busy)return;
    for(const row of $('entry-list').children)if(!row.hidden){const checkbox=row.querySelector('input');checkbox.checked=select;if(select)excluded.delete(row.dataset.key);else excluded.add(row.dataset.key);}
    invalidate();updateSelection();
  };
  $('publish-creator').disabled=!resolveImport(report).creation;
  $('publish-creator').checked=Boolean(resolveImport(report).creation);
  $('publish-creator').onchange=()=>{invalidate();updateSelection();};
  const renderChoices=()=>{
    const bundle=resolveImport(report,choices);
    $('dedup-summary').textContent=`${bundle.repeated} repeated copies combined. Core inventory takes precedence over profession copies.`;
    $('entry-list').replaceChildren();
    const category=$('category').value;$('category').innerHTML='<option value="">All categories</option>';
    for(const pack of bundle.packs){
      const option=document.createElement('option');option.value=pack.config.name;option.textContent=`${pack.config.label} (${pack.data.length})`;$('category').append(option);
      for(const doc of [...pack.data].sort((a,b)=>a.name.localeCompare(b.name))){
        const row=document.createElement('label');row.className='entry';row.dataset.category=pack.config.name;row.dataset.name=doc.name.toLowerCase();row.dataset.key=entryKey(pack,doc);
        const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=!excluded.has(row.dataset.key);checkbox.disabled=busy;
        const name=document.createElement('span');name.textContent=doc.name;const kind=document.createElement('small');kind.textContent=pack.config.label;
        checkbox.onchange=()=>{if(checkbox.checked)excluded.delete(row.dataset.key);else excluded.add(row.dataset.key);invalidate();updateSelection();};
        row.append(checkbox,name,kind);$('entry-list').append(row);
      }
    }
    $('category').value=category;filterEntries();updateSelection();return selectedBundle();
  };
  for(const conflict of resolveImport(report).conflicts){
    const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=`${conflict.pack}: ${conflict.name} has different PDF definitions`;group.append(legend);
    const select=document.createElement('select');select.setAttribute('aria-label',`Definition for ${conflict.name}`);
    for(const [value,text] of [['','Choose a definition…'],['skip','Skip this entry'],...conflict.candidates.map((doc,i)=>[String(i),`${i+1}: ${doc.flags?.['fvtt-crows-pdf-importer']?.source?.set??'PDF'}, page ${doc.flags?.['fvtt-crows-pdf-importer']?.source?.page??'?'}`])]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
    select.onchange=()=>{choices[conflict.id]=select.value==='skip'?'skip':select.value===''?undefined:Number(select.value);invalidate();renderChoices();};group.append(select);
    conflict.candidates.forEach((doc,i)=>{const detail=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=`Definition ${i+1}`;pre.style.whiteSpace='pre-wrap';pre.textContent=JSON.stringify(doc,null,2);detail.append(summary,pre);group.append(detail);});
    $('conflicts').append(group);
  }
  const setBusy=value=>{busy=value;for(const select of dialog.querySelectorAll('select,input'))select.disabled=value;updateSelection();$('publish-creator').disabled=value||!resolveImport(report).creation;$('select-all').disabled=value;$('select-none').disabled=value;$('save-import').disabled=value||!review;$('cancel-import').disabled=!controller;};
  $('review-import').onclick=async()=>{
    invalidate();setBusy(true);$('import-status').textContent='Validating documents and checking world compendiums…';$('import-status').className='';
    try{
      review=await prepareImport(renderChoices(),{forceOverwrite:$('force-overwrite').checked});if(closed)return;
      $('import-status').textContent=`Review: ${review.counts.create} new, ${review.counts.update} updates, ${review.counts.unchanged} unchanged, ${review.counts.preserve} preserved. Click Import selected entries to save.`;
      $('import-status').className='status-success';
      const table=document.createElement('table');table.innerHTML='<thead><tr><th>Category</th><th>Entry</th><th>Action</th><th>Details</th></tr></thead>';
      for(const row of review.rows){
        const tr=table.insertRow();
        for(const [i,value] of [row.pack,row.name,row.action,row.reason].entries()){
          const td=tr.insertCell();
          if(i===2){
            const badge=document.createElement('span');
            badge.className=`badge badge-${value}`;
            badge.textContent=value;
            td.append(badge);
          } else {
            td.textContent=value;
          }
        }
      }
      $('import-changes').append(table);
    }catch(error){review=null;if(!closed){$('import-status').textContent=error.message;$('import-status').className='status-warn';}}
    finally{if(!closed)setBusy(false);}
  };
  $('save-import').onclick=async()=>{
    if(!review||busy)return;controller=new AbortController();setBusy(true);
    const describe=result=>result.results.map(row=>`${row.label}: ${row.created} added, ${row.updated} updated, ${row.unchanged} unchanged, ${row.preserved.length} preserved.`).join(' ')+(result.published?' Character-creation data published.':' Character-creation data was not changed.');
    try{
      const result=await executeImport(review,{signal:controller.signal,onProgress:text=>{if(!closed)$('import-status').textContent=text;}});
      const text='Import complete. '+describe(result);if(!closed){$('import-status').textContent=text;$('import-status').className='status-success';}else globalThis.ui?.notifications?.info(text);
    }catch(error){const text=`${error.message} ${error.importReport?describe(error.importReport):''}`;if(!closed){$('import-status').textContent=text;$('import-status').className='status-warn';}else globalThis.ui?.notifications?.warn(text);}
    finally{review=null;controller=null;if(!closed)setBusy(false);}
  };
  $('cancel-import').onclick=()=>controller?.abort();
  $('close-import').onclick=()=>dialog.close();
  $('finish-import').onclick=()=>{for(const d of document.querySelectorAll('dialog.crows-import-ui'))d.close();};
  dialog.addEventListener('close',()=>{closed=true;controller?.abort();dialog.remove();});
  renderChoices();document.body.append(dialog);dialog.showModal();return dialog;
}
