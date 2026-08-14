import {DEFAULT_TEAM_SEARCH_BUDGET} from './bounded-team-search.js';
import {currentProductionAuthorityRegistry} from './production-authority-registry.js';
import {resolvePokemonProductionModifierProfile} from './pokemon-master-options.js';

export const STRATEGY_OPTIMIZATION_PACK_VERSION='strategy-optimization-pack-2026-08-14-b';
const text=value=>String(value??'').normalize('NFKC').trim();
const num=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function sanitizeBudget(input={}){return stable({...DEFAULT_TEAM_SEARCH_BUDGET,...input});}

function productionRules(registry){
  return Object.values(registry?.rules||{}).map(row=>({dimension:row.dimension,status:row.status,rule_version:row.rule_version||null,source_refs:[...(row.source_refs||[])],missing_inputs:[...(row.missing_inputs||[])]})).sort((a,b)=>a.dimension.localeCompare(b.dimension));
}
function buildRefMaps(contextResult){
  const resolver=contextResult?.resolver||{},refByPokemonId=new Map();
  for(const [ref,row] of Object.entries(resolver)){if(row?.pokemon_id)refByPokemonId.set(text(row.pokemon_id),ref);}
  return {resolver,refByPokemonId};
}
function candidateProductionPayload(ref,row,registry){
  return stable({
    candidate_ref:ref,species:text(row?.species),level:num(row?.level),specialty:text(row?.specialty)||null,helper_seconds:num(row?.helper_seconds),favorite_berry_match:row?.favorite_berry_match??null,
    main_skill:text(row?.main_skill)||null,main_skill_level:num(row?.main_skill_level),
    unlocked_ingredients:(row?.unlocked_ingredients||[]).map(item=>({unlock_level:num(item.unlock_level),ingredient_name:text(item.ingredient_name),quantity:num(item.quantity)})).filter(item=>item.ingredient_name),
    production_modifier_profile:resolvePokemonProductionModifierProfile(row),
    rate_statuses:{
      // Output quantity per Berry-result help is only one component of berries/hour.
      // Ingredient probability determines how often a regular help resolves to Berries instead of ingredients.
      berry:registry?.rules?.berry_output_per_help?.status==='ACTIVE_VERIFIED'&&registry?.rules?.berry_energy_per_berry?.status==='ACTIVE_VERIFIED'&&registry?.rules?.ingredient_probability_per_help?.status==='ACTIVE_VERIFIED'?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED',
      ingredient:registry?.rules?.ingredient_probability_per_help?.status==='ACTIVE_VERIFIED'&&registry?.rules?.ingredient_slot_distribution?.status==='ACTIVE_VERIFIED'?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED',
      skill:registry?.rules?.main_skill_trigger_probability?.status==='ACTIVE_VERIFIED'&&registry?.rules?.main_skill_effect_value?.status==='ACTIVE_VERIFIED'?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED',
    },
  });
}

export function buildStrategyOptimizationPack({strategyContextResult=null,candidateScoring={},teamOptimization={},teamSupplyReadiness=null,productionRegistry=currentProductionAuthorityRegistry(),searchBudget={}}={}){
  const contextPayload=strategyContextResult?.payload||null;if(!contextPayload)return {status:'CONTEXT_UNAVAILABLE',payload:null,privacy_manifest:{raw_sqlite_in_payload:false,api_key_in_payload:false}};
  const {refByPokemonId}=buildRefMaps(strategyContextResult),candidateById=new Map((candidateScoring?.candidates||[]).map(row=>[text(row.pokemon_id),row]));
  const candidates=[];
  for(const [pokemonId,ref] of refByPokemonId){const row=candidateById.get(pokemonId);if(row)candidates.push(candidateProductionPayload(ref,row,productionRegistry));}
  candidates.sort((a,b)=>a.candidate_ref.localeCompare(b.candidate_ref));
  const seedRefs=(teamOptimization?.primary?.slots||[]).map(slot=>refByPokemonId.get(text(slot.pokemon_id))).filter(Boolean);
  const payload=stable({
    schema:'pokemon-sleep-strategy-optimization-pack/2.0',package_version:STRATEGY_OPTIMIZATION_PACK_VERSION,
    context_fingerprint:contextPayload.context_fingerprint||null,goal_profile:contextPayload.goal_profile||null,weekly_context:contextPayload.weekly_context||null,
    seed_team:{candidate_refs:seedRefs,team_status:teamOptimization?.primary?.team_status||'UNAVAILABLE',team_fingerprint:teamOptimization?.primary?.input_fingerprint||null},
    candidate_production_readiness:candidates,production_authority:{registry_version:productionRegistry?.registry_version||null,numeric_rate_model_status:productionRegistry?.numeric_rate_model_status||'NOT_YET_VERIFIED',rules:productionRules(productionRegistry)},
    inventory_summary:contextPayload.inventory_summary||[],recipe_gap_summary:contextPayload.recipe_gap_summary||[],team_supply_summary:teamSupplyReadiness?{
      input_fingerprint:teamSupplyReadiness.input_fingerprint||null,production_rate_status:teamSupplyReadiness.production_rate_status||'NOT_YET_VERIFIED',covered_shortage_ingredients:teamSupplyReadiness.covered_shortage_ingredients||[],uncovered_shortage_ingredients:teamSupplyReadiness.uncovered_shortage_ingredients||[],summary:teamSupplyReadiness.summary||{},
    }:null,
    search_policy:{algorithm:'BOUNDED_BEAM_AND_LOCAL_REPLACEMENT',budget:sanitizeBudget(searchBudget),global_optimum_claimed:false,re_evaluate_every_proposed_team:true,ai_proposal_requires_deterministic_re_evaluation:true},
    deterministic_refs:contextPayload.deterministic_candidates||{},public_version_refs:contextPayload.public_version_refs||{},
  });
  const optimization_fingerprint=`strategy_optimization:${hash(JSON.stringify(payload))}`;
  return {
    status:'READY',payload:{...payload,optimization_fingerprint},
    resolver:strategyContextResult.resolver||{},
    privacy_manifest:{stable_pokemon_ids_in_payload:false,nicknames_in_payload:false,notes_in_payload:false,source_images_in_payload:false,raw_ocr_in_payload:false,api_key_in_payload:false,raw_sqlite_in_payload:false,candidate_ref_count:candidates.length,seed_team_ref_count:seedRefs.length},
  };
}
