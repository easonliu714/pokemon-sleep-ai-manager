const text=value=>String(value??'').trim();
const number=value=>value==null||value===''?null:Number(value);

function normalizeHeader(item={}){
  return {
    species:text(item.species||item.name),
    nickname:text(item.nickname),
    level:number(item.level),
    sp:number(item.sp),
    thumbnail_hash:text(item.thumbnail_hash),
  };
}

export function buildScreenshotGroupKey(item={}){
  const header=normalizeHeader(item.header||item);
  if(!header.species||!Number.isFinite(header.level)||!Number.isFinite(header.sp))return null;
  return [header.species,header.nickname,header.level,header.sp].join('|');
}

export function groupPokemonScreenshots(items=[]){
  const groups=new Map();
  const ungrouped=[];
  for(const [index,item] of items.entries()){
    const key=buildScreenshotGroupKey(item);
    if(!key){ungrouped.push({...item,index,group_status:'header_incomplete'});continue;}
    if(!groups.has(key))groups.set(key,{group_key:key,header:normalizeHeader(item.header||item),screenshots:[],conflicts:[]});
    const group=groups.get(key);
    const header=normalizeHeader(item.header||item);
    if(group.header.thumbnail_hash&&header.thumbnail_hash&&group.header.thumbnail_hash!==header.thumbnail_hash){
      group.conflicts.push({type:'thumbnail_conflict',index,expected:group.header.thumbnail_hash,actual:header.thumbnail_hash});
    }
    group.screenshots.push({...item,index});
  }
  const result=[...groups.values()].map(group=>({
    ...group,
    screenshots:group.screenshots.sort((a,b)=>(a.capture_order??a.index)-(b.capture_order??b.index)),
    complete_to_sleep_time:group.screenshots.some(item=>item.contains_sleep_time===true),
    status:group.conflicts.length?'header_conflict':'exact_header_match',
  }));
  return {groups:result,ungrouped,summary:{input_count:items.length,group_count:result.length,ungrouped_count:ungrouped.length,conflict_count:result.filter(item=>item.conflicts.length).length,complete_count:result.filter(item=>item.complete_to_sleep_time).length}};
}

export function mergeGroupedScreenshotFields(group){
  const fields={};
  const evidence={};
  for(const screenshot of group?.screenshots||[]){
    for(const [field,value] of Object.entries(screenshot.fields||{})){
      if(value==null||value==='')continue;
      if(fields[field]!=null&&fields[field]!==value){
        evidence[field]={status:'conflict',values:[fields[field],value],source_refs:[...(evidence[field]?.source_refs||[]),screenshot.source_ref]};
        continue;
      }
      fields[field]=value;
      evidence[field]={status:'observed',source_refs:[...(evidence[field]?.source_refs||[]),screenshot.source_ref].filter(Boolean)};
    }
  }
  return {group_key:group?.group_key||null,header:group?.header||null,fields,evidence,complete_to_sleep_time:Boolean(group?.complete_to_sleep_time),conflicts:[...(group?.conflicts||[]),...Object.entries(evidence).filter(([,value])=>value.status==='conflict').map(([field,value])=>({type:'field_conflict',field,...value}))]};
}
