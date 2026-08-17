import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveRecipePortfolioEnergyContext,RECIPE_PORTFOLIO_EVENT_AUTHORITY_VERSION} from '../assets/js/recipe-portfolio-event-authority.js';
import {projectRecipePortfolioContention} from '../assets/js/recipe-portfolio-contention.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const legacyMultiplier=9.9;
const legacyOnlyWeek={
  week_start:'2026-08-17',dish_category:'甜點／飲料',pot_size:60,
  recipe_final_energy_multiplier:legacyMultiplier,
  event_effects_parsed:{recipe_final_energy_multiplier:legacyMultiplier},
  strategy_event_effects:{},
  event_authority_source:'PUBLIC_EVENT_MASTER',
  public_event_master_version:'public-event-master-tw-2026-08-17-a',
  public_event_authority_version:'public-event-authority-2026-08-17-a',
  public_event_authority_status:'PARTIAL_VERIFIED',
  legacy_player_event_observation:{event_effects_parsed:{recipe_final_energy_multiplier:legacyMultiplier},deterministic_authority:false},
};
const identity=resolveRecipePortfolioEnergyContext(legacyOnlyWeek);
assert.equal(RECIPE_PORTFOLIO_EVENT_AUTHORITY_VERSION,'recipe-portfolio-event-authority-2026-08-17-a');
assert.equal(identity.recipe_final_energy_multiplier,1,'legacy Player Weekly multiplier must collapse to identity');
assert.equal(identity.deterministic_event_effect_available,false);
assert.equal(identity.multiplier_source,'DEFAULT_IDENTITY_NO_VERIFIED_EVENT_EFFECT');
assert.equal(identity.public_event_authority_status,'PARTIAL_VERIFIED');
assert.equal(identity.legacy_player_event_deterministic_authority,false);

const verifiedPublicWeek={
  ...legacyOnlyWeek,
  strategy_event_effects:{recipe_final_energy_multiplier:1.25},
  public_event_authority_status:'VERIFIED',
};
const verified=resolveRecipePortfolioEnergyContext(verifiedPublicWeek);
assert.equal(verified.recipe_final_energy_multiplier,1.25);
assert.equal(verified.deterministic_event_effect_available,true);
assert.equal(verified.multiplier_source,'PUBLIC_EVENT_MASTER_ACTIVE_VERIFIED');

const candidate={
  recipe_id:'fixture_recipe',recipe_name:'fixture',base_energy:80,current_energy:100,recipe_level:10,unlocked:true,
  hard_constraint_status:'PASS',candidate_status:'COOK_NOW_UNLOCKED',requirements:[{ingredient_name:'特選蘋果',required:1}],
};
const recipeStrategy={input_fingerprint:'fixture-strategy',candidates:[candidate]};
const inventory=[{ingredient_name:'特選蘋果',quantity:10}];
const identityProjection=projectRecipePortfolioContention({recipeStrategy,inventory,energyContext:identity,objective:'maximize_verified_energy',maxMeals:1,maxAlternatives:1});
const verifiedProjection=projectRecipePortfolioContention({recipeStrategy,inventory,energyContext:verified,objective:'maximize_verified_energy',maxMeals:1,maxAlternatives:1});
assert.equal(identityProjection.alternatives[0].steps[0].verified_event_multiplier,1);
assert.equal(identityProjection.alternatives[0].steps[0].projected_verified_energy,100,'legacy multiplier must not inflate G7.2 energy');
assert.equal(verifiedProjection.alternatives[0].steps[0].verified_event_multiplier,1.25);
assert.equal(verifiedProjection.alternatives[0].steps[0].projected_verified_energy,125,'verified Public Event multiplier must remain usable');
assert.notEqual(identityProjection.input_fingerprint,verifiedProjection.input_fingerprint,'verified Public Event effect must alter planner fingerprint');

const local=fs.readFileSync('assets/js/recipe-portfolio-contention-local.js','utf8');
assert.ok(local.includes("from './effective-weekly-context.js'"));
assert.ok(local.includes('currentEffectiveWeeklyContext()'));
assert.equal(local.includes("from './weekly-context-store.js'"),false,'G7.2 local adapter must not read raw Player Weekly context');
assert.ok(local.includes('resolveRecipePortfolioEnergyContext(week)'));
assert.ok(local.includes('legacy_player_event_deterministic_authority:false'));
const ui=fs.readFileSync('assets/js/war-room-cooking-planner-ui.js','utf8');
for(const token of [
  'PUBLIC_EVENT_MASTER_ACTIVE_VERIFIED',
  'Public Event Master 目前沒有 ACTIVE_VERIFIED',
  'identity 1',
  'legacy Player Weekly event 僅供 audit，不具 deterministic authority',
])assert.ok(ui.includes(token),`G7.2 authority UI token missing: ${token}`);

const production=currentProductionAuthorityRegistry();
assert.equal(production.active_verified_dimensions.length,4);
assert.equal(production.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(production.numeric_rate_model_status,'NOT_YET_VERIFIED');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.27.5_G72_EFFECTIVE_PUBLIC_EVENT_ENERGY_AUTHORITY',
  authority_version:RECIPE_PORTFOLIO_EVENT_AUTHORITY_VERSION,
  legacy_player_multiplier:legacyMultiplier,
  legacy_multiplier_applied:false,
  no_verified_public_event_multiplier:identity.recipe_final_energy_multiplier,
  verified_public_event_multiplier:verified.recipe_final_energy_multiplier,
  identity_projected_energy:identityProjection.alternatives[0].steps[0].projected_verified_energy,
  verified_projected_energy:verifiedProjection.alternatives[0].steps[0].projected_verified_energy,
  public_event_master_version:identity.public_event_master_version,
  public_event_authority_status:identity.public_event_authority_status,
  production_numeric_authority:'4/7_HOLD_INGREDIENT_PROBABILITY',
},null,2));
