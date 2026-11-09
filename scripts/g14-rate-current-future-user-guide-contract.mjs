import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  scorePokemonProvisionalRating,planPokemonRosterProvisionalRegrade,
  POKEMON_PROVISIONAL_RATING_RULE_VERSION,
  POKEMON_PROVISIONAL_RATING_LABELS,
  POKEMON_PROVISIONAL_RATING_GUIDE,
} from '../assets/js/pokemon-provisional-rating.js';
import {
  buildPokemonRosterRatingView,renderPokemonRosterRatingViewHtml,
  createPokemonRatingSelection,changePokemonRatingSelection,reviewPokemonRatingSelection,
} from '../assets/js/pokemon-roster-rating-preview.js';
import {renderPokemonRatingGuideHtml} from '../assets/js/pokemon-rating-guide.js';

// Disposable synthetic facts only: no SQLite, Web Locks, network or player DB.
const skills=['樹果數量S','幫手獎勵','幫忙速度M','幫忙速度S','睡眠EXP獎勵'];
const levels=[10,25,50,70,80];
const pokemon={pokemon_id:'testA',pokemon_instance_id:'fixture-A',species:'fixture',
  specialty:'樹果',nature:'固執',nature_bonus:'幫忙速度',nature_penalty:'食材機率',
  level:20,rating:'D-'};
const subskills=skills.map((name,i)=>({pokemon_id:'testA',subskill_name:name,unlock_level:levels[i],is_unlocked:1}));
const source={pokemon:[pokemon],ingredients:[],subskills};
const before=JSON.stringify(source);
const scored=scorePokemonProvisionalRating({pokemon,subskills});
assert.equal(scored.status,'PROVISIONAL_HEURISTIC');
assert.deepEqual([scored.current_heuristic_score,scored.future_heuristic_score],[80,100]);
assert.deepEqual([scored.current_rating,scored.future_rating],['S-','S+']);
assert.equal(scored.proposed_rating,scored.future_rating,'original long-term rule must remain compatible');
assert.deepEqual([scored.current_contribution,scored.future_contribution],[30,33]);
const upgraded=scorePokemonProvisionalRating({pokemon:{...pokemon,level:70},subskills});
assert.equal(upgraded.current_rating,'S+','known future abilities become CURRENT by observed level only');
assert.equal(upgraded.future_rating,'S+');
const oldUnlocked=scorePokemonProvisionalRating({pokemon,subskills:subskills.map(x=>({...x,is_unlocked:1}))});
assert.equal(oldUnlocked.current_rating,'S-','stale is_unlocked flag must not promote future slots');
const held=scorePokemonProvisionalRating({pokemon,subskills:subskills.slice(0,2)});
assert.equal(held.current_rating,null);assert.equal(held.future_rating,null);
assert.equal(held.proposed_rating,null);assert.ok(held.missing_inputs.includes('subskill_level_50'));
const planning=planPokemonRosterProvisionalRegrade({pokemon:[pokemon],details:[{pokemon_id:'testA',subskills}]});
assert.equal(planning.proposals[0].current_rating,'S-');
assert.equal(planning.proposals[0].future_rating,'S+');
const view=buildPokemonRosterRatingView(source),model=createPokemonRatingSelection(view);
assert.equal(view.rows[0].current_heuristic_score,80);
assert.equal(view.rows[0].future_heuristic_score,100);
assert.equal(model.selected.size,0,'adoption remains opt-in and non-persistent');
assert.equal(changePokemonRatingSelection(model,'fixture-A',true),true);
const review=reviewPokemonRatingSelection(model);
assert.equal(review.adopt[0].current_rating,'S-');
assert.equal(review.adopt[0].future_rating,'S+');
assert.equal(review.player_data_write,false);
const html=renderPokemonRosterRatingViewHtml(view,model,{reviewOpen:true});
assert.match(html,/現在評級 CURRENT/);
assert.match(html,/未來評級 FUTURE/);
assert.match(html,/舊評（已儲存）/);
assert.match(html,/現在 S-／未來 S\+/);
assert.match(html,/未來評級篩選/);
assert.match(html,/data-rate4-readonly="true"/);
assert.doesNotMatch(html,/<button[^>]+(?:apply|save|overwrite)/i);
const doc=renderPokemonRatingGuideHtml();
const rule=POKEMON_PROVISIONAL_RATING_GUIDE;
assert.equal(rule.lower_bounds.length,15);
for(let i=0;i<POKEMON_PROVISIONAL_RATING_LABELS.length;i++){
  const max=i?rule.lower_bounds[i-1]-1:100,min=rule.lower_bounds[i];
  assert.ok(doc.includes('>'+POKEMON_PROVISIONAL_RATING_LABELS[i]+'</td><td>'+min+'～'+max+'</td>'),
    'help grade table must match live scoring thresholds');
}
for(const token of ['現在 CURRENT','未來 FUTURE','clamp(40 + 性格分 + 已解鎖副技能分',
  'clamp(40 + 性格分 + 全部已知副技能分','現在 = 40 + 10 + 30 = 80',
  '未來 = clamp(80 + 14 + 12 + 7) = 100',
  POKEMON_PROVISIONAL_RATING_RULE_VERSION,'HOLD','尚未匯入','尚未解鎖',
  '評級是什麼','舊評','不代表即時產能']){
  assert.ok(doc.includes(token),'guide explanatory fact missing: '+token);
}
const index=fs.readFileSync('index.html','utf8');
const line=index.split('\n').find(x=>x.includes('<section id="guide"'));
assert.ok(line.includes('<div id="adminAuthPanel" class="panel"></div><div class="panel prose" data-rating-guide-bottom="true">'));
assert.equal((index.match(/id="ratingRuleGuide"/g)||[]).length,1);
const app=fs.readFileSync('assets/js/app.js','utf8');
assert.match(app,/setupPokemonRatingGuide\(\)/);
assert.equal(JSON.stringify(source),before,'read-only preview mutated player source');
assert.equal(pokemon.rating,'D-','old rating must remain untouched');
console.log(JSON.stringify({gate:'G14_RATE_CURRENT_FUTURE_GUIDE_SOURCE',status:'PASS',
  current:'S-',future:'S+',dual_grade:true,guide_bottom:true,
  thresholds_exact:true,source_unchanged:true,no_rating_write:true}));
