export const UPDATE_PACKAGE_SCHEMA_VERSION='1.1';
export const UPDATE_PACKAGE_SOURCE='ai_screenshot_analysis';
export const UPDATE_PACKAGE_REQUIRED_ROOT=Object.freeze(['schema_version','update_id','generated_at','source','operations']);
export const UPDATE_PACKAGE_PROMPT_ROOT=Object.freeze([...UPDATE_PACKAGE_REQUIRED_ROOT,'scenario']);
export const UPDATE_PACKAGE_ACTIONS=Object.freeze(['upsert']);
export const UPDATE_PACKAGE_KEY_CONTRACT_VERSION='update-package-key-contract-2026-08-11-a';

const clone=value=>JSON.parse(JSON.stringify(value));
const isoCompact=value=>String(value).replace(/[-:TZ.]/g,'').slice(0,14);

// Platform-owned operation keys. Internal AI may only emit these declared key names;
// it must not invent stable IDs (for example ingredient_id) that do not exist in SQLite/Public Master contracts.
const ENTITY_KEY_JSON_PROPERTIES=Object.freeze({
  ingredient_inventory:Object.freeze({ingredient_name:{type:'string',description:'Exact visible zh-TW ingredient name. Do not invent ingredient_id or English slug.'}}),
  account_capacity:Object.freeze({capacity_key:{type:'string',enum:['pot','ingredient_bag','item_bag','pokemon_box']}}),
  item_inventory:Object.freeze({item_name:{type:'string'}}),
  candy_inventory:Object.freeze({candy_id:{type:'string'},candy_name:{type:'string'}}),
  recipes:Object.freeze({recipe_id:{type:'string'},recipe_name:{type:'string'}}),
  discarded_pokemon:Object.freeze({discard_id:{type:'string'}}),
  weekly_context:Object.freeze({context_id:{type:'string'}}),
});

export function buildOperationKeyJsonSchema(entities=[]){
  const properties={};
  for(const entity of entities){
    const entityProperties=ENTITY_KEY_JSON_PROPERTIES[entity];
    if(entityProperties)Object.assign(properties,clone(entityProperties));
  }
  if(!Object.keys(properties).length)return {type:'object',additionalProperties:true};
  return {type:'object',properties,additionalProperties:false};
}

export function buildUpdatePackageId(generatedAt=new Date().toISOString(),suffix='AI'){
  return `UPD-${isoCompact(generatedAt)}-${suffix}`;
}

export function buildUpdatePackageEnvelope({scenario,generatedAt=new Date().toISOString(),source=UPDATE_PACKAGE_SOURCE,operations=[],contextAuthority=null,updateIdSuffix='EXAMPLE',profileAuditConfirmations=[]}={}){
  if(!scenario)throw new Error('update_package_scenario_required');
  return {
    schema_version:UPDATE_PACKAGE_SCHEMA_VERSION,
    update_id:buildUpdatePackageId(generatedAt,updateIdSuffix),
    generated_at:generatedAt,
    source,
    scenario,
    ...(contextAuthority?{context_authority:contextAuthority}:{}),
    update_policy:{
      blank_values:'preserve_existing',
      explicit_clear_only_via:'operation.clear_fields',
      missing_fields:'no_change',
      explicit_zero_and_false:'write_value',
      identity_resolution:'platform',
    },
    profile_audit_confirmations:clone(profileAuditConfirmations),
    operations:clone(operations),
  };
}

export function buildUpdatePackageRootInstruction({scenario,weekly=false}={}){
  if(!scenario)throw new Error('update_package_prompt_scenario_required');
  const required=UPDATE_PACKAGE_REQUIRED_ROOT.join('、');
  const example={
    schema_version:UPDATE_PACKAGE_SCHEMA_VERSION,
    update_id:'UPD-YYYYMMDDHHMMSS-AI',
    generated_at:'有效 ISO 日期時間',
    source:UPDATE_PACKAGE_SOURCE,
    scenario,
    ...(weekly?{context_authority:'UPDATE_CENTER_JSON'}:{}),
    operations:[],
  };
  return `\n\nUpdate Package v1.1 外層契約（必須逐字遵守）：\n- validator 必填 root：${required}。\n- schema_version 必須是字串 \"${UPDATE_PACKAGE_SCHEMA_VERSION}\"，不可使用 schema 取代。\n- update_id 必須存在且每次更新包唯一；使用 UPD-YYYYMMDDHHMMSS-AI 類型即可。\n- generated_at 必須是有效 ISO 日期時間。\n- source 必須是字串 \"${UPDATE_PACKAGE_SOURCE}\"。\n- scenario 必須保留在 payload root，且本情境固定為 \"${scenario}\"；不可搬進 source 或刪除。${weekly?'\n- Weekly 另須在 root 保留 context_authority=\"UPDATE_CENTER_JSON\"。':''}\n- operations 必須是陣列；不要把 operations 包進 data/source。\n- 不得輸出 schema 欄位來取代 schema_version。\n- 最小合法 root 形狀：${JSON.stringify(example)}\n- 最終輸出仍須包含情境需要的 operation.key / data / evidence / review_required；上面的空 operations 只是 root 位置示意，不代表可輸出空更新包。`;
}

export function looksLikeLegacyUpdatePackageEnvelope(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Array.isArray(payload.operations))return false;
  const missing=UPDATE_PACKAGE_REQUIRED_ROOT.filter(key=>!(key in payload));
  return Boolean(missing.length&&(payload.schema||payload.scenario||payload.session_id||payload.context_authority));
}

export function legacyUpdatePackageEnvelopeGuidance(payload){
  if(!looksLikeLegacyUpdatePackageEnvelope(payload))return null;
  const missing=UPDATE_PACKAGE_REQUIRED_ROOT.filter(key=>!(key in payload));
  return `偵測到內容可能有效，但外層不是目前 Update Package v1.1 envelope（缺少：${missing.join('、')}）。請使用最新 Prompt 重新產生；系統不會自動猜測或補寫 root 後套用。`;
}

export function buildUpdatePackageJsonSchema({scenario,entities,weekly=false}={}){
  if(!scenario)throw new Error('update_package_schema_scenario_required');
  if(!Array.isArray(entities)||!entities.length)throw new Error('update_package_schema_entities_required');
  const properties={
    schema_version:{type:'string',enum:[UPDATE_PACKAGE_SCHEMA_VERSION]},
    update_id:{type:'string',description:'Unique update package id, e.g. UPD-YYYYMMDDHHMMSS-AI.'},
    generated_at:{type:'string',description:'ISO-8601 timestamp generated for this response.'},
    source:{type:'string',enum:[UPDATE_PACKAGE_SOURCE]},
    scenario:{type:'string',enum:[scenario]},
    update_policy:{type:'object',additionalProperties:true},
    profile_audit_confirmations:{type:'array',items:{type:'object',additionalProperties:true}},
    operations:{
      type:'array',minItems:1,
      items:{
        type:'object',
        properties:{
          operation_id:{type:'string'},
          entity:{type:'string',enum:entities},
          action:{type:'string',enum:[...UPDATE_PACKAGE_ACTIONS]},
          key:buildOperationKeyJsonSchema(entities),
          data:{type:'object',additionalProperties:true},
          clear_fields:{type:'array',items:{type:'string'}},
          evidence:{
            type:'object',
            properties:{
              source_type:{type:'string'},
              source_image_ref:{type:'string'},
              source_image_refs:{type:'array',items:{type:'string'}},
              confidence:{type:'number',minimum:0,maximum:1},
            },
            required:['source_image_ref','confidence'],
            additionalProperties:true,
          },
          review_required:{type:'boolean'},
          user_audit:{type:'object',additionalProperties:true},
        },
        required:['operation_id','entity','action','key','data','evidence','review_required'],
        additionalProperties:true,
      },
    },
  };
  if(weekly)properties.context_authority={type:'string',enum:['UPDATE_CENTER_JSON']};
  return {
    type:'object',
    properties,
    required:[...UPDATE_PACKAGE_REQUIRED_ROOT,'scenario',...(weekly?['context_authority']:[])],
    additionalProperties:true,
  };
}
