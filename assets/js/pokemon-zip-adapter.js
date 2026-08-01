const IMAGE_EXTENSIONS=new Set(['png','jpg','jpeg','webp','avif']);

function extension(path=''){
  const name=String(path).split('/').pop()||'';
  const index=name.lastIndexOf('.');
  return index<0?'':name.slice(index+1).toLowerCase();
}

function normalizeEntry(entry,index){
  const path=String(entry?.name||entry?.path||`entry-${index+1}`);
  const directory=Boolean(entry?.dir||entry?.directory||path.endsWith('/'));
  const ext=extension(path);
  return {
    path,
    name:path.split('/').pop()||path,
    directory,
    image:!directory&&IMAGE_EXTENSIONS.has(ext),
    extension:ext,
    size:Number(entry?._data?.uncompressedSize??entry?.uncompressedSize??entry?.size??0),
    modified_at:entry?.date instanceof Date?entry.date.toISOString():(entry?.modified_at||null),
    source_entry:entry
  };
}

export async function extractZipEntries(input,{JSZip:InjectedJSZip=globalThis.JSZip,maxEntries=1000,maxUncompressedBytes=250*1024*1024}={}){
  if(!InjectedJSZip?.loadAsync)throw new TypeError('JSZip.loadAsync is required');
  const archive=await InjectedJSZip.loadAsync(input,{createFolders:false});
  const entries=Object.values(archive.files||{}).map(normalizeEntry);
  if(entries.length>maxEntries)throw new RangeError(`zip_entry_limit_exceeded:${entries.length}`);
  const total=entries.reduce((sum,item)=>sum+item.size,0);
  if(total>maxUncompressedBytes)throw new RangeError(`zip_uncompressed_limit_exceeded:${total}`);
  return {
    entries,
    summary:{entry_count:entries.length,image_count:entries.filter(item=>item.image).length,total_uncompressed_bytes:total},
    async readImage(path,{type='blob'}={}){
      const entry=archive.file(path);
      if(!entry)throw new Error(`zip_entry_not_found:${path}`);
      const normalized=entries.find(item=>item.path===path);
      if(!normalized?.image)throw new Error(`zip_entry_not_image:${path}`);
      return entry.async(type);
    }
  };
}

export {IMAGE_EXTENSIONS as ZIP_IMAGE_EXTENSIONS};
