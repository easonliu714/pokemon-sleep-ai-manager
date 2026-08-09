export const TEAM_OPTIMIZER_VERSION='team-optimizer-2026-08-09-a';
export const TEAM_SIZE=5;

const text=value=>String(value??'').normalize('NFKC').trim();
const numeric=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function list(value){return [...new Set((Array.isArray(value)?value:[]).map(text).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));}
function candidateId(row){return text(row?.pokemon_id);}
function species(row){return text(row?.species||row?.current_species);}
function role(row){return text(row?.specialty);}
function completeness(row){return Number(row?.profile_completeness?.ratio||0);}
function ingredientCoverage(row){return Number(row?.weekly_ingredient_demand_covered||0);}
function readiness(row){const n=numeric(row?.current_readiness_score);return n===null?-1:n;}
function favorite(row){return row?.favorite_berry_match===true?1:0;}
function reviewRank(row){return row?.hard_constraint_status==='PASS'?0:row?.hard_constraint_status==='REVIEW'?1:2;}

export function compareTeamCandidates(a,b){
  if(reviewRank(a)!==reviewRank(b))return reviewRank(a)-reviewRank(b);
  if(ingredientCoverage(b)!==ingredientCoverage(a))return ingredientCoverage(b)-ingredientCoverage(a);
  if(favorite(b)!==favorite(a))return favorite(b)-favorite(a);
  if(readiness(b)!==readiness(a))return readiness(b)-readiness(a);
  if(completeness(b)!==completeness(a))return completeness(b)-completeness(a);
  const al=numeric(a?.level)??-1,bl=numeric(b?.level)??-1;if(bl!==al)return bl-al;
  return candidateId(a).localeCompare(candidateId(b));
}

function indexCandidates(candidates){
  const byId=new Map(),bySpecies=new Map();
  for(const row of candidates||[]){
    const id=candidateId(row);if(!id||byId.has(id))continue;
    byId.set(id,row);
    const name=species(row);if(name){if(!bySpecies.has(name))bySpecies.set(name,[]);bySpecies.get(name).push(row);}
  }
  for(const rows of bySpecies.values())rows.sort(compareTeamCandidates);
  return {byId,bySpecies};
}

function resolveMemberTokens(tokens,index){
  const resolved=[],missing=[],ambiguous=[];
  for(const token of list(tokens)){
    const exact=index.byId.get(token);
    if(exact){resolved.push(exact);continue;}
    const matches=index.bySpecies.get(token)||[];
    if(matches.length===1){resolved.push(matches[0]);continue;}
    if(matches.length===0)missing.push(token);else ambiguous.push({token,candidate_ids:matches.map(candidateId)});
  }
  return {resolved:[...new Map(resolved.map(row=>[candidateId(row),row])).values()],missing,ambiguous};
}

function speciesCount(rows,name){return rows.filter(row=>species(row)===name).length;}
function respectsSpeciesCap(selected,candidate,maxSameSpecies){return speciesCount(selected,species(candidate))<maxSameSpecies;}
function selectedIds(rows){return new Set(rows.map(candidateId));}

function candidateReasons(candidate,{mandatoryIds,nightIds,requiredRoles}){
  const reasons=[];
  const id=candidateId(candidate),candidateRole=role(candidate);
  if(mandatoryIds.has(id))reasons.push('HARD_CONSTRAINT_MANDATORY_MEMBER');
  if(nightIds.has(id))reasons.push('HARD_CONSTRAINT_NIGHT_EVOLUTION_MEMBER');
  if(requiredRoles.has(candidateRole))reasons.push(`TEAM_ROLE:${candidateRole}`);
  if(ingredientCoverage(candidate)>0)reasons.push(`WEEKLY_INGREDIENT_DEMAND_COVERAGE:${ingredientCoverage(candidate)}`);
  if(candidate.favorite_berry_match===true)reasons.push('WEEKLY_FAVORITE_BERRY_MATCH');
  if(numeric(candidate.current_readiness_score)!==null)reasons.push(`CURRENT_UNLOCK_READINESS:${candidate.current_readiness_score}`);
  if(completeness(candidate)>=1)reasons.push('PROFILE_COMPLETE');
  if(candidate.hard_constraint_status==='REVIEW')reasons.push('CANDIDATE_REVIEW_WARNING');
  if(!reasons.length)reasons.push('DETERMINISTIC_TIE_BREAK_SELECTION');
  return reasons;
}

function makeSlot(candidate,index,context){
  return Object.freeze({
    slot_index:index,
    is_leader:index===0,
    leader_semantics:index===0?'PRESENTATION_SLOT_ONLY_NO_VERIFIED_BONUS':null,
    pokemon_id:candidateId(candidate),
    pokemon_instance_id:text(candidate?.pokemon_instance_id)||null,
    species:species(candidate),
    level:numeric(candidate?.level),
    specialty:role(candidate)||null,
    hard_constraint_status:candidate?.hard_constraint_status||'REVIEW',
    current_readiness_score:numeric(candidate?.current_readiness_score),
    favorite_berry_match:candidate?.favorite_berry_match??null,
    weekly_ingredient_overlap:Object.freeze([...(candidate?.weekly_ingredient_overlap||[])]),
    reasons:Object.freeze(candidateReasons(candidate,context)),
  });
}

function teamCoverage(selected){
  const ingredientNames=new Set();let membersWithOverlap=0,berryMatches=0;
  for(const row of selected){
    const overlap=list(row?.weekly_ingredient_overlap);if(overlap.length)membersWithOverlap+=1;
    for(const name of overlap)ingredientNames.add(name);
    if(row?.favorite_berry_match===true)berryMatches+=1;
  }
  return Object.freeze({
    covered_ingredient_names:Object.freeze([...ingredientNames].sort((a,b)=>a.localeCompare(b,'zh-Hant'))),
    members_with_weekly_ingredient_overlap:membersWithOverlap,
    favorite_berry_match_member_count:berryMatches,
    numeric_energy_estimate:null,
  });
}

function buildSingleTeam({candidates,goalProfile,featureFingerprint=null,blockedIds=[]}){
  const constraints=goalProfile?.hard_constraints||{};
  const maxSameSpecies=Math.max(1,Math.min(TEAM_SIZE,Number(constraints.max_same_species||TEAM_SIZE)));
  const all=[...(candidates||[])].filter(row=>candidateId(row));
  const index=indexCandidates(all);
  const blocked=new Set(blockedIds.map(text));
  const eligible=all.filter(row=>row.hard_constraint_status!=='FAIL'&&!blocked.has(candidateId(row))).sort(compareTeamCandidates);
  const eligibleIndex=indexCandidates(eligible);
  const mandatoryResolution=resolveMemberTokens(constraints.must_include_pokemon,eligibleIndex);
  const nightResolution=resolveMemberTokens(constraints.sleep_evolution_member_at_night,eligibleIndex);
  const mandatory=[...new Map([...mandatoryResolution.resolved,...nightResolution.resolved].map(row=>[candidateId(row),row])).values()];
  const mandatoryIds=new Set(mandatory.map(candidateId)),nightIds=new Set(nightResolution.resolved.map(candidateId));
  const requiredRoles=new Set(list(constraints.must_include_role));
  const missingConstraints=[];const warnings=[];const satisfied=[];

  const missingMandatory=[...mandatoryResolution.missing,...nightResolution.missing];
  const ambiguousMandatory=[...mandatoryResolution.ambiguous,...nightResolution.ambiguous];
  if(missingMandatory.length)missingConstraints.push(...missingMandatory.map(value=>`mandatory_member_missing:${value}`));
  if(ambiguousMandatory.length)missingConstraints.push(...ambiguousMandatory.map(row=>`mandatory_member_ambiguous:${row.token}:${row.candidate_ids.join(',')}`));
  if(mandatory.length>TEAM_SIZE)missingConstraints.push(`mandatory_member_count_exceeds_team_size:${mandatory.length}`);
  const mandatoryFailTokens=list([...(constraints.must_include_pokemon||[]),...(constraints.sleep_evolution_member_at_night||[])]).filter(token=>{
    const exact=index.byId.get(token);if(exact)return exact.hard_constraint_status==='FAIL';
    const matches=index.bySpecies.get(token)||[];return matches.length===1&&matches[0].hard_constraint_status==='FAIL';
  });
  if(mandatoryFailTokens.length)missingConstraints.push(...mandatoryFailTokens.map(value=>`mandatory_member_hard_fail:${value}`));

  const selected=[];
  for(const row of mandatory.sort(compareTeamCandidates)){
    if(selected.some(existing=>candidateId(existing)===candidateId(row)))continue;
    if(!respectsSpeciesCap(selected,row,maxSameSpecies))missingConstraints.push(`mandatory_same_species_cap:${species(row)}`);
    else selected.push(row);
  }

  if(missingConstraints.some(value=>value.startsWith('mandatory_'))){
    const fp=`team_optimizer:${hash(JSON.stringify(stable({version:TEAM_OPTIMIZER_VERSION,featureFingerprint,goalProfile,blockedIds,missingConstraints})))}`;
    return Object.freeze({
      schema:'pokemon-sleep-team-optimizer/1.0',optimizer_version:TEAM_OPTIMIZER_VERSION,input_fingerprint:fp,
      team_id:`team_draft:${fp.split(':').pop()}`,team_status:'BLOCKED',slots:Object.freeze(selected.map((row,indexValue)=>makeSlot(row,indexValue,{mandatoryIds,nightIds,requiredRoles}))),
      satisfied_constraints:Object.freeze(satisfied),missing_constraints:Object.freeze([...new Set(missingConstraints)].sort()),warnings:Object.freeze(warnings),
      recipe_coverage:teamCoverage(selected),score_dimensions_used:Object.freeze(['current_readiness_score']),estimated_energy:null,player_data_write:false,gemini_used:false,
    });
  }

  const chosen=selectedIds(selected);
  const missingRoles=[...requiredRoles].filter(required=>!selected.some(row=>role(row)===required));
  for(const requiredRole of missingRoles){
    const candidate=eligible.find(row=>!chosen.has(candidateId(row))&&role(row)===requiredRole&&respectsSpeciesCap(selected,row,maxSameSpecies));
    if(candidate){selected.push(candidate);chosen.add(candidateId(candidate));satisfied.push(`required_role:${requiredRole}`);}
    else missingConstraints.push(`required_role_missing:${requiredRole}`);
  }

  for(const row of eligible){
    if(selected.length>=TEAM_SIZE)break;
    if(chosen.has(candidateId(row)))continue;
    if(!respectsSpeciesCap(selected,row,maxSameSpecies))continue;
    selected.push(row);chosen.add(candidateId(row));
  }

  for(const id of mandatoryIds)if(selected.some(row=>candidateId(row)===id))satisfied.push(`mandatory_member:${id}`);
  for(const id of nightIds)if(selected.some(row=>candidateId(row)===id))satisfied.push(`night_evolution_member:${id}`);
  if(selected.length<TEAM_SIZE)missingConstraints.push(`team_size:${selected.length}/${TEAM_SIZE}`);
  for(const requiredRole of requiredRoles)if(selected.some(row=>role(row)===requiredRole))satisfied.push(`required_role:${requiredRole}`);
  if(selected.some(row=>row.hard_constraint_status==='REVIEW'))warnings.push('TEAM_CONTAINS_REVIEW_CANDIDATE');
  if(selected.some(row=>numeric(row.current_readiness_score)===null))warnings.push('SOME_MEMBERS_HAVE_NO_CURRENT_READINESS_SCORE');
  warnings.push('LEADER_IS_PRESENTATION_SLOT_ONLY_NO_VERIFIED_BONUS');
  warnings.push('PRECISE_ENERGY_MODEL_NOT_ACTIVE');

  const status=selected.length===TEAM_SIZE&&missingConstraints.length===0?'READY':'INCOMPLETE';
  const slots=selected.slice(0,TEAM_SIZE).map((row,indexValue)=>makeSlot(row,indexValue,{mandatoryIds,nightIds,requiredRoles}));
  const fp=`team_optimizer:${hash(JSON.stringify(stable({version:TEAM_OPTIMIZER_VERSION,featureFingerprint,goalProfile,blockedIds,selected:slots.map(row=>row.pokemon_id),status,missingConstraints})))}`;
  return Object.freeze({
    schema:'pokemon-sleep-team-optimizer/1.0',optimizer_version:TEAM_OPTIMIZER_VERSION,input_fingerprint:fp,
    team_id:`team_draft:${fp.split(':').pop()}`,team_status:status,slots:Object.freeze(slots),
    satisfied_constraints:Object.freeze([...new Set(satisfied)].sort()),missing_constraints:Object.freeze([...new Set(missingConstraints)].sort()),warnings:Object.freeze([...new Set(warnings)].sort()),
    recipe_coverage:teamCoverage(selected.slice(0,TEAM_SIZE)),score_dimensions_used:Object.freeze(['current_readiness_score']),estimated_energy:null,player_data_write:false,gemini_used:false,
  });
}

export function optimizeTeam({scoringProjection,goalProfile,maxAlternatives=2}={}){
  const candidates=scoringProjection?.candidates||[];
  const featureFingerprint=scoringProjection?.feature_fingerprint||null;
  const primary=buildSingleTeam({candidates,goalProfile,featureFingerprint});
  const alternatives=[];
  if(primary.team_status==='READY'){
    const constraints=goalProfile?.hard_constraints||{};
    const mandatoryResolution=resolveMemberTokens([...(constraints.must_include_pokemon||[]),...(constraints.sleep_evolution_member_at_night||[])],indexCandidates(candidates.filter(row=>row.hard_constraint_status!=='FAIL')));
    const mandatoryIds=new Set(mandatoryResolution.resolved.map(candidateId));
    for(let index=primary.slots.length-1;index>=0&&alternatives.length<Math.max(0,Number(maxAlternatives)||0);index-=1){
      const slot=primary.slots[index];if(mandatoryIds.has(slot.pokemon_id))continue;
      const alternative=buildSingleTeam({candidates,goalProfile,featureFingerprint,blockedIds:[slot.pokemon_id]});
      if(alternative.team_status!=='READY')continue;
      if(alternative.slots.map(row=>row.pokemon_id).join('|')===primary.slots.map(row=>row.pokemon_id).join('|'))continue;
      if(alternatives.some(team=>team.slots.map(row=>row.pokemon_id).join('|')===alternative.slots.map(row=>row.pokemon_id).join('|')))continue;
      alternatives.push(alternative);
    }
  }
  return Object.freeze({
    schema:'pokemon-sleep-team-optimizer-result/1.0',optimizer_version:TEAM_OPTIMIZER_VERSION,
    primary,alternatives:Object.freeze(alternatives),
    input_fingerprint:`team_optimizer_result:${hash(JSON.stringify(stable({optimizer_version:TEAM_OPTIMIZER_VERSION,feature_fingerprint:featureFingerprint,goal_profile:goalProfile,primary:primary.input_fingerprint,alternatives:alternatives.map(row=>row.input_fingerprint)})))}`,
    player_data_write:false,gemini_used:false,estimated_energy:null,
  });
}
