import {rows,isRescueReadonly} from './database.js';
import {auditPublicPokemonKnowledgeBundle,buildObservedProjectionCoverage,buildEvolutionCoverageDiagnostic} from './public-pokemon-knowledge-coverage.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let scheduled=false,lastSignature='';

function ensureStyle(){
  if(document.getElementById('v03993CoverageStyle'))return;
  const style=document.createElement('style');
  style.id='v03993CoverageStyle';
  style.textContent=`.public-coverage-block{margin:16px 0;padding:14px;border:1px solid #d8e4df;border-radius:14px;background:#fff}.public-coverage-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.public-coverage-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}.public-coverage-card{padding:12px;border:1px solid #e0e8e4;border-radius:12px;background:#f7faf8}.public-coverage-card b{display:block;font-size:1.2rem}.public-coverage-card small{display:block;line-height:1.45;margin-top:4px}.public-coverage-ok{color:#176b50}.public-coverage-warn{color:#8a6500}.public-coverage-lists{display:grid;grid-template-columns:1fr 1fr;gap:10px}.public-coverage-list{padding:10px;border-radius:10px;background:#f6f8f7}.public-coverage-list ul{margin:6px 0 0;padding-left:20px}.public-coverage-list li{margin:3px 0}.evolution-diagnostic-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.evolution-diagnostic-actions small{overflow-wrap:anywhere}@media(max-width:720px){.public-coverage-grid{grid-template-columns:1fr 1fr}.public-coverage-lists{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
}

function ensureHost(){
  const panel=document.getElementById('sharedKnowledgePanel');
  if(!panel||!document.getElementById('berryMasterTable'))return null;
  let block=document.getElementById('publicPokemonKnowledgeCoverage');
  if(block)return block;
  block=document.createElement('section');
  block.id='publicPokemonKnowledgeCoverage';
  block.className='public-coverage-block';
  const firstHeading=panel.querySelector('h3');
  if(firstHeading)panel.insertBefore(block,firstHeading);
  else panel.prepend(block);
  return block;
}

function ratio(metric){
  if(!metric?.observed)return '—';
  return `${metric.resolved}/${metric.observed}`;
}

function list(label,values,emptyText){
  const items=(values||[]).slice(0,20);
  return `<div class="public-coverage-list"><b>${esc(label)}</b>${items.length?`<ul>${items.map(value=>`<li>${esc(value)}</li>`).join('')}</ul>${(values||[]).length>items.length?`<small>另有 ${(values||[]).length-items.length} 項未展開</small>`:''}`:`<small>${esc(emptyText)}</small>`}</div>`;
}

function playerRows(){
  if(isRescueReadonly())return [];
  try{return rows('SELECT nature,main_skill,type,current_species,species FROM pokemon');}catch{return [];}
}

async function copyText(text){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}
  const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();
  let ok=false;try{ok=document.execCommand('copy');}finally{area.remove();}
  if(!ok)throw new Error('目前瀏覽器不允許自動複製');
  return true;
}

function wireEvolutionDiagnostic(host,diagnostic){
  const button=host.querySelector('[data-evolution-coverage-copy]');
  const status=host.querySelector('[data-evolution-coverage-copy-status]');
  if(!button)return;
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try{
      await copyText(JSON.stringify(diagnostic,null,2));
      if(status)status.textContent=`已複製：UNKNOWN ${diagnostic.unknown_count} 項；count/list parity=${diagnostic.count_list_parity?'PASS':'FAIL'}。`;
    }catch(error){
      if(status)status.textContent=`複製失敗：${error?.message||error}`;
    }finally{button.disabled=false;}
  });
}

export function renderPublicKnowledgeCoverage(){
  ensureStyle();
  const host=ensureHost();
  if(!host)return false;
  const bundle=auditPublicPokemonKnowledgeBundle();
  const rescue=isRescueReadonly();
  const localRows=rescue?[]:playerRows();
  const observed=buildObservedProjectionCoverage(localRows);
  const evolutionDiagnostic=rescue?null:buildEvolutionCoverageDiagnostic(localRows);
  const integrityClass=bundle.ok?'public-coverage-ok':'public-coverage-warn';
  const manifest=bundle.manifest;
  const signature=JSON.stringify({version:bundle.version,ok:bundle.ok,errors:bundle.errors,manifest,rescue,observed,evolutionDiagnostic});
  if(signature===lastSignature&&host.childElementCount)return true;
  lastSignature=signature;

  host.innerHTML=`
    <div class="public-coverage-head"><div><h3>Pokémon 公版 Master Coverage</h3><p class="notice">此區只稽核公版資料與本機「名稱／類型」是否能被 Master 解讀；不會把公版值回寫到玩家 Pokémon row。</p></div><span class="badge ${bundle.ok?'ok':'pending'}">${bundle.ok?'Bundle Integrity PASS':'需檢查'}</span></div>
    <div class="public-coverage-grid">
      <div class="public-coverage-card"><b class="${integrityClass}">${manifest.nature_rows}/${manifest.nature_expected}</b><span>性格公版</span><small>${esc(manifest.nature_coverage_status)}</small></div>
      <div class="public-coverage-card"><b>${manifest.main_skill_canonical_rows}</b><span>已核對主技能</span><small>另有 ${manifest.main_skill_compatibility_alias_rows} 個相容別名；${esc(manifest.main_skill_coverage_status)}</small></div>
      <div class="public-coverage-card"><b>${manifest.evolution_route_rows}</b><span>已核對進化 route</span><small>${manifest.evolution_from_species_rows} 個進化前物種 · ${manifest.evolution_verified_terminal_rows} 個已核對終階物種</small></div>
      <div class="public-coverage-card"><b>${manifest.berry_type_rows}</b><span>屬性→樹果公版</span><small>${esc(manifest.berry_coverage_status)}</small></div>
    </div>
    ${rescue?'<div class="notice">目前為救援模式：只顯示 bundled public master integrity，不讀取玩家 SQLite Coverage。</div>':`
      <h4>本機觀察值 → 公版解析覆蓋</h4>
      <div class="public-coverage-grid">
        <div class="public-coverage-card"><b>${ratio(observed.nature)}</b><span>性格名稱</span><small>未解析 ${observed.nature.unresolved}</small></div>
        <div class="public-coverage-card"><b>${ratio(observed.main_skill)}</b><span>主技能名稱</span><small>未解析 ${observed.main_skill.unresolved}</small></div>
        <div class="public-coverage-card"><b>${ratio(observed.berry_type)}</b><span>屬性→樹果</span><small>未解析 ${observed.berry_type.unresolved}</small></div>
        <div class="public-coverage-card"><b>${observed.evolution.verified_outgoing_route_species}/${observed.evolution.observed_species||'—'}</b><span>進化三態 Coverage</span><small>outgoing ${observed.evolution.verified_outgoing_route_species} · 終階 ${observed.evolution.verified_terminal_species} · 未核對 ${observed.evolution.unknown_evolution_status_species}</small></div>
      </div>
      <div class="evolution-diagnostic-actions">
        <button type="button" class="secondary" data-evolution-coverage-copy>複製 Evolution Coverage 診斷 JSON</button>
        <small data-evolution-coverage-copy-status>UNKNOWN count/list parity：<b>${evolutionDiagnostic.count_list_parity?'PASS':'FAIL'}</b>（${evolutionDiagnostic.unknown_count}/${evolutionDiagnostic.unknown_values_count}）；三態 partition parity：<b>${evolutionDiagnostic.partition_parity?'PASS':'FAIL'}</b>（${evolutionDiagnostic.partition_count}/${evolutionDiagnostic.observed_species_count}）。診斷只含物種名稱與統計，不含玩家 Pokémon ID、數量或備註。</small>
      </div>
      <div class="public-coverage-lists">
        ${list('尚未解析的性格名稱',observed.nature.unresolved_values,'目前觀察到的性格名稱皆可解析。')}
        ${list('尚未解析的主技能名稱',observed.main_skill.unresolved_values,'目前觀察到的主技能名稱皆可解析。')}
        ${list('尚未解析的屬性名稱',observed.berry_type.unresolved_values,'目前觀察到的屬性皆可對應公版樹果。')}
        ${list('已核對終階物種（目前版本）',observed.evolution.verified_terminal_values,'目前觀察物種尚未命中已核對終階清單。')}
        ${list('仍待核對 evolution status 的物種',observed.evolution.unknown_evolution_status_values,'目前觀察物種皆已有 outgoing route 或已核對終階狀態。')}
      </div>
      <p class="notice">進化三態語意：<b>${esc(observed.evolution.triage_semantics)}</b>。只有有來源的終階物種才會標記為 <b>${esc(observed.evolution.terminal_semantics)}</b>；其餘缺口保持 <b>${esc(observed.evolution.unknown_semantics)}</b>，不得自行判斷「不能進化」。</p>`}
    ${bundle.errors.length?`<details><summary>Bundle Integrity 錯誤 ${bundle.errors.length} 項</summary><ul>${bundle.errors.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></details>`:''}
    <p class="notice">Public Pokémon Knowledge Version：<b>${esc(bundle.version)}</b> · projection_only=true · player_rows_may_be_mutated=false</p>`;
  if(evolutionDiagnostic)wireEvolutionDiagnostic(host,evolutionDiagnostic);
  return true;
}

function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;renderPublicKnowledgeCoverage();},0);}
function boot(){ensureStyle();schedule();document.querySelector('nav')?.addEventListener('click',schedule);document.addEventListener('pokemon-sleep-data-refreshed',schedule);window.addEventListener('pokemon-sleep:database-ready',schedule);const panel=document.getElementById('sharedKnowledgePanel');if(panel)new MutationObserver(schedule).observe(panel,{childList:true,subtree:true});}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
}
