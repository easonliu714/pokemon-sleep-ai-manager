export const UC_IMG_EXPLICIT_ZERO_CONFIRMATION_VERSION='uc-img-explicit-zero-confirmation-2026-08-31-a';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').normalize('NFKC').trim();
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);

export function isObservedExplicitZero(observation){
  return Boolean(observation&&hasOwn(observation.observed_data,'quantity')&&observation.observed_data.quantity===0);
}

export function isInferredZeroObservation(observation){
  if(!isObservedExplicitZero(observation))return false;
  const reason=clean(observation?.reason).toLowerCase();
  const confidence=Number(observation?.confidence);
  return confidence===0||/not visible|not shown|absent|missing|畫面.*(?:未顯示|看不到|不存在)|未顯示|看不到|缺席/.test(reason);
}

export function hasExplicitZeroUserConfirmation(observation){
  return observation?.user_resolution?.action==='USER_CONFIRMED_ZERO'&&observation?.user_resolution?.confirmed_quantity===0;
}

export function zeroObservationRequiresExplicitUserConfirmation(observation){
  return isInferredZeroObservation(observation)&&!hasExplicitZeroUserConfirmation(observation);
}

export function confirmIngredientZeroObservation(payload,observationId,ingredientName,{confirmedAt=new Date().toISOString()}={}){
  const copy=clone(payload||{});
  const observation=(copy.observations||[]).find(item=>item?.observation_id===observationId);
  if(!observation)throw new Error(`找不到 Recognition observation：${observationId}`);
  if(!isObservedExplicitZero(observation))throw new Error('此 observation 不是明確 quantity=0');
  const canonicalName=clean(ingredientName);
  if(!canonicalName)throw new Error('請先選擇公版食材候選');
  observation.status='MATCHED';
  observation.canonical_key={ingredient_name:canonicalName};
  observation.canonical_name=canonicalName;
  observation.user_resolution={
    action:'USER_CONFIRMED_ZERO',
    confirmed_at:confirmedAt,
    confirmed_quantity:0,
    canonical_name:canonicalName,
    evidence_semantics:'USER_EXPLICIT_ZERO_CONFIRMATION_AFTER_NONVISIBLE_OR_ZERO_CONFIDENCE_OBSERVATION',
  };
  return copy;
}

function parseRecognitionTextarea(panel){
  const textarea=panel?.querySelector('.uc-img-response');
  if(!textarea)return {textarea:null,payload:null};
  const raw=clean(textarea.value);
  if(!raw)return {textarea,payload:null};
  try{return {textarea,payload:JSON.parse(raw)}}catch{return {textarea,payload:null};}
}

function inferredZeroRows(payload){
  return (Array.isArray(payload?.observations)?payload.observations:[]).filter(zeroObservationRequiresExplicitUserConfirmation);
}

function installUiGuard(scope=globalThis){
  const doc=scope?.document;
  if(!doc||typeof doc.addEventListener!=='function')return false;
  if(scope.PokemonSleepUcImgExplicitZeroConfirmationV042748?.installed)return true;

  const onClick=event=>{
    const target=event?.target;
    const panel=target?.closest?.('.uc-img-scenario[data-scenario="ingredients"]');
    if(!panel)return;

    const actionButton=target.closest?.('[data-rec-action="MATCH"]');
    if(actionButton){
      const card=actionButton.closest('.uc-img-recognition-card');
      const observationId=card?.dataset?.observationId;
      const {textarea,payload}=parseRecognitionTextarea(panel);
      const observation=(payload?.observations||[]).find(item=>item?.observation_id===observationId);
      if(!observation||!isInferredZeroObservation(observation))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const selected=clean(card.querySelector('.uc-img-rec-candidate')?.value);
      if(!selected){scope.alert?.('請先選擇公版食材候選。');return;}
      const accepted=scope.confirm?.(`目前畫面沒有可直接讀取的「${selected}」數量；AI 只能提出 quantity=0 候選。\n\n只有你實際確認「${selected} 的目前庫存就是 0」時才可繼續。\n\n確定庫存為 0？`);
      if(!accepted)return;
      try{
        const updated=confirmIngredientZeroObservation(payload,observationId,selected);
        textarea.value=JSON.stringify(updated,null,2);
        textarea.dispatchEvent(new Event('input',{bubbles:true}));
        panel.querySelector('.uc-img-parse')?.click();
      }catch(error){scope.alert?.(`0 庫存確認失敗：${error?.message||error}`);}
      return;
    }

    const transactionButton=target.closest?.('.uc-img-dry,.uc-img-apply');
    if(transactionButton){
      const {payload}=parseRecognitionTextarea(panel);
      const pending=inferredZeroRows(payload);
      if(!pending.length)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      scope.alert?.(`仍有 ${pending.length} 筆由「畫面缺席／0 信心」推論的 quantity=0 尚未取得使用者明確確認。\n請先逐筆選擇公版候選並按「確認公版候選」，再於確認視窗明確確認庫存為 0。`);
    }
  };

  doc.addEventListener('click',onClick,true);
  const api=Object.freeze({
    installed:true,
    version:UC_IMG_EXPLICIT_ZERO_CONFIRMATION_VERSION,
    isObservedExplicitZero,
    isInferredZeroObservation,
    hasExplicitZeroUserConfirmation,
    zeroObservationRequiresExplicitUserConfirmation,
    confirmIngredientZeroObservation,
  });
  scope.PokemonSleepUcImgExplicitZeroConfirmationV042748=api;
  return true;
}

if(typeof globalThis!=='undefined'&&globalThis.document)installUiGuard(globalThis);

export {installUiGuard};
