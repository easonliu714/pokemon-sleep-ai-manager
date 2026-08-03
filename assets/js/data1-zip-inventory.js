import {attachRuntimeVersion,buildVersionedExportFilename} from './runtime-version.js';

const MANIFEST_SCHEMA='pokemon-sleep-private-zip-inventory/1.0';
const VALID_STATUS=new Set(['pending','processed','duplicate','unreadable','review_required','ignored']);
const IMAGE_KINDS=new Set(['png','jpg','jpeg','webp','avif']);
const CLASSIFICATION_CATEGORIES=['pokemon','recipe','ingredient','item','capacity','account','other'];

const clean=value=>String(value??'').trim();
const basename=path=>clean(path).split('/').filter(Boolean).at(-1)||clean(path);
const extension=path=>{const name=basename(path);const index=name.lastIndexOf('.');return index<0?'':name.slice(index+1).toLowerCase();};
const stableRef=(path,index)=>`zip-image-${String(index+1).padStart(4,'0')}:${clean(path)}`;
const effectiveCategory=item=>clean(item?.confirmed_category||item?.suggested_category||item?.category||'unclassified')||'unclassified';
const latestTimestamp=(items,keys)=>items.map(item=>keys.map(key=>Date.parse(item?.[key]||'')).filter(Number.isFinite)).flat().reduce((max,value)=>Math.max(max,value),0);

export function classifyInventoryCategory(path){
  const text=clean(path).toLowerCase();
  if(/recipe|dish|cooking|料理|食譜/.test(text))return 'recipe';
  if(/ingredient|食材/.test(text))return 'ingredient';
  if(/bag|item|inventory|道具|背包/.test(text))return 'item';
  if(/capacity|box|storage|容量/.test(text))return 'capacity';
  if(/profile|account|research|帳號|玩家/.test(text))return 'account';
  if(/pokemon|ability|detail|寶可夢|能力/.test(text))return 'pokemon';
  return 'unclassified';
}

export function buildPrivateZipInventory(archive,{archiveName=null,existing=[]}={}){
  const entries=Array.isArray(archive?.entries)?archive.entries:[];
  const prior=new Map((existing||[]).map(item=>[clean(item.source_image_ref),item]));
  const seen=new Map();
  const items=[];
  entries.forEach((entry,index)=>{
    if(entry?.directory)return;
    const ext=clean(entry?.extension||extension(entry?.path||entry?.name)).toLowerCase();
    if(!IMAGE_KINDS.has(ext))return;
    const path=clean(entry?.path||entry?.name||`image-${index+1}.${ext}`);
    const source_image_ref=stableRef(path,index);
    const duplicateKey=`${basename(path).toLowerCase()}|${Number(entry?.size||0)}`;
    const firstRef=seen.get(duplicateKey)||null;
    if(!firstRef)seen.set(duplicateKey,source_image_ref);
    const saved=prior.get(source_image_ref);
    const status=firstRef?'duplicate':(VALID_STATUS.has(saved?.status)?saved.status:'pending');
    items.push({source_image_ref,archive_name:archiveName,path,file_name:basename(path),extension:ext,size:Number(entry?.size||0),modified_at:entry?.modified_at||null,category:saved?.category||classifyInventoryCategory(path),status,duplicate_of:firstRef,confidence:Number.isFinite(Number(saved?.confidence))?Number(saved.confidence):null,notes:clean(saved?.notes)||null,output_package_ref:saved?.output_package_ref||null,updated_at:saved?.updated_at||null});
  });
  return finalizeInventory({schema:MANIFEST_SCHEMA,archive:{name:archiveName,entry_count:Number(archive?.summary?.entry_count||entries.length),image_count:items.length,total_uncompressed_bytes:Number(archive?.summary?.total_uncompressed_bytes||0)},items});
}

export function updateInventoryItem(manifest,sourceImageRef,patch={}){
  const ref=clean(sourceImageRef);
  const items=(manifest?.items||[]).map(item=>{
    if(item.source_image_ref!==ref)return item;
    const status=patch.status??item.status;
    if(!VALID_STATUS.has(status))throw new Error(`invalid_inventory_status:${status}`);
    const confidence=patch.confidence==null?item.confidence:Number(patch.confidence);
    if(confidence!=null&&(confidence<0||confidence>1||!Number.isFinite(confidence)))throw new Error('invalid_inventory_confidence');
    return {...item,...patch,status,confidence,updated_at:new Date().toISOString()};
  });
  if(!items.some(item=>item.source_image_ref===ref))throw new Error(`inventory_item_not_found:${ref}`);
  return finalizeInventory({...manifest,items});
}

export function buildClassificationSummary(items=[]){
  const counts=Object.fromEntries(CLASSIFICATION_CATEGORIES.map(category=>[category,0]));
  let analyzed=0,notAnalyzed=0,failed=0,skipped=0,cancelled=0,requiresReview=0;
  for(const item of items){
    const status=clean(item?.classification_status);
    const category=effectiveCategory(item);
    const hasResult=Number.isFinite(Number(item?.classification_confidence))&&clean(item?.suggested_category);
    if(hasResult){analyzed+=1;if(category in counts)counts[category]+=1;}
    else if(status==='failed')failed+=1;
    else if(status==='cancelled')cancelled+=1;
    else if(status==='skipped'||item?.status==='duplicate')skipped+=1;
    else notAnalyzed+=1;
    if(item?.requires_review===true)requiresReview+=1;
  }
  return {total:items.length,analyzed,not_analyzed:notAnalyzed,failed,skipped,cancelled,requires_review:requiresReview,ai_requests:0,was_cancelled:cancelled>0,region_mode:items.some(item=>Number(item?.ocr_region_count||0)>0),layout_aware:true,category_counts:counts};
}

export function finalizeInventory(manifest){
  const items=Array.isArray(manifest?.items)?manifest.items:[];
  const count=status=>items.filter(item=>item.status===status).length;
  const byCategory={};
  for(const item of items){const category=effectiveCategory(item);byCategory[category]=(byCategory[category]||0)+1;}
  const now=new Date().toISOString();
  const latestClassified=latestTimestamp(items,['ocr_completed_at','updated_at']);
  return {...manifest,schema:MANIFEST_SCHEMA,generated_at:now,classified_at:latestClassified?new Date(latestClassified).toISOString():(manifest?.classified_at||null),summary:{total:items.length,pending:count('pending'),processed:count('processed'),duplicate:count('duplicate'),unreadable:count('unreadable'),review_required:count('review_required'),ignored:count('ignored'),completed:items.filter(item=>!['pending','review_required'].includes(item.status)).length,by_category:byCategory},classification_summary:buildClassificationSummary(items)};
}

export function validatePrivateZipInventory(manifest){
  const errors=[];
  if(manifest?.schema!==MANIFEST_SCHEMA)errors.push('invalid_manifest_schema');
  const refs=new Set();
  for(const [index,item] of (manifest?.items||[]).entries()){
    if(!clean(item.source_image_ref))errors.push(`missing_source_image_ref:${index}`);
    else if(refs.has(item.source_image_ref))errors.push(`duplicate_source_image_ref:${item.source_image_ref}`);
    else refs.add(item.source_image_ref);
    if(!VALID_STATUS.has(item.status))errors.push(`invalid_status:${index}:${item.status}`);
    if(item.confidence!=null&&(Number(item.confidence)<0||Number(item.confidence)>1))errors.push(`invalid_confidence:${index}`);
    if(item.status==='duplicate'&&!item.duplicate_of)errors.push(`missing_duplicate_of:${index}`);
  }
  const rebuilt=finalizeInventory({...manifest});
  if(JSON.stringify(manifest?.summary||{})!==JSON.stringify(rebuilt.summary))errors.push('stale_inventory_summary');
  if(JSON.stringify(manifest?.classification_summary||{})!==JSON.stringify(rebuilt.classification_summary))errors.push('stale_classification_summary');
  return {ok:errors.length===0,errors};
}

export function downloadPrivateZipInventory(manifest,{fileName=null}={}){
  const refreshed=finalizeInventory(manifest);
  const validated=validatePrivateZipInventory(refreshed);
  if(!validated.ok)throw new Error(`invalid_private_zip_inventory:${validated.errors.join(',')}`);
  const payload=attachRuntimeVersion(refreshed);
  const resolved=fileName||buildVersionedExportFilename('private_zip_inventory',{sourceName:manifest?.archive?.name});
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=resolved;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  return payload;
}

export {MANIFEST_SCHEMA as PRIVATE_ZIP_INVENTORY_SCHEMA,VALID_STATUS as PRIVATE_ZIP_INVENTORY_STATUSES,effectiveCategory};
