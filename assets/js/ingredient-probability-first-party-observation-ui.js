import {rows} from './database.js';
import {resolvePublicSpeciesFormSourceKeys} from './public-species-form-zh-tw-identity-resolver.js';
import {publicSpeciesFormRosterRow} from './public-pokemon-species-form-roster.js';
import {resolveCandidateBaseBerryOutput} from './base-berry-output-contract.js';
import {
  FIRST_PARTY_OBSERVATION_MODE,
  FIRST_PARTY_OBSERVATION_SOURCE,
} from './ingredient-probability-first-party-observation-contract.js';
import {
  buildFirstPartyIngredientObservationUpdatePackage,
  buildDeidentifiedFirstPartyIngredientAggregate,
} from './ingredient-probability-first-party-observation-update.js';

export const E3C6B_FIRST_PARTY_OBSERVATION_UI_VERSION='e3c6b-first-party-observation-ui-2026-08-15-a';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>String(value??'').normalize('NFKC').trim();
const splitRefs=value=>String(value??'').split(/[\n,，]+/).map(text).filter(Boolean);
const percent=value=>Number.isFinite(Number(value))?`${(Number(value)*100).toFixed(2)}%`:'—';
const booleanChecked=(form,name)=>Boolean(form.elements.namedItem(name)?.checked);
const integerValue=(form,name)=>{
  const value=Number(form.elements.namedItem(name)?.value);
  return Number.isInteger(value)?value:null;
};

function candidateRows(){
  return rows(`SELECT pokemon_id,original_label,nickname,current_species,species,level,specialty,nature,nature_bonus,nature_penalty,carry_limit
    FROM pokemon WHERE status='active' AND level BETWEEN 1 AND 29 ORDER BY level DESC,COALESCE(original_label,current_species,species),pokemon_id`);
}
function candidateSubskills(pokemonId,level){
  return rows('SELECT unlock_level,subskill_name,is_unlocked FROM pokemon_subskills WHERE pokemon_id=? AND unlock_level<=? ORDER BY unlock_level',[pokemonId,level]);
}
function candidateIngredients(pokemonId){
  return rows('SELECT unlock_level,ingredient_name,quantity FROM pokemon_ingredients WHERE pokemon_id=? AND unlock_level=1 ORDER BY unlock_level',[pokemonId]);
}
function hasIngredientRateModifier(candidate,subskills){
  const effects=[candidate?.nature_bonus,candidate?.nature_penalty].map(text);
  if(effects.some(value=>value==='食材機率'||value==='食材發現率'))return true;
  return subskills.some(row=>['食材機率提升S','食材機率提升M'].includes(text(row.subskill_name)));
}
function newObservationId(){
  const now=new Date(),stamp=now.toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
  const random=globalThis.crypto?.getRandomValues?Array.from(globalThis.crypto.getRandomValues(new Uint8Array(3)),byte=>byte.toString(16).padStart(2,'0')).join(''):Math.random().toString(16).slice(2,8);
  return `FPO-${stamp}-${random}`;
}
function downloadJson(payload,name){
  const anchor=document.createElement('a');
  anchor.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  anchor.download=name;
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(anchor.href),1000);
}

function renderStoredSummary(root){
  const target=root.querySelector('#e3c6bStoredSummary');
  if(!target)return;
  let stored=[];
  try{stored=rows('SELECT * FROM ingredient_probability_observations ORDER BY captured_at DESC,observation_id DESC');}catch{target.textContent='資料表尚未就緒；完成 SQLite migration 後會自動載入。';return;}
  const aggregate=buildDeidentifiedFirstPartyIngredientAggregate(stored);
  const accepted=stored.filter(row=>row.status==='ACCEPTED_RAW_OBSERVATION').length;
  const rejected=stored.length-accepted;
  const body=aggregate.groups.length?aggregate.groups.map(row=>`<tr><td>${esc(row.source_key)}</td><td>${row.observation_count}</td><td>${row.ingredient_help_event_count}/${row.total_help_event_count}</td><td>${percent(row.observed_fraction)}</td><td>${percent(row.wilson_95?.lower)}–${percent(row.wilson_95?.upper)}</td></tr>`).join(''):'<tr><td colspan="5">尚無可聚合的 accepted observation</td></tr>';
  target.innerHTML=`<p><b>本機原始觀測：</b>${stored.length}；accepted=${accepted}；review=${rejected}。Rejected 只保留供覆核，永不進入統計。</p><div class="table-wrap"><table><thead><tr><th>source_key</th><th>窗口</th><th>食材/總 help</th><th>observed</th><th>Wilson 95%</th></tr></thead><tbody>${body}</tbody></table></div>`;
  const exportButton=root.querySelector('#e3c6bExportAggregateBtn');
  if(exportButton)exportButton.disabled=!aggregate.groups.length;
}

function resolveCandidateContext(root,pokemonId){
  const candidate=candidateRows().find(row=>row.pokemon_id===pokemonId)||null;
  const sourceSelect=root.querySelector('#e3c6bSourceKey');
  const context=root.querySelector('#e3c6bCandidateContext');
  if(!candidate){sourceSelect.innerHTML='<option value="">請先選擇寶可夢</option>';context.textContent='';return null;}
  const displayName=text(candidate.current_species||candidate.species);
  const identity=resolvePublicSpeciesFormSourceKeys(displayName);
  const sourceKeys=identity.status==='MATCH'?[...identity.source_keys]:[];
  sourceSelect.innerHTML=sourceKeys.length?sourceKeys.map(key=>`<option value="${esc(key)}">${esc(displayName)} · ${esc(key)}</option>`).join(''):'<option value="">Public species/form identity 未能 exact resolve</option>';
  const subskills=candidateSubskills(candidate.pokemon_id,Number(candidate.level));
  const ingredients=candidateIngredients(candidate.pokemon_id);
  const berryOutput=resolveCandidateBaseBerryOutput({
    level:Number(candidate.level),specialty:candidate.specialty,
    unlocked_subskills:subskills,unlocked_subskill_slot_count:subskills.length,
  });
  const ingredientModifier=hasIngredientRateModifier(candidate,subskills);
  const blockers=[];
  if(sourceKeys.length===0)blockers.push('Public species/form identity 無 exact source_key');
  if(ingredients.length!==1||!text(ingredients[0]?.ingredient_name)||!Number.isInteger(Number(ingredients[0]?.quantity))||Number(ingredients[0]?.quantity)<=0)blockers.push('Lv1 食材槽/數量不完整');
  if(berryOutput.status!=='ACTIVE_VERIFIED')blockers.push(`莓果單次產量不可 deterministic resolve：${berryOutput.status}`);
  if(!Number.isInteger(Number(candidate.carry_limit))||Number(candidate.carry_limit)<=0)blockers.push('持有上限缺值');
  if(ingredientModifier)blockers.push('此個體目前有 Nature / 食材機率副技能修正，不適合 base-rate isolation');
  context.innerHTML=`<b>${esc(candidate.original_label||displayName)} · Lv.${esc(candidate.level)}</b><br>Public identity：${esc(identity.status)}；source keys=${sourceKeys.length}<br>Lv1 食材：${esc(ingredients[0]?.ingredient_name||'—')} × ${esc(ingredients[0]?.quantity??'—')}；莓果結果=${esc(berryOutput.total_output??'—')} 個/help；持有上限=${esc(candidate.carry_limit??'—')}<br>個體食材機率修正：${ingredientModifier?'<span class="status-conflict">有，將被 evaluator 拒絕</span>':'無（依目前 Nature + 已解鎖副技能）'}${blockers.length?`<div class="status-conflict">前置注意：${blockers.map(esc).join('；')}</div>`:''}`;
  return {candidate,identity,sourceKeys,subskills,ingredients,berryOutput,ingredientModifier,blockers};
}

function buildInput(root){
  const form=root.querySelector('#e3c6bCaptureForm');
  const pokemonId=text(form.elements.namedItem('pokemon_id')?.value);
  const context=resolveCandidateContext(root,pokemonId);
  if(!context)throw new Error('請先選擇 Lv1–29 寶可夢');
  const sourceKey=text(form.elements.namedItem('source_key')?.value).toUpperCase();
  const roster=publicSpeciesFormRosterRow(sourceKey);
  if(!roster)throw new Error('source_key 無法對應 governed public roster');
  const refs=splitRefs(form.elements.namedItem('observation_evidence_refs')?.value);
  const observedInventory=integerValue(form,'inventory_items_before_collection');
  const berryItems=integerValue(form,'berry_items_collected');
  const ingredientItems=integerValue(form,'ingredient_items_collected');
  const environmentConfirmed=booleanChecked(form,'environment_clear');
  const candidate=context.candidate;
  return {
    observation_id:newObservationId(),
    observation_source:FIRST_PARTY_OBSERVATION_SOURCE,
    observation_mode:FIRST_PARTY_OBSERVATION_MODE,
    source_key:sourceKey,
    canonical_species_form_id:roster.canonical_species_form_id,
    species_form_identity_confirmed:booleanChecked(form,'species_identity_confirmed'),
    player_private_identity_included:false,
    observation_evidence_refs:refs,
    level:Number(candidate.level),
    ingredient_slots:context.ingredients.map(row=>({unlock_level:Number(row.unlock_level),ingredient_name:row.ingredient_name,quantity:Number(row.quantity)})),
    individual_ingredient_rate_modifier_state:context.ingredientModifier?'ACTIVE_MODIFIER_PRESENT':'NONE_ACTIVE_CONFIRMED',
    environment_ingredient_rate_modifier_state:environmentConfirmed?'NONE_ACTIVE_CONFIRMED':'UNKNOWN',
    inventory_empty_at_window_start:booleanChecked(form,'inventory_empty_at_window_start'),
    collection_before_inventory_overflow_confirmed:booleanChecked(form,'collection_before_inventory_overflow_confirmed'),
    sneaky_snacking_or_overflow_observed:!booleanChecked(form,'no_sneaky_or_overflow'),
    helper_whistle_used:!booleanChecked(form,'no_helper_whistle'),
    external_extra_help_effect_used:!booleanChecked(form,'no_extra_help'),
    non_help_item_contamination:!booleanChecked(form,'no_non_help_contamination'),
    collection_counts_complete:booleanChecked(form,'collection_counts_complete'),
    external_rate_value_used_to_reconstruct_events:!booleanChecked(form,'no_external_rate_reconstruction'),
    berry_items_collected:berryItems,
    ingredient_items_collected:ingredientItems,
    berry_items_per_help:context.berryOutput.total_output,
    berry_items_per_help_authority:context.berryOutput.status==='ACTIVE_VERIFIED'?'DETERMINISTIC_PLATFORM_VERIFIED':'UNVERIFIED',
    inventory_items_before_collection:observedInventory,
    inventory_capacity:Number(candidate.carry_limit),
  };
}

function mount(){
  const host=document.getElementById('updateCenterDynamicContent');
  if(!host||document.getElementById('e3c6bFirstPartyPanel'))return;
  const candidates=candidateRows();
  const panel=document.createElement('section');
  panel.id='e3c6bFirstPartyPanel';
  panel.className='panel';
  panel.innerHTML=`<h3>Ingredient Probability 第一手觀測（E3C-6B）</h3>
    <p class="notice">只接受手動輸入的 Lv1–29 單食材槽觀察窗口。此功能不使用 OCR 推算 help event；原始 observation/evidence 只寫入本機 SQLite。Production 仍維持 4/7，Ingredient Probability 僅為 <b>OBSERVED_PARTIAL_ONLY</b>。</p>
    <form id="e3c6bCaptureForm" class="edit-grid">
      <label class="edit-field full"><span>本機寶可夢（僅用於帶入 level / slot / berry output；pokemon_id 不會進 Update Package）</span><select name="pokemon_id" id="e3c6bPokemonSelect"><option value="">請選擇</option>${candidates.map(row=>`<option value="${esc(row.pokemon_id)}">${esc(row.original_label||row.current_species||row.species)} · Lv.${esc(row.level)}${row.nickname?` · ${esc(row.nickname)}`:''}</option>`).join('')}</select></label>
      <label class="edit-field full"><span>Governed source_key / form</span><select name="source_key" id="e3c6bSourceKey"><option value="">請先選擇寶可夢</option></select></label>
      <div id="e3c6bCandidateContext" class="notice full"></div>
      <label class="edit-field"><span>收取時莓果物品數（手動）</span><input name="berry_items_collected" type="number" min="0" step="1" inputmode="numeric"></label>
      <label class="edit-field"><span>收取時食材物品數（手動）</span><input name="ingredient_items_collected" type="number" min="0" step="1" inputmode="numeric"></label>
      <label class="edit-field"><span>收取前背包實際總物品數</span><input name="inventory_items_before_collection" type="number" min="0" step="1" inputmode="numeric"></label>
      <label class="edit-field full"><span>本次 evidence refs（截圖檔名／人工紀錄 ID；換行或逗號分隔）</span><textarea name="observation_evidence_refs" placeholder="例如 Screenshot_20260815-173000.png&#10;manual-window-20260815-01"></textarea></label>
      <fieldset class="edit-field full"><legend>必須逐項確認的隔離條件</legend>
        <label><input type="checkbox" name="species_identity_confirmed"> 已確認目前物種／型態與上方 source_key 一致</label><br>
        <label><input type="checkbox" name="environment_clear"> 本觀察窗口沒有活動／營地／其他環境食材機率修正</label><br>
        <label><input type="checkbox" name="inventory_empty_at_window_start"> 窗口開始時寶可夢持有欄為空</label><br>
        <label><input type="checkbox" name="collection_before_inventory_overflow_confirmed"> 已確認在持有上限前完成收取</label><br>
        <label><input type="checkbox" name="no_sneaky_or_overflow"> 未發生偷偷吃樹果／持有溢出</label><br>
        <label><input type="checkbox" name="no_helper_whistle"> 未使用幫手哨子</label><br>
        <label><input type="checkbox" name="no_extra_help"> 未使用額外立即幫忙效果</label><br>
        <label><input type="checkbox" name="no_non_help_contamination"> 沒有非普通 help 來源的物品混入</label><br>
        <label><input type="checkbox" name="collection_counts_complete"> 莓果／食材物品數已完整計數</label><br>
        <label><input type="checkbox" name="no_external_rate_reconstruction"> 沒有使用外部「食材機率」數值反推事件數</label>
      </fieldset>
      <div class="buttons full"><button type="submit">建立私密 Update Package → 更新中心</button><button type="button" id="e3c6bExportAggregateBtn">下載去識別聚合 JSON</button></div>
    </form>
    <div id="e3c6bBuildResult" class="notice"></div>
    <h4>本機觀測聚合</h4><div id="e3c6bStoredSummary"></div>`;
  host.prepend(panel);

  const form=panel.querySelector('#e3c6bCaptureForm');
  panel.querySelector('#e3c6bPokemonSelect').addEventListener('change',event=>resolveCandidateContext(panel,event.target.value));
  form.addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const payload=buildFirstPartyIngredientObservationUpdatePackage(buildInput(panel));
      const operation=payload.operations[0];
      const result=panel.querySelector('#e3c6bBuildResult');
      const accepted=operation.data.status==='ACCEPTED_RAW_OBSERVATION';
      result.innerHTML=`${accepted?'✅':'⚠️'} Observation：<b>${esc(operation.data.status)}</b>${operation.data.blockers.length?`；blockers=${operation.data.blockers.map(esc).join('、')}`:''}<br>已送入上方主更新中心。請依序執行「檢查結構 → Dry Run → 套用更新」。${accepted?'套用後才會納入本機聚合。':'即使套用也只會保留供 Review，絕不計入統計。'}`;
      globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:local-update-package-ready',{detail:{payload,origin:'E3C6B_FIRST_PARTY_MANUAL_CAPTURE'}}));
    }catch(error){panel.querySelector('#e3c6bBuildResult').innerHTML=`<span class="status-conflict">建立失敗：${esc(error?.message||error)}</span>`;}
  });
  panel.querySelector('#e3c6bExportAggregateBtn').addEventListener('click',()=>{
    const stored=rows('SELECT * FROM ingredient_probability_observations ORDER BY captured_at,observation_id');
    const aggregate=buildDeidentifiedFirstPartyIngredientAggregate(stored);
    if(!aggregate.groups.length)return alert('目前沒有 accepted observation 可匯出去識別聚合');
    downloadJson(aggregate,`pokemon_sleep_ingredient_probability_first_party_aggregate_${new Date().toISOString().slice(0,10)}.json`);
  });
  renderStoredSummary(panel);
}

function safeMount(){try{mount();}catch(error){console.warn('E3C-6B first-party observation UI deferred',error);}}
globalThis.addEventListener('pokemon-sleep:database-ready',()=>setTimeout(safeMount,0));
globalThis.addEventListener('pokemon-sleep:update-applied',event=>{
  if(event?.detail?.payload?.scenario!=='ingredient_probability_first_party_observation_update')return;
  const panel=document.getElementById('e3c6bFirstPartyPanel');
  if(panel)renderStoredSummary(panel);
});
