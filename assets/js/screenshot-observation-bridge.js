import {normalizeObservationPayload,validateObservationPayload} from './ai-observation.js';
import {
  buildPokemonVisualEvidenceManifest,
  evaluatePokemonVisualUpdateManifest,
} from './pokemon-visual-update-preflight.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').normalize('NFKC').trim();

function mergeEvidence(target,source){
  const refs=new Set([...(target?.source_image_refs||[]),...(source?.source_image_refs||[])]);
  return {
    source_image_refs:[...refs],
    field_confidence:{...(target?.field_confidence||{}),...(source?.field_confidence||{})},
    unreadable_fields:[...new Set([...(target?.unreadable_fields||[]),...(source?.unreadable_fields||[])])],
    notes:[target?.notes,source?.notes].filter(Boolean).join(' | ')||null
  };
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
  return {
    contract_version:source.contract_version||target.contract_version,
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

export function buildObservationFromScreenshotGroup(group,{ocrObservation=null,aiObservation=null}={}){
  const sources=[ocrObservation,aiObservation].filter(Boolean).map(item=>normalizeObservationPayload({schema_version:'2.0-observation',observations:[item]}).observations[0]);
  const base=sources.shift()||{
    incoming_ref:`screenshot-group:${group.group_key}`,
    requested_action:'resolve_on_import',
    identity:{target_pokemon_instance_id:null,target_update_token:null,capture_species_id:null,current_species_id:null,registered_date:null,instance_discriminator:null},
    profile:{species:group.header?.name||null,level:group.header?.level??null,sp:group.header?.sp??null},
    ingredients:[],subskills:[],
    evidence:{source_image_refs:group.images?.map(item=>item.path||item.name).filter(Boolean)||[],field_confidence:{},unreadable_fields:[],notes:null},
    visual_evidence:null,
  };
  for(const source of sources){
    base.profile={...(base.profile||{}),...(source.profile||{})};
    base.identity={...(base.identity||{}),...(source.identity||{})};
    base.progression={...(base.progression||{}),...(source.progression||{})};
    if(source.ingredients?.length)base.ingredients=clone(source.ingredients);
    if(source.subskills?.length)base.subskills=clone(source.subskills);
    base.evidence=mergeEvidence(base.evidence,source.evidence);
    base.visual_evidence=mergeVisualEvidence(base.visual_evidence,source.visual_evidence);
  }
  base.incoming_ref=`screenshot-group:${group.group_key}`;
  base.requested_action='resolve_on_import';
  base.profile={...(base.profile||{}),species:base.profile?.species||group.header?.name||null,level:base.profile?.level??group.header?.level??null,sp:base.profile?.sp??group.header?.sp??null};
  base.evidence=mergeEvidence(base.evidence,{source_image_refs:group.images?.map(item=>item.path||item.name).filter(Boolean)||[]});
  return base;
}

export function buildObservationPayloadFromScreenshotGroups(groups,resultsByGroup={}){
  const observations=(groups||[]).map(group=>buildObservationFromScreenshotGroup(group,resultsByGroup[group.group_key]||{}));
  const payload=normalizeObservationPayload({schema_version:'2.0-observation',source:'ai_screenshot_observation',observations});
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
