import assert from 'node:assert/strict';
import {
  PERSONAL_RECIPE_AUTHORITY_VERSION,
  PLAYER_RECIPE_SOURCE,
  normalizePersonalRecipeDraft,
  buildPersonalRecipeMutationPlan,
} from '../assets/js/personal-recipe-authority.js';

const draft=normalizePersonalRecipeDraft({
  recipe_id:'player:test-curry',
  category:'咖哩／濃湯',
  recipe_name:'我的測試咖哩',
  unlocked:true,
  recipe_level:'12',
  current_energy:'3456',
  notes:'手機手動建立',
  ingredients:[
    {ingredient_name:'豆製肉',quantity:3},
    {ingredient_name:'好眠番茄',quantity:2},
    {ingredient_name:'豆製肉',quantity:4},
  ],
});
assert.equal(draft.source,PLAYER_RECIPE_SOURCE);
assert.equal(draft.total_ingredients,9);
assert.deepEqual(draft.ingredients,[
  {ingredient_name:'好眠番茄',quantity:2},
  {ingredient_name:'豆製肉',quantity:7},
]);
assert.equal(draft.recipe_level,12);
assert.equal(draft.current_energy,3456);

for(const action of ['create','update']){
  const plan=buildPersonalRecipeMutationPlan({action,draft,publicRecipeIds:['public:001'],publicRecipeNames:['公版咖哩']});
  assert.equal(plan.authority_version,PERSONAL_RECIPE_AUTHORITY_VERSION);
  assert.equal(plan.requires_snapshot,true);
  assert.equal(plan.requires_single_transaction,true);
  assert.equal(plan.requires_import_audit,true);
  assert.equal(plan.requires_persist_after_commit,true);
  assert.equal(plan.public_master_write_allowed,false);
}
const deletePlan=buildPersonalRecipeMutationPlan({action:'delete',before:draft,publicRecipeIds:['public:001'],publicRecipeNames:['公版咖哩']});
assert.equal(deletePlan.after,null);
assert.equal(deletePlan.recipe_id,'player:test-curry');

assert.throws(()=>normalizePersonalRecipeDraft({...draft,recipe_id:'public:001'}),/player: namespace/);
assert.throws(()=>buildPersonalRecipeMutationPlan({action:'create',draft:{...draft,recipe_name:'公版咖哩'},publicRecipeIds:['public:001'],publicRecipeNames:['公版咖哩']}),/read-only/);
assert.throws(()=>normalizePersonalRecipeDraft({...draft,recipe_level:0}),/recipe_level/);
assert.throws(()=>normalizePersonalRecipeDraft({...draft,ingredients:[{ingredient_name:'豆製肉',quantity:0}]}),/quantity/);

console.log(JSON.stringify({
  contract:'g51-personal-recipe-authority',
  authority_version:PERSONAL_RECIPE_AUTHORITY_VERSION,
  status:'PASS',
  deterministic_total:draft.total_ingredients,
  player_namespace_required:true,
  public_id_and_name_collision_blocked:true,
  public_master_write_allowed:false,
  snapshot_transaction_audit_persist:true,
},null,2));
