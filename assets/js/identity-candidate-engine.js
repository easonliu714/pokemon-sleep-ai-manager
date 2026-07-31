const text=value=>String(value??'').trim();
const same=(a,b)=>!text(a)||!text(b)||text(a)===text(b);
const exact=(a,b)=>text(a)&&text(b)&&text(a)===text(b);
const rowsByLevel=rows=>new Map((rows||[]).filter(Boolean).map(row=>[Number(row.unlock_level),text(row.ingredient_name||row.subskill_name)]));

function compareRows(observed,candidate){
  const left=rowsByLevel(observed),right=rowsByLevel(candidate);
  let compared=0,matched=0,conflict=false;
  for(const [level,value] of left){
    if(!value)continue;
    const other=right.get(level);
    if(!other)continue;
    compared+=1;
    if(value===other)matched+=1;else conflict=true;
  }
  return {compared,matched,conflict};
}

function scoreCandidate(observation,candidate){
  const profile=observation.profile||{};
  let score=0,signals=0,conflict=false;
  const add=(condition,weight)=>{signals+=1;if(condition)score+=weight;else conflict=true;};
  if(profile.species&&candidate.species)add(exact(profile.species,candidate.species)||exact(profile.species,candidate.current_species),30);
  for(const [field,weight] of [['nature',16],['specialty',12],['type',10],['main_skill',10]]){
    if(profile[field]&&candidate[field])add(exact(profile[field],candidate[field]),weight);
  }
  if(profile.nickname&&candidate.nickname)add(exact(profile.nickname,candidate.nickname),4);
  if(Number.isFinite(Number(profile.level))&&Number.isFinite(Number(candidate.level))){
    signals+=1;
    const delta=Number(profile.level)-Number(candidate.level);
    if(delta>=0&&delta<=20)score+=8;else if(Math.abs(delta)<=3)score+=4;else conflict=true;
  }
  const ingredients=compareRows(observation.ingredients,candidate.ingredients);
  const subskills=compareRows(observation.subskills,candidate.subskills);
  if(ingredients.compared){signals+=ingredients.compared;score+=ingredients.matched*12;if(ingredients.conflict)conflict=true;}
  if(subskills.compared){signals+=subskills.compared;score+=subskills.matched*14;if(subskills.conflict)conflict=true;}
  return {candidate,score,signals,conflict};
}

export function classifyIdentityCandidates(observation,candidates=[]){
  const target=observation?.identity?.target_pokemon_instance_id;
  const token=observation?.identity?.target_update_token;
  const explicit=candidates.filter(item=>(target&&item.pokemon_instance_id===target)||(token&&item.update_token===token));
  if(explicit.length===1)return {status:'exact_existing',selected:explicit[0],candidates:explicit,reason:'platform_identity_reference'};
  if(explicit.length>1)return {status:'ambiguous_existing',selected:null,candidates:explicit,reason:'duplicate_platform_identity_reference'};

  const ranked=candidates.map(item=>scoreCandidate(observation,item)).filter(item=>!item.conflict&&item.signals>0).sort((a,b)=>b.score-a.score);
  if(!ranked.length)return {status:'no_candidate',selected:null,candidates:[],reason:'no_compatible_candidate'};
  const top=ranked[0],second=ranked[1];
  const ties=ranked.filter(item=>item.score===top.score);
  if(ties.length>1)return {status:'ambiguous_existing',selected:null,candidates:ties.map(item=>item.candidate),reason:'multiple_equal_candidates'};
  if(top.score>=70&&top.signals>=4&&(!second||top.score-second.score>=15))return {status:'unique_high_confidence',selected:top.candidate,candidates:ranked.map(item=>item.candidate),score:top.score,reason:'unique_weighted_match'};
  return {status:'possible_existing',selected:null,candidates:ranked.map(item=>item.candidate),score:top.score,reason:'insufficient_unique_evidence'};
}

export function resolveObservationBatch(payload,candidates=[]){
  return (payload?.observations||[]).map(observation=>({incoming_ref:observation.incoming_ref,...classifyIdentityCandidates(observation,candidates)}));
}
