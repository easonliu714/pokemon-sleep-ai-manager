const text=(value)=>String(value??'').trim();

const PROFILE_FIELDS=['sp','main_skill','main_skill_level','nature','helper_seconds','carry_limit'];
const DISAMBIGUATION_FIELDS=['nickname','rating','core_role','recommendation','item_advice','scenarios','favorite_berry'];

export function profileCompleteness(item){
  return PROFILE_FIELDS.reduce((count,key)=>count+(text(item[key])?1:0),0);
}

export function isProfileComplete(item){
  return profileCompleteness(item)>=4;
}

export function isWeakSkeleton(item){
  return profileCompleteness(item)<=1;
}

function sameBaseIdentity(candidate,skeleton){
  return text(candidate.original_label||candidate.species)===text(skeleton.original_label||skeleton.species)
    && text(candidate.specialty)===text(skeleton.specialty)
    && text(candidate.type)===text(skeleton.type);
}

function compatibleEvidence(candidate,skeleton){
  for(const field of DISAMBIGUATION_FIELDS){
    const weakValue=text(skeleton[field]);
    const candidateValue=text(candidate[field]);
    if(weakValue&&candidateValue&&weakValue!==candidateValue)return false;
  }
  const weakLevel=Number(skeleton.level||0);
  const candidateLevel=Number(candidate.level||0);
  if(weakLevel&&candidateLevel&&Math.abs(weakLevel-candidateLevel)>10)return false;
  return true;
}

export function planSkeletonMerges(items,alreadyUsed=new Set()){
  const planned=[];
  const used=new Set(alreadyUsed);
  const completeItems=items.filter(item=>isProfileComplete(item)&&!used.has(item.pokemon_id));
  const skeletons=items.filter(item=>isWeakSkeleton(item)&&!used.has(item.pokemon_id));

  for(const skeleton of skeletons){
    const matches=completeItems.filter(candidate=>
      !used.has(candidate.pokemon_id)
      && sameBaseIdentity(candidate,skeleton)
      && compatibleEvidence(candidate,skeleton));
    if(matches.length!==1)continue;
    const winner=matches[0];
    planned.push({winner,loser:skeleton,reason:'unique complete profile replaces incomplete legacy skeleton'});
    used.add(skeleton.pokemon_id);
  }
  return planned;
}

export function auditActivePokemon(items){
  const skeletons=items.filter(isWeakSkeleton).map(item=>item.pokemon_id);
  const duplicateGroups=[];
  const groups=new Map();
  for(const item of items){
    const key=[
      text(item.original_label||item.species),
      text(item.specialty),
      text(item.type),
      text(item.core_role),
      text(item.recommendation),
    ].join('|');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(item.pokemon_id);
  }
  for(const [key,ids] of groups){
    if(ids.length>1)duplicateGroups.push({key,pokemon_ids:ids});
  }
  return {ok:skeletons.length===0&&duplicateGroups.length===0,skeletons,duplicateGroups};
}
