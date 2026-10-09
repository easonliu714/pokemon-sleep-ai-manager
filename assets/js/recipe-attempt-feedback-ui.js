import {
  listRecipeAttemptFeedbackHistory,
  recipeAttemptDefaultSource,
  recordRecipeAttemptFailure,
  setRecipeRecommendationPaused,
} from './recipe-attempt-feedback-local.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let draft=null;
let statusMessage='';

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
  return `<div class="g62-history-list">${history.slice(0,8).map(row=>`
    <article class="war-team-card g62-history-row">
      <div class="war-team-card-head"><div><b>${esc(row.recipe_name)}</b><p class="notice">${esc(row.attempted_at)}</p></div>
        <span class="war-team-status ${Number(row.recommendation_paused)===1?'review':'ready'}">${Number(row.recommendation_paused)===1?'已暫停推薦':'可重新推薦'}</span></div>
      <p><b>實際投入：</b>${esc(formatHistoryIngredients(row.actual_ingredients))}</p>
      <p class="notice"><b>來源：</b>${esc(row.source_name||row.source_type||'玩家回報')}${row.source_ref?` · ${esc(row.source_ref)}`:''}</p>
      ${Number(row.reference_maybe_wrong)===1?'<p class="notice warning"><b>玩家標記：</b>參考配方可能錯誤</p>':''}
      ${row.notes?`<p class="notice">${esc(row.notes)}</p>`:''}
      <div class="buttons"><button type="button" data-g62-toggle="${esc(row.recipe_id)}" data-g62-paused="${Number(row.recommendation_paused)===1?'1':'0'}">${Number(row.recommendation_paused)===1?'解除暫停推薦':'暫停推薦'}</button></div>
    </article>`).join('')}</div>`;
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
    <div class="buttons"><button type="button" data-g62-save>儲存失敗嘗試</button><button type="button" data-g62-cancel>取消</button></div>
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
  let history=[];
  try{history=listRecipeAttemptFeedbackHistory(20);}catch(error){statusMessage=`Feedback 歷程暫時無法讀取：${error?.message||error}`;}
  root.querySelector('[data-g62-feedback-panel]')?.remove();
  root.insertAdjacentHTML('beforeend',panelHtml(history,result));

  root.querySelectorAll('[data-g62-attempt-failed]').forEach(button=>{
    button.addEventListener('click',()=>{
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
    if(!form||!draft)return;
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
      statusMessage=`儲存失敗：${error?.message||error}`;
      rerender?.();
    }
  });
  root.querySelectorAll('[data-g62-toggle]').forEach(button=>{
    button.addEventListener('click',async()=>{
      try{
        const currentlyPaused=button.dataset.g62Paused==='1';
        const resultState=await setRecipeRecommendationPaused(button.dataset.g62Toggle,!currentlyPaused);
        statusMessage=`${resultState.recipe_name}：${resultState.recommendation_paused?'已暫停推薦':'已恢復推薦'}。`;
        rerender?.();
      }catch(error){
        statusMessage=`更新推薦狀態失敗：${error?.message||error}`;
        rerender?.();
      }
    });
  });
}
