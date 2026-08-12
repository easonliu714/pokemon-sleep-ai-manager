export const BOUNDED_TEAM_SEARCH_VERSION='bounded-team-search-2026-08-12-a';
export const DEFAULT_TEAM_SEARCH_BUDGET=Object.freeze({candidate_pool_limit:20,beam_width:8,max_team_evaluations:64,top_k:3,max_replacement_depth:3});

const text=value=>String(value??'').normalize('NFKC').trim();
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
const uniq=value=>[...new Set((Array.isArray(value)?value:[]).map(text).filter(Boolean))];
const id=row=>text(row?.pokemon_id);
const species=row=>text(row?.species||row?.current_species);
const role=row=>text(row?.specialty);
function teamKey(ids){return ids.map(text).join('|');}
function tokenMatches(candidate,token){return id(candidate)===token||species(candidate)===token;}

function normalizeBudget(input={}){
  const bounded=(value,fallback,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Math.trunc(Number(value)):fallback));
  return Object.freeze({
    candidate_pool_limit:bounded(input.candidate_pool_limit,DEFAULT_TEAM_SEARCH_BUDGET.candidate_pool_limit,5,50),
    beam_width:bounded(input.beam_width,DEFAULT_TEAM_SEARCH_BUDGET.beam_width,1,32),
    max_team_evaluations:bounded(input.max_team_evaluations,DEFAULT_TEAM_SEARCH_BUDGET.max_team_evaluations,1,512),
    top_k:bounded(input.top_k,DEFAULT_TEAM_SEARCH_BUDGET.top_k,1,10),
    max_replacement_depth:bounded(input.max_replacement_depth,DEFAULT_TEAM_SEARCH_BUDGET.max_replacement_depth,1,5),
  });
}

function validateTeamIds(teamIds,{candidateById,hardConstraints={},seedTeamIds=[]}={}){
  const reasons=[];const ids=teamIds.map(text);
  if(ids.length!==5)reasons.push(`team_size:${ids.length}/5`);
  if(new Set(ids).size!==ids.length)reasons.push('duplicate_member');
  const rows=ids.map(value=>candidateById.get(value)).filter(Boolean);
  if(rows.length!==ids.length)reasons.push('candidate_missing');
  if(rows.some(row=>row.hard_constraint_status==='FAIL'))reasons.push('hard_fail_candidate');
  const exclude=uniq(hardConstraints.exclude_pokemon),must=uniq([...(hardConstraints.must_include_pokemon||[]),...(hardConstraints.sleep_evolution_member_at_night||[])]);
  for(const token of exclude)if(rows.some(row=>tokenMatches(row,token)))reasons.push(`excluded_member:${token}`);
  for(const token of must)if(!rows.some(row=>tokenMatches(row,token)))reasons.push(`mandatory_member_missing:${token}`);
  for(const required of uniq(hardConstraints.must_include_role))if(!rows.some(row=>role(row)===required))reasons.push(`required_role_missing:${required}`);
  const maxSame=Number(hardConstraints.max_same_species||5);if(Number.isFinite(maxSame)&&maxSame>0){
    const counts=new Map();for(const row of rows){const name=species(row);counts.set(name,(counts.get(name)||0)+1);}for(const [name,count] of counts)if(count>maxSame)reasons.push(`same_species_cap:${name}:${count}/${maxSame}`);
  }
  const preserve=new Set((hardConstraints.preserve_current_team_slots||[]).map(Number).filter(value=>value>=1&&value<=5));
  for(const slot of preserve){if(text(ids[slot-1])!==text(seedTeamIds[slot-1]))reasons.push(`preserve_slot:${slot}`);}
  return {valid:reasons.length===0,reasons:[...new Set(reasons)].sort()};
}

function compareEvaluations(a,b){
  const as=Number(a.objective_score),bs=Number(b.objective_score),af=Number.isFinite(as),bf=Number.isFinite(bs);
  if(af!==bf)return af?-1:1;if(af&&bs!==as)return bs-as;return a.team_key.localeCompare(b.team_key);
}

function neighbors(teamIds,pool,{candidateById,hardConstraints,seedTeamIds}){
  const preserve=new Set((hardConstraints?.preserve_current_team_slots||[]).map(Number));
  const current=new Set(teamIds);const output=[];
  for(let slot=0;slot<teamIds.length;slot+=1){
    if(preserve.has(slot+1))continue;
    for(const candidate of pool){
      const candidateId=id(candidate);if(!candidateId||current.has(candidateId)||candidate.hard_constraint_status==='FAIL')continue;
      const next=[...teamIds];next[slot]=candidateId;
      const check=validateTeamIds(next,{candidateById,hardConstraints,seedTeamIds});if(!check.valid)continue;
      output.push(next);
    }
  }
  return output.sort((a,b)=>teamKey(a).localeCompare(teamKey(b)));
}

export function searchTeamsBounded({candidateRows=[],seedTeamIds=[],hardConstraints={},budget={},evaluateTeam}={}){
  if(typeof evaluateTeam!=='function')throw new Error('evaluateTeam function is required');
  const normalizedBudget=normalizeBudget(budget),eligible=(candidateRows||[]).filter(row=>id(row)&&row.hard_constraint_status!=='FAIL').slice(0,normalizedBudget.candidate_pool_limit);
  const candidateById=new Map((candidateRows||[]).filter(row=>id(row)).map(row=>[id(row),row]));
  const seed=seedTeamIds.map(text).filter(Boolean),seedCheck=validateTeamIds(seed,{candidateById,hardConstraints,seedTeamIds:seed});
  if(!seedCheck.valid)return Object.freeze({
    schema:'pokemon-sleep-bounded-team-search/1.0',search_version:BOUNDED_TEAM_SEARCH_VERSION,search_status:'BLOCKED_INVALID_SEED',stop_reason:'INVALID_SEED_TEAM',
    budget:normalizedBudget,evaluated_count:0,pruned_count:0,frontier_count:0,top_teams:Object.freeze([]),seed_validation:Object.freeze(seedCheck),input_fingerprint:null,global_optimum_claimed:false,player_data_write:false,gemini_used:false,
  });
  const evaluated=new Map(),visited=new Set();let pruned=0,depth=0,frontier=[seed];
  const evaluate=ids=>{
    const key=teamKey(ids);if(evaluated.has(key))return evaluated.get(key);if(evaluated.size>=normalizedBudget.max_team_evaluations)return null;
    const teamRows=ids.map(value=>candidateById.get(value));const result=evaluateTeam(teamRows,ids)||{};
    const score=Number.isFinite(Number(result.objective_score))?Number(result.objective_score):null;
    const row=Object.freeze({team_key:key,team_ids:Object.freeze([...ids]),objective_score:score,objective_status:result.objective_status||null,evaluation_fingerprint:result.input_fingerprint||null,evaluation:result});
    evaluated.set(key,row);return row;
  };
  const seedEvaluation=evaluate(seed);
  if(seedEvaluation?.objective_score===null){
    const fp=`team_search:${hash(JSON.stringify(stable({version:BOUNDED_TEAM_SEARCH_VERSION,budget:normalizedBudget,seed,hardConstraints,seed_evaluation:seedEvaluation?.evaluation_fingerprint||null,stop:'OBJECTIVE_MODEL_NOT_ACTIVE'})))}`;
    return Object.freeze({
      schema:'pokemon-sleep-bounded-team-search/1.0',search_version:BOUNDED_TEAM_SEARCH_VERSION,search_status:'HOLD',stop_reason:'OBJECTIVE_MODEL_NOT_ACTIVE',budget:normalizedBudget,
      evaluated_count:evaluated.size,pruned_count:0,frontier_count:0,top_teams:Object.freeze(seedEvaluation?[seedEvaluation]:[]),seed_validation:Object.freeze(seedCheck),input_fingerprint:fp,global_optimum_claimed:false,player_data_write:false,gemini_used:false,
    });
  }
  while(frontier.length&&evaluated.size<normalizedBudget.max_team_evaluations&&depth<normalizedBudget.max_replacement_depth){
    const proposed=[];
    for(const ids of frontier){
      visited.add(teamKey(ids));
      for(const next of neighbors(ids,eligible,{candidateById,hardConstraints,seedTeamIds:seed})){
        const key=teamKey(next);if(visited.has(key)||evaluated.has(key)||proposed.some(row=>teamKey(row)===key)){pruned+=1;continue;}proposed.push(next);
      }
    }
    const evaluatedLevel=[];
    for(const ids of proposed){const row=evaluate(ids);if(!row)break;if(row.objective_score===null){pruned+=1;continue;}evaluatedLevel.push(row);}
    evaluatedLevel.sort(compareEvaluations);frontier=evaluatedLevel.slice(0,normalizedBudget.beam_width).map(row=>[...row.team_ids]);pruned+=Math.max(0,evaluatedLevel.length-frontier.length);depth+=1;
  }
  const ranked=[...evaluated.values()].filter(row=>row.objective_score!==null).sort(compareEvaluations),budgetHit=evaluated.size>=normalizedBudget.max_team_evaluations;
  const stopReason=budgetHit?'BEST_FOUND_UNDER_BUDGET':depth>=normalizedBudget.max_replacement_depth?'MAX_REPLACEMENT_DEPTH_REACHED':'SEARCH_SPACE_EXHAUSTED';
  const fp=`team_search:${hash(JSON.stringify(stable({version:BOUNDED_TEAM_SEARCH_VERSION,budget:normalizedBudget,seed,hardConstraints,evaluations:[...evaluated.values()].map(row=>[row.team_key,row.objective_score,row.evaluation_fingerprint]),stopReason})))}`;
  return Object.freeze({
    schema:'pokemon-sleep-bounded-team-search/1.0',search_version:BOUNDED_TEAM_SEARCH_VERSION,search_status:'READY',stop_reason:stopReason,budget:normalizedBudget,
    evaluated_count:evaluated.size,pruned_count:pruned,frontier_count:frontier.length,replacement_depth_reached:depth,top_teams:Object.freeze(ranked.slice(0,normalizedBudget.top_k)),seed_validation:Object.freeze(seedCheck),
    input_fingerprint:fp,global_optimum_claimed:false,player_data_write:false,gemini_used:false,
  });
}
