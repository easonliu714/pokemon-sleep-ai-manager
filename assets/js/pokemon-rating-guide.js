// RATE.4 documentation for the Owner-approved read-only dual-grade preview.
// Never duplicate scoring thresholds: all weights come from the live evaluator.
import {
  POKEMON_PROVISIONAL_RATING_RULE_VERSION,
  POKEMON_CURRENT_FUTURE_RATING_VIEW_VERSION,
  POKEMON_PROVISIONAL_RATING_LABELS,
  POKEMON_PROVISIONAL_RATING_GUIDE,
} from './pokemon-provisional-rating.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=n=>n>0?'+'.concat(String(n)):n===0?'—':String(n);
const gradeRows=rule=>POKEMON_PROVISIONAL_RATING_LABELS.map((grade,index)=>{
  const min=rule.lower_bounds[index],max=index===0?100:rule.lower_bounds[index-1]-1;
  return '<tr><td>'+esc(grade)+'</td><td>'+min+'～'+max+'</td></tr>';
}).join('');
const weightsTable=rule=>{
  const roles=['樹果','食材','技能'];
  const names=[...new Set(roles.flatMap(role=>Object.keys(rule.subskill_weights[role])))];
  return names.map(name=>'<tr><th scope="row">'+esc(name)+'</th>'
    +roles.map(role=>'<td>'+signed(rule.subskill_weights[role][name]||0)+'</td>').join('')+'</tr>').join('');
};
const natureTable=rule=>{
  const dimensions=[
    ['樹果','幫忙速度'],
    ['食材','食材機率'],
    ['食材','幫忙速度'],
    ['技能','主技能發動機率'],
    ['技能','幫忙速度'],
  ];
  return dimensions.map(([role,effect])=>{
    const weight=rule.nature_weights[role][effect];
    return '<tr><td>'+esc(role)+'</td><td>'+esc(effect)+'</td><td>+'+weight+'／-'+weight+'</td></tr>';
  }).join('');
};
export function renderPokemonRatingGuideHtml(){
  const rule=POKEMON_PROVISIONAL_RATING_GUIDE;
  return '<div data-rating-guide-rule="'+esc(POKEMON_PROVISIONAL_RATING_RULE_VERSION)
    +'" data-rating-projection="'+esc(POKEMON_CURRENT_FUTURE_RATING_VIEW_VERSION)+'">'
    +'<p><strong>這套評級是什麼？</strong>以寶可夢專長、性格與已知副技能計算「培養適性」，不是官方戰力或實際產能。'
    +'兩個分數都採用相同 15 階門檻，且不代表投入糖果後的回報率。</p>'
    +'<div class="table-wrap"><table><caption>先理解兩個評級</caption><thead><tr><th>欄位</th><th>評估範圍</th><th>用途</th></tr></thead><tbody>'
    +'<tr><th scope="row">現在 CURRENT</th><td>基礎分＋性格加減分＋目前等級已解鎖的已知副技能</td><td>查看目前配置的適性；非即時產能</td></tr>'
    +'<tr><th scope="row">未來 FUTURE</th><td>基礎分＋性格加減分＋Lv10／25／50／70／80 全部已知副技能</td><td>查看完整配置長期潛力；非保證回本</td></tr>'
    +'</tbody></table></div>'
    +'<p><strong>簡單算式：</strong><code>現在分 = clamp(40 + 性格分 + 已解鎖副技能分, 0, 100)</code>；'
    +'<code>未來分 = clamp(40 + 性格分 + 全部已知副技能分, 0, 100)</code>。'
    +'其中 <code>clamp</code> 表示低於 0 計 0，高於 100 計 100。依分數對照下表評級。</p>'
    +'<p><strong>範例：</strong>一隻 Lv20 樹果專長、幫忙速度有利性格（+10）、Lv10 已有樹果數量S（+30），'
    +'Lv25／50／70 分別有幫手獎勵（+14）、幫忙速度M（+12）、幫忙速度S（+7）：'
    +'現在 = 40 + 10 + 30 = 80 → <strong>S-</strong>；未來 = clamp(80 + 14 + 12 + 7) = 100 → <strong>S+</strong>。'
    +'這表示「完整配置才可能達到較高適性」，不是現在的產能已達 S+。</p>'
    +'<div class="table-wrap"><table><caption>15 階分數對照</caption><thead><tr><th>評級</th><th>分數範圍</th></tr></thead><tbody>'
    +gradeRows(rule)+'</tbody></table></div>'
    +'<div class="table-wrap"><table><caption>專長副技能加分（未列出者為 0 分，須有已驗證名稱）</caption>'
    +'<thead><tr><th>副技能</th><th>樹果</th><th>食材</th><th>技能</th></tr></thead><tbody>'
    +weightsTable(rule)+'</tbody></table></div>'
    +'<div class="table-wrap"><table><caption>性格適性加減分</caption><thead><tr><th>專長</th><th>性格效果</th><th>上升／下降</th></tr></thead><tbody>'
    +natureTable(rule)+'</tbody></table></div>'
    +'<p><strong>資料不足會 HOLD：</strong>必須確認物種、專長、性格、目前等級和五個副技能名稱；'
    +'食材專長另需 Lv1 食材、技能專長另需主技能。身分待覆核、衝突或尚未匯入不可假設成零，'
    +'「尚未匯入」不等於「尚未解鎖」，不必培養到 Lv80 才能預覽未來潛力。</p>'
    +'<p><strong>安全儲存規則：</strong>「舊評」仍是既有玩家資料庫值；現在／未來兩欄是唯讀衍生建議。'
    +'擬採用／保留是暫存在本頁的選擇，不代表已保存；未經逐隻明確確認、快照、'
    +'跨分頁交易級保護、耐久寫入及重新讀回，不會覆寫 <code>pokemon.rating</code>。HOLD 一律不得套用。</p>'
    +'<p><small>規則 '+esc(POKEMON_PROVISIONAL_RATING_RULE_VERSION)+'；雙評級展示 '
    +esc(POKEMON_CURRENT_FUTURE_RATING_VIEW_VERSION)+'</small></p>'
    +'</div>';
}
export function setupPokemonRatingGuide(){
  const mount=globalThis.document?.getElementById('ratingRuleGuide');
  if(mount)mount.innerHTML=renderPokemonRatingGuideHtml();
}
