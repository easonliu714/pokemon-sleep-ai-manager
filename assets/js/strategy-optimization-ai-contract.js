export const STRATEGY_OPTIMIZATION_AI_CONTRACT_VERSION='strategy-optimization-ai-2026-08-12-a';

const text=(value,max=800)=>String(value??'').normalize('NFKC').trim().slice(0,max);
const uniq=(values,max=20)=>[...new Set((Array.isArray(values)?values:[]).map(value=>text(value,120)).filter(Boolean))].slice(0,max);

export const STRATEGY_OPTIMIZATION_AI_RESPONSE_SCHEMA=Object.freeze({
  type:'object',additionalProperties:false,
  properties:{
    strategy_summary:{type:'string'},
    team_proposals:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,properties:{
      candidate_refs:{type:'array',minItems:5,maxItems:5,items:{type:'string',pattern:'^cand_[0-9]{3}$'}},
      target_recipe_ids:{type:'array',items:{type:'string'}},
      rationale:{type:'string'},
      expected_tradeoff:{type:'string'},
    },required:['candidate_refs','target_recipe_ids','rationale','expected_tradeoff']}},
    warnings:{type:'array',items:{type:'string'}},
    missing_inputs:{type:'array',items:{type:'string'}},
  },
  required:['strategy_summary','team_proposals','warnings','missing_inputs'],
});

export const STRATEGY_OPTIMIZATION_AI_SYSTEM_INSTRUCTION=`你是 Pokémon Sleep 隊伍搜尋的候選提案器，不是數值計算 Authority。只可依 Strategy Optimization Pack 中的 candidate_ref、recipe_id、observed facts 與 authority status 提出值得由平台重新計算的 5 人隊伍。不得自行捏造 ingredient/hour、berry/hour、skill trigger、料理能量、庫存或任何缺少的數值；NOT_YET_VERIFIED 必須視為未知。必選、排除、保留 slot 與其他 Hard Constraints 不得違反。你可以提出多組不同 trade-off 的隊伍，但每組都只是 proposal，最終分數必須由 deterministic evaluator 重算。回傳只能符合指定 JSON Schema。`;

export function buildExternalOptimizationPrompt(payload){
  return `${STRATEGY_OPTIMIZATION_AI_SYSTEM_INSTRUCTION}\n\n請分析以下 Strategy Optimization Pack，最多提出 6 組候選隊伍。若 production rate 尚未 verified，請把結論限制在定性替換策略與需要補齊的資料，不得輸出假精度數值。\n\n${JSON.stringify(payload,null,2)}`;
}

export function normalizeOptimizationAiResponse(input,{validCandidateRefs=[],validRecipeIds=[]}={}){
  const candidateSet=new Set(validCandidateRefs),recipeSet=new Set(validRecipeIds),rejectedCandidateRefs=[],rejectedRecipeIds=[];
  const proposals=[];
  for(const row of (Array.isArray(input?.team_proposals)?input.team_proposals:[]).slice(0,6)){
    const requested=uniq(row?.candidate_refs,5);const accepted=requested.filter(ref=>candidateSet.has(ref));
    rejectedCandidateRefs.push(...requested.filter(ref=>!candidateSet.has(ref)));
    if(accepted.length!==5||new Set(accepted).size!==5)continue;
    const requestedRecipes=uniq(row?.target_recipe_ids,12),acceptedRecipes=requestedRecipes.filter(id=>recipeSet.has(id));rejectedRecipeIds.push(...requestedRecipes.filter(id=>!recipeSet.has(id)));
    proposals.push({candidate_refs:accepted,target_recipe_ids:acceptedRecipes,rationale:text(row?.rationale,1200),expected_tradeoff:text(row?.expected_tradeoff,800),apply_allowed:false,deterministic_re_evaluation_required:true});
  }
  return {
    contract_version:STRATEGY_OPTIMIZATION_AI_CONTRACT_VERSION,strategy_summary:text(input?.strategy_summary,1600),team_proposals:proposals,
    warnings:uniq(input?.warnings,20),missing_inputs:uniq(input?.missing_inputs,20),rejected_refs:{candidate_refs:uniq(rejectedCandidateRefs,50),recipe_ids:uniq(rejectedRecipeIds,50)},
    apply_allowed:false,direct_player_write_allowed:false,numeric_authority:false,
  };
}
