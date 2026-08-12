import assert from 'node:assert/strict';
import {RESOURCE_EVIDENCE_POLICY_VERSION,resourceQuantityState,summarizeResourceCollectionEvidence} from '../assets/js/resource-context.js';
import {buildStrategyAnalysisPack} from '../assets/js/external-strategy-analysis-pack.js';

const ingredients=[
  {ingredient_name:'Apple',quantity:10,available:10,player_record_exists:true,quantity_state:'OBSERVED_QUANTITY'},
  {ingredient_name:'Milk',quantity:0,available:0,player_record_exists:true,quantity_state:'ZERO_CONFIRMED'},
  {ingredient_name:'Honey',quantity:0,available:0,player_record_exists:false,quantity_state:'NOT_OBSERVED'},
];
assert.equal(resourceQuantityState(ingredients[0]),'OBSERVED_QUANTITY');
assert.equal(resourceQuantityState(ingredients[1]),'ZERO_CONFIRMED');
assert.equal(resourceQuantityState(ingredients[2]),'NOT_OBSERVED');
const ingredientEvidence=summarizeResourceCollectionEvidence(ingredients,{collection:'ingredients'});
const candyEvidence=summarizeResourceCollectionEvidence([{candy_name:'Pika',quantity:0,player_record_exists:false,quantity_state:'NOT_OBSERVED'}],{collection:'candies'});
assert.deepEqual([ingredientEvidence.observed_row_count,ingredientEvidence.confirmed_zero_row_count,ingredientEvidence.missing_row_count],[2,1,1]);
assert.equal(ingredientEvidence.zero_fill_authorized,false);
assert.equal(candyEvidence.completeness_status,'NOT_OBSERVED');

const candidate={pokemon_id:'local-001',species:'Pikachu',level:20,specialty:'berries',type:'electric',hard_constraint_status:'PASS',current_readiness_score:72,favorite_berry_match:true,weekly_ingredient_overlap:['Honey'],weekly_ingredient_demand_covered:0,profile_completeness:{ratio:1},missing_inputs:[],failed_constraints:[],reasons:[]};
const recipeStrategy={projection_status:'READY',input_fingerprint:'recipe-fixture',candidates:[{recipe_id:'honey-test',recipe_name:'Honey Test',category:'curry',unlocked:true,total_ingredients:5,candidate_status:'COOK_NOW_UNLOCKED',hard_constraint_status:'PASS',pot_fit:true,total_raw_shortage:5,total_strategy_shortage:5,requirements:[{ingredient_name:'Honey',required:5,owned:0,usable:0,safe_reserve:0,raw_shortage:5,strategy_shortage:5}]}]};
const portfolio={planner_version:'recipe-portfolio-fixture',projection_status:'READY',input_fingerprint:'portfolio-fixture',recipe_strategy_fingerprint:'recipe-fixture',objective:'unlock_recipes',context:{max_meals:3},summary:{alternative_count:0},contention:{contention_edge_count:0,oversubscribed_ingredient_count:0},alternatives:[],missing_inventory_observations:[{recipe_id:'honey-test',ingredients:['Honey']}],player_data_write:false,inventory_mutation:false,public_master_write:false,gemini_used:false};
const pack=buildStrategyAnalysisPack({
  weeklyContext:{week_start:'2026-08-10',camp:'萌綠之島',pot_size:60},
  resourceSnapshot:{version:'fixture',status:'READY',collection_evidence:{policy_version:RESOURCE_EVIDENCE_POLICY_VERSION,ingredients:ingredientEvidence,items:summarizeResourceCollectionEvidence([],{collection:'items'}),candies:candyEvidence},ingredients,items:[],candies:[{candy_name:'Pika',quantity:0,safe_reserve:0,available:0,player_record_exists:false,quantity_state:'NOT_OBSERVED'}],candy_conversion:{rule_status:'NOT_YET_VERIFIED'}},
  candidateScoring:{candidates:[candidate]},currentTeamPokemonIds:['local-001'],teamOptimization:{projection_status:'READY',primary:null,alternatives:[]},recipeStrategy,
  recipeDiscovery:{projection_status:'READY',summary:{},discovery_candidates:[],stockpile:[],production_rate_model:'NOT_YET_VERIFIED'},recipePortfolio:portfolio,
}).pack;

const byName=new Map(pack.resource_snapshot.ingredients.map(row=>[row.ingredient_name,row]));
assert.equal(byName.get('Apple').quantity,10);
assert.equal(byName.get('Milk').quantity,0);
assert.equal(byName.get('Milk').quantity_state,'ZERO_CONFIRMED');
assert.equal(byName.get('Honey').quantity,null,'missing row must remain unknown');
assert.equal(byName.get('Honey').available,null);
assert.equal(byName.get('Honey').quantity_state,'NOT_OBSERVED');
assert.deepEqual(pack.resource_snapshot.candies,[],'empty export must not imply zero');
assert.equal(pack.resource_snapshot.collection_evidence.candies.completeness_status,'NOT_OBSERVED');
assert.equal(pack.resource_snapshot.collection_evidence.candies.missing_row_count,1);
const req=pack.deterministic_results.recipe_strategy.candidates[0].requirements[0];
assert.equal(req.physical_quantity,null);
assert.equal(req.physical_quantity_state,'NOT_OBSERVED');
assert.equal(req.inventory_parity_status,'MISSING_RESOURCE');
assert.ok(pack.evidence_authority_manifest.deterministic_fields.includes('candidate_pokemon.current_readiness_score'));
assert.equal(pack.deterministic_results.recipe_portfolio.projection_status,'READY');
assert.equal(pack.deterministic_results.recipe_portfolio.read_only_manifest.inventory_mutation,false);
assert.equal(pack.deterministic_results.recipe_portfolio.read_only_manifest.direct_apply_allowed,false);
assert.equal(pack.integrity_manifest.recipe_portfolio_read_only,true);
assert.equal(pack.integrity_manifest.resource_unknown_preserved,true);
assert.equal(pack.safety_manifest.direct_apply_allowed,false);
assert.ok(pack.evidence_gaps.some(value=>value.includes('resource_collection:ingredients:PARTIAL')));
assert.ok(pack.evidence_gaps.some(value=>value.includes('recipe_portfolio:missing_inventory_observations:1')));
assert.equal(JSON.stringify(pack).includes('local-001'),false);
console.log(JSON.stringify({status:'PASS',gate:'G7.2_EVIDENCE_AUTHORITY_STRATEGY_PACK',policy:RESOURCE_EVIDENCE_POLICY_VERSION,missing_not_zero:true,explicit_zero_preserved:true,empty_collection_not_zero:true,portfolio_read_only:true},null,2));
