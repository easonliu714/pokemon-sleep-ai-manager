export const POKEMON_SCORING_RULE_REGISTRY_VERSION='pokemon-scoring-rules-2026-08-09-b';

const rule=(dimension,status,featureInputs,reason,{formula=null,sourceRefs=[],ruleVersion=null}={})=>Object.freeze({
  dimension,
  status,
  feature_inputs:Object.freeze([...featureInputs]),
  formula,
  score_range:Object.freeze([0,100]),
  source_refs:Object.freeze([...sourceRefs]),
  reason,
  rule_version:ruleVersion||POKEMON_SCORING_RULE_REGISTRY_VERSION,
});

/**
 * A numeric score is activated only when the project has an explicit semantic
 * meaning, exact formula, evidence/governance source and deterministic fixture.
 * Feature projection itself remains fact-only; scoring is a separate layer.
 */
export const POKEMON_SCORING_RULES=Object.freeze({
  intrinsic_score:rule(
    'intrinsic_score','FEATURE_ONLY',
    ['specialty','nature_axes','main_skill','subskills','ingredient_slots','helper_seconds','carry_limit'],
    '個體長期價值需要 specialty-aware 權重與遊戲機制證據；目前只投影 facts，不猜總分。',
  ),
  current_readiness_score:rule(
    'current_readiness_score','ACTIVE_VERIFIED',
    ['known_ingredient_slot_count','known_subskill_slot_count','unlocked_ingredient_slot_count','unlocked_subskill_slot_count'],
    '目前僅量測已記錄能力槽位的解鎖成熟度；不是產能、總體強度或長期價值。',
    {
      formula:'100 * unlocked_known_slots / known_unlock_slots',
      sourceRefs:['docs/WAR_ROOM_SCORING_RULES_V1.md'],
      ruleVersion:'current-unlock-readiness-2026-08-09-a',
    },
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
