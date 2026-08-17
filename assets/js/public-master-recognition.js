import {MASTER_DATA_VERSION,PUBLIC_INGREDIENT_NAMES} from './shared-master-data.js';
import {PUBLIC_ITEM_MASTER_VERSION,PUBLIC_ITEM_MASTER} from './public-item-master.js';
import {PUBLIC_CANDY_MASTER_VERSION,buildPublicCandyMasterRows} from './public-candy-master.js';
import {PUBLIC_RECIPE_MASTER_VERSION,PUBLIC_RECIPE_MASTER} from './public-recipe-current-authority.js';
import {
  PUBLIC_RECIPE_ALIAS_VERSION,
  isRecipeAutomaticIdentityMatch,
  recipeAliasesForCanonical,
} from './public-recipe-alias-master.js';
import {buildUpdatePackageEnvelope} from './update-package-contract.js';
import {
  augmentRecipeRecognitionJsonSchema,
  buildRecipePotCapacityPromptInstruction,
  compileRecipePotCapacityOperation,
  validateRecipePotCapacityObservations,
} from './pot-capacity-authority.js';

export const PUBLIC_MASTER_CATALOG_SCHEMA='pokemon-sleep-public-master-catalog/1.0';
export const PUBLIC_MASTER_RECOGNITION_SCHEMA='pokemon-sleep-public-master-recognition/1.0';
export const PUBLIC_MASTER_RECOGNITION_VERSION='public-master-recognition-2026-08-17-d-locked-placeholder';
export const PUBLIC_MASTER_AI_STATUSES=Object.freeze(['MATCHED','AMBIGUOUS','UNMATCHED']);
export const PUBLIC_MASTER_USER_STATUSES=Object.freeze([...PUBLIC_MASTER_AI_STATUSES,'IGNORE_CONFIRMED']);

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').trim();
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const meaningful=value=>value!==null&&value!==undefined&&value!=='';
const nonNegativeInteger=value=>Number.isInteger(value)&&value>=0;

export function isLockedUnknownRecipePlaceholder(observation){
  const text=clean(observation?.observed_text).normalize('NFKC').replace(/\s+/g,'');
  return observation?.observed_data?.unlocked===false&&/^\d+種食材的(?:咖哩|濃湯|沙拉|甜點|點心|飲料|料理)$/.test(text);
}

const dataSchemas=Object.freeze({
  ingredients:Object.freeze({quantity:{type:'integer',minimum:0}}),
  items:Object.freeze({quantity:{type:'integer',minimum:0}}),
  candies:Object.freeze({quantity:{type:'integer',minimum:0}}),
  recipes:Object.freeze({
    unlocked:{type:'boolean'},
    recipe_level:{type:'integer',minimum:0},
    current_energy:{type:'integer',minimum:0},
  }),
});

const definitions=Object.freeze({
  ingredients:Object.freeze({
    scenario_key:'ingredients',scenario:'ingredient_inventory_update',authority:'ingredient_master',data_version:MASTER_DATA_VERSION,
    entity:'ingredient_inventory',canonical_key_fields:Object.freeze(['ingredient_name']),display_name_field:'ingredient_name',data_schema:dataSchemas.ingredients,
    rows:()=>PUBLIC_INGREDIENT_NAMES.map(ingredient_name=>({ingredient_name})),
  }),
  items:Object.freeze({
    scenario_key:'items',scenario:'item_inventory_update',authority:'item_master',data_version:PUBLIC_ITEM_MASTER_VERSION,
    entity:'item_inventory',canonical_key_fields:Object.freeze(['item_name']),display_name_field:'item_name',data_schema:dataSchemas.items,
    rows:()=>PUBLIC_ITEM_MASTER.map(row=>({item_name:row.item_name,item_category:row.item_category||null})),
  }),
  candies:Object.freeze({
    scenario_key:'candies',scenario:'candy_inventory_update',authority:'candy_master',data_version:PUBLIC_CANDY_MASTER_VERSION,
    entity:'candy_inventory',canonical_key_fields:Object.freeze(['candy_id','candy_name']),display_name_field:'candy_name',data_schema:dataSchemas.candies,
    rows:()=>buildPublicCandyMasterRows().map(row=>({candy_id:row.candy_id,candy_name:row.candy_name,candy_type:row.candy_type||null})),
  }),
  recipes:Object.freeze({
    scenario_key:'recipes',scenario:'recipe_status_update',authority:'recipe_master',data_version:PUBLIC_RECIPE_MASTER_VERSION,
    identity_alias_version:PUBLIC_RECIPE_ALIAS_VERSION,
    entity:'recipes',canonical_key_fields:Object.freeze(['recipe_id','recipe_name']),display_name_field:'recipe_name',data_schema:dataSchemas.recipes,
    rows:()=>PUBLIC_RECIPE_MASTER.map(row=>({
      recipe_id:row.recipe_id,recipe_name:row.recipe_name,category:row.category||null,
      aliases:recipeAliasesForCanonical(row.recipe_id,row.recipe_name),
    })),
  }),
});

export const PUBLIC_MASTER_RECOGNITION_REGISTRY=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([key,value])=>[key,Object.freeze({
  scenario_key:value.scenario_key,
  scenario:value.scenario,
  authority:value.authority,
  data_version:value.data_version,
  identity_alias_version:value.identity_alias_version||null,
  entity:value.entity,
  canonical_key_fields:[...value.canonical_key_fields],
  display_name_field:value.display_name_field,
  data_fields:Object.keys(value.data_schema),
})])));

export function getPublicMasterRecognitionDefinition(input){
  const value=clean(input);
  return definitions[value]||Object.values(definitions).find(item=>item.scenario===value)||null;
}

export function supportsPublicMasterRecognition(input){return Boolean(getPublicMasterRecognitionDefinition(input));}

export function buildPublicMasterCatalogSnapshot(input){
  const def=getPublicMasterRecognitionDefinition(input);if(!def)throw new Error(`public_master_recognition_unsupported:${input}`);
  const rows=def.rows().map(row=>clone(row));
  const aliasVersion=def.identity_alias_version||null;
  return {
    schema:PUBLIC_MASTER_CATALOG_SCHEMA,
    recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
    scenario_key:def.scenario_key,
    scenario:def.scenario,
    authority:def.authority,
    data_version:def.data_version,
    identity_alias_version:aliasVersion,
    catalog_snapshot_id:`${def.authority}@${def.data_version}${aliasVersion?`+${aliasVersion}`:''}`,
    canonical_key_fields:[...def.canonical_key_fields],
    display_name_field:def.display_name_field,
    row_count:rows.length,
    rows,
    privacy:{public_only:true,player_quantities_included:false,player_unlocks_included:false,private_pokemon_included:false},
  };
}

function keySchema(snapshot){
  const properties={};
  for(const field of snapshot.canonical_key_fields){
    const values=[...new Set(snapshot.rows.map(row=>row[field]).filter(meaningful))];
    properties[field]={type:'string',enum:values};
  }
  return {type:'object',properties,additionalProperties:false};
}

export function buildPublicMasterRecognitionJsonSchema(input){
  const def=getPublicMasterRecognitionDefinition(input);if(!def)throw new Error(`public_master_recognition_unsupported:${input}`);
  const snapshot=buildPublicMasterCatalogSnapshot(def.scenario_key);
  const displayNames=[...new Set(snapshot.rows.map(row=>row[snapshot.display_name_field]).filter(meaningful))];
  const schema={
    type:'object',
    properties:{
      schema:{type:'string',enum:[PUBLIC_MASTER_RECOGNITION_SCHEMA]},
      recognition_version:{type:'string',enum:[PUBLIC_MASTER_RECOGNITION_VERSION]},
      scenario:{type:'string',enum:[snapshot.scenario]},
      authority:{type:'string',enum:[snapshot.authority]},
      data_version:{type:'string',enum:[snapshot.data_version]},
      catalog_snapshot_id:{type:'string',enum:[snapshot.catalog_snapshot_id]},
      generated_at:{type:'string'},
      visible_target_count:{type:'integer',minimum:0},
      observations:{
        type:'array',
        items:{
          type:'object',
          properties:{
            observation_id:{type:'string'},
            status:{type:'string',enum:[...PUBLIC_MASTER_AI_STATUSES]},
            observed_text:{type:'string'},
            observed_data:{type:'object',properties:clone(def.data_schema),additionalProperties:false},
            canonical_key:keySchema(snapshot),
            canonical_name:{type:'string',enum:displayNames},
            candidate_names:{type:'array',items:{type:'string',enum:displayNames}},
            source_image_ref:{type:'string'},
            confidence:{type:'number',minimum:0,maximum:1},
            reason:{type:'string'},
          },
          required:['observation_id','status','observed_text','observed_data','source_image_ref','confidence'],
          additionalProperties:false,
        },
      },
    },
    required:['schema','recognition_version','scenario','authority','data_version','catalog_snapshot_id','generated_at','visible_target_count','observations'],
    additionalProperties:false,
  };
  return def.scenario_key==='recipes'?augmentRecipeRecognitionJsonSchema(schema):schema;
}

function dataRuleText(def){
  if(def.scenario_key==='recipes')return 'observed_data 只可包含 unlocked、recipe_level、current_energy；只輸出畫面實際看見的欄位，未顯示欄位省略。料理只有 observed_text 與公版 recipe_name 完全一致，或逐字符合該公版列的 aliases，才可標 MATCHED；只是語意相近、同配方或你認為是同一道料理，都必須標 AMBIGUOUS。若畫面只顯示「4種食材的咖哩／濃湯／沙拉／甜點／點心／飲料」等未解鎖占位名稱，請輸出 unlocked=false、status=UNMATCHED、reason=LOCKED_UNKNOWN_RECIPE_SLOT；平台會把它視為不可識別的鎖定槽位與 coverage evidence，直接忽略 identity mapping，不要求使用者猜公版名稱，也不是 Public Master 缺口。';
  return 'observed_data.quantity 只在畫面可辨識數量時輸出，必須是 0 以上整數；未顯示項目不可補 0。';
}

export function buildPublicMasterRecognitionPrompt(input,{sessionId=null,coverage='PARTIAL',imageMap=[]}={}){
  const def=getPublicMasterRecognitionDefinition(input);if(!def)throw new Error(`public_master_recognition_unsupported:${input}`);
  const snapshot=buildPublicMasterCatalogSnapshot(def.scenario_key);
  const mapping=Array.isArray(imageMap)&&imageMap.length?imageMap.map(item=>`- ${item.image_ref} = ${item.file_name}`).join('\n'):'- 由呼叫端提供 image_ref';
  const capacityInstruction=def.scenario_key==='recipes'?buildRecipePotCapacityPromptInstruction():'';
  return `你是 Pokémon Sleep AI Manager 的 Public Master Constrained Recognition 模型。\n\n你的工作不是直接建立 Update Package，而是先把截圖中每一個目標項目與平台提供的公版 Master 做身份比對。平台會在你回傳後再次驗證 canonical key，只有 MATCHED 才可能編譯成 Update Package，再走 Review → Dry Run → Apply。\n\n本次契約：\n- schema=${PUBLIC_MASTER_RECOGNITION_SCHEMA}\n- recognition_version=${PUBLIC_MASTER_RECOGNITION_VERSION}\n- scenario=${snapshot.scenario}\n- authority=${snapshot.authority}\n- data_version=${snapshot.data_version}\n- identity_alias_version=${snapshot.identity_alias_version||'none'}\n- catalog_snapshot_id=${snapshot.catalog_snapshot_id}\n- session_id=${sessionId||'not_provided'}\n- coverage=${coverage}\n\n圖片對應：\n${mapping}\n\n公版候選（這是唯一 canonical authority；不得自行創造 ID 或 canonical 名稱）：\n${JSON.stringify(snapshot.rows)}\n\n辨識規則：\n1. 先獨立計算截圖中可辨識的目標項目總數，填 visible_target_count；observations.length 必須與 visible_target_count 相同，不可因公版沒有對應而省略畫面項目。\n2. 每個畫面項目只能輸出一次 observation。\n3. status=MATCHED：只有能唯一且符合本情境身份規則對應上方公版候選時使用；canonical_key 必須逐字取自公版候選，canonical_name 必須等於該候選的顯示名稱。\n4. status=AMBIGUOUS：有兩個以上合理候選，或名稱只有語意／模糊相似但不符合 exact/approved-alias 規則時使用；不得自行選一個寫成 MATCHED。可把建議候選名稱放 candidate_names。\n5. status=UNMATCHED：畫面確實有該項目，但目前公版候選沒有可靠對應時使用。不得丟棄或自行新增 Master。\n6. 相似字／模糊比對只能用於 candidate_names 建議，不能授權 MATCHED。\n7. observed_text 儘量逐字保留畫面文字；看不清楚時降低 confidence，不可一邊猜測一邊給高信心。\n8. ${dataRuleText(def)}\n9. source_image_ref 必須使用本次圖片對應中的 image_ref。\n10. coverage=USER_CONFIRMED_COMPLETE 只表示使用者確認本 session 涵蓋完整畫面範圍；未出現的公版項目仍不得補 0、false 或未解鎖。\n11. 只輸出單一 JSON，不輸出 Markdown、code fence 或解釋。${capacityInstruction}`;
}

export function isPublicMasterRecognitionPayload(payload){return Boolean(payload&&typeof payload==='object'&&!Array.isArray(payload)&&payload.schema===PUBLIC_MASTER_RECOGNITION_SCHEMA);}

function catalogRowFromKey(snapshot,key){
  if(!key||typeof key!=='object')return null;
  return snapshot.rows.find(row=>snapshot.canonical_key_fields.every(field=>clean(row[field])===clean(key[field])))||null;
}

function canonicalKeyFromRow(snapshot,row){return Object.fromEntries(snapshot.canonical_key_fields.map(field=>[field,row[field]]));}

function validateObservedData(def,data,label,errors){
  if(!data||typeof data!=='object'||Array.isArray(data)){errors.push(`${label} observed_data 必須是物件`);return;}
  const allowed=new Set(Object.keys(def.data_schema));
  for(const key of Object.keys(data))if(!allowed.has(key))errors.push(`${label} observed_data 不支援欄位：${key}`);
  if(def.scenario_key==='recipes'){
    if(hasOwn(data,'unlocked')&&typeof data.unlocked!=='boolean')errors.push(`${label} unlocked 必須為 boolean`);
    for(const field of ['recipe_level','current_energy'])if(hasOwn(data,field)&&!nonNegativeInteger(data[field]))errors.push(`${label} ${field} 必須為 0 以上整數`);
    if(!['unlocked','recipe_level','current_energy'].some(field=>hasOwn(data,field)))errors.push(`${label} MATCHED recipe 至少需要一個可觀測狀態欄位`);
  }else{
    if(!hasOwn(data,'quantity')||!nonNegativeInteger(data.quantity))errors.push(`${label} MATCHED ${def.entity} 必須包含 0 以上整數 quantity`);
  }
}

function unresolvedRecipeIdentity(observation,row,index){
  const canonicalName=row?.recipe_name||'';
  return {
    observation_id:observation.observation_id||`observation-${index+1}`,
    status:'AMBIGUOUS',
    observed_text:observation.observed_text||'',
    observed_data:clone(observation.observed_data||{}),
    source_image_ref:observation.source_image_ref||null,
    confidence:observation.confidence,
    candidate_names:[canonicalName],
    user_resolution:clone(observation.user_resolution||null),
    reason:'RECIPE_NAME_REQUIRES_EXACT_OR_APPROVED_ALIAS',
  };
}

export function validatePublicMasterRecognitionPayload(payload,input,{allowedImageRefs=[]}={}){
  const def=getPublicMasterRecognitionDefinition(input);if(!def)return {ok:false,errors:[`不支援 Public Master recognition：${input}`],warnings:[],unresolved:[],snapshot:null};
  const snapshot=buildPublicMasterCatalogSnapshot(def.scenario_key),errors=[],warnings=[],unresolved=[];
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return {ok:false,errors:['Recognition JSON 根節點必須是物件'],warnings,unresolved,snapshot};
  if(payload.schema!==PUBLIC_MASTER_RECOGNITION_SCHEMA)errors.push(`Recognition schema 必須為 ${PUBLIC_MASTER_RECOGNITION_SCHEMA}`);
  if(payload.recognition_version!==PUBLIC_MASTER_RECOGNITION_VERSION)errors.push(`Recognition version 不相符：${payload.recognition_version||'missing'}`);
  if(payload.scenario!==snapshot.scenario)errors.push(`Recognition scenario 必須為 ${snapshot.scenario}`);
  if(payload.authority!==snapshot.authority)errors.push(`Recognition authority 必須為 ${snapshot.authority}`);
  if(payload.data_version!==snapshot.data_version||payload.catalog_snapshot_id!==snapshot.catalog_snapshot_id)errors.push(`Public Master snapshot 已變更或不相符；請使用最新公版候選重新分析`);
  if(!Array.isArray(payload.observations))errors.push('Recognition observations 必須是陣列');
  const observations=Array.isArray(payload.observations)?payload.observations:[];
  if(!nonNegativeInteger(payload.visible_target_count))errors.push('visible_target_count 必須是 0 以上整數');
  else if(payload.visible_target_count!==observations.length)errors.push(`visible_target_count=${payload.visible_target_count} 與 observations.length=${observations.length} 不一致；不得靜默省略未匹配項目`);
  const allowedRefs=new Set(allowedImageRefs||[]),ids=new Set(),displayNames=new Set(snapshot.rows.map(row=>row[snapshot.display_name_field]));
  observations.forEach((observation,index)=>{
    const label=`Recognition #${index+1}`;
    if(!observation||typeof observation!=='object'){errors.push(`${label} 格式錯誤`);return;}
    if(!clean(observation.observation_id))errors.push(`${label} 缺少 observation_id`);else if(ids.has(observation.observation_id))errors.push(`${label} observation_id 重複：${observation.observation_id}`);else ids.add(observation.observation_id);
    if(!PUBLIC_MASTER_USER_STATUSES.includes(observation.status))errors.push(`${label} status 不支援：${observation.status}`);
    if(!clean(observation.observed_text))warnings.push(`${label} observed_text 為空`);
    if(typeof observation.confidence!=='number'||observation.confidence<0||observation.confidence>1)errors.push(`${label} confidence 必須介於 0 到 1`);
    if(!clean(observation.source_image_ref))errors.push(`${label} 缺少 source_image_ref`);else if(allowedRefs.size&&!allowedRefs.has(observation.source_image_ref))errors.push(`${label} source_image_ref 不屬於本情境：${observation.source_image_ref}`);
    if(Array.isArray(observation.candidate_names))for(const name of observation.candidate_names)if(!displayNames.has(name))errors.push(`${label} candidate_names 包含非公版候選：${name}`);
    if(observation.status==='MATCHED'){
      const row=catalogRowFromKey(snapshot,observation.canonical_key);
      if(!row){errors.push(`${label} MATCHED canonical_key 不存在於目前 Public Master`);return;}
      if(meaningful(observation.canonical_name)&&observation.canonical_name!==row[snapshot.display_name_field])errors.push(`${label} canonical_name 與 canonical_key 不一致`);
      validateObservedData(def,observation.observed_data,label,errors);
      if(def.scenario_key==='recipes'&&!isRecipeAutomaticIdentityMatch(observation.observed_text,row,{userResolution:observation.user_resolution})){
        unresolved.push(unresolvedRecipeIdentity(observation,row,index));
      }
    }else if(observation.status==='IGNORE_CONFIRMED'){
      if(observation.user_resolution?.action!=='IGNORE_CONFIRMED')errors.push(`${label} IGNORE_CONFIRMED 必須有使用者確認紀錄`);
    }else{
      if(def.scenario_key==='recipes'&&isLockedUnknownRecipePlaceholder(observation)){
        warnings.push(`${label} 已辨識為未解鎖未知料理槽位；保留 coverage evidence，但不視為 Public Master 缺口，也不要求使用者建立料理 identity 對應。`);
        return;
      }
      unresolved.push({
        observation_id:observation.observation_id||`observation-${index+1}`,
        status:observation.status,
        observed_text:observation.observed_text||'',
        observed_data:clone(observation.observed_data||{}),
        source_image_ref:observation.source_image_ref||null,
        confidence:observation.confidence,
        candidate_names:[...(observation.candidate_names||[])],
        user_resolution:clone(observation.user_resolution||null),
        reason:observation.reason||'',
      });
    }
  });
  if(def.scenario_key==='recipes'){
    const pot=validateRecipePotCapacityObservations(payload.capacity_observations,{allowedImageRefs:[...allowedRefs]});
    errors.push(...pot.errors);warnings.push(...pot.warnings);
  }
  return {ok:errors.length===0&&unresolved.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)],unresolved,snapshot};
}

export function compilePublicMasterRecognitionToUpdatePackage(payload,input,{allowedImageRefs=[]}={}){
  const def=getPublicMasterRecognitionDefinition(input);if(!def)throw new Error(`public_master_recognition_unsupported:${input}`);
  const validation=validatePublicMasterRecognitionPayload(payload,def.scenario_key,{allowedImageRefs});
  const snapshot=validation.snapshot||buildPublicMasterCatalogSnapshot(def.scenario_key),operations=[];
  const unresolvedIds=new Set((validation.unresolved||[]).map(item=>item.observation_id));
  for(const [index,observation] of (Array.isArray(payload?.observations)?payload.observations:[]).entries()){
    if(observation?.status!=='MATCHED'||unresolvedIds.has(observation.observation_id))continue;
    const row=catalogRowFromKey(snapshot,observation.canonical_key);if(!row)continue;
    const data={};for(const field of Object.keys(def.data_schema))if(hasOwn(observation.observed_data,field)&&meaningful(observation.observed_data[field]))data[field]=observation.observed_data[field];
    operations.push({
      operation_id:`REC-${String(index+1).padStart(3,'0')}`,
      entity:def.entity,
      action:'upsert',
      key:canonicalKeyFromRow(snapshot,row),
      data,
      clear_fields:[],
      evidence:{
        source_type:'screenshot',source_image_ref:observation.source_image_ref,confidence:observation.confidence,
        recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,catalog_snapshot_id:snapshot.catalog_snapshot_id,
        observed_text:observation.observed_text,canonical_name:row[snapshot.display_name_field],
      },
      review_required:false,
    });
  }
  const matchedRecipeCount=operations.length;
  let capacityObservationCount=0,potCapacityObserved=null;
  if(def.scenario_key==='recipes'){
    const pot=compileRecipePotCapacityOperation(payload,{allowedImageRefs});
    if(pot.operation&&validation.errors.length===0){operations.push(pot.operation);capacityObservationCount=pot.count;potCapacityObserved=pot.operation.data.total_capacity;}
  }
  const generatedAt=clean(payload?.generated_at)||new Date().toISOString();
  const updatePackage=buildUpdatePackageEnvelope({scenario:def.scenario,generatedAt,operations,updateIdSuffix:'CATALOG'});
  const ignoredCount=(payload?.observations||[]).filter(item=>item?.status==='IGNORE_CONFIRMED'||(def.scenario_key==='recipes'&&isLockedUnknownRecipePlaceholder(item))).length;
  return {
    ok:validation.ok,
    update_package:updatePackage,
    errors:validation.errors,
    warnings:validation.warnings,
    unresolved:validation.unresolved,
    snapshot,
    summary:{
      visible_target_count:Number(payload?.visible_target_count||0),matched_count:matchedRecipeCount,
      unresolved_count:validation.unresolved.length,ignored_count:ignoredCount,
      capacity_observation_count:capacityObservationCount,pot_capacity_observed:potCapacityObserved,
      authority:snapshot.authority,data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,
    },
  };
}

export function applyPublicMasterRecognitionResolution(payload,input,observationId,action,displayName=null){
  const def=getPublicMasterRecognitionDefinition(input);if(!def)throw new Error(`public_master_recognition_unsupported:${input}`);
  const snapshot=buildPublicMasterCatalogSnapshot(def.scenario_key),copy=clone(payload),observation=(copy.observations||[]).find(item=>item.observation_id===observationId);
  if(!observation)throw new Error(`找不到 Recognition observation：${observationId}`);
  const now=new Date().toISOString();
  if(action==='MATCH'){
    const row=snapshot.rows.find(item=>item[snapshot.display_name_field]===displayName);if(!row)throw new Error(`公版候選不存在：${displayName}`);
    observation.status='MATCHED';observation.canonical_key=canonicalKeyFromRow(snapshot,row);observation.canonical_name=row[snapshot.display_name_field];
    observation.user_resolution={action:'USER_CONFIRMED_MATCH',confirmed_at:now,canonical_name:row[snapshot.display_name_field]};
  }else if(action==='IGNORE'){
    observation.status='IGNORE_CONFIRMED';delete observation.canonical_key;delete observation.canonical_name;
    observation.user_resolution={action:'IGNORE_CONFIRMED',confirmed_at:now};
  }else if(action==='MASTER_GAP'){
    observation.status='UNMATCHED';delete observation.canonical_key;delete observation.canonical_name;
    observation.user_resolution={action:'PUBLIC_MASTER_GAP_CONFIRMED',confirmed_at:now};
  }else throw new Error(`不支援 Recognition resolution：${action}`);
  return copy;
}
