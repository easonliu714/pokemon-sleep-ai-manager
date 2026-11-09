// G14.RATE live detail advice is a pure projection, never a player-data
// writer. Hypothetical seed/mint effects are not promoted to observations.
import {scorePokemonProvisionalRating} from './pokemon-provisional-rating.js';

const txt=v=>String(v??'').normalize('NFKC').trim();
const esc=v=>txt(v).replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[ch]));
const grade=v=>v??'HOLD';
const cmp=(a,b)=>txt(a)===txt(b);
const indexed=rows=>new Map((Array.isArray(rows)?rows:[]).map(x=>[Number(x.unlock_level),x.subskill_name]));
const reason=(kind,before,after)=>Object.freeze({kind,before,after});
const values=source=>scorePokemonProvisionalRating({
  pokemon:source.pokemon,ingredients:source.ingredients,subskills:source.subskills,
});
export function projectPokemonRatingChange({previous,current,committed=false}={}){
  if(!previous?.pokemon||!current?.pokemon)return Object.freeze({status:'HOLD_SOURCE_UNAVAILABLE',reasons:[]});
  const before=values(previous),after=values(current),changes=[];
  const p=previous.pokemon,n=current.pokemon;
  if(!cmp(p.nature,n.nature))changes.push(reason('性格',p.nature,n.nature));
  if(!cmp(p.main_skill_level,n.main_skill_level))
    changes.push(reason('主技能等級',p.main_skill_level,n.main_skill_level));
  if(!cmp(p.level,n.level))changes.push(reason('寶可夢等級',p.level,n.level));
  if(!cmp(p.specialty,n.specialty))changes.push(reason('專長',p.specialty,n.specialty));
  if(!cmp(p.main_skill,n.main_skill))changes.push(reason('主技能',p.main_skill,n.main_skill));
  const oldSkills=indexed(previous.subskills),newSkills=indexed(current.subskills);
  for(const level of [10,25,50,70,80])
    if(!cmp(oldSkills.get(level),newSkills.get(level)))
      changes.push(reason('Lv'+level+' 副技能',oldSkills.get(level),newSkills.get(level)));
  return Object.freeze({
    status:after.status==='PROVISIONAL_HEURISTIC'?'ADVICE_READY':'HOLD',
    committed,changes:Object.freeze(changes),previous:before,current:after,
    previous_saved_rating:p.rating??null,current_saved_rating:n.rating??null,
    can_propose_save:committed&&after.status==='PROVISIONAL_HEURISTIC'
      &&typeof n.pokemon_instance_id==='string'&&!!n.pokemon_instance_id.trim(),
    player_data_write:false,
  });
}
export function renderPokemonRatingChangeAdvice(advice){
  if(!advice||advice.status==='HOLD_SOURCE_UNAVAILABLE')
    return '<div class="notice">評等建議待載入（不修改資料）。</div>';
  const out=advice.current,before=advice.previous;
  const changed=advice.changes.map(c=>esc(c.kind)+'：'+esc(c.before||'未知')+' → '+esc(c.after||'未知')).join('；');
  const status=out.status==='PROVISIONAL_HEURISTIC'
    ?'現在 '+grade(out.current_rating)+'（'+out.current_heuristic_score+' 分）／未來 '
      +grade(out.future_rating)+'（'+out.future_heuristic_score+' 分）'
    :'HOLD：'+esc([...(out.missing_inputs||[]),...(out.reason_codes||[])].join('、'));
  const delta=before?.status==='PROVISIONAL_HEURISTIC'&&out.status==='PROVISIONAL_HEURISTIC'
    ?'變動前：現在 '+grade(before.current_rating)+'／未來 '+grade(before.future_rating)
      +'；變動後：現在 '+grade(out.current_rating)+'／未來 '+grade(out.future_rating)
    :'';
  const mainLevelStatus=out.main_skill_level_scored===false
    ?'主技能等級尚無可信數值：未納入主技能等級加分（未將 UNKNOWN 當成 Lv1）。'
    :'已記錄的主技能等級加分：'+(out.main_skill_level_contribution??0)+'（平台適性權重，非官方產能）。';
  return '<div class="notice" data-rating-reactive-advice="true"><strong>'
    +(advice.committed?'個體最新資料的評級建議':'尚未儲存的個體修改情境預覽')+'</strong>'
    +'<p>舊評（已儲存）：'+esc(advice.current_saved_rating??'未評級')
    +'；<strong>'+esc(status)+'</strong>。</p>'
    +(changed?'<p>變動原因：'+changed+'。</p>':'<p>尚無個體資料差異。</p>')
    +(delta?'<p>'+esc(delta)+'</p>':'')
    +'<p>'+esc(mainLevelStatus)+'</p>'
    +'<p>性格變更或技能升級只在遊戲內已確認並更新個體資料後才算正式現況；道具未使用前只能模擬。'
    +'推薦等級與實際技能效果或回本率不同；HOLD 不得自動填入。</p>'
    +'<p>RATE.4 評級套用尚未獲正式授權，目前只提供唯讀建議；'
    +'不會自動覆寫既有 <code>pokemon.rating</code>。</p></div>';
}
