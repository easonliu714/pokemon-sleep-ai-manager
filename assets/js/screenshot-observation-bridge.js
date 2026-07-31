import {normalizeObservationPayload,validateObservationPayload} from './ai-observation.js';

const clone=value=>JSON.parse(JSON.stringify(value));

function mergeEvidence(target,source){
  const refs=new Set([...(target?.source_image_refs||[]),...(source?.source_image_refs||[])]);
  return {
    source_image_refs:[...refs],
    field_confidence:{...(target?.field_confidence||{}),...(source?.field_confidence||{})},
    unreadable_fields:[...new Set([...(target?.unreadable_fields||[]),...(source?.unreadable_fields||[])])],
    notes:[target?.notes,source?.notes].filter(Boolean).join(' | ')||null
  };
}

export function buildObservationFromScreenshotGroup(group,{ocrObservation=null,aiObservation=null}={}){
  const sources=[ocrObservation,aiObservation].filter(Boolean).map(item=>normalizeObservationPayload({schema_version:'2.0-observation',observations:[item]}).observations[0]);
  const base=sources.shift()||{
    incoming_ref:`screenshot-group:${group.group_key}`,
    requested_action:'resolve_on_import',
    identity:{target_pokemon_instance_id:null,target_update_token:null,capture_species_id:null,current_species_id:null,registered_date:null,instance_discriminator:null},
    profile:{species:group.header?.name||null,level:group.header?.level??null,sp:group.header?.sp??null},
    ingredients:[],subskills:[],evidence:{source_image_refs:group.images?.map(item=>item.path||item.name).filter(Boolean)||[],field_confidence:{},unreadable_fields:[],notes:null}
  };
  for(const source of sources){
    base.profile={...(base.profile||{}),...(source.profile||{})};
    base.identity={...(base.identity||{}),...(source.identity||{})};
    base.progression={...(base.progression||{}),...(source.progression||{})};
    if(source.ingredients?.length)base.ingredients=clone(source.ingredients);
    if(source.subskills?.length)base.subskills=clone(source.subskills);
    base.evidence=mergeEvidence(base.evidence,source.evidence);
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
  return {...validateObservationPayload(payload),payload};
}
