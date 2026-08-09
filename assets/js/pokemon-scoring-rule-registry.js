export const POKEMON_SCORING_RULE_REGISTRY_VERSION='pokemon-scoring-rules-2026-08-09-a';

const rule=(dimension,status,featureInputs,reason)=>Object.freeze({
  dimension,
  status,
  feature_inputs:Object.freeze([...featureInputs]),
  formula:null,
  score_range:Object.freeze([0,100]),
  source_refs:Object.freeze([]),
  reason,
  rule_version:POKEMON_SCORING_RULE_REGISTRY_VERSION,
});

/**
 * Numeric scores are deliberately disabled until a rule has an explicit
 * strategy meaning, evidence/source notes and deterministic fixtures.
 * Feature projection may be available before a numeric score is activated.
 */
export const POKEMON_SCORING_RULES=Object.freeze({
  intrinsic_score:rule(
    'intrinsic_score','FEATURE_ONLY',
    ['specialty','nature_axes','main_skill','subskills','ingredient_slots','helper_seconds','carry_limit'],
    '個體長期價值需要 specialty-aware 權重與遊戲機制證據；目前只投影 facts，不猜總分。',
  ),
  current_readiness_score:rule(
    'current_readiness_score','FEATURE_ONLY',
    ['level','unlocked_subskills','unlocked_ingredients','main_skill_level','profile_completeness'],
    '目前可用能力可被 deterministic 投影，但尚未定義跨專長可比較的數值權重。',
  ),
  weekly_fit_score:rule(
    'weekly_fit_score','FEATURE_ONLY',
    ['favorite_berry_match','weekly_dish_ingredient_overlap','weekly_ingredient_demand_coverage','event_structured_match'],
    '週適配特徵可計算；在 event rule 與產量公式未完成前不轉為假精準分數。',
  ),
  roster_marginal_value_score:rule(
    'roster_marginal_value_score','DISABLED_NO_EVIDENCE',
    ['role_rarity','ingredient_capability_rarity','skill_role_rarity','duplicate_substitutability'],
    '需要整盒 roster baseline 與角色等價/替代規則，尚未建立。',
  ),
  training_roi_score:rule(
    'training_roi_score','DISABLED_NO_EVIDENCE',
    ['next_unlock_threshold','training_cost','expected_feature_gain','evolution_cost','resource_budget'],
    '需要 candy/shard/seed/evolution cost 與升級收益規則，尚未完成 Evidence。',
  ),
});

export function scoringRuleCoverage(){
  const status_counts={};
  for(const row of Object.values(POKEMON_SCORING_RULES))status_counts[row.status]=(status_counts[row.status]||0)+1;
  return Object.freeze({
    registry_version:POKEMON_SCORING_RULE_REGISTRY_VERSION,
    dimension_count:Object.keys(POKEMON_SCORING_RULES).length,
    active_numeric_count:Object.values(POKEMON_SCORING_RULES).filter(row=>row.status==='ACTIVE_VERIFIED').length,
    status_counts:Object.freeze(status_counts),
  });
}
