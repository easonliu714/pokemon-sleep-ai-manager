import {AI_OBSERVATION_PROMPT,buildObservationTemplate} from './ai-observation.js';

const base=`你是 Pokémon Sleep AI Manager 的資料轉換器。只輸出符合 Update Package v1.1 的 JSON，不輸出 Markdown 或解釋。無法確認的欄位填 null，不可猜測。每筆 operation 使用唯一 operation_id、evidence.source_image_ref、evidence.confidence；需要人工確認時 review_required=true；禁止 delete。`;
const wrap=(title,rules,entities)=>({title,prompt:`${base}\n\n情境：${title}\n${rules}\n允許 entity：${entities.join('、')}。`,entities,contract:'update-package-v1.1'});
export const PROMPT_CATALOG={
 pokemon:{title:'寶可夢盒／個體能力觀察',prompt:`${AI_OBSERVATION_PROMPT}\n\n請依固定 Observation v2 模板輸出。AI 不得建立永久個體 ID；平台匯入時才判定既有成員、升級、更名、進化或新成員。`,entities:['pokemon_observation'],contract:'observation-v2'},
 ingredients:wrap('食材庫存更新','只更新截圖中可辨識的食材；未出現項目不可設為 0；數量須為非負整數。',['ingredient_inventory','account_capacity']),
 items:wrap('道具包更新','只更新截圖中可辨識的道具；可同時輸出 quantity、safe_reserve、recommendation；未出現項目不可設為 0。',['item_inventory','account_capacity']),
 recipes:wrap('食譜與解鎖狀態更新','逐道食譜輸出 recipes；配方材料使用 recipe_ingredients；看不清楚的材料或數量標記待覆核。',['recipes','recipe_ingredients']),
 capacity:wrap('帳號容量更新','辨識鍋子、食材包、道具包與寶可夢盒容量；capacity_key 僅用 pot、ingredient_bag、item_bag、pokemon_box。',['account_capacity']),
 discard:wrap('送博士紀錄','只有使用者明確確認送博士時才輸出；entity=discarded_pokemon、action=discarded，不可同時新增 pokemon。',['discarded_pokemon']),
 weekly:wrap('每週營地／料理／活動規劃','整理週起始日、營地、料理類型、三種喜好樹果、活動摘要與目標。',['weekly_plan'])
};
export function buildScenarioTemplate(key){
  if(key==='pokemon')return buildObservationTemplate();
  const c=PROMPT_CATALOG[key];
  const entity=c.entities[0];
  const keys={discarded_pokemon:{discard_id:'discard_example_001'},ingredient_inventory:{ingredient_name:'好眠番茄'},item_inventory:{item_name:'寶可沙布蕾'},recipes:{recipe_id:'recipe_example_001'},recipe_ingredients:{recipe_id:'recipe_example_001',ingredient_name:'好眠番茄'},account_capacity:{capacity_key:'ingredient_bag'},weekly_plan:{plan_id:'week_2026-07-27'}};
  return {schema_version:'1.1',update_id:`UPD-${new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)}-EXAMPLE`,generated_at:new Date().toISOString(),source:'ai_screenshot_analysis',scenario:key,operations:[{operation_id:'OP-001',entity,action:entity==='discarded_pokemon'?'discarded':'upsert',key:keys[entity],data:{},evidence:{source_type:'screenshot',source_image_ref:'image-001',confidence:0.95},review_required:true}]};
}
