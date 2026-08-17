import assert from 'node:assert/strict';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  validatePublicMasterRecognitionPayload,
  compilePublicMasterRecognitionToUpdatePackage,
} from '../assets/js/public-master-recognition.js';
import {recoverExactUnlockedRecipeRecognition,exactUnlockedRecipeRow} from '../assets/js/recipe-recognition-exact-recovery.js';
import {buildUpdatePackageJsonSchema} from '../assets/js/update-package-contract.js';
import {
  buildUcImgWeeklyPlatformAuthority,
  constrainUcImgWeeklyJsonSchema,
  applyUcImgWeeklyPlatformAuthority,
  ucImgWeeklySemanticFields,
} from '../assets/js/uc-img-weekly-platform-authority.js';
import {canonicalBerryName} from '../assets/js/public-berry-strength-master.js';
import {BERRY_BY_TYPE,BERRIES} from '../assets/js/pokemon-master-options.js';
import {buildPokemonRosterFilterProfiles,buildPokemonRosterFacetOptions,profileMatchesRosterFilters} from '../assets/js/pokemon-roster-filter-contract.js';
import {projectPokemonCandidateFeatures} from '../assets/js/pokemon-candidate-feature-projection.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const recipeSnapshot=buildPublicMasterCatalogSnapshot('recipes');
const exactNames=['大爆炸爆米花','甜甜香氣巧克力蛋糕','我行我素蔬菜汁','特選蘋果汁'];
for(const name of exactNames)assert.ok(recipeSnapshot.rows.some(row=>row.recipe_name===name),`missing canonical recipe ${name}`);
const exactObservations=exactNames.map((name,index)=>({
  observation_id:`exact-${index+1}`,
  status:'UNMATCHED',
  observed_text:name,
  observed_data:{unlocked:true,recipe_level:[27,19,16,9][index],current_energy:[9193,4493,2463,992][index]},
  source_image_ref:`image-${82+index}`,
  confidence:0.7,
  reason:'PARTIALLY_OCCLUDED_BY_UI',
}));
for(const observation of exactObservations)assert.ok(exactUnlockedRecipeRow(observation),`${observation.observed_text} must resolve exact despite unrelated UI occlusion`);
const locked=Array.from({length:5},(_,index)=>({
  observation_id:`locked-${index+1}`,
  status:'UNMATCHED',
  observed_text:'4種食材的點心',
  observed_data:{unlocked:false},
  source_image_ref:'image-086',
  confidence:0.99,
  reason:'LOCKED_UNKNOWN_RECIPE_SLOT',
}));
const rawRecipe={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:recipeSnapshot.scenario,
  authority:recipeSnapshot.authority,
  data_version:recipeSnapshot.data_version,
  catalog_snapshot_id:recipeSnapshot.catalog_snapshot_id,
  generated_at:'2026-08-17T02:00:00.000Z',
  visible_target_count:9,
  observations:[...exactObservations,...locked],
  capacity_observations:[],
};
const recovered=recoverExactUnlockedRecipeRecognition(rawRecipe);
assert.equal(recovered.recovered_count,4);
assert.equal(recovered.payload.observations.filter(row=>row.status==='MATCHED').length,4);
assert.equal(recovered.payload.observations.filter(row=>row.reason?.startsWith('PLATFORM_EXACT_UNLOCKED_RECIPE_RECOVERY')).length,4);
const recipeValidation=validatePublicMasterRecognitionPayload(recovered.payload,'recipes',{allowedImageRefs:['image-82','image-83','image-84','image-85','image-086']});
assert.equal(recipeValidation.ok,true,recipeValidation.errors.join('|'));
assert.equal(recipeValidation.unresolved.length,0);
assert.equal(recipeValidation.warnings.filter(message=>message.includes('未解鎖未知料理槽位')).length,5);
const compiled=compilePublicMasterRecognitionToUpdatePackage(recovered.payload,'recipes',{allowedImageRefs:['image-82','image-83','image-84','image-85','image-086']});
assert.equal(compiled.ok,true);
assert.equal(compiled.update_package.operations.filter(operation=>operation.entity==='recipes').length,4);
assert.equal(compiled.summary.ignored_count,5);
const fuzzy={...exactObservations[0],observation_id:'fuzzy',observed_text:'大爆炸爆米',reason:'PARTIALLY_OCCLUDED_RECIPE_NAME'};
assert.equal(exactUnlockedRecipeRow(fuzzy),null,'partial recipe name must remain fail-closed');

const weeklyAuthority=buildUcImgWeeklyPlatformAuthority(new Date('2026-08-17T02:10:00.000Z'));
const genericWeeklySchema=buildUpdatePackageJsonSchema({scenario:'weekly_context_update',entities:['weekly_context'],weekly:true});
const weeklySchema=constrainUcImgWeeklyJsonSchema(genericWeeklySchema,weeklyAuthority);
const weeklyDataSchema=weeklySchema.properties.operations.items.properties.data;
for(const field of ['camp','dish_category','event_name','event_effects','base_notes','week_start','updated_at'])assert.ok(weeklyDataSchema.properties[field],`weekly structured schema missing ${field}`);
for(const effect of ['recipe_final_energy_multiplier','extra_tasty_multiplier','sunday_extra_tasty_multiplier','cross_sleep_type_encounters','unknown_effects'])assert.ok(weeklyDataSchema.properties.event_effects.properties[effect],`weekly event schema missing ${effect}`);
assert.equal(Object.hasOwn(weeklyDataSchema.properties,'pot_size'),false,'weekly internal Gemini must not own base pot capacity');
const platformOnly={schema_version:'1.1',update_id:'fixture',generated_at:'2026-08-17T02:10:00.000Z',source:'ai_screenshot_analysis',scenario:'weekly_context_update',context_authority:'UPDATE_CENTER_JSON',operations:[{operation_id:'weekly',entity:'weekly_context',action:'upsert',key:{context_id:weeklyAuthority.context_id},data:{week_start:weeklyAuthority.week_start,updated_at:weeklyAuthority.updated_at},evidence:{source_image_ref:'image-event',confidence:1},review_required:false}]};
assert.throws(()=>applyUcImgWeeklyPlatformAuthority(platformOnly,weeklyAuthority),error=>error?.code==='UC_IMG_WEEKLY_SEMANTIC_INTAKE_EMPTY');
const withEvent=structuredClone(platformOnly);
withEvent.operations[0].data.camp='黃金舊發電廠';
withEvent.operations[0].data.dish_category='甜點／飲料';
withEvent.operations[0].data.event_effects={
  recipe_final_energy_multiplier:1.25,
  extra_tasty_multiplier:2.5,
  sunday_extra_tasty_multiplier:3.75,
  cross_sleep_type_encounters:true,
  unknown_effects:[{source_text:'所有幫手寶可夢的主技能發動機率變成1.25倍。',source_image_ref:'image-event'}],
};
withEvent.operations[0].review_required=true;
const applied=applyUcImgWeeklyPlatformAuthority(withEvent,weeklyAuthority);
assert.ok(ucImgWeeklySemanticFields(applied.operations[0].data).includes('event_effects'));
assert.equal(applied.operations[0].data.camp,'黃金舊發電廠');

assert.equal(canonicalBerryName('葡萄果'),'萄葡果');
assert.equal(canonicalBerryName('萄葡果'),'萄葡果');
assert.equal(BERRY_BY_TYPE['電'],'萄葡果');
assert.equal(BERRIES.includes('葡萄果'),false);
assert.equal(BERRIES.includes('萄葡果'),true);
const rosterProfiles=buildPokemonRosterFilterProfiles({
  pokemonRows:[{pokemon_id:'p1',status:'active',favorite_berry:'葡萄果',level:30}],
  ingredientRows:[],subskillRows:[],
});
assert.equal(rosterProfiles[0].berry,'萄葡果');
assert.deepEqual(buildPokemonRosterFacetOptions(rosterProfiles).berries,['萄葡果']);
assert.equal(profileMatchesRosterFilters(rosterProfiles[0],{berry:'萄葡果'}),true);
const candidateProjection=projectPokemonCandidateFeatures({
  pokemon:[{pokemon_id:'p1',status:'active',species:'雷丘',level:30,specialty:'樹果',type:'電',nature:'勤奮',main_skill:'能量填充S',main_skill_level:3,helper_seconds:2094,carry_limit:32,favorite_berry:'葡萄果'}],
  pokemonDetails:[],
  weeklyContext:{context_id:'weekly_context_2026-08-17_import',week_start:'2026-08-17',favorite_berry_1:'萄葡果',favorite_berry_2:'墨莓果',favorite_berry_3:'靛莓果'},
});
assert.equal(candidateProjection.candidates[0].favorite_berry,'萄葡果');
assert.equal(candidateProjection.candidates[0].favorite_berry_match,true);

const production=currentProductionAuthorityRegistry();
assert.equal(production.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(production.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(production.active_verified_dimensions.length,4);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V04274_LIVE_S2_S4_REGRESSION',
  exact_unlocked_recipe_recovered:4,
  locked_recipe_slots_ignored:5,
  fuzzy_recipe_identity_still_review:true,
  weekly_semantic_schema_explicit:true,
  weekly_platform_only_fail_closed:true,
  weekly_base_pot_authority:false,
  pokemon_legacy_grepa_projected:'葡萄果->萄葡果',
  roster_filter_canonical:true,
  candidate_weekly_match_canonical:true,
  ingredient_probability_authority:'4/7_HOLD',
},null,2));
