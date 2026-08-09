export const CONTROLLED_SELECTOR_VERSION='controlled-selector-2026-08-09-c';

const text=value=>String(value??'').normalize('NFKC').trim();
const searchText=value=>text(value).toLocaleLowerCase('zh-Hant').replace(/[\s　]+/g,'');
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export function normalizeControlledOptions(input=[]){
  const output=[],seen=new Set();
  for(const raw of Array.isArray(input)?input:[]){
    const value=text(raw?.value),label=text(raw?.label||raw?.value);
    if(!value||!label||seen.has(value))continue;
    seen.add(value);
    const aliases=[...new Set((Array.isArray(raw?.aliases)?raw.aliases:[]).map(text).filter(Boolean))];
    output.push(Object.freeze({
      value,label,aliases:Object.freeze(aliases),group:text(raw?.group)||null,
      description:text(raw?.description)||null,disabled:Boolean(raw?.disabled),
      search_blob:searchText([label,value,...aliases,raw?.group,raw?.description].filter(Boolean).join(' ')),
    }));
  }
  return Object.freeze(output);
}

export function reconcileControlledValues(values,options){
  const normalized=normalizeControlledOptions(options),byValue=new Map(normalized.map(option=>[option.value,option]));
  const selected=[],seen=new Set();
  for(const rawValue of Array.isArray(values)?values:[]){
    const raw=text(rawValue);if(!raw)continue;
    const exact=byValue.get(raw);
    if(exact){if(!seen.has(exact.value)){selected.push({value:exact.value,label:exact.label,option:exact,unresolved:false,legacy_value:null,reason:null});seen.add(exact.value);}continue;}
    const needle=searchText(raw);
    const matches=normalized.filter(option=>searchText(option.label)===needle||option.aliases.some(alias=>searchText(alias)===needle));
    if(matches.length===1){const option=matches[0];if(!seen.has(option.value)){selected.push({value:option.value,label:option.label,option,unresolved:false,legacy_value:raw,reason:'LEGACY_VALUE_RESOLVED'});seen.add(option.value);}continue;}
    const key=`legacy:${raw}`;
    if(!seen.has(key)){selected.push({value:raw,label:raw,option:null,unresolved:true,legacy_value:raw,reason:matches.length>1?'AMBIGUOUS_LEGACY_VALUE':'UNKNOWN_LEGACY_VALUE'});seen.add(key);}
  }
  return Object.freeze({
    selected:Object.freeze(selected.map(row=>Object.freeze(row))),
    unresolved:Object.freeze(selected.filter(row=>row.unresolved).map(row=>Object.freeze({value:row.value,reason:row.reason}))),
  });
}

export function filterControlledOptions(options,query,selectedValues=[]){
  const normalized=normalizeControlledOptions(options),needle=searchText(query),selected=new Set((selectedValues||[]).map(text));
  return normalized.filter(option=>!selected.has(option.value)&&(!needle||option.search_blob.includes(needle)));
}

export function createControlledSelector(root,{
  options=[],values=[],multiple=true,maxSelections=null,placeholder='搜尋並選擇…',emptyText='沒有符合的選項',
  selectionLabel='選擇項目',disabled=false,onChange=null,
}={}){
  if(!root)throw new Error('controlled_selector_root_required');
  const normalized=normalizeControlledOptions(options);
  const optionByValue=new Map(normalized.map(option=>[option.value,option]));
  let selected=[...reconcileControlledValues(values,normalized).selected],query='',composing=false;
  const limit=multiple?(Number.isInteger(Number(maxSelections))&&Number(maxSelections)>0?Number(maxSelections):null):1;

  function publicValues(){return selected.map(row=>row.value);}
  function unresolvedValues(){return selected.filter(row=>row.unresolved).map(row=>({value:row.value,reason:row.reason}));}
  function notify(){if(typeof onChange==='function')onChange(publicValues(),{unresolved:unresolvedValues()});}
  function resolvedValues(){return selected.filter(row=>!row.unresolved).map(row=>row.value);}
  function atLimit(){return Boolean(limit&&selected.length>=limit);}
  function summaryText(){return `${selectionLabel} · 已選 ${selected.length}${limit?` / ${limit}`:''}${selected.some(row=>row.unresolved)?' · 含 REVIEW':''}`;}
  function chipsHtml(){return selected.map((row,index)=>`<span class="controlled-chip${row.unresolved?' review':''}" title="${esc(row.unresolved?row.reason:(row.legacy_value?`由舊值 ${row.legacy_value} 正名`:'已選擇'))}"><span>${esc(row.label)}</span>${row.unresolved?'<b>REVIEW</b>':''}<button type="button" data-cs-remove="${index}" aria-label="移除 ${esc(row.label)}" ${disabled?'disabled':''}>×</button></span>`).join('')||'<span class="controlled-selector-empty">尚未選擇</span>';}
  function optionsHtml(){
    if(atLimit())return `<p class="notice">已達選擇上限 ${limit}。</p>`;
    const available=filterControlledOptions(normalized,query,resolvedValues());
    return available.map(option=>`<button type="button" class="controlled-option" data-cs-option-value="${esc(option.value)}" role="option" ${option.disabled?'disabled':''}><span><b>${esc(option.label)}</b>${option.description?`<small>${esc(option.description)}</small>`:''}</span>${option.group?`<em>${esc(option.group)}</em>`:''}</button>`).join('')||`<p class="notice">${esc(emptyText)}</p>`;
  }
  function renderOptions(){
    const container=root.querySelector('.controlled-selector-options');
    if(container)container.innerHTML=optionsHtml();
  }
  function refreshState({syncSearch=false}={}){
    const chips=root.querySelector('.controlled-selector-chips');if(chips)chips.innerHTML=chipsHtml();
    const summary=root.querySelector('.controlled-selector-menu > summary');if(summary)summary.textContent=summaryText();
    const clearButton=root.querySelector('[data-cs-clear]');if(clearButton)clearButton.disabled=Boolean(disabled||!selected.length);
    const search=root.querySelector('[data-cs-search]');if(syncSearch&&search&&search.value!==query)search.value=query;
    renderOptions();
    if(disabled)root.querySelector('details')?.removeAttribute('open');
  }
  function refocusSearch(){
    if(!multiple||disabled)return;
    const search=root.querySelector('[data-cs-search]');
    if(!search)return;
    const focus=()=>{try{search.focus({preventScroll:true});}catch{search.focus();}search.selectionStart=search.selectionEnd=search.value.length;};
    if(typeof queueMicrotask==='function')queueMicrotask(focus);else setTimeout(focus,0);
  }
  function selectOption(option){
    if(!option||disabled||option.disabled)return;
    if(selected.some(row=>!row.unresolved&&row.value===option.value))return;
    if(!multiple)selected=[];
    if(limit&&selected.length>=limit)return;
    selected.push({value:option.value,label:option.label,option,unresolved:false,legacy_value:null,reason:null});
    query='';
    refreshState({syncSearch:true});notify();refocusSearch();
  }
  function removeAt(index){if(disabled||index<0||index>=selected.length)return;selected.splice(index,1);refreshState();notify();}
  function clear(){if(disabled||!selected.length)return;selected=[];query='';refreshState({syncSearch:true});notify();refocusSearch();}

  root.className=`controlled-selector${disabled?' is-disabled':''}`;
  root.innerHTML=`
    <div class="controlled-selector-chips" aria-live="polite">${chipsHtml()}</div>
    <details class="controlled-selector-menu" ${disabled?'data-disabled="1"':''}>
      <summary>${esc(summaryText())}</summary>
      <div class="controlled-selector-popover">
        <div class="controlled-selector-search-row"><input type="search" data-cs-search value="${esc(query)}" placeholder="${esc(placeholder)}" autocomplete="off" ${disabled?'disabled':''}><button type="button" data-cs-clear ${disabled||!selected.length?'disabled':''}>清除</button></div>
        <div class="controlled-selector-options" role="listbox" aria-multiselectable="${multiple?'true':'false'}">${optionsHtml()}</div>
      </div>
    </details>`;

  root.addEventListener('compositionstart',event=>{if(event.target?.matches?.('[data-cs-search]'))composing=true;});
  root.addEventListener('compositionend',event=>{
    if(!event.target?.matches?.('[data-cs-search]'))return;
    composing=false;query=event.target.value;renderOptions();root.querySelector('details')?.setAttribute('open','');
  });
  root.addEventListener('input',event=>{
    if(!event.target?.matches?.('[data-cs-search]'))return;
    query=event.target.value;
    if(composing||event.isComposing)return;
    renderOptions();root.querySelector('details')?.setAttribute('open','');
  });
  root.addEventListener('click',event=>{
    const optionButton=event.target?.closest?.('[data-cs-option-value]');
    if(optionButton&&root.contains(optionButton)){selectOption(optionByValue.get(text(optionButton.dataset.csOptionValue)));return;}
    const removeButton=event.target?.closest?.('[data-cs-remove]');
    if(removeButton&&root.contains(removeButton)){removeAt(Number(removeButton.dataset.csRemove));return;}
    const clearButton=event.target?.closest?.('[data-cs-clear]');
    if(clearButton&&root.contains(clearButton)){clear();}
  });
  if(disabled)root.querySelector('details')?.removeAttribute('open');

  return Object.freeze({
    values:()=>Object.freeze([...publicValues()]),
    unresolved:()=>Object.freeze(unresolvedValues()),
    setValues(next){selected=[...reconcileControlledValues(next,normalized).selected];query='';refreshState({syncSearch:true});},
    clear,
    optionCount:()=>normalized.length,
  });
}

export function createControlledNumberMapEditor(root,{
  options=[],value={},selectionLabel='新增食材',placeholder='搜尋食材…',minimum=0,disabled=false,onChange=null,
}={}){
  if(!root)throw new Error('controlled_number_map_root_required');
  const normalized=normalizeControlledOptions(options),optionByValue=new Map(normalized.map(option=>[option.value,option]));
  const initial=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const entries=new Map();
  for(const [rawKey,rawNumber] of Object.entries(initial)){
    const key=text(rawKey),amount=Number(rawNumber);if(!key||!Number.isFinite(amount))continue;
    const reconciled=reconcileControlledValues([key],normalized).selected[0];
    const storedKey=reconciled&&!reconciled.unresolved?reconciled.value:key;
    entries.set(storedKey,{value:Math.max(Number(minimum)||0,amount),unresolved:Boolean(reconciled?.unresolved),label:reconciled?.label||key,reason:reconciled?.reason||null});
  }
  function output(){return Object.fromEntries([...entries.entries()].sort(([a],[b])=>a.localeCompare(b,'zh-Hant')).map(([key,row])=>[key,row.value]));}
  function notify(){if(typeof onChange==='function')onChange(output());}
  function render(){
    root.className='controlled-number-map';
    root.innerHTML=`<div class="controlled-number-map-rows">${[...entries.entries()].map(([key,row],index)=>`<label class="controlled-number-map-row"><span>${esc(optionByValue.get(key)?.label||row.label)}${row.unresolved?' <b>REVIEW</b>':''}</span><input type="number" min="${esc(minimum)}" step="1" value="${esc(row.value)}" data-map-number="${index}" ${disabled?'disabled':''}><button type="button" data-map-remove="${index}" ${disabled?'disabled':''}>移除</button></label>`).join('')||'<span class="controlled-selector-empty">尚未設定食材安全庫存</span>'}</div><div data-map-add></div>`;
    const keys=[...entries.keys()];
    root.querySelectorAll('[data-map-number]').forEach(input=>input.addEventListener('input',()=>{const key=keys[Number(input.dataset.mapNumber)],row=entries.get(key),n=Number(input.value);if(row&&Number.isFinite(n)){row.value=Math.max(Number(minimum)||0,n);notify();}}));
    root.querySelectorAll('[data-map-remove]').forEach(button=>button.addEventListener('click',()=>{const key=keys[Number(button.dataset.mapRemove)];entries.delete(key);render();notify();}));
    const addRoot=root.querySelector('[data-map-add]');
    const unused=normalized.filter(option=>!entries.has(option.value));
    createControlledSelector(addRoot,{options:unused,values:[],multiple:false,selectionLabel,placeholder,disabled,onChange:values=>{const key=values[0];if(!key)return;const option=optionByValue.get(key);entries.set(key,{value:0,unresolved:false,label:option?.label||key,reason:null});render();notify();}});
  }
  render();
  return Object.freeze({value:()=>Object.freeze({...output()}),unresolved:()=>Object.freeze([...entries.entries()].filter(([,row])=>row.unresolved).map(([key,row])=>({value:key,reason:row.reason}))) });
}
