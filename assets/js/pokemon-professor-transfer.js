import {rows,run,persist,snapshot,begin,commit,rollback} from './database.js';
import {localIso} from './time-utils.js';
import {speciesCandyName} from './public-candy-master.js';
import {CANDY_CONVERSION_RULE_STATUS} from './resource-context.js';
import {
  CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,
  CANDY_MUTATION_TYPES,
  recordCandyInventoryEvent,
  resolveCandyFamilyStorageForSpecies,
} from './candy-family-storage-authority.js';

export const PROFESSOR_TRANSFER_VERSION='pokemon-professor-transfer-2026-09-01-p0b6-family-storage';
export const PROFESSOR_TRANSFER_CANDY_RULE_STATUS=CANDY_CONVERSION_RULE_STATUS;
export const PROFESSOR_TRANSFER_CANDY_AUTHORITY='USER_DIRECT_OBSERVATION_ONLY';

const now=()=>localIso();
const makeId=prefix=>`${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const trace=(event,detail={})=>{
  globalThis.UpdateCenterLiveDebug?.record?.(event,detail);
  globalThis.DebugTrace?.record?.('pokemon_roster',event,{status:'completed',details:detail});
};

export function normalizeObservedCandyQuantity(value){
  if(value===null||value===undefined||value==='')return null;
  const quantity=Number(value);
  if(!Number.isInteger(quantity)||quantity<0)throw new Error('糖果數量必須是 0 以上整數，或留空表示尚未確認');
  return quantity;
}

function candyMasterForSpecies(species){
  return rows(`SELECT candy_id,candy_name,target_species_name,verification_status
    FROM candy_master WHERE candy_type='species' AND target_species_name=? LIMIT 1`,[species])[0]||null;
}

function canonicalCandyStorageForSpecies(species){
  const sourceMaster=candyMasterForSpecies(species);
  const storage=resolveCandyFamilyStorageForSpecies(species);
  if(storage.status!=='MATCH')return {status:'REVIEW_REQUIRED',source_master:sourceMaster,storage,canonical_master:null};
  const canonicalMaster=rows(`SELECT candy_id,candy_name,target_species_name,verification_status
    FROM candy_master WHERE candy_type='species' AND target_species_name=? LIMIT 1`,[storage.canonical_species_name])[0]||null;
  if(!canonicalMaster)return {status:'REVIEW_REQUIRED',source_master:sourceMaster,storage:{...storage,status:'REVIEW_REQUIRED',reason:'CANONICAL_CANDY_MASTER_ROW_MISSING'},canonical_master:null};
  return {status:'MATCH',source_master:sourceMaster,storage,canonical_master:canonicalMaster};
}

export async function transferPokemonToProfessor(pokemonId,{observedCandyQuantity=null}={}){
  const before=rows('SELECT * FROM pokemon WHERE pokemon_id=?',[pokemonId])[0]||null;
  if(!before)throw new Error('找不到寶可夢資料');
  if(before.status!=='active')throw new Error('只有 active 寶可夢可以送給博士');
  const species=before.current_species||before.species;
  const candyQuantity=normalizeObservedCandyQuantity(observedCandyQuantity);
  const candyStorage=canonicalCandyStorageForSpecies(species);
  const candyMaster=candyStorage.source_master;
  if(candyQuantity!==null&&candyStorage.status!=='MATCH')throw new Error(`糖果家族 storage 尚未具備可寫入 authority：${candyStorage.storage?.reason||'REVIEW_REQUIRED'}。請留空糖果數量或先完成 Candy family/display authority。`);
  const canonicalCandyMaster=candyStorage.canonical_master;
  const candyName=candyStorage.status==='MATCH'?candyStorage.storage.canonical_candy_display_name:(candyMaster?.candy_name||speciesCandyName(species)||null);
  const transferId=makeId('professor-transfer');
  const at=now();
  const sourceUpdateId=`professor-transfer:${transferId}`;
  await snapshot(`professor_transfer:${pokemonId}`);
  begin();
  try{
    run(`UPDATE pokemon SET status='sent_to_professor',last_updated_at=?,source_update_id=? WHERE pokemon_id=?`,[at,sourceUpdateId,pokemonId]);
    let candyInventoryApplied=false;
    let candyInventoryBefore=null;
    let candyInventoryAfter=null;
    let candyConversionStatus='USER_OBSERVATION_REQUIRED';
    if(candyQuantity!==null){
      if(canonicalCandyMaster?.candy_id){
        candyInventoryBefore=rows('SELECT * FROM candy_inventory WHERE candy_id=?',[canonicalCandyMaster.candy_id])[0]||null;
        run(`INSERT INTO candy_inventory(candy_id,quantity,safe_reserve,updated_at,source_update_id)
          VALUES(?,?,0,?,?)
          ON CONFLICT(candy_id) DO UPDATE SET
            quantity=candy_inventory.quantity+excluded.quantity,
            updated_at=excluded.updated_at,
            source_update_id=excluded.source_update_id`,[canonicalCandyMaster.candy_id,candyQuantity,at,sourceUpdateId]);
        candyInventoryAfter=rows('SELECT * FROM candy_inventory WHERE candy_id=?',[canonicalCandyMaster.candy_id])[0]||null;
        candyInventoryApplied=true;
        candyConversionStatus='USER_OBSERVED_QUANTITY_APPLIED_CANONICAL_FAMILY';
      }else{
        candyConversionStatus='CANONICAL_CANDY_MASTER_MISSING';
      }
    }
    const after=rows('SELECT * FROM pokemon WHERE pokemon_id=?',[pokemonId])[0]||null;
    const transferEvidence={
      schema:'pokemon-sleep-professor-transfer/1.2',
      transfer_id:transferId,
      pokemon_id:pokemonId,
      pokemon_instance_id:before.pokemon_instance_id||null,
      species,
      candy_name:candyName,
      candy_family_id:candyStorage.storage?.family_id||null,
      source_candy_id:candyMaster?.candy_id||null,
      canonical_candy_id:canonicalCandyMaster?.candy_id||null,
      candy_family_storage_authority:CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,
      observed_candy_quantity:candyQuantity,
      candy_inventory_applied:candyInventoryApplied,
      candy_conversion_status:candyConversionStatus,
      deterministic_conversion_rule_status:PROFESSOR_TRANSFER_CANDY_RULE_STATUS,
      quantity_authority:candyQuantity===null?'NOT_OBSERVED':PROFESSOR_TRANSFER_CANDY_AUTHORITY,
      inventory_write_authority:candyInventoryApplied?PROFESSOR_TRANSFER_CANDY_AUTHORITY:'NONE',
      inventory_mutation:candyInventoryApplied?'OBSERVED_DELTA_INCREMENT':'NO_MUTATION',
      storage_mutation_type:candyInventoryApplied?CANDY_MUTATION_TYPES.DELTA_EVENT:'NO_MUTATION',
      transferred_at:at,
      no_hard_delete:true,
    };
    if(candyInventoryApplied){
      recordCandyInventoryEvent(run,{
        event_id:`professor:${transferId}`,
        family_id:candyStorage.storage.family_id,
        canonical_candy_id:canonicalCandyMaster.candy_id,
        source_candy_id:candyMaster?.candy_id||canonicalCandyMaster.candy_id,
        mutation_type:CANDY_MUTATION_TYPES.DELTA_EVENT,
        quantity_value:candyQuantity,
        event_at:at,
        source_update_id:sourceUpdateId,
        authority:PROFESSOR_TRANSFER_CANDY_AUTHORITY,
        evidence:{professor_transfer:transferEvidence,candy_inventory_before:candyInventoryBefore,candy_inventory_after:candyInventoryAfter},
        created_at:at,
      });
    }
    run('INSERT INTO pokemon_history(pokemon_id,event_at,event_type,before_json,after_json,reason,source_update_id) VALUES(?,?,?,?,?,?,?)',[
      pokemonId,at,'sent_to_professor',JSON.stringify(before),JSON.stringify({pokemon:after,professor_transfer:transferEvidence,candy_inventory_before:candyInventoryBefore,candy_inventory_after:candyInventoryAfter}),
      '使用者明確將寶可夢送給博士；寶可夢資料保留於 SQLite，active roster 隱藏。糖果只在使用者提供遊戲實際觀測數量時，以 canonical Candy family storage 的 DELTA_EVENT 增加。',sourceUpdateId,
    ]);
    const auditId=`MANUAL-${Date.now()}-${Math.random().toString(16).slice(2,6)}`;
    run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',[
      auditId,'manual-professor-transfer-1.2',at,at,'pokemon_box_professor_transfer',1,JSON.stringify({status:'applied',transfer:transferEvidence}),
    ]);
    run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',[
      auditId,0,'pokemon','sent_to_professor',JSON.stringify({pokemon_id:pokemonId}),JSON.stringify(before),JSON.stringify(after),'applied',
      candyInventoryApplied
        ?`寶可夢送給博士；資料保留，並依使用者實際觀測增加 ${candyName||'對應糖果'} ×${candyQuantity}，寫入 canonical Candy family storage。`
        :'寶可夢送給博士；資料保留、active roster 隱藏；未自行推算糖果。',
    ]);
    commit();await persist();
    trace('pokemon_sent_to_professor',{candy_conversion_status:candyConversionStatus,candy_inventory_applied:candyInventoryApplied,observed_candy_quantity:candyQuantity,quantity_authority:transferEvidence.quantity_authority,inventory_mutation:transferEvidence.inventory_mutation,candy_family_id:transferEvidence.candy_family_id,canonical_candy_id:transferEvidence.canonical_candy_id,candy_family_storage_authority:CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,deterministic_conversion_rule_status:PROFESSOR_TRANSFER_CANDY_RULE_STATUS});
    globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:data-changed',{detail:{reason:'pokemon_sent_to_professor',candy_inventory_changed:candyInventoryApplied}}));
    globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:pokemon-evaluation-input-changed',{detail:{pokemon_ids:[String(pokemonId)],reason:'pokemon_sent_to_professor'}}));
    globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:analysis-confirmed-applied',{detail:{pokemon_id:pokemonId,mode:'sent_to_professor',reason:'pokemon_sent_to_professor',compatibility_refresh_only:true}}));
    return {pokemon:after,transfer:transferEvidence,candy_inventory:candyInventoryAfter};
  }catch(error){rollback();throw error;}
}

export function professorTransferCandyGuidance(){
  return {
    deterministic_rule_status:PROFESSOR_TRANSFER_CANDY_RULE_STATUS,
    quantity_authority:PROFESSOR_TRANSFER_CANDY_AUTHORITY,
    candy_family_storage_authority:CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,
    automatic_quantity_inference:false,
    observed_quantity_supported:true,
    inventory_mutation:'OBSERVED_DELTA_INCREMENT_ONLY',
    storage_mutation_type:CANDY_MUTATION_TYPES.DELTA_EVENT,
    message:PROFESSOR_TRANSFER_CANDY_RULE_STATUS==='NOT_YET_VERIFIED'
      ?'平台尚未有 Evidence-backed 博士轉換糖果數量規則；請輸入遊戲實際顯示的糖果數量，或留空只完成送博士狀態。'
      :'可依已驗證規則處理。',
  };
}
