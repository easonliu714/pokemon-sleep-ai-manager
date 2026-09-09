import {normalizeG121PlayerResourceRows} from './g121-authority.js';
import {evaluateG121BDeterministicEvolutionStatus} from './g121b-deterministic-evolution-status.js';

const text=value=>String(value??'').trim();
const nonNegativeInteger=value=>{
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isInteger(number)&&number>=0?number:null;
};
const nullableNonNegativeInteger=value=>value===null||value===undefined||value===''?null:nonNegativeInteger(value);
const incomplete=(pokemonInstanceId,reason,details={})=>({
  status:'data_incomplete',
  reason,
  pokemon_instance_id:text(pokemonInstanceId)||null,
  ...details,
});

function exactOne(rows,predicate){
  const matches=(Array.isArray(rows)?rows:[]).filter(predicate);
  return matches.length===1?{row:matches[0],count:1}:{row:null,count:matches.length};
}

function normalizeEvolutionRoute(row){
  if(!row||typeof row!=='object')return null;
  return {
    route_id:text(row.route_id),
    evolution_branch_id:text(row.evolution_branch_id),
    from_species:text(row.from_species),
    to_species:text(row.to_species),
    // Preserve raw requirement values so the deterministic evaluator can reject
    // malformed authority instead of silently converting it into "no requirement".
    required_level:row.required_level,
    required_sleep_hours:row.required_sleep_hours,
    required_candy:row.required_candy,
    required_item:text(row.required_item),
    required_dream_shards:row.required_dream_shards,
    other_requirement:row.other_requirement==null?null:text(row.other_requirement),
    effective_from:row.effective_from==null?null:text(row.effective_from),
    effective_until:row.effective_until==null?null:text(row.effective_until),
    effective_period_status:text(row.effective_period_status),
    confidence:row.confidence==null?null:Number(row.confidence),
  };
}

function normalizeAcquisitionRow(row){
  return {
    item_name:text(row?.item_name),
    acquisition_type:text(row?.acquisition_type),
    authority_status:text(row?.authority_status),
    sleep_point_cost:nullableNonNegativeInteger(row?.sleep_point_cost),
    diamond_cost:nullableNonNegativeInteger(row?.diamond_cost),
    premium_only:row?.premium_only==null?null:Number(row.premium_only),
    available_from:row?.available_from==null?null:text(row.available_from),
    available_until:row?.available_until==null?null:text(row.available_until),
    confidence:row?.confidence==null?null:Number(row.confidence),
  };
}

function resolveCanonicalCandy(snapshot,pokemon){
  const familyId=text(pokemon?.candy_family_id);
  if(!familyId)return null;
  const result=exactOne(snapshot?.canonical_family_candy_rows,row=>text(row?.candy_family_id)===familyId);
  if(!result.row)return null;
  const quantity=nonNegativeInteger(result.row.quantity);
  const state=text(result.row.knowledge_state||'KNOWN');
  if(quantity===null)return null;
  return {candy_family_id:familyId,quantity,knowledge_state:state};
}

function resolveItemInventory(snapshot){
  const inventory={};
  const reserve={};
  for(const row of Array.isArray(snapshot?.item_inventory_rows)?snapshot.item_inventory_rows:[]){
    const name=text(row?.item_name);
    if(!name)continue;
    if(Object.prototype.hasOwnProperty.call(inventory,name))return null;
    const quantity=nonNegativeInteger(row?.quantity);
    const safeReserve=nonNegativeInteger(row?.safe_reserve??0);
    if(quantity===null||safeReserve===null)return null;
    inventory[name]=quantity;
    reserve[name]=safeReserve;
  }
  return {inventory,reserve};
}

/**
 * Schema-safe, read-only adapter from authoritative storage snapshots into the
 * deterministic G12.1B evaluator. It never writes, never invokes AI, never
 * substitutes account-total sleep time, and never consumes legacy per-species
 * Candy quantities.
 */
export function evaluateG121BFromAuthoritativeSnapshot(snapshot={},request={}){
  const pokemonInstanceId=text(request.pokemon_instance_id);
  if(!pokemonInstanceId)return incomplete(null,'missing_pokemon_instance_id');

  const instance=exactOne(snapshot.pokemon_rows,row=>text(row?.pokemon_instance_id)===pokemonInstanceId);
  if(instance.count===0)return incomplete(pokemonInstanceId,'missing_pokemon_instance_authority');
  if(instance.count!==1)return incomplete(pokemonInstanceId,'ambiguous_pokemon_instance_authority',{match_count:instance.count});
  const pokemon=instance.row;

  const routeId=text(request.route_id);
  const branchId=text(request.evolution_branch_id);
  if(!routeId||!branchId)return incomplete(pokemonInstanceId,'missing_evolution_route_selector');
  const routeMatch=exactOne(snapshot.evolution_master_rows,row=>text(row?.route_id)===routeId&&text(row?.evolution_branch_id)===branchId);
  if(routeMatch.count===0)return incomplete(pokemonInstanceId,'missing_evolution_route_authority',{route_id:routeId,evolution_branch_id:branchId});
  if(routeMatch.count!==1)return incomplete(pokemonInstanceId,'ambiguous_evolution_route_authority',{route_id:routeId,evolution_branch_id:branchId,match_count:routeMatch.count});
  const route=normalizeEvolutionRoute(routeMatch.row);

  const canonicalFamilyCandy=resolveCanonicalCandy(snapshot,pokemon);
  if(route?.required_candy&&Number(route.required_candy)>0&&!canonicalFamilyCandy){
    return incomplete(pokemonInstanceId,'missing_canonical_family_candy_authority',{route_id:routeId});
  }

  const items=resolveItemInventory(snapshot);
  if(!items)return incomplete(pokemonInstanceId,'ambiguous_item_inventory_authority',{route_id:routeId});

  const acquisitionRows=(Array.isArray(snapshot.item_acquisition_rows)?snapshot.item_acquisition_rows:[]).map(normalizeAcquisitionRow);
  const playerResources=normalizeG121PlayerResourceRows(Array.isArray(snapshot.player_resource_state_rows)?snapshot.player_resource_state_rows:[]);

  const sleepHours=nonNegativeInteger(pokemon.sleep_hours);
  const level=nonNegativeInteger(pokemon.level);

  return evaluateG121BDeterministicEvolutionStatus({
    pokemon_instance_id:pokemonInstanceId,
    sleep_hours:sleepHours,
    account_total_sleep_time:snapshot.account_total_sleep_time,
    level,
    route,
    canonical_family_candy:canonicalFamilyCandy,
    item_inventory:items.inventory,
    safe_reserve:items.reserve,
    item_acquisition_rows:acquisitionRows,
    player_resources:playerResources,
    other_requirement_satisfied:request.other_requirement_satisfied,
    now:request.now,
  });
}
