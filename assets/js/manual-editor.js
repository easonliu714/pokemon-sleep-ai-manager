import {run,rows,persist,snapshot,begin,commit,rollback} from './database.js';
import {localIso} from './time-utils.js';
import {withPrimarySqliteMutationLock} from './storage.js';
import {beginSqliteExclusiveWriteWindow,withSqliteCoordinatedMutation} from './sqlite-direct-write-window-guard.js';
import {scorePokemonProvisionalRating,POKEMON_PROVISIONAL_RATING_RULE_VERSION} from './pokemon-provisional-rating.js';
import {sourceTokenForPokemonRating} from './pokemon-roster-rating-preview.js';
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
// G265 named ingredient writer: reserve the same-page SQL window before the
// native Web Lock, then validate player-owned state and mutate only under the
// loaded-primary revision lease. A failed/ambiguous ACK requires reload.
export async function saveIngredient(name,quantity,unlockInput=undefined){
  const q=Number(quantity),requestedUnlock=normalizeIngredientUnlockInput(unlockInput);
  if(!Number.isInteger(q)||q<0)throw new Error('庫存必須是 0 以上整數');
  if(q>0&&requestedUnlock===0)throw new Error('庫存大於 0 代表食材已解鎖，不可標記為尚未解鎖');
  const close=beginSqliteExclusiveWriteWindow();
  let acknowledged=false;
  try{
    return await withPrimarySqliteMutationLock(async lease=>{
      const before=rows('SELECT * FROM ingredient_inventory WHERE ingredient_name=?',[name])[0]||null;
      if(!rows('SELECT 1 FROM ingredient_master WHERE ingredient_name=?',[name]).length)
        throw new Error('找不到公版食材名稱');
      let unlocked=q>0?1:requestedUnlock;
      if(q===0&&unlockInput===undefined)unlocked=before?.unlocked??null;
      await snapshot(`manual:ingredient:${name}`);
      withSqliteCoordinatedMutation(begin);
      try{
        const after=withSqliteCoordinatedMutation(()=>{
          run(`INSERT INTO ingredient_inventory(ingredient_name,quantity,unlocked,updated_at,source_update_id) VALUES(?,?,?,?,?) ON CONFLICT(ingredient_name) DO UPDATE SET quantity=excluded.quantity,unlocked=excluded.unlocked,updated_at=excluded.updated_at,source_update_id=excluded.source_update_id`,[name,q,unlocked,now(),'MANUAL-EDIT']);
          return rows('SELECT * FROM ingredient_inventory WHERE ingredient_name=?',[name])[0];
        });
        await withSqliteCoordinatedMutation(()=>audit('ingredient_inventory',{ingredient_name:name},before,after,'前端手動修改食材庫存與解鎖狀態'));
        withSqliteCoordinatedMutation(commit);
        await withSqliteCoordinatedMutation(()=>persist({primaryMutationLease:lease}));
        acknowledged=true;
        return after;
      }catch(error){
        withSqliteCoordinatedMutation(rollback);
        throw error;
      }
    });
  }finally{
    close({uncertainOutcome:!acknowledged});
  }
}
// G265 named item writer: native primary admission must precede every player
// read, snapshot and BEGIN. A failed or uncertain ACK requires explicit reload;
// the held revision lease is reused through the durable save interval.
export async function saveItem(name,quantity,reserve,recommendation){
  const q=Number(quantity),r=Number(reserve);
  if(!Number.isInteger(q)||q<0||!Number.isInteger(r)||r<0)
    throw new Error('庫存與保留量必須是 0 以上整數');
  const close=beginSqliteExclusiveWriteWindow();
  let acknowledged=false;
  try{
    return await withPrimarySqliteMutationLock(async lease=>{
      const before=rows('SELECT * FROM item_inventory WHERE item_name=?',[name])[0]||null;
      if(!rows('SELECT 1 FROM item_master WHERE item_name=?',[name]).length)
        throw new Error('找不到公版道具名稱');
      await snapshot(`manual:item:${name}`);
      withSqliteCoordinatedMutation(begin);
      try{
        const after=withSqliteCoordinatedMutation(()=>{
          run(`INSERT INTO item_inventory(item_name,quantity,safe_reserve,recommendation,updated_at,source_update_id) VALUES(?,?,?,?,?,?) ON CONFLICT(item_name) DO UPDATE SET quantity=excluded.quantity,safe_reserve=excluded.safe_reserve,recommendation=excluded.recommendation,updated_at=excluded.updated_at,source_update_id=excluded.source_update_id`,
            [name,q,r,String(recommendation||''),now(),'MANUAL-EDIT']);
          return rows('SELECT * FROM item_inventory WHERE item_name=?',[name])[0];
        });
        await withSqliteCoordinatedMutation(()=>audit('item_inventory',{item_name:name},before,after,'前端手動修改道具資料'));
        withSqliteCoordinatedMutation(commit);
        await withSqliteCoordinatedMutation(()=>persist({primaryMutationLease:lease}));
        acknowledged=true;
        return after;
      }catch(error){
        withSqliteCoordinatedMutation(rollback);
        throw error;
      }
    });
  }finally{
    close({uncertainOutcome:!acknowledged});
  }
}
// G265: one named production writer, not global legacy admission. Reserve the
// same-page SQL window BEFORE waiting for the native cross-tab Web Lock.
// Read the original, snapshot, BEGIN, mutate, audit, COMMIT and durable ACK
// only after the loaded revision matches the primary bytes under that lock.
// Any failure stays fail-closed on this page; never silently retry a stale edit.
export async function savePokemonDetail(id,data,ingredients,subskills){
  const close=beginSqliteExclusiveWriteWindow();
  let acknowledged=false;
  try{
    return await withPrimarySqliteMutationLock(async lease=>{
      const before={
        pokemon:rows('SELECT * FROM pokemon WHERE pokemon_id=?',[id])[0],
        ingredients:rows('SELECT * FROM pokemon_ingredients WHERE pokemon_id=? ORDER BY unlock_level',[id]),
        subskills:rows('SELECT * FROM pokemon_subskills WHERE pokemon_id=? ORDER BY unlock_level',[id])
      };
      if(!before.pokemon)throw new Error('找不到寶可夢資料');
      await snapshot(`manual:pokemon:${id}`);
      withSqliteCoordinatedMutation(begin);
      try{
        const after=withSqliteCoordinatedMutation(()=>{
          const fields=['original_label','nickname','level','sp','rating','specialty','type','nature',
            'nature_bonus','nature_penalty','main_skill','main_skill_level','main_skill_description',
            'helper_seconds','carry_limit','favorite_berry','sleep_hours','sleep_time_text',
            'registered_at','evolution_level_required','evolution_sleep_hours_required',
            'evolution_candy_required','evolution_item_required','evolution_other_requirement',
            'ai_score','status','core_role','recommendation','item_advice','scenarios'];
          run(`UPDATE pokemon SET ${fields.map(f=>`${f}=?`).join(',')},last_updated_at=?,source_update_id=? WHERE pokemon_id=?`,
            [...fields.map(f=>data[f]??null),now(),'MANUAL-EDIT',id]);
          run('DELETE FROM pokemon_ingredients WHERE pokemon_id=?',[id]);
          for(const x of ingredients){
            if(x.ingredient_name)run('INSERT INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity) VALUES(?,?,?,?)',
              [id,x.unlock_level,x.ingredient_name,x.quantity||null]);
          }
          run('DELETE FROM pokemon_subskills WHERE pokemon_id=?',[id]);
          for(const x of subskills){
            if(x.subskill_name)run('INSERT INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked) VALUES(?,?,?,?)',
              [id,x.unlock_level,x.subskill_name,x.is_unlocked?1:0]);
          }
          return {
            pokemon:rows('SELECT * FROM pokemon WHERE pokemon_id=?',[id])[0],
            ingredients:rows('SELECT * FROM pokemon_ingredients WHERE pokemon_id=? ORDER BY unlock_level',[id]),
            subskills:rows('SELECT * FROM pokemon_subskills WHERE pokemon_id=? ORDER BY unlock_level',[id])
          };
        });
        await withSqliteCoordinatedMutation(()=>audit('pokemon',{pokemon_id:id},before,after,
          '前端手動修改寶可夢完整資料'));
        withSqliteCoordinatedMutation(commit);
        await withSqliteCoordinatedMutation(()=>persist({primaryMutationLease:lease}));
        acknowledged=true;
        emitPokemonEvaluationInputChanged(id,'manual_pokemon_edit');
        return after;
      }catch(error){
        withSqliteCoordinatedMutation(rollback);
        throw error;
      }
    });
  }finally{
    close({uncertainOutcome:!acknowledged});
  }
}

// G14.RATE.4: explicit rating-only write. Never reuse savePokemonDetail()
// because it rewrites all ingredient/subskill rows and could promote other
// uncertain player fields. Read/snapshot/BEGIN/audit/COMMIT/ACK all share the
// same pre-SQL primary mutation lease. Any failed ACK requires reload.
export async function saveConfirmedPokemonSuggestedRating(id,{
  instanceId,expectedSourceToken,scope,expectedGrade,confirmed=false,
}={}){
  if(confirmed!==true)throw new Error('RATE4_EXPLICIT_CONFIRMATION_REQUIRED');
  if(!['CURRENT','FUTURE'].includes(scope))throw new Error('RATE4_GRADE_SCOPE_REQUIRED');
  if(typeof id!=='string'||!id.trim()||typeof instanceId!=='string'||!instanceId.trim()
    ||typeof expectedSourceToken!=='string'||!expectedSourceToken)
    throw new Error('RATE4_SOURCE_IDENTITY_REQUIRED');
  const close=beginSqliteExclusiveWriteWindow();
  let acknowledged=false,committed=false;
  try{
    return await withPrimarySqliteMutationLock(async lease=>{
      const row=rows('SELECT * FROM pokemon WHERE pokemon_id=?',[id])[0];
      const ingredients=rows('SELECT * FROM pokemon_ingredients WHERE pokemon_id=? ORDER BY unlock_level',[id]);
      const subskills=rows('SELECT * FROM pokemon_subskills WHERE pokemon_id=? ORDER BY unlock_level',[id]);
      const token=sourceTokenForPokemonRating({pokemon:row?[row]:[],ingredients,subskills});
      if(!row||row.pokemon_instance_id!==instanceId||token!==expectedSourceToken)
        throw new Error('RATE4_STALE_SOURCE_RELOAD_REQUIRED');
      if(row.status!=='active')throw new Error('RATE4_INACTIVE_POKEMON_HOLD');
      const result=scorePokemonProvisionalRating({pokemon:row,ingredients,subskills});
      const grade=scope==='CURRENT'?result.current_rating:result.future_rating;
      if(result.status!=='PROVISIONAL_HEURISTIC'||!grade||grade!==expectedGrade
        ||result.rule_version!==POKEMON_PROVISIONAL_RATING_RULE_VERSION)
        throw new Error('RATE4_UNVERIFIED_GRADE_OR_RULE_HOLD');
      if(row.rating===grade){
        acknowledged=true;
        return Object.freeze({status:'NO_CHANGE',grade,scope,old_rating:row.rating,write:false});
      }
      await snapshot('rate4:confirmed:'+id);
      const beforeRating=row.rating??null,at=now();
      withSqliteCoordinatedMutation(begin);
      try{
        withSqliteCoordinatedMutation(()=>{
          run("UPDATE pokemon SET rating=?,last_updated_at=?,source_update_id=? WHERE pokemon_id=? AND pokemon_instance_id=? AND status='active' AND rating IS ?",
            [grade,at,'RATE4-USER-CONFIRMED',id,instanceId,row.rating]);
          if(rows('SELECT changes() AS affected')[0]?.affected!==1)
            throw new Error('RATE4_STALE_RATING_CAS_CONFLICT');
        });
        const after=rows('SELECT * FROM pokemon WHERE pokemon_id=?',[id])[0];
        if(after?.rating!==grade)throw new Error('RATE4_TRANSACTION_READBACK_MISMATCH');
        await withSqliteCoordinatedMutation(()=>audit('pokemon',{pokemon_id:id,pokemon_instance_id:instanceId},
          {rating:beforeRating},{rating:grade,scope,rule_version:result.rule_version,
            current_rating:result.current_rating,future_rating:result.future_rating},
          'Owner confirmed a single provisional '+scope+' rating; previous value retained in audit.'));
        withSqliteCoordinatedMutation(commit);committed=true;
        await withSqliteCoordinatedMutation(()=>persist({primaryMutationLease:lease}));
        // This is post-ACK in-memory proof. The new-main CI browser test also
        // requires a fresh IndexedDB SQL.js reload to claim durable source PASS.
        if(rows("SELECT rating FROM pokemon WHERE pokemon_id=? AND pokemon_instance_id=? AND status='active'",
          [id,instanceId])[0]?.rating!==grade)
          throw new Error('RATE4_POST_ACK_READBACK_MISMATCH');
        acknowledged=true;
        emitPokemonEvaluationInputChanged(id,'rating_user_confirmed_'+scope.toLowerCase());
        return Object.freeze({status:'SAVED',grade,scope,old_rating:beforeRating,
          rule_version:result.rule_version,write:true});
      }catch(error){
        if(!committed)withSqliteCoordinatedMutation(rollback);
        throw error;
      }
    });
  }finally{
    close({uncertainOutcome:!acknowledged});
  }
}
