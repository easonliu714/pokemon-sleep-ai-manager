export const G14_TRAINING_DERIVED_STATE_AUTHORITY_VERSION='g14-training-derived-state-2026-09-26-a';

const text=value=>String(value??'').normalize('NFKC').trim();
const levelOf=pokemon=>Math.max(0,Number(pokemon?.level)||0);
const unlockLevel=row=>Math.max(0,Number(row?.unlock_level)||0);
const observedUnlock=row=>{
  const raw=row?.is_unlocked;
  if(raw===null||raw===undefined||raw==='')return null;
  return Boolean(Number(raw));
};
const sortByUnlock=(a,b)=>Number(a.unlock_level||0)-Number(b.unlock_level||0)||String(a.name||'').localeCompare(String(b.name||''),'zh-Hant');

function projectSlot(pokemon,row,nameField){
  const name=text(row?.[nameField]);
  const required=unlockLevel(row);
  const currentLevel=levelOf(pokemon);
  const derivedUnlocked=Boolean(name)&&required>0&&currentLevel>=required;
  const observed=observedUnlock(row);
  return Object.freeze({
    ...row,
    name,
    unlock_level:required,
    derived_state:derivedUnlocked?'CURRENT':'FUTURE',
    derived_unlocked:derivedUnlocked,
    observed_is_unlocked:observed,
    observation_conflict:observed===null?false:observed!==derivedUnlocked,
    unlock_authority:'CURRENT_LEVEL_VS_UNLOCK_LEVEL',
  });
}

export function ingredientSlotUnlocked(pokemon,row){
  return projectSlot(pokemon,row,'ingredient_name').derived_unlocked;
}

export function subskillSlotUnlocked(pokemon,row){
  return projectSlot(pokemon,row,'subskill_name').derived_unlocked;
}

export function derivePokemonTrainingCapabilityState({pokemon={},ingredientRows=[],subskillRows=[]}={}){
  const currentLevel=levelOf(pokemon);
  const ingredients=ingredientRows.map(row=>projectSlot(pokemon,row,'ingredient_name')).filter(row=>row.name).sort(sortByUnlock);
  const subskills=subskillRows.map(row=>projectSlot(pokemon,row,'subskill_name')).filter(row=>row.name).sort(sortByUnlock);
  const currentIngredients=ingredients.filter(row=>row.derived_unlocked);
  const futureIngredients=ingredients.filter(row=>!row.derived_unlocked);
  const currentSubskills=subskills.filter(row=>row.derived_unlocked);
  const futureSubskills=subskills.filter(row=>!row.derived_unlocked);
  const futureLevels=[...futureIngredients,...futureSubskills].map(row=>Number(row.unlock_level||0)).filter(level=>level>currentLevel);
  const nextUnlockLevel=futureLevels.length?Math.min(...futureLevels):null;
  const conflicts=[...ingredients,...subskills].filter(row=>row.observation_conflict);
  return Object.freeze({
    authority_version:G14_TRAINING_DERIVED_STATE_AUTHORITY_VERSION,
    readonly_projection:true,
    pokemon_id:text(pokemon?.pokemon_id)||null,
    pokemon_instance_id:text(pokemon?.pokemon_instance_id)||null,
    current_level:currentLevel,
    current_ingredient_rows:Object.freeze(currentIngredients),
    future_ingredient_rows:Object.freeze(futureIngredients),
    current_subskill_rows:Object.freeze(currentSubskills),
    future_subskill_rows:Object.freeze(futureSubskills),
    next_unlock_level:nextUnlockLevel,
    legacy_unlock_observation_conflicts:Object.freeze(conflicts),
  });
}
