import assert from 'node:assert/strict';
import {
  POKEMON_ROSTER_FILTER_CONTRACT_VERSION,
  ingredientSlotUnlocked,
  subskillSlotUnlocked,
  buildPokemonRosterFilterProfiles,
  buildPokemonRosterFacetOptions,
  profileMatchesRosterFilters,
  recommendationEvidenceForProfile,
  rankRosterFilterMatches,
} from '../assets/js/pokemon-roster-filter-contract.js';

const pokemonRows=[
  {pokemon_id:'P1',status:'active',original_label:'食材甲',level:25,rating:'A',specialty:'食材',favorite_berry:'金枕果',main_skill:'食材獲取S',nature:'內斂',nature_bonus:'食材機率',nature_penalty:'幫忙速度'},
  {pokemon_id:'P2',status:'active',original_label:'食材乙',level:35,rating:'S',specialty:'食材',favorite_berry:'橙橙果',main_skill:'能量填充S',nature:'固執',nature_bonus:'幫忙速度',nature_penalty:'食材機率'},
  {pokemon_id:'P3',status:'active',original_label:'食材丙',level:60,rating:'B',specialty:'技能',favorite_berry:'葡萄果',main_skill:'食材獲取S',nature:'勤奮',nature_bonus:'無',nature_penalty:'無'},
  {pokemon_id:'ARCHIVE',status:'archived',original_label:'封存',level:60,rating:'S+',specialty:'食材',favorite_berry:'金枕果',main_skill:'食材獲取S',nature:'內斂'},
];
const ingredientRows=[
  {pokemon_id:'P1',unlock_level:1,ingredient_name:'醒腦咖啡豆',quantity:2},
  {pokemon_id:'P1',unlock_level:30,ingredient_name:'放鬆可可',quantity:3},
  {pokemon_id:'P2',unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:2},
  {pokemon_id:'P2',unlock_level:30,ingredient_name:'醒腦咖啡豆',quantity:3},
  {pokemon_id:'P3',unlock_level:1,ingredient_name:'醒腦咖啡豆',quantity:2},
  {pokemon_id:'P3',unlock_level:30,ingredient_name:'醒腦咖啡豆',quantity:4},
  {pokemon_id:'P3',unlock_level:60,ingredient_name:'萌綠玉米',quantity:7},
  {pokemon_id:'ARCHIVE',unlock_level:1,ingredient_name:'美味尾巴',quantity:1},
];
const subskillRows=[
  {pokemon_id:'P1',unlock_level:10,subskill_name:'食材機率提升S',is_unlocked:1},
  {pokemon_id:'P1',unlock_level:25,subskill_name:'幫忙速度S',is_unlocked:1},
  {pokemon_id:'P1',unlock_level:50,subskill_name:'技能機率提升M',is_unlocked:0},
  {pokemon_id:'P2',unlock_level:10,subskill_name:'持有上限提升S',is_unlocked:1},
  {pokemon_id:'P2',unlock_level:50,subskill_name:'食材機率提升M',is_unlocked:0},
  {pokemon_id:'P3',unlock_level:10,subskill_name:'技能機率提升S',is_unlocked:1},
  {pokemon_id:'P3',unlock_level:50,subskill_name:'食材機率提升M',is_unlocked:1},
  {pokemon_id:'ARCHIVE',unlock_level:10,subskill_name:'食材機率提升M',is_unlocked:1},
];

assert.equal(POKEMON_ROSTER_FILTER_CONTRACT_VERSION,'pokemon-roster-unlocked-filters-2026-08-14-a');
assert.equal(ingredientSlotUnlocked(pokemonRows[0],ingredientRows[0]),true);
assert.equal(ingredientSlotUnlocked(pokemonRows[0],ingredientRows[1]),false,'Lv25 must not expose Lv30 ingredient');
assert.equal(subskillSlotUnlocked(pokemonRows[0],subskillRows[0]),true);
assert.equal(subskillSlotUnlocked(pokemonRows[0],subskillRows[2]),false,'locked Lv50 subskill must remain hidden');
assert.equal(subskillSlotUnlocked(pokemonRows[2],subskillRows[6]),true,'explicitly/current-level unlocked subskill must be visible');

const profiles=buildPokemonRosterFilterProfiles({
  pokemonRows,ingredientRows,subskillRows,
  resolveMainSkillName:value=>value==='食材獲取S'?'食材獲取S（固定）':value,
});
assert.equal(profiles.length,3,'archived Pokémon must not enter facets');
const p1=profiles.find(row=>row.pokemon_id==='P1');
const p2=profiles.find(row=>row.pokemon_id==='P2');
const p3=profiles.find(row=>row.pokemon_id==='P3');
assert.deepEqual(p1.ingredients,['醒腦咖啡豆']);
assert.deepEqual(p1.subskills.sort(),['幫忙速度S','食材機率提升S'].sort());
assert.equal(p1.main_skill,'食材獲取S（固定）');

const facets=buildPokemonRosterFacetOptions(profiles);
assert.deepEqual(facets.berries,['橙橙果','葡萄果','金枕果'].sort((a,b)=>a.localeCompare(b,'zh-Hant')));
assert.ok(facets.ingredients.includes('醒腦咖啡豆'));
assert.ok(facets.ingredients.includes('萌綠玉米'));
assert.ok(!facets.ingredients.includes('放鬆可可'),'locked ingredient must not become a filter option');
assert.ok(!facets.ingredients.includes('美味尾巴'),'archived roster data must not become a filter option');
assert.equal(facets.ingredients.filter(value=>value==='醒腦咖啡豆').length,1,'facet values must be deduplicated');
assert.ok(!facets.subskills.includes('技能機率提升M'),'locked subskill must not become a filter option');
assert.ok(facets.subskills.includes('食材機率提升M'));

const coffee={ingredient:'醒腦咖啡豆'};
assert.equal(profileMatchesRosterFilters(p1,coffee),true);
assert.equal(profileMatchesRosterFilters(p2,coffee),true);
assert.equal(profileMatchesRosterFilters(p3,coffee),true);
const p1Evidence=recommendationEvidenceForProfile(p1,coffee);
assert.ok(p1Evidence.badges.some(row=>row.label==='性格加成：食材機率↑'));
assert.ok(p1Evidence.badges.some(row=>row.label==='副技能加成：食材機率提升S'));
assert.ok(p1Evidence.badges.some(row=>row.label==='食材專長'));
const p2Evidence=recommendationEvidenceForProfile(p2,coffee);
assert.ok(p2Evidence.badges.some(row=>row.label==='性格降低：食材機率↓'));
const rankedCoffee=rankRosterFilterMatches(profiles,coffee);
assert.equal(rankedCoffee.length,3);
assert.equal(rankedCoffee[0].profile.pokemon_id,'P1','explicit relevant positive evidence must outrank higher existing rating with a relevant penalty');
assert.ok(rankedCoffee[0].evidence.score>rankedCoffee[1].evidence.score);

const skillFilter={main_skill:'食材獲取S（固定）'};
const rankedSkill=rankRosterFilterMatches(profiles,skillFilter);
assert.deepEqual(rankedSkill.map(row=>row.profile.pokemon_id).sort(),['P1','P3']);
assert.ok(recommendationEvidenceForProfile(p3,skillFilter).badges.some(row=>row.label==='副技能加成：技能機率提升S'));

const subskillFilter={subskill:'食材機率提升M'};
assert.deepEqual(rankRosterFilterMatches(profiles,subskillFilter).map(row=>row.profile.pokemon_id),['P3']);

const noContext=recommendationEvidenceForProfile(p1,{});
assert.equal(noContext.has_recommendation_context,false);
assert.equal(noContext.score,0);
assert.deepEqual(noContext.badges,[]);

console.log(JSON.stringify({
  status:'PASS',
  gate:'POKEMON_ROSTER_UNLOCKED_FILTERS',
  contract_version:POKEMON_ROSTER_FILTER_CONTRACT_VERSION,
  active_profiles:profiles.length,
  ingredient_options:facets.ingredients.length,
  subskill_options:facets.subskills.length,
  coffee_matches:rankedCoffee.length,
  coffee_first_recommendation:rankedCoffee[0].profile.pokemon_id,
  locked_values_excluded:true,
  deduplicated:true,
  production_rate_estimated:false,
},null,2));
