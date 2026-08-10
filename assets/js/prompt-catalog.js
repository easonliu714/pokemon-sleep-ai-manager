import {AI_OBSERVATION_PROMPT,buildObservationTemplate} from './ai-observation.js';

const auditRules=`共通更新規則：\n1. 只輸出符合 Update Package v1.1 的單一 JSON，不輸出 Markdown 或解釋。\n2. 無法確認、未顯示或圖片未涵蓋的欄位填 null 或省略，不可猜測。\n3. null、空字串與省略欄位代表「不更新」，不得用來清空既有資料。只有使用者明確要求清除時，才將欄位名稱加入 operation.clear_fields。\n4. 數字 0 與布林 false 是有效觀測值，必須原樣輸出，不得當成空值。\n5. 每筆 operation 使用唯一 operation_id、evidence.source_image_ref、evidence.confidence。\n6. 需要人工確認時 review_required=true；不得自行解除。\n7. 禁止 delete。\n8. 不得使用公版物種候選值補成玩家個體實際食材或副技能。\n9. 若畫面只顯示部分食材槽／副技能槽，建立 profile_audit_confirmations，status=user_confirmed_not_visible、confirmed_by_user=false，等待用戶在更新中心確認。`;
const base=`你是 Pokémon Sleep AI Manager 的資料轉換器。${auditRules}`;
const wrap=(title,rules,entities,exampleData={},scenario=null)=>({title,prompt:`${base}\n\n情境：${title}\n${rules}\n允許 entity：${entities.join('、')}。`,entities,contract:'update-package-v1.1',exampleData,scenario});
export const PROMPT_CATALOG={
  pokemon:{
    title:'寶可夢盒／個體能力觀察',
    prompt:`${AI_OBSERVATION_PROMPT}\n\n更新中心補充規則：\n- Observation v2 只記錄畫面事實，空值不覆蓋既有資料。\n- 未顯示的食材槽或副技能槽不得補猜；在 observation.audit_candidates 中標記 status=user_confirmed_not_visible、confirmed_by_user=false。\n- AI 不得建立永久個體 ID；平台匯入時才判定既有成員、升級、更名、進化或新成員。`,
    entities:['pokemon_observation'],contract:'observation-v2',scenario:'pokemon_profile_update'
  },
  ingredients:wrap('食材庫存更新','使用 scenario=ingredient_inventory_update。只更新截圖中可辨識的食材；未出現項目不得設為 0。畫面明確顯示數量 0 時 quantity=0 必須保留；空白或看不清楚填 null，平台保留既有值。',['ingredient_inventory','account_capacity'],{quantity:null},'ingredient_inventory_update'),
  items:wrap('道具包更新','使用 scenario=item_inventory_update。只更新截圖中可辨識的道具；quantity=0 與 safe_reserve=0 都是有效值。可輸出 recommendation；空白欄位填 null，不得清除既有建議。',['item_inventory','account_capacity'],{quantity:null,safe_reserve:null,recommendation:null},'item_inventory_update'),
  recipes:wrap('食譜解鎖／等級／能量更新','使用 scenario=recipe_status_update。逐道料理只更新玩家狀態：unlocked、recipe_level、current_energy。unlocked=false、recipe_level=0、current_energy=0 都是有效值；未出現料理不改狀態。key 優先使用 recipe_id，不知道時可使用公版 recipe_name 由平台解析。',['recipes'],{unlocked:null,recipe_level:null,current_energy:null},'recipe_status_update'),
  capacity:wrap('帳號容量更新','辨識鍋子、食材包、道具包與寶可夢盒容量；capacity_key 僅用 pot、ingredient_bag、item_bag、pokemon_box。無法確認的容量填 null。',['account_capacity'],{total_capacity:null,used_count:null}),
  discard:wrap('送博士紀錄','只有使用者明確確認送博士時才輸出；entity=discarded_pokemon、action=discarded，不可同時新增 pokemon。若畫面不能確認送博士，不得輸出操作。',['discarded_pokemon']),
  weekly:wrap(
    '本週營地／料理／活動 Context',
    '使用 scenario=weekly_context_update。這是玩家當週狀態，不是公版 Master。整理週起始日、實際選擇營地、料理類型、三種喜好樹果、活動名稱、鍋子容量與活動加成。event_effects 必須存為 JSON 字串；已確認的活動加成可包含 recipe_final_energy_multiplier、extra_tasty_multiplier、sunday_extra_tasty_multiplier、sunday_pot_multiplier、new_recipe_count、event_start、event_end。updated_at 必須填產生此更新包時的 ISO 日期時間。未知欄位填 null 或省略；不得把活動或營地寫成公版固定值。',
    ['weekly_context'],
    {week_start:null,camp:null,dish_category:null,favorite_berry_1:null,favorite_berry_2:null,favorite_berry_3:null,event_name:null,event_effects:'{}',pot_size:null,base_notes:null,updated_at:null},
    'weekly_context_update',
  ),
};

function templateKey(entity){
  return {
    discarded_pokemon:{discard_id:'discard_example_001'},
    ingredient_inventory:{ingredient_name:'好眠番茄'},
    item_inventory:{item_name:'寶可沙布蕾'},
    recipes:{recipe_name:'忍者咖哩'},
    recipe_ingredients:{recipe_id:'recipe_example_001',ingredient_name:'好眠番茄'},
    account_capacity:{capacity_key:'ingredient_bag'},
    weekly_plan:{plan_id:'week_example_current'},
    weekly_context:{context_id:'week_example_current'},
  }[entity];
}

export function buildScenarioTemplate(key){
  if(key==='pokemon')return buildObservationTemplate();
  const c=PROMPT_CATALOG[key];
  const entity=c.entities[0];
  const generatedAt=new Date().toISOString();
  const data={...c.exampleData};
  if(entity==='weekly_context')data.updated_at=generatedAt;
  return {
    schema_version:'1.1',
    update_id:`UPD-${generatedAt.replace(/[-:TZ.]/g,'').slice(0,14)}-EXAMPLE`,
    generated_at:generatedAt,
    source:'ai_screenshot_analysis',
    scenario:c.scenario||key,
    update_policy:{
      blank_values:'preserve_existing',
      explicit_clear_only_via:'operation.clear_fields',
      missing_fields:'no_change',
      explicit_zero_and_false:'write_value',
      identity_resolution:'platform',
    },
    profile_audit_confirmations:[],
    operations:[{
      operation_id:'OP-001',
      entity,
      action:entity==='discarded_pokemon'?'discarded':'upsert',
      key:templateKey(entity),
      data,
      clear_fields:[],
      evidence:{source_type:'screenshot',source_image_ref:'image-001',confidence:0.95},
      review_required:true,
      user_audit:{accepted_current_observation:false},
    }],
  };
}
