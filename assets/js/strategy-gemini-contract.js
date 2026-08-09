export const STRATEGY_GEMINI_CONTRACT_VERSION='strategy-gemini-2026-08-09-a';

const text=(value,max=500)=>String(value??'').normalize('NFKC').trim().slice(0,max);
const uniq=(values,max=20)=>[...new Set((Array.isArray(values)?values:[]).map(value=>text(value,120)).filter(Boolean))].slice(0,max);

export const STRATEGY_GEMINI_RESPONSE_SCHEMA=Object.freeze({
  type:'object',additionalProperties:false,
  properties:{
    strategy_summary:{type:'string'},
    recommended_candidate_refs:{type:'array',items:{type:'string',pattern:'^cand_[0-9]{3}$'}},
    recommended_recipe_ids:{type:'array',items:{type:'string'}},
    tradeoffs:{type:'array',items:{type:'object',additionalProperties:false,properties:{option:{type:'string'},pros:{type:'array',items:{type:'string'}},cons:{type:'array',items:{type:'string'}}},required:['option','pros','cons']}},
    warnings:{type:'array',items:{type:'string'}},
    missing_inputs:{type:'array',items:{type:'string'}},
    event_observation:{type:['object','null'],additionalProperties:false,properties:{summary:{type:'string'},structured_effects:{type:'array',items:{type:'object',additionalProperties:false,properties:{target:{type:'string'},effect:{type:'string'},value:{type:['string','number','null']},confidence:{type:['number','null']}},required:['target','effect','value','confidence']}}},required:['summary','structured_effects']},
  },
  required:['strategy_summary','recommended_candidate_refs','recommended_recipe_ids','tradeoffs','warnings','missing_inputs','event_observation'],
});

export const STRATEGY_GEMINI_SYSTEM_INSTRUCTION=`你是 Pokémon Sleep 戰情室的策略解釋層。數值與候選集合以本機 deterministic engine 為準；不得自行改寫分數、庫存、解鎖狀態或 Master facts。只可引用 payload 中的 cand_XXX；未知資料要列入 missing_inputs，不得猜補。回傳必須符合指定 JSON Schema，且只是建議，不代表 Apply。`;

function normalizeTradeoffs(value){
  return (Array.isArray(value)?value:[]).slice(0,8).map(row=>({option:text(row?.option,160),pros:uniq(row?.pros,8),cons:uniq(row?.cons,8)})).filter(row=>row.option);
}
function normalizeEvent(value){
  if(!value||typeof value!=='object')return null;
  return {
    summary:text(value.summary,500),
    structured_effects:(Array.isArray(value.structured_effects)?value.structured_effects:[]).slice(0,20).map(row=>({
      target:text(row?.target,120),effect:text(row?.effect,120),value:typeof row?.value==='number'&&Number.isFinite(row.value)?row.value:text(row?.value,120)||null,
      confidence:typeof row?.confidence==='number'&&Number.isFinite(row.confidence)?Math.max(0,Math.min(1,row.confidence)):null,
    })).filter(row=>row.target&&row.effect),
  };
}

export function normalizeGeminiStrategyResponse(input,{validCandidateRefs=[],validRecipeIds=[]}={}){
  const candidateSet=new Set(validCandidateRefs),recipeSet=new Set(validRecipeIds);
  const requestedCandidates=uniq(input?.recommended_candidate_refs,20),requestedRecipes=uniq(input?.recommended_recipe_ids,20);
  const acceptedCandidates=requestedCandidates.filter(value=>candidateSet.has(value)),acceptedRecipes=requestedRecipes.filter(value=>recipeSet.has(value));
  return {
    contract_version:STRATEGY_GEMINI_CONTRACT_VERSION,
    strategy_summary:text(input?.strategy_summary,1200),
    recommended_candidate_refs:acceptedCandidates,
    recommended_recipe_ids:acceptedRecipes,
    tradeoffs:normalizeTradeoffs(input?.tradeoffs),
    warnings:uniq(input?.warnings,20),
    missing_inputs:uniq(input?.missing_inputs,20),
    event_observation:normalizeEvent(input?.event_observation),
    rejected_refs:{candidate_refs:requestedCandidates.filter(value=>!candidateSet.has(value)),recipe_ids:requestedRecipes.filter(value=>!recipeSet.has(value))},
    apply_allowed:false,
    direct_player_write_allowed:false,
  };
}
