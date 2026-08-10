import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {parseWeeklyEventEffects} from './weekly-context-normalization.js';
import {projectWeeklyEventEffects,WEEKLY_EVENT_EFFECT_REGISTRY_VERSION} from './weekly-event-effect-registry.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {buildUnifiedResourceSnapshot} from './resource-context.js';
import {buildLocalPokemonCandidateScoring} from './pokemon-candidate-local.js';
import {buildLocalTeamOptimization} from './team-optimizer-local.js';
import {buildLocalRecipeStrategyProjection} from './recipe-strategy-local.js';
import {buildLocalRecipeDiscoveryStockpile} from './recipe-discovery-stockpile-local.js';
import {buildStrategyAnalysisPack,buildEphemeralCandidateResolver,strategyAnalysisPackMarkdown,STRATEGY_ANALYSIS_PACK_VERSION,STRATEGY_ANALYSIS_PROMPT_VERSION} from './external-strategy-analysis-pack.js';
import {sanitizeGoalProfileForExternal,assertNoStablePokemonIds,forbiddenKeyPaths,assertNoForbiddenKeyPaths,strategyAnalysisPrivacyManifest,STRATEGY_ANALYSIS_PRIVACY_VERSION} from './external-strategy-analysis-privacy.js';
import {PUBLIC_CANDY_MASTER_VERSION} from './public-candy-master.js';
import {PUBLIC_RECIPE_MASTER_VERSION} from './public-recipe-canonical-authority.js';
import {PUBLIC_POKEMON_KNOWLEDGE_VERSION} from './public-pokemon-knowledge-master.js';
import {PUBLIC_CAMP_BERRY_VERSION} from './public-camp-berry-master.js';
import {MASTER_DATA_VERSION} from './shared-master-data.js';
import {CANONICAL_REGISTRY_VERSION} from './canonical-registry.js';
import {POKEMON_SCORING_RULE_REGISTRY_VERSION,POKEMON_SCORING_RULES} from './pokemon-scoring-rule-registry.js';
import {TEAM_OPTIMIZER_VERSION} from './team-optimizer.js';
import {RECIPE_DISCOVERY_STOCKPILE_VERSION} from './recipe-discovery-stockpile.js';
import {RECIPE_STRATEGY_ENGINE_VERSION} from './recipe-strategy-projection.js';

export const STRATEGY_ANALYSIS_LOCAL_VERSION='strategy-analysis-local-2026-08-10-c';

const text=value=>String(value??'').normalize('NFKC').trim();
function currentTeamPokemonIds(){
  try{return rows("SELECT pokemon_id FROM pokemon WHERE status='active' AND is_main=1 ORDER BY pokemon_id LIMIT 5").map(row=>text(row.pokemon_id)).filter(Boolean);}catch{return [];}
}
function masterVersions(){return Object.freeze({
  shared_master_version:MASTER_DATA_VERSION,
  public_recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,
  public_candy_master_version:PUBLIC_CANDY_MASTER_VERSION,
  public_pokemon_knowledge_version:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
  public_camp_berry_version:PUBLIC_CAMP_BERRY_VERSION,
  canonical_registry_version:CANONICAL_REGISTRY_VERSION,
});}
function ruleVersions(){return Object.freeze({
  weekly_event_effect_registry_version:WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
  current_readiness_rule_version:POKEMON_SCORING_RULES.current_readiness_score?.rule_version||null,
  pokemon_scoring_rule_registry_version:POKEMON_SCORING_RULE_REGISTRY_VERSION,
  team_optimizer_version:TEAM_OPTIMIZER_VERSION,
  recipe_strategy_engine_version:RECIPE_STRATEGY_ENGINE_VERSION,
  recipe_discovery_stockpile_version:RECIPE_DISCOVERY_STOCKPILE_VERSION,
  strategy_analysis_pack_version:STRATEGY_ANALYSIS_PACK_VERSION,
  strategy_analysis_prompt_version:STRATEGY_ANALYSIS_PROMPT_VERSION,
  strategy_analysis_privacy_version:STRATEGY_ANALYSIS_PRIVACY_VERSION,
});}
function typedWeeklyContext(){
  const weekly=currentWeeklyContext();
  const projection=projectWeeklyEventEffects(parseWeeklyEventEffects(weekly.event_effects));
  return Object.freeze({
    ...weekly,
    event_effect_registry_version:projection.registry_version,
    strategy_event_effects:projection.deterministic_effects,
    feature_only_event_effects:projection.feature_only_effects,
    review_event_effects:projection.review_effects,
    event_effect_states:projection.states,
    event_effect_strategy_fingerprint:projection.strategy_effect_fingerprint,
  });
}

export function buildLocalStrategyAnalysisPack({analysisRequest='',candidateLimit=30}={}){
  if(!isDatabaseReady()||isRescueReadonly())throw new Error('玩家 SQLite 尚未就緒或目前為救援唯讀狀態，無法建立可分享 Strategy Analysis Pack');
  const weekly=typedWeeklyContext();
  const goal=getActiveStrategyGoalProfile();
  const resources=buildUnifiedResourceSnapshot();
  const scoring=buildLocalPokemonCandidateScoring();
  const team=buildLocalTeamOptimization();
  const recipe=buildLocalRecipeStrategyProjection();
  const discovery=buildLocalRecipeDiscoveryStockpile();
  const resolver=buildEphemeralCandidateResolver(scoring.candidates||[]);
  const safeGoal=sanitizeGoalProfileForExternal(goal,{stableToRef:resolver.stable_to_ref,candidates:scoring.candidates||[]});
  const privacyManifest=strategyAnalysisPrivacyManifest();
  const built=buildStrategyAnalysisPack({
    analysisRequest,weeklyContext:weekly,goalProfile:safeGoal,resourceSnapshot:resources,candidateScoring:scoring,teamOptimization:team,recipeStrategy:recipe,recipeDiscovery:discovery,
    masterVersions:masterVersions(),ruleVersions:ruleVersions(),currentTeamPokemonIds:currentTeamPokemonIds(),candidateLimit,privacyManifest,
  });
  const json=JSON.stringify(built.pack,null,2),markdown=strategyAnalysisPackMarkdown(built.pack),prompt=built.prompt;
  assertNoStablePokemonIds(json,built.resolver,'Strategy Analysis Pack JSON');
  assertNoStablePokemonIds(markdown,built.resolver,'Strategy Analysis Pack Markdown');
  assertNoStablePokemonIds(prompt,built.resolver,'Strategy Analysis Pack Prompt');
  assertNoForbiddenKeyPaths(built.pack,'Strategy Analysis Pack JSON object');
  if(forbiddenKeyPaths(built.pack).length)throw new Error('Strategy Analysis Pack privacy guard internal parity failure');
  return Object.freeze({
    local_version:STRATEGY_ANALYSIS_LOCAL_VERSION,
    pack:built.pack,prompt,markdown,resolver:built.resolver,
    privacy_manifest:privacyManifest,
    export_safe:true,
  });
}

export function strategyAnalysisPackSummary(result){
  const pack=result?.pack||{};
  return Object.freeze({
    input_fingerprint:pack.input_fingerprint||null,
    week_start:pack.weekly_context?.week_start||null,camp:pack.weekly_context?.camp||null,primary_goal:pack.goal_profile?.primary_goal||null,
    candidate_count:pack.candidate_pokemon?.length||0,missing_rule_count:pack.missing_rules?.length||0,
    ingredient_count:pack.resource_snapshot?.ingredients?.length||0,item_count:pack.resource_snapshot?.items?.length||0,candy_count:pack.resource_snapshot?.candies?.length||0,
    export_safe:Boolean(result?.export_safe),
  });
}
