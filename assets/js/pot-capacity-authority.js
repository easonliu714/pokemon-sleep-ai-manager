export const POT_CAPACITY_AUTHORITY_VERSION='pot-capacity-authority-2026-08-12-a';

const text=value=>String(value??'').normalize('NFKC').trim();
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);

export function normalizeBasePotCapacity(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isInteger(n)&&n>0?n:null;
}

export function resolveBasePotCapacity({accountCapacity=null,legacyWeeklyPot=null}={}){
  const account=normalizeBasePotCapacity(accountCapacity);
  if(account!==null)return Object.freeze({pot_size:account,source:'ACCOUNT_CAPACITY',is_legacy_fallback:false});
  const legacy=normalizeBasePotCapacity(legacyWeeklyPot);
  if(legacy!==null)return Object.freeze({pot_size:legacy,source:'LEGACY_WEEKLY_POT_FALLBACK',is_legacy_fallback:true});
  return Object.freeze({pot_size:null,source:'MISSING',is_legacy_fallback:false});
}

export function buildPotCapacityUpdateOperation({
  totalCapacity,
  sourceImageRef,
  confidence=1,
  operationId='CAP-POT-001',
  observationContext='RECIPE_SCREEN_BASE_POT_CAPACITY',
}={}){
  const capacity=normalizeBasePotCapacity(totalCapacity);
  if(capacity===null)throw new Error('pot_capacity_total_capacity_invalid');
  const imageRef=text(sourceImageRef);
  if(!imageRef)throw new Error('pot_capacity_source_image_ref_required');
  const c=Number(confidence);
  if(!Number.isFinite(c)||c<0||c>1)throw new Error('pot_capacity_confidence_invalid');
  return Object.freeze({
    operation_id:text(operationId)||'CAP-POT-001',
    entity:'account_capacity',
    action:'upsert',
    key:Object.freeze({capacity_key:'pot'}),
    data:Object.freeze({total_capacity:capacity}),
    clear_fields:Object.freeze([]),
    evidence:Object.freeze({
      source_type:'recipe_screen_capacity_observation',
      source_image_ref:imageRef,
      confidence:c,
      observation_context:text(observationContext)||'RECIPE_SCREEN_BASE_POT_CAPACITY',
      authority_version:POT_CAPACITY_AUTHORITY_VERSION,
    }),
    review_required:false,
  });
}

export function validateRecipePotCapacityObservations(observations,{allowedImageRefs=[]}={}){
  if(observations===null||observations===undefined)return {ok:true,errors:[],warnings:[],observation:null,count:0};
  if(!Array.isArray(observations))return {ok:false,errors:['capacity_observations 必須是陣列'],warnings:[],observation:null,count:0};
  const allowed=new Set(allowedImageRefs||[]),errors=[],warnings=[],valid=[];
  observations.forEach((row,index)=>{
    const label=`Pot capacity #${index+1}`;
    if(!row||typeof row!=='object'||Array.isArray(row)){errors.push(`${label} 格式錯誤`);return;}
    if(text(row.capacity_key)!=='pot'){errors.push(`${label} capacity_key 只能是 pot`);return;}
    const total=normalizeBasePotCapacity(row.total_capacity);
    if(total===null){errors.push(`${label} total_capacity 必須是大於 0 的整數`);return;}
    const ref=text(row.source_image_ref);
    if(!ref)errors.push(`${label} 缺少 source_image_ref`);
    else if(allowed.size&&!allowed.has(ref))errors.push(`${label} source_image_ref 不屬於本情境：${ref}`);
    const confidence=Number(row.confidence);
    if(!Number.isFinite(confidence)||confidence<0||confidence>1)errors.push(`${label} confidence 必須介於 0 到 1`);
    const context=text(row.observation_context);
    if(context&&context!=='RECIPE_SCREEN_BASE_POT_CAPACITY')errors.push(`${label} observation_context 不支援：${context}`);
    if(total!==null&&ref&&Number.isFinite(confidence)&&confidence>=0&&confidence<=1){valid.push({capacity_key:'pot',total_capacity:total,source_image_ref:ref,confidence,observation_context:'RECIPE_SCREEN_BASE_POT_CAPACITY'});}
  });
  const values=[...new Set(valid.map(row=>row.total_capacity))];
  if(values.length>1)errors.push(`同一批料理截圖出現互相衝突的鍋子基礎容量：${values.join(' / ')}；請人工確認`);
  if(valid.length>1&&values.length===1)warnings.push(`同一批 ${valid.length} 個鍋子容量觀測一致，平台合併為單一 account_capacity.pot 更新`);
  return {ok:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)],observation:errors.length?null:(valid[0]||null),count:valid.length};
}

export function augmentRecipeRecognitionJsonSchema(schema){
  const copy=JSON.parse(JSON.stringify(schema));
  copy.properties=copy.properties||{};
  copy.properties.capacity_observations={
    type:'array',
    items:{
      type:'object',
      properties:{
        capacity_key:{type:'string',enum:['pot']},
        total_capacity:{type:'integer',minimum:1},
        source_image_ref:{type:'string'},
        confidence:{type:'number',minimum:0,maximum:1},
        observation_context:{type:'string',enum:['RECIPE_SCREEN_BASE_POT_CAPACITY']},
      },
      required:['capacity_key','total_capacity','source_image_ref','confidence','observation_context'],
      additionalProperties:false,
    },
  };
  return copy;
}

export function buildRecipePotCapacityPromptInstruction(){
  return `\n\n鍋子基礎容量附加辨識規則（平台 account_capacity authority）：\n- 若本次料理／食譜畫面右上角明確顯示「容量：N個」等玩家基礎鍋子容量，額外在 root.capacity_observations 輸出觀測。\n- 格式固定為 [{"capacity_key":"pot","total_capacity":57,"source_image_ref":"image-001","confidence":0.99,"observation_context":"RECIPE_SCREEN_BASE_POT_CAPACITY"}]。\n- 只有畫面直接顯示數字才輸出；看不到就省略 capacity_observations。\n- 不得由料理所需食材總數、週日規則、活動鍋子倍率／加成、好露營券或一般遊戲常識反推基礎容量。\n- 若多張圖都顯示容量，逐張輸出；平台只在數值一致時合併。\n- 此數值屬 account_capacity.pot，不是 weekly_context.pot_size。`;
}

export function compileRecipePotCapacityOperation(payload,{allowedImageRefs=[]}={}){
  const validation=validateRecipePotCapacityObservations(payload?.capacity_observations,{allowedImageRefs});
  if(!validation.ok)return {...validation,operation:null};
  if(!validation.observation)return {...validation,operation:null};
  const row=validation.observation;
  return {...validation,operation:buildPotCapacityUpdateOperation({totalCapacity:row.total_capacity,sourceImageRef:row.source_image_ref,confidence:row.confidence})};
}
