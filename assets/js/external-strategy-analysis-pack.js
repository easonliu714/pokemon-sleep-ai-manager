export const STRATEGY_ANALYSIS_PACK_VERSION='strategy-analysis-pack-2026-08-10-b';
export const STRATEGY_ANALYSIS_PROMPT_VERSION='strategy-analysis-prompt-2026-08-10-b';

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

function sanitizeRecipeStrategy(recipeStrategy){
  return Object.freeze({
    projection_status:text(recipeStrategy?.projection_status)||null,
    candidates:Object.freeze((recipeStrategy?.candidates||[]).slice(0,10).map(row=>Object.freeze({
      recipe_id:text(row.recipe_id)||null,recipe_name:text(row.recipe_name)||null,category:text(row.category)||null,unlocked:Boolean(row.unlocked),
      total_ingredients:number(row.total_ingredients),requirements:Object.freeze((row.requirements||[]).map(req=>Object.freeze({
        ingredient_name:text(req.ingredient_name),required:Number(req.required??req.required_quantity??req.quantity??0),current:Number(req.current??req.available??0),strategy_shortage:Number(req.strategy_shortage??req.shortage??0),
      }))),
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

function promptForPack(pack){
  return `你是 Pokémon Sleep 策略分析模型。請只根據下方 Strategy Analysis Pack 提供建議。\n\n不可違反的資料規則：\n1. resource_snapshot 中的實際持有量、保留量與 available 是平台本機觀測；不得自行改寫、補猜或用外部知識替換。\n2. null、missing_rules、REVIEW_REQUIRED、NOT_YET_VERIFIED 代表平台目前沒有可信 deterministic 規則；不得為了完成回答而捏造精確數值。\n3. 必須清楚區分 FACT（平台觀測事實）/ DETERMINISTIC（平台規則結果）/ AI_INFERENCE（你的策略推論）。\n4. 不得自造不存在的寶可夢個體；只能引用 candidate_ref。\n5. 不得把萬能／屬性糖果的推算轉換量當成已持有的寶可夢糖果；physical 與 convertible 明確分離。\n6. 若缺少 ingredient/hour、weekly energy、糖果轉換、活動倍率、進化成本或其他規則，請以缺值／定性 trade-off 表達，不得輸出虛假的精確值。\n7. 本回答只作建議，不代表可直接修改玩家 SQLite，也不要輸出任何 Apply operation。\n\n分析要求：\n${pack.analysis_request||'請依目前目標、資源、本週環境與 deterministic 結果，提出優先順序、理由、風險、缺少資料與下一步。'}\n\n輸出格式：\n- 建議優先順序\n- 每項建議引用的 candidate_ref / recipe_id / resource evidence\n- 主要 trade-off\n- 目前無法可靠計算的項目\n- 建議補充的資料或 Evidence\n- 每個重要推論標示 FACT / DETERMINISTIC / AI_INFERENCE\n\nStrategy Analysis Pack JSON：\n${JSON.stringify(pack,null,2)}`;
}

export function buildStrategyAnalysisPack({
  analysisRequest='',weeklyContext={},goalProfile=null,resourceSnapshot={},candidateScoring={},teamOptimization={},recipeStrategy={},recipeDiscovery={},masterVersions={},ruleVersions={},currentTeamPokemonIds=[],candidateLimit=30,privacyManifest=null,
}={}){
  const allCandidates=sortCandidates(candidateScoring?.candidates||[]),resolver=buildEphemeralCandidateResolver(allCandidates);
  const requiredIds=new Set([...(currentTeamPokemonIds||[]).map(text),...(teamOptimization?.primary?.slots||[]).map(slot=>text(slot.pokemon_id||slot.pokemon_instance_id))].filter(Boolean));
  const selected=[];
  for(const row of allCandidates)if(requiredIds.has(candidateStableId(row)))selected.push(row);
  for(const row of allCandidates)if(selected.length<Math.max(5,Number(candidateLimit)||30)&&!selected.includes(row))selected.push(row);
  const candidateRows=selected.map(row=>sanitizeCandidate(row,resolver.stable_to_ref.get(candidateStableId(row)),resolver));
  const currentTeamRefs=(currentTeamPokemonIds||[]).map(id=>resolver.stable_to_ref.get(text(id))).filter(Boolean);
  const weekly=sanitizeWeeklyContext(weeklyContext),goal=sanitizeGoalProfile(goalProfile),resources=sanitizeResources(resourceSnapshot,{recipeStrategy,recipeDiscovery,teamOptimization});
  const deterministicResults=Object.freeze({
    team_optimization:Object.freeze({
      projection_status:text(teamOptimization?.projection_status)||null,
      primary:sanitizeTeam(teamOptimization?.primary,resolver),alternatives:Object.freeze((teamOptimization?.alternatives||[]).map(team=>sanitizeTeam(team,resolver))),estimated_energy:null,
    }),
    recipe_strategy:sanitizeRecipeStrategy(recipeStrategy),
    recipe_discovery:sanitizeRecipeDiscovery(recipeDiscovery,resolver),
  });
  const missingRules=deriveMissingRules({candidateScoring,teamOptimization,recipeDiscovery,resourceSnapshot,weeklyContext});
  const base={
    schema:'pokemon-sleep-strategy-analysis-pack/1.0',pack_version:STRATEGY_ANALYSIS_PACK_VERSION,prompt_version:STRATEGY_ANALYSIS_PROMPT_VERSION,
    analysis_request:text(analysisRequest)||'請依目前目標、資源、本週環境與 deterministic 結果，提出本週最值得執行的策略優先順序。',
    weekly_context:weekly,goal_profile:goal,resource_snapshot:resources,
    current_team:Object.freeze({candidate_refs:Object.freeze(currentTeamRefs)}),candidate_pokemon:Object.freeze(candidateRows),deterministic_results:deterministicResults,
    missing_rules:missingRules,public_master_versions:stable(masterVersions||{}),rule_versions:stable(ruleVersions||{}),
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
    `- Pack version: \`${pack.pack_version}\``,`- Input fingerprint: \`${pack.input_fingerprint}\``,`- Week: ${pack.weekly_context?.week_start||'—'}`,`- Camp: ${pack.weekly_context?.camp||'—'}`,`- Goal: ${pack.goal_profile?.primary_goal||'—'}`,
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
    '','> 此檔案不包含 API Key、raw SQLite、原始截圖、完整 OCR、stable Pokémon local ID 或 identity fingerprint。AI 回覆只作建議，不可直接 Apply。','',
  ];
  return lines.join('\n');
}
