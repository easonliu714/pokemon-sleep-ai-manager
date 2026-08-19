import {rows} from './database.js';
import {transferPokemonToProfessor,professorTransferCandyGuidance} from './pokemon-professor-transfer.js';

export const PROFESSOR_TRANSFER_UI_VERSION='pokemon-professor-transfer-ui-2026-08-19-a';

let scheduled=false;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const trace=(event,detail={})=>{globalThis.UpdateCenterLiveDebug?.record?.(event,detail);globalThis.DebugTrace?.record?.('pokemon_roster',event,{status:'completed',details:detail});};

function pokemonForRow(row){
  const id=row?.dataset?.pokemonId;
  if(!id)return null;
  try{return rows('SELECT * FROM pokemon WHERE pokemon_id=?',[id])[0]||null;}catch{return null;}
}
function displayName(pokemon){return pokemon?.original_label||pokemon?.nickname||pokemon?.current_species||pokemon?.species||'未命名寶可夢';}

async function transferFromRow(row,button){
  const pokemon=pokemonForRow(row);
  if(!pokemon){alert('找不到這隻寶可夢的本機資料。');return;}
  const name=displayName(pokemon),species=pokemon.current_species||pokemon.species||'未確認物種';
  if(!confirm(`確定將「${name}」（${species}）送給博士？\n\n完成後會從 active 寶可夢盒消失，但 Pokémon row、歷程與 transfer evidence 仍保留在本機 SQLite。此操作不做 hard delete。`))return;
  const guidance=professorTransferCandyGuidance();
  const observed=prompt(`${guidance.message}\n\n若遊戲畫面已顯示本次獲得的「${species}的糖果」數量，請輸入整數。\n留空＝只完成送博士狀態，不自行猜糖果數量。\n按「取消」＝取消整個送博士操作。`,'');
  if(observed===null)return;
  const trimmed=String(observed).trim();
  button.disabled=true;button.textContent='處理中…';
  try{
    const result=await transferPokemonToProfessor(pokemon.pokemon_id,{observedCandyQuantity:trimmed===''?null:trimmed});
    const transfer=result.transfer;
    const candyMessage=transfer.candy_inventory_applied
      ?`已依你輸入的遊戲實際觀測值，增加 ${transfer.candy_name||'對應糖果'} ×${transfer.observed_candy_quantity}。`
      :transfer.observed_candy_quantity==null
        ?'未提供實際糖果數量，因此未修改糖果庫存。'
        :`已記錄實際糖果數量，但目前找不到可安全寫入的 Candy Master 對應；糖果庫存未自動修改。`;
    alert(`已送給博士：${name}\n${candyMessage}\n\n資料仍保留在 SQLite / pokemon_history。`);
    trace('professor_transfer_ui_completed',{candy_inventory_applied:Boolean(transfer.candy_inventory_applied),quantity_observed:transfer.observed_candy_quantity!=null});
  }catch(error){
    button.disabled=false;button.textContent='送給博士';
    alert(`送給博士失敗：${error?.message||error}`);
    trace('professor_transfer_ui_failed',{message:error?.message||String(error)});
  }
}

function decoratePokemonTable(){
  const table=document.getElementById('pokemonTable');if(!table)return;
  const head=table.tHead?.rows?.[0]||table.querySelector('thead tr');
  if(head&&!head.querySelector('[data-professor-transfer-head]')){
    const th=document.createElement('th');th.dataset.professorTransferHead='1';th.textContent='操作';head.append(th);
  }
  for(const row of table.querySelectorAll('tbody tr.pokemon-row')){
    if(row.querySelector('[data-professor-transfer-cell]'))continue;
    const td=document.createElement('td');td.dataset.professorTransferCell='1';
    const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='送給博士';button.dataset.professorTransfer='1';
    button.onclick=event=>{event.preventDefault();event.stopPropagation();transferFromRow(row,button);};
    td.append(button);row.append(td);
  }
}
function scheduleDecorate(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;decoratePokemonTable();});}

const observer=new MutationObserver(scheduleDecorate);
if(document.documentElement)observer.observe(document.documentElement,{subtree:true,childList:true});
globalThis.addEventListener?.('pokemon-sleep:data-changed',()=>setTimeout(scheduleDecorate,0));
scheduleDecorate();
trace('professor_transfer_ui_ready',{version:PROFESSOR_TRANSFER_UI_VERSION,soft_delete:true,automatic_candy_inference:false});
