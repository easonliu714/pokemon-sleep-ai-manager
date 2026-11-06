import {
  listRecipeAttemptFeedbackHistory,
  getRecipeAttemptPersistenceStatus,
  recipeAttemptDefaultSource,
  recordRecipeAttemptFailure,
  setRecipeRecommendationPaused,
} from './recipe-attempt-feedback-local.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let draft=null;
let statusMessage='';
let saveInFlight=false;
// A missing, malformed or unreadable persistence authority is never permission
// to create feedback or change a recipe recommendation. Preserve the three
// existing verified readback states; every other state fails closed.
const VERIFIED_PERSISTENCE_STATUSES=new Set(['CLEAR','PERSISTED','NOT_PERSISTED']);
function readPersistenceStatus(){
  try{
    const status=getRecipeAttemptPersistenceStatus()?.status;
    if(VERIFIED_PERSISTENCE_STATUSES.has(status)||status==='IN_FLIGHT')return status;
  }catch{}
  return 'UNVERIFIED';
}
const persistenceBlocked=()=>!VERIFIED_PERSISTENCE_STATUSES.has(readPersistenceStatus());

function localDateTimeValue(date=new Date()){
  const offset=date.getTimezoneOffset()*60000;
  return new Date(date.getTime()-offset).toISOString().slice(0,16);
}
function ingredientText(rows=[]){
  return (rows||[]).map(row=>`${row.ingredient_name}=${row.consumed??row.quantity??0}`).join('\n');
}
function parseIngredientText(value){
  const rows=[];
  for(const raw of String(value||'').split(/[\n,，;；]+/)){
    const line=raw.normalize('NFKC').trim();
    if(!line)continue;
    const match=line.match(/^(.+?)\s*(?:=|:|：|×|x|X)\s*(\d+)$/);
    if(!match)throw new Error(`食材格式無法辨識：${line}；請使用「食材=數量」`);
    const quantity=Number(match[2]);
    if(!Number.isInteger(quantity)||quantity<=0)throw new Error(`食材數量必須為正整數：${line}`);
    rows.push({ingredient_name:match[1].trim(),quantity});
  }
  if(!rows.length)throw new Error('請至少輸入一項實際投入食材');
  return rows;
}
function findStep(result,recipeId){
  for(const plan of result?.alternatives||[]){
    const step=(plan.steps||[]).find(row=>String(row.recipe_id)===String(recipeId));
    if(step)return step;
  }
  return null;
}
function formatHistoryIngredients(rows=[]){
  return rows.map(row=>`${row.ingredient_name}×${row.quantity}`).join('、')||'—';
}
function historyHtml(history){
  if(!history.length)return '<p class="notice">尚無料理失敗嘗試紀錄。</p>';
  return `<div class="g62-history-list">${history.slice(0,8).map(row=>{
    // A missing or malformed SQLite pause flag is not verified permission to resume.
    const flag=row.recommendation_paused;
    const verifiedPause=flag===0||flag===1||flag==='0'||flag==='1';
    const paused=flag===1||flag==='1';
    // G6.2: the attempt-history source-review flag has no SQL CHECK(0,1).
    // Unknown, NULL or coerced truthy values are not proof of a clean source.
    // Keep the player's existing state unchanged until the flag is verified.
    const referenceFlag=row.reference_maybe_wrong;
    const verifiedReference=referenceFlag===0||referenceFlag===1||referenceFlag==='0'||referenceFlag==='1';
    const suspectReference=referenceFlag===1||referenceFlag==='1';
    // Historical attempt provenance cannot substitute for the CURRENT SQLite
    // source-review state. Unknown/NULL current flags block player writes.
    const currentReferenceFlag=row.current_reference_maybe_wrong;
    const verifiedCurrentReference=currentReferenceFlag===0||currentReferenceFlag===1
      ||currentReferenceFlag==='0'||currentReferenceFlag==='1';
    return `
    <article class="war-team-card g62-history-row">
      <div class="war-team-card-head"><div><b>${esc(row.recipe_name)}</b><p class="notice">${esc(row.attempted_at)}</p></div>
        <span class="war-team-status ${!verifiedPause||!verifiedReference||!verifiedCurrentReference||paused?'review':'ready'}">${!verifiedPause?'推薦狀態待核對':!verifiedReference?'參考來源狀態待核對':!verifiedCurrentReference?'目前參考來源狀態待核對':paused?'已暫停推薦':'可重新推薦'}</span></div>
      <p><b>實際投入：</b>${esc(formatHistoryIngredients(row.actual_ingredients))}</p>
      <p class="notice"><b>來源：</b>${esc(row.source_name||row.source_type||'玩家回報')}${row.source_ref?` · ${esc(row.source_ref)}`:''}</p>
      ${!verifiedReference?'<p class="notice warning" data-g62-reference-state-hold>參考配方標記狀態未驗證；暫不提供推薦狀態切換，請先核對資料。</p>':suspectReference?'<p class="notice warning"><b>玩家標記：</b>參考配方可能錯誤</p>':''}
      ${!verifiedCurrentReference?'<p class="notice warning" data-g62-current-reference-state-hold>目前 SQLite 參考來源狀態未驗證；歷史嘗試紀錄不能授權推薦狀態切換。</p>':''}
      ${row.notes?`<p class="notice">${esc(row.notes)}</p>`:''}
      ${verifiedPause&&verifiedReference&&verifiedCurrentReference?`<div class="buttons"><button type="button" data-g62-toggle="${esc(row.recipe_id)}" data-g62-paused="${paused?'1':'0'}">${paused?'解除暫停推薦':'暫停推薦'}</button></div>`:!verifiedPause?`<p class="notice warning" data-g62-pause-state-hold>本機推薦暫停狀態未驗證；暫不提供切換操作，請先核對資料。</p>`:''}
    </article>`}).join('')}</div>`;
}
function draftHtml(){
  if(!draft)return '';
  return `<section class="panel g62-feedback-form" data-g62-feedback-form>
    <h4>記錄「本次嘗試未開啟」：${esc(draft.recipe_name)}</h4>
    <p class="notice warning">此紀錄只保存在你的本機 SQLite，屬於玩家個人回饋；不會修改 Public Recipe Master，也不會把單次失敗判定成公版配方錯誤。</p>
    <label><span>嘗試時間</span><input type="datetime-local" data-g62-attempted-at value="${esc(draft.attempted_at)}"></label>
    <label><span>實際投入食材（每行「食材=數量」）</span><textarea rows="5" data-g62-ingredients>${esc(draft.ingredients_text)}</textarea></label>
    <label><span>參考來源名稱</span><input type="text" data-g62-source-name value="${esc(draft.source_name||'')}"></label>
    <label><span>參考來源網址／識別</span><input type="text" data-g62-source-ref value="${esc(draft.source_ref||'')}"></label>
    <label><span>備註</span><textarea rows="3" data-g62-notes placeholder="可記錄版本、翻譯差異或實際操作情況"></textarea></label>
    <label><input type="checkbox" data-g62-reference-wrong> 參考配方可能錯誤</label>
    <label><input type="checkbox" data-g62-pause checked> 暫停推薦此配方</label>
    <p class="notice">查證提示：第三方參考資料可能因遊戲版本、翻譯或資料更新而失效。建議先核對官方／遊戲內資訊，或比較其他可信來源，再消耗稀有食材。</p>
    <div class="buttons"><button type="button" data-g62-save ${persistenceBlocked()?'disabled aria-disabled="true"':''}>儲存失敗嘗試</button><button type="button" data-g62-cancel>取消</button></div>
  </section>`;
}
function panelHtml(history,result){
  const suppressed=result?.suppressed_by_feedback||[];
  return `<section class="panel g62-feedback-panel" data-g62-feedback-panel>
    <div class="war-team-toolbar"><div><h3>G6.2 Recipe Attempt Feedback</h3>
      <p class="notice">個人失敗紀錄只影響本機推薦；canonical recipe identity、配方、解鎖狀態與 Public Recipe Master 都不會被改寫。</p></div></div>
    ${statusMessage?`<p class="notice">${esc(statusMessage)}</p>`:''}
    ${suppressed.length?`<p class="notice warning"><b>目前暫停推薦 ${suppressed.length} 道：</b>${esc(suppressed.map(row=>row.recipe_name).join('、'))}</p>`:'<p class="notice">目前沒有因個人失敗回饋而暫停的料理。</p>'}
    ${draftHtml()}
    <details ${history.length?'open':''}><summary>本機失敗嘗試歷程（最近 8 筆）</summary>${historyHtml(history)}</details>
  </section>`;
}

export function bindRecipeAttemptFeedbackUi(root,result,{rerender}={}){
  if(!root)return;
  const recovery={status:readPersistenceStatus()};
  if(recovery.status==='IN_FLIGHT')statusMessage='本機資料寫入進行中，請等待儲存完成再修改推薦狀態。';
  if(recovery.status==='UNVERIFIED')statusMessage='PERSISTENCE_UNCERTAIN：本次 SQLite 已提交，但持久化未確認。請正常重新載入，等待資料庫就緒並核對本機歷程；本頁禁止重試及修改推薦狀態。';
  if(recovery.status==='PERSISTED')statusMessage='重新載入後讀回確認：原失敗紀錄已持久化，請勿再次提交同一次嘗試。';
  if(recovery.status==='NOT_PERSISTED')statusMessage='重新載入後讀回確認：目前 SQLite 未找到原失敗紀錄；請先核對歷程，再決定是否重新記錄。';
  let history=[];
  try{history=listRecipeAttemptFeedbackHistory(20);}catch(error){statusMessage=`Feedback 歷程暫時無法讀取：${error?.message||error}`;}
  root.querySelector('[data-g62-feedback-panel]')?.remove();
  root.insertAdjacentHTML('beforeend',panelHtml(history,result));

  root.querySelectorAll('[data-g62-attempt-failed]').forEach(button=>{
    button.addEventListener('click',()=>{
      if(persistenceBlocked()){statusMessage='PERSISTENCE_UNCERTAIN：請先重新載入並核對歷程，禁止再次建立失敗嘗試。';rerender?.();return;}
      const recipeId=button.dataset.g62AttemptFailed;
      const step=findStep(result,recipeId);
      if(!step){statusMessage='找不到本次推薦步驟，請重新計算後再試。';rerender?.();return;}
      const source=recipeAttemptDefaultSource(recipeId);
      draft={
        recipe_id:recipeId,
        recipe_name:step.recipe_name||recipeId,
        attempted_at:localDateTimeValue(),
        ingredients_text:ingredientText(step.ingredients),
        source_type:source.source_type,
        source_name:source.source_name||'',
        source_ref:source.source_ref||'',
      };
      statusMessage='';
      rerender?.();
    });
  });

  root.querySelector('[data-g62-cancel]')?.addEventListener('click',()=>{draft=null;statusMessage='';rerender?.();});
  root.querySelector('[data-g62-save]')?.addEventListener('click',async()=>{
    const form=root.querySelector('[data-g62-feedback-form]');
    if(!form||!draft||saveInFlight)return;
    if(persistenceBlocked()){statusMessage='PERSISTENCE_UNCERTAIN：禁止重複提交，請重新載入並核對歷程。';rerender?.();return;}
    saveInFlight=true;
    const saveButton=root.querySelector('[data-g62-save]');
    if(saveButton)saveButton.disabled=true;
    try{
      const localValue=form.querySelector('[data-g62-attempted-at]')?.value;
      const attemptedAt=localValue?new Date(localValue).toISOString():new Date().toISOString();
      const record=await recordRecipeAttemptFailure({
        recipe_id:draft.recipe_id,
        attempted_at:attemptedAt,
        actual_ingredients:parseIngredientText(form.querySelector('[data-g62-ingredients]')?.value),
        source:{
          source_type:draft.source_type,
          source_name:form.querySelector('[data-g62-source-name]')?.value,
          source_ref:form.querySelector('[data-g62-source-ref]')?.value,
        },
        reference_maybe_wrong:Boolean(form.querySelector('[data-g62-reference-wrong]')?.checked),
        recommendation_paused:Boolean(form.querySelector('[data-g62-pause]')?.checked),
        notes:form.querySelector('[data-g62-notes]')?.value||'',
      });
      statusMessage=`已記錄 ${record.recipe_name} 的失敗嘗試；${record.recommendation_paused?'已暫停推薦':'仍允許推薦'}。`;
      draft=null;
      rerender?.();
    }catch(error){
      statusMessage=error?.code==='PERSISTENCE_UNCERTAIN'?'PERSISTENCE_UNCERTAIN：SQLite 已提交但本機持久化結果不明；請重新載入並核對歷程，勿重複提交。':`儲存失敗：${error?.message||error}`;
      rerender?.();
    }finally{
      saveInFlight=false;
    }
  });
  root.querySelectorAll('[data-g62-toggle]').forEach(button=>{
    button.addEventListener('click',async()=>{
      if(persistenceBlocked()){statusMessage='PERSISTENCE_UNCERTAIN：請先重新載入並核對歷程，暫停其他玩家資料寫入。';rerender?.();return;}
      // Defense in depth: a stale/forged DOM toggle cannot bypass the read-side HOLD.
      if(!['0','1'].includes(button.dataset.g62Paused)){
        statusMessage='推薦暫停狀態未驗證，禁止依未知狀態切換；請先核對本機資料。';
        rerender?.();return;
      }
      try{
        const currentlyPaused=button.dataset.g62Paused==='1';
        const resultState=await setRecipeRecommendationPaused(button.dataset.g62Toggle,!currentlyPaused);
        statusMessage=`${resultState.recipe_name}：${resultState.recommendation_paused?'已暫停推薦':'已恢復推薦'}。`;
        rerender?.();
      }catch(error){
        statusMessage=error?.code==='PERSISTENCE_UNCERTAIN'
          ?'PERSISTENCE_UNCERTAIN：推薦狀態已提交但持久化未確認；請正常重新載入並核對狀態，勿重試。'
          :error?.code==='RECIPE_ATTEMPT_WRITE_IN_FLIGHT'
            ?'本機資料正在儲存，請等待完成後再修改推薦狀態。'
            :`更新推薦狀態失敗：${error?.message||error}`;
        rerender?.();
      }
    });
  });
}
