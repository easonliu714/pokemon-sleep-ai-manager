const DEFAULT_MODEL='gemini-3.6-flash';
const FRAME_FALLBACK_MS=0;
const REGION_PRESETS={
  full_image:{label:'全圖辨識',regions:[{id:'full',label:'全圖',x:0,y:0,width:1,height:1}]},
  pokemon_basic_profile:{label:'寶可夢基本資訊頁',regions:[{id:'top_sp',label:'頂部 SP／屬性',x:0,y:0,width:0.55,height:0.16},{id:'identity_level_name',label:'名稱／Lv／EXP',x:0.08,y:0.32,width:0.84,height:0.22},{id:'berry_ingredient',label:'樹果／食材',x:0.04,y:0.56,width:0.92,height:0.25},{id:'helping_capacity',label:'幫忙間隔／持有上限',x:0.04,y:0.78,width:0.92,height:0.18}]},
  pokemon_skill_detail:{label:'寶可夢技能／能力詳情頁',regions:[{id:'floating_identity_card',label:'浮動身份卡 SP／Lv／名稱',x:0,y:0.03,width:0.62,height:0.15},{id:'main_skill',label:'主技能',x:0.04,y:0.19,width:0.92,height:0.22},{id:'sub_skills',label:'副技能',x:0.04,y:0.38,width:0.92,height:0.3},{id:'nature_history',label:'性格／相遇／一起睡覺時間',x:0.04,y:0.66,width:0.92,height:0.3}]}
};

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const itemId=item=>String(item?.sha256||item?.source_image_ref||item?.path||'');
const itemName=item=>String(item?.file_name||item?.path||item?.source_image_ref||'未命名圖片');
const deferTrace=(event,details={})=>setTimeout(()=>{
  globalThis.UpdateCenterLiveDebug?.record?.(event,details);
  globalThis.DebugTrace?.record?.('ai_review',event,{status:'completed',details});
},0);

function presetOptions(selected){
  return Object.entries(REGION_PRESETS).map(([key,value])=>`<option value="${key}" ${key===selected?'selected':''}>${escapeHtml(value.label)}</option>`).join('');
}
function regionList(preset){
  const config=REGION_PRESETS[preset]||REGION_PRESETS.full_image;
  return config.regions.map((region,index)=>`<div><strong>${index+1}. ${escapeHtml(region.label)}</strong><br>x ${region.x.toFixed(2)} / y ${region.y.toFixed(2)} / w ${region.width.toFixed(2)} / h ${region.height.toFixed(2)}</div>`).join('');
}
function createQueue(item,{model,projectAlias,preset}){
  return {
    schema:'pokemon-sleep-ai-consent-queue/1.3-ultra-minimal',
    model,
    project_alias:projectAlias||null,
    selected_count:1,
    contains_image_bytes:false,
    contains_api_key:false,
    region_preset:preset,
    items:[{item_id:itemId(item),source_image_ref:item?.source_image_ref||item?.path||null,sha256:item?.sha256||null,consent_required:true}]
  };
}

export function createSingleItemOcrRegionAiReviewPanel({item,model=DEFAULT_MODEL,projectAlias='主要 Project',onPrepared=()=>{}}={}){
  const root=document.createElement('section');
  root.className='ocr-region-ai-panel single-item-advanced-review ultra-minimal-ai-shell';
  let disposed=false;
  let preset='full_image';

  root.innerHTML=`<div class="ocr-region-ai-shell">
    <h4>單張 AI 覆核準備</h4>
    <div class="notice success" data-ai-bootstrap-status><strong>超輕量單張 AI 介面已載入。</strong><br>未啟動舊 Advanced Core、RAF、候選批次或 Provider。</div>
    <div class="notice"><strong>${escapeHtml(itemName(item))}</strong><br><small>${escapeHtml(itemId(item))}</small></div>
    <label>辨識區域 preset <select data-ai-preset>${presetOptions(preset)}</select></label>
    <div class="ocr-region-list" data-ai-regions>${regionList(preset)}</div>
    <label class="ocr-ai-consent"><input type="checkbox" data-ai-consent>我明確同意將此圖片交由 AI 覆核。</label>
    <label class="ocr-ai-consent"><input type="checkbox" data-ai-upload-ack>我了解實際執行時圖片會上傳至 AI Provider。</label>
    <button type="button" data-ai-prepare disabled>建立 AI 覆核 Queue（尚不送出）</button>
    <div class="notice" data-ai-hint>需完成兩項同意。</div>
  </div>`;

  const consent=root.querySelector('[data-ai-consent]');
  const uploadAck=root.querySelector('[data-ai-upload-ack]');
  const prepare=root.querySelector('[data-ai-prepare]');
  const hint=root.querySelector('[data-ai-hint]');
  const sync=()=>{
    if(disposed)return;
    const ok=Boolean(consent?.checked&&uploadAck?.checked);
    if(prepare)prepare.disabled=!ok;
    if(hint)hint.hidden=ok;
  };

  root.querySelector('[data-ai-preset]')?.addEventListener('change',event=>{
    preset=event.target.value;
    const list=root.querySelector('[data-ai-regions]');
    if(list)list.innerHTML=regionList(preset);
    deferTrace('ultra_minimal_ai_regions_changed',{preset,region_count:(REGION_PRESETS[preset]||REGION_PRESETS.full_image).regions.length});
  });
  consent?.addEventListener('change',sync);
  uploadAck?.addEventListener('change',sync);
  prepare?.addEventListener('click',()=>{
    if(disposed||!consent?.checked||!uploadAck?.checked)return;
    const queue=createQueue(item,{model,projectAlias,preset});
    onPrepared({queue,region_config:{preset,regions:(REGION_PRESETS[preset]||REGION_PRESETS.full_image).regions},consent:{confirmed:true,acknowledged_upload:true}});
    deferTrace('ultra_minimal_ai_queue_prepared',{selected_count:1,preset,model,contains_api_key:false,contains_image_bytes:false});
  });
  sync();

  root.ready=Promise.resolve(root);
  root.dispose=()=>{disposed=true;};
  deferTrace('advanced_review_shell_mounted',{candidate_count:1,ultra_minimal_ai_shell:true});
  deferTrace('advanced_review_core_completed',{candidate_count:1,preset,ultra_minimal_ai_shell:true});
  deferTrace('ultra_minimal_ai_shell_completed',{item_id:itemId(item),model,project_alias:projectAlias});
  return root;
}

export {DEFAULT_MODEL,FRAME_FALLBACK_MS};
