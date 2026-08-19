import {rows,run,persist,snapshot,begin,commit,rollback} from './database.js';
import {localIso} from './time-utils.js';
import {speciesCandyName} from './public-candy-master.js';
import {CANDY_CONVERSION_RULE_STATUS} from './resource-context.js';

export const PROFESSOR_TRANSFER_VERSION='pokemon-professor-transfer-2026-08-19-a';
export const PROFESSOR_TRANSFER_CANDY_RULE_STATUS=CANDY_CONVERSION_RULE_STATUS;

const now=()=>localIso();
const makeId=prefix=>`${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const trace=(event,detail={})=>{
  globalThis.UpdateCenterLiveDebug?.record?.(event,detail);
  globalThis.DebugTrace?.record?.('pokemon_roster',event,{status:'completed',details:detail});
};

function normalizeObservedCandyQuantity(value){
  if(value===null||value===undefined||value==='')return null;
  const quantity=Number(value);
  if(!Number.isInteger(quantity)||quantity<0)throw new Error('糖果數量必須是 0 以上整數，或留空表示尚未確認');
  return quantity;
}

function candyMasterForSpecies(species){
  return rows(`SELECT candy_id,candy_name,target_species_name,verification_status
    FROM candy_master WHERE candy_type='species' AND target_species_name=? LIMIT 1`,[species])[0]||null;
}

export async function transferPokemonToProfessor(pokemonId,{observedCandyQuantity=null}={}){
  const before=rows('SELECT * FROM pokemon WHERE pokemon_id=?',[pokemonId])[0]||null;
  if(!before)throw new Error('找不到寶可夢資料');
  if(before.status!=='active')throw new Error('只有 active 寶可夢可以送給博士');
  const species=before.current_species||before.species;
  const candyQuantity=normalizeObservedCandyQuantity(observedCandyQuantity);
  const candyMaster=candyMasterForSpecies(species);
  const candyName=candyMaster?.candy_name||speciesCandyName(species)||null;
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
      if(candyMaster?.candy_id){
        candyInventoryBefore=rows('SELECT * FROM candy_inventory WHERE candy_id=?',[candyMaster.candy_id])[0]||null;
        run(`INSERT INTO candy_inventory(candy_id,quantity,safe_reserve,updated_at,source_update_id)
          VALUES(?,?,0,?,?)
          ON CONFLICT(candy_id) DO UPDATE SET
            quantity=candy_inventory.quantity+excluded.quantity,
            updated_at=excluded.updated_at,
            source_update_id=excluded.source_update_id`,[candyMaster.candy_id,candyQuantity,at,sourceUpdateId]);
        candyInventoryAfter=rows('SELECT * FROM candy_inventory WHERE candy_id=?',[candyMaster.candy_id])[0]||null;
        candyInventoryApplied=true;
        candyConversionStatus='USER_OBSERVED_QUANTITY_APPLIED';
      }else{
        candyConversionStatus='CANDY_MASTER_MISSING';
      }
    }
    const after=rows('SELECT * FROM pokemon WHERE pokemon_id=?',[pokemonId])[0]||null;
    const transferEvidence={
      schema:'pokemon-sleep-professor-transfer/1.0',
      transfer_id:transferId,
      pokemon_id:pokemonId,
      pokemon_instance_id:before.pokemon_instance_id||null,
      species,
      candy_name:candyName,
      observed_candy_quantity:candyQuantity,
      candy_inventory_applied:candyInventoryApplied,
      candy_conversion_status:candyConversionStatus,
      deterministic_conversion_rule_status:PROFESSOR_TRANSFER_CANDY_RULE_STATUS,
      quantity_authority:candyQuantity===null?'NOT_OBSERVED':'USER_DIRECT_OBSERVATION',
      transferred_at:at,
      no_hard_delete:true,
    };
    run('INSERT INTO pokemon_history(pokemon_id,event_at,event_type,before_json,after_json,reason,source_update_id) VALUES(?,?,?,?,?,?,?)',[
      pokemonId,at,'sent_to_professor',JSON.stringify(before),JSON.stringify({pokemon:after,professor_transfer:transferEvidence,candy_inventory_before:candyInventoryBefore,candy_inventory_after:candyInventoryAfter}),
      '使用者明確將寶可夢送給博士；寶可夢資料保留於 SQLite，active roster 隱藏。糖果只在使用者提供遊戲實際觀測數量時增加。',sourceUpdateId,
    ]);
    const auditId=`MANUAL-${Date.now()}-${Math.random().toString(16).slice(2,6)}`;
    run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',[
      auditId,'manual-professor-transfer-1.0',at,at,'pokemon_box_professor_transfer',1,JSON.stringify({status:'applied',transfer:transferEvidence}),
    ]);
    run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',[
      auditId,0,'pokemon','sent_to_professor',JSON.stringify({pokemon_id:pokemonId}),JSON.stringify(before),JSON.stringify(after),'applied','寶可夢送給博士；資料保留、active roster 隱藏。',
    ]);
    commit();await persist();
    trace('pokemon_sent_to_professor',{candy_conversion_status:candyConversionStatus,candy_inventory_applied:candyInventoryApplied,observed_candy_quantity:candyQuantity,deterministic_conversion_rule_status:PROFESSOR_TRANSFER_CANDY_RULE_STATUS});
    globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:data-changed',{detail:{reason:'pokemon_sent_to_professor'}}));
    globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:pokemon-evaluation-input-changed',{detail:{pokemon_ids:[String(pokemonId)],reason:'pokemon_sent_to_professor'}}));
    return {pokemon:after,transfer:transferEvidence,candy_inventory:candyInventoryAfter};
  }catch(error){rollback();throw error;}
}

export function professorTransferCandyGuidance(){
  return {
    deterministic_rule_status:PROFESSOR_TRANSFER_CANDY_RULE_STATUS,
    automatic_quantity_inference:false,
    observed_quantity_supported:true,
    message:PROFESSOR_TRANSFER_CANDY_RULE_STATUS==='NOT_YET_VERIFIED'
      ?'平台尚未有 Evidence-backed 博士轉換糖果數量規則；請輸入遊戲實際顯示的糖果數量，或留空只完成送博士狀態。'
      :'可依已驗證規則處理。',
  };
}
