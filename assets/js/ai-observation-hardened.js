import {
  AI_OBSERVATION_PROMPT as LEGACY_AI_OBSERVATION_PROMPT,
  buildObservationTemplate as buildLegacyObservationTemplate,
  normalizeObservationPayload as normalizeLegacyObservationPayload,
  validateObservationPayload as validateLegacyObservationPayload,
} from './ai-observation.js';
import {
  POKEMON_VISUAL_PROMPT_POLICY_VERSION,
  DIRECT_IMAGE_OBSERVATION_BASIS,
  buildPokemonVisualPromptPolicyInstruction,
} from './pokemon-visual-prompt-policy.js';

export const AI_OBSERVATION_HARDENED_VERSION='ai-observation-hardened-2026-08-15-a';
export const AI_OBSERVATION_PROMPT=`${LEGACY_AI_OBSERVATION_PROMPT}${buildPokemonVisualPromptPolicyInstruction()}`;
export const ALLOWED_SPECIES_OBSERVATION_BASIS=Object.freeze(['DIRECT_NON_EDITABLE_SPECIES_LABEL','PLATFORM_PROVIDED_CONTEXT']);

const SUBSKILL_LEVEL_MAP=new Map([[75,70],[100,80]]);
const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').normalize('NFKC').trim();

function extractJsonText(input){
  if(typeof input!=='string')return input;
  const fenced=input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source=(fenced?.[1]||input).trim();
  const start=source.indexOf('{'),end=source.lastIndexOf('}');
  if(start<0||end<start)throw new Error('找不到 JSON 物件');
  return source.slice(start,end+1);
}

function rawPayload(input){
  const parsed=typeof input==='string'?JSON.parse(extractJsonText(input)):clone(input);
  return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
}

function overlayDirectMetadata(normalized,raw){
  if(!normalized||!raw||typeof raw!=='object')return normalized;
  return {
    ...normalized,
    observation_basis:raw.observation_basis??null,
    inference_used:raw.inference_used??null,
  };
}

function normalizedLevel(value){
  const number=Number(value);
  return SUBSKILL_LEVEL_MAP.get(number)||number;
}

function overlayVisualMetadata(normalized,raw){
  if(!normalized||!raw||typeof raw!=='object')return normalized;
  const rawIngredients=Array.isArray(raw.ingredients)?raw.ingredients:[];
  const rawSubskills=Array.isArray(raw.subskills)?raw.subskills:[];
  return {
    ...normalized,
    prompt_policy_version:raw.prompt_policy_version??null,
    type:overlayDirectMetadata(normalized.type,raw.type),
    berry:overlayDirectMetadata(normalized.berry,raw.berry),
    main_skill:overlayDirectMetadata(normalized.main_skill,raw.main_skill),
    ingredients:(normalized.ingredients||[]).map(row=>overlayDirectMetadata(row,rawIngredients.find(item=>Number(item?.unlock_level)===Number(row?.unlock_level)))),
    subskills:(normalized.subskills||[]).map(row=>overlayDirectMetadata(row,rawSubskills.find(item=>normalizedLevel(item?.unlock_level)===Number(row?.unlock_level)))),
  };
}

export function buildObservationTemplate(){
  const template=buildLegacyObservationTemplate();
  template.prompt_policy_version=POKEMON_VISUAL_PROMPT_POLICY_VERSION;
  for(const observation of template.observations||[]){
    observation.profile={
      ...(observation.profile||{}),
      header_name_text:null,
      species_observation_basis:null,
    };
    observation.visual_evidence={
      ...(observation.visual_evidence||{}),
      prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,
    };
  }
  return template;
}

export function normalizeObservationPayload(input){
  const raw=rawPayload(input);
  const payload=normalizeLegacyObservationPayload(input);
  payload.prompt_policy_version=raw.prompt_policy_version??null;
  payload.observations=(payload.observations||[]).map((observation,index)=>{
    const source=raw.observations?.[index]||{};
    return {
      ...observation,
      profile:{
        ...(observation.profile||{}),
        header_name_text:source.profile?.header_name_text??observation.profile?.header_name_text??null,
        species_observation_basis:source.profile?.species_observation_basis??observation.profile?.species_observation_basis??null,
      },
      visual_evidence:overlayVisualMetadata(observation.visual_evidence,source.visual_evidence),
    };
  });
  return payload;
}

function directEvidenceRows(visual){
  if(!visual)return [];
  return [visual.type,visual.berry,visual.main_skill,...(visual.ingredients||[]),...(visual.subskills||[])].filter(Boolean);
}

export function validateObservationPayload(input){
  let payload;
  try{payload=normalizeObservationPayload(input);}catch(error){return {payload:null,errors:[error.message],warnings:[],summary:{}};}
  const base=validateLegacyObservationPayload(payload);
  const errors=[...(base.errors||[])],warnings=[...(base.warnings||[])];
  let hardenedVisualCount=0,directEvidenceCount=0;
  payload.observations.forEach((observation,index)=>{
    const label=`#${index+1}`;
    const visual=observation.visual_evidence;
    if(visual){
      hardenedVisualCount+=1;
      if(payload.prompt_policy_version!==POKEMON_VISUAL_PROMPT_POLICY_VERSION)errors.push(`${label} prompt_policy_version 必須為 ${POKEMON_VISUAL_PROMPT_POLICY_VERSION}`);
      if(visual.prompt_policy_version!==POKEMON_VISUAL_PROMPT_POLICY_VERSION)errors.push(`${label} visual_evidence.prompt_policy_version 不相容`);
      for(const evidence of directEvidenceRows(visual)){
        directEvidenceCount+=1;
        if(evidence.observation_basis!==DIRECT_IMAGE_OBSERVATION_BASIS)errors.push(`${label} ${evidence.kind||'visual_evidence'} 必須 observation_basis=DIRECT_IMAGE`);
        if(evidence.inference_used!==false)errors.push(`${label} ${evidence.kind||'visual_evidence'} inference_used 必須為 false`);
      }
    }
    const species=clean(observation.profile?.species);
    const basis=observation.profile?.species_observation_basis??null;
    if(species){
      if(!ALLOWED_SPECIES_OBSERVATION_BASIS.includes(basis))errors.push(`${label} profile.species 有值時必須提供合法 species_observation_basis；可編輯頁首名稱不能當 species Evidence`);
      if(basis==='PLATFORM_PROVIDED_CONTEXT'&&!observation.identity?.target_pokemon_instance_id&&!observation.identity?.current_species_id)errors.push(`${label} PLATFORM_PROVIDED_CONTEXT 必須有平台 identity context`);
    }else if(basis){
      errors.push(`${label} species_observation_basis 有值但 profile.species 為空`);
    }
  });
  return {
    ...base,
    payload,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
    summary:{...(base.summary||{}),prompt_policy_version:payload.prompt_policy_version||null,hardened_visual_observation_count:hardenedVisualCount,direct_image_evidence_count:directEvidenceCount,direct_image_basis_required:true,inference_allowed_for_direct_evidence:false,editable_header_is_species:false},
  };
}
