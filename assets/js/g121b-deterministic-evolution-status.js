import {G121_EVOLUTION_STATUS} from './g121-authority.js';

export const G121B_DETERMINISTIC_STATUS=Object.freeze({
  CURRENT_AVAILABLE:'current_available',
  NEAR_TERM:'near_term',
  FUTURE_LOCKED:'future_locked',
  DATA_INCOMPLETE:'data_incomplete',
});

const asNonNegativeInteger=value=>{
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isInteger(number)&&number>=0?number:null;
};
const knownNumeric=resource=>resource?.knowledge_state==='KNOWN'&&Number.isInteger(Number(resource.numeric_value))&&Number(resource.numeric_value)>=0;
const knownPremium=resource=>resource?.knowledge_state==='KNOWN'&&['ACTIVE','INACTIVE'].includes(String(resource.text_value||''));
const asInstant=value=>{
  if(!value)return null;
  const instant=Date.parse(value);
  return Number.isFinite(instant)?instant:null;
};
const incomplete=(reason,details={})=>({
  status:G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE,
  reason,
  detailed_status:G121_EVOLUTION_STATUS.DATA_INCOMPLETE,
  ...details,
});

export function evaluateG121BDeterministicEvolutionStatus(input={}){
  const pokemonInstanceId=String(input.pokemon_instance_id||'').trim();
  if(!pokemonInstanceId)return incomplete('missing_pokemon_instance_id');

  const route=input.route&&typeof input.route==='object'?input.route:null;
  if(!route||!String(route.route_id||'').trim()||!String(route.from_species||'').trim()||!String(route.to_species||'').trim()){
    return incomplete('missing_evolution_route_authority',{pokemon_instance_id:pokemonInstanceId});
  }
  if(route.confidence==null||Number(route.confidence)<=0){
    return incomplete('unverified_evolution_route_authority',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
  }

  const now=asInstant(input.now)||Date.now();
  const effectiveFrom=asInstant(route.effective_from);
  const effectiveUntil=asInstant(route.effective_until);
  if(route.effective_from&&effectiveFrom===null)return incomplete('invalid_effective_from',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
  if(route.effective_until&&effectiveUntil===null)return incomplete('invalid_effective_until',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
  if(effectiveUntil!==null&&now>effectiveUntil)return incomplete('evolution_route_authority_expired',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
  if(effectiveFrom!==null&&now<effectiveFrom){
    return {
      status:G121B_DETERMINISTIC_STATUS.FUTURE_LOCKED,
      reason:'evolution_route_not_effective_yet',
      detailed_status:G121_EVOLUTION_STATUS.TIME_WINDOW_PENDING,
      pokemon_instance_id:pokemonInstanceId,
      route_id:route.route_id,
      effective_from:route.effective_from,
    };
  }

  const requirements=[];
  const missing=[];

  const requiredLevel=asNonNegativeInteger(route.required_level);
  if(route.required_level!=null&&requiredLevel===null)return incomplete('invalid_required_level',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
  if(requiredLevel!==null){
    const level=asNonNegativeInteger(input.level);
    if(level===null)return incomplete('missing_instance_level',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
    requirements.push({kind:'level',required:requiredLevel,current:level});
    if(level<requiredLevel)missing.push('level');
  }

  const requiredSleepHours=asNonNegativeInteger(route.required_sleep_hours);
  if(route.required_sleep_hours!=null&&requiredSleepHours===null)return incomplete('invalid_required_sleep_hours',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
  if(requiredSleepHours!==null){
    const sleepHours=asNonNegativeInteger(input.sleep_hours);
    if(sleepHours===null){
      return incomplete('missing_per_instance_sleep_hours',{
        pokemon_instance_id:pokemonInstanceId,
        route_id:route.route_id,
        account_total_sleep_time_ignored:true,
      });
    }
    requirements.push({kind:'sleep_hours',required:requiredSleepHours,current:sleepHours});
    if(sleepHours<requiredSleepHours)missing.push('sleep_hours');
  }

  const requiredCandy=asNonNegativeInteger(route.required_candy);
  if(route.required_candy!=null&&requiredCandy===null)return incomplete('invalid_required_candy',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
  if(requiredCandy!==null&&requiredCandy>0){
    const candy=input.canonical_family_candy;
    if(candy?.knowledge_state!=='KNOWN')return incomplete('missing_canonical_family_candy_authority',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
    const quantity=asNonNegativeInteger(candy.quantity);
    if(quantity===null)return incomplete('invalid_canonical_family_candy_quantity',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
    requirements.push({kind:'canonical_family_candy',required:requiredCandy,current:quantity,candy_family_id:candy.candy_family_id||null});
    if(quantity<requiredCandy)missing.push('candy');
  }

  const requiredDreamShards=asNonNegativeInteger(route.required_dream_shards);
  if(route.required_dream_shards!=null&&requiredDreamShards===null)return incomplete('invalid_required_dream_shards',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
  if(requiredDreamShards!==null&&requiredDreamShards>0){
    const shards=input.player_resources?.dream_shards;
    if(!knownNumeric(shards))return incomplete('missing_dream_shards_authority',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id});
    const current=Number(shards.numeric_value);
    requirements.push({kind:'dream_shards',required:requiredDreamShards,current});
    if(current<requiredDreamShards)missing.push('dream_shards');
  }

  const requiredItem=String(route.required_item||'').trim();
  if(requiredItem){
    const reserve=asNonNegativeInteger(input.safe_reserve?.[requiredItem]??0);
    if(reserve===null)return incomplete('invalid_item_safe_reserve',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id,item_name:requiredItem});
    const inventory=asNonNegativeInteger(input.item_inventory?.[requiredItem]);
    if(inventory===null)return incomplete('missing_item_inventory_authority',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id,item_name:requiredItem});
    const usable=Math.max(0,inventory-reserve);
    requirements.push({kind:'item',item_name:requiredItem,required:1,current:usable,inventory,safe_reserve:reserve});
    if(usable<1){
      const rows=(Array.isArray(input.item_acquisition_rows)?input.item_acquisition_rows:[]).filter(row=>String(row.item_name||'').trim()===requiredItem);
      const verified=rows.filter(row=>String(row.authority_status||'').trim()&&!['MISSING_AUTHORITY','UNKNOWN'].includes(String(row.authority_status).trim()));
      if(!verified.length){
        return incomplete('missing_item_acquisition_authority',{
          pokemon_instance_id:pokemonInstanceId,
          route_id:route.route_id,
          item_name:requiredItem,
          acquisition_guidance_suppressed:true,
        });
      }
      let acquisitionKnown=false;
      for(const row of verified){
        const type=String(row.acquisition_type||'');
        if(type==='regular_sleep_point_exchange'||type==='premium_sleep_point_exchange'){
          const cost=asNonNegativeInteger(row.sleep_point_cost);
          if(cost===null)return incomplete('missing_sleep_point_cost_authority',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id,item_name:requiredItem});
          const points=input.player_resources?.sleep_points;
          if(!knownNumeric(points))return incomplete('missing_sleep_points_authority',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id,item_name:requiredItem});
          if(type==='premium_sleep_point_exchange'){
            const premium=input.player_resources?.premium_pass_state;
            if(!knownPremium(premium))return incomplete('missing_premium_pass_authority',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id,item_name:requiredItem});
          }
          acquisitionKnown=true;
        }else if(type==='diamond_shop_fixed'||type==='diamond_bundle_limited'){
          const cost=asNonNegativeInteger(row.diamond_cost);
          if(cost===null)return incomplete('missing_diamond_cost_authority',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id,item_name:requiredItem});
          const diamonds=input.player_resources?.diamonds;
          if(!knownNumeric(diamonds))return incomplete('missing_diamonds_authority',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id,item_name:requiredItem});
          acquisitionKnown=true;
        }else{
          acquisitionKnown=true;
        }
      }
      if(!acquisitionKnown)return incomplete('missing_item_acquisition_authority',{pokemon_instance_id:pokemonInstanceId,route_id:route.route_id,item_name:requiredItem,acquisition_guidance_suppressed:true});
      missing.push('item');
    }
  }

  const detailedStatus=missing.length===0
    ?G121_EVOLUTION_STATUS.READY_NOW
    :missing.length>1
      ?G121_EVOLUTION_STATUS.MULTIPLE_REQUIREMENTS_MISSING
      :({
        level:G121_EVOLUTION_STATUS.MISSING_LEVEL,
        sleep_hours:G121_EVOLUTION_STATUS.MISSING_SLEEP_HOURS,
        candy:G121_EVOLUTION_STATUS.MISSING_CANDY,
        item:G121_EVOLUTION_STATUS.MISSING_ITEM,
        dream_shards:G121_EVOLUTION_STATUS.MISSING_DREAM_SHARDS,
      }[missing[0]]||G121_EVOLUTION_STATUS.EVOLUTION_NOT_RECOMMENDED_YET);

  return {
    status:missing.length===0?G121B_DETERMINISTIC_STATUS.CURRENT_AVAILABLE:G121B_DETERMINISTIC_STATUS.NEAR_TERM,
    reason:missing.length===0?'all_authoritative_requirements_satisfied':'authoritative_requirements_not_yet_satisfied',
    detailed_status:detailedStatus,
    pokemon_instance_id:pokemonInstanceId,
    route_id:route.route_id,
    requirements,
    missing_requirements:missing,
  };
}
