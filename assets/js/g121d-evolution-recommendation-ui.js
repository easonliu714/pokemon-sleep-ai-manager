const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
})[char]);

const text=value=>String(value??'').trim();
const ARRAY_KEYS=Object.freeze(['completed_requirements','missing_requirements','acquisition_guidance','warnings']);

function exactEnvelope(value){
  return Boolean(value&&typeof value==='object'&&
    value.schema==='evolution-recommendation/1.0'&&
    value.deterministic===true&&value.read_only===true&&
    value.ai_recommendation_decision===false&&text(value.pokemon_instance_id));
}

function authorityLabel(status){
  if(status==='VERIFIED'||status==='NOT_REQUIRED')return '已驗證';
  return '資料不足／需確認';
}

function requirementLabel(row={}){
  const labels={level:'等級',candy:'糖果',item:'進化道具',dream_shards:'夢之碎片',sleep_hours:'共眠時數',other_requirement:'其他條件'};
  return labels[row.kind]||text(row.kind)||'條件';
}

function requirementText(row={}){
  const label=requirementLabel(row);
  if(row.kind==='item')return `${label}：${esc(row.item_name||'未指定')}（${row.satisfied?'完成':'缺少'}）`;
  if(row.kind==='other_requirement')return `${label}：${row.satisfied?'完成':'未完成'}`;
  const required=row.required??'未知';
  const current=row.current??'未知';
  const gap=row.gap??'未知';
  return `${label}：${esc(current)} / ${esc(required)}；缺口 ${esc(gap)}`;
}

function projectionText(envelope){
  if(envelope.sleep_hours_remaining===null||envelope.sleep_hours_remaining===undefined)return '共眠：不適用／無可驗證需求';
  if(envelope.projection_status!=='VERIFIED'&&envelope.projection_status!=='COMPLETE'){
    return `共眠：尚差 ${esc(envelope.sleep_hours_remaining)} 小時；每晚時數 authority 未驗證，剩餘夜數／完成日未知`;
  }
  const nights=envelope.remaining_nights===null||envelope.remaining_nights===undefined?'未知':envelope.remaining_nights;
  const date=envelope.completion_date||'未提供可驗證起算日';
  return `共眠：尚差 ${esc(envelope.sleep_hours_remaining)} 小時；剩餘 ${esc(nights)} 夜；完成日 ${esc(date)}`;
}

function recommendationText(envelope){
  if(envelope.recommendation_status==='recommend_now')return '建議：可立即進化（deterministic requirements 與 recommendation authority 均已支持）';
  if(envelope.recommendation_status==='defer')return `建議：暫緩；${esc(envelope.rationale||'deterministic_defer')}`;
  return `建議：資料不足／暫緩；${esc(envelope.rationale||'missing_recommendation_authority')}`;
}

function acquisitionText(envelope){
  if(envelope.acquisition_guidance_authority!=='VERIFIED'){
    return `取得方式：資料不足／需確認（${esc(envelope.acquisition_guidance_authority||'UNKNOWN')}）`;
  }
  const rows=Array.isArray(envelope.acquisition_guidance)?envelope.acquisition_guidance:[];
  if(!rows.length)return '取得方式：已驗證，無額外購買取得需求';
  return `取得方式：${rows.map(row=>{
    if(row.cost_resource==='sleep_points')return `Sleep Points ${esc(row.cost)}`;
    if(row.cost_resource==='diamonds')return `Diamonds ${esc(row.cost)}`;
    return esc(row.type||'已驗證來源');
  }).join('；')}`;
}

function metaText(envelope){
  const source=envelope.source??envelope.authority_source??'G12.1B/C deterministic read-side authority';
  const verifiedAt=envelope.verified_at??envelope.source_verified_at??'未提供';
  const confidence=envelope.confidence??envelope.route_confidence??'未提供';
  return `來源：${esc(source)}｜verified_at：${esc(verifiedAt)}｜confidence：${esc(confidence)}`;
}

export function buildG121DEvolutionRecommendationCardModel(envelope){
  if(!exactEnvelope(envelope))return Object.freeze({valid:false,reason:'invalid_or_ambiguous_recommendation_envelope'});
  const copy={...envelope};
  for(const key of ARRAY_KEYS)copy[key]=Array.isArray(envelope[key])?envelope[key].map(row=>row&&typeof row==='object'?{...row}:row):[];
  const immediate=copy.deterministic_status==='ready_now'&&copy.recommendation_status==='recommend_now';
  return Object.freeze({
    valid:true,
    pokemon_instance_id:copy.pokemon_instance_id,
    route_id:copy.route_id||null,
    evolution_branch_id:copy.evolution_branch_id||null,
    deterministic_status:copy.deterministic_status||'data_incomplete',
    recommendation_status:copy.recommendation_status||'data_incomplete',
    can_evolve_now:copy.can_evolve_now===true,
    display_immediate_recommendation:immediate,
    envelope:copy,
  });
}

export function renderG121DEvolutionRecommendationCard(container,envelope,options={}){
  if(!container)return {rendered:false,reason:'missing_container'};
  const model=buildG121DEvolutionRecommendationCardModel(envelope);
  if(!model.valid){
    container.innerHTML='<section class="g121d-evolution-card" data-authority-state="data_incomplete"><h3>進化建議</h3><p class="notice">資料不足／需確認。未取得唯一且可驗證的 deterministic recommendation envelope。</p></section>';
    return {rendered:true,valid:false};
  }
  const e=model.envelope;
  const completed=e.completed_requirements.map(requirementText);
  const missing=e.missing_requirements.map(requirementText);
  const branchLabel=options.target_label||e.target_label||model.evolution_branch_id||model.route_id||'目標分支';
  const currentLabel=options.current_label||e.current_label||'目前個體';
  container.innerHTML=`<section class="g121d-evolution-card" data-pokemon-instance-id="${esc(model.pokemon_instance_id)}" data-authority-state="${esc(model.recommendation_status)}">
    <div class="section-head"><h3>進化建議卡</h3><span class="badge">${esc(model.deterministic_status)}</span></div>
    <p><b>${esc(currentLabel)} → ${esc(branchLabel)}</b></p>
    <p>個體 ID：<code>${esc(model.pokemon_instance_id)}</code>｜route：${esc(model.route_id||'未知')}｜branch：${esc(model.evolution_branch_id||'未知')}</p>
    <p>${model.can_evolve_now?'Deterministic status：可立即進化':'Deterministic status：尚不可立即進化'}</p>
    <p>${recommendationText(e)}</p>
    <div class="g121d-requirements"><div><b>已完成條件</b>${completed.length?`<ul>${completed.map(row=>`<li>${row}</li>`).join('')}</ul>`:'<p>無</p>'}</div><div><b>缺少條件</b>${missing.length?`<ul>${missing.map(row=>`<li>${row}</li>`).join('')}</ul>`:'<p>無</p>'}</div></div>
    <p>${projectionText(e)}</p>
    <p>${acquisitionText(e)}</p>
    <p class="notice">${metaText(e)}</p>
  </section>`;
  return {rendered:true,valid:true,pokemon_instance_id:model.pokemon_instance_id};
}

export function renderG121DBranchComparison(container,envelopes=[],options={}){
  if(!container)return {rendered:false,reason:'missing_container'};
  const models=envelopes.map(buildG121DEvolutionRecommendationCardModel).filter(model=>model.valid);
  const identities=new Set(models.map(model=>model.pokemon_instance_id));
  if(models.length!==envelopes.length||identities.size!==1){
    container.innerHTML='<section class="panel" data-g121d-branch-comparison="data_incomplete"><h3>進化分支比較</h3><p class="notice">資料不足／需確認：分支必須屬於同一 pokemon_instance_id，且每個分支都需具有可驗證 recommendation envelope。</p></section>';
    return {rendered:true,valid:false};
  }
  container.innerHTML='<section class="panel" data-g121d-branch-comparison="verified"><h3>進化分支比較</h3><div class="g121d-branch-grid"></div></section>';
  const grid=container.querySelector('.g121d-branch-grid');
  models.forEach((model,index)=>{
    const slot=document.createElement('div');
    grid.appendChild(slot);
    renderG121DEvolutionRecommendationCard(slot,model.envelope,{...options,target_label:model.envelope.target_label||`分支 ${index+1}`});
  });
  return {rendered:true,valid:true,branch_count:models.length,pokemon_instance_id:models[0]?.pokemon_instance_id||null};
}

export function mountG121DWarroomRecommendationUI({container=document.getElementById('warroomPanel'),envelopes=[]}={}){
  if(!container)return {mounted:false,reason:'missing_warroom_panel'};
  // G12.1D is deliberately presentation-only. The caller must pass G12.1C envelopes;
  // this module performs no DB reads, mutation, status calculation, gap calculation or AI call.
  return envelopes.length>1
    ?renderG121DBranchComparison(container,envelopes)
    :renderG121DEvolutionRecommendationCard(container,envelopes[0]);
}
