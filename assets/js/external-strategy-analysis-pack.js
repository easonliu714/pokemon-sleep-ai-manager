export const STRATEGY_ANALYSIS_PACK_VERSION='strategy-analysis-pack-2026-08-10-c';
export const STRATEGY_ANALYSIS_PROMPT_VERSION='strategy-analysis-prompt-2026-08-10-c';
export const STRATEGY_ANALYSIS_SHARING_NOTICE_VERSION='strategy-analysis-sharing-notice-2026-08-10-a';

const text=value=>String(value??'').normalize('NFKC').trim();
const number=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const stableJson=value=>JSON.stringify(stable(value));
const hash=value=>{let h=2166136261;for(const byte of new TextEncoder().encode(String(value))){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');};
const unique=value=>[...new Set((Array.isArray(value)?value:[]).map(text).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));

function candidateStableId(row){return text(row?.pokemon_id||row?.pokemon_instance_id);}
function candidateSpecies(row){return text(row?.species||row?.current_species)||null;}
function sortCandidates(rows=[]){return [...rows].filter(row=>candidateStableId(row)).sort((a,b)=>candidateStableId(a).localeCompare(candidateStableId(b)));}

export function buildEphemeralCandidateResolver(candidates=[]){
  const sorted=sortCandidates(candidates),stableToRef=new Map(),refToStable=new Map();
  sorted.forEach((row,index)=>{
    const stableId=candidateStableId(row),ref=`cand_${String(index+1).padStart(3,'0')}`;
    stableToRef.set(stableId,ref);refToStable.set(ref,stableId);
  });
  return Object.freeze({stable_to_ref:stableToRef,ref_to_stable:refToStable,count:sorted.length});
}

function replaceStableIds(value,resolver){
  if(typeof value==='string'){
    let output=value;
    for(const [stableId,ref] of resolver?.stable_to_ref?.entries?.()||[])if(stableId)output=output.split(stableId).join(ref);
    return output;
  }
  if(Array.isArray(value))return value.map(item=>replaceStableIds(item,resolver));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,replaceStableIds(item,resolver)]));
  return value;
}
function safeStrings(values,resolver){return unique((Array.isArray(values)?values:[]).map(value=>replaceStableIds(text(value),resolver)));}
function collectStablePokemonIds(value,out=new Set()){
  if(Array.isArray(value)){for(const item of value)collectStablePokemonIds(item,out);return out;}
  if(!value||typeof value!=='object')return out;
  for(const [key,item] of Object.entries(value)){
    if((key==='pokemon_id'||key==='pokemon_instance_id')&&text(item))out.add(text(item));
    collectStablePokemonIds(item,out);
  }
  return out;
}
function collectCandidateRefs(value,out=new Set()){
  if(typeof value==='string'){for(const ref of value.match(/cand_\d+/g)||[])out.add(ref);return out;}
  if(Array.isArray(value)){for(const item of value)collectCandidateRefs(item,out);return out;}
  if(value&&typeof value==='object')for(const item of Object.values(value))collectCandidateRefs(item,out);
  return out;
}

function sanitizeCandidate(row,ref,resolver){
  return Object.freeze({
    candidate_ref:ref,
    species:candidateSpecies(row),
    level:number(row?.level),
    specialty:text(row?.specialty)||null,
    type:text(row?.type)||null,
    hard_constraint_status:text(row?.hard_constraint_status)||'REVIEW',
    current_readiness_score:number(row?.current_readiness_score),
    favorite_berry_match:row?.favorite_berry_match===true?true:row?.favorite_berry_match===false?false:null,
    weekly_ingredient_overlap:Object.freeze(unique(row?.weekly_ingredient_overlap)),
    weekly_ingredient_demand_covered:number(row?.weekly_ingredient_demand_covered),
    profile_completeness:number(row?.profile_completeness?.ratio),
    missing_inputs:Object.freeze(safeStrings(row?.missing_inputs,resolver)),
    failed_constraints:Object.freeze(safeStrings(row?.failed_constraints,resolver)),
    reasons:Object.freeze(safeStrings(row?.reasons,resolver)),
  });
}

function sanitizeTeam(team,resolver){
  if(!team)return null;
  const slots=(team.slots||[]).map(slot=>{
    const stableId=text(slot?.pokemon_id||slot?.pokemon_instance_id),candidateRef=resolver.stable_to_ref.get(stableId)||null;
    return Object.freeze({
      slot_index:Number(slot?.slot_index||0),is_leader:Boolean(slot?.is_leader),candidate_ref:candidateRef,
      species:text(slot?.species)||null,level:number(slot?.level),specialty:text(slot?.specialty)||null,
      hard_constraint_status:text(slot?.hard_constraint_status)||'REVIEW',current_readiness_score:number(slot?.current_readiness_score),
      favorite_berry_match:slot?.favorite_berry_match===true?true:slot?.favorite_berry_match===false?false:null,
      weekly_ingredient_overlap:Object.freeze(unique(slot?.weekly_ingredient_overlap)),
      reasons:Object.freeze(safeStrings(slot?.reasons,resolver)),
    });
  });
  return Object.freeze({
    team_status:text(team.team_status)||null,
    slots:Object.freeze(slots),
    satisfied_constraints:Object.freeze(safeStrings(team.satisfied_constraints,resolver)),
    missing_constraints:Object.freeze(safeStrings(team.missing_constraints,resolver)),
    warnings:Object.freeze(safeStrings(team.warnings,resolver)),
    recipe_coverage:stable(replaceStableIds(team.recipe_coverage||{},resolver)),
    estimated_energy:null,
  });
}

function relevantIngredientNames({recipeStrategy,recipeDiscovery,teamOptimization}={}){
  const names=new Set();
  for(const recipe of recipeStrategy?.candidates||[])for(const req of recipe.requirements||[])if(text(req.ingredient_name))names.add(text(req.ingredient_name));
  for(const row of recipeDiscovery?.stockpile||[])if(text(row.ingredient_name))names.add(text(row.ingredient_name));
  for(const slot of teamOptimization?.primary?.slots||[])for(const name of slot.weekly_ingredient_overlap||[])if(text(name))names.add(text(name));
  return names;
}

function sanitizeResources(resourceSnapshot,{recipeStrategy,recipeDiscovery,teamOptimization}={}){
  const ingredientNames=relevantIngredientNames({recipeStrategy,recipeDiscovery,teamOptimization});
  const ingredientSource=Array.isArray(resourceSnapshot?.ingredients)?resourceSnapshot.ingredients:[];
  const itemSource=Array.isArray(resourceSnapshot?.items)?resourceSnapshot.items:[];
  const candySource=Array.isArray(resourceSnapshot?.candies)?resourceSnapshot.candies:[];
  const ingredients=ingredientSource.filter(row=>ingredientNames.size===0?Boolean(row.player_record_exists)||Number(row.quantity||0)>0:ingredientNames.has(text(row.ingredient_name))).map(row=>Object.freeze({
    ingredient_name:text(row.ingredient_name),quantity:Number(row.quantity||0),available:Number(row.available??row.quantity??0),
  }));
  const items=itemSource.filter(row=>Boolean(row.player_record_exists)||Number(row.quantity||0)>0||Number(row.safe_reserve||0)>0).map(row=>Object.freeze({
    item_name:text(row.item_name),item_category:text(row.item_category)||null,quantity:Number(row.quantity||0),safe_reserve:Number(row.safe_reserve||0),available:Number(row.available||0),
  }));
  const candies=candySource.filter(row=>Boolean(row.player_record_exists)||Number(row.quantity||0)>0||Number(row.safe_reserve||0)>0).map(row=>Object.freeze({
    candy_name:text(row.candy_name),candy_type:text(row.candy_type)||null,target_species_name:text(row.target_species_name)||null,target_type_name:text(row.target_type_name)||null,
    quantity:Number(row.quantity||0),safe_reserve:Number(row.safe_reserve||0),available:Number(row.available||0),
  }));
  return Object.freeze({
    resource_context_version:text(resourceSnapshot?.version)||null,
    resource_status:text(resourceSnapshot?.status)||null,
    ingredients:Object.freeze(ingredients),items:Object.freeze(items),candies:Object.freeze(candies),
    candy_conversion:Object.freeze({
      rule_status:text(resourceSnapshot?.candy_conversion?.rule_status)||'NOT_YET_VERIFIED',
      derived_options:Object.freeze([]),included_in_physical_totals:false,
    }),
  });
}

function sanitizeWeeklyContext(weeklyContext={}){
  return Object.freeze({
    week_start:text(weeklyContext.week_start)||null,camp:text(weeklyContext.camp)||null,dish_category:text(weeklyContext.dish_category)||null,
    favorite_berries:Object.freeze(Array.isArray(weeklyContext.favorite_berries)?unique(weeklyContext.favorite_berries):[weeklyContext.favorite_berry_1,weeklyContext.favorite_berry_2,weeklyContext.favorite_berry_3].map(text).filter(Boolean)),
    pot_size:number(weeklyContext.pot_size),event_name:text(weeklyContext.event_name)||null,
    event_effect_registry_version:text(weeklyContext.event_effect_registry_version)||null,
    strategy_event_effects:stable(weeklyContext.strategy_event_effects||{}),
    feature_only_event_effects:stable(weeklyContext.feature_only_event_effects||{}),
    review_effects:Object.freeze((weeklyContext.review_event_effects||[]).map(row=>Object.freeze({source_text:text(row.source_text),rule_status:'REVIEW_REQUIRED'}))),
    strategy_effect_fingerprint:text(weeklyContext.event_effect_strategy_fingerprint)||null,
    authority_source:text(weeklyContext.authority_source)||null,
    berry_policy:text(weeklyContext.berry_policy)||null,
  });
}

function sanitizeGoalProfile(goalProfile){
  if(!goalProfile)return null;
  return Object.freeze({
    primary_goal:text(goalProfile.primary_goal)||null,
    secondary_goals:Object.freeze(unique(goalProfile.secondary_goals)),weights:stable(goalProfile.weights||{}),hard_constraints:stable(goalProfile.hard_constraints||{}),
    profile_version:text(goalProfile.profile_version)||null,
  });
}

function recipeRequirementParity(req,resource){
  const projectionOwned=number(req?.owned),projectionUsable=number(req?.usable);
  const physicalQuantity=resource?number(resource.quantity):projectionOwned;
  const physicalAvailable=resource?number(resource.available):projectionUsable;
  const checks=[];
  if(resource&&projectionOwned!==null)checks.push(physicalQuantity===projectionOwned);
  if(resource&&projectionUsable!==null)checks.push(physicalAvailable===projectionUsable);
  if(checks.includes(false))return 'MISMATCH';
  if(checks.length&&checks.every(Boolean))return 'MATCH';
  return resource?'PARTIAL':'MISSING_RESOURCE';
}
function sanitizeRecipeStrategy(recipeStrategy,resources){
  const resourceMap=new Map((resources?.ingredients||[]).map(row=>[text(row.ingredient_name),row]));
  return Object.freeze({
    projection_status:text(recipeStrategy?.projection_status)||null,
    candidates:Object.freeze((recipeStrategy?.candidates||[]).slice(0,10).map(row=>Object.freeze({
      recipe_id:text(row.recipe_id)||null,recipe_name:text(row.recipe_name)||null,category:text(row.category)||null,unlocked:Boolean(row.unlocked),
      total_ingredients:number(row.total_ingredients),candidate_status:text(row.candidate_status)||null,hard_constraint_status:text(row.hard_constraint_status)||null,
      pot_fit:row.pot_fit===true?true:row.pot_fit===false?false:null,total_raw_shortage:number(row.total_raw_shortage),total_strategy_shortage:number(row.total_strategy_shortage),
      requirements:Object.freeze((row.requirements||[]).map(req=>{
        const name=text(req.ingredient_name),resource=resourceMap.get(name)||null;
        return Object.freeze({
          ingredient_name:name,required:number(req.required??req.required_quantity??req.quantity),
          physical_quantity:resource?number(resource.quantity):number(req.owned),
          safe_reserve:number(req.safe_reserve),
          physical_available:resource?number(resource.available):number(req.usable),
          raw_shortage:number(req.raw_shortage),strategy_shortage:number(req.strategy_shortage??req.shortage),
          inventory_parity_status:recipeRequirementParity(req,resource),
        });
      })),
    }))),
  });
}

function sanitizeRecipeDiscovery(recipeDiscovery,resolver){
  const team=sanitizeTeam(recipeDiscovery?.team?.primary||recipeDiscovery?.team,resolver);
  return Object.freeze({
    projection_status:text(recipeDiscovery?.projection_status)||null,
    summary:stable(replaceStableIds(recipeDiscovery?.summary||{},resolver)),
    discovery_candidates:Object.freeze((recipeDiscovery?.discovery_candidates||[]).map(row=>Object.freeze({
      discovery_id:text(row.discovery_id)||null,display_name:text(row.display_name)||null,canonical_name_zh_tw:row.canonical_name_zh_tw??null,
      total_ingredients:number(row.total_ingredients),quantity_signature:Object.freeze([...(row.quantity_signature||[])]),reference_ingredient_set:Object.freeze(unique(row.reference_ingredient_set)),
      sunday_pot_capacity:number(row.sunday_pot_capacity),sunday_pot_fit:row.sunday_pot_fit??null,sunday_pot_buffer:number(row.sunday_pot_buffer),canonical_active:false,
    }))),
    stockpile:Object.freeze((recipeDiscovery?.stockpile||[]).map(row=>Object.freeze({ingredient_name:text(row.ingredient_name),target:Number(row.target||0),current:Number(row.current||0),deficit:Number(row.deficit||0),target_semantics:text(row.target_semantics)||null}))),
    recommended_stockpile_team:team,
    production_rate_model:text(recipeDiscovery?.production_rate_model)||'NOT_YET_VERIFIED',estimated_ingredient_per_hour:null,estimated_weekly_energy:null,
  });
}

function deriveMissingRules({candidateScoring,teamOptimization,recipeDiscovery,resourceSnapshot,weeklyContext}={}){
  const missing=new Set();
  const scoreCandidates=candidateScoring?.candidates||[];
  for(const dimension of ['intrinsic_score','weekly_fit_score','roster_marginal_value_score','training_roi_score'])if(!scoreCandidates.some(row=>number(row?.[dimension])!==null))missing.add(dimension);
  if(teamOptimization?.primary?.estimated_energy==null)missing.add('verified_weekly_energy_model');
  if(recipeDiscovery?.production_rate_model==='NOT_YET_VERIFIED'||recipeDiscovery?.estimated_ingredient_per_hour==null)missing.add('verified_ingredient_production_rate_model');
  if(resourceSnapshot?.candy_conversion?.rule_status!=='ACTIVE_VERIFIED')missing.add('verified_candy_conversion_rule');
  if((weeklyContext?.review_event_effects||[]).length)missing.add('review_required_event_effect_rules');
  for(const row of weeklyContext?.event_effect_states||[])if(row.rule_status==='FEATURE_ONLY')missing.add(`event_effect_rule:${row.effect_key}`);
  return Object.freeze([...missing].sort());
}

function recipeParityStatus(recipeStrategy){
  const statuses=(recipeStrategy?.candidates||[]).flatMap(row=>(row.requirements||[]).map(req=>req.inventory_parity_status));
  if(statuses.includes('MISMATCH'))return 'MISMATCH';
  if(statuses.includes('MISSING_RESOURCE'))return 'MISSING_RESOURCE';
  if(statuses.includes('PARTIAL'))return 'PARTIAL';
  return statuses.length?'MATCH':'NOT_APPLICABLE';
}
function sharingNotice(){return Object.freeze({
  notice_version:STRATEGY_ANALYSIS_SHARING_NOTICE_VERSION,
  data_classification:'PRIVATE_GAME_RECORDS',
  technical_sensitive_data_excluded:true,
  contains_game_records:true,
  recommendation:'TRUSTED_AI_ONLY_NOT_PUBLIC',
  message:'此 Prompt／JSON／Markdown 不包含 API Key、raw SQLite、stable Pokémon local ID、原始截圖、完整 OCR、source image ref 或 identity fingerprint，但包含你的 Pokémon roster 摘要、庫存、策略目標與本週環境等遊戲記錄。請只提供給你信賴的 AI 模型／服務分析，不建議公開張貼或分享給不必要的第三方。',
});}

function promptForPack(pack){
  return `你是 Pokémon Sleep 策略分析模型。請只根據下方 Strategy Analysis Pack 提供建議。\n\n【Evidence Authority】\n1. FACT：resource_snapshot、weekly_context 中明確提供的玩家觀測／公版資料為 FACT；其中 resource_snapshot.quantity / available 是 physical resource 的最高權威，不得自行改寫、補猜或用外部知識替換。\n2. DETERMINISTIC：只有 Pack 已明確輸出的 deterministic projection / rule result 才能標示 DETERMINISTIC。你自行做的加減乘除、跨區塊 join、排序、使用後餘量、機會成本比較，即使輸入都來自 FACT，也必須標示 AI_INFERENCE。\n3. AI_INFERENCE：所有策略優先順序、option value、跨目標 trade-off 與資源競爭判斷都必須標示 AI_INFERENCE。\n\n【Missing Rule Safety】\n4. null、missing_rules、REVIEW_REQUIRED、FEATURE_ONLY、NOT_YET_VERIFIED、UNKNOWN 代表平台沒有足夠 verified deterministic rule；不得將未知視為 0、不得把沒有 Evidence 當成負面 Evidence、不得捏造精確數值。應使用 NOT COMPUTABLE / INSUFFICIENT EVIDENCE / QUALITATIVE TRADE-OFF。\n\n【Recipe / Resource Consistency】\n5. recipe requirement 的 physical_quantity / physical_available 與 resource_snapshot 是 physical inventory evidence；strategy_shortage 是平台 recipe strategy projection。不得僅因 strategy_shortage=0 就自行宣稱「目前確定可立即製作」。\n6. 必須檢查 inventory_parity_status。若為 MISMATCH / MISSING_RESOURCE / PARTIAL，標示 DATA_CONSISTENCY_GAP，指出衝突，不得自行挑一個值冒充 DETERMINISTIC。\n7. 若你使用 resource_snapshot 與 recipe requirement 自行比對可製作性、使用後剩餘量或解鎖順序，結果必須標示 AI_INFERENCE。\n8. 不得逐道料理孤立判斷；同一食材若同時被多個 recipe、Discovery stockpile 或其他目標需求，必須分析 resource contention、歸零風險、其他目標被阻斷的可能與 option value。缺少 production-rate model 時不得假設食材容易補回。\n\n【Candidate Reference Integrity】\n9. 只能引用 candidate_pokemon[] 中存在的 candidate_ref。若任何 deterministic result 引用了不存在的 candidate_ref，標示 REFERENCE_INTEGRITY_GAP，不得自行補猜個體資料，也不得把該 ref 作為正式推薦依據。\n\n【Discovery / Candy / Evolution Safety】\n10. canonical_active=false、canonical_name_zh_tw=null 或 CONSERVATIVE_DISCOVERY_UPPER_BOUND 只能作保守囤料方向，不得描述成已確認正式料理或確定需求量。\n11. physical candy 與 convertible candy 必須完全分離；candy_conversion.rule_status != ACTIVE_VERIFIED 或 derived_options 為空時，不得輸出任何換算數量。\n12. 持有進化道具不代表某 candidate 值得進化。缺 evolution target/cost/post-evolution benefit/training ROI 時只能作定性 trade-off。\n13. 只有 strategy_event_effects / ACTIVE_VERIFIED effect 能作 deterministic strategy evidence；feature_only_event_effects 不得自行轉成 numeric bonus。\n\n【Privacy / Action Boundary】\n14. 不得要求或推導 API Key、raw SQLite、stable Pokémon local ID、raw screenshots、完整 OCR、source image ref、identity fingerprint 或 private notes。\n15. 本回答只作建議，不代表可直接修改玩家 SQLite，也不要輸出任何 Apply operation。\n\n【Pack QA】\n16. 回答中必須新增「資料完整性／一致性問題」段落，檢查 missing candidate_ref、resource/recipe parity、contradictory deterministic results、unknown canonical identity、physical/convertible double counting。若沒有問題也要明確寫「未發現」。\n\n分析要求：\n${pack.analysis_request||'請依目前目標、資源、本週環境與 deterministic 結果，提出優先順序、理由、風險、缺少資料與下一步。'}\n\n輸出格式：\n1. 重點摘要\n2. 建議優先順序（每項標示 FACT / DETERMINISTIC / AI_INFERENCE）\n3. Resource opportunity-cost analysis\n4. Candidate / Recipe Evidence（只引用可解析 candidate_ref / recipe_id）\n5. 主要 trade-off\n6. 目前無法可靠計算的項目（對應 missing_rules）\n7. 資料完整性／一致性問題\n8. 建議補充的 Data / Evidence（依最能改善下一次決策品質排序）\n9. 最終策略（區分平台 FACT、平台 DETERMINISTIC、AI_INFERENCE）\n\nStrategy Analysis Pack JSON：\n${JSON.stringify(pack,null,2)}`;
}

export function buildStrategyAnalysisPack({
  analysisRequest='',weeklyContext={},goalProfile=null,resourceSnapshot={},candidateScoring={},teamOptimization={},recipeStrategy={},recipeDiscovery={},masterVersions={},ruleVersions={},currentTeamPokemonIds=[],candidateLimit=30,privacyManifest=null,
}={}){
  const allCandidates=sortCandidates(candidateScoring?.candidates||[]),resolver=buildEphemeralCandidateResolver(allCandidates);
  const requiredIds=new Set((currentTeamPokemonIds||[]).map(text).filter(Boolean));
  for(const id of collectStablePokemonIds(teamOptimization))requiredIds.add(id);
  for(const id of collectStablePokemonIds(recipeDiscovery))requiredIds.add(id);
  for(const id of collectStablePokemonIds(goalProfile))requiredIds.add(id);
  for(const ref of collectCandidateRefs(goalProfile)){
    const stableId=resolver.ref_to_stable.get(ref);if(stableId)requiredIds.add(stableId);
  }
  const unresolvedRequired=[...requiredIds].filter(id=>!resolver.stable_to_ref.has(id));
  if(unresolvedRequired.length)throw new Error(`Strategy Analysis Pack candidate closure failed: ${unresolvedRequired.length} deterministic reference(s) missing from candidate scoring`);
  const selected=[];
  for(const row of allCandidates)if(requiredIds.has(candidateStableId(row)))selected.push(row);
  for(const row of allCandidates)if(selected.length<Math.max(5,Number(candidateLimit)||30)&&!selected.includes(row))selected.push(row);
  const candidateRows=selected.map(row=>sanitizeCandidate(row,resolver.stable_to_ref.get(candidateStableId(row)),resolver));
  const currentTeamRefs=(currentTeamPokemonIds||[]).map(id=>resolver.stable_to_ref.get(text(id))).filter(Boolean);
  const weekly=sanitizeWeeklyContext(weeklyContext),goal=sanitizeGoalProfile(goalProfile),resources=sanitizeResources(resourceSnapshot,{recipeStrategy,recipeDiscovery,teamOptimization});
  const recipeStrategySafe=sanitizeRecipeStrategy(recipeStrategy,resources);
  const deterministicResults=Object.freeze({
    team_optimization:Object.freeze({
      projection_status:text(teamOptimization?.projection_status)||null,
      primary:sanitizeTeam(teamOptimization?.primary,resolver),alternatives:Object.freeze((teamOptimization?.alternatives||[]).map(team=>sanitizeTeam(team,resolver))),estimated_energy:null,
    }),
    recipe_strategy:recipeStrategySafe,
    recipe_discovery:sanitizeRecipeDiscovery(recipeDiscovery,resolver),
  });
  const candidateRefSet=new Set(candidateRows.map(row=>row.candidate_ref));
  const deterministicRefs=collectCandidateRefs(deterministicResults);
  const unresolvedRefs=[...deterministicRefs].filter(ref=>!candidateRefSet.has(ref));
  if(unresolvedRefs.length)throw new Error(`Strategy Analysis Pack candidate reference integrity failed: ${unresolvedRefs.length} unresolved reference(s)`);
  const missingRules=deriveMissingRules({candidateScoring,teamOptimization,recipeDiscovery,resourceSnapshot,weeklyContext});
  const base={
    schema:'pokemon-sleep-strategy-analysis-pack/1.0',pack_version:STRATEGY_ANALYSIS_PACK_VERSION,prompt_version:STRATEGY_ANALYSIS_PROMPT_VERSION,
    analysis_request:text(analysisRequest)||'請依目前目標、資源、本週環境與 deterministic 結果，提出本週最值得執行的策略優先順序。',
    sharing_notice:sharingNotice(),
    weekly_context:weekly,goal_profile:goal,resource_snapshot:resources,
    current_team:Object.freeze({candidate_refs:Object.freeze(currentTeamRefs)}),candidate_pokemon:Object.freeze(candidateRows),deterministic_results:deterministicResults,
    missing_rules:missingRules,public_master_versions:stable(masterVersions||{}),rule_versions:stable(ruleVersions||{}),
    integrity_manifest:Object.freeze({candidate_reference_closure:true,unresolved_candidate_reference_count:0,recipe_resource_parity_status:recipeParityStatus(recipeStrategySafe)}),
    privacy_manifest:Object.freeze(privacyManifest||{api_key_in_pack:false,raw_sqlite_in_pack:false,raw_screenshot_in_pack:false,raw_ocr_in_pack:false,stable_pokemon_ids_in_pack:false,identity_fingerprint_in_pack:false,private_notes_in_pack:false,source_image_refs_in_pack:false,ephemeral_candidate_refs:true}),
    safety_manifest:Object.freeze({direct_apply_allowed:false,ai_numeric_source_of_truth:false,physical_candy_only:true,convertible_candy_in_physical_totals:false}),
  };
  const inputFingerprint=`strategy_analysis:${hash(stableJson(base))}`;
  const pack=Object.freeze({...base,input_fingerprint:inputFingerprint});
  return Object.freeze({pack,prompt:promptForPack(pack),resolver:Object.freeze({stable_to_ref:resolver.stable_to_ref,ref_to_stable:resolver.ref_to_stable}),privacy_manifest:pack.privacy_manifest});
}

export function strategyAnalysisPackMarkdown(pack){
  const lines=[
    '# Pokémon Sleep Strategy Analysis Pack','',
    `> **分享提醒**：${pack.sharing_notice?.message||'此檔案包含玩家遊戲紀錄，請只提供給信賴的 AI 模型／服務分析，不建議公開散布。'}`,'',
    `- Pack version: \`${pack.pack_version}\``,`- Input fingerprint: \`${pack.input_fingerprint}\``,`- Week: ${pack.weekly_context?.week_start||'—'}`,`- Camp: ${pack.weekly_context?.camp||'—'}`,`- Goal: ${pack.goal_profile?.primary_goal||'—'}`,
    `- Candidate reference closure: ${pack.integrity_manifest?.candidate_reference_closure?'PASS':'FAIL'}`,
    `- Recipe / resource parity: ${pack.integrity_manifest?.recipe_resource_parity_status||'—'}`,
    '','## Resource snapshot','',
    '| 類型 | 名稱 | 持有 | 保留 | 可動用 |','|---|---|---:|---:|---:|',
    ...(pack.resource_snapshot?.ingredients||[]).map(row=>`| 食材 | ${row.ingredient_name} | ${row.quantity} | — | ${row.available} |`),
    ...(pack.resource_snapshot?.items||[]).map(row=>`| 道具 | ${row.item_name} | ${row.quantity} | ${row.safe_reserve} | ${row.available} |`),
    ...(pack.resource_snapshot?.candies||[]).map(row=>`| 糖果 | ${row.candy_name} | ${row.quantity} | ${row.safe_reserve} | ${row.available} |`),
    '','## Current / candidate Pokémon','',
    '| Ref | 種類 | Lv | 專長 | Readiness | Hard Constraint |','|---|---|---:|---|---:|---|',
    ...(pack.candidate_pokemon||[]).map(row=>`| ${row.candidate_ref} | ${row.species||'—'} | ${row.level??'—'} | ${row.specialty||'—'} | ${row.current_readiness_score??'—'} | ${row.hard_constraint_status||'—'} |`),
    '','## Missing deterministic rules','',...(pack.missing_rules?.length?pack.missing_rules.map(item=>`- ${item}`):['- 無']),
    '','## Analysis request','',pack.analysis_request||'',
    '','> 此檔案不包含 API Key、raw SQLite、原始截圖、完整 OCR、stable Pokémon local ID 或 identity fingerprint；但包含玩家 Pokémon、庫存、策略目標與本週環境等遊戲紀錄。請只交付給信賴的 AI 模型／服務。AI 回覆只作建議，不可直接 Apply。','',
  ];
  return lines.join('\n');
}
