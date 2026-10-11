// Player-only recipe unlock preparation. Public Recipe Master and player inventory remain read-only.
export const RECIPE_UNLOCK_PREPARATION_VERSION='recipe-unlock-preparation-2026-10-11-a';
const VERIFIED=new Set(['OFFICIAL_VERIFIED','GAME_SCREENSHOT_VERIFIED','REFERENCE_VERIFIED']);
const clean=v=>String(v??'').normalize('NFKC').trim();
const nonnegative=v=>Number.isInteger(Number(v))&&Number(v)>=0;
export function buildRecipeUnlockPreparation({candidates=[],inventory=[],selectedRecipeId=null}={}){
  const observed=new Map((inventory||[]).filter(row=>clean(row?.ingredient_name)&&nonnegative(row?.quantity)).map(row=>[clean(row.ingredient_name),Number(row.quantity)]));
  const targets=(candidates||[]).filter(row=>row?.unlocked!==true&&clean(row?.recipe_id)&&row?.lifecycle==='ACTIVE').map(row=>{
    const requirements=(row.requirements||[]).filter(r=>clean(r.ingredient_name)&&Number(r.required)>0).map(r=>{
      const name=clean(r.ingredient_name),required=Number(r.required),owned=observed.has(name)?observed.get(name):null;
      const safeReserve=nonnegative(r.safe_reserve)?Number(r.safe_reserve):0;
      return Object.freeze({ingredient_name:name,required,owned,safe_reserve:safeReserve,
        available:owned===null?null:Math.max(0,owned-safeReserve),
        deficit:owned===null?null:Math.max(0,required-Math.max(0,owned-safeReserve))});
    });
    const unknownUnlock=row.player_record_exists!==true;
    const unknownInventory=requirements.some(r=>r.owned===null);
    const trustedFormula=VERIFIED.has(row.formula_evidence);
    const potVerified=row.pot_fit!==null&&row.pot_fit!==undefined;
    const stage=unknownUnlock?'REVIEW_UNLOCK_STATE':!trustedFormula?'REVIEW_FORMULA_EVIDENCE':
      !potVerified?'REVIEW_POT_CAPACITY':!row.pot_fit?'BLOCKED_POT_CAPACITY':
      unknownInventory?'REVIEW_INVENTORY':requirements.some(r=>r.deficit>0)?'NEEDS_INGREDIENTS':'READY_FOR_IN_GAME_PREVIEW';
    return Object.freeze({
      recipe_id:clean(row.recipe_id),recipe_name:clean(row.recipe_name),category:clean(row.category),stage,
      player_record_exists:Boolean(row.player_record_exists),unlocked:false,
      pot_required:Number(row.pot_required||0),pot_capacity:row.pot_capacity??null,
      formula_evidence:row.formula_evidence??null,
      requirements:Object.freeze(requirements),
      known_deficit_total:requirements.reduce((s,r)=>s+(r.deficit??0),0),
      unknown_ingredient_count:requirements.filter(r=>r.owned===null).length,
      missing_ingredient_names:Object.freeze(requirements.filter(r=>r.deficit>0).map(r=>r.ingredient_name)),
      preview_guidance:'遊戲烹飪預覽的「？」僅能證明未發現料理，不能單獨證明確切配方；正式名稱應待正常烹飪後查證。',
    });
  });
  const priority={READY_FOR_IN_GAME_PREVIEW:0,NEEDS_INGREDIENTS:1,REVIEW_INVENTORY:2,REVIEW_UNLOCK_STATE:3,REVIEW_FORMULA_EVIDENCE:4,REVIEW_POT_CAPACITY:5,BLOCKED_POT_CAPACITY:6};
  targets.sort((a,b)=>(priority[a.stage]??9)-(priority[b.stage]??9)||a.known_deficit_total-b.known_deficit_total||a.unknown_ingredient_count-b.unknown_ingredient_count||a.recipe_name.localeCompare(b.recipe_name,'zh-Hant'));
  const selected=targets.find(row=>row.recipe_id===selectedRecipeId)||targets[0]||null;
  return Object.freeze({schema:'pokemon-sleep-recipe-unlock-preparation/1.0',version:RECIPE_UNLOCK_PREPARATION_VERSION,
    targets:Object.freeze(targets),selected,
    summary:Object.freeze({target_count:targets.length,ready_count:targets.filter(t=>t.stage==='READY_FOR_IN_GAME_PREVIEW').length,
      missing_count:targets.filter(t=>t.stage==='NEEDS_INGREDIENTS').length,review_count:targets.filter(t=>t.stage.startsWith('REVIEW_')).length}),
    player_data_write:false,public_master_write:false,ingredient_mutation:false,gemini_used:false});
}
export function targetPokemonScoreRows({pokemonCandidates=[],pokemonFeatures=[],target=null}={}){
  const demand=new Set((target?.requirements||[]).filter(row=>row.deficit>0).map(row=>clean(row.ingredient_name)));
  const featureMap=new Map((pokemonFeatures||[]).map(row=>[clean(row.pokemon_id),row]));
  return (pokemonCandidates||[]).map(row=>{
    const feature=featureMap.get(clean(row.pokemon_id))||row;
    const covered=[...new Set((feature.unlocked_ingredients||[]).map(i=>clean(i.ingredient_name)).filter(name=>demand.has(name)))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
    return {...row,weekly_ingredient_demand_covered:covered.length,weekly_ingredient_overlap:covered,
      recipe_target_ingredient_coverage:covered.length};
  });
}
