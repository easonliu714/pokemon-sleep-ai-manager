import {normalizeObservationPayload,validateObservationPayload} from './ai-observation.js';
import {POKEMON_VISUAL_PROMPT_POLICY_VERSION} from './pokemon-visual-prompt-policy.js';
import {
  buildPokemonVisualEvidenceManifest,
  evaluatePokemonVisualUpdateManifest,
} from './pokemon-visual-update-preflight.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').normalize('NFKC').trim();
const meaningful=value=>value!==null&&value!==undefined&&clean(value)!=='';
const comparable=value=>typeof value==='string'?clean(value):value;
const sourceRefs=evidence=>[...(evidence?.source_image_refs||[])].filter(Boolean);

function mergeConflictMaps(target={},source={}){
  const output=clone(target||{});
  for(const [field,row] of Object.entries(source||{})){
    const current=output[field]||{};
    output[field]={
      values:[...new Set([...(current.values||[]),...(row?.values||[])].filter(meaningful).map(value=>typeof value==='string'?clean(value):value))],
      source_image_refs:[...new Set([...(current.source_image_refs||[]),...(row?.source_image_refs||[])].filter(Boolean))],
      status:'CONFLICT',
      resolution_required:true,
    };
  }
  return output;
}

function mergeEvidence(target,source){
  const refs=new Set([...(target?.source_image_refs||[]),...(source?.source_image_refs||[])]);
  return {
    ...(target||{}),
    ...(source||{}),
    source_image_refs:[...refs],
    field_confidence:{...(target?.field_confidence||{}),...(source?.field_confidence||{})},
    unreadable_fields:[...new Set([...(target?.unreadable_fields||[]),...(source?.unreadable_fields||[])])],
    field_conflicts:mergeConflictMaps(target?.field_conflicts,source?.field_conflicts),
    notes:[target?.notes,source?.notes].filter(Boolean).join(' | ')||null
  };
}

function recordScalarConflict(conflicts,field,targetValue,sourceValue,targetEvidence,sourceEvidence){
  const current=conflicts[field]||{};
  conflicts[field]={
    values:[...new Set([...(current.values||[]),targetValue,sourceValue].filter(meaningful).map(value=>typeof value==='string'?clean(value):value))],
    source_image_refs:[...new Set([...(current.source_image_refs||[]),...sourceRefs(targetEvidence),...sourceRefs(sourceEvidence)].filter(Boolean))],
    status:'CONFLICT',
    resolution_required:true,
  };
}

function mergeScalarObject(target={},source={},targetEvidence=null,sourceEvidence=null,{ignoreKeys=[]}={}){
  const output={...(target||{})};
  const conflicts={};
  const ignored=new Set(ignoreKeys);
  for(const key of new Set([...Object.keys(target||{}),...Object.keys(source||{})])){
    if(ignored.has(key))continue;
    const a=target?.[key],b=source?.[key];
    if(!meaningful(b))continue;
    if(!meaningful(a)){output[key]=clone(b);continue;}
    if(Object.is(comparable(a),comparable(b)))continue;
    output[key]=null;
    recordScalarConflict(conflicts,key,a,b,targetEvidence,sourceEvidence);
  }
  return {output,conflicts};
}

function mergeSlotRows(targetRows=[],sourceRows=[],kind,targetEvidence=null,sourceEvidence=null){
  const levels=new Set([...targetRows,...sourceRows].map(row=>Number(row?.unlock_level)).filter(Number.isFinite));
  const conflicts={};
  const rows=[...levels].sort((a,b)=>a-b).map(level=>{
    const target=targetRows.find(row=>Number(row?.unlock_level)===level)||{};
    const source=sourceRows.find(row=>Number(row?.unlock_level)===level)||{};
    const {output,rowConflicts}=(()=>{
      const merged={unlock_level:level,...target};
      const local={};
      for(const key of new Set([...Object.keys(target),...Object.keys(source)])){
        if(key==='unlock_level')continue;
        const a=target[key],b=source[key];
        if(!meaningful(b))continue;
        if(!meaningful(a)){merged[key]=clone(b);continue;}
        if(Object.is(comparable(a),comparable(b)))continue;
        merged[key]=null;
        const path=`${kind}.${level}.${key}`;
        recordScalarConflict(local,path,a,b,targetEvidence,sourceEvidence);
      }
      return {output:merged,rowConflicts:local};
    })();
    Object.assign(conflicts,mergeConflictMaps(conflicts,rowConflicts));
    return output;
  });
  return {rows,conflicts};
}

function mergeDirectEvidence(target,source,kind){
  if(!target)return source?clone(source):null;
  if(!source)return clone(target);
  const targetValue=clean(target.value),sourceValue=clean(source.value);
  if(targetValue&&sourceValue&&targetValue===sourceValue){
    const preferred=Number(source.confidence||0)>Number(target.confidence||0)?source:target;
    return {
      ...clone(preferred),kind,value:targetValue,
      supporting_source_image_refs:[...new Set([target.source_image_ref,source.source_image_ref,...(target.supporting_source_image_refs||[]),...(source.supporting_source_image_refs||[])].filter(Boolean))],
    };
  }
  return {
    kind,value:null,
    source_image_ref:target.source_image_ref||source.source_image_ref||null,
    confidence:Math.min(Number(target.confidence||0),Number(source.confidence||0)),
    observation_basis:null,
    inference_used:null,
    merge_conflict:true,
    conflicting_values:[...new Set([targetValue,sourceValue].filter(Boolean))],
    supporting_source_image_refs:[...new Set([target.source_image_ref,source.source_image_ref].filter(Boolean))],
    ...(Number.isFinite(Number(target.unlock_level??source.unlock_level))?{unlock_level:Number(target.unlock_level??source.unlock_level)}:{}),
  };
}

function mergeSlotEvidence(targetRows,sourceRows,kind){
  const levels=new Set([...(targetRows||[]).map(row=>Number(row?.unlock_level)),...(sourceRows||[]).map(row=>Number(row?.unlock_level))].filter(Number.isFinite));
  return [...levels].sort((a,b)=>a-b).map(level=>{
    const target=(targetRows||[]).find(row=>Number(row?.unlock_level)===level)||null;
    const source=(sourceRows||[]).find(row=>Number(row?.unlock_level)===level)||null;
    return {...mergeDirectEvidence(target,source,kind),unlock_level:level};
  });
}

function mergeVisualEvidence(target,source){
  if(!target&&!source)return null;
  if(!target)return clone(source);
  if(!source)return clone(target);
  const policyVersion=target.prompt_policy_version&&source.prompt_policy_version&&target.prompt_policy_version===source.prompt_policy_version?target.prompt_policy_version:null;
  return {
    contract_version:source.contract_version===target.contract_version?target.contract_version:null,
    prompt_policy_version:policyVersion,
    public_relation_may_generate_player_observation:false,
    type:mergeDirectEvidence(target.type,source.type,'TYPE_VISUAL'),
    berry:mergeDirectEvidence(target.berry,source.berry,'BERRY_VISUAL'),
    ingredients:mergeSlotEvidence(target.ingredients,source.ingredients,'INGREDIENT_VISUAL'),
    main_skill:mergeDirectEvidence(target.main_skill,source.main_skill,'MAIN_SKILL_TEXT'),
    subskills:mergeSlotEvidence(target.subskills,source.subskills,'SUBSKILL_TEXT'),
  };
}

function visualManifestRow(observation){
  const visual=observation?.visual_evidence;
  if(!visual)return null;
  return {
    observation_ref:observation.incoming_ref,
    pokemon_id:null,
    species:observation.profile?.species||null,
    type:visual.type||null,
    berry:visual.berry||null,
    ingredients:visual.ingredients||[],
    main_skill:visual.main_skill||null,
    subskills:visual.subskills||[],
  };
}

function platformSpeciesContext(group){
  const species=clean(group?.canonical_species);
  const targetPokemonInstanceId=group?.target_pokemon_instance_id||group?.identity?.target_pokemon_instance_id||null;
  const currentSpeciesId=group?.current_species_id||group?.identity?.current_species_id||null;
  if(!species||(!targetPokemonInstanceId&&!currentSpeciesId))return {species:null,basis:null};
  return {species,basis:'PLATFORM_PROVIDED_CONTEXT'};
}

export function buildObservationFromScreenshotGroup(group,{ocrObservation=null,aiObservation=null}={}){
  const sources=[ocrObservation,aiObservation].filter(Boolean).map(item=>normalizeObservationPayload({schema_version:'2.0-observation',prompt_policy_version:item?.visual_evidence?.prompt_policy_version||null,observations:[item]}).observations[0]);
  const platformSpecies=platformSpeciesContext(group);
  const targetPokemonInstanceId=group?.target_pokemon_instance_id||group?.identity?.target_pokemon_instance_id||null;
  const currentSpeciesId=group?.current_species_id||group?.identity?.current_species_id||null;
  const base=sources.shift()||{
    incoming_ref:`screenshot-group:${group.group_key}`,
    requested_action:'resolve_on_import',
    identity:{target_pokemon_instance_id:targetPokemonInstanceId,target_update_token:null,capture_species_id:null,current_species_id:currentSpeciesId,registered_date:null,instance_discriminator:null},
    profile:{species:platformSpecies.species,species_observation_basis:platformSpecies.basis,header_name_text:group.header?.name||null,level:group.header?.level??null,sp:group.header?.sp??null},
    ingredients:[],subskills:[],
    evidence:{source_image_refs:group.images?.map(item=>item.path||item.name).filter(Boolean)||[],field_confidence:{},unreadable_fields:[],field_conflicts:{},notes:null},
    visual_evidence:null,
  };
  base.evidence=mergeEvidence(base.evidence,{field_conflicts:{}});
  for(const source of sources){
    const profileMerge=mergeScalarObject(base.profile,source.profile,base.evidence,source.evidence,{ignoreKeys:['species','species_observation_basis']});
    base.profile=profileMerge.output;
    const progressionMerge=mergeScalarObject(base.progression||{},source.progression||{},base.evidence,source.evidence);
    base.progression=progressionMerge.output;
    const ingredientMerge=mergeSlotRows(base.ingredients||[],source.ingredients||[],'ingredients',base.evidence,source.evidence);
    base.ingredients=ingredientMerge.rows;
    const subskillMerge=mergeSlotRows(base.subskills||[],source.subskills||[],'subskills',base.evidence,source.evidence);
    base.subskills=subskillMerge.rows;
    base.evidence=mergeEvidence(base.evidence,source.evidence);
    base.evidence.field_conflicts=mergeConflictMaps(base.evidence.field_conflicts,{
      ...profileMerge.conflicts,
      ...progressionMerge.conflicts,
      ...ingredientMerge.conflicts,
      ...subskillMerge.conflicts,
    });
    base.visual_evidence=mergeVisualEvidence(base.visual_evidence,source.visual_evidence);
  }
  base.incoming_ref=`screenshot-group:${group.group_key}`;
  base.requested_action='resolve_on_import';
  base.identity={
    ...(base.identity||{}),
    target_pokemon_instance_id:targetPokemonInstanceId||base.identity?.target_pokemon_instance_id||null,
    current_species_id:currentSpeciesId||base.identity?.current_species_id||null,
    instance_discriminator:null,
  };
  base.profile={
    ...(base.profile||{}),
    header_name_text:base.profile?.header_name_text||group.header?.name||null,
    level:base.profile?.level??group.header?.level??null,
    sp:base.profile?.sp??group.header?.sp??null,
  };
  if(platformSpecies.species){
    base.profile.species=platformSpecies.species;
    base.profile.species_observation_basis=platformSpecies.basis;
  }else{
    base.profile.species=null;
    base.profile.species_observation_basis=null;
  }
  base.evidence=mergeEvidence(base.evidence,{source_image_refs:group.images?.map(item=>item.path||item.name).filter(Boolean)||[]});
  return base;
}

export function buildObservationPayloadFromScreenshotGroups(groups,resultsByGroup={}){
  const observations=(groups||[]).map(group=>buildObservationFromScreenshotGroup(group,resultsByGroup[group.group_key]||{}));
  const payload=normalizeObservationPayload({schema_version:'2.0-observation',prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,source:'ai_screenshot_observation',observations});
  const validation=validateObservationPayload(payload);
  const visualRows=payload.observations.map(visualManifestRow).filter(Boolean);
  const visualManifest=buildPokemonVisualEvidenceManifest(visualRows);
  const visualPreflight=evaluatePokemonVisualUpdateManifest(visualManifest);
  return {
    ...validation,
    payload,
    pokemon_visual_evidence_required:true,
    pokemon_visual_evidence_manifest:visualManifest,
    visual_preflight:visualPreflight,
  };
}
