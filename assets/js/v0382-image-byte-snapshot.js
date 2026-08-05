const VERSION='v0.3.82';
const BUILD='20260805-v0382-file-snapshot-public-catalog';
const MIME_BY_EXT={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',avif:'image/avif'};
const trace=(event,details={},status='completed',error=null)=>{
  globalThis.UpdateCenterLiveDebug?.record?.(event,details);
  globalThis.DebugTrace?.record?.('image_snapshot',event,{status,details,error});
};

function assertVersion(){
  document.documentElement.dataset.appVersion=VERSION;
  document.documentElement.dataset.appBuild=BUILD;
  globalThis.PokemonSleepRuntimeVersion=Object.freeze({app_version:VERSION,app_build:BUILD});
  const badge=document.getElementById('appVersion');
  if(badge){badge.textContent=`版本 ${VERSION}`;badge.title=`Pokémon Sleep AI Manager ${VERSION} / ${BUILD}`;badge.dataset.versionAuthority='v0382-release';}
}
function installVersionAuthority(){
  const apply=()=>setTimeout(assertVersion,0);
  assertVersion();
  new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-app-version','data-app-build']});
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  setTimeout(assertVersion,500);
}
async function registerReleaseServiceWorker(){
  if(!('serviceWorker' in navigator))return;
  try{
    const registration=await navigator.serviceWorker.register('./service-worker-v0382.js',{scope:'./',updateViaCache:'none'});
    await registration.update();
    trace('v0382_service_worker_registered',{scope:registration.scope,version:VERSION,build:BUILD});
  }catch(error){trace('v0382_service_worker_failed',{message:error?.message||String(error)},'failed',error);}
}
function normalizeType(type){return ['blob','arraybuffer','uint8array'].includes(type)?type:'blob';}
function cloneBytes(bytes){return bytes.slice(0);}

async function snapshotArchive(archive,index){
  if(!archive?.readImage||archive.__byteSnapshotReady)return archive;
  const original=archive.readImage.bind(archive);
  const records=new Map();
  const entries=(archive.entries||[]).filter(entry=>!entry.directory&&(entry.image!==false));
  archive.__byteSnapshotReady=(async()=>{
    trace('image_byte_snapshot_started',{archive_index:index,image_count:entries.length});
    for(const entry of entries){
      const path=entry.path||entry.name;
      try{
        const buffer=await original(path,{type:'arraybuffer'});
        const bytes=new Uint8Array(buffer);
        if(!bytes.byteLength)throw new Error(`image_snapshot_empty:${path}`);
        records.set(path,{bytes,mime:entry.file?.type||MIME_BY_EXT[String(entry.extension||'').toLowerCase()]||'application/octet-stream'});
      }catch(error){
        trace('image_byte_snapshot_failed',{archive_index:index,path,message:error?.message||String(error)},'failed',error);
        throw error;
      }
    }
    trace('image_byte_snapshot_completed',{archive_index:index,image_count:records.size,total_bytes:[...records.values()].reduce((sum,row)=>sum+row.bytes.byteLength,0)});
    return true;
  })();
  archive.readImage=async(path,{type='blob'}={})=>{
    await archive.__byteSnapshotReady;
    const record=records.get(path);
    if(!record)throw new Error(`image_snapshot_not_found:${path}`);
    const mode=normalizeType(type);
    if(mode==='uint8array')return cloneBytes(record.bytes);
    if(mode==='arraybuffer')return cloneBytes(record.bytes).buffer;
    return new Blob([record.bytes],{type:record.mime});
  };
  return archive;
}

async function snapshotResult(result){
  const archives=Array.isArray(result?.archives)?result.archives:[];
  await Promise.all(archives.map(snapshotArchive));
  result.image_byte_snapshot={version:VERSION,build:BUILD,archive_count:archives.length,ready:true};
  return result;
}

globalThis.addEventListener('pokemon-sleep:identity-import-files-selected',event=>{
  const result=event.detail;
  if(!result?.archives?.length)return;
  const promise=snapshotResult(result).catch(error=>{
    result.image_byte_snapshot={version:VERSION,build:BUILD,ready:false,error:error?.message||String(error)};
    throw error;
  });
  result.image_byte_snapshot_promise=promise;
},{capture:true});

installVersionAuthority();
registerReleaseServiceWorker();
trace('image_byte_snapshot_runtime_ready',{version:VERSION,build:BUILD});
export {snapshotArchive,snapshotResult};
