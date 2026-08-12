import {AI_OBSERVATION_PROMPT,buildObservationTemplate} from './ai-observation.js';
import {localWeekStart} from './evaluation-week.js';
import {buildUpdatePackageEnvelope,buildUpdatePackageRootInstruction} from './update-package-contract.js';

const auditRules=`共通更新規則：\n1. 只輸出符合 Update Package v1.1 的單一有效 JSON，不輸出 Markdown、code fence 或解釋。若目前 AI 介面支援建立檔案，請直接建立 .json 附件；若不支援，則只輸出可直接複製／貼入更新中心的 raw JSON。\n2. 無法確認、未顯示或圖片未涵蓋的欄位填 null 或省略，不可猜測。\n3. null、空字串與省略欄位代表「不更新」，不得用來清空既有資料。只有使用者明確要求清除時，才將欄位名稱加入 operation.clear_fields。\n4. 數字 0 與布林 false 是有效觀測值，必須原樣輸出，不得當成空值。\n5. 每筆 operation 使用唯一 operation_id、evidence.source_image_ref、evidence.confidence。\n6. 需要人工確認時 review_required=true；不得自行解除。\n7. 禁止 delete。\n8. 不得使用公版物種候選值補成玩家個體實際食材或副技能。\n9. 若畫面只顯示部分食材槽／副技能槽，建立 profile_audit_confirmations，status=user_confirmed_not_visible、confirmed_by_user=false，等待用戶在更新中心確認。`;
const base=`你是 Pokémon Sleep AI Manager 的資料轉換器。${auditRules}`;
const wrap=(title,rules,entities,exampleData={},scenario)=>{
  if(!scenario)throw new Error(`Update Package v1.1 Prompt 缺少 scenario：${title}`);
  const rootContract=buildUpdatePackageRootInstruction({scenario,weekly:scenario==='weekly_context_update'});
  return {title,prompt:`${base}\n\n情境：${title}\n${rules}\n允許 entity：${entities.join('、')}。${rootContract}`,entities,contract:'update-package-v1.1',exampleData,scenario};
};
const weeklyRules=`使用 scenario=weekly_context_update。這是玩家當週狀態，不是公版 Master；也是「玩家本週環境」的唯一匯入來源。套用後由本週環境頁統一解析，再供戰情室、食譜與策略引擎使用；不要直接輸出戰情室或食譜建議。外部 AI 是否真的建立附件由該介面能力決定；若沒有附件，直接輸出 raw JSON 就是正確完成方式，不要額外加入說明文字。\n
Weekly Context JSON 規則：\n1. operations 必須只有 1 筆，entity=weekly_context、action=upsert。\n2. week_start 使用當週星期一 YYYY-MM-DD；key.context_id 固定為 weekly_context_<week_start>_import，例如 weekly_context_2026-08-10_import。data.week_start 必須與 key 中日期一致。\n3. payload 頂層 scenario=weekly_context_update，context_authority=UPDATE_CENTER_JSON。generated_at 與 data.updated_at 使用產生此更新包時的有效 ISO 日期時間。\n4. data.dish_category 必須正規化為且只能使用「咖哩／濃湯」「沙拉」「甜點／飲料」之一。若遊戲畫面寫「咖哩、濃湯」仍輸出「咖哩／濃湯」；若寫「點心、飲料」或「點心／飲料」則輸出「甜點／飲料」。\n5. 只整理本週可觀測事實：實際營地 camp、料理類型 dish_category、活動名稱 event_name，以及活動效果 event_effects。不得從上週資料或一般遊戲常識補值。玩家基礎鍋子容量不屬於 Weekly Context；營地／活動截圖不得輸出 data.pot_size。基礎鍋子容量由料理／食譜畫面或專用容量畫面更新 account_capacity.pot；本週活動若有鍋子倍率／加成，只記在 event_effects。\n6. event_effects 必須直接輸出為 JSON object，不要把 JSON 再包成字串。已知欄位只能使用：event_schema、event_start、event_end、mission_start、mission_end、event_camp_scope、meal_category_forced、recipe_final_energy_multiplier、extra_tasty_multiplier、sunday_extra_tasty_multiplier、sunday_pot_multiplier、new_recipe_count、cross_sleep_type_encounters、encounter_type_boosts、boosted_pokemon_types、shiny_encounter_possible、limited_feature、sunday_pot_multiplier_source、unknown_effects。不要自行創造新的 root key。\n7. event_effects 欄位型別必須嚴格遵守：meal_category_forced、cross_sleep_type_encounters、shiny_encounter_possible 只能是 boolean；recipe_final_energy_multiplier、extra_tasty_multiplier、sunday_extra_tasty_multiplier、sunday_pot_multiplier 必須是大於 0 的 number；new_recipe_count 是 0 以上 integer；encounter_type_boosts、boosted_pokemon_types 是非空字串陣列；event_schema、event_camp_scope、limited_feature、sunday_pot_multiplier_source 是非空字串；event_start、event_end、mission_start、mission_end 使用 YYYY-MM-DD 或有效 ISO 日期時間。meal_category_forced 只表示「活動是否強制料理類型」，料理名稱只能放在 data.dish_category。正確例：「meal_category_forced\": true」；錯誤例：「meal_category_forced\": \"咖哩／濃湯\"」。\n8. 若活動畫面明確存在一項效果，但無法無歧義對應上述已知欄位，不要猜成倍率、機率或其他既有 key；改放 event_effects.unknown_effects 陣列。每筆至少包含 source_text，逐字保留活動原文；可加 source_image_ref 與 observed_value。unknown_effects 出現時 operation.review_required 必須為 true，等待更新中心人工確認。不要輸出 rule_status，規則狀態由平台 Registry 決定。例：\"unknown_effects\":[{\"source_text\":\"活動畫面原文\",\"source_image_ref\":\"image-002\"}]。\n9. limited_feature 必須逐字抄錄畫面名稱，不得把「扭糖機」自行改寫成「扭蛋機」等近義詞；看不清楚就省略。\n10. sunday_pot_multiplier 只有截圖／使用者本次資料明確證實時才輸出；不得因一般週日規則自行填 2，也不得把倍率換算後的暫時容量寫回基礎 pot capacity。\n11. 固定三樹果營地可省略 favorite_berry_1~3，由平台公版 Camp Berry Master 自動投影。萌綠之島一般模式與 EX 動態營地：只有本週畫面實際看見全部三種喜好樹果時才一次填滿 favorite_berry_1~3；若任一名稱看不清楚或只看見 0~2 種，三欄全部省略／null。樹果名稱必須逐字依畫面文字，不得用相似字猜測；不得沿用上週。\n12. 活動若寫「所有營地」，可在 event_effects.event_camp_scope 輸出 ALL_CAMPS；若寫不論睡眠類型都能遇見其他睡眠類型，可輸出 cross_sleep_type_encounters=true；若明確列出提升出現機率的寶可夢屬性，可輸出 boosted_pokemon_types 字串陣列。\n13. base_notes 只記錄使用者明確提供且會影響本週策略的假設；遊戲公告事實應放在對應正式欄位或 event_effects，不要把未證實內容塞入 base_notes。\n14. evidence.source_image_ref 必須指向本次判讀的主要截圖；若多張圖共同支持，可另外輸出 evidence.source_image_refs 陣列。confidence 只反映本次辨識信心；名稱若有不確定，不可一邊猜測一邊給 0.98/0.99。\n15. 不得寫入任何公版 Master、料理解鎖、寶可夢個體、庫存或隊伍資料。`;
const candyRules=`使用 scenario=candy_inventory_update。只整理畫面中可直接辨識的糖果名稱與實際持有數量。\nCandy JSON 規則：\n1. 每筆 operation 必須 entity=candy_inventory、action=upsert。\n2. key 優先使用畫面原文 candy_name；若平台已提供 candy_id 才可原樣使用 candy_id，不得由 AI 自造 stable ID。\n3. data.quantity 只代表玩家目前實際持有量，必須是 0 以上整數。未出現的糖果不得補 0。\n4. data.safe_reserve 只有使用者本次明確提供保留量時才輸出；單純庫存截圖看不到保留策略時省略/null。\n5. 「○○的糖果」名稱必須逐字依畫面抄錄；不得因你知道某個寶可夢名稱就自行補一筆不存在於畫面的糖果。平台會用公版 Pokémon 名稱解析糖果 identity。\n6. 萬能糖果、屬性糖果、寶可夢糖果的轉換結果都不是實體庫存，不得輸出推算後數量；只輸出畫面實際持有的糖果。\n7. 名稱模糊或無法確定對應寶可夢時 review_required=true，不得自行正名。\n8. 此情境不得輸出 item_inventory、pokemon 或任何公版 Master operation。`;

export const PROMPT_CATALOG={
  pokemon:{
    title:'寶可夢盒／個體能力觀察',
    prompt:`${AI_OBSERVATION_PROMPT}\n\n更新中心補充規則：\n- Observation v2 只記錄畫面事實，空值不覆蓋既有資料。\n- 未顯示的食材槽或副技能槽不得補猜；在 observation.audit_candidates 中標記 status=user_confirmed_not_visible、confirmed_by_user=false。\n- AI 不得建立永久個體 ID；平台匯入時才判定既有成員、升級、更名、進化或新成員。`,
    entities:['pokemon_observation'],contract:'observation-v2',scenario:'pokemon_profile_update'
  },
  ingredients:wrap('食材庫存更新','使用 scenario=ingredient_inventory_update。只更新截圖中可辨識的食材；未出現項目不得設為 0。畫面明確顯示數量 0 時 quantity=0 必須保留；空白或看不清楚填 null，平台保留既有值。每筆 ingredient_inventory operation 的 key.ingredient_name 必須逐字使用畫面顯示的繁體中文食材名稱；不得自行建立 ingredient_id、英文 slug 或其他 stable ID。若畫面同時顯示食材包容量，account_capacity operation 使用 key.capacity_key=ingredient_bag。',['ingredient_inventory','account_capacity'],{quantity:null},'ingredient_inventory_update'),
  items:wrap('道具包更新','使用 scenario=item_inventory_update。只更新截圖中可辨識的道具；quantity=0 與 safe_reserve=0 都是有效值。可輸出 recommendation；空白欄位填 null，不得清除既有建議。',['item_inventory','account_capacity'],{quantity:null,safe_reserve:null,recommendation:null},'item_inventory_update'),
  candies:wrap('糖果庫存更新',candyRules,['candy_inventory'],{quantity:null,safe_reserve:null},'candy_inventory_update'),
  recipes:wrap('食譜解鎖／等級／能量更新','使用 scenario=recipe_status_update。逐道料理只更新玩家狀態：unlocked、recipe_level、current_energy。unlocked=false、recipe_level=0、current_energy=0 都是有效值；未出現料理不改狀態。key 優先使用 recipe_id，不知道時可使用公版 recipe_name 由平台解析。若料理／食譜畫面右上角明確顯示玩家基礎鍋子「容量：N個」，可同包更新 account_capacity，key.capacity_key=pot、data.total_capacity=N；不可把活動倍率或料理所需食材總數當作基礎容量。',['recipes','account_capacity'],{unlocked:null,recipe_level:null,current_energy:null},'recipe_status_update'),
  capacity:wrap('帳號容量更新','使用 scenario=capacity。辨識鍋子、食材包、道具包與寶可夢盒容量；capacity_key 僅用 pot、ingredient_bag、item_bag、pokemon_box。鍋子基礎容量優先取料理鍋「食譜一覽」或製作餐點的料理清單右上角明確顯示的「容量：N個」；不得從活動倍率、週日加成或料理需求反推。無法確認的容量填 null。',['account_capacity'],{total_capacity:null,used_count:null},'capacity'),
  discard:wrap('送博士紀錄','使用 scenario=discard。只有使用者明確確認送博士時才輸出；entity=discarded_pokemon、action=discarded，不可同時新增 pokemon。若畫面不能確認送博士，不得輸出操作。',['discarded_pokemon'],{},'discard'),
  weekly:wrap(
    '本週營地／料理／活動 Context',
    weeklyRules,
    ['weekly_context'],
    {week_start:null,camp:null,dish_category:null,favorite_berry_1:null,favorite_berry_2:null,favorite_berry_3:null,event_name:null,event_effects:{},base_notes:null,updated_at:null},
    'weekly_context_update',
  ),
};

function templateKey(entity,weekStart=null){
  return {
    discarded_pokemon:{discard_id:'discard_example_001'},
    ingredient_inventory:{ingredient_name:'好眠番茄'},
    item_inventory:{item_name:'寶可沙布蕾'},
    candy_inventory:{candy_name:'萬能糖果S'},
    recipes:{recipe_name:'忍者咖哩'},
    recipe_ingredients:{recipe_id:'recipe_example_001',ingredient_name:'好眠番茄'},
    account_capacity:{capacity_key:'ingredient_bag'},
    weekly_plan:{plan_id:'week_example_current'},
    weekly_context:{context_id:`weekly_context_${weekStart||'YYYY-MM-DD'}_import`},
  }[entity];
}

export function buildScenarioTemplate(key){
  if(key==='pokemon')return buildObservationTemplate();
  const c=PROMPT_CATALOG[key];
  const entity=c.entities[0];
  const generatedAt=new Date().toISOString();
  const weekStart=entity==='weekly_context'?localWeekStart(new Date()):null;
  const data={...c.exampleData};
  if(entity==='weekly_context'){data.week_start=weekStart;data.updated_at=generatedAt;}
  const operation={
    operation_id:'OP-001',
    entity,
    action:entity==='discarded_pokemon'?'discarded':'upsert',
    key:templateKey(entity,weekStart),
    data,
    clear_fields:[],
    evidence:{source_type:'screenshot',source_image_ref:'image-001',source_image_refs:['image-001'],confidence:0.95},
    review_required:true,
    user_audit:{accepted_current_observation:false},
  };
  return buildUpdatePackageEnvelope({
    scenario:c.scenario,
    generatedAt,
    operations:[operation],
    contextAuthority:entity==='weekly_context'?'UPDATE_CENTER_JSON':null,
    updateIdSuffix:'EXAMPLE',
  });
}
