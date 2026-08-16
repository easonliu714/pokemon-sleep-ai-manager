import {run,rows,persist,snapshot,begin,commit,rollback} from './database.js';
import {localIso} from './time-utils.js';
const now=()=>localIso();
async function audit(entity,key,before,after,reason){const id=`MANUAL-${Date.now()}-${Math.random().toString(16).slice(2,6)}`;run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',[id,'manual-1.0',now(),now(),'manual_frontend_edit',1,JSON.stringify({status:'applied',reason})]);run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',[id,0,entity,'manual_update',JSON.stringify(key),JSON.stringify(before||null),JSON.stringify(after||null),'applied',reason]);}
function emitPokemonEvaluationInputChanged(pokemonId,reason){window.dispatchEvent?.(new CustomEvent('pokemon-sleep:pokemon-evaluation-input-changed',{detail:{pokemon_ids:[String(pokemonId)],reason}}));}
function normalizeIngredientUnlockInput(value){
  if(value===undefined||value===null||value==='')return null;
  if(value===1||value===true||String(value)==='1')return 1;
  if(value===0||value===false||String(value)==='0')return 0;
  throw new Error('食材解鎖狀態只允許：已解鎖／尚未解鎖／待確認');
}

// Quantity and player progression are independent semantics. Positive quantity
// deterministically proves unlock; quantity=0 never auto-means NOT_UNLOCKED.
export async function saveIngredient(name,quantity,unlockInput=undefined){
  const before=rows('SELECT * FROM ingredient_inventory WHERE ingredient_name=?',[name])[0]||null;
  const q=Number(quantity);let unlocked=normalizeIngredientUnlockInput(unlockInput);
  if(!rows('SELECT 1 FROM ingredient_master WHERE ingredient_name=?',[name]).length)throw new Error('找不到公版食材名稱');
  if(!Number.isInteger(q)||q<0)throw new Error('庫存必須是 0 以上整數');
  if(q>0&&unlocked===0)throw new Error('庫存大於 0 代表食材已解鎖，不可標記為尚未解鎖');
  if(q>0)unlocked=1;
  if(q===0&&unlockInput===undefined)unlocked=before?.unlocked??null;
  await snapshot(`manual:ingredient:${name}`);begin();
  try{
    run(`INSERT INTO ingredient_inventory(ingredient_name,quantity,unlocked,updated_at,source_update_id) VALUES(?,?,?,?,?) ON CONFLICT(ingredient_name) DO UPDATE SET quantity=excluded.quantity,unlocked=excluded.unlocked,updated_at=excluded.updated_at,source_update_id=excluded.source_update_id`,[name,q,unlocked,now(),'MANUAL-EDIT']);
    const after=rows('SELECT * FROM ingredient_inventory WHERE ingredient_name=?',[name])[0];
    await audit('ingredient_inventory',{ingredient_name:name},before,after,'前端手動修改食材庫存與解鎖狀態');commit();await persist();return after;
  }catch(e){rollback();throw e}
}
export async function saveItem(name,quantity,reserve,recommendation){const before=rows('SELECT * FROM item_inventory WHERE item_name=?',[name])[0]||null;const q=Number(quantity),r=Number(reserve);if(!rows('SELECT 1 FROM item_master WHERE item_name=?',[name]).length)throw new Error('找不到公版道具名稱');if(!Number.isInteger(q)||q<0||!Number.isInteger(r)||r<0)throw new Error('庫存與保留量必須是 0 以上整數');await snapshot(`manual:item:${name}`);begin();try{run(`INSERT INTO item_inventory(item_name,quantity,safe_reserve,recommendation,updated_at,source_update_id) VALUES(?,?,?,?,?,?) ON CONFLICT(item_name) DO UPDATE SET quantity=excluded.quantity,safe_reserve=excluded.safe_reserve,recommendation=excluded.recommendation,updated_at=excluded.updated_at,source_update_id=excluded.source_update_id`,[name,q,r,String(recommendation||''),now(),'MANUAL-EDIT']);const after=rows('SELECT * FROM item_inventory WHERE item_name=?',[name])[0];await audit('item_inventory',{item_name:name},before,after,'前端手動修改道具資料');commit();await persist();return after;}catch(e){rollback();throw e}}
export async function savePokemonDetail(id,data,ingredients,subskills){const before={pokemon:rows('SELECT * FROM pokemon WHERE pokemon_id=?',[id])[0],ingredients:rows('SELECT * FROM pokemon_ingredients WHERE pokemon_id=? ORDER BY unlock_level',[id]),subskills:rows('SELECT * FROM pokemon_subskills WHERE pokemon_id=? ORDER BY unlock_level',[id])};if(!before.pokemon)throw new Error('找不到寶可夢資料');await snapshot(`manual:pokemon:${id}`);begin();try{const fields=['original_label','nickname','level','sp','rating','specialty','type','nature','nature_bonus','nature_penalty','main_skill','main_skill_level','main_skill_description','helper_seconds','carry_limit','favorite_berry','sleep_hours','sleep_time_text','registered_at','evolution_level_required','evolution_sleep_hours_required','evolution_candy_required','evolution_item_required','evolution_other_requirement','ai_score','status','core_role','recommendation','item_advice','scenarios'];run(`UPDATE pokemon SET ${fields.map(f=>`${f}=?`).join(',')},last_updated_at=?,source_update_id=? WHERE pokemon_id=?`,[...fields.map(f=>data[f]??null),now(),'MANUAL-EDIT',id]);run('DELETE FROM pokemon_ingredients WHERE pokemon_id=?',[id]);for(const x of ingredients){if(x.ingredient_name)run('INSERT INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity) VALUES(?,?,?,?)',[id,x.unlock_level,x.ingredient_name,x.quantity||null]);}run('DELETE FROM pokemon_subskills WHERE pokemon_id=?',[id]);for(const x of subskills){if(x.subskill_name)run('INSERT INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked) VALUES(?,?,?,?)',[id,x.unlock_level,x.subskill_name,x.is_unlocked?1:0]);}const after={pokemon:rows('SELECT * FROM pokemon WHERE pokemon_id=?',[id])[0],ingredients:rows('SELECT * FROM pokemon_ingredients WHERE pokemon_id=? ORDER BY unlock_level',[id]),subskills:rows('SELECT * FROM pokemon_subskills WHERE pokemon_id=? ORDER BY unlock_level',[id])};await audit('pokemon',{pokemon_id:id},before,after,'前端手動修改寶可夢完整資料');commit();await persist();emitPokemonEvaluationInputChanged(id,'manual_pokemon_edit');return after;}catch(e){rollback();throw e}}
