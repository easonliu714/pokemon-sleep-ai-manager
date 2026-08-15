import {POKEMON_VISUAL_EVIDENCE_VERSION} from './pokemon-visual-evidence-contract.js';
import {
  POKEMON_VISUAL_PROMPT_POLICY_VERSION,
  DIRECT_IMAGE_OBSERVATION_BASIS,
  buildPokemonVisualPromptPolicyInstruction,
} from './pokemon-visual-prompt-policy.js';

const UNKNOWN_VALUES=new Set(['','n/a','na','unknown','未知','不明','看不清楚','無法辨識','null','none','-']);
const NUMBER_FIELDS=new Set(['level','sp','main_skill_level','helper_seconds','carry_limit','quantity','unlock_level','sleep_hours']);
const SUBSKILL_LEVEL_MAP=new Map([[75,70],[100,80]]);
const AUDIT_STATUSES=new Set(['user_confirmed_not_visible','not_observed_yet','missing','conflicting']);
const VISUAL_KINDS=new Set(['TYPE_VISUAL','BERRY_VISUAL','INGREDIENT_VISUAL','MAIN_SKILL_TEXT','SUBSKILL_TEXT']);
const SPECIES_OBSERVATION_BASIS=new Set(['DIRECT_NON_EDITABLE_SPECIES_LABEL','PLATFORM_PROVIDED_CONTEXT']);

const clone=value=>JSON.parse(JSON.stringify(value));
const cleanText=value=>typeof value==='string'?value.trim():value;
const unknown=value=>typeof value==='string'&&UNKNOWN_VALUES.has(value.trim().toLowerCase());

function extractJsonText(input){
  if(typeof input!=='string')return input;
  const fenced=input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source=(fenced?.[1]||input).trim();
  const start=source.indexOf('{');
  const end=source.lastIndexOf('}');
  if(start<0||end<start)throw new Error('找不到 JSON 物件');
  return source.slice(start,end+1);
}

function normalizeScalar(key,value){
  if(value===null||value===undefined||unknown(value))return null;
  if(NUMBER_FIELDS.has(key)&&typeof value==='string'&&value.trim()!==''){
    const parsed=Number(value.trim());
    if(Number.isFinite(parsed))return parsed;
  }
  return cleanText(value);
}

function normalizeObject(value){
  if(Array.isArray(value))return value.map(normalizeObject);
  if(!value||typeof value!=='object')return value;
  const output={};
  for(const [key,item] of Object.entries(value))output[key]=item&&typeof item==='object'?normalizeObject(item):normalizeScalar(key,item);
  return output;
}

function normalizeAuditCandidates(value){
  return (Array.isArray(value)?value:[]).map(item=>({
    slot_type:item?.slot_type||null,
    unlock_levels:Array.isArray(item?.unlock_levels)?item.unlock_levels.map(Number):[],
    status:item?.status||'not_observed_yet',
    confirmed_by_user:item?.confirmed_by_user===true,
    reason:item?.reason||null,
  }));
}

function normalizeDirectVisualEvidence(value,kind,{unlockLevel=null}={}){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const normalized=normalizeObject(value);
  const output={
    kind,
    value:normalized.value??null,
    source_image_ref:normalized.source_image_ref||null,
    confidence:normalized.confidence==null?null:Number(normalized.confidence),
    observation_basis:normalized.observation_basis??null,
    inference_used:normalized.inference_used??null,
  };
  const level=Number(normalized.unlock_level??unlockLevel);
  if(Number.isFinite(level))output.unlock_level=SUBSKILL_LEVEL_MAP.get(level)||level;
  return output;
}

function normalizeVisualEvidence(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const normalized=normalizeObject(value);
  const ingredients=(Array.isArray(normalized.ingredients)?normalized.ingredients:[]).map(row=>normalizeDirectVisualEvidence(row,'INGREDIENT_VISUAL',{unlockLevel:row?.unlock_level})).filter(Boolean);
  const subskills=(Array.isArray(normalized.subskills)?normalized.subskills:[]).map(row=>normalizeDirectVisualEvidence(row,'SUBSKILL_TEXT',{unlockLevel:row?.unlock_level})).filter(Boolean);
  return {
    contract_version:POKEMON_VISUAL_EVIDENCE_VERSION,
    prompt_policy_version:normalized.prompt_policy_version??null,
    public_relation_may_generate_player_observation:false,
    type:normalizeDirectVisualEvidence(normalized.type,'TYPE_VISUAL'),
    berry:normalizeDirectVisualEvidence(normalized.berry,'BERRY_VISUAL'),
    ingredients,
    main_skill:normalizeDirectVisualEvidence(normalized.main_skill,'MAIN_SKILL_TEXT'),
    subskills,
  };
}

function normalizeObservation(item,index){
  const normalized=normalizeObject(item||{});
  normalized.incoming_ref=normalized.incoming_ref||`pokemon-image-${String(index+1).padStart(3,'0')}`;
  normalized.requested_action='resolve_on_import';
  normalized.identity={
    target_pokemon_instance_id:normalized.identity?.target_pokemon_instance_id||null,
    target_update_token:normalized.identity?.target_update_token||null,
    capture_species_id:normalized.identity?.capture_species_id||null,
    current_species_id:normalized.identity?.current_species_id||null,
    registered_date:normalized.identity?.registered_date||null,
    instance_discriminator:null,
  };
  normalized.profile={
    ...(normalized.profile||{}),
    header_name_text:normalized.profile?.header_name_text??null,
    species_observation_basis:normalized.profile?.species_observation_basis??null,
  };
  normalized.ingredients=Array.isArray(normalized.ingredients)?normalized.ingredients:[];
  normalized.subskills=(Array.isArray(normalized.subskills)?normalized.subskills:[]).map(row=>{
    const level=Number(row?.unlock_level);
    return {...row,unlock_level:SUBSKILL_LEVEL_MAP.get(level)||level};
  });
  normalized.audit_candidates=normalizeAuditCandidates(normalized.audit_candidates);
  normalized.evidence={source_image_refs:[],field_confidence:{},unreadable_fields:[],notes:null,...(normalized.evidence||{})};
  normalized.visual_evidence=normalizeVisualEvidence(normalized.visual_evidence);
  delete normalized.action;
  delete normalized.pokemon_id;
  delete normalized.pokemon_instance_id;
  return normalized;
}

export const AI_OBSERVATION_PROMPT=`你是 Pokémon Sleep 圖片資料觀察器。請只輸出單一 JSON 物件，不輸出 Markdown、解釋或前後文字。\n\n重要規則：\n1. 你只記錄圖片中可見的事實，不判斷這是新成員、升級、更名或進化。\n2. requested_action 固定為 resolve_on_import。\n3. 不得自行建立 pokemon_id、pokemon_instance_id、instance_discriminator、insert、update 或 upsert。\n4. 只有提示詞已提供 target_pokemon_instance_id 或 target_update_token 時，才能原樣回傳；否則填 null。\n5. 看不清楚、未顯示或無法確認的欄位填 null，不可猜測；空值在更新中心代表保留既有值，不是清空。\n6. 食材等級只用 1、30、60；副技能等級只用 10、25、50、70、80。\n7. 畫面只顯示部分食材槽或副技能槽時，不得用物種公版候選補齊；在 audit_candidates 加入 slot_type、unlock_levels、status=user_confirmed_not_visible、confirmed_by_user=false。\n8. 遊戲畫面若出現「一起睡覺的時間」，profile.sleep_time_text 保存畫面原文，profile.sleep_hours 保存換算小時；未顯示則 null；不得由等級、入手日期或其他欄位推算。\n9. 「一起睡覺的時間」與「進化所需一起睡覺的時間」不得互相混填。\n10. 畫面 machine key 只供資料交換，不得反過來改寫畫面語意。\n11. 數值使用 JSON number；只有 sleep_time_text 保存遊戲原文。\n12. schema_version 固定 2.0-observation，source 固定 ai_screenshot_observation。\n13. visual_evidence 與 profile 是獨立證據鏈，不得互相複製／反推。\n14. 每筆 direct evidence 必須包含 kind、value、source_image_ref、confidence、observation_basis=DIRECT_IMAGE、inference_used=false。\n15. Public Master 只能在平台端做事後一致性查核，不能替你補答案。${buildPokemonVisualPromptPolicyInstruction()}`;

export function buildObservationTemplate(){
  const now=new Date().toISOString();
  return {
    schema_version:'2.0-observation',
    prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,
    update_id:`UPD-${now.replace(/[-:TZ.]/g,'').slice(0,14)}-XXXX`,
    generated_at:now,
    source:'ai_screenshot_observation',
    update_policy:{blank_values:'preserve_existing',missing_fields:'no_change',public_candidate_fill:'forbidden'},
    observations:[{
      incoming_ref:'pokemon-image-001',requested_action:'resolve_on_import',
      identity:{target_pokemon_instance_id:null,target_update_token:null,capture_species_id:null,current_species_id:null,registered_date:null,instance_discriminator:null},
      profile:{species:null,species_observation_basis:null,header_name_text:null,nickname:null,level:null,sp:null,specialty:null,type:null,nature:null,nature_bonus:null,nature_penalty:null,main_skill:null,main_skill_level:null,helper_seconds:null,carry_limit:null,favorite_berry:null,sleep_time_text:null,sleep_hours:null},
      ingredients:[{unlock_level:1,ingredient_name:null,quantity:null},{unlock_level:30,ingredient_name:null,quantity:null},{unlock_level:60,ingredient_name:null,quantity:null}],
      subskills:[{unlock_level:10,subskill_name:null},{unlock_level:25,subskill_name:null},{unlock_level:50,subskill_name:null},{unlock_level:70,subskill_name:null},{unlock_level:80,subskill_name:null}],
      audit_candidates:[],
      evidence:{source_image_refs:['image-001'],field_confidence:{},unreadable_fields:[],notes:null},
      visual_evidence:{
        contract_version:POKEMON_VISUAL_EVIDENCE_VERSION,
        prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,
        public_relation_may_generate_player_observation:false,
        type:null,berry:null,ingredients:[],main_skill:null,subskills:[],
      },
    }],
  };
}

export function normalizeObservationPayload(input){
  const parsed=typeof input==='string'?JSON.parse(extractJsonText(input)):clone(input);
  const payload=normalizeObject(parsed);
  payload.schema_version='2.0-observation';
  payload.source='ai_screenshot_observation';
  payload.prompt_policy_version=payload.prompt_policy_version??null;
  payload.update_policy={blank_values:'preserve_existing',missing_fields:'no_change',public_candidate_fill:'forbidden',...(payload.update_policy||{})};
  if(!payload.update_id)payload.update_id=buildObservationTemplate().update_id;
  if(!payload.generated_at)payload.generated_at=new Date().toISOString();
  if(!Array.isArray(payload.observations))payload.observations=[];
  payload.observations=payload.observations.map(normalizeObservation);
  delete payload.operations;
  return payload;
}

function validateDirectVisualEvidence(evidence,kind,label,errors,allowedLevels=null,sourceRefs=null){
  if(evidence==null)return;
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)){errors.push(`${label} ${kind} evidence 格式錯誤`);return;}
  if(!VISUAL_KINDS.has(evidence.kind)||evidence.kind!==kind)errors.push(`${label} ${kind} evidence kind 不合法`);
  if(evidence.observation_basis!==DIRECT_IMAGE_OBSERVATION_BASIS)errors.push(`${label} ${kind} evidence 必須 observation_basis=DIRECT_IMAGE`);
  if(evidence.inference_used!==false)errors.push(`${label} ${kind} evidence inference_used 必須為 false`);
  if(!evidence.value)errors.push(`${label} ${kind} evidence 缺少 value`);
  if(!evidence.source_image_ref)errors.push(`${label} ${kind} evidence 缺少 source_image_ref`);
  if(evidence.confidence==null||!Number.isFinite(Number(evidence.confidence))||Number(evidence.confidence)<0||Number(evidence.confidence)>1)errors.push(`${label} ${kind} evidence confidence 必須介於 0~1`);
  if(allowedLevels&&!allowedLevels.includes(Number(evidence.unlock_level)))errors.push(`${label} ${kind} evidence unlock_level 不合法`);
  if(sourceRefs&&evidence.source_image_ref&&!sourceRefs.has(evidence.source_image_ref))errors.push(`${label} ${kind} evidence source_image_ref 不在本 observation evidence.source_image_refs`);
}

export function validateObservationPayload(input){
  const errors=[],warnings=[];
  let payload;
  try{payload=normalizeObservationPayload(input);}catch(error){return {payload:null,errors:[error.message],warnings,summary:{}};}
  if(!payload.observations.length)errors.push('observations 必須至少包含一筆');
  const refs=new Set();
  let auditCandidateCount=0,visualEvidenceObservationCount=0,directEvidenceCount=0;
  payload.observations.forEach((item,index)=>{
    const label=`#${index+1}`;
    if(refs.has(item.incoming_ref))errors.push(`${label} incoming_ref 重複：${item.incoming_ref}`);
    refs.add(item.incoming_ref);
    if(item.requested_action!=='resolve_on_import')errors.push(`${label} requested_action 必須為 resolve_on_import`);
    const species=String(item.profile?.species??'').trim(),speciesBasis=item.profile?.species_observation_basis??null;
    if(!species)warnings.push(`${label} species 無法確認`);
    if(species&&!SPECIES_OBSERVATION_BASIS.has(speciesBasis))errors.push(`${label} profile.species 有值時必須提供合法 species_observation_basis；可編輯頁首名稱不能當 species Evidence`);
    if(!species&&speciesBasis)errors.push(`${label} species_observation_basis 有值但 profile.species 為空`);
    if(speciesBasis==='PLATFORM_PROVIDED_CONTEXT'&&!item.identity?.target_pokemon_instance_id&&!item.identity?.current_species_id)errors.push(`${label} PLATFORM_PROVIDED_CONTEXT 必須有平台 identity context`);
    if(item.identity?.instance_discriminator!=null)errors.push(`${label} instance_discriminator 只能由平台配置`);
    for(const row of item.ingredients)if(![1,30,60].includes(Number(row.unlock_level)))errors.push(`${label} 食材 unlock_level 不合法`);
    for(const row of item.subskills)if(![10,25,50,70,80].includes(Number(row.unlock_level)))errors.push(`${label} 副技能 unlock_level 不合法`);
    for(const candidate of item.audit_candidates){
      auditCandidateCount+=1;
      if(!['ingredient','subskill'].includes(candidate.slot_type))errors.push(`${label} audit_candidates slot_type 不合法`);
      if(!AUDIT_STATUSES.has(candidate.status))errors.push(`${label} audit_candidates status 不合法`);
      if(candidate.status==='user_confirmed_not_visible'&&candidate.confirmed_by_user!==true)warnings.push(`${label} 尚有未顯示槽位等待用戶確認`);
    }
    if(item.visual_evidence){
      visualEvidenceObservationCount+=1;
      if(payload.prompt_policy_version!==POKEMON_VISUAL_PROMPT_POLICY_VERSION)errors.push(`${label} prompt_policy_version 不相容`);
      if(item.visual_evidence.contract_version!==POKEMON_VISUAL_EVIDENCE_VERSION)errors.push(`${label} visual_evidence contract_version 不相容`);
      if(item.visual_evidence.prompt_policy_version!==POKEMON_VISUAL_PROMPT_POLICY_VERSION)errors.push(`${label} visual_evidence.prompt_policy_version 不相容`);
      if(item.visual_evidence.public_relation_may_generate_player_observation!==false)errors.push(`${label} Public Master 不得生成玩家 observation`);
      const sourceRefs=new Set(item.evidence?.source_image_refs||[]);
      const rows=[item.visual_evidence.type,item.visual_evidence.berry,item.visual_evidence.main_skill,...(item.visual_evidence.ingredients||[]),...(item.visual_evidence.subskills||[])].filter(Boolean);
      directEvidenceCount+=rows.length;
      validateDirectVisualEvidence(item.visual_evidence.type,'TYPE_VISUAL',label,errors,null,sourceRefs);
      validateDirectVisualEvidence(item.visual_evidence.berry,'BERRY_VISUAL',label,errors,null,sourceRefs);
      validateDirectVisualEvidence(item.visual_evidence.main_skill,'MAIN_SKILL_TEXT',label,errors,null,sourceRefs);
      for(const row of item.visual_evidence.ingredients||[])validateDirectVisualEvidence(row,'INGREDIENT_VISUAL',label,errors,[1,30,60],sourceRefs);
      for(const row of item.visual_evidence.subskills||[])validateDirectVisualEvidence(row,'SUBSKILL_TEXT',label,errors,[10,25,50,70,80],sourceRefs);
    }
  });
  return {payload,errors,warnings,summary:{observation_count:payload.observations.length,requires_identity_resolution:payload.observations.length,audit_candidate_count:auditCandidateCount,visual_evidence_observation_count:visualEvidenceObservationCount,direct_image_evidence_count:directEvidenceCount,prompt_policy_version:payload.prompt_policy_version,null_overwrite_policy:'preserve_existing',public_relation_generates_player_observation:false,direct_image_basis_required:true,inference_allowed_for_direct_evidence:false,editable_header_is_species:false}};
}
