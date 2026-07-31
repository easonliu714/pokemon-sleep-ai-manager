const IMAGE_EXT=/\.(png|jpe?g|webp|avif)$/i;

const clean=value=>String(value??'').trim();

export function classifyZipEntry(entry){
  const name=clean(entry?.name||entry?.path);
  if(!name||entry?.directory===true||name.endsWith('/'))return {...entry,name,kind:'directory',eligible:false,reason:'directory'};
  if(!IMAGE_EXT.test(name))return {...entry,name,kind:'non_image',eligible:false,reason:'unsupported_extension'};
  const pageType=clean(entry?.page_type||entry?.pageType).toLowerCase();
  const header=entry?.header||{};
  const hasIdentityHeader=Boolean(clean(header.name)&&Number.isFinite(Number(header.level))&&Number.isFinite(Number(header.sp)));
  const explicitlyDetail=['pokemon_detail','pokemon-detail','individual_detail','individual-detail'].includes(pageType);
  const explicitlyOther=Boolean(pageType)&&!explicitlyDetail;
  if(explicitlyOther)return {...entry,name,kind:'non_pokemon_detail',eligible:false,reason:`page_type:${pageType}`};
  if(explicitlyDetail&&hasIdentityHeader)return {...entry,name,kind:'pokemon_detail',eligible:true,reason:'detail_header'};
  if(hasIdentityHeader)return {...entry,name,kind:'pokemon_detail_candidate',eligible:true,reason:'identity_header'};
  return {...entry,name,kind:'unclassified_image',eligible:false,reason:'missing_identity_header'};
}

export function buildZipManifest(entries=[]){
  const items=entries.map(classifyZipEntry);
  const eligible=items.filter(item=>item.eligible);
  const excluded=items.filter(item=>!item.eligible);
  return {
    items,
    eligible,
    excluded,
    summary:{
      total:items.length,
      eligible:eligible.length,
      excluded:excluded.length,
      directories:items.filter(item=>item.kind==='directory').length,
      non_images:items.filter(item=>item.kind==='non_image').length,
      non_detail_pages:items.filter(item=>item.kind==='non_pokemon_detail').length,
      unclassified_images:items.filter(item=>item.kind==='unclassified_image').length
    }
  };
}

export function toScreenshotGroupingInput(manifest){
  return (manifest?.eligible||[]).map((item,index)=>({
    image_ref:item.image_ref||item.name,
    source_name:item.name,
    captured_at:item.captured_at||item.modified_at||null,
    header:item.header||{},
    thumbnail_hash:item.thumbnail_hash||null,
    fields:item.fields||{},
    sections:item.sections||[],
    sequence_index:Number.isFinite(Number(item.sequence_index))?Number(item.sequence_index):index
  }));
}
