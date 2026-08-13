import {
  POKEMON_SCORING_RULES,
  POKEMON_SCORING_RULE_REGISTRY_VERSION,
} from './pokemon-scoring-rule-registry.js';
import {resolvePokemonProductionModifierProfile} from './pokemon-master-options.js';

export const POKEMON_SCORING_ENGINE_VERSION='pokemon-scoring-engine-2026-08-13-b-production-modifiers';

const round2=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
const nullScores=()=>({
  intrinsic_score:null,
  current_readiness_score:null,
  weekly_fit_score:null,
  roster_marginal_value_score:null,
  training_roi_score:null,
});

function currentUnlockReadiness(feature){
  const known=Number(feature.known_unlock_slot_count||0),unlocked=Number(feature.unlocked_known_slot_count||0);
  if(!Number.isFinite(known)||known<=0)return {
    score:null,
    rule_id:'CURRENT_UNLOCK_READINESS_V1',
    missing_inputs:['known_unlock_slots'],
    breakdown:{known_unlock_slots:0,unlocked_known_slots:Math.max(0,unlocked)},
  };
  const bounded=Math.max(0,Math.min(known,Number.isFinite(unlocked)?unlocked:0));
  return {
    score:round2(100*bounded/known),
    rule_id:'CURRENT_UNLOCK_READINESS_V1',
    missing_inputs:[],
    breakdown:{
      known_ingredient_slots:Number(feature.known_ingredient_slot_count||0),
      known_subskill_slots:Number(feature.known_subskill_slot_count||0),
      unlocked_ingredient_slots:Number(feature.unlocked_ingredient_slot_count||0),
      unlocked_subskill_slots:Number(feature.unlocked_subskill_slot_count||0),
      known_unlock_slots:known,
      unlocked_known_slots:bounded,
      formula:'100 * unlocked_known_slots / known_unlock_slots',
    },
  };
}

export function scorePokemonCandidateFeatures(featureProjection){
  const candidates=(featureProjection?.candidates||[]).map(feature=>{
    const scores=nullScores(),score_breakdown={},missing_inputs=[],reasons=[];
    const production_modifier_profile=resolvePokemonProductionModifierProfile(feature);
    const readinessRule=POKEMON_SCORING_RULES.current_readiness_score;
    if(readinessRule.status==='ACTIVE_VERIFIED'){
      const result=currentUnlockReadiness(feature);
      scores.current_readiness_score=result.score;
      score_breakdown.current_readiness_score={
        rule_id:result.rule_id,
        rule_version:readinessRule.rule_version,
        source_refs:[...readinessRule.source_refs],
        ...result.breakdown,
      };
      missing_inputs.push(...result.missing_inputs);
      if(result.score===null)reasons.push('CURRENT_READINESS_NOT_SCORED_MISSING_KNOWN_UNLOCK_SLOTS');
      else reasons.push('CURRENT_READINESS_SCORED_FROM_CONFIRMED_UNLOCK_SLOTS');
    }
    for(const [dimension,rule] of Object.entries(POKEMON_SCORING_RULES)){
      if(dimension==='current_readiness_score')continue;
      if(rule.status!=='ACTIVE_VERIFIED'){
        missing_inputs.push(`${dimension}:${rule.status}`);
        reasons.push(`${dimension.toUpperCase()}:${rule.status}`);
      }
    }
    return {
      ...feature,
      ...scores,
      production_modifier_profile,
      score_breakdown,
      score_rule_registry_version:POKEMON_SCORING_RULE_REGISTRY_VERSION,
      scoring_engine_version:POKEMON_SCORING_ENGINE_VERSION,
      missing_score_inputs:[...new Set(missing_inputs)].sort(),
      score_reasons:[...new Set(reasons)].sort(),
      numeric_score_count:Object.values(scores).filter(value=>value!==null).length,
      rank_eligible:feature.hard_constraint_status!=='FAIL',
    };
  });
  const ranked=[...candidates].filter(row=>row.rank_eligible).sort((a,b)=>{
    const hard={PASS:0,REVIEW:1,FAIL:2};
    if(hard[a.hard_constraint_status]!==hard[b.hard_constraint_status])return hard[a.hard_constraint_status]-hard[b.hard_constraint_status];
    const ar=a.current_readiness_score??-1,br=b.current_readiness_score??-1;
    if(br!==ar)return br-ar;
    return String(a.pokemon_id).localeCompare(String(b.pokemon_id));
  });
  return {
    schema:'pokemon-sleep-evidence-gated-scoring/1.1',
    scoring_engine_version:POKEMON_SCORING_ENGINE_VERSION,
    scoring_rule_registry_version:POKEMON_SCORING_RULE_REGISTRY_VERSION,
    feature_fingerprint:featureProjection?.input_fingerprint||null,
    active_numeric_dimensions:Object.entries(POKEMON_SCORING_RULES).filter(([,rule])=>rule.status==='ACTIVE_VERIFIED').map(([dimension])=>dimension),
    production_modifier_numeric_activation:false,
    candidates,
    ranked_candidates:ranked,
    summary:{
      candidate_count:candidates.length,
      rank_eligible_count:ranked.length,
      scored_candidate_count:candidates.filter(row=>row.numeric_score_count>0).length,
      production_modifier_review_count:candidates.filter(row=>row.production_modifier_profile?.status==='REVIEW_REQUIRED').length,
    },
    player_data_write:false,
  };
}
