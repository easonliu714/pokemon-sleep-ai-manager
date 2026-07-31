const text=value=>String(value??'').trim();
const exact=(a,b)=>Boolean(text(a)&&text(b)&&text(a)===text(b));
const normalizeDate=value=>text(value).slice(0,10);
const asArray=value=>Array.isArray(value)?value:[];
const rowsByLevel=rows=>new Map(asArray(rows).filter(Boolean).map(row=>[Number(row.unlock_level),text(row.ingredient_name||row.subskill_name)]));

function speciesEvidence(profile,candidate){
  const observed=text(profile.species);
  if(!observed)return {compared:false,match:false,mode:null};
  const direct=[candidate.species,candidate.current_species].some(value=>exact(observed,value));
  if(direct)return {compared:true,match:true,mode:'current_species'};
  const chain=asArray(candidate.evolution_chain_species).map(text);
  if(chain.includes(observed))return {compared:true,match:true,mode:'evolution_chain'};
  const captured=text(candidate.capture_species);
  if(captured&&exact(observed,captured))return {compared:true,match:true,mode:'capture_species'};
  return {compared:true,match:false,mode:null};
}

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
  const evidence=[];
  const add=(name,condition,weight,details=null)=>{
    signals+=1;
    evidence.push({name,match:Boolean(condition),weight,details});
    if(condition)score+=weight;else conflict=true;
  };

  const species=speciesEvidence(profile,candidate);
  if(species.compared)add('species',species.match,species.mode==='current_species'?30:22,{mode:species.mode});
  for(const [field,weight] of [['nature',16],['specialty',12],['type',10],['main_skill',10]]){
    if(profile[field]&&candidate[field])add(field,exact(profile[field],candidate[field]),weight);
  }
  if(profile.nickname&&candidate.nickname)add('nickname',exact(profile.nickname,candidate.nickname),4);
  if(profile.registered_date&&candidate.registered_date){
    add('registered_date',normalizeDate(profile.registered_date)===normalizeDate(candidate.registered_date),14);
  }
  if(profile.capture_species&&candidate.capture_species){
    add('capture_species',exact(profile.capture_species,candidate.capture_species),12);
  }
  if(Number.isFinite(Number(profile.level))&&Number.isFinite(Number(candidate.level))){
    signals+=1;
    const delta=Number(profile.level)-Number(candidate.level);
    const match=delta>=0&&delta<=20;
    evidence.push({name:'level_progression',match,weight:8,details:{delta}});
    if(match)score+=8;else if(Math.abs(delta)<=3)score+=4;else conflict=true;
  }

  const ingredients=compareRows(observation.ingredients,candidate.ingredients);
  const subskills=compareRows(observation.subskills,candidate.subskills);
  if(ingredients.compared){
    signals+=ingredients.compared;
    score+=ingredients.matched*12;
    evidence.push({name:'ingredients',match:!ingredients.conflict,weight:ingredients.matched*12,details:ingredients});
    if(ingredients.conflict)conflict=true;
  }
  if(subskills.compared){
    signals+=subskills.compared;
    score+=subskills.matched*14;
    evidence.push({name:'subskills',match:!subskills.conflict,weight:subskills.matched*14,details:subskills});
    if(subskills.conflict)conflict=true;
  }
  return {candidate,score,signals,conflict,evidence};
}

function publicCandidate(item){
  return {
    pokemon_instance_id:item.candidate.pokemon_instance_id,
    pokemon_id:item.candidate.pokemon_id||null,
    update_token:item.candidate.update_token||null,
    nickname:item.candidate.nickname||null,
    species:item.candidate.current_species||item.candidate.species||null,
    level:item.candidate.level??null,
    score:item.score,
    signals:item.signals,
    evidence:item.evidence
  };
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
  if(ties.length>1)return {status:'ambiguous_existing',selected:null,candidates:ties.map(item=>item.candidate),ranked,reason:'multiple_equal_candidates'};
  if(top.score>=70&&top.signals>=4&&(!second||top.score-second.score>=15))return {status:'unique_high_confidence',selected:top.candidate,candidates:ranked.map(item=>item.candidate),ranked,score:top.score,reason:'unique_weighted_match'};
  return {status:'possible_existing',selected:null,candidates:ranked.map(item=>item.candidate),ranked,score:top.score,reason:'insufficient_unique_evidence'};
}

export function toIdentityResolutionDto(observation,result){
  const ranked=asArray(result.ranked).map(publicCandidate);
  const selectedId=result.selected?.pokemon_instance_id||null;
  return {
    incoming_ref:observation?.incoming_ref||null,
    status:result.status,
    reason:result.reason,
    requires_confirmation:!['exact_existing','unique_high_confidence'].includes(result.status),
    selected_pokemon_instance_id:selectedId,
    top_score:result.score??ranked[0]?.score??null,
    candidate_count:ranked.length||asArray(result.candidates).length,
    candidates:ranked.length?ranked:asArray(result.candidates).map(candidate=>({
      pokemon_instance_id:candidate.pokemon_instance_id,
      pokemon_id:candidate.pokemon_id||null,
      update_token:candidate.update_token||null,
      nickname:candidate.nickname||null,
      species:candidate.current_species||candidate.species||null,
      level:candidate.level??null,
      score:null,
      signals:null,
      evidence:[]
    }))
  };
}

export function resolveObservationBatch(payload,candidates=[]){
  return asArray(payload?.observations).map(observation=>{
    const result=classifyIdentityCandidates(observation,candidates);
    return toIdentityResolutionDto(observation,result);
  });
}
