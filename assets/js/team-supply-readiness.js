export const TEAM_SUPPLY_READINESS_VERSION='team-supply-readiness-2026-08-12-a';
export const TEAM_SUPPLY_RATE_STATUS='NOT_YET_VERIFIED';

const text=value=>String(value??'').normalize('NFKC').trim();
const numeric=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
const unique=value=>[...new Set((Array.isArray(value)?value:[]).map(text).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));

function capabilityMap(team,candidates){
  const byId=new Map((candidates||[]).map(row=>[text(row.pokemon_id),row]));
  const map=new Map(),members=[];
  for(const slot of team?.slots||[]){
    const id=text(slot.pokemon_id),feature=byId.get(id);if(!id||!feature)continue;
    const ingredientRows=(feature.unlocked_ingredients||[]).filter(row=>text(row.ingredient_name));
    const ingredientNames=unique(ingredientRows.map(row=>row.ingredient_name));
    const member=Object.freeze({
      pokemon_id:id,species:text(feature.species||slot.species)||id,level:numeric(feature.level??slot.level),helper_seconds:numeric(feature.helper_seconds),
      ingredient_names:Object.freeze(ingredientNames),production_rate_status:TEAM_SUPPLY_RATE_STATUS,
    });
    members.push(member);
    for(const name of ingredientNames){
      if(!map.has(name))map.set(name,[]);
      const slotQuantities=ingredientRows.filter(row=>text(row.ingredient_name)===name).map(row=>({unlock_level:numeric(row.unlock_level),quantity:numeric(row.quantity)}));
      map.get(name).push(Object.freeze({
        pokemon_id:id,species:member.species,level:member.level,helper_seconds:member.helper_seconds,
        observed_unlocked_slot_quantities:Object.freeze(slotQuantities.map(Object.freeze)),
        production_rate_status:TEAM_SUPPLY_RATE_STATUS,ingredient_per_hour:null,replenishment_eta:null,
      }));
    }
  }
  const capabilities=[...map.entries()].map(([ingredient_name,producers])=>Object.freeze({
    ingredient_name,producer_count:producers.length,producers:Object.freeze(producers.sort((a,b)=>a.pokemon_id.localeCompare(b.pokemon_id))),
    production_rate_status:TEAM_SUPPLY_RATE_STATUS,aggregate_ingredient_per_hour:null,
  })).sort((a,b)=>a.ingredient_name.localeCompare(b.ingredient_name,'zh-Hant'));
  return {members:Object.freeze(members),map:new Map(capabilities.map(row=>[row.ingredient_name,row])),capabilities:Object.freeze(capabilities)};
}

function recipeSupplyState(candidate,capabilities,teamReady){
  const shortages=(candidate?.requirements||[]).map(row=>({
    ingredient_name:text(row.ingredient_name),shortage:Math.max(0,Number(row.strategy_shortage||0)),raw_shortage:Math.max(0,Number(row.raw_shortage||0)),safe_reserve:Number(row.safe_reserve||0),
  })).filter(row=>row.ingredient_name&&row.shortage>0);
  const otherBlockers=unique((candidate?.failed_constraints||[]).filter(value=>!['ingredient_availability','ingredient_safe_reserve'].includes(String(value))));
  const shortageDetails=shortages.map(row=>{
    const capability=capabilities.get(row.ingredient_name),producers=capability?.producers||[];
    return Object.freeze({...row,producer_count:producers.length,producer_ids:Object.freeze(producers.map(item=>item.pokemon_id)),producer_species:Object.freeze(producers.map(item=>item.species)),production_rate_status:TEAM_SUPPLY_RATE_STATUS,ingredient_per_hour:null,replenishment_eta:null});
  });
  const covered=shortageDetails.filter(row=>row.producer_count>0).length;
  let supplyStatus='NOT_APPLICABLE';
  if(shortageDetails.length){
    if(!teamReady)supplyStatus='TEAM_NOT_READY';
    else if(covered===shortageDetails.length)supplyStatus='TEAM_CAPABILITY_COVERED_UNQUANTIFIED';
    else if(covered>0)supplyStatus='PARTIAL_TEAM_COVERAGE';
    else supplyStatus='NO_TEAM_SOURCE';
  }
  const coverageRatio=shortageDetails.length?covered/shortageDetails.length:null;
  return Object.freeze({
    recipe_id:text(candidate?.recipe_id),recipe_name:text(candidate?.recipe_name)||text(candidate?.recipe_id),candidate_status:candidate?.candidate_status||null,hard_constraint_status:candidate?.hard_constraint_status||null,
    total_strategy_shortage:Number(candidate?.total_strategy_shortage||shortageDetails.reduce((sum,row)=>sum+row.shortage,0)),shortage_ingredient_count:shortageDetails.length,
    covered_shortage_ingredient_count:covered,coverage_ratio:coverageRatio,supply_status:supplyStatus,shortages:Object.freeze(shortageDetails),other_blockers:Object.freeze(otherBlockers),
    replenishment_capability_only:true,inventory_ready_promoted:false,production_rate_status:TEAM_SUPPLY_RATE_STATUS,ingredient_per_hour:null,replenishment_eta:null,
  });
}

export function projectTeamSupplyReadiness({recipeStrategy={},teamOptimization={},candidateFeatures={}}={}){
  const team=teamOptimization?.primary||null,teamReady=team?.team_status==='READY';
  const capability=capabilityMap(team,candidateFeatures?.candidates||[]);
  const recipeRows=(recipeStrategy?.candidates||[]).map(candidate=>recipeSupplyState(candidate,capability.map,teamReady)).filter(row=>row.shortage_ingredient_count>0)
    .sort((a,b)=>{
      const rank={TEAM_CAPABILITY_COVERED_UNQUANTIFIED:0,PARTIAL_TEAM_COVERAGE:1,NO_TEAM_SOURCE:2,TEAM_NOT_READY:3,NOT_APPLICABLE:4};
      if((rank[a.supply_status]??9)!==(rank[b.supply_status]??9))return (rank[a.supply_status]??9)-(rank[b.supply_status]??9);
      if(Number(b.coverage_ratio||0)!==Number(a.coverage_ratio||0))return Number(b.coverage_ratio||0)-Number(a.coverage_ratio||0);
      if(a.total_strategy_shortage!==b.total_strategy_shortage)return a.total_strategy_shortage-b.total_strategy_shortage;
      return a.recipe_name.localeCompare(b.recipe_name,'zh-Hant');
    });
  const allShortageIngredients=unique(recipeRows.flatMap(row=>row.shortages.map(item=>item.ingredient_name)));
  const coveredIngredients=allShortageIngredients.filter(name=>capability.map.has(name));
  const uncoveredIngredients=allShortageIngredients.filter(name=>!capability.map.has(name));
  const fingerprintPayload=stable({
    version:TEAM_SUPPLY_READINESS_VERSION,rate_status:TEAM_SUPPLY_RATE_STATUS,recipe_strategy_fingerprint:recipeStrategy?.input_fingerprint||null,
    team_fingerprint:teamOptimization?.input_fingerprint||team?.input_fingerprint||null,candidate_feature_fingerprint:candidateFeatures?.input_fingerprint||candidateFeatures?.feature_fingerprint||null,
    team_id:team?.team_id||null,capabilities:capability.capabilities.map(row=>({ingredient_name:row.ingredient_name,producers:row.producers.map(p=>({pokemon_id:p.pokemon_id,level:p.level,helper_seconds:p.helper_seconds,slots:p.observed_unlocked_slot_quantities}))})),
    recipes:recipeRows.map(row=>({recipe_id:row.recipe_id,supply_status:row.supply_status,shortages:row.shortages.map(item=>[item.ingredient_name,item.shortage,item.producer_ids])})),
  });
  return Object.freeze({
    schema:'pokemon-sleep-team-supply-readiness/1.0',projection_version:TEAM_SUPPLY_READINESS_VERSION,projection_status:team?'READY':'TEAM_UNAVAILABLE',input_fingerprint:`team_supply:${hash(JSON.stringify(fingerprintPayload))}`,
    team_id:team?.team_id||null,team_status:team?.team_status||'UNAVAILABLE',team_member_count:team?.slots?.length||0,team_members:capability.members,
    production_rate_status:TEAM_SUPPLY_RATE_STATUS,ingredient_per_hour_authority:false,replenishment_eta_authority:false,
    summary:Object.freeze({
      shortage_recipe_count:recipeRows.length,team_capability_covered_recipe_count:recipeRows.filter(row=>row.supply_status==='TEAM_CAPABILITY_COVERED_UNQUANTIFIED').length,
      partial_team_coverage_recipe_count:recipeRows.filter(row=>row.supply_status==='PARTIAL_TEAM_COVERAGE').length,no_team_source_recipe_count:recipeRows.filter(row=>row.supply_status==='NO_TEAM_SOURCE').length,
      shortage_ingredient_count:allShortageIngredients.length,covered_shortage_ingredient_count:coveredIngredients.length,uncovered_shortage_ingredient_count:uncoveredIngredients.length,
    }),
    covered_shortage_ingredients:Object.freeze(coveredIngredients),uncovered_shortage_ingredients:Object.freeze(uncoveredIngredients),capabilities:capability.capabilities,recipes:Object.freeze(recipeRows),
    inventory_virtualization:false,inventory_ready_promotion:false,player_data_write:false,inventory_mutation:false,pokemon_write:false,public_master_write:false,gemini_used:false,
  });
}
