import {buildLocalProductionEvidenceSnapshot} from './strategy-context-local.js';

const STYLE_ID='pokemonSleepProductionEvidenceCompactUi';
const ADVANCED_LABEL='進階 Evidence / JSON';
const CSS=`
.g75-production-evidence{min-width:0;max-width:100%}
.g75-production-evidence .buttons{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.g75-production-evidence .evidence-metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0 14px}
.g75-production-evidence .evidence-metric{border:1px solid #dbe4df;border-radius:10px;background:#f7fbf9;padding:10px;min-width:0}
.g75-production-evidence .evidence-metric small{display:block;color:#687d74;margin-bottom:3px}
.g75-production-evidence .evidence-metric strong{display:block;color:#1f7a5a;font-size:1.05rem;overflow-wrap:anywhere}
.g75-production-evidence .evidence-rule-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin:10px 0}
.g75-production-evidence .evidence-rule-card{border:1px solid #dbe4df;border-radius:10px;padding:10px;background:#fff;min-width:0}
.g75-production-evidence .evidence-rule-head{display:flex;gap:7px;align-items:flex-start;justify-content:space-between;min-width:0}
.g75-production-evidence .evidence-rule-head b{min-width:0;overflow-wrap:anywhere}
.g75-production-evidence .status-pill{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:.76rem;white-space:nowrap;background:#eef5f1}
.g75-production-evidence .status-pill.pass{background:#dff3e8}.g75-production-evidence .status-pill.hold{background:#fff3cd}.g75-production-evidence .status-pill.info{background:#e8f0f6}.g75-production-evidence .status-pill.review{background:#fde2e2}
.g75-production-evidence .evidence-rule-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px;color:#687d74;font-size:.8rem}
.g75-production-evidence .evidence-rule-blocker{margin-top:6px;color:#7a5b00;font-size:.8rem;overflow-wrap:anywhere}
.g75-production-evidence .e3c7-readiness{border:1px solid #dbe4df;border-radius:12px;background:#fbfdfc;padding:11px;margin:12px 0 15px;min-width:0}
.g75-production-evidence .e3c7-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap}
.g75-production-evidence .e3c7-note{font-size:.82rem;color:#687d74;margin:6px 0 9px;overflow-wrap:anywhere}
.g75-production-evidence .e3c7-policy{font-size:.8rem;background:#fff8dc;border-radius:8px;padding:7px 9px;margin:8px 0;color:#6d5c16}
.g75-production-evidence .e3c7-group-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:7px;margin-top:9px}
.g75-production-evidence .e3c7-group{border:1px solid #e1e9e5;border-radius:9px;background:#fff;padding:9px;min-width:0;font-size:.8rem}
.g75-production-evidence .e3c7-group b{overflow-wrap:anywhere}.g75-production-evidence .e3c7-group div{margin-top:3px;color:#587067;overflow-wrap:anywhere}
.g75-production-evidence .evidence-advanced{margin-top:12px;border-top:1px solid #e1e9e5;padding-top:10px}
.g75-production-evidence .evidence-advanced summary{cursor:pointer;font-weight:750;color:#24483b}
.g75-production-evidence .evidence-raw-grid{display:grid;gap:8px;margin-top:10px}
.g75-production-evidence .evidence-raw-row{border:1px solid #e1e9e5;border-radius:9px;padding:9px;background:#fafcfb;min-width:0}
.g75-production-evidence .evidence-raw-row code,.g75-production-evidence pre{overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap}
.g75-production-evidence pre{max-height:320px;overflow:auto;background:#f5f8f6;border:1px solid #dbe4df;border-radius:10px;padding:10px;font-size:.78rem}
@media(max-width:700px){.g75-production-evidence .buttons button{flex:1 1 145px}.g75-production-evidence .evidence-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.g75-production-evidence .evidence-rule-grid,.g75-production-evidence .e3c7-group-grid{grid-template-columns:1fr}.g75-production-evidence .evidence-rule-card{padding:9px}.g75-production-evidence .evidence-rule-head{align-items:center}}
`;

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pct=value=>Number.isFinite(Number(value))?`${(Number(value)*100).toFixed(0)}%`:'—';
const probPct=value=>Number.isFinite(Number(value))?`${(Number(value)*100).toFixed(1)}%`:'—';
const DIMENSION_LABEL=Object.freeze({
  helper_interval_seconds:'幫忙間隔',help_event_split:'幫忙事件分流',berry_identity_by_type:'屬性→樹果',weekly_favorite_berry_identity:'本週最愛樹果',
  berry_energy_per_berry:'單顆樹果能量',favorite_berry_multiplier:'最愛樹果倍率',berry_output_per_help:'每次樹果幫忙量',species_base_ingredient_rate_reference:'物種食材率參考',
  ingredient_probability_per_help:'食材機率',ingredient_slot_distribution:'食材槽分布',main_skill_trigger_probability:'主技能觸發率',main_skill_effect_value:'主技能效果值',
});
const BLOCKER_LABEL=Object.freeze({
  BASE_BERRY_OUTPUT_PER_BERRY_RESULT_HELP_NUMERIC_CONTRACT_MISSING:'缺基礎樹果產量規則',
  SPECIES_BASE_INGREDIENT_RATE_LOCAL_MASTER_MISSING:'缺物種食材機率主檔',
  SPECIES_BASE_INGREDIENT_RATE_ACTIVATION_MASTER_NOT_ACCEPTED:'已有參考值，尚未升格數值主檔',
  PLAYER_SLOT_IDENTITY_OBSERVED_BUT_PRODUCTION_WEIGHT_MISSING:'缺食材槽產出權重',
  SPECIES_BASE_SKILL_TRIGGER_RATE_LOCAL_MASTER_MISSING:'缺物種技能觸發率',
  DAILY_TRIGGER_COUNT_DYNAMIC_RULE:'缺每日動態觸發規則',
  WEEKLY_EVENT_TRIGGER_MULTIPLIER_MUST_BE_APPLIED:'缺活動技能倍率套用',
  LOCAL_QUANTITATIVE_SKILL_LEVEL_EFFECT_MASTER_MISSING:'缺技能等級數值表',
  INCOMPLETE_BERRY_STRENGTH_INPUT_COVERAGE:'樹果能量輸入不完整',INCOMPLETE_FAVORITE_BERRY_MULTIPLIER_INPUT_COVERAGE:'最愛樹果輸入不完整',
});
const MAIN_DIMENSIONS=new Set(['help_event_split','berry_energy_per_berry','favorite_berry_multiplier','berry_output_per_help','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value']);

function installStyle(){if(typeof document==='undefined'||document.getElementById(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=CSS;document.head.appendChild(style);}
function stateMeta(row){
  if(row?.authority_status==='ACTIVE_VERIFIED')return {text:'已啟用',cls:'pass'};
  if(row?.authority_status==='ACTIVE_VERIFIED_STRUCTURAL')return {text:'結構已驗證',cls:'pass'};
  if(row?.evidence_status==='BLOCKED_DYNAMIC_RULE')return {text:'動態規則待補',cls:'hold'};
  if(row?.authority_status==='LOCAL_PUBLIC_MASTER'||row?.authority_status==='OBSERVED_INPUT')return {text:'輸入就緒',cls:'info'};
  return {text:'待補',cls:'hold'};
}
function readinessState(status){
  if(status==='READY_FOR_EXPLICIT_PROMOTION_REVIEW')return {text:'可進人工升格審查',cls:'pass'};
  if(status==='REVIEW_REQUIRED')return {text:'需要人工覆核',cls:'review'};
  if(status==='PLAYER_DATA_UNAVAILABLE')return {text:'玩家資料未載入',cls:'info'};
  if(status==='HOLD_NO_ACCEPTED_OBSERVATIONS')return {text:'尚無可聚合觀測',cls:'hold'};
  if(status==='HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED')return {text:'治理門檻尚未定義',cls:'hold'};
  if(status==='HOLD_REFERENCE_CROSSCHECK_NOT_READY')return {text:'獨立參考尚未就緒',cls:'hold'};
  if(status==='HOLD_INSUFFICIENT_EVIDENCE')return {text:'統計證據不足',cls:'hold'};
  return {text:String(status||'HOLD'),cls:'hold'};
}
function conciseBlocker(row){const blockers=row?.blocking_reasons||[];if(!blockers.length)return '';return BLOCKER_LABEL[blockers[0]]||String(blockers[0]).replaceAll('_',' ').toLowerCase();}
function compactRuleCard(row){
  const cov=row?.coverage||{},state=stateMeta(row),blocker=conciseBlocker(row);
  return `<article class="evidence-rule-card"><div class="evidence-rule-head"><b>${esc(DIMENSION_LABEL[row?.dimension]||row?.dimension||'—')}</b><span class="status-pill ${state.cls}">${esc(state.text)}</span></div><div class="evidence-rule-meta"><span>${esc(cov.observed_count??0)}/${esc(cov.total_count??0)}</span><span>${esc(pct(cov.ratio))}</span></div>${blocker?`<div class="evidence-rule-blocker">${esc(blocker)}</div>`:''}</article>`;
}
function rawRule(row){
  const cov=row?.coverage||{},blockers=row?.blocking_reasons||[];
  return `<div class="evidence-raw-row"><b><code>${esc(row?.dimension||'—')}</code></b><div>Evidence · <code>${esc(row?.evidence_status||'—')}</code></div><div>Authority · <code>${esc(row?.authority_status||'—')}</code></div><div>Coverage ${esc(cov.observed_count??0)}/${esc(cov.total_count??0)} (${esc(pct(cov.ratio))})</div>${blockers.length?`<div>Blocker · <code>${esc(blockers.join(' | '))}</code></div>`:''}<div>Source · ${esc((row?.source_refs||[]).join('；')||'—')}</div></div>`;
}
function metric(label,value,cls=''){return `<div class="evidence-metric"><small>${esc(label)}</small><strong class="${esc(cls)}">${esc(value)}</strong></div>`;}

export function renderIngredientProbabilityReadinessSummary(readiness={}){
  const state=readinessState(readiness?.status),policy=readiness?.policy||{},groups=Array.isArray(readiness?.groups)?readiness.groups:[];
  const visible=groups.slice(0,6);
  const groupHtml=visible.map(row=>{
    const groupState=readinessState(row?.status),wilson=row?.wilson_95,heterogeneity=row?.heterogeneity;
    const reasons=[...(row?.blockers||[]),...(row?.holds||[])];
    return `<div class="e3c7-group"><div class="evidence-rule-head"><b>${esc(row?.source_key||'—')}</b><span class="status-pill ${groupState.cls}">${esc(groupState.text)}</span></div><div>觀測 ${esc(row?.observation_count??0)} · help events ${esc(row?.total_help_event_count??0)}</div><div>Observed ${esc(probPct(row?.observed_fraction))} · Wilson 95% ${wilson?`${esc(probPct(wilson.lower))}–${esc(probPct(wilson.upper))}`:'—'}</div><div>I² ${heterogeneity&&Number.isFinite(Number(heterogeneity.i2))?esc(probPct(heterogeneity.i2)):'—'}</div>${reasons.length?`<div>Gate · <code>${esc(reasons.join(' | '))}</code></div>`:''}</div>`;
  }).join('');
  const policyText=policy?.policy_authority_status==='ACCEPTED_GOVERNED_POLICY'?'已載入 governed sufficiency policy':'目前尚未核准統計充分性門檻；系統只計算 Evidence，不會自行設定 N／CI／I²／reference tolerance。';
  return `<section class="e3c7-readiness"><div class="e3c7-head"><b>E3C-7 食材機率 Statistical Readiness</b><span class="status-pill ${state.cls}">${esc(state.text)}</span></div><div class="e3c7-note">本區只做統計充分性與衝突檢查；Readiness ≠ Production Activation。Ingredient Probability 仍需 explicit promotion review。</div><div class="evidence-metric-grid">${metric('可聚合觀測',readiness?.accepted_observation_count??0)}${metric('統計群組',readiness?.group_count??0)}${metric('Promotion candidates',readiness?.ready_group_count??0)}${metric('需覆核群組',readiness?.review_required_group_count??0)}${metric('Production',readiness?.production_active_dimensions||'4/7')}</div><div class="e3c7-policy">${esc(policyText)}</div>${groupHtml?`<div class="e3c7-group-grid">${groupHtml}</div>`:'<div class="e3c7-note">目前沒有可顯示的 de-identified statistical group。</div>'}${groups.length>visible.length?`<div class="e3c7-note">另有 ${esc(groups.length-visible.length)} 組，請於「進階 Evidence / JSON」查看。</div>`:''}</section>`;
}

function renderResult(container,snapshot){
  const s=snapshot?.summary||{},rules=snapshot?.rules||[],mainRows=rules.filter(row=>MAIN_DIMENSIONS.has(row?.dimension));
  const modelLabel=snapshot?.numeric_rate_model_status==='ACTIVE_VERIFIED'?'已啟用':'尚未啟用';
  container.innerHTML=`<div class="evidence-metric-grid">${metric('數值模型',modelLabel)}${metric('已啟用數值',`${s.active_numeric_dimension_count??0}/${s.numeric_dimension_count??0}`)}${metric('待補數值',s.blocked_numeric_dimension_count??0)}${metric('事件分流',s.structural_verified_dimension_count?'已驗證':'待補')}</div>
    ${renderIngredientProbabilityReadinessSummary(snapshot?.ingredient_probability_statistical_readiness||{})}
    <div class="evidence-rule-grid">${mainRows.map(compactRuleCard).join('')}</div>
    <details class="evidence-advanced"><summary>${ADVANCED_LABEL}</summary><div class="evidence-raw-grid">${rules.map(rawRule).join('')}</div><details><summary>完整 Snapshot JSON</summary><pre>${esc(JSON.stringify(snapshot,null,2))}</pre></details></details>`;
}

export function renderProductionEvidencePanel(root){
  if(!root)return;installStyle();
  root.querySelector('#warRoomProductionEvidencePanel')?.remove();
  const section=document.createElement('section');section.id='warRoomProductionEvidencePanel';section.className='panel g75-production-evidence';
  section.innerHTML=`<h3>G7.5 產能模型</h3><div class="buttons"><button id="warRoomRefreshProductionEvidence" type="button">重新計算</button><button id="warRoomCopyProductionEvidence" type="button">複製 Evidence JSON</button></div><div id="warRoomProductionEvidenceResult">正在計算…</div>`;
  root.append(section);
  const result=section.querySelector('#warRoomProductionEvidenceResult');let snapshot=null;
  const refresh=()=>{try{snapshot=buildLocalProductionEvidenceSnapshot();renderResult(result,snapshot);}catch(error){snapshot=null;result.textContent=`Evidence 檢查失敗：${error?.message||String(error)}`;}};
  section.querySelector('#warRoomRefreshProductionEvidence').onclick=refresh;
  section.querySelector('#warRoomCopyProductionEvidence').onclick=async()=>{try{if(!snapshot)refresh();if(!snapshot)return;await navigator.clipboard.writeText(JSON.stringify(snapshot,null,2));const button=section.querySelector('#warRoomCopyProductionEvidence');button.textContent='已複製';setTimeout(()=>{button.textContent='複製 Evidence JSON';},1200);}catch(error){result.textContent=`無法複製 Evidence：${error?.message||String(error)}`;}};
  refresh();
}
