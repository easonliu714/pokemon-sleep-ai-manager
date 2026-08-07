import {AI_OBSERVATION_PROMPT,buildObservationTemplate} from './ai-observation.js';

const auditRules=`共通更新規則：\n1. 只輸出符合 Update Package v1.1 的單一 JSON，不輸出 Markdown 或解釋。\n2. 無法確認、未顯示或圖片未涵蓋的欄位填 null 或省略，不可猜測。\n3. null、空字串與省略欄位代表「不更新」，不得用來清空既有資料。只有使用者明確要求清除時，才將欄位名稱加入 operation.clear_fields。\n4. 每筆 operation 使用唯一 operation_id、evidence.source_image_ref、evidence.confidence。\n5. 需要人工確認時 review_required=true；不得自行解除。\n6. 禁止 delete。\n7. 不得使用公版物種候選值補成玩家個體實際食材或副技能。\n8. 若畫面只顯示部分食材槽／副技能槽，建立 profile_audit_confirmations，status=user_confirmed_not_visible、confirmed_by_user=false，等待用戶在更新中心確認。`;
const base=`你是 Pokémon Sleep AI Manager 的資料轉換器。${auditRules}`;
const wrap=(title,rules,entities,exampleData={})=>({title,prompt:`${base}\n\n情境：${title}\n${rules}\n允許 entity：${entities.join('、')}。`,entities,contract:'update-package-v1.1',exampleData});
export const PROMPT_CATALOG={
  pokemon:{
    title:'寶可夢盒／個體能力觀察',
    prompt:`${AI_OBSERVATION_PROMPT}\n\n更新中心補充規則：\n- Observation v2 只記錄畫面事實，空值不覆蓋既有資料。\n- 未顯示的食材槽或副技能槽不得補猜；在 observation.audit_candidates 中標記 status=user_confirmed_not_visible、confirmed_by_user=false。\n- AI 不得建立永久個體 ID；平台匯入時才判定既有成員、升級、更名、進化或新成員。`,
    entities:['pokemon_observation'],contract:'observation-v2'
  },
  ingredients:wrap('食材庫存更新','只更新截圖中可辨識的食材；未出現項目不可設為 0；數量須為非負整數。空白或看不清楚的數量填 null，平台會保留既有值。',['ingredient_inventory','account_capacity'],{quantity:null}),
  items:wrap('道具包更新','只更新截圖中可辨識的道具；可同時輸出 quantity、safe_reserve、recommendation；未出現項目不可設為 0。空白欄位填 null，不得清除既有建議。',['item_inventory','account_capacity'],{quantity:null,safe_reserve:null,recommendation:null}),
  recipes:wrap('食譜與解鎖狀態更新','逐道食譜輸出 recipes；配方材料使用 recipe_ingredients；看不清楚的材料或數量填 null 並 review_required=true。未出現料理不得自動改成未解鎖。',['recipes','recipe_ingredients'],{unlocked:null,recipe_level:null,current_energy:null}),
  capacity:wrap('帳號容量更新','辨識鍋子、食材包、道具包與寶可夢盒容量；capacity_key 僅用 pot、ingredient_bag、item_bag、pokemon_box。無法確認的容量填 null。',['account_capacity'],{total_capacity:null,used_count:null}),
  discard:wrap('送博士紀錄','只有使用者明確確認送博士時才輸出；entity=discarded_pokemon、action=discarded，不可同時新增 pokemon。若畫面不能確認送博士，不得輸出操作。',['discarded_pokemon']),
  weekly:wrap('每週營地／料理／活動規劃','整理週起始日、營地、料理類型、三種喜好樹果、活動摘要與目標。未知欄位填 null，不得清除既有週計畫。',['weekly_plan'],{camp:null,meal_type:null,event_summary:null})
};

function templateKey(entity){
  return {
    discarded_pokemon:{discard_id:'discard_example_001'},
    ingredient_inventory:{ingredient_name:'好眠番茄'},
    item_inventory:{item_name:'寶可沙布蕾'},
    recipes:{recipe_id:'recipe_example_001'},
    recipe_ingredients:{recipe_id:'recipe_example_001',ingredient_name:'好眠番茄'},
    account_capacity:{capacity_key:'ingredient_bag'},
    weekly_plan:{plan_id:'week_2026-07-27'},
  }[entity];
}

export function buildScenarioTemplate(key){
  if(key==='pokemon')return buildObservationTemplate();
  const c=PROMPT_CATALOG[key];
  const entity=c.entities[0];
  return {
    schema_version:'1.1',
    update_id:`UPD-${new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)}-EXAMPLE`,
    generated_at:new Date().toISOString(),
    source:'ai_screenshot_analysis',
    scenario:key,
    update_policy:{
      blank_values:'preserve_existing',
      explicit_clear_only_via:'operation.clear_fields',
      missing_fields:'no_change',
      identity_resolution:'platform',
    },
    profile_audit_confirmations:[],
    operations:[{
      operation_id:'OP-001',
      entity,
      action:entity==='discarded_pokemon'?'discarded':'upsert',
      key:templateKey(entity),
      data:{...c.exampleData},
      clear_fields:[],
      evidence:{source_type:'screenshot',source_image_ref:'image-001',confidence:0.95},
      review_required:true,
      user_audit:{accepted_current_observation:false},
    }],
  };
}
