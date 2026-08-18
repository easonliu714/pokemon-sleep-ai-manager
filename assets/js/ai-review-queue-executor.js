import {executeWithProjectPool,hashCacheKey,readAiResultCache,writeAiResultCache} from './ai-project-pool-runtime.js';
import {AI_OBSERVATION_PROMPT,normalizeObservationPayload} from './ai-observation.js';
import {POKEMON_VISUAL_RECOGNITION_VOCABULARY} from './pokemon-visual-prompt-policy.js';

const EXECUTOR_SCHEMA='pokemon-sleep-ai-review-executor/1.3-observation-v2';
const PROMPT_VERSION='pokemon-sleep-observation-v2/2026-08-18-internal-parity';
const DEFAULT_PROMPT=AI_OBSERVATION_PROMPT;
const SPECIALTIES=new Set(['樹果','食材','技能']);
const itemId=item=>String(item?.sha256||item?.source_image_ref||item?.path||'');
const itemPath=item=>String(item?.path||item?.source_image_ref||'');
const text=value=>value==null?'':String(value).normalize('NFKC').trim();
const finite=value=>value===null||value===undefined||value===''?null:(Number.isFinite(Number(value))?Number(value):null);
const clone=value=>JSON.parse(JSON.stringify(value));

function extractJson(payload){
  const source=payload?.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('\n')||'';
  const cleaned=source.replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  try{return JSON.parse(cleaned);}catch{return {raw_text:cleaned,parse_failed:true};}
}

function canonicalOrNull(value,allowed,warnings,path){
  const candidate=text(value);
  if(!candidate)return null;
  if(allowed.includes(candidate))return candidate;
  warnings.push({path,value:candidate,reason:'NON_CANONICAL_DIRECT_VALUE_REJECTED'});
  return null;
}
function addUnreadable(observation,path){
  observation.evidence=observation.evidence||{source_image_refs:[],field_confidence:{},unreadable_fields:[],notes:null};
  observation.evidence.unreadable_fields=Array.isArray(observation.evidence.unreadable_fields)?observation.evidence.unreadable_fields:[];
  if(!observation.evidence.unreadable_fields.includes(path))observation.evidence.unreadable_fields.push(path);
}
function sanitizeObservationV2(payload){
  const sanitized=clone(payload),warnings=[];
  const v=POKEMON_VISUAL_RECOGNITION_VOCABULARY;
  for(const observation of sanitized.observations||[]){
    const profile=observation.profile||{};
    if(profile.specialty!=null&&!SPECIALTIES.has(text(profile.specialty))){warnings.push({path:'profile.specialty',value:text(profile.specialty),reason:'NON_CANONICAL_SPECIALTY_REJECTED'});profile.specialty=null;addUnreadable(observation,'profile.specialty');}
    if(profile.type!=null){const before=profile.type;profile.type=canonicalOrNull(profile.type,v.types,warnings,'profile.type');if(before&&!profile.type)addUnreadable(observation,'profile.type');}
    if(profile.favorite_berry!=null){const before=profile.favorite_berry;profile.favorite_berry=canonicalOrNull(profile.favorite_berry,v.berries,warnings,'profile.favorite_berry');if(before&&!profile.favorite_berry)addUnreadable(observation,'profile.favorite_berry');}
    if(profile.main_skill!=null){const before=profile.main_skill;profile.main_skill=canonicalOrNull(profile.main_skill,v.main_skills,warnings,'profile.main_skill');if(before&&!profile.main_skill)addUnreadable(observation,'profile.main_skill');}
    for(const row of observation.ingredients||[]){if(row?.ingredient_name!=null){const path=`ingredients.Lv${row.unlock_level}.ingredient_name`,before=row.ingredient_name;row.ingredient_name=canonicalOrNull(row.ingredient_name,v.ingredients,warnings,path);if(before&&!row.ingredient_name)addUnreadable(observation,path);}}
    for(const row of observation.subskills||[]){if(row?.subskill_name!=null){const path=`subskills.Lv${row.unlock_level}.subskill_name`,before=row.subskill_name;row.subskill_name=canonicalOrNull(row.subskill_name,v.subskills,warnings,path);if(before&&!row.subskill_name)addUnreadable(observation,path);}}
    const visual=observation.visual_evidence;
    if(visual?.type?.value!=null)visual.type.value=canonicalOrNull(visual.type.value,v.types,warnings,'visual_evidence.type');
    if(visual?.berry?.value!=null)visual.berry.value=canonicalOrNull(visual.berry.value,v.berries,warnings,'visual_evidence.berry');
    if(visual?.main_skill?.value!=null)visual.main_skill.value=canonicalOrNull(visual.main_skill.value,v.main_skills,warnings,'visual_evidence.main_skill');
    for(const row of visual?.ingredients||[])if(row?.value!=null)row.value=canonicalOrNull(row.value,v.ingredients,warnings,`visual_evidence.ingredients.Lv${row.unlock_level}`);
    for(const row of visual?.subskills||[])if(row?.value!=null)row.value=canonicalOrNull(row.value,v.subskills,warnings,`visual_evidence.subskills.Lv${row.unlock_level}`);
  }
  return {payload:sanitized,warnings};
}
function emptyCompatibility({raw=null,reason='AI_OUTPUT_NOT_OBSERVATION_V2'}={}){
  return {
    schema_version:'2.0-observation',source:'ai_screenshot_observation',observations:[],
    internal_compatibility:{status:'REVIEW_REQUIRED',reason,rejected_model_values:[],raw_parse_failed:Boolean(raw?.parse_failed)},
    screen_type:null,pokemon_name:null,nickname:null,level:null,sp:null,specialty:null,type:null,
    main_skill:{name:null,level:null,description:null},sub_skills:[],nature:{name:null,up:null,down:null},ingredients:[],
    helper_seconds:null,carry_limit:null,favorite_berry:null,sleep_hours:null,sleep_time_text:null,
    evolution_requirements:{level_required:null,sleep_hours_required:null,candy_required:null,item_required:null,other:null},
    obtained_at:null,is_favorite:null,confidence:null,uncertain_fields:['observation_v2_contract'],field_evidence:{}
  };
}
export function projectObservationV2ForLegacy(raw){
  if(!raw||raw.parse_failed||raw.schema_version!=='2.0-observation'||!Array.isArray(raw.observations)||raw.observations.length<1){
    return {analysis:emptyCompatibility({raw}),observation_v2:null,contract_status:'REVIEW_REQUIRED',warnings:[{path:'root',reason:'AI_OUTPUT_NOT_OBSERVATION_V2'}]};
  }
  const normalized=normalizeObservationPayload(raw);
  const sanitized=sanitizeObservationV2(normalized);
  const payload=sanitized.payload,observation=payload.observations[0]||{},profile=observation.profile||{};
  const level=finite(profile.level);
  const subSkills=(observation.subskills||[]).map(row=>({level:finite(row.unlock_level),name:row.subskill_name??null,unlocked:level!=null&&finite(row.unlock_level)!=null?level>=Number(row.unlock_level):false}));
  const ingredients=(observation.ingredients||[]).map(row=>({level:finite(row.unlock_level),name:row.ingredient_name??null,count:finite(row.quantity)}));
  const uncertain=[...new Set([...(observation.evidence?.unreadable_fields||[]),...sanitized.warnings.map(row=>row.path)])];
  const compatibility={
    ...payload,
    internal_compatibility:{status:sanitized.warnings.length?'REVIEW_REQUIRED':'OBSERVATION_V2_ACCEPTED',reason:sanitized.warnings.length?'NON_CANONICAL_VALUES_REJECTED':null,rejected_model_values:sanitized.warnings},
    screen_type:'pokemon_details',pokemon_name:profile.header_name_text??profile.species??null,nickname:profile.nickname??null,
    level,sp:finite(profile.sp),specialty:profile.specialty??null,type:profile.type??null,
    main_skill:{name:profile.main_skill??null,level:finite(profile.main_skill_level),description:null},sub_skills:subSkills,
    nature:{name:profile.nature??null,up:profile.nature_bonus??null,down:profile.nature_penalty??null},ingredients,
    helper_seconds:finite(profile.helper_seconds),carry_limit:finite(profile.carry_limit),favorite_berry:profile.favorite_berry??null,
    sleep_hours:finite(profile.sleep_hours),sleep_time_text:profile.sleep_time_text??null,
    evolution_requirements:{level_required:null,sleep_hours_required:null,candy_required:null,item_required:null,other:null},
    obtained_at:profile.obtained_at??null,is_favorite:profile.is_favorite??null,confidence:null,uncertain_fields:uncertain,field_evidence:{}
  };
  return {analysis:compatibility,observation_v2:payload,contract_status:sanitized.warnings.length?'REVIEW_REQUIRED':'OBSERVATION_V2_ACCEPTED',warnings:sanitized.warnings};
}

export async function executeAiReviewQueue({queue,inventory,poolData,resolveImage,prompt=DEFAULT_PROMPT,bypassCache=false,onProgress=()=>{},onTrace=()=>{}}={}){
  if(!queue?.items?.length)throw new Error('ai_review_queue_empty');
  if(typeof resolveImage!=='function')throw new Error('ai_review_image_resolver_missing');
  if(!poolData?.projects?.length)throw new Error('ai_project_pool_missing');
  const results=[];let projects=poolData.projects;
  for(let index=0;index<queue.items.length;index++){
    const queued=queue.items[index];const id=itemId(queued);const source=(inventory?.items||[]).find(item=>itemId(item)===id)||queued;const model=poolData.model||queue.model;const cacheKey=await hashCacheKey({sha256:source.sha256||id,model,promptVersion:PROMPT_VERSION});const cached=bypassCache?null:readAiResultCache(cacheKey);
    if(cached){results.push({...cached,cached:true});onProgress({current:index+1,total:queue.items.length,cached:true});continue;}
    const image=await resolveImage(source);
    const outcome=await executeWithProjectPool({projects,model,prompt,imageBase64:image.data,mimeType:image.mimeType,onTrace});projects=outcome.projects;
    if(!outcome.ok)return {schema:EXECUTOR_SCHEMA,status:'paused',completed:results.length,total:queue.items.length,results,projects,attempts:outcome.attempts,reason:outcome.reason,prompt_version:PROMPT_VERSION};
    const raw=extractJson(outcome.payload),projection=projectObservationV2ForLegacy(raw);
    const result={item_id:id,source_image_ref:itemPath(source),model,project_alias:outcome.used_alias,analysis:projection.analysis,observation_v2:projection.observation_v2,observation_contract_status:projection.contract_status,observation_contract_warnings:projection.warnings,completed_at:new Date().toISOString(),prompt_version:PROMPT_VERSION,forced:Boolean(bypassCache)};
    writeAiResultCache(cacheKey,result);results.push(result);onProgress({current:index+1,total:queue.items.length,cached:false,project_alias:outcome.used_alias,observation_contract_status:projection.contract_status});
  }
  return {schema:EXECUTOR_SCHEMA,status:'completed',completed:results.length,total:queue.items.length,results,projects,prompt_version:PROMPT_VERSION,forced:Boolean(bypassCache)};
}

export {EXECUTOR_SCHEMA,DEFAULT_PROMPT,PROMPT_VERSION,extractJson};