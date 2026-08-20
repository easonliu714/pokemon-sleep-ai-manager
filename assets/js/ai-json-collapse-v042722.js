export const AI_JSON_COLLAPSE_VERSION='v0.4.27.22-ai-json-collapse-2026-08-20-a';

const DETAILS_MARKER='v042722AiJsonCollapsed';
const SUMMARY_TEXT='AI 分析結果 JSON（點擊展開）';

function looksLikeJson(pre){
  const value=String(pre?.textContent||'').trim();
  return value.startsWith('{')||value.startsWith('[');
}

function eligible(pre){
  if(!pre?.matches?.('pre.prompt-box'))return false;
  if(pre.classList.contains('hidden'))return false;
  if(pre.closest(`details[data-${DETAILS_MARKER.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`)}]`))return false;
  return looksLikeJson(pre);
}

export function collapseAiJsonCard(pre,{documentRef=globalThis.document}={}){
  if(!eligible(pre)||!documentRef?.createElement)return false;
  const details=documentRef.createElement('details');
  details.dataset[DETAILS_MARKER]='1';
  details.className='ai-json-result-disclosure';
  details.open=false;
  const summary=documentRef.createElement('summary');
  summary.textContent=SUMMARY_TEXT;
  summary.className='ai-json-result-summary';
  const parent=pre.parentNode;if(!parent)return false;
  parent.insertBefore(details,pre);
  details.append(summary,pre);
  return true;
}

export function collapseAiJsonCards(root=globalThis.document,{documentRef=globalThis.document}={}){
  if(!root)return 0;
  const candidates=[];
  if(root.matches?.('pre.prompt-box'))candidates.push(root);
  for(const pre of root.querySelectorAll?.('pre.prompt-box')||[])candidates.push(pre);
  let count=0;
  for(const pre of candidates)if(collapseAiJsonCard(pre,{documentRef}))count+=1;
  return count;
}

export function installAiJsonCollapse(scope=globalThis){
  const documentRef=scope?.document;if(!documentRef)return false;
  if(scope.PokemonSleepAiJsonCollapseV042722?.version===AI_JSON_COLLAPSE_VERSION)return true;
  const trace=(event,details={})=>scope.DebugTrace?.record?.('ai_review',event,{status:'completed',details:{version:AI_JSON_COLLAPSE_VERSION,...details}});
  const scan=root=>{const collapsed=collapseAiJsonCards(root,{documentRef});if(collapsed)trace('v042722_ai_json_cards_collapsed',{count:collapsed});return collapsed;};
  const start=()=>{
    const updates=documentRef.getElementById('updates');if(!updates)return false;
    scan(updates);
    const Observer=scope.MutationObserver;
    if(typeof Observer==='function'){
      const observer=new Observer(records=>{
        for(const record of records)for(const node of record.addedNodes||[])if(node?.nodeType===1)scan(node);
      });
      observer.observe(updates,{childList:true,subtree:true});
      scope.PokemonSleepAiJsonCollapseV042722Observer=observer;
    }
    return true;
  };
  if(documentRef.readyState==='loading')documentRef.addEventListener('DOMContentLoaded',start,{once:true});else start();
  scope.PokemonSleepAiJsonCollapseV042722=Object.freeze({version:AI_JSON_COLLAPSE_VERSION,collapse:scan});
  trace('v042722_ai_json_collapse_ready',{default_open:false,summary_text:SUMMARY_TEXT});
  return true;
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined')installAiJsonCollapse(globalThis);
