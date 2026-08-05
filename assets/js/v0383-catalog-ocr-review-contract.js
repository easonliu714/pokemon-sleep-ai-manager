import {rows,run,persist} from './database.js';

const APP_VERSION='v0.3.83';
const APP_BUILD='20260805-v0383-catalog-ocr-review-contract';
const CATALOG_VERSION='canonical-registry-2026-08-05-v0383';
const RECIPES=[["咖哩／濃湯","特選蘋果咖哩","特選蘋果×7"],["咖哩／濃湯","炙燒尾巴咖哩","美味尾巴×8、火辣香草×25"],["咖哩／濃湯","日照番茄咖哩","好眠番茄×10、火辣香草×5"],["咖哩／濃湯","夢食奶油咖哩","窩心洋芋×18、好眠番茄×15、放鬆可可×12、哞哞鮮奶×10"],["咖哩／濃湯","微辣蔥咖哩","粗枝大蔥×14、暖暖薑×10、火辣香草×8"],["咖哩／濃湯","孢子蘑菇咖哩","品鮮蘑菇×14、窩心洋芋×9"],["咖哩／濃湯","親子愛咖哩","甜甜蜜×12、特選蘋果×11、特選蛋×8、窩心洋芋×4"],["咖哩／濃湯","起司漢堡咖哩","哞哞鮮奶×8、豆製肉×8"],["咖哩／濃湯","柔軟洋芋濃湯","哞哞鮮奶×10、窩心洋芋×8、品鮮蘑菇×4"],["咖哩／濃湯","簡易白醬濃湯","哞哞鮮奶×7"],["咖哩／濃湯","豆肉排咖哩","豆製肉×7"],["咖哩／濃湯","甜甜蜜咖哩","甜甜蜜×7"],["咖哩／濃湯","忍者咖哩","萌綠大豆×24、豆製肉×9、粗枝大蔥×12、品鮮蘑菇×5"],["咖哩／濃湯","乾旱炸肉排咖哩","豆製肉×10、純粹油×5"],["咖哩／濃湯","滑嫩蛋咖哩","特選蛋×10、好眠番茄×6"],["咖哩／濃湯","健美豆子咖哩","萌綠大豆×12、豆製肉×6、火辣香草×4、特選蛋×4"],["咖哩／濃湯","玉米濃湯","萌綠玉米×14、哞哞鮮奶×8、窩心洋芋×8"],["咖哩／濃湯","煉獄玉米乾咖哩","火辣香草×27、豆製肉×24、萌綠玉米×14、暖暖薑×12"],["咖哩／濃湯","暈眩拳辣味咖哩","醒腦咖啡豆×11、火辣香草×11、甜甜蜜×11"],["咖哩／濃湯","覺醒力量元氣濃湯","萌綠大豆×28、好眠番茄×25、品鮮蘑菇×23、醒腦咖啡豆×16"],["咖哩／濃湯","粗切壽喜燒咖哩","粗枝大蔥×27、豆製肉×26、甜甜蜜×26、特選蛋×22"],["咖哩／濃湯","南瓜精角色扮演濃湯","沉甸甸南瓜×10、豆製肉×16、窩心洋芋×18、品鮮蘑菇×25"],["咖哩／濃湯","茂盛酪梨焗烤","特選酪梨×22、窩心洋芋×20、哞哞鮮奶×41、純粹油×32"],["沙拉","尾巴胡椒沙拉","美味尾巴×10、火辣香草×10、純粹油×15"],["沙拉","孢子蘑菇沙拉","品鮮蘑菇×17、好眠番茄×8、純粹油×8"],["沙拉","雪隱凱薩沙拉","哞哞鮮奶×10、豆製肉×6"],["沙拉","貪吃洋芋沙拉","窩心洋芋×14、特選蛋×9、豆製肉×7、特選蘋果×6"],["沙拉","水幕豆腐沙拉","萌綠大豆×15、好眠番茄×9"],["沙拉","怪力極限沙拉","豆製肉×9、暖暖薑×6、特選蛋×5、窩心洋芋×3"],["沙拉","豆火腿沙拉","豆製肉×8"],["沙拉","好眠番茄沙拉","好眠番茄×8"],["沙拉","哞哞卡布里沙拉","哞哞鮮奶×12、好眠番茄×6、純粹油×5"],["沙拉","唱反調巧克力肉沙拉","放鬆可可×14、豆製肉×9"],["沙拉","過熱薑沙拉","火辣香草×17、暖暖薑×10、好眠番茄×8"],["沙拉","特選蘋果沙拉","特選蘋果×8"],["沙拉","免疫蔥沙拉","粗枝大蔥×10、暖暖薑×5"],["沙拉","璀璨蘋果起司沙拉","特選蘋果×15、哞哞鮮奶×5、純粹油×3"],["沙拉","忍者沙拉","粗枝大蔥×15、萌綠大豆×19、品鮮蘑菇×12、暖暖薑×11"],["沙拉","熱浪豆腐沙拉","萌綠大豆×10、火辣香草×6"],["沙拉","萌綠沙拉","純粹油×22、萌綠玉米×17、好眠番茄×14、窩心洋芋×9"],["沙拉","冥想水果沙拉","特選蘋果×21、甜甜蜜×16、萌綠玉米×12"],["沙拉","亂擊玉米沙拉","萌綠玉米×9、純粹油×8"],["沙拉","十字劈沙拉","特選蛋×20、豆製肉×15、萌綠玉米×11、好眠番茄×10"],["沙拉","不服輸咖啡醬沙拉","醒腦咖啡豆×28、豆製肉×28、純粹油×22、窩心洋芋×22"],["沙拉","花瓣舞層層沙拉","特選蛋×25、純粹油×17、窩心洋芋×15、豆製肉×12"],["沙拉","蘋果酸優格沙拉","特選蛋×35、特選蘋果×28、好眠番茄×23、哞哞鮮奶×18"],["沙拉","濃郁酪梨沙拉","特選酪梨×14、萌綠大豆×18、純粹油×10"],["沙拉","重踏酪梨醬玉米片","特選酪梨×28、萌綠玉米×25、火辣香草×30、萌綠大豆×22"],["沙拉","熱水粗切沙拉","沉甸甸南瓜×20、窩心洋芋×30、萌綠玉米×18、品鮮蘑菇×27"],["甜點／飲料","綿綿地瓜","窩心洋芋×9、哞哞鮮奶×5"],["甜點／飲料","不屈薑餅","甜甜蜜×14、暖暖薑×12、放鬆可可×5、特選蛋×4"],["甜點／飲料","特選蘋果汁","特選蘋果×8"],["甜點／飲料","手工汽水","甜甜蜜×9"],["甜點／飲料","火焰薑茶","暖暖薑×9、特選蘋果×7"],["甜點／飲料","胖丁百匯布丁","甜甜蜜×20、特選蛋×15、哞哞鮮奶×10、特選蘋果×10"],["甜點／飲料","甜蜜之吻冰沙","特選蘋果×11、哞哞鮮奶×9、甜甜蜜×7、放鬆可可×8"],["甜點／飲料","幸運吟唱蘋果派","特選蘋果×12、哞哞鮮奶×4"],["甜點／飲料","涅槃療癒茶","暖暖薑×11、特選蘋果×15、品鮮蘑菇×9"],["甜點／飲料","甜甜香氣巧克力蛋糕","甜甜蜜×9、放鬆可可×8、哞哞鮮奶×7"],["甜點／飲料","溫熱哞哞鮮奶","哞哞鮮奶×7"],["甜點／飲料","青雲豆香蛋糕","特選蛋×8、萌綠大豆×7"],["甜點／飲料","活力蛋白冰沙","萌綠大豆×15、放鬆可可×8"],["甜點／飲料","堅毅蔬菜汁","好眠番茄×9、特選蘋果×7"],["甜點／飲料","大馬拉薩達","純粹油×10、哞哞鮮奶×7、甜甜蜜×6"],["甜點／飲料","大力士豆香甜甜圈","純粹油×12、萌綠大豆×16、放鬆可可×7"],["甜點／飲料","爆炸爆米花","萌綠玉米×15、純粹油×14、哞哞鮮奶×7"],["甜點／飲料","茶會玉米司康","特選蘋果×20、暖暖薑×20、萌綠玉米×18、哞哞鮮奶×9"],["甜點／飲料","花瓣舞巧克力塔","特選蘋果×11、放鬆可可×11"],["甜點／飲料","鮮花禮物馬卡龍","放鬆可可×25、特選蛋×25、甜甜蜜×17、哞哞鮮奶×10"],["甜點／飲料","早起咖啡凍","醒腦咖啡豆×16、哞哞鮮奶×14、甜甜蜜×12"],["甜點／飲料","電光香料可樂","特選蘋果×35、暖暖薑×20、粗枝大蔥×20、醒腦咖啡豆×12"],["甜點／飲料","破格玉米提拉米蘇","醒腦咖啡豆×14、萌綠玉米×14、哞哞鮮奶×12"],["甜點／飲料","土王閃電泡芙","放鬆可可×30、哞哞鮮奶×26、醒腦咖啡豆×24、甜甜蜜×22"],["甜點／飲料","鬼面鬆餅","沉甸甸南瓜×18、特選蛋×24、甜甜蜜×32、好眠番茄×29"],["甜點／飲料","飛葉風暴冰沙","特選酪梨×18、好眠番茄×16、哞哞鮮奶×14"],["甜點／飲料","採蜜巧克力鬆餅","甜甜蜜×38、萌綠玉米×28、純粹油×28、放鬆可可×21"]];

const trace=(event,details={},status='completed',error=null)=>{
  globalThis.UpdateCenterLiveDebug?.record?.(event,details);
  globalThis.DebugTrace?.record?.('v0383_contract',event,{status,details,error});
};
const slug=value=>'recipe_public_'+Array.from(new TextEncoder().encode(value)).reduce((h,b)=>((h*33)^b)>>>0,5381).toString(16).padStart(8,'0');
const parseIngredients=summary=>String(summary||'').split('、').map(part=>{
  const match=part.match(/^(.*)×(\d+)$/);
  return match?{name:match[1].trim(),quantity:Number(match[2])}:null;
}).filter(Boolean);

function databaseReady(){try{return Number(rows('SELECT COUNT(*) AS count FROM schema_migrations')[0]?.count||0)>0;}catch{return false;}}

async function applyRecipeCatalog(){
  if(!databaseReady())throw new Error('database_not_ready');
  run('DROP VIEW IF EXISTS item_catalog_state');
  run(`CREATE VIEW item_catalog_state AS
    SELECT m.item_name,m.item_category,m.effect_description_zh_tw,m.effect_source_type,m.effect_source_ref,
           COALESCE(i.quantity,0) AS quantity,COALESCE(i.safe_reserve,0) AS safe_reserve,i.recommendation,
           CASE WHEN i.item_name IS NULL THEN 0 ELSE 1 END AS player_record_exists,i.updated_at,m.data_version
      FROM item_master m LEFT JOIN item_inventory i ON i.item_name=m.item_name`);
  run('DROP VIEW IF EXISTS recipe_catalog_state');
  run(`CREATE VIEW recipe_catalog_state AS
    SELECT m.recipe_id,m.category,m.recipe_name,m.base_energy,m.total_ingredients,
           COALESCE((SELECT r.unlocked FROM recipes r WHERE r.recipe_id=m.recipe_id OR r.recipe_name=m.recipe_name ORDER BY CASE WHEN r.recipe_id=m.recipe_id THEN 0 ELSE 1 END LIMIT 1),0) AS unlocked,
           COALESCE((SELECT r.recipe_level FROM recipes r WHERE r.recipe_id=m.recipe_id OR r.recipe_name=m.recipe_name ORDER BY CASE WHEN r.recipe_id=m.recipe_id THEN 0 ELSE 1 END LIMIT 1),1) AS recipe_level,
           (SELECT r.current_energy FROM recipes r WHERE r.recipe_id=m.recipe_id OR r.recipe_name=m.recipe_name ORDER BY CASE WHEN r.recipe_id=m.recipe_id THEN 0 ELSE 1 END LIMIT 1) AS current_energy,
           (SELECT r.updated_at FROM recipes r WHERE r.recipe_id=m.recipe_id OR r.recipe_name=m.recipe_name ORDER BY CASE WHEN r.recipe_id=m.recipe_id THEN 0 ELSE 1 END LIMIT 1) AS updated_at,
           (SELECT r.notes FROM recipes r WHERE r.recipe_id=m.recipe_id OR r.recipe_name=m.recipe_name ORDER BY CASE WHEN r.recipe_id=m.recipe_id THEN 0 ELSE 1 END LIMIT 1) AS notes,
           CASE WHEN EXISTS(SELECT 1 FROM recipes r WHERE r.recipe_id=m.recipe_id OR r.recipe_name=m.recipe_name) THEN 1 ELSE 0 END AS player_record_exists,
           m.data_version
      FROM recipe_master m
    UNION ALL
    SELECT r.recipe_id,r.category,r.recipe_name,NULL,
           COALESCE(r.total_ingredients,0),COALESCE(r.unlocked,0),COALESCE(r.recipe_level,1),
           r.current_energy,r.updated_at,r.notes,1,'PLAYER_ONLY'
      FROM recipes r
     WHERE NOT EXISTS(SELECT 1 FROM recipe_master m WHERE m.recipe_id=r.recipe_id OR m.recipe_name=r.recipe_name)`);

  for(const [category,name,summary] of RECIPES){
    const ingredients=parseIngredients(summary);
    const total=ingredients.reduce((sum,row)=>sum+row.quantity,0);
    const id=slug(name);
    run(`INSERT INTO recipe_master(recipe_id,category,recipe_name,base_energy,total_ingredients,source_type,source_name,source_ref,verified_at,data_version)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(recipe_name) DO UPDATE SET
        category=excluded.category,
        total_ingredients=excluded.total_ingredients,
        source_type=excluded.source_type,
        source_name=excluded.source_name,
        source_ref=excluded.source_ref,
        verified_at=excluded.verified_at,
        data_version=excluded.data_version`,
      [id,category,name,null,total,'mixed_evidence','玩家提供食譜清單＋結構化參考','user-provided-recipe-workbook-and-structured-reference','2026-08-05',CATALOG_VERSION]);
    const actual=rows('SELECT recipe_id FROM recipe_master WHERE recipe_name=?',[name])[0]?.recipe_id||id;
    run('DELETE FROM recipe_master_ingredients WHERE recipe_id=?',[actual]);
    for(const item of ingredients){run(`INSERT OR IGNORE INTO ingredient_master(ingredient_name,source_type,source_name,source_ref,verified_at,data_version) VALUES(?,?,?,?,?,?)`,[item.name,'mixed_evidence','v0.3.84 recipe catalog recovery','v0384-recipe-evidence','2026-08-05',CATALOG_VERSION]);run('INSERT OR REPLACE INTO recipe_master_ingredients(recipe_id,ingredient_name,quantity) VALUES(?,?,?)',[actual,item.name,item.quantity]);}
  }
  run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('v0383_recipe_catalog_contract',?,datetime('now'))`,
    [JSON.stringify({catalog_version:CATALOG_VERSION,recipe_count:RECIPES.length,public_default_unlocked:false,public_default_level:1,player_state_write:false})]);
  await persist();
  globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:catalog-updated',{detail:{version:CATALOG_VERSION,recipe_count:RECIPES.length}}));
  trace('recipe_catalog_completed',{recipe_count:RECIPES.length,public_default_unlocked:false,public_default_level:1});
}

function isDuplicateOnlySelection(root){
  const selected=[...root.querySelectorAll('[data-unified-item]:checked')];
  return selected.length>0&&selected.every(box=>box.closest('.light-review-item')?.textContent?.includes('狀態：duplicate'));
}
function installOcrTerminalPatch(){
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#unifiedRun');
    if(!button)return;
    const root=document.getElementById('unifiedImportAnalysisWorkbench');
    const strategy=root?.querySelector('#unifiedStrategy');
    if(!root||!strategy)return;
    if(strategy.value==='ocr_ai'&&isDuplicateOnlySelection(root)){
      strategy.value='ai_only';
      root.querySelector('#unifiedStatus').textContent='所選圖片皆為重複圖片：沿用既有 OCR Revision，直接重新執行 AI 與人工覆核。需要強制 OCR 時請選「只重新 OCR」。';
      trace('duplicate_only_terminal_fast_path',{selected_count:root.querySelectorAll('[data-unified-item]:checked').length});
    }
  },true);
}

function canonical(entityType,raw){
  const value=String(raw||'').trim();
  if(!value)return {raw:value,canonical:'',status:'EMPTY'};
  const exact=rows('SELECT canonical_name_zh_tw FROM canonical_term WHERE entity_type=? AND canonical_name_zh_tw=? AND is_active=1',[entityType,value])[0];
  if(exact)return {raw:value,canonical:exact.canonical_name_zh_tw,status:'CANONICAL_EXACT'};
  const alias=rows(`SELECT t.canonical_name_zh_tw,a.is_auto_replace_safe FROM canonical_term_alias a JOIN canonical_term t ON t.term_id=a.term_id WHERE t.entity_type=? AND a.alias_text=? AND a.locale='zh-Hant' AND t.is_active=1`,[entityType,value])[0];
  if(alias)return {raw:value,canonical:alias.canonical_name_zh_tw,status:Number(alias.is_auto_replace_safe)===1?'CANONICAL_ALIAS_SAFE':'CANONICAL_ALIAS_REVIEW'};
  return {raw:value,canonical:'',status:'CANONICAL_UNKNOWN'};
}
function analysisPayload(row){
  try{const parsed=JSON.parse(row?.result_json||'null');return parsed?.analysis??parsed??{};}catch{return {};}
}
function mergeAiObservations(anchor){
  const candidates=rows(`SELECT * FROM image_analysis_revision WHERE analysis_type='ai' ORDER BY created_at DESC LIMIT 12`).map(row=>({row,data:analysisPayload(row)}));
  const name=anchor?.pokemon_name,level=Number(anchor?.level);
  const matched=candidates.filter(x=>(!name||x.data?.pokemon_name===name)&&(!Number.isFinite(level)||Number(x.data?.level)===level));
  const merged={...anchor};
  const pick=(path)=>{
    for(const x of matched){
      let value=x.data;for(const key of path)value=value?.[key];
      if(value!==null&&value!==undefined&&value!=='')return value;
    }return null;
  };
  for(const key of ['nickname','specialty','type','helper_seconds','carry_limit','favorite_berry','sleep_hours','sleep_time_text','obtained_at','confidence'])if(merged[key]==null||merged[key]==='')merged[key]=pick([key]);
  merged.main_skill=merged.main_skill?.name?merged.main_skill:pick(['main_skill'])||merged.main_skill;
  merged.nature=merged.nature?.name?merged.nature:pick(['nature'])||merged.nature;
  const levels=[1,30,60];
  merged.ingredients=levels.map(level=>{
    for(const x of matched){
      const row=(x.data?.ingredients||[]).find(item=>Number(item.level??item.unlock_level)===level&&String(item.name??item.ingredient_name??'').trim());
      if(row)return row;
    }return (anchor?.ingredients||[]).find(item=>Number(item.level??item.unlock_level)===level)||{level,name:null,count:null};
  });
  return merged;
}
function applyReviewProjection(detail){
  if(detail?.analysis_type!=='ai')return;
  const payload=mergeAiObservations(analysisPayload({result_json:JSON.stringify(detail.result)}));
  setTimeout(()=>{
    const root=document.getElementById('analysisConfirmationWorkbench');if(!root)return;
    const set=(name,value)=>{const input=root.querySelector(`[data-field="${name}"]`);if(input&&(input.value===''||input.value==null)&&value!==null&&value!==undefined)input.value=value;};
    set('species',payload.pokemon_name);set('nickname',payload.nickname);set('level',payload.level);set('sp',payload.sp);set('specialty',payload.specialty);set('type',payload.type);
    set('main_skill',payload.main_skill?.name);set('main_skill_level',payload.main_skill?.level);set('main_skill_description',payload.main_skill?.description);
    set('nature',payload.nature?.name);set('nature_bonus',payload.nature?.up);set('nature_penalty',payload.nature?.down);
    set('helper_seconds',payload.helper_seconds);set('carry_limit',payload.carry_limit);set('favorite_berry',payload.favorite_berry);set('sleep_hours',payload.sleep_hours);set('sleep_time_text',payload.sleep_time_text);set('obtained_at',payload.obtained_at);set('confidence',payload.confidence);
    for(const row of payload.ingredients||[]){
      const level=Number(row.level??row.unlock_level);const raw=String(row.name??row.ingredient_name??'').trim();if(![1,30,60].includes(level)||!raw)continue;
      const input=root.querySelector(`[data-field="ingredient_name_${level}"]`),qty=root.querySelector(`[data-field="ingredient_qty_${level}"]`);
      if(input&&!input.value)input.value=raw;if(qty&&!qty.value&&row.count!=null)qty.value=row.count;
      const result=canonical('ingredient',raw);const item=input?.closest('.skill-item');
      const badge=item?.querySelector('.badge');if(badge)badge.textContent=result.status;
      const notice=item?.querySelector('.notice');if(notice)notice.innerHTML=`原始：${raw}<br>正式：${result.canonical||'尚未確認'}`;
    }
    trace('full_review_projection_applied',{ingredient_rows:(payload.ingredients||[]).filter(row=>row.name).length});
  },50);
}

function installServiceWorkerScopeRepair(){
  if(!('serviceWorker' in navigator))return;
  const script=new URL('../../service-worker.js',import.meta.url);
  const scope=new URL('../../',import.meta.url).pathname;
  navigator.serviceWorker.register(script,{scope,updateViaCache:'none'})
    .then(reg=>{reg?.update?.();trace('service_worker_scope_repaired',{scope:reg?.scope||scope,script:script.href});})
    .catch(error=>trace('service_worker_scope_repair_failed',{message:error?.message||String(error)},'failed',error));
}

let initialized=false,retryCount=0,retryTimer=null;
async function initialize(){
  if(initialized)return;
  if(!databaseReady()){
    retryCount+=1;trace('database_ready_wait',{retry_count:retryCount});
    clearTimeout(retryTimer);retryTimer=setTimeout(initialize,Math.min(2500,150+retryCount*100));return;
  }
  try{
    await applyRecipeCatalog();initialized=true;installOcrTerminalPatch();installServiceWorkerScopeRepair();
    globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>applyReviewProjection(event.detail));
    trace('v0384_database_catalog_recovery_ready',{version:'v0.3.84',build:'20260805-v0384-database-catalog-recovery',retry_count:retryCount});
  }catch(error){trace('recipe_catalog_retryable_failed',{message:error?.message||String(error),retry_count:retryCount},'failed',error);clearTimeout(retryTimer);retryTimer=setTimeout(initialize,1000);}
}
initialize();globalThis.addEventListener('pokemon-sleep:database-ready',initialize);
export {applyRecipeCatalog,mergeAiObservations};
