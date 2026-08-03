function readBlobAsData(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const value=String(reader.result||'');resolve({data:value.includes(',')?value.split(',')[1]:value,mimeType:blob.type||'image/png'});};reader.onerror=()=>reject(reader.error||new Error('ai_review_image_read_failed'));reader.readAsDataURL(blob);});}

export function createArchiveImageResolver(archive){if(!archive?.readImage)throw new Error('ai_review_archive_missing');return async item=>{const path=String(item?.path||item?.source_image_ref||'');if(!path)throw new Error('ai_review_image_path_missing');const blob=await archive.readImage(path,{type:'blob'});return readBlobAsData(blob);};}
export {readBlobAsData};
