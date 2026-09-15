import {cardToItem} from './item-mapper.mjs';
import {npcToActor} from './npc-parser.mjs';
// Register before any asynchronous library initialization.
self.onmessage=async({data})=>{
  let port,worker;
  try{
    const baseURL=data.baseURL;
    const [pdfjs,{extractPage}]=await Promise.all([import(new URL('build/pdf.mjs',baseURL).href),import('./extract.mjs')]);
    // An explicit port avoids PDF.js 4's window-based automatic worker loader.
    port=new Worker(new URL('build/pdf.worker.mjs',baseURL),{type:'module'});
    worker=new pdfjs.PDFWorker({port});
    const result=await extractPage(new Uint8Array(data.bytes),data.page,data.kind,{pdfjs,baseURL,worker,source:data.source,onProgress:progress=>self.postMessage({progress})});
    if(result.parsedCards)result.documents=result.parsedCards.map(cardToItem);
    if(result.npcRecords)result.actors=result.npcRecords.map(npcToActor);
    self.postMessage({result,version:pdfjs.version});
  }catch(error){self.postMessage({error:error.message});}
  finally{worker?.destroy();port?.terminate();}
};
