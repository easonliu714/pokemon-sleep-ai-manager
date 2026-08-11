import {isObservedWriteValue} from './data-preservation-policy.js';

const CREATE_FIELDS=new Set([
  'species','nickname','level','sp','specialty','type','nature','nature_bonus','nature_penalty',
  'main_skill','main_skill_level','helper_seconds','carry_limit','favorite_berry','registered_date',
  'capture_species','current_species','sleep_hours_with_helper'
]);
const UPDATE_FIELDS=new Set([
  'nickname','level','sp','nature','nature_bonus','nature_penalty','main_skill_level',
  'helper_seconds','carry_limit','favorite_berry','current_species','sleep_hours_with_helper'
]);

const clone=value=>JSON.parse(JSON.stringify(value));
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);

function pickAllowed(source,allowed){
  const output={};
  for(const key of allowed){
    if(hasOwn(source,key)&&isObservedWriteValue(source[key]))output[key]=clone(source[key]);
  }
  return output;
}

function rejectForbidden(source,allowed){
  return Object.keys(source||{}).filter(key=>!allowed.has(key));
}

export function buildCreatePayload(operation,observation){
  if(operation?.action!=='create_new')throw new Error('create_action_required');
  const profile={...(observation?.profile||{}),registered_date:observation?.identity?.registered_date??observation?.profile?.registered_date??null,capture_species:observation?.identity?.capture_species_id??observation?.profile?.capture_species??null,current_species:observation?.identity?.current_species_id??observation?.profile?.species??null,sleep_hours_with_helper:observation?.progression?.sleep_hours_with_helper??null};
  const payload=pickAllowed(profile,CREATE_FIELDS);
  if(!payload.species&&!payload.current_species)throw new Error('create_species_required');
  return payload;
}

export function buildUpdatePayload(operation,observation,current={}){
  if(operation?.action!=='accept_existing'||!operation?.pokemon_instance_id)throw new Error('existing_identity_required');
  const incoming={...(observation?.profile||{}),current_species:observation?.identity?.current_species_id??observation?.profile?.species??undefined,sleep_hours_with_helper:observation?.progression?.sleep_hours_with_helper??undefined};
  const forbidden=rejectForbidden(incoming,new Set([...UPDATE_FIELDS,'species','specialty','type','main_skill','registered_date','capture_species']));
  if(forbidden.length)throw new Error(`update_forbidden_fields:${forbidden.join(',')}`);
  const payload=pickAllowed(incoming,UPDATE_FIELDS);
  if(payload.sleep_hours_with_helper!=null&&current.sleep_hours_with_helper!=null&&Number(payload.sleep_hours_with_helper)<Number(current.sleep_hours_with_helper)){
    throw new Error('sleep_hours_regression_requires_review');
  }
  return payload;
}

export function createIdentityImportOperationApplier({findObservation,loadCurrent,insertPokemon,updatePokemon}={}){
  if(typeof findObservation!=='function')throw new TypeError('findObservation required');
  return async ({db,operation})=>{
    const observation=await findObservation(operation.incoming_ref);
    if(!observation)throw new Error(`observation_not_found:${operation.incoming_ref}`);
    if(operation.action==='create_new'){
      if(typeof insertPokemon!=='function')throw new TypeError('insertPokemon required');
      const payload=buildCreatePayload(operation,observation);
      return insertPokemon({db,payload,operation,observation});
    }
    if(operation.action==='accept_existing'){
      if(typeof updatePokemon!=='function')throw new TypeError('updatePokemon required');
      const current=typeof loadCurrent==='function'?await loadCurrent(operation.pokemon_instance_id):{};
      const payload=buildUpdatePayload(operation,observation,current||{});
      return updatePokemon({db,pokemon_instance_id:operation.pokemon_instance_id,payload,operation,observation,current});
    }
    throw new Error(`unsupported_operation:${operation.action}`);
  };
}

export {CREATE_FIELDS as IDENTITY_CREATE_FIELDS,UPDATE_FIELDS as IDENTITY_UPDATE_FIELDS};
