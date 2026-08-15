import {
  INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_ID,
  INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_VERSION,
  FIRST_PARTY_OBSERVATION_STATUS,
  evaluateFirstPartyIngredientHelpObservation,
  wilsonBinomialInterval,
} from './ingredient-probability-first-party-observation-contract.js';

export const FIRST_PARTY_OBSERVATION_UPDATE_VERSION='ingredient-probability-first-party-observation-update-2026-08-15-a';
export const FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO='ingredient_probability_first_party_observation_update';
export const FIRST_PARTY_OBSERVATION_UPDATE_ENTITY='ingredient_probability_observations';
export const FIRST_PARTY_OBSERVATION_UPDATE_SOURCE='player_first_party_manual_capture';
export const FIRST_PARTY_OBSERVATION_CAPTURE_INPUT_METHOD='MANUAL_TYPED_COUNTS';
export const FIRST_PARTY_OBSERVATION_OPERATION_EVIDENCE_TYPE='first_party_manual_count_capture';

const text=value=>String(value??'').normalize('NFKC').trim();
const clone=value=>JSON.parse(JSON.stringify(value));
const bool=value=>value===true;
const sameNumber=(left,right)=>{
  if(left===null||left===undefined||right===null||right===undefined)return left==null&&right==null;
  const a=Number(left),b=Number(right);
  return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-12;
};
const jsonEqual=(left,right)=>JSON.stringify(left??null)===JSON.stringify(right??null);
const safeArray=value=>Array.isArray(value)?value:[];
const validIso=value=>Boolean(text(value))&&Number.isFinite(Date.parse(value));

const RAW_FIELDS=Object.freeze([
  'observation_id','observation_source','observation_mode','source_key','canonical_species_form_id',
  'species_form_identity_confirmed','player_private_identity_included','observation_evidence_refs','level','ingredient_slots',
  'individual_ingredient_rate_modifier_state','environment_ingredient_rate_modifier_state','inventory_empty_at_window_start',
  'collection_before_inventory_overflow_confirmed','sneaky_snacking_or_overflow_observed','helper_whistle_used',
  'external_extra_help_effect_used','non_help_item_contamination','collection_counts_complete',
  'external_rate_value_used_to_reconstruct_events','berry_items_collected','ingredient_items_collected','berry_items_per_help',
  'berry_items_per_help_authority','inventory_items_before_collection','inventory_capacity',
]);
const DERIVED_FIELDS=Object.freeze([
  'contract_id','contract_version','status','blockers','eligible_for_statistical_aggregation','berry_help_event_count',
  'ingredient_help_event_count','total_help_event_count','ingredient_event_fraction','statistical_semantics',
  'base_rate_normalization_applied','activation_authority_granted','independent_source_admission_granted','safety',
]);
const FORBIDDEN_PRIVATE_FIELDS=Object.freeze([
  'pokemon_id','pokemon_instance_id','game_pokemon_id','nickname','registered_at','obtained_at','identity_fingerprint','player_name','account_id',
]);

export function buildFirstPartyIngredientObservationRecord(input={}){
  const raw=Object.fromEntries(RAW_FIELDS.map(field=>[field,clone(input[field]??null)]));
  const evaluation=evaluateFirstPartyIngredientHelpObservation(raw);
  return Object.freeze({
    ...raw,
    capture_input_method:FIRST_PARTY_OBSERVATION_CAPTURE_INPUT_METHOD,
    contract_id:evaluation.contract_id,
    contract_version:evaluation.contract_version,
    status:evaluation.status,
    blockers:Object.freeze([...evaluation.blockers]),
    eligible_for_statistical_aggregation:evaluation.eligible_for_statistical_aggregation,
    berry_help_event_count:evaluation.berry_help_event_count,
    ingredient_help_event_count:evaluation.ingredient_help_event_count,
    total_help_event_count:evaluation.total_help_event_count,
    ingredient_event_fraction:evaluation.ingredient_event_fraction,
    statistical_semantics:evaluation.statistical_semantics,
    base_rate_normalization_applied:evaluation.base_rate_normalization_applied,
    activation_authority_granted:evaluation.activation_authority_granted,
    independent_source_admission_granted:evaluation.independent_source_admission_granted,
    safety:evaluation.safety,
  });
}

export function validateFirstPartyIngredientObservationUpdateOperation(operation={}){
  const errors=[],warnings=[];
  const data=operation?.data||{};
  if(operation.entity!==FIRST_PARTY_OBSERVATION_UPDATE_ENTITY)errors.push(`entity 必須是 ${FIRST_PARTY_OBSERVATION_UPDATE_ENTITY}`);
  if(operation.action!=='upsert')errors.push('first-party ingredient observation 只允許 upsert');
  if(safeArray(operation.clear_fields).length)errors.push('first-party ingredient observation 禁止 clear_fields；原始觀測只能以新 observation_id 保存');
  const keyId=text(operation?.key?.observation_id),dataId=text(data.observation_id);
  if(!keyId)errors.push('key.observation_id 必填');
  if(!dataId)errors.push('data.observation_id 必填');
  if(keyId&&dataId&&keyId!==dataId)errors.push('key.observation_id 與 data.observation_id 必須一致');
  if(!validIso(data.captured_at))errors.push('data.captured_at 必須是有效 ISO 日期時間');
  if(text(data.capture_input_method)!==FIRST_PARTY_OBSERVATION_CAPTURE_INPUT_METHOD)errors.push(`capture_input_method 必須是 ${FIRST_PARTY_OBSERVATION_CAPTURE_INPUT_METHOD}`);
  if(operation.review_required===true)errors.push('觀測 status=REVIEW_REQUIRED 與 Update Center operation.review_required 是不同語意；本 entity 必須先 deterministic 驗證後再安全保存');
  if(text(operation?.evidence?.source_type)!==FIRST_PARTY_OBSERVATION_OPERATION_EVIDENCE_TYPE)errors.push(`evidence.source_type 必須是 ${FIRST_PARTY_OBSERVATION_OPERATION_EVIDENCE_TYPE}`);
  for(const field of FORBIDDEN_PRIVATE_FIELDS)if(Object.prototype.hasOwnProperty.call(data,field))errors.push(`禁止在 first-party observation Update Package 中包含私人 identity 欄位：${field}`);

  const raw=Object.fromEntries(RAW_FIELDS.map(field=>[field,clone(data[field]??null)]));
  const evaluation=evaluateFirstPartyIngredientHelpObservation(raw);
  if(text(data.contract_id)!==INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_ID)errors.push('contract_id 不符合 E3C-6 authority');
  if(text(data.contract_version)!==INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_VERSION)errors.push('contract_version 不符合 E3C-6 authority');
  if(text(data.status)!==evaluation.status)errors.push(`status 與 deterministic evaluator 不一致：expected=${evaluation.status}`);
  if(!jsonEqual(safeArray(data.blockers),[...evaluation.blockers]))errors.push('blockers 與 deterministic evaluator 不一致');
  if(bool(data.eligible_for_statistical_aggregation)!==evaluation.eligible_for_statistical_aggregation)errors.push('eligible_for_statistical_aggregation 與 deterministic evaluator 不一致');
  for(const field of ['berry_help_event_count','ingredient_help_event_count','total_help_event_count','ingredient_event_fraction']){
    if(!sameNumber(data[field],evaluation[field]))errors.push(`${field} 與 deterministic evaluator 不一致`);
  }
  for(const field of ['statistical_semantics','base_rate_normalization_applied','activation_authority_granted','independent_source_admission_granted']){
    const expected=evaluation[field];
    if(typeof expected==='boolean'){
      if(bool(data[field])!==expected)errors.push(`${field} 與 deterministic evaluator 不一致`);
    }else if(text(data[field])!==text(expected))errors.push(`${field} 與 deterministic evaluator 不一致`);
  }
  if(!jsonEqual(data.safety,evaluation.safety))errors.push('safety 與 deterministic evaluator 不一致');
  if(evaluation.status===FIRST_PARTY_OBSERVATION_STATUS.REVIEW_REQUIRED){
    warnings.push(`觀測 ${dataId||keyId||'(unknown)'} 將以 REVIEW_REQUIRED 保留，但不會納入任何統計聚合：${evaluation.blockers.join(', ')}`);
  }
  return Object.freeze({errors:Object.freeze(errors),warnings:Object.freeze(warnings),evaluation});
}

export function validateFirstPartyIngredientObservationUpdatePackage(payload={}){
  const errors=[],warnings=[];
  if(payload.scenario!==FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO)errors.push(`scenario 必須是 ${FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO}`);
  if(payload.source!==FIRST_PARTY_OBSERVATION_UPDATE_SOURCE)errors.push(`source 必須是 ${FIRST_PARTY_OBSERVATION_UPDATE_SOURCE}`);
  if(payload?.production_boundary?.ingredient_probability_per_help!=='OBSERVED_PARTIAL_ONLY')errors.push('production_boundary.ingredient_probability_per_help 必須維持 OBSERVED_PARTIAL_ONLY');
  if(payload?.production_boundary?.runtime_numeric_activation!==false)errors.push('production_boundary.runtime_numeric_activation 必須是 false');
  if(payload?.production_boundary?.production_active_dimensions!=='4/7')errors.push('production_boundary.production_active_dimensions 必須維持 4/7');
  if(payload?.production_boundary?.sample_sufficiency_for_activation!=='NOT_DEFINED')errors.push('sample_sufficiency_for_activation 必須維持 NOT_DEFINED');
  const operations=Array.isArray(payload.operations)?payload.operations:[];
  if(!operations.length)errors.push('first-party observation Update Package 至少需要 1 筆 operation');
  for(const [index,operation] of operations.entries()){
    const result=validateFirstPartyIngredientObservationUpdateOperation(operation);
    errors.push(...result.errors.map(message=>`#${index+1} ${message}`));
    warnings.push(...result.warnings.map(message=>`#${index+1} ${message}`));
  }
  return Object.freeze({errors:Object.freeze(errors),warnings:Object.freeze(warnings)});
}

export function buildFirstPartyIngredientObservationUpdatePackage(input={},options={}){
  const generatedAt=options.generatedAt||new Date().toISOString();
  const capturedAt=options.capturedAt||generatedAt;
  if(!validIso(generatedAt)||!validIso(capturedAt))throw new Error('generated_at_and_captured_at_must_be_valid_iso');
  const record=buildFirstPartyIngredientObservationRecord(input);
  const observationId=text(record.observation_id);
  if(!observationId)throw new Error('observation_id_required');
  const evidenceRefs=safeArray(record.observation_evidence_refs).map(text).filter(Boolean);
  const suffix=observationId.replace(/[^A-Za-z0-9_-]/g,'').slice(-24)||'OBS';
  const payload={
    schema_version:'1.1',
    update_id:options.updateId||`UPD-${generatedAt.replace(/[-:TZ.]/g,'').slice(0,14)}-E3C6B-${suffix}`,
    generated_at:generatedAt,
    source:FIRST_PARTY_OBSERVATION_UPDATE_SOURCE,
    scenario:FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO,
    privacy:{
      contains_private_raw_observation:true,
      intended_storage:'browser_indexeddb_sqlite_only',
      public_repository_commit_allowed:false,
      deidentified_aggregate_export_separate:true,
    },
    production_boundary:{
      ingredient_probability_per_help:'OBSERVED_PARTIAL_ONLY',
      runtime_numeric_activation:false,
      production_active_dimensions:'4/7',
      sample_sufficiency_for_activation:'NOT_DEFINED',
    },
    operations:[{
      operation_id:`OBS-${suffix}`,
      entity:FIRST_PARTY_OBSERVATION_UPDATE_ENTITY,
      action:'upsert',
      key:{observation_id:observationId},
      data:{...clone(record),captured_at:capturedAt},
      clear_fields:[],
      evidence:{
        source_type:FIRST_PARTY_OBSERVATION_OPERATION_EVIDENCE_TYPE,
        source_image_ref:evidenceRefs[0]||'manual-first-party-observation',
        source_image_refs:evidenceRefs,
        confidence:1,
      },
      review_required:false,
    }],
  };
  const validation=validateFirstPartyIngredientObservationUpdatePackage(payload);
  if(validation.errors.length)throw new Error(`first_party_observation_update_invalid:${validation.errors.join('|')}`);
  return Object.freeze(payload);
}

// Importer-owned normalization: JSON arrays/objects are preserved in the private
// Update Package but serialized only at the SQLite boundary. Derived values are
// never trusted; they are re-evaluated before this function is allowed to return.
export function prepareFirstPartyIngredientObservationStorageData(operation={},payload={},updatedAt=new Date().toISOString()){
  const validation=validateFirstPartyIngredientObservationUpdateOperation(operation);
  if(validation.errors.length)throw new Error(`FIRST_PARTY_OBSERVATION_VALIDATION_FAILED:${validation.errors.join('|')}`);
  const data=clone(operation.data||{});
  for(const field of ['observation_evidence_refs','ingredient_slots','blockers','safety'])data[field]=JSON.stringify(data[field]??(field==='safety'?{}:[]));
  for(const field of [
    'species_form_identity_confirmed','player_private_identity_included','inventory_empty_at_window_start',
    'collection_before_inventory_overflow_confirmed','sneaky_snacking_or_overflow_observed','helper_whistle_used',
    'external_extra_help_effect_used','non_help_item_contamination','collection_counts_complete',
    'external_rate_value_used_to_reconstruct_events','eligible_for_statistical_aggregation','base_rate_normalization_applied',
    'activation_authority_granted','independent_source_admission_granted',
  ])data[field]=data[field]===true?1:0;
  data.updated_at=updatedAt;
  data.source_update_id=payload.update_id||null;
  return data;
}

export function buildDeidentifiedFirstPartyIngredientAggregate(rows=[]){
  const accepted=(Array.isArray(rows)?rows:[]).filter(row=>row?.status===FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION&&Number(row?.eligible_for_statistical_aggregation)===1);
  const grouped=new Map();
  for(const row of accepted){
    const key=text(row.source_key);
    if(!key)continue;
    const current=grouped.get(key)||{source_key:key,observation_count:0,berry_help_event_count:0,ingredient_help_event_count:0,total_help_event_count:0};
    current.observation_count+=1;
    current.berry_help_event_count+=Number(row.berry_help_event_count)||0;
    current.ingredient_help_event_count+=Number(row.ingredient_help_event_count)||0;
    current.total_help_event_count+=Number(row.total_help_event_count)||0;
    grouped.set(key,current);
  }
  const groups=[...grouped.values()].sort((a,b)=>a.source_key.localeCompare(b.source_key)).map(row=>{
    const interval=wilsonBinomialInterval(row.ingredient_help_event_count,row.total_help_event_count);
    return Object.freeze({
      source_key:row.source_key,
      observation_count:row.observation_count,
      berry_help_event_count:row.berry_help_event_count,
      ingredient_help_event_count:row.ingredient_help_event_count,
      total_help_event_count:row.total_help_event_count,
      observed_fraction:interval?.estimate??null,
      wilson_95:interval?Object.freeze({lower:interval.lower,upper:interval.upper}):null,
    });
  });
  return Object.freeze({
    schema:'pokemon-sleep-deidentified-first-party-ingredient-observation-aggregate/1.0',
    generated_at:new Date().toISOString(),
    source:'LOCAL_FIRST_PARTY_OBSERVATIONS',
    privacy:Object.freeze({raw_observation_included:false,evidence_refs_included:false,player_identity_included:false,source_key_only:true}),
    statistical_status:groups.length?'OBSERVED_PARTIAL_ONLY':'NO_ACCEPTED_OBSERVATIONS',
    sample_sufficiency_for_activation:'NOT_DEFINED',
    activation_authority_granted:false,
    groups:Object.freeze(groups),
  });
}

export const FIRST_PARTY_OBSERVATION_STORAGE_FIELDS=Object.freeze([...RAW_FIELDS,'capture_input_method',...DERIVED_FIELDS,'captured_at','updated_at','source_update_id']);