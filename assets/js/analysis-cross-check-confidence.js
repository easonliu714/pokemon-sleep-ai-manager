import {listAnalysisRevisions} from './analysis-revision-store.js';

const VERSION='v0.3.74';
const BUILD='20260804-g13-4-ocr-ai-cross-check-confidence';
const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const text=value=>value==null?'':String(value).normalize('NFKC').trim();
const compact=value=>text(value).replace(/\s+/g,'');
let latestEvaluation=null;

function revisionRegions(revision){
  const raw=revision?.result?.analysis??revision?.result??{};
  return Array.isArray(raw?.regions)?raw.regions:Array.isArray(raw)?raw:[];
}
function ocrText(revision){return revisionRegions(revision).map(row=>text(row?.corrected_text??row?.text??row?.ocr_text)).filter(Boolean).join('\n');}
function matchNumber(source,patterns){for(const pattern of patterns){const hit=source.match(pattern);if(hit){const value=Number(hit[1]);if(Number.isFinite(value))return value;}}return null;}
function extractOcrCandidates(revision){
  const source=ocrText(revision);
  return {
    source_text:source,
    sp:matchNumber(source,[/(?:\bSP\b|ＳＰ|[Ss][Pp])\D{0,10}(\d{2,5})/i,/\b(\d{3,5})\b/]),
    level:matchNumber(source,[/(?:Lv\.?|LV\.?|等級)\D{0,6}(\d{1,3})/i]),
    region_count:revisionRegions(revision).length,
    mean_confidence:(()=>{const values=revisionRegions(revision).map(row=>Number(row?.confidence)).filter(Number.isFinite);return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;})()
  };
}
function aiFields(revision){
  const raw=revision?.result?.analysis??revision?.result??{};
  return {
    pokemon_name:text(raw.pokemon_name),level:Number.isFinite(Number(raw.level))?Number(raw.level):null,
    sp:Number.isFinite(Number(raw.sp))?Number(raw.sp):null,nature:text(raw.nature),
    main_skill:text(raw.main_skill?.name??raw.main_skill),sub_skills:Array.isArray(raw.sub_skills)?raw.sub_skills:[],
    ingredients:Array.isArray(raw.ingredients)?raw.ingredients:[],confidence:Number.isFinite(Number(raw.confidence))?Number(raw.confidence):null,
    uncertain_fields:Array.isArray(raw.uncertain_fields)?raw.uncertain_fields.map(text).filter(Boolean):[]
  };
}
function fieldRow(field,label,{ocr=null,ai=null,chinese=false}={}){
  if(chinese)return {field,label,ocr_value:ocr,ai_value:ai,status:ai?'manual_review':'ai_required',reason:ai?'中文語意欄位由 AI 提供候選，仍需人工確認。':'中文語意欄位不得由 OCR 自動定案，必須執行 AI。'};
  if(ocr==null&&ai==null)return {field,label,ocr_value:null,ai_value:null,status:'missing',reason:'OCR 與 AI 均無可用值。'};
  if(ocr==null)return {field,label,ocr_value:null,ai_value:ai,status:'ai_only',reason:'僅 AI 提供候選，需人工確認。'};
  if(ai==null)return {field,label,ocr_value:ocr,ai_value:null,status:'ai_required',reason:'OCR 有候選但尚未取得 AI Cross Check。'};
  const agreed=String(ocr)===String(ai);return {field,label,ocr_value:ocr,ai_value:ai,status:agreed?'agree':'conflict',reason:agreed?'OCR 與 AI 一致。':'OCR 與 AI 不一致，必須人工覆核。'};
}
export function buildCrossCheck({imageSha256}={}){
  const revisions=listAnalysisRevisions(imageSha256);const ocr=revisions.find(row=>row.analysis_type==='ocr')||null,ai=revisions.find(row=>row.analysis_type==='ai')||null;
  const o=ocr?extractOcrCandidates(ocr):{source_text:'',sp:null,level:null,region_count:0,mean_confidence:null};const a=ai?aiFields(ai):aiFields(null);
  const fields=[
    fieldRow('sp','SP',{ocr:o.sp,ai:a.sp}),fieldRow('level','等級',{ocr:o.level,ai:a.level}),
    fieldRow('pokemon_name','寶可夢名稱',{ocr:null,ai:a.pokemon_name,chinese:true}),
    fieldRow('main_skill','主技能',{ocr:null,ai:a.main_skill,chinese:true}),
    fieldRow('sub_skills','副技能',{ocr:null,ai:a.sub_skills.length?`${a.sub_skills.length} 項`:'',chinese:true}),
    fieldRow('ingredients','食材',{ocr:null,ai:a.ingredients.length?`${a.ingredients.length} 項`:'',chinese:true}),
    fieldRow('nature','性格',{ocr:null,ai:a.nature,chinese:true})
  ];
  const conflicts=fields.filter(row=>row.status==='conflict').length,aiRequired=fields.filter(row=>row.status==='ai_required').length,agreements=fields.filter(row=>row.status==='agree').length;
  let score=a.confidence==null?50:clamp(a.confidence<=1?a.confidence*100:a.confidence);score=clamp(score+agreements*5-conflicts*18-a.uncertain_fields.length*10-(ai?0:30));
  const recommended_action=!ai?'run_ai':(conflicts||a.uncertain_fields.length?'manual_review':'manual_confirm');
  return {schema:'pokemon-sleep-ocr-ai-cross-check/1.0',image_sha256:imageSha256,ocr_revision_id:ocr?.analysis_id||null,ai_revision_id:ai?.analysis_id||null,ocr_evidence:o,ai_fields:a,fields,confidence_score:score,agreement_count:agreements,conflict_count:conflicts,ai_required_count:aiRequired,requires_review:true,recommended_action,formal_apply_allowed:Boolean(ai),created_at:new Date().toISOString()};
}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ensureRoot(){let root=document.getElementById('analysisCrossCheckWorkbench');if(root)return root;const confirmation=document.getElementById('analysisConfirmationWorkbench');if(!confirmation)return null;const heading=document.createElement('h3');heading.textContent='OCR／AI Cross Check 與信心建議';root=document.createElement('section');root.id='analysisCrossCheckWorkbench';root.className='panel';confirmation.insertAdjacentElement('beforebegin',root);root.insertAdjacentElement('beforebegin',heading);return root;}
function render(evaluation){const root=ensureRoot();if(!root)return;const actionText={run_ai:'建議：先執行 AI 分析，再進行人工確認。',manual_review:'建議：OCR／AI 有衝突或不確定欄位，逐欄人工覆核。',manual_confirm:'建議：結果一致度較高，仍需人工確認後寫入。'}[evaluation.recommended_action];root.innerHTML=`<div class="notice ${evaluation.formal_apply_allowed?'success':'warning'}"><strong>Confidence ${Math.round(evaluation.confidence_score)}／100</strong><br>${esc(actionText)}<br>一致 ${evaluation.agreement_count}；衝突 ${evaluation.conflict_count}；需要 AI ${evaluation.ai_required_count}</div><div class="table-wrap"><table><thead><tr><th>欄位</th><th>OCR</th><th>AI</th><th>判定</th></tr></thead><tbody>${evaluation.fields.map(row=>`<tr><td>${esc(row.label)}</td><td>${esc(row.ocr_value??'—')}</td><td>${esc(row.ai_value??'—')}</td><td><strong>${esc(row.status)}</strong><br>${esc(row.reason)}</td></tr>`).join('')}</tbody></table></div><div class="notice">Confidence Engine 只提供建議與覆核優先級，不會自動 Commit。中文欄位一律要求 AI 候選與人工確認。</div>`;}
function evaluateRevision(revision){if(!revision?.image_sha256)return;latestEvaluation=buildCrossCheck({imageSha256:revision.image_sha256});globalThis.PokemonSleepAnalysisCrossCheck={latest:latestEvaluation,buildCrossCheck};render(latestEvaluation);globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-cross-check-ready',{detail:latestEvaluation}));globalThis.UpdateCenterLiveDebug?.record?.('analysis_cross_check_ready',{image_sha256:revision.image_sha256,recommended_action:latestEvaluation.recommended_action,confidence_score:latestEvaluation.confidence_score,agreement_count:latestEvaluation.agreement_count,conflict_count:latestEvaluation.conflict_count,formal_apply_allowed:latestEvaluation.formal_apply_allowed});}
globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>setTimeout(()=>evaluateRevision(event.detail),0));
document.addEventListener('click',event=>{const button=event.target?.closest?.('#applyConfirmedAnalysis');if(!button||!latestEvaluation||latestEvaluation.formal_apply_allowed)return;event.preventDefault();event.stopImmediatePropagation();const status=document.getElementById('analysisConfirmationStatus');if(status){status.className='notice error';status.textContent='正式寫入已阻擋：中文與關鍵欄位必須先取得 AI 分析，再進行人工確認。';}globalThis.UpdateCenterLiveDebug?.record?.('analysis_confirmation_blocked_ai_required',{image_sha256:latestEvaluation.image_sha256});},true);
function updateVersion(){document.documentElement.dataset.appVersion=VERSION;document.documentElement.dataset.appBuild=BUILD;const badge=document.getElementById('appVersion');if(badge)badge.textContent=`版本 ${VERSION}`;}
updateVersion();setTimeout(updateVersion,0);
export {VERSION,BUILD,extractOcrCandidates,aiFields};
