import fs from 'node:fs';
import {
  projectRecipeStrategy,
} from '../assets/js/recipe-strategy-projection.js';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
} from '../assets/js/public-recipe-master.js';
import {
  PUBLIC_RECIPE_PROVENANCE,
  PUBLIC_RECIPE_PROVENANCE_VERSION,
} from '../assets/js/public-recipe-provenance.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const dessert=PUBLIC_RECIPE_MASTER.find(row=>row.recipe_name==='特選蘋果汁');
assert(dessert,'dessert_fixture_missing');
const dessertProjection=projectRecipeStrategy({
  recipes:[dessert],
  recipeIngredients:dessert.ingredients.map(item=>({
    recipe_id:dessert.recipe_id,
    ingredient_name:item.ingredient_name,
    quantity:item.quantity,
  })),
  recipeStates:[{
    recipe_id:dessert.recipe_id,
    unlocked:0,
    player_record_exists:0,
    player_recipe_id:null,
  }],
  inventory:[{ingredient_name:'特選蘋果',quantity:8}],
  provenance:PUBLIC_RECIPE_PROVENANCE,
  potSize:20,
  dishCategory:'點心／飲料',
  requireVerifiedMaster:true,
  masterVersion:PUBLIC_RECIPE_MASTER_VERSION,
  provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
});
assert(dessertProjection.context.dish_category==='甜點／飲料','weekly_dessert_alias_not_canonicalized');
assert(dessertProjection.candidates.length===1,'weekly_dessert_alias_filtered_out_recipe');
assert(dessertProjection.candidates[0].recipe_id===dessert.recipe_id,'weekly_dessert_alias_wrong_candidate');
assert(dessertProjection.candidates[0].candidate_status==='UNLOCK_CANDIDATE_READY','weekly_dessert_alias_wrong_status');

const g3=fs.readFileSync('assets/js/g3-planning.js','utf8');
const local=fs.readFileSync('assets/js/recipe-strategy-local.js','utf8');
const serviceWorker=fs.readFileSync('service-worker.js','utf8');
for(const token of [
  "import { buildLocalRecipeStrategyProjection } from './recipe-strategy-local.js'",
  'warroomRecipeProjection',
  '料理策略候選（本機 deterministic）',
  '不呼叫 Gemini',
  'result.input_fingerprint',
  'requireVerifiedMaster: true',
])assert(g3.includes(token),`war_room_ui_contract_missing:${token}`);
assert(local.includes("projection_status:'PLAYER_DATA_UNAVAILABLE'"),'rescue_player_data_unavailable_contract_missing');
assert(local.includes("projection_status:'READY'"),'local_strategy_ready_contract_missing');
assert(local.includes("row.lifecycle==='ACTIVE'"),'local_adapter_does_not_filter_active_provenance');
for(const asset of [
  "'./assets/js/public-recipe-provenance.js'",
  "'./assets/js/recipe-strategy-projection.js'",
  "'./assets/js/recipe-strategy-local.js'",
])assert(serviceWorker.includes(asset),`offline_cache_missing:${asset}`);

// War Room recipe projection must stay local. Gemini integration is a later,
// explicit Strategy Context Package layer and must not be imported here.
assert(!g3.includes('ai-project-pool-runtime.js'),'war_room_recipe_ui_imports_provider_runtime');
assert(!local.includes('ai-project-pool-runtime.js'),'local_recipe_strategy_imports_provider_runtime');

console.log(JSON.stringify({
  status:'PASS',
  schema:'pokemon-sleep-war-room-recipe-ui-contract/1.0',
  weekly_category_alias:{input:'點心／飲料',canonical:'甜點／飲料',candidate_count:1},
  local_deterministic_projection:true,
  gemini_called:false,
  rescue_player_data_unavailable:true,
  active_provenance_only:true,
  projection_fingerprint_visible:true,
  offline_strategy_assets_cached:true,
  player_data_write:false,
},null,2));
