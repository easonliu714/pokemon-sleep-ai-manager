import {rows} from './database.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=v=>(v===null||v===undefined||v==='')?'<span class="unknown">尚未匯入</span>':esc(v);
export function setupPokemonDetail(){
 const backdrop=document.getElementById('pokemonDetailBackdrop');
 const close=()=>{backdrop.classList.add('hidden');document.body.style.overflow='';};
 document.getElementById('closeDetailBtn').onclick=close;
 backdrop.onclick=e=>{if(e.target===backdrop)close();};
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
}
export function openPokemonDetail(id){
 const p=rows('SELECT * FROM pokemon WHERE pokemon_id=?',[id])[0];if(!p)return;
 const ingredients=rows('SELECT * FROM pokemon_ingredients WHERE pokemon_id=? ORDER BY unlock_level',[id]);
 const subskills=rows('SELECT * FROM pokemon_subskills WHERE pokemon_id=? ORDER BY unlock_level',[id]);
 document.getElementById('detailTitle').textContent=p.original_label||p.species;
 document.getElementById('detailSubtitle').textContent=`${p.nickname||'未設定暱稱'} · ${p.specialty||'未分類'} · ${p.type||'未確認'}`;
 document.getElementById('detailRating').textContent=p.rating||'未評級';
 const fields=[['等級',p.level],['SP',p.sp],['主技能',p.main_skill],['主技能等級',p.main_skill_level?`Lv${p.main_skill_level}`:null],['性格',p.nature],['性格提升',p.nature_bonus],['性格降低',p.nature_penalty],['幫忙速度',p.helper_seconds?`${p.helper_seconds} 秒`:null],['持有上限',p.carry_limit],['樹果',p.favorite_berry],['AI 分數',p.ai_score],['狀態',p.status]];
 const findIng=l=>ingredients.find(x=>Number(x.unlock_level)===l),findSub=l=>subskills.find(x=>Number(x.unlock_level)===l);
 document.getElementById('detailBody').innerHTML=`<div class="detail-grid">${fields.map(([k,v])=>`<div class="detail-card"><b>${esc(k)}</b>${value(v)}</div>`).join('')}</div><div class="detail-section"><h3>食材配置</h3><div class="skill-list">${[1,30,60].map(l=>{const x=findIng(l);return `<div class="skill-item"><b>Lv${l}</b><span>${x?`${esc(x.ingredient_name)}${x.quantity?` × ${x.quantity}`:''}`:'<span class="unknown">尚未匯入</span>'}</span></div>`}).join('')}</div></div><div class="detail-section"><h3>副技能</h3><div class="skill-list">${[10,25,50,75,100].map(l=>{const x=findSub(l);return `<div class="skill-item"><b>Lv${l}${x?.is_unlocked?' ✓':''}</b><span>${x?esc(x.subskill_name):'<span class="unknown">尚未匯入</span>'}</span></div>`}).join('')}</div></div><div class="detail-section"><h3>AI 管理建議</h3><div class="detail-card"><b>核心定位</b>${value(p.core_role)}</div><div class="detail-card"><b>培養建議</b>${value(p.recommendation)}</div><div class="detail-card"><b>道具建議</b>${value(p.item_advice)}</div><div class="detail-card"><b>適用情境</b>${value(p.scenarios)}</div></div>`;
 document.getElementById('pokemonDetailBackdrop').classList.remove('hidden');document.body.style.overflow='hidden';
}
