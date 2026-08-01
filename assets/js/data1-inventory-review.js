import {updateInventoryItem,validatePrivateZipInventory} from './data1-zip-inventory.js';

const VALID_CATEGORIES=new Set(['unclassified','pokemon','recipe','ingredient','item','capacity','account','other']);
const clean=value=>String(value??'').trim();

export function filterInventoryItems(manifest,{status='all',category='all',query=''}={}){
  const needle=clean(query).toLowerCase();
  return (manifest?.items||[]).filter(item=>{
    if(status!=='all'&&item.status!==status)return false;
    if(category!=='all'&&item.category!==category)return false;
    if(!needle)return true;
    return [item.file_name,item.path,item.source_image_ref,item.notes].some(value=>clean(value).toLowerCase().includes(needle));
  });
}

export function summarizeReviewProgress(manifest){
  const items=manifest?.items||[];
  const reviewed=items.filter(item=>!['pending','review_required'].includes(item.status)).length;
  const attention=items.filter(item=>['pending','review_required','unreadable'].includes(item.status)).length;
  return {total:items.length,reviewed,attention,percent:items.length?Math.round(reviewed/items.length*100):0};
}

export function patchInventoryReview(manifest,sourceImageRef,{status,category,confidence,notes,output_package_ref}={}){
  if(category!=null&&!VALID_CATEGORIES.has(category))throw new Error(`invalid_inventory_category:${category}`);
  return updateInventoryItem(manifest,sourceImageRef,{status,category,confidence,notes:clean(notes)||null,output_package_ref:clean(output_package_ref)||null});
}

export function bulkPatchInventoryReview(manifest,sourceImageRefs=[],patch={}){
  const refs=new Set(sourceImageRefs.map(clean).filter(Boolean));
  let next=manifest;
  for(const ref of refs)next=patchInventoryReview(next,ref,patch);
  return next;
}

export function buildReviewPackage(manifest,{reviewer='local-user'}={}){
  const validation=validatePrivateZipInventory(manifest);
  if(!validation.ok)throw new Error(`invalid_private_zip_inventory:${validation.errors.join(',')}`);
  return {
    schema:'pokemon-sleep-private-inventory-review/1.0',
    generated_at:new Date().toISOString(),
    reviewer,
    archive:manifest.archive,
    summary:{...manifest.summary,...summarizeReviewProgress(manifest)},
    items:manifest.items.map(item=>({...item}))
  };
}

export {VALID_CATEGORIES as DATA1_REVIEW_CATEGORIES};
