const DEFAULT_JSZIP_URL='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
let pending=null;

function existing(){
  return globalThis.JSZip?.loadAsync?globalThis.JSZip:null;
}

function loadScript(url){
  return new Promise((resolve,reject)=>{
    const found=[...document.scripts].find(script=>script.src===url);
    if(found){
      if(existing())return resolve(existing());
      found.addEventListener('load',()=>resolve(existing()),{once:true});
      found.addEventListener('error',()=>reject(new Error('jszip_script_load_failed')),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=url;
    script.async=true;
    script.crossOrigin='anonymous';
    script.dataset.tech2dDependency='jszip';
    script.onload=()=>existing()?resolve(existing()):reject(new Error('jszip_global_missing'));
    script.onerror=()=>reject(new Error('jszip_script_load_failed'));
    document.head.appendChild(script);
  });
}

export async function loadJSZip({url=DEFAULT_JSZIP_URL}={}){
  if(existing())return existing();
  if(!pending){
    pending=loadScript(url).catch(error=>{
      pending=null;
      throw error;
    });
  }
  return pending;
}

export function resetJSZipLoaderForTest(){pending=null;}
export {DEFAULT_JSZIP_URL};
