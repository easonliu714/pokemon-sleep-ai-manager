const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

const statusLabel=status=>({
  exact_existing:'已精確配對',
  unique_high_confidence:'高可信候選',
  possible_existing:'可能為既有個體',
  ambiguous_existing:'多個候選',
  no_candidate:'無既有候選'
}[status]||status||'未分類');

export function renderIdentityConfirmationQueue(container,queue,{onDecide,onAcceptHighConfidence}={}){
  if(!container)throw new Error('confirmation container is required');
  const items=Array.isArray(queue?.items)?queue.items:[];
  const highConfidence=items.filter(item=>{
    const dto=item.resolution||item;
    return dto.status==='unique_high_confidence'&&!item.decision;
  });
  container.innerHTML=`<section class="identity-confirmation" aria-label="寶可夢身分確認">
    <header class="identity-confirmation__header">
      <div><h2>身分確認</h2><p>逐筆確認 AI 辨識結果；確認前不會寫入資料庫。</p></div>
      <output>${items.filter(item=>item.state==='confirmed'||item.state==='skipped'||item.decision).length}/${items.length}</output>
    </header>
    ${highConfidence.length?`<button type="button" class="identity-confirmation__batch" data-accept-high-confidence>批次接受 ${highConfidence.length} 筆高可信候選</button>`:''}
    <div class="identity-confirmation__list">${items.map(renderCard).join('')}</div>
  </section>`;
  container.querySelector('[data-accept-high-confidence]')?.addEventListener('click',()=>onAcceptHighConfidence?.(highConfidence.map(item=>(item.resolution||item).incoming_ref)));
  container.querySelectorAll('[data-confirmation-action]').forEach(button=>button.addEventListener('click',()=>{
    const card=button.closest('[data-incoming-ref]');
    const select=card?.querySelector('[data-candidate-select]');
    onDecide?.({
      incoming_ref:card?.dataset.incomingRef,
      action:button.dataset.confirmationAction,
      pokemon_instance_id:select?.value||null
    });
  }));
}

function renderCard(item){
  const dto=item.resolution||item;
  const candidates=Array.isArray(dto.candidates)?dto.candidates:[];
  const selected=dto.selected_pokemon_instance_id||item.pokemon_instance_id||'';
  const manual=Boolean(dto.requires_confirmation);
  const thumbnail=dto.thumbnail_url||dto.source_thumbnail_url||null;
  const evidence=Array.isArray(dto.evidence)?dto.evidence:[];
  return `<article class="identity-confirmation__card" data-incoming-ref="${esc(dto.incoming_ref)}">
    <div class="identity-confirmation__title-row">
      ${thumbnail?`<img class="identity-confirmation__thumbnail" src="${esc(thumbnail)}" alt="${esc(dto.display_name||dto.species||'寶可夢')} 截圖縮圖">`:''}
      <div><strong>${esc(dto.display_name||dto.species||dto.incoming_ref)}</strong><span>${esc(statusLabel(dto.status))}</span></div>
      <span class="identity-confirmation__state">${esc(item.state||'pending')}</span>
    </div>
    <dl class="identity-confirmation__evidence">
      <div><dt>來源</dt><dd>${esc(dto.source_label||dto.incoming_ref||'—')}</dd></div>
      <div><dt>判定原因</dt><dd>${esc(dto.reason||'—')}</dd></div>
      <div><dt>候選數</dt><dd>${candidates.length}</dd></div>
      <div><dt>需要確認</dt><dd>${manual?'是':'否'}</dd></div>
      ${evidence.map(row=>`<div><dt>${esc(row.label||row.field||'證據')}</dt><dd>${esc(row.value??row.result??'—')} ${row.confidence!=null?`<small>${esc(Math.round(Number(row.confidence)*100))}%</small>`:''}</dd></div>`).join('')}
    </dl>
    ${candidates.length?`<label class="identity-confirmation__candidate">選擇既有個體<select data-candidate-select>${candidates.map(candidate=>`<option value="${esc(candidate.pokemon_instance_id)}" ${candidate.pokemon_instance_id===selected?'selected':''}>${esc(candidate.label||candidate.nickname||candidate.current_species||candidate.species||candidate.pokemon_instance_id)}</option>`).join('')}</select></label>`:''}
    <div class="identity-confirmation__actions">
      ${candidates.length?'<button type="button" data-confirmation-action="accept_existing">套用既有個體</button>':''}
      ${['no_candidate','possible_existing'].includes(dto.status)?'<button type="button" data-confirmation-action="create_new">建立新個體</button>':''}
      <button type="button" data-confirmation-action="skip">略過</button>
    </div>
  </article>`;
}

export const identityConfirmationStyles=`
.identity-confirmation{display:grid;gap:16px}.identity-confirmation__header{display:flex;justify-content:space-between;gap:16px;align-items:start}.identity-confirmation__header h2{margin:0}.identity-confirmation__header p{margin:.35rem 0 0}.identity-confirmation__header output{font-weight:700;white-space:nowrap}.identity-confirmation__batch{min-height:44px;font:inherit;font-weight:700}.identity-confirmation__list{display:grid;gap:12px}.identity-confirmation__card{border:1px solid #d8dde6;border-radius:16px;padding:14px;background:var(--surface,#fff);display:grid;gap:12px}.identity-confirmation__title-row{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:12px}.identity-confirmation__thumbnail{width:64px;height:64px;object-fit:cover;border-radius:12px;background:#eef1f5}.identity-confirmation__title-row div{display:grid;gap:4px}.identity-confirmation__title-row span,.identity-confirmation__state{font-size:.85rem}.identity-confirmation__evidence{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0}.identity-confirmation__evidence div{background:#f5f7fa;border-radius:10px;padding:8px}.identity-confirmation__evidence dt{font-size:.75rem}.identity-confirmation__evidence dd{margin:3px 0 0;font-weight:600;overflow-wrap:anywhere}.identity-confirmation__evidence small{font-weight:400}.identity-confirmation__candidate{display:grid;gap:6px}.identity-confirmation__candidate select,.identity-confirmation__actions button{min-height:44px;font:inherit}.identity-confirmation__actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}@media(max-width:560px){.identity-confirmation__evidence{grid-template-columns:1fr}.identity-confirmation__actions{grid-template-columns:1fr}.identity-confirmation__card{padding:12px;border-radius:14px}.identity-confirmation__title-row{grid-template-columns:auto 1fr}.identity-confirmation__state{grid-column:2}}
`;
