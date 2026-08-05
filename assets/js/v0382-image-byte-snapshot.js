const VERSION='v0.3.82';
const BUILD='20260805-v0382-file-snapshot-public-catalog';
const MIME_BY_EXT={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',avif:'image/avif'};
const trace=(event,details={},status='completed',error=null)=>{
  globalThis.UpdateCenterLiveDebug?.record?.(event,details);
  globalThis.DebugTrace?.record?.('image_snapshot',event,{status,details,error});
};

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

trace('image_byte_snapshot_runtime_ready',{version:VERSION,build:BUILD});
export {snapshotArchive,snapshotResult};
