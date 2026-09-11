import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {readG121CExplainableEvolutionRecommendation} from './g121c-explainable-evolution-recommendation.js';
import {evaluateG121DEvolutionVariantRouteAuthority} from './g121d-evolution-variant-authority.js';
import {resolveG121DCanonicalCandyRead} from './g121d-candy-read-authority.js';
import {debugTrace} from './debug-trace-manager.js';

export const G121D_WARROOM_PROVIDER_VERSION='g121d-warroom-provider-2026-09-11-c';

const text=value=>String(value??'').normalize('NFKC').trim();
const safeRows=(sql,params=[])=>{try{return rows(sql,params);}catch{return [];}};
const activeWarroom=()=>document.querySelector('.view.active')?.id==='warroom';
let refreshTimer=null;

function recommendationAuthorityForPokemon(){
  // G12.1C intentionally requires independently VERIFIED cultivation value,
  // team need and opportunity-cost authority before recommend_now. Existing
  // War Room scores are not silently coerced into those booleans here.
  return {};
}

export function buildG121DWarroomRecommendationEnvelopes(){
  if(!isDatabaseReady()||isRescueReadonly())return Object.freeze([]);

  const pokemonRows=safeRows(`SELECT pokemon_instance_id,current_species,species,nickname,level,sleep_hours,status
    FROM pokemon
    WHERE status='active' AND pokemon_instance_id IS NOT NULL AND pokemon_instance_id<>''
    ORDER BY COALESCE(NULLIF(nickname,''),COALESCE(NULLIF(current_species,''),species)),pokemon_instance_id`);
  const evolutionRows=safeRows(`SELECT route_id,evolution_branch_id,from_species,to_species,required_level,required_sleep_hours,required_candy,required_item,
      other_requirement,effective_from,effective_until,effective_period_status,confidence,verification_status,source_name,source_ref,verified_at,data_version
    FROM pokemon_evolution_master ORDER BY from_species,to_species,route_id`);
  const itemInventoryRows=safeRows('SELECT item_name,quantity,safe_reserve FROM item_inventory ORDER BY item_name');
  const acquisitionRows=safeRows(`SELECT item_name,acquisition_type,authority_status,sleep_point_cost,diamond_cost,premium_only,available_from,available_until,confidence,verified_at
    FROM item_acquisition_master ORDER BY item_name,acquisition_id`);
  const playerResourceRows=safeRows(`SELECT resource_key,resource_kind,knowledge_state,numeric_value,text_value,updated_at,source_update_id,authority_version
    FROM player_resource_state ORDER BY resource_key`);
  // Runtime candy identity is derived from the governed family resolver plus the
  // canonical species master row. The migration audit remains historical evidence
  // only and is intentionally not queried by this read path.
  const candyMasterRows=safeRows(`SELECT candy_id,candy_name,candy_type,target_species_name
    FROM candy_master WHERE candy_type='species' ORDER BY target_species_name,candy_id`);
  const candyInventoryRows=safeRows('SELECT candy_id,quantity FROM candy_inventory ORDER BY candy_id');

  const routesBySpecies=new Map();
  for(const route of evolutionRows){
    const key=text(route.from_species);
    if(!key)continue;
    if(!routesBySpecies.has(key))routesBySpecies.set(key,[]);
    routesBySpecies.get(key).push(route);
  }

  const envelopes=[];
  const now=new Date().toISOString();
  for(const pokemon of pokemonRows){
    const pokemonInstanceId=text(pokemon.pokemon_instance_id);
    const currentSpecies=text(pokemon.current_species||pokemon.species);
    if(!pokemonInstanceId||!currentSpecies)continue;

    const variantAuthority=evaluateG121DEvolutionVariantRouteAuthority(pokemon);
    if(!variantAuthority.allowed){
      debugTrace.record('warroom','g121d_variant_route_excluded',{status:'excluded',details:{
        pokemon_instance_id:pokemonInstanceId,
        current_species:currentSpecies,
        nickname:text(pokemon.nickname)||null,
        reason:variantAuthority.reason,
        variant:variantAuthority.variant,
        identity_source:variantAuthority.identity_source,
        identity_value:variantAuthority.identity_value,
        ordinary_species_route_forbidden:variantAuthority.ordinary_species_route_forbidden,
      }});
      continue;
    }

    const routes=routesBySpecies.get(currentSpecies)||[];
    if(!routes.length)continue;
    const candy=resolveG121DCanonicalCandyRead(currentSpecies,{candy_master_rows:candyMasterRows,candy_inventory_rows:candyInventoryRows});
    const snapshot={
      pokemon_rows:[{
        pokemon_instance_id:pokemonInstanceId,
        current_species:currentSpecies,
        species:currentSpecies,
        level:pokemon.level,
        sleep_hours:pokemon.sleep_hours,
        candy_family_id:candy.family_id,
      }],
      evolution_master_rows:routes,
      canonical_family_candy_rows:candy.canonical_family_candy_rows,
      item_inventory_rows:itemInventoryRows,
      item_acquisition_rows:acquisitionRows,
      player_resource_state_rows:playerResourceRows,
    };
    for(const route of routes){
      const envelope=readG121CExplainableEvolutionRecommendation(snapshot,{
        pokemon_instance_id:pokemonInstanceId,
        route_id:text(route.route_id),
        evolution_branch_id:text(route.evolution_branch_id),
        now,
      },recommendationAuthorityForPokemon(pokemon));
      envelopes.push(Object.freeze({
        ...envelope,
        current_label:text(pokemon.nickname)?`${text(pokemon.nickname)}（${currentSpecies}）`:currentSpecies,
        target_label:text(route.to_species)||'目標分支',
        authority_source:text(route.source_ref)||text(route.source_name)||'G12.1 Evolution Master',
        source_verified_at:route.verified_at||null,
        route_confidence:route.confidence??null,
        provider_version:G121D_WARROOM_PROVIDER_VERSION,
        candy_read_authority:Object.freeze({
          status:candy.status,
          reason:candy.reason,
          family_id:candy.family_id,
          canonical_candy_id:candy.canonical_candy_id,
          player_record_exists:candy.player_record_exists,
        }),
      }));
    }
  }
  return Object.freeze(envelopes);
}

export function refreshG121DWarroomRecommendations({reason='warroom-page-load'}={}){
  const started=performance.now();
  const envelopes=buildG121DWarroomRecommendationEnvelopes();
  globalThis.PokemonSleepG121CRecommendationEnvelopes=envelopes;
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:g121c-recommendations-ready',{detail:{
    envelopes,
    provider_version:G121D_WARROOM_PROVIDER_VERSION,
    reason,
    read_only:true,
    deterministic:true,
  }}));
  debugTrace.record('warroom','g121d_recommendation_provider_refreshed',{status:'completed',details:{
    envelope_count:envelopes.length,
    pokemon_instance_count:new Set(envelopes.map(row=>row.pokemon_instance_id).filter(Boolean)).size,
    elapsed_ms:Math.round(performance.now()-started),
    reason,
    read_only:true,
    ai_decision:false,
  }});
  return envelopes;
}

export function scheduleG121DWarroomRecommendationRefresh(reason='data-changed'){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>{
    refreshTimer=null;
    if(activeWarroom())refreshG121DWarroomRecommendations({reason});
  },0);
}

globalThis.addEventListener?.('pokemon-sleep:data-changed',()=>scheduleG121DWarroomRecommendationRefresh('data-changed'));
globalThis.PokemonSleepG121DRecommendationProvider=Object.freeze({
  version:G121D_WARROOM_PROVIDER_VERSION,
  build:buildG121DWarroomRecommendationEnvelopes,
  refresh:refreshG121DWarroomRecommendations,
});
