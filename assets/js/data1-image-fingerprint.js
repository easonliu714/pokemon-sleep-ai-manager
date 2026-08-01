const INDEX_KEY='pokemon_sleep_image_fingerprint_index_v1';
const MIME_BY_EXT={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',avif:'image/avif'};

const clean=value=>String(value??'').trim();
const toHex=buffer=>Array.from(new Uint8Array(buffer),byte=>byte.toString(16).padStart(2,'0')).join('');

export async function sha256Hex(input,{cryptoImpl=globalThis.crypto}={}){
  if(!cryptoImpl?.subtle?.digest)throw new Error('sha256_not_supported');
  const buffer=input instanceof ArrayBuffer?input:ArrayBuffer.isView(input)?input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength):await input.arrayBuffer();
  return toHex(await cryptoImpl.subtle.digest('SHA-256',buffer));
}

async function readDimensions(buffer,mimeType){
  if(typeof createImageBitmap!=='function'||typeof Blob==='undefined')return {width:null,height:null};
  try{const bitmap=await createImageBitmap(new Blob([buffer],{type:mimeType}));const result={width:bitmap.width,height:bitmap.height};bitmap.close?.();return result;}catch{return {width:null,height:null};}
}

export function loadFingerprintIndex({storage=globalThis.localStorage}={}){
  try{const parsed=JSON.parse(storage?.getItem(INDEX_KEY)||'[]');return Array.isArray(parsed)?parsed:[];}catch{return [];}
}

export function saveFingerprintIndex(entries,{storage=globalThis.localStorage}={}){
  const normalized=Array.from(new Map((entries||[]).filter(item=>clean(item.sha256)).map(item=>[clean(item.sha256),{sha256:clean(item.sha256),first_seen_at:item.first_seen_at||new Date().toISOString(),source_image_ref:item.source_image_ref||null,archive_name:item.archive_name||null}])).values()).slice(-5000);
  storage?.setItem(INDEX_KEY,JSON.stringify(normalized));
  return normalized;
}

export async function enrichInventoryWithFingerprints(archive,manifest,{existingIndex=loadFingerprintIndex(),onProgress=()=>{}}={}){
  const existing=new Map((existingIndex||[]).map(item=>[clean(item.sha256),item]));
  const seen=new Map();
  const items=[];
  const sourceItems=manifest?.items||[];
  for(let index=0;index<sourceItems.length;index+=1){
    const item=sourceItems[index];
    try{
      const buffer=await archive.readImage(item.path,{type:'arraybuffer'});
      const sha256=await sha256Hex(buffer);
      const mime_type=MIME_BY_EXT[item.extension]||'application/octet-stream';
      const dimensions=await readDimensions(buffer,mime_type);
      const first=seen.get(sha256)||null;
      const prior=existing.get(sha256)||null;
      if(!first)seen.set(sha256,item.source_image_ref);
      const exact_duplicate_of=first||prior?.source_image_ref||null;
      const duplicate_kind=first?'within_archive':(prior?'existing_index':null);
      items.push({...item,sha256,mime_type,byte_size:buffer.byteLength,width:dimensions.width,height:dimensions.height,exact_duplicate_of,duplicate_of:exact_duplicate_of,duplicate_kind,duplicate_group_id:exact_duplicate_of?`sha256:${sha256.slice(0,16)}`:null,existing_database_match:Boolean(prior),status:exact_duplicate_of?'duplicate':item.status,fingerprinted_at:new Date().toISOString()});
    }catch(error){
      items.push({...item,status:'unreadable',fingerprint_error:error?.message||String(error),fingerprinted_at:new Date().toISOString()});
    }
    onProgress({current:index+1,total:sourceItems.length,percent:sourceItems.length?Math.round((index+1)/sourceItems.length*100):100});
  }
  const fingerprints=items.filter(item=>item.sha256).map(item=>({sha256:item.sha256,source_image_ref:item.source_image_ref,archive_name:item.archive_name,first_seen_at:item.fingerprinted_at}));
  saveFingerprintIndex([...existingIndex,...fingerprints]);
  const count=kind=>items.filter(item=>item.duplicate_kind===kind).length;
  return {...manifest,items,fingerprint_schema:'pokemon-sleep-image-fingerprint/1.0',fingerprinted_at:new Date().toISOString(),fingerprint_summary:{total:items.length,hashed:items.filter(item=>item.sha256).length,new_images:items.filter(item=>item.sha256&&!item.exact_duplicate_of).length,within_archive_duplicates:count('within_archive'),existing_index_matches:count('existing_index'),unreadable:items.filter(item=>item.status==='unreadable').length}};
}

export {INDEX_KEY as IMAGE_FINGERPRINT_INDEX_KEY};
