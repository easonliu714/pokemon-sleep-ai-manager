// G14 RATE.4: explain exactly the same non-official provisional scoring
// constants used by the evaluator; never create a second weights authority.
import {
  POKEMON_PROVISIONAL_RATING_RULE_VERSION,
  POKEMON_PROVISIONAL_RATING_LABELS,
  POKEMON_PROVISIONAL_RATING_GUIDE,
} from './pokemon-provisional-rating.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtWeight=value=>value>0?'+'.concat(String(value)):value===0?'—':String(value);
export function renderPokemonRatingGuideHtml(){
  const rule=POKEMON_PROVISIONAL_RATING_GUIDE;
  const thresholds=POKEMON_PROVISIONAL_RATING_LABELS.map((grade,i)=>{
    const min=rule.lower_bounds[i],max=i===0?100:rule.lower_bounds[i-1]-1;
    return '<tr><td>'+esc(grade)+'</td><td>'+min+'–'+max+'</td></tr>';
  }).join('');
  const categories=['樹果','食材','技能'];
  const subskillNames=[...new Set(categories.flatMap(t=>Object.keys(rule.subskill_weights[t])))];
  const weights=subskillNames.map(name=>'<tr><td>'+esc(name)+'</td>'
    +categories.map(t=>'<td>'+fmtWeight(rule.subskill_weights[t][name]||0)+'</td>').join('')+'</tr>').join('');
  const natures=[
    ['樹果','幫忙速度',10],
    ['食材','食材機率',12],['食材','幫忙速度',6],
    ['技能','主技能發動機率',12],['技能','幫忙速度',6],
  ];
  const natureRows=natures.map(([role,key])=>{
    const points=rule.nature_weights[role][key];
    return '<tr><td>'+esc(role)+'</td><td>'+esc(key)+'</td><td>+'+points+'／-'+points+'</td></tr>';
  }).join('');
  return '<div data-rating-guide-rule="'+esc(POKEMON_PROVISIONAL_RATING_RULE_VERSION)+'">'
    +'<p>本平台的 <strong>15 階評等</strong>是長期培養專長適性啟發式評分，不是《Pokémon Sleep》官方戰力、能量產出、技能發動率、培養回本或科學預測。'
    +'規則版本：<code>'+esc(POKEMON_PROVISIONAL_RATING_RULE_VERSION)+'</code>。</p>'
    +'<p><strong>公式：</strong>先給 '+rule.base_points+' 分基礎分；依專長、性格與已知副技能加減分，將結果限制在 0–100 分，再依下表換算 15 階。'
    +'分數不是官方機率或技能乘數。</p>'
    +'<div class="table-wrap"><table><caption>15 階評級與分數區間</caption><thead><tr><th>評級</th><th>分數</th></tr></thead><tbody>'+thresholds+'</tbody></table></div>'
    +'<div class="table-wrap"><table><caption>專長別副技能權重（分）</caption><thead><tr><th>副技能</th><th>樹果</th><th>食材</th><th>技能</th></tr></thead><tbody>'+weights+'</tbody></table></div>'
    +'<div class="table-wrap"><table><caption>性格適性加減分（上升／下降）</caption><thead><tr><th>專長</th><th>性格效果</th><th>加分／扣分</th></tr></thead><tbody>'+natureRows+'</tbody></table></div>'
    +'<p><strong>必要證據：</strong>物種、專長、性格、可信等級，以及 Lv10／25／50／70／80 五個副技能的已確認名稱；食材專長還需要 Lv1 食材，技能專長還需要主技能。'
    +'相互矛盾或尚未匯入的欄位不會被猜成 0 分；身分有待覆核時標記 <strong>HOLD</strong>。</p>'
    +'<p><strong>CURRENT vs FUTURE：</strong>已確認但高於目前等級的副技能可以加進長期潛力，卻只列在 FUTURE，不冒充已解鎖的 CURRENT。'
    +'某技能「尚未解鎖」和其名稱「尚未匯入」是不同狀態，不需練到 Lv80 才能評估。</p>'
    +'<p><strong>檢視及儲存：</strong>先在「寶可夢」產生唯讀預覽並查看缺值／理由，逐隻選擇「擬採用」，確認舊評→新評後才可進行明確儲存。'
    +'沒有選擇的個體一律保留原評，HOLD 不可套用；任何實際儲存需要快照、交易級跨分頁鎖、耐久 ACK 與讀回。'
    +'顯示新級別不代表已寫入 <code>pokemon.rating</code>。</p>'
    +'</div>';
}
export function setupPokemonRatingGuide(){
  const mount=globalThis.document?.getElementById('ratingRuleGuide');
  if(mount)mount.innerHTML=renderPokemonRatingGuideHtml();
}
