import {rows} from './database.js';
import {resolvePublicSpeciesFormSourceKeys} from './public-species-form-zh-tw-identity-resolver.js';
import {publicSpeciesFormRosterRow} from './public-pokemon-species-form-roster.js';
import {resolveCandidateBaseBerryOutput} from './base-berry-output-contract.js';
import {
  FIRST_PARTY_OBSERVATION_MODE,
  FIRST_PARTY_OBSERVATION_MODES,
  FIRST_PARTY_OBSERVATION_SOURCE,
  FIRST_PARTY_OBSERVATION_STATUS,
  BERRY_COUNT_COMPLETENESS,
} from './ingredient-probability-first-party-observation-contract.js';
import {resolveFirstPartyObservationUiCandidate} from './ingredient-probability-first-party-observation-ui-eligibility.js';
import {
  buildFirstPartyIngredientObservationUpdatePackage,
  buildDeidentifiedFirstPartyIngredientAggregate,
} from './ingredient-probability-first-party-observation-update.js';

export const E3C6B_FIRST_PARTY_OBSERVATION_UI_VERSION='e3c6b-first-party-observation-ui-2026-08-15-a';
export const E3C6D_FIRST_PARTY_OBSERVATION_UI_VERSION='e3c6d-first-party-observation-ui-2026-08-18-a';
export const E3C6F_FIRST_PARTY_OBSERVATION_UI_VERSION='e3c6f-first-party-observation-ui-2026-08-21-a';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>String(value??'').normalize('NFKC').trim();
const splitRefs=value=>String(value??'').split(/[\n,，]+/).map(text).filter(Boolean);
const percent=value=>Number.isFinite(Number(value))?`${(Number(value)*100).toFixed(2)}%`:'—';
const booleanChecked=(form,name)=>Boolean(form.elements.namedItem(name)?.checked);
const integerValue=(form,name)=>{
  const node=form.elements.namedItem(name),raw=text(node?.value);
  if(raw==='')return null;
  const value=Number(raw);
  return Number.isInteger(value)?value:null;
};
const modeLabel=mode=>mode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY?'Lv30+ 多槽等量':mode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY?'Lv30+ 多槽不同食材／不等量':'Lv1–29 單槽';
let seriesState={pokemon_id:null,series_id:null,next_window:1};

function candidateSubskills(pokemonId,level){
  return rows('SELECT unlock_level,subskill_name,is_unlocked FROM pokemon_subskills WHERE pokemon_id=? AND unlock_level<=? ORDER BY unlock_level',[pokemonId,level]);
}
function candidateIngredients(pokemonId,level){
  return rows('SELECT unlock_level,ingredient_name,quantity FROM pokemon_ingredients WHERE pokemon_id=? AND unlock_level<=? ORDER BY unlock_level',[pokemonId,level]);
}
function hasIngredientRateModifier(candidate,subskills){
  const effects=[candidate?.nature_bonus,candidate?.nature_penalty].map(text);
  if(effects.some(value=>value==='食材機率'||value==='食材發現率'))return true;
  return subskills.some(row=>['食材機率提升S','食材機率提升M'].includes(text(row.subskill_name)));
}
function candidateRows(){
  const baseRows=rows(`SELECT pokemon_id,original_label,nickname,current_species,species,level,specialty,nature,nature_bonus,nature_penalty,carry_limit
    FROM pokemon WHERE status='active' AND level>=1 ORDER BY level DESC,COALESCE(original_label,current_species,species),pokemon_id`);
  return baseRows.map(candidate=>{
    const level=Number(candidate.level);
    const subskills=candidateSubskills(candidate.pokemon_id,level);
    const ingredients=candidateIngredients(candidate.pokemon_id,level);
    const ingredientModifier=hasIngredientRateModifier(candidate,subskills);
    const uiEligibility=resolveFirstPartyObservationUiCandidate({level,ingredient_slots:ingredients,individual_ingredient_rate_modifier_present:ingredientModifier});
    return {...candidate,subskills,ingredients,ingredientModifier,uiEligibility};
  }).filter(row=>row.uiEligibility.visible);
}
function randomToken(bytes=3){
  return globalThis.crypto?.getRandomValues?Array.from(globalThis.crypto.getRandomValues(new Uint8Array(bytes)),byte=>byte.toString(16).padStart(2,'0')).join(''):Math.random().toString(16).slice(2,2+bytes*2);
}
function newObservationId(){
  const stamp=new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
  return `FPO-${stamp}-${randomToken()}`;
}
function newSeriesId(){
  const stamp=new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,8);
  return `FPS-${stamp}-${randomToken(4)}`;
}
function downloadJson(payload,name){
  const anchor=document.createElement('a');
  anchor.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(anchor.href),1000);
}
function ensureSeries(pokemonId){
  const id=text(pokemonId);
  if(seriesState.pokemon_id!==id||!seriesState.series_id)seriesState={pokemon_id:id,series_id:newSeriesId(),next_window:1};
  return seriesState;
}
function updateSeriesUi(root){
  const target=root.querySelector('#e3c6fSeriesContext');if(!target)return;
  if(!seriesState.pokemon_id){target.textContent='選擇寶可夢後建立觀測 series。';return;}
  target.innerHTML=`觀測 series：<b>${esc(seriesState.series_id)}</b>；下一筆窗口：<b>#${seriesState.next_window}</b>。每個窗口獨立保存，統計只合併可證明分母完整的 accepted window。`;
}
function clearWindowCounts(root){
  for(const selector of ['[name="berry_items_collected"]','[name="ingredient_items_collected"]','[name="inventory_items_before_collection"]','[name="observation_evidence_refs"]','[data-e3c6f-slot-count]']){
    root.querySelectorAll(selector).forEach(node=>{node.value='';});
  }
}

function renderStoredSummary(root){
  const target=root.querySelector('#e3c6bStoredSummary');if(!target)return;
  let stored=[];
  try{stored=rows('SELECT * FROM ingredient_probability_observations ORDER BY captured_at DESC,observation_id DESC');}catch{target.textContent='資料表尚未就緒；完成 SQLite migration 後會自動載入。';return;}
  const aggregate=buildDeidentifiedFirstPartyIngredientAggregate(stored);
  const accepted=stored.filter(row=>row.status===FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION).length;
  const partial=stored.filter(row=>row.status===FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_PARTIAL_OBSERVATION).length;
  const review=stored.length-accepted-partial;
  const body=aggregate.groups.length?aggregate.groups.map(row=>`<tr><td>${esc(row.source_key)}</td><td>${row.observation_count}</td><td>${row.partial_window_count||0}</td><td>${row.ingredient_help_event_count}/${row.total_help_event_count}</td><td>${percent(row.observed_fraction)}</td><td>${percent(row.wilson_95?.lower)}–${percent(row.wilson_95?.upper)}</td></tr>`).join(''):'<tr><td colspan="6">尚無可聚合的完整分母 accepted observation；partial window 會保留但不進機率估計。</td></tr>';
  target.innerHTML=`<p><b>本機原始觀測：</b>${stored.length}；accepted=${accepted}；partial=${partial}；review=${review}。Partial 只保留可重建的食材 numerator；樹果分母疑似被截尾時永不進入機率統計。</p><div class="table-wrap"><table><thead><tr><th>source_key</th><th>完整窗口</th><th>partial</th><th>食材/總 help</th><th>observed</th><th>Wilson 95%</th></tr></thead><tbody>${body}</tbody></table></div>`;
  const exportButton=root.querySelector('#e3c6bExportAggregateBtn');if(exportButton)exportButton.disabled=!stored.length;
}

function renderSlotCountInputs(root,context){
  const host=root.querySelector('#e3c6fPerSlotCounts');
  const aggregateField=root.querySelector('#e3c6fAggregateIngredientField');
  if(!host||!aggregateField)return;
  const distinct=context?.observationMode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY;
  aggregateField.classList.toggle('hidden',distinct);
  if(!distinct){host.innerHTML='';host.classList.add('hidden');return;}
  host.classList.remove('hidden');
  host.innerHTML=`<div class="notice full"><b>不同食材／不等量模式：</b>請逐槽輸入本次實際收到的食材物品數。平台只在每槽數量可被該槽單次產量整除時重建 ingredient-help；不使用 slot selection 機率反推。</div>${context.ingredients.map(row=>`<label class="edit-field"><span>Lv.${esc(row.unlock_level)} ${esc(row.ingredient_name)}（每次 ×${esc(row.quantity)}）</span><input data-e3c6f-slot-count name="ingredient_slot_count_${esc(row.unlock_level)}" type="number" min="0" step="1" inputmode="numeric"></label>`).join('')}`;
}

function resolveCandidateContext(root,pokemonId){
  const candidate=candidateRows().find(row=>row.pokemon_id===pokemonId)||null;
  const sourceSelect=root.querySelector('#e3c6bSourceKey');
  const context=root.querySelector('#e3c6bCandidateContext');
  if(!candidate){sourceSelect.innerHTML='<option value="">請先選擇寶可夢</option>';context.textContent='';renderSlotCountInputs(root,null);seriesState={pokemon_id:null,series_id:null,next_window:1};updateSeriesUi(root);return null;}
  ensureSeries(candidate.pokemon_id);updateSeriesUi(root);
  const displayName=text(candidate.current_species||candidate.species);
  const identity=resolvePublicSpeciesFormSourceKeys(displayName);
  const sourceKeys=identity.status==='MATCH'?[...identity.source_keys]:[];
  sourceSelect.innerHTML=sourceKeys.length?sourceKeys.map(key=>`<option value="${esc(key)}">${esc(displayName)} · ${esc(key)}</option>`).join(''):'<option value="">Public species/form identity 未能 exact resolve</option>';
  const subskills=candidate.subskills,ingredients=candidate.ingredients;
  const berryOutput=resolveCandidateBaseBerryOutput({level:Number(candidate.level),specialty:candidate.specialty,unlocked_subskills:subskills,unlocked_subskill_slot_count:subskills.length});
  const ingredientModifier=candidate.ingredientModifier;
  const observationMode=candidate.uiEligibility.observation_mode||FIRST_PARTY_OBSERVATION_MODE;
  const ingredientSummary=ingredients.length?ingredients.map(row=>`Lv.${esc(row.unlock_level)} ${esc(row.ingredient_name||'—')} × ${esc(row.quantity??'—')}`).join('；'):'—';
  const blockers=[...candidate.uiEligibility.blockers];
  if(sourceKeys.length===0)blockers.push('Public species/form identity 無 exact source_key');
  if(berryOutput.status!=='ACTIVE_VERIFIED')blockers.push(`莓果單次產量不可 deterministic resolve：${berryOutput.status}`);
  if(!Number.isInteger(Number(candidate.carry_limit))||Number(candidate.carry_limit)<=0)blockers.push('持有上限缺值');
  if(ingredientModifier)blockers.push('此個體目前有 Nature / 食材機率副技能修正，不適合 base-rate isolation');
  context.innerHTML=`<b>${esc(candidate.original_label||displayName)} · Lv.${esc(candidate.level)}</b><br>觀測模式：<b>${esc(modeLabel(observationMode))}</b><br>Public identity：${esc(identity.status)}；source keys=${sourceKeys.length}<br>已解鎖食材：${ingredientSummary}；莓果結果=${esc(berryOutput.total_output??'—')} 個/help；持有上限=${esc(candidate.carry_limit??'—')}<br>個體食材機率修正：${ingredientModifier?'<span class="status-conflict">有，將被 evaluator 拒絕</span>':'無（依目前 Nature + 已解鎖副技能）'}${blockers.length?`<div class="status-conflict">前置注意：${[...new Set(blockers)].map(esc).join('；')}</div>`:''}`;
  const resolved={candidate,identity,sourceKeys,subskills,ingredients,berryOutput,ingredientModifier,observationMode,blockers};
  renderSlotCountInputs(root,resolved);
  return resolved;
}

function buildInput(root){
  const form=root.querySelector('#e3c6bCaptureForm');
  const pokemonId=text(form.elements.namedItem('pokemon_id')?.value);
  const context=resolveCandidateContext(root,pokemonId);
  if(!context)throw new Error('請先選擇符合 E3C-6B/6D/6F Gate 的寶可夢');
  const sourceKey=text(form.elements.namedItem('source_key')?.value).toUpperCase();
  const roster=publicSpeciesFormRosterRow(sourceKey);if(!roster)throw new Error('source_key 無法對應 governed public roster');
  const refs=splitRefs(form.elements.namedItem('observation_evidence_refs')?.value);
  const observedInventory=integerValue(form,'inventory_items_before_collection');
  const berryItems=integerValue(form,'berry_items_collected');
  const environmentConfirmed=booleanChecked(form,'environment_clear');
  const candidate=context.candidate;
  const series=ensureSeries(pokemonId);
  let ingredientItems=integerValue(form,'ingredient_items_collected');
  const ingredientSlots=context.ingredients.map(row=>({unlock_level:Number(row.unlock_level),ingredient_name:row.ingredient_name,quantity:Number(row.quantity)}));
  if(context.observationMode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY){
    let total=0,complete=true;
    for(const slot of ingredientSlots){
      const count=integerValue(form,`ingredient_slot_count_${slot.unlock_level}`);
      slot.observed_item_count=count;
      if(count===null)complete=false;else total+=count;
    }
    ingredientItems=complete?total:null;
  }
  return {
    observation_id:newObservationId(),observation_series_id:series.series_id,window_sequence:series.next_window,
    observation_source:FIRST_PARTY_OBSERVATION_SOURCE,observation_mode:context.observationMode,
    source_key:sourceKey,canonical_species_form_id:roster.canonical_species_form_id,
    species_form_identity_confirmed:booleanChecked(form,'species_identity_confirmed'),player_private_identity_included:false,
    observation_evidence_refs:refs,level:Number(candidate.level),ingredient_slots:ingredientSlots,
    individual_ingredient_rate_modifier_state:context.ingredientModifier?'ACTIVE_MODIFIER_PRESENT':'NONE_ACTIVE_CONFIRMED',
    environment_ingredient_rate_modifier_state:environmentConfirmed?'NONE_ACTIVE_CONFIRMED':'UNKNOWN',
    inventory_empty_at_window_start:booleanChecked(form,'inventory_empty_at_window_start'),
    collection_before_inventory_overflow_confirmed:booleanChecked(form,'collection_before_inventory_overflow_confirmed'),
    sneaky_snacking_or_overflow_observed:!booleanChecked(form,'no_sneaky_or_overflow'),helper_whistle_used:!booleanChecked(form,'no_helper_whistle'),
    external_extra_help_effect_used:!booleanChecked(form,'no_extra_help'),non_help_item_contamination:!booleanChecked(form,'no_non_help_contamination'),
    collection_counts_complete:booleanChecked(form,'collection_counts_complete'),external_rate_value_used_to_reconstruct_events:!booleanChecked(form,'no_external_rate_reconstruction'),
    berry_items_collected:berryItems,ingredient_items_collected:ingredientItems,
    berry_items_per_help:context.berryOutput.total_output,berry_items_per_help_authority:context.berryOutput.status==='ACTIVE_VERIFIED'?'DETERMINISTIC_PLATFORM_VERIFIED':'UNVERIFIED',
    inventory_items_before_collection:observedInventory,inventory_capacity:Number(candidate.carry_limit),
    berry_count_completeness_status:text(form.elements.namedItem('berry_count_completeness_status')?.value)||BERRY_COUNT_COMPLETENESS.POSSIBLY_CENSORED_BY_SNORLAX,
  };
}

function mount(){
  const host=document.getElementById('updateCenterDynamicContent');if(!host||document.getElementById('e3c6bFirstPartyPanel'))return;
  const candidates=candidateRows();
  const panel=document.createElement('section');panel.id='e3c6bFirstPartyPanel';panel.className='panel';
  panel.innerHTML=`<h3>Ingredient Probability 第一手觀測（E3C-6B / E3C-6D / E3C-6F）</h3>
    <p class="notice">手動輸入觀察窗口，不使用 OCR/AI 推算 help event。E3C-6F 新增「不同食材、不同單次 quantity」的逐槽計數，以及可重複 series/window。<b>重要：</b>如果樹果可能在採收時直接被卡比獸吃掉，請保留預設「可能被截尾」；該窗口仍會保存可重建的食材 numerator，但不會假裝有完整分母，也不會進 Ingredient Probability 統計。Production 仍維持 4/7。</p>
    <div id="e3c6fSeriesContext" class="notice">選擇寶可夢後建立觀測 series。</div>
    <form id="e3c6bCaptureForm" class="edit-grid">
      <label class="edit-field full"><span>本機寶可夢（pokemon_id 只在本機選擇用，不進 Update Package）</span><select name="pokemon_id" id="e3c6bPokemonSelect"><option value="">請選擇</option>${candidates.map(row=>`<option value="${esc(row.pokemon_id)}">${esc(row.original_label||row.current_species||row.species)} · Lv.${esc(row.level)} · ${esc(modeLabel(row.uiEligibility.observation_mode))}${row.nickname?` · ${esc(row.nickname)}`:''}</option>`).join('')}</select></label>
      <label class="edit-field full"><span>Governed source_key / form</span><select name="source_key" id="e3c6bSourceKey"><option value="">請先選擇寶可夢</option></select></label>
      <div id="e3c6bCandidateContext" class="notice full"></div>
      <label class="edit-field"><span>畫面可見莓果物品數（手動）</span><input name="berry_items_collected" type="number" min="0" step="1" inputmode="numeric"></label>
      <label class="edit-field"><span>莓果計數完整性</span><select name="berry_count_completeness_status"><option value="POSSIBLY_CENSORED_BY_SNORLAX" selected>可能被卡比獸直接吃掉／無法確認完整（預設安全）</option><option value="COMPLETE_CONFIRMED">已能明確確認本窗口莓果計數完整</option></select></label>
      <label id="e3c6fAggregateIngredientField" class="edit-field"><span>收取時食材物品總數（手動）</span><input name="ingredient_items_collected" type="number" min="0" step="1" inputmode="numeric"></label>
      <div id="e3c6fPerSlotCounts" class="full hidden"></div>
      <label class="edit-field"><span>收取前畫面顯示的持有總物品數（若莓果可能被吃掉可只照畫面抄錄）</span><input name="inventory_items_before_collection" type="number" min="0" step="1" inputmode="numeric"></label>
      <label class="edit-field full"><span>本次 evidence refs（截圖檔名／人工紀錄 ID；換行或逗號分隔）</span><textarea name="observation_evidence_refs" placeholder="例如 Screenshot_20260821-120000.png&#10;manual-window-01"></textarea></label>
      <fieldset class="edit-field full"><legend>必須逐項確認的隔離條件</legend>
        <label><input type="checkbox" name="species_identity_confirmed"> 已確認目前物種／型態與上方 source_key 一致</label><br>
        <label><input type="checkbox" name="environment_clear"> 本觀察窗口沒有活動／營地／其他環境食材機率修正</label><br>
        <label><input type="checkbox" name="inventory_empty_at_window_start"> 窗口開始時寶可夢持有欄為空</label><br>
        <label><input type="checkbox" name="collection_before_inventory_overflow_confirmed"> 已確認在持有上限前完成收取</label><br>
        <label><input type="checkbox" name="no_sneaky_or_overflow"> 未發生偷偷吃樹果／持有溢出</label><br>
        <label><input type="checkbox" name="no_helper_whistle"> 未使用幫手哨子</label><br>
        <label><input type="checkbox" name="no_extra_help"> 未使用額外立即幫忙效果</label><br>
        <label><input type="checkbox" name="no_non_help_contamination"> 沒有非普通 help 來源的物品混入</label><br>
        <label><input type="checkbox" name="collection_counts_complete"> 本次畫面可見數量與逐槽食材數已完整抄錄（不代表樹果未被卡比獸直接吃掉）</label><br>
        <label><input type="checkbox" name="no_external_rate_reconstruction"> 沒有使用外部「食材機率」數值反推事件數</label>
      </fieldset>
      <div class="notice full"><b>多次觀測：</b>建議同一隻寶可夢輸入多個獨立短窗口，避免單一窗口剛好落在奇數／偶數 help 組合造成代表性差。但多次觀測只能降低一般抽樣波動；如果每次樹果都可能被系統性少算，這些窗口仍會標成 partial，不會用平均值掩蓋截尾偏差。</div>
      <div class="buttons full"><button type="submit">建立本窗口私密 Update Package → 更新中心</button><button type="button" id="e3c6bExportAggregateBtn">下載去識別聚合 JSON</button></div>
    </form>
    <div id="e3c6bBuildResult" class="notice"></div><h4>本機觀測聚合</h4><div id="e3c6bStoredSummary"></div>`;
  host.prepend(panel);

  const form=panel.querySelector('#e3c6bCaptureForm');
  panel.querySelector('#e3c6bPokemonSelect').addEventListener('change',event=>{resolveCandidateContext(panel,event.target.value);clearWindowCounts(panel);});
  form.addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const input=buildInput(panel),payload=buildFirstPartyIngredientObservationUpdatePackage(input),operation=payload.operations[0],result=panel.querySelector('#e3c6bBuildResult');
      const accepted=operation.data.status===FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION;
      const partial=operation.data.status===FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_PARTIAL_OBSERVATION;
      result.innerHTML=`${accepted?'✅':partial?'🟡':'⚠️'} Observation：<b>${esc(operation.data.status)}</b> · series=${esc(input.observation_series_id)} #${esc(input.window_sequence)}${operation.data.blockers.length?`；blockers=${operation.data.blockers.map(esc).join('、')}`:''}${operation.data.partial_reasons?.length?`；partial=${operation.data.partial_reasons.map(esc).join('、')}`:''}<br>已送入上方主更新中心。請依序執行「檢查結構 → Dry Run → 套用更新」。${accepted?'套用後會納入本機統計聚合。':partial?'套用後保存食材 numerator，但因樹果分母不完整，不進機率估計。':'套用後只保留供 Review，絕不計入統計。'}`;
      const origin=input.observation_mode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY?'E3C6F_FIRST_PARTY_DISTINCT_SLOT_MANUAL_CAPTURE':input.observation_mode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY?'E3C6D_FIRST_PARTY_MULTI_SLOT_MANUAL_CAPTURE':'E3C6B_FIRST_PARTY_MANUAL_CAPTURE';
      globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:local-update-package-ready',{detail:{payload,origin}}));
      seriesState.next_window+=1;updateSeriesUi(panel);clearWindowCounts(panel);
    }catch(error){panel.querySelector('#e3c6bBuildResult').innerHTML=`<span class="status-conflict">建立失敗：${esc(error?.message||error)}</span>`;}
  });
  panel.querySelector('#e3c6bExportAggregateBtn').addEventListener('click',()=>{
    const stored=rows('SELECT * FROM ingredient_probability_observations ORDER BY captured_at,observation_id');
    if(!stored.length)return alert('目前沒有本機 observation 可匯出');
    downloadJson(buildDeidentifiedFirstPartyIngredientAggregate(stored),`pokemon_sleep_ingredient_probability_first_party_aggregate_${new Date().toISOString().slice(0,10)}.json`);
  });
  renderStoredSummary(panel);
  globalThis.PokemonSleepFirstPartyObservationUiV042724=Object.freeze({version:E3C6F_FIRST_PARTY_OBSERVATION_UI_VERSION,candidateRows:()=>candidateRows().map(row=>({pokemon_id:row.pokemon_id,level:row.level,mode:row.uiEligibility.observation_mode}))});
}

function safeMount(){try{mount();}catch(error){console.warn('E3C-6B/6D/6F first-party observation UI deferred',error);}}
globalThis.addEventListener('pokemon-sleep:database-ready',()=>setTimeout(safeMount,0));
globalThis.addEventListener('pokemon-sleep:update-applied',event=>{
  if(event?.detail?.payload?.scenario!=='ingredient_probability_first_party_observation_update')return;
  const panel=document.getElementById('e3c6bFirstPartyPanel');if(panel)renderStoredSummary(panel);
});
