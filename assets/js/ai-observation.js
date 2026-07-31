const UNKNOWN_VALUES=new Set(['','n/a','na','unknown','未知','不明','看不清楚','無法辨識','null','none','-']);
const NUMBER_FIELDS=new Set(['level','sp','main_skill_level','helper_seconds','carry_limit','quantity','unlock_level']);
const SUBSKILL_LEVEL_MAP=new Map([[75,70],[100,80]]);

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
  normalized.profile=normalized.profile||{};
  normalized.ingredients=Array.isArray(normalized.ingredients)?normalized.ingredients:[];
  normalized.subskills=(Array.isArray(normalized.subskills)?normalized.subskills:[]).map(row=>{
    const level=Number(row?.unlock_level);
    return {...row,unlock_level:SUBSKILL_LEVEL_MAP.get(level)||level};
  });
  normalized.evidence={source_image_refs:[],field_confidence:{},unreadable_fields:[],notes:null,...(normalized.evidence||{})};
  delete normalized.action;
  delete normalized.pokemon_id;
  delete normalized.pokemon_instance_id;
  return normalized;
}

export const AI_OBSERVATION_PROMPT=`你是 Pokémon Sleep 圖片資料觀察器。請只輸出單一 JSON 物件，不輸出 Markdown、解釋或前後文字。\n\n重要規則：\n1. 你只記錄圖片中可見的事實，不判斷這是新成員、升級、更名或進化。\n2. requested_action 固定為 resolve_on_import。\n3. 不得自行建立 pokemon_id、pokemon_instance_id、instance_discriminator、insert、update 或 upsert。\n4. 只有提示詞已提供 target_pokemon_instance_id 或 target_update_token 時，才能原樣回傳；否則填 null。\n5. 看不清楚、未顯示或無法確認的欄位填 null，不可猜測。\n6. 食材等級只用 1、30、60；副技能等級只用 10、25、50、70、80。\n7. 數值使用 JSON number，不使用含單位字串。\n8. schema_version 固定為 2.0-observation，source 固定為 ai_screenshot_observation。`;

export function buildObservationTemplate(){
  const now=new Date().toISOString();
  return {schema_version:'2.0-observation',update_id:`UPD-${now.replace(/[-:TZ.]/g,'').slice(0,14)}-XXXX`,generated_at:now,source:'ai_screenshot_observation',observations:[{incoming_ref:'pokemon-image-001',requested_action:'resolve_on_import',identity:{target_pokemon_instance_id:null,target_update_token:null,capture_species_id:null,current_species_id:null,registered_date:null,instance_discriminator:null},profile:{species:null,nickname:null,level:null,sp:null,specialty:null,type:null,nature:null,nature_bonus:null,nature_penalty:null,main_skill:null,main_skill_level:null,helper_seconds:null,carry_limit:null,favorite_berry:null},ingredients:[{unlock_level:1,ingredient_name:null,quantity:null},{unlock_level:30,ingredient_name:null,quantity:null},{unlock_level:60,ingredient_name:null,quantity:null}],subskills:[{unlock_level:10,subskill_name:null},{unlock_level:25,subskill_name:null},{unlock_level:50,subskill_name:null},{unlock_level:70,subskill_name:null},{unlock_level:80,subskill_name:null}],evidence:{source_image_refs:['image-001'],field_confidence:{},unreadable_fields:[],notes:null}}]};
}

export function normalizeObservationPayload(input){
  const parsed=typeof input==='string'?JSON.parse(extractJsonText(input)):clone(input);
  const payload=normalizeObject(parsed);
  payload.schema_version='2.0-observation';
  payload.source='ai_screenshot_observation';
  if(!payload.update_id)payload.update_id=buildObservationTemplate().update_id;
  if(!payload.generated_at)payload.generated_at=new Date().toISOString();
  if(!Array.isArray(payload.observations))payload.observations=[];
  payload.observations=payload.observations.map(normalizeObservation);
  delete payload.operations;
  return payload;
}

export function validateObservationPayload(input){
  const errors=[],warnings=[];
  let payload;
  try{payload=normalizeObservationPayload(input);}catch(error){return {payload:null,errors:[error.message],warnings,summary:{}};}
  if(!payload.observations.length)errors.push('observations 必須至少包含一筆');
  const refs=new Set();
  payload.observations.forEach((item,index)=>{
    const label=`#${index+1}`;
    if(refs.has(item.incoming_ref))errors.push(`${label} incoming_ref 重複：${item.incoming_ref}`);
    refs.add(item.incoming_ref);
    if(item.requested_action!=='resolve_on_import')errors.push(`${label} requested_action 必須為 resolve_on_import`);
    if(!item.profile?.species)warnings.push(`${label} species 無法確認`);
    if(item.identity?.instance_discriminator!=null)errors.push(`${label} instance_discriminator 只能由平台配置`);
    for(const row of item.ingredients)if(![1,30,60].includes(Number(row.unlock_level)))errors.push(`${label} 食材 unlock_level 不合法`);
    for(const row of item.subskills)if(![10,25,50,70,80].includes(Number(row.unlock_level)))errors.push(`${label} 副技能 unlock_level 不合法`);
  });
  return {payload,errors,warnings,summary:{observation_count:payload.observations.length,requires_identity_resolution:payload.observations.length}};
}
