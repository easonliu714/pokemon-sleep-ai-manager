import {GEMINI_GENERATE_ATTEMPT_TIMEOUT_MS,GEMINI_IMAGE_TOTAL_TIMEOUT_MS,hashCacheKey,readAiResultCache,writeAiResultCache} from './ai-project-pool-runtime.js';
import {executeWithCapabilityFailover} from './ai-provider-capability-failover.js';
import {AI_OBSERVATION_PROMPT,normalizeObservationPayload} from './ai-observation.js';
import {POKEMON_VISUAL_RECOGNITION_VOCABULARY} from './pokemon-visual-prompt-policy.js';
import {getActiveAnalysisTargetContext,buildExistingPokemonBaselineReference} from './analysis-target-identity.js';

const EXECUTOR_SCHEMA='pokemon-sleep-ai-review-executor/1.7-existing-baseline-sparse-diff';
const PROMPT_VERSION='pokemon-sleep-observation-v2/2026-08-19-v042716-existing-baseline-sparse-diff';
export const BASELINE_PROMPT_POLICY_VERSION='existing-baseline-reference-2026-08-19-a';
export const PER_IMAGE_AI_CONTEXT_AUTHORITY_VERSION='v0.4.27.35-explicit-per-image-ai-context-2026-08-25-a';
const DEFAULT_PROMPT=AI_OBSERVATION_PROMPT;
const DEFAULT_EXECUTOR_MODEL='gemini-3.6-flash';
const SPECIALTIES=new Set(['樹果','食材','技能']);
const itemId=item=>String(item?.sha256||item?.source_image_ref||item?.path||'');
const itemPath=item=>String(item?.path||item?.source_image_ref||'');
const itemName=item=>String(item?.file_name||item?.path||item?.source_image_ref||'未命名圖片');
const text=value=>value==null?'':String(value).normalize('NFKC').trim();
const finite=value=>value===null||value===undefined||value===''?null:(Number.isFinite(Number(value))?Number(value):null);
const clone=value=>JSON.parse(JSON.stringify(value));
const nullableString=Object.freeze({type:['string','null']});
const nullableNumber=Object.freeze({type:['number','null']});
const nullableInteger=Object.freeze({type:['integer','null']});
const nullableBoolean=Object.freeze({type:['boolean','null']});

export const AI_OBSERVATION_RESPONSE_JSON_SCHEMA=Object.freeze({
  type:'object',
  additionalProperties:true,
  required:['schema_version','source','observations'],
  properties:{
    schema_version:{type:'string',enum:['2.0-observation']},
    source:{type:'string',enum:['ai_screenshot_observation']},
    prompt_policy_version:nullableString,
    update_id:nullableString,
    generated_at:nullableString,
    update_policy:{type:['object','null'],additionalProperties:true},
    observations:{
      type:'array',minItems:1,maxItems:1,
      items:{
        type:'object',additionalProperties:true,
        required:['incoming_ref','requested_action','identity','profile','ingredients','subskills','audit_candidates','evidence','visual_evidence'],
        properties:{
          incoming_ref:{type:'string'},
          requested_action:{type:'string',enum:['resolve_on_import']},
          identity:{
            type:'object',additionalProperties:false,
            required:['target_pokemon_instance_id','target_update_token','capture_species_id','current_species_id','registered_date','instance_discriminator'],
            properties:{
              target_pokemon_instance_id:nullableString,target_update_token:nullableString,capture_species_id:nullableString,current_species_id:nullableString,registered_date:nullableString,instance_discriminator:{type:'null'},
            },
          },
          profile:{
            type:'object',additionalProperties:true,
            required:['species','species_observation_basis','header_name_text','nickname','level','sp','specialty','type','nature','nature_bonus','nature_penalty','main_skill','main_skill_level','helper_seconds','carry_limit','favorite_berry','sleep_time_text','sleep_hours'],
            properties:{
              species:nullableString,species_observation_basis:nullableString,header_name_text:nullableString,nickname:nullableString,
              level:nullableInteger,sp:nullableInteger,specialty:nullableString,type:nullableString,nature:nullableString,nature_bonus:nullableString,nature_penalty:nullableString,
              main_skill:nullableString,main_skill_level:nullableInteger,helper_seconds:nullableInteger,carry_limit:nullableInteger,favorite_berry:nullableString,sleep_time_text:nullableString,sleep_hours:nullableNumber,
            },
          },
          ingredients:{
            type:'array',maxItems:3,
            items:{type:'object',additionalProperties:false,required:['unlock_level','ingredient_name','quantity'],properties:{unlock_level:{type:'integer',enum:[1,30,60]},ingredient_name:nullableString,quantity:nullableInteger}},
          },
          subskills:{
            type:'array',maxItems:5,
            items:{type:'object',additionalProperties:false,required:['unlock_level','subskill_name'],properties:{unlock_level:{type:'integer',enum:[10,25,50,70,80]},subskill_name:nullableString}},
          },
          audit_candidates:{
            type:'array',
            items:{type:'object',additionalProperties:true,required:['slot_type','unlock_levels','status','confirmed_by_user'],properties:{slot_type:{type:'string',enum:['ingredient','subskill']},unlock_levels:{type:'array',items:{type:'integer'}},status:{type:'string'},confirmed_by_user:{type:'boolean'},reason:nullableString}},
          },
          evidence:{
            type:'object',additionalProperties:true,
            required:['source_image_refs','field_confidence','unreadable_fields','notes'],
            properties:{source_image_refs:{type:'array',items:{type:'string'}},field_confidence:{type:'object',additionalProperties:true},unreadable_fields:{type:'array',items:{type:'string'}},notes:nullableString},
          },
          visual_evidence:{type:['object','null'],additionalProperties:true},
          is_favorite:nullableBoolean,
        },
      },
    },
  },
});

function extractJson(payload){
  const source=payload?.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('\n')||'';
  const cleaned=source.replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  try{return JSON.parse(cleaned);}catch{return {raw_text:cleaned,parse_failed:true};}
}

function canonicalOrNull(value,allowed,warnings,path){
  const candidate=text(value);
  if(!candidate)return null;
  const canonical=allowed.find(item=>text(item)===candidate)||null;
  if(canonical)return canonical;
  warnings.push({path,value:candidate,reason:'NON_CANONICAL_DIRECT_VALUE_REJECTED'});
  return null;
}
function normalizeMainSkillCandidate(value){
  return text(value).replace(/樹果速增/g,'樹果遽增');
}
function canonicalMainSkillOrNull(value,allowed,warnings,path){
  const raw=text(value);
  if(!raw)return null;
  const normalized=normalizeMainSkillCandidate(raw);
  const canonical=allowed.find(item=>text(item)===normalized)||null;
  if(canonical){
    if(normalized!==raw)warnings.push({path,value:raw,canonical_value:canonical,reason:'SAFE_MAIN_SKILL_TEXT_NORMALIZED'});
    return canonical;
  }
  warnings.push({path,value:raw,reason:'NON_CANONICAL_DIRECT_VALUE_REJECTED'});
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
    if(profile.main_skill!=null){const before=profile.main_skill;profile.main_skill=canonicalMainSkillOrNull(profile.main_skill,v.main_skills,warnings,'profile.main_skill');if(before&&!profile.main_skill)addUnreadable(observation,'profile.main_skill');}
    for(const row of observation.ingredients||[]){if(row?.ingredient_name!=null){const path=`ingredients.Lv${row.unlock_level}.ingredient_name`,before=row.ingredient_name;row.ingredient_name=canonicalOrNull(row.ingredient_name,v.ingredients,warnings,path);if(before&&!row.ingredient_name)addUnreadable(observation,path);}}
    for(const row of observation.subskills||[]){if(row?.subskill_name!=null){const path=`subskills.Lv${row.unlock_level}.subskill_name`,before=row.subskill_name;row.subskill_name=canonicalOrNull(row.subskill_name,v.subskills,warnings,path);if(before&&!row.subskill_name)addUnreadable(observation,path);}}
    const visual=observation.visual_evidence;
    if(visual?.type?.value!=null)visual.type.value=canonicalOrNull(visual.type.value,v.types,warnings,'visual_evidence.type');
    if(visual?.berry?.value!=null)visual.berry.value=canonicalOrNull(visual.berry.value,v.berries,warnings,'visual_evidence.berry');
    if(visual?.main_skill?.value!=null)visual.main_skill.value=canonicalMainSkillOrNull(visual.main_skill.value,v.main_skills,warnings,'visual_evidence.main_skill');
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
  const payload=sanitized.payload,observation=payload.observations[0]||{},profile=observation.profile||{},identity=observation.identity||{};
  const level=finite(profile.level);
  const subSkills=(observation.subskills||[]).map(row=>({level:finite(row.unlock_level),name:row.subskill_name??null,unlocked:level!=null&&finite(row.unlock_level)!=null?level>=Number(row.unlock_level):false}));
  const ingredients=(observation.ingredients||[]).map(row=>({level:finite(row.unlock_level),name:row.ingredient_name??null,count:finite(row.quantity)}));
  const uncertain=[...new Set([...(observation.evidence?.unreadable_fields||[]),...sanitized.warnings.filter(row=>row.reason!=='SAFE_MAIN_SKILL_TEXT_NORMALIZED').map(row=>row.path)])];
  const hardWarnings=sanitized.warnings.filter(row=>row.reason!=='SAFE_MAIN_SKILL_TEXT_NORMALIZED');
  const compatibility={
    ...payload,
    internal_compatibility:{status:hardWarnings.length?'REVIEW_REQUIRED':'OBSERVATION_V2_ACCEPTED',reason:hardWarnings.length?'NON_CANONICAL_VALUES_REJECTED':null,rejected_model_values:sanitized.warnings},
    screen_type:'pokemon_details',pokemon_name:profile.header_name_text??profile.species??null,nickname:profile.nickname??null,
    level,sp:finite(profile.sp),specialty:profile.specialty??null,type:profile.type??null,
    main_skill:{name:profile.main_skill??null,level:finite(profile.main_skill_level),description:null},sub_skills:subSkills,
    nature:{name:profile.nature??null,up:profile.nature_bonus??null,down:profile.nature_penalty??null},ingredients,
    helper_seconds:finite(profile.helper_seconds),carry_limit:finite(profile.carry_limit),favorite_berry:profile.favorite_berry??null,
    sleep_hours:finite(profile.sleep_hours),sleep_time_text:profile.sleep_time_text??null,
    evolution_requirements:{level_required:null,sleep_hours_required:null,candy_required:null,item_required:null,other:null},
    obtained_at:identity.registered_date??profile.obtained_at??null,is_favorite:observation.is_favorite??profile.is_favorite??null,confidence:null,uncertain_fields:uncertain,field_evidence:{}
  };
  return {analysis:compatibility,observation_v2:payload,contract_status:hardWarnings.length?'REVIEW_REQUIRED':'OBSERVATION_V2_ACCEPTED',warnings:sanitized.warnings};
}

function existingBaselineContext(contextOverride=undefined){
  const context=contextOverride===undefined?(getActiveAnalysisTargetContext?.()||globalThis.PokemonSleepAnalysisTargetContext||null):clone(contextOverride);
  if(context?.mode!=='existing')return {context,baseline:null};
  const baseline=context.baseline_reference||buildExistingPokemonBaselineReference?.(context.target_pokemon_id)||null;
  return {context,baseline};
}

export function resolveQueueAnalysisTargetContext(queue,scope=globalThis){
  const queued=Array.isArray(queue?.items)&&queue.items.length===1?queue.items[0]:null;
  const id=itemId(queued);
  const perImage=scope?.PokemonSleepPerImageRuntimeContextV042733;
  const state=perImage?.getState?.()||{};
  const activeId=text(state?.active_item_id);
  const unifiedQueue=String(queue?.schema||'')==='pokemon-sleep-ai-consent-queue/1.3-unified';
  if(unifiedQueue&&id&&activeId===id&&typeof perImage?.contextForItem==='function'){
    const context=perImage.contextForItem(id)||null;
    if(context)return {status:'EXACT_PER_IMAGE_CONTEXT',item_id:id,context:clone(context),target_mode:context.mode||null};
    return {status:'BLOCKED_EXACT_CONTEXT_MISSING',item_id:id,context:null,target_mode:null};
  }
  if(unifiedQueue&&id&&activeId&&activeId!==id)return {status:'BLOCKED_ACTIVE_ITEM_MISMATCH',item_id:id,active_item_id:activeId,context:null,target_mode:null};
  return {status:'LEGACY_CONTEXT_FALLBACK',item_id:id||null,context:null,target_mode:null};
}

export function buildExistingBaselinePrompt(basePrompt=DEFAULT_PROMPT,{analysisTargetContext=undefined}={}){
  const {context,baseline}=existingBaselineContext(analysisTargetContext);
  if(!context||context.mode!=='existing'||!baseline)return {prompt:String(basePrompt||''),baseline_reference_used:false,baseline:null,policy_version:null,target_mode:context?.mode||null,context_authority:analysisTargetContext===undefined?'GLOBAL_LEGACY':'EXPLICIT_PER_IMAGE'};
  const instruction=`\n\n【Existing Pokémon Baseline Sparse-Diff Contract ${BASELINE_PROMPT_POLICY_VERSION}】\n你正在更新一位由平台 pokemon_instance_id 已鎖定的「既有寶可夢」。下方 current_profile_reference 是玩家本機 SQLite 的既有資料，只是唯讀 Reference，不是這張圖片的 Evidence。\n1. 必須先獨立看圖片，再與 Reference 比較。Reference 中已有值，不代表這張圖片有顯示。\n2. 圖片未直接顯示、被遮住、模糊或只能靠 Reference 猜到的欄位，一律輸出 null／省略並加入 unreadable_fields（適用時）；禁止複製 Reference 來填滿 profile、ingredients、subskills 或 visual_evidence。\n3. visual_evidence 只能來自本張圖片直接可見內容；禁止把 Reference 轉成 visual_evidence。\n4. 圖片清楚顯示且與 Reference 相同：可以輸出該直接觀測值；這代表 UNCHANGED，不代表 Reference 變成 Evidence。\n5. 圖片清楚顯示且與 Reference 不同：輸出圖片實際值，讓平台建立 CHANGED 候選；不得為了與 Reference 一致而改寫圖片。\n6. 圖片文字與 Reference 衝突但圖片不足以唯一判斷：不要自行選一邊，該欄位輸出 null，並在 evidence.notes 說明 BASELINE_CONFLICT_REVIEW_REQUIRED。\n7. 主要目標是找出可直接觀測的差異，輸出應偏 Sparse；不要重新建構完整既有 Profile。\n8. current_profile_reference 不含 pokemon_id、pokemon_instance_id、暱稱或可編輯 display label；不得要求、推測或產生這些私有 identity。\n9. 主技能「樹果遽增」的正確文字使用「遽增」；不要改寫成「速增」。\n\ncurrent_profile_reference=${JSON.stringify(baseline,null,2)}`;
  return {prompt:`${String(basePrompt||'')}${instruction}`,baseline_reference_used:true,baseline,policy_version:BASELINE_PROMPT_POLICY_VERSION,target_mode:'existing',context_authority:analysisTargetContext===undefined?'GLOBAL_LEGACY':'EXPLICIT_PER_IMAGE'};
}

export async function executeAiReviewQueue({queue,inventory,poolData,resolveImage,prompt=DEFAULT_PROMPT,bypassCache=false,onProgress=()=>{},onTrace=()=>{}}={}){
  if(!queue?.items?.length)throw new Error('ai_review_queue_empty');
  if(typeof resolveImage!=='function')throw new Error('ai_review_image_resolver_missing');
  if(!poolData?.projects?.length)throw new Error('ai_project_pool_missing');
  const queueContext=resolveQueueAnalysisTargetContext(queue,globalThis);
  if(queueContext.status.startsWith('BLOCKED_'))throw new Error(queueContext.status);
  const promptContext=queueContext.status==='EXACT_PER_IMAGE_CONTEXT'
    ?buildExistingBaselinePrompt(prompt,{analysisTargetContext:queueContext.context})
    :buildExistingBaselinePrompt(prompt);
  const effectivePrompt=promptContext.prompt;
  const baselineCacheContext=promptContext.baseline_reference_used?JSON.stringify(promptContext.baseline):'NO_BASELINE';
  const results=[];let projects=poolData.projects;
  for(let index=0;index<queue.items.length;index++){
    const queued=queue.items[index];const id=itemId(queued);const source=(inventory?.items||[]).find(item=>itemId(item)===id)||queued;const model=text(poolData.model||queue.model)||DEFAULT_EXECUTOR_MODEL;const fileName=itemName(source);const sourceImageRef=itemPath(source);const cacheKey=await hashCacheKey({sha256:source.sha256||id,model:`${model}|capability-failover-v2`,promptVersion:`${PROMPT_VERSION}|${promptContext.policy_version||'no-baseline'}|${baselineCacheContext}`});const cached=bypassCache?null:readAiResultCache(cacheKey);
    if(cached){results.push({...cached,cached:true});onProgress({phase:'completed',current:index+1,total:queue.items.length,cached:true,file_name:fileName,source_image_ref:sourceImageRef,provider_elapsed_ms:0});continue;}
    onProgress({phase:'started',current:index+1,total:queue.items.length,cached:false,file_name:fileName,source_image_ref:sourceImageRef,model,timeout_seconds:Math.ceil(GEMINI_IMAGE_TOTAL_TIMEOUT_MS/1000),baseline_reference_used:promptContext.baseline_reference_used});
    const image=await resolveImage(source);
    const thinkingLevel=/^gemini-3(?:[.-]|$)/i.test(String(model||''))?'low':null;
    const outcome=await executeWithCapabilityFailover({projects,preferredModel:model,prompt:effectivePrompt,imageBase64:image.data,mimeType:image.mimeType,responseJsonSchema:AI_OBSERVATION_RESPONSE_JSON_SCHEMA,thinkingLevel,onTrace,requestTimeoutMs:GEMINI_GENERATE_ATTEMPT_TIMEOUT_MS,totalTimeoutMs:GEMINI_IMAGE_TOTAL_TIMEOUT_MS});projects=outcome.projects;
    if(!outcome.ok){
      const errorClass=outcome?.failure?.error_class||outcome.reason||'ai_provider_failed';
      const message=outcome?.failure?.error_message||(errorClass.includes('timeout')?`AI Provider 超過 ${Math.ceil(GEMINI_IMAGE_TOTAL_TIMEOUT_MS/1000)} 秒仍未完成，已停止等待。`:'AI Provider 無法完成辨識，已停止等待。');
      onProgress({phase:'failed',current:index+1,total:queue.items.length,cached:false,file_name:fileName,source_image_ref:sourceImageRef,model,error_class:errorClass,reason:outcome.reason,message,provider_elapsed_ms:Number(outcome?.failure?.elapsed_ms||0),baseline_reference_used:promptContext.baseline_reference_used});
      return {schema:EXECUTOR_SCHEMA,status:'paused',completed:results.length,total:queue.items.length,results,projects,attempts:outcome.attempts,reason:outcome.reason,failure:outcome.failure||null,user_message:message,prompt_version:PROMPT_VERSION,baseline_reference_used:promptContext.baseline_reference_used,baseline_prompt_policy_version:promptContext.policy_version,preflight:outcome.preflight||[],analysis_target_context_authority:promptContext.context_authority,analysis_target_mode:promptContext.target_mode};
    }
    const raw=extractJson(outcome.payload),projection=projectObservationV2ForLegacy(raw),usedModel=outcome.used_model||model,usedThinking=outcome.used_thinking_level??thinkingLevel;
    const result={item_id:id,source_image_ref:sourceImageRef,file_name:fileName,model:usedModel,preferred_model:model,model_fallback_used:Boolean(outcome.model_fallback_used),project_alias:outcome.used_alias,analysis:projection.analysis,observation_v2:projection.observation_v2,observation_contract_status:projection.contract_status,observation_contract_warnings:projection.warnings,provider_elapsed_ms:Number(outcome.transport?.elapsed_ms||0),thinking_level:usedThinking,structured_output:true,completed_at:new Date().toISOString(),prompt_version:PROMPT_VERSION,forced:Boolean(bypassCache),baseline_reference_used:promptContext.baseline_reference_used,baseline_prompt_policy_version:promptContext.policy_version,analysis_target_context_authority:promptContext.context_authority,analysis_target_mode:promptContext.target_mode};
    writeAiResultCache(cacheKey,result);results.push(result);onProgress({phase:'completed',current:index+1,total:queue.items.length,cached:false,file_name:fileName,source_image_ref:sourceImageRef,project_alias:outcome.used_alias,model:usedModel,model_fallback_used:result.model_fallback_used,observation_contract_status:projection.contract_status,provider_elapsed_ms:result.provider_elapsed_ms,baseline_reference_used:promptContext.baseline_reference_used});
  }
  return {schema:EXECUTOR_SCHEMA,status:'completed',completed:results.length,total:queue.items.length,results,projects,prompt_version:PROMPT_VERSION,forced:Boolean(bypassCache),baseline_reference_used:promptContext.baseline_reference_used,baseline_prompt_policy_version:promptContext.policy_version,analysis_target_context_authority:promptContext.context_authority,analysis_target_mode:promptContext.target_mode};
}

export {DEFAULT_EXECUTOR_MODEL,EXECUTOR_SCHEMA,DEFAULT_PROMPT,PROMPT_VERSION,extractJson,normalizeMainSkillCandidate};