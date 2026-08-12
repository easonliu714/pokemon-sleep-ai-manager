export const STRATEGY_OPTIMIZATION_AI_CONTRACT_VERSION='strategy-optimization-ai-2026-08-12-b-response-schema';
export const STRATEGY_OPTIMIZATION_AI_INTAKE_VERSION='strategy-optimization-ai-intake-2026-08-12-a';

const text=(value,max=800)=>String(value??'').normalize('NFKC').trim().slice(0,max);
const uniq=(values,max=20)=>[...new Set((Array.isArray(values)?values:[]).map(value=>text(value,120)).filter(Boolean))].slice(0,max);

export const STRATEGY_OPTIMIZATION_AI_RESPONSE_SCHEMA=Object.freeze({
  type:'object',additionalProperties:false,
  properties:{
    context_fingerprint:{type:'string'},
    strategy_summary:{type:'string'},
    team_proposals:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,properties:{
      proposal_id:{type:'string'},proposal_name:{type:'string'},
      candidate_refs:{type:'array',minItems:5,maxItems:5,items:{type:'string',pattern:'^cand_[0-9]{3}$'}},
      target_recipe_ids:{type:'array',items:{type:'string'}},
      qualitative_focus:{type:'string'},rationale:{type:'string'},expected_tradeoff:{type:'string'},
      missing_data_dependencies:{type:'array',items:{type:'string'}},
    },required:['candidate_refs','target_recipe_ids','rationale','expected_tradeoff']}},
    warnings:{type:'array',items:{type:'string'}},
    missing_inputs:{type:'array',items:{type:'string'}},
  },
  required:['context_fingerprint','strategy_summary','team_proposals','warnings','missing_inputs'],
});

export const STRATEGY_OPTIMIZATION_AI_SYSTEM_INSTRUCTION=`你是 Pokémon Sleep 隊伍搜尋的候選提案器，不是數值計算 Authority。只可依 Strategy Optimization Pack 中的 candidate_ref、recipe_id、observed facts 與 authority status 提出值得由平台重新計算的 5 人隊伍。不得自行捏造 ingredient/hour、berry/hour、skill trigger、料理能量、庫存或任何缺少的數值；NOT_YET_VERIFIED 必須視為未知。必選、排除、保留 slot 與其他 Hard Constraints 不得違反。你可以提出多組不同 trade-off 的隊伍，但每組都只是 proposal，最終分數必須由 deterministic evaluator 重算。回傳只能符合指定 JSON Schema。`;

export function buildExternalOptimizationPrompt(payload){
  const expectedFingerprint=text(payload?.context_fingerprint,240);
  return `${STRATEGY_OPTIMIZATION_AI_SYSTEM_INSTRUCTION}\n\n請分析以下 Strategy Optimization Pack，最多提出 6 組候選隊伍。若 production rate 尚未 verified，請把結論限制在定性替換策略與需要補齊的資料，不得輸出假精度數值。\n\n重要回傳契約：\n1. 必須只輸出單一 JSON object，不要 Markdown code fence。\n2. 不得自行重新命名欄位；隊伍成員必須放在 team_proposals[].candidate_refs。\n3. context_fingerprint 必須原樣回傳為 ${expectedFingerprint||'(payload.context_fingerprint)'}；不得自行產生新的 fingerprint。\n4. Response Contract Version：${STRATEGY_OPTIMIZATION_AI_CONTRACT_VERSION}\n5. Response JSON Schema：\n${JSON.stringify(STRATEGY_OPTIMIZATION_AI_RESPONSE_SCHEMA,null,2)}\n\nStrategy Optimization Pack：\n${JSON.stringify(payload,null,2)}`;
}

export function normalizeOptimizationAiResponse(input,{validCandidateRefs=[],validRecipeIds=[]}={}){
  const candidateSet=new Set(validCandidateRefs),recipeSet=new Set(validRecipeIds),rejectedCandidateRefs=[],rejectedRecipeIds=[];
  const proposals=[];
  for(const row of (Array.isArray(input?.team_proposals)?input.team_proposals:[]).slice(0,6)){
    const requested=uniq(row?.candidate_refs,5);const accepted=requested.filter(ref=>candidateSet.has(ref));
    rejectedCandidateRefs.push(...requested.filter(ref=>!candidateSet.has(ref)));
    if(accepted.length!==5||new Set(accepted).size!==5)continue;
    const requestedRecipes=uniq(row?.target_recipe_ids,12),acceptedRecipes=requestedRecipes.filter(id=>recipeSet.has(id));rejectedRecipeIds.push(...requestedRecipes.filter(id=>!recipeSet.has(id)));
    proposals.push({
      proposal_id:text(row?.proposal_id,120)||null,proposal_name:text(row?.proposal_name,240)||null,
      candidate_refs:accepted,target_recipe_ids:acceptedRecipes,qualitative_focus:text(row?.qualitative_focus,240)||null,
      rationale:text(row?.rationale,1200),expected_tradeoff:text(row?.expected_tradeoff,800),missing_data_dependencies:uniq(row?.missing_data_dependencies,30),
      apply_allowed:false,deterministic_re_evaluation_required:true,
    });
  }
  return {
    contract_version:STRATEGY_OPTIMIZATION_AI_CONTRACT_VERSION,context_fingerprint:text(input?.context_fingerprint,240)||null,strategy_summary:text(input?.strategy_summary,1600),team_proposals:proposals,
    warnings:uniq(input?.warnings,20),missing_inputs:uniq(input?.missing_inputs,20),rejected_refs:{candidate_refs:uniq(rejectedCandidateRefs,50),recipe_ids:uniq(rejectedRecipeIds,50)},
    apply_allowed:false,direct_player_write_allowed:false,numeric_authority:false,
  };
}

function adaptLegacyGeminiResponse(input){
  const proposals=(Array.isArray(input?.proposals)?input.proposals:[]).slice(0,6).map(row=>({
    proposal_id:text(row?.proposal_id,120)||null,
    proposal_name:text(row?.proposal_name,240)||null,
    candidate_refs:uniq(row?.team_slots,5),
    target_recipe_ids:uniq(row?.target_recipe_ids,12),
    qualitative_focus:text(row?.qualitative_focus,240)||null,
    rationale:text(row?.trade_off_description,1200),
    expected_tradeoff:text(row?.trade_off_description,800),
    missing_data_dependencies:uniq(row?.missing_data_dependencies,30),
  }));
  const requiredRules=uniq(input?.authority_status?.required_rules_to_verify,30);
  const proposalMissing=uniq(proposals.flatMap(row=>row.missing_data_dependencies||[]),30);
  return {
    context_fingerprint:text(input?.context_fingerprint,240)||null,
    strategy_summary:text(input?.evaluation_note,1600)||'Legacy Gemini proposal pack normalized by platform intake.',
    team_proposals:proposals,
    warnings:input?.authority_status?.numeric_rate_model_status&&input.authority_status.numeric_rate_model_status!=='ACTIVE_VERIFIED'?[`numeric_rate_model_status:${text(input.authority_status.numeric_rate_model_status,80)}`]:[],
    missing_inputs:uniq([...requiredRules,...proposalMissing],40),
  };
}

export function adaptOptimizationAiResponse(input){
  if(input&&Array.isArray(input.team_proposals))return {adapter:'CANONICAL',canonical:input};
  if(input&&Array.isArray(input.proposals)&&input.proposals.some(row=>Array.isArray(row?.team_slots)))return {adapter:'LEGACY_GEMINI_TEAM_SLOTS',canonical:adaptLegacyGeminiResponse(input)};
  return {adapter:'UNRECOGNIZED',canonical:{context_fingerprint:text(input?.context_fingerprint,240)||null,strategy_summary:'',team_proposals:[],warnings:[],missing_inputs:[]}};
}

function candidateMap(payload){return new Map((payload?.candidate_production_readiness||[]).map(row=>[text(row?.candidate_ref,80),row]).filter(([ref])=>ref));}
function matchesSpecies(row,species){return text(row?.species,120)===text(species,120);}
function validateHardConstraints(refs,payload){
  const reasons=[];const ids=refs.map(ref=>text(ref,80));const unique=new Set(ids);const candidates=candidateMap(payload);const rows=ids.map(ref=>candidates.get(ref));
  if(ids.length!==5)reasons.push(`team_size:${ids.length}/5`);
  if(unique.size!==ids.length)reasons.push('duplicate_member');
  for(const ref of ids)if(!candidates.has(ref))reasons.push(`unknown_candidate_ref:${ref}`);
  const hard=payload?.goal_profile?.hard_constraints||{};
  const mustRefs=uniq([...(hard?.must_include?.candidate_refs||[]),...(hard?.sleep_evolution_member_at_night?.candidate_refs||[])],30);
  const mustSpecies=uniq([...(hard?.must_include?.species||[]),...(hard?.sleep_evolution_member_at_night?.species||[])],30);
  const excludeRefs=new Set(uniq(hard?.exclude?.candidate_refs,30)),excludeSpecies=uniq(hard?.exclude?.species,30);
  for(const ref of mustRefs)if(!unique.has(ref))reasons.push(`mandatory_member_missing:${ref}`);
  for(const species of mustSpecies)if(!rows.some(row=>row&&matchesSpecies(row,species)))reasons.push(`mandatory_species_missing:${species}`);
  for(const ref of ids)if(excludeRefs.has(ref))reasons.push(`excluded_member:${ref}`);
  for(const species of excludeSpecies)if(rows.some(row=>row&&matchesSpecies(row,species)))reasons.push(`excluded_species:${species}`);
  for(const requiredRole of uniq(hard?.must_include_role,12))if(!rows.some(row=>text(row?.specialty,80)===requiredRole))reasons.push(`required_role_missing:${requiredRole}`);
  const maxSame=Number(hard?.max_same_species);if(Number.isFinite(maxSame)&&maxSame>0){const counts=new Map();for(const row of rows.filter(Boolean)){const species=text(row?.species,120);counts.set(species,(counts.get(species)||0)+1);}for(const [species,count] of counts)if(count>maxSame)reasons.push(`same_species_cap:${species}:${count}/${maxSame}`);}
  const seed=payload?.seed_team?.candidate_refs||[];for(const slot of (hard?.preserve_current_team_slots||[]).map(Number).filter(value=>value>=1&&value<=5)){if(text(ids[slot-1],80)!==text(seed[slot-1],80))reasons.push(`preserve_slot:${slot}`);}
  return {valid:reasons.length===0,reasons:[...new Set(reasons)].sort()};
}

export function intakeOptimizationAiResponse(input,{optimizationPreview=null,evaluateProposal=null}={}){
  const payload=optimizationPreview?.payload||optimizationPreview||{};
  const expectedFingerprint=text(payload?.context_fingerprint,240)||null;
  const adapted=adaptOptimizationAiResponse(input);
  const candidateRefs=(payload?.candidate_production_readiness||[]).map(row=>row.candidate_ref).filter(Boolean);
  const recipeIds=(payload?.recipe_gap_summary||[]).map(row=>row.recipe_id).filter(Boolean);
  const normalized=normalizeOptimizationAiResponse(adapted.canonical,{validCandidateRefs:candidateRefs,validRecipeIds:recipeIds});
  const receivedFingerprint=text(adapted.canonical?.context_fingerprint,240)||null;
  const fingerprintMatch=Boolean(expectedFingerprint&&receivedFingerprint===expectedFingerprint);
  const rejected=[];const accepted=[];
  if(!fingerprintMatch){
    for(const row of (adapted.canonical?.team_proposals||[]).slice(0,6))rejected.push({proposal_id:text(row?.proposal_id,120)||null,candidate_refs:uniq(row?.candidate_refs,10),reasons:['context_fingerprint_mismatch']});
    return Object.freeze({
      schema:'pokemon-sleep-strategy-optimization-ai-intake/1.0',intake_version:STRATEGY_OPTIMIZATION_AI_INTAKE_VERSION,intake_status:'BLOCKED_CONTEXT_MISMATCH',adapter:adapted.adapter,
      expected_context_fingerprint:expectedFingerprint,received_context_fingerprint:receivedFingerprint,context_fingerprint_match:false,accepted_proposals:Object.freeze([]),rejected_proposals:Object.freeze(rejected.map(Object.freeze)),
      normalized_response:normalized,apply_allowed:false,direct_player_write_allowed:false,numeric_authority:false,player_data_write:false,
    });
  }
  const normalizedByKey=new Map((normalized.team_proposals||[]).map(row=>[(row.proposal_id||'')+'|'+row.candidate_refs.join('|'),row]));
  for(const raw of (adapted.canonical?.team_proposals||[]).slice(0,6)){
    const refs=uniq(raw?.candidate_refs,10);const hard=validateHardConstraints(refs,payload);const key=(text(raw?.proposal_id,120)||'')+'|'+refs.filter(ref=>candidateRefs.includes(ref)).join('|');
    const normalizedRow=normalizedByKey.get(key)||null;const reasons=[...hard.reasons];
    if(refs.some(ref=>!candidateRefs.includes(ref)))for(const ref of refs.filter(ref=>!candidateRefs.includes(ref)))reasons.push(`unknown_candidate_ref:${ref}`);
    if(!normalizedRow&&refs.length===5&&!reasons.length)reasons.push('normalization_rejected');
    if(reasons.length){rejected.push({proposal_id:text(raw?.proposal_id,120)||null,proposal_name:text(raw?.proposal_name,240)||null,candidate_refs:refs,reasons:[...new Set(reasons)].sort()});continue;}
    let evaluation=null;try{evaluation=typeof evaluateProposal==='function'?evaluateProposal(normalizedRow.candidate_refs,normalizedRow):null;}catch(error){evaluation={objective_status:'EVALUATION_ERROR',objective_score:null,error:text(error?.message||String(error),600)};}
    const rawScore=evaluation?.objective_score;const numericScore=rawScore===null||rawScore===undefined||rawScore===''||!Number.isFinite(Number(rawScore))?null:Number(rawScore);
    accepted.push({
      ...normalizedRow,hard_constraints_status:'PASS',hard_constraint_reasons:Object.freeze([]),
      deterministic_evaluation:evaluation||null,deterministic_re_evaluation_status:evaluation?(numericScore===null?'HOLD':'READY'):'RE_EVALUATION_REQUIRED',objective_score:numericScore,
      apply_allowed:false,direct_player_write_allowed:false,
    });
  }
  return Object.freeze({
    schema:'pokemon-sleep-strategy-optimization-ai-intake/1.0',intake_version:STRATEGY_OPTIMIZATION_AI_INTAKE_VERSION,intake_status:accepted.length?'READY_FOR_REVIEW':rejected.length?'NO_ACCEPTED_PROPOSALS':'EMPTY_RESPONSE',adapter:adapted.adapter,
    expected_context_fingerprint:expectedFingerprint,received_context_fingerprint:receivedFingerprint,context_fingerprint_match:true,accepted_proposals:Object.freeze(accepted.map(Object.freeze)),rejected_proposals:Object.freeze(rejected.map(Object.freeze)),
    normalized_response:normalized,apply_allowed:false,direct_player_write_allowed:false,numeric_authority:false,player_data_write:false,
  });
}
