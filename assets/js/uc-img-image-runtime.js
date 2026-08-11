export const UC_IMG_IMAGE_RUNTIME_VERSION='uc-img-image-runtime-2026-08-11-a';

const clean=value=>String(value??'').trim();

export function isUcImgOwnedMemoryBlob(value){
  if(typeof Blob==='undefined'||!(value instanceof Blob))return false;
  if(typeof File!=='undefined'&&value instanceof File)return false;
  return true;
}

// v0.4.11.2: Android file-picker references may become unreadable after the picker returns.
// Read bytes immediately and sever the dependency on the original File/content-provider handle.
// The returned Blob is memory-only; callers must never persist it through any persistent-storage layer.
export async function snapshotUcImgPickerFile(fileLike){
  const fileName=clean(fileLike?.name)||'unnamed-image';
  if(!fileLike||typeof fileLike.arrayBuffer!=='function')throw new Error(`${fileName} 沒有可讀取的圖片 bytes`);
  let buffer;
  try{
    buffer=await fileLike.arrayBuffer();
  }catch(error){
    const message=clean(error?.message)||clean(error?.name)||'unknown file read error';
    throw new Error(`${fileName} 選圖後立即讀取失敗：${message}`);
  }
  const byteLength=Number(buffer?.byteLength||0);
  if(!byteLength)throw new Error(`${fileName} 圖片 bytes 為空`);
  const mimeType=clean(fileLike?.type)||'image/png';
  const blob=new Blob([buffer],{type:mimeType});
  if(!isUcImgOwnedMemoryBlob(blob))throw new Error(`${fileName} 無法建立平台記憶體圖片快照`);
  return Object.freeze({blob,file_name:fileName,mime_type:mimeType,byte_length:blob.size});
}

export function ucImgByteStateLabel(entry){
  const state=clean(entry?.byte_state)||'NOT_AVAILABLE';
  if(state==='READY')return 'READY（記憶體快照）';
  if(state==='PENDING')return '準備中…';
  if(state==='READ_FAILED')return `讀取失敗${entry?.byte_error?`：${clean(entry.byte_error)}`:''}`;
  return 'NOT AVAILABLE';
}
